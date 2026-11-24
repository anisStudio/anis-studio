/**
 * Applies the LRC catalog migration to a throwaway Postgres container.
 * Never reads project env files and never contacts a hosted database.
 * Exits 0 with a skip message when Docker is unavailable.
 */
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const container = 'lrc-catalog-rls-test'
const migration = readFileSync(
  join(root, 'supabase/migrations/20261124000000_lrc_product_catalog.sql'),
  'utf8',
)

const setupSql = `
create role anon nologin;
create role authenticated nologin;
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$ select current_setting('lrc.test_admin', true) = 'true' $$;
`

const content = JSON.stringify({
  title: { hr: 'Test', en: 'Test' },
  specs: { hr: '', en: '' },
  description: { hr: '', en: '' },
  retailPriceEuro: 1,
  basePriceEuro: 1,
  basePriceDate: '1. 1. 2026.',
  photos: [],
}).replace(/'/g, "''")

function run(command, args, input) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.on('error', (error) => resolve({ code: 1, stdout, stderr: `${stderr}${error.message}` }))
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }))
    if (input) child.stdin.end(input)
    else child.stdin.end()
  })
}

async function psql(sql) {
  return run('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'], sql)
}

function roleScript(role, adminFlag, statements) {
  return `
reset role;
select set_config('lrc.test_admin', '${adminFlag}', false);
set role ${role};
${statements}
reset role;
`
}

async function main() {
  const docker = await run('docker', ['info'])
  if (docker.code !== 0) {
    console.log('lrc catalog rls: skipped, no isolated database')
    console.log(docker.stderr.trim().split('\n').slice(-3).join('\n'))
    return
  }

  await run('docker', ['rm', '-f', container])
  const started = await run('docker', [
    'run',
    '-d',
    '--name',
    container,
    '-e',
    'POSTGRES_HOST_AUTH_METHOD=trust',
    '-e',
    'POSTGRES_PASSWORD=postgres',
    'postgres:16-alpine',
  ])
  if (started.code !== 0) {
    console.log('lrc catalog rls: skipped, could not start isolated database')
    console.log(started.stderr.trim())
    return
  }

  try {
    let ready = false
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const probe = await run('docker', ['exec', container, 'pg_isready', '-U', 'postgres'])
      if (probe.code === 0) {
        ready = true
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
    if (!ready) throw new Error('Postgres did not become ready.')

    const prepared = await psql(setupSql)
    if (prepared.code !== 0) throw new Error(prepared.stderr || prepared.stdout)
    const applied = await psql(migration)
    if (applied.code !== 0) throw new Error(applied.stderr || applied.stdout)

    const report = `
create table public.lrc_rls_report (step text primary key, actual int not null);
grant all on public.lrc_rls_report to anon, authenticated;
${roleScript('anon', 'false', `insert into public.lrc_rls_report values ('anon_initial', (select count(*)::int from public.lrc_products));`)}
${roleScript('authenticated', 'true', `update public.lrc_products set is_visible = false where code = 'LRC-VIN-03';`)}
${roleScript('anon', 'false', `
insert into public.lrc_rls_report values ('anon_after_hide', (select count(*)::int from public.lrc_products));
insert into public.lrc_rls_report values ('anon_hidden_row', (select count(*)::int from public.lrc_products where code = 'LRC-VIN-03'));
`)}
${roleScript('authenticated', 'false', `insert into public.lrc_rls_report values ('member_after_hide', (select count(*)::int from public.lrc_products));`)}
${roleScript('authenticated', 'true', `
insert into public.lrc_rls_report values ('admin_after_hide', (select count(*)::int from public.lrc_products));
insert into public.lrc_products (code, sort_order, content) values ('LRC-NEW-01', 4, '${content}'::jsonb);
insert into public.lrc_rls_report values ('new_hidden', (select case when is_visible then 1 else 0 end from public.lrc_products where code = 'LRC-NEW-01'));
insert into public.lrc_rls_report values ('baby_cover', (
  select case
    when content->'photos'->0->>'src' = '/lrc_image/proizvodi/slike/lrc-bab-03-01-zatvorena.webp' then 1
    else 0
  end
  from public.lrc_products where code = 'LRC-BAB-03'
));
update public.lrc_products set is_visible = true where code = 'LRC-VIN-03';
`)}
${roleScript('anon', 'false', `
insert into public.lrc_rls_report values ('anon_restored', (select count(*)::int from public.lrc_products where code <> 'LRC-NEW-01'));
insert into public.lrc_rls_report values ('anon_new_hidden', (select count(*)::int from public.lrc_products where code = 'LRC-NEW-01'));
`)}
${roleScript('authenticated', 'false', `
update public.lrc_products set sort_order = 99 where code = 'LRC-BAB-03';
insert into public.lrc_rls_report values ('member_sort', (select sort_order from public.lrc_products where code = 'LRC-BAB-03'));
`)}
do $$
declare
  expected text[][] := array[
    array['anon_initial', '3'],
    array['anon_after_hide', '2'],
    array['anon_hidden_row', '0'],
    array['member_after_hide', '2'],
    array['admin_after_hide', '3'],
    array['new_hidden', '0'],
    array['baby_cover', '1'],
    array['anon_restored', '3'],
    array['anon_new_hidden', '0'],
    array['member_sort', '1']
  ];
  pair text[];
  actual int;
begin
  foreach pair slice 1 in array expected loop
    select r.actual into actual from public.lrc_rls_report r where r.step = pair[1];
    if actual is null or actual::text <> pair[2] then
      raise exception 'LRC RLS % expected % got %', pair[1], pair[2], actual;
    end if;
  end loop;
end $$;
`
    const checked = await psql(report)
    if (checked.code !== 0) throw new Error(checked.stderr || checked.stdout)

    const denied = await psql(`
${roleScript('authenticated', 'false', `insert into public.lrc_products (code, sort_order, content) values ('LRC-NOPE-01', 8, '${content}'::jsonb);`)}
`)
    if (denied.code === 0) throw new Error('Non-admin insert was allowed.')

    const anonDenied = await psql(`
${roleScript('anon', 'false', `insert into public.lrc_products (code, sort_order, content) values ('LRC-NOPE-02', 8, '${content}'::jsonb);`)}
`)
    if (anonDenied.code === 0) throw new Error('Anonymous insert was allowed.')

    console.log('lrc catalog rls: ok')
  } finally {
    await run('docker', ['rm', '-f', container])
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
