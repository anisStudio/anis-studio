// Shared modules live under ../_shared (synced from src/lib via npm run edge:sync-shared)
// so the Edge Docker mount can resolve them without the repo root.
import { handleInquiryRequest, type GatewayEnv } from '../_shared/webAtelierEdgeHandler.ts'
import { resolveDevHostAccess } from '../_shared/webAtelierGatewayPolicy.ts'

function envFlag(name: string): boolean {
  return Deno.env.get(name) === 'true'
}

function readEnv(): GatewayEnv | null {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY') ?? ''
  const rateLimitPepper = Deno.env.get('RATE_LIMIT_PEPPER') ?? ''
  if (!supabaseUrl || !serviceRoleKey || !turnstileSecret || !rateLimitPepper) return null
  return {
    supabaseUrl,
    serviceRoleKey,
    turnstileSecret,
    rateLimitPepper,
    allowWww: envFlag('TURNSTILE_ALLOW_WWW'),
    allowDevHosts: resolveDevHostAccess(supabaseUrl, envFlag('TURNSTILE_ALLOW_DEV_HOSTS')),
  }
}

const env = readEnv()

Deno.serve((req: Request) => handleInquiryRequest(req, { env, fetchImpl: fetch }))
