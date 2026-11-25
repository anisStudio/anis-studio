const OBJECT_NAME = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function objectNameFromPath(pathname: string): string | null {
  let path = pathname
  try {
    path = decodeURIComponent(pathname)
  } catch {
    return null
  }
  const marker = '/lrc-product-image/'
  const markerAt = path.indexOf(marker)
  const name = (markerAt === -1 ? path : path.slice(markerAt + marker.length)).replace(/^\/+/, '')
  if (!OBJECT_NAME.test(name) || name.includes('..')) return null
  return name
}

function jsonHeaders(serviceKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${serviceKey}`,
    apikey: serviceKey,
    'Content-Type': 'application/json',
  }
}

async function readerId(supabaseUrl: string, serviceKey: string, authorization: string): Promise<string | null> {
  if (!authorization.toLowerCase().startsWith('bearer ')) return null
  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: authorization, apikey: serviceKey },
  })
  if (!userResponse.ok) return null
  const user = (await userResponse.json()) as { id?: string }
  return user.id && UUID.test(user.id) ? user.id : null
}

async function isImageAllowed(
  supabaseUrl: string,
  serviceKey: string,
  objectName: string,
  userId: string | null,
): Promise<boolean | null> {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/lrc_product_image_is_allowed`, {
    method: 'POST',
    headers: jsonHeaders(serviceKey),
    body: JSON.stringify({ object_name: objectName, user_id: userId }),
  })
  if (!response.ok) return null
  const result = (await response.json()) as unknown
  return result === true
}

function denied(): Response {
  return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'private, no-store' } })
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { 'Cache-Control': 'private, no-store' } })
  }
  const supabaseUrl = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/$/, '')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!supabaseUrl || !serviceKey) {
    return new Response('Image service is not configured', { status: 503, headers: { 'Cache-Control': 'private, no-store' } })
  }
  const objectName = objectNameFromPath(new URL(req.url).pathname)
  if (!objectName) return denied()

  const authorization = req.headers.get('Authorization') ?? ''
  const userId = authorization ? await readerId(supabaseUrl, serviceKey, authorization) : null
  const allowed = await isImageAllowed(supabaseUrl, serviceKey, objectName, userId)
  if (allowed !== true) return denied()

  const storagePath = objectName.split('/').map((part) => encodeURIComponent(part)).join('/')
  const file = await fetch(`${supabaseUrl}/storage/v1/object/authenticated/lrc-product-images/${storagePath}`, {
    headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
  })
  if (!file.ok) return denied()
  const type = file.headers.get('Content-Type') ?? 'application/octet-stream'
  if (!type.startsWith('image/')) return denied()
  return new Response(req.method === 'HEAD' ? null : file.body, {
    status: 200,
    headers: {
      'Content-Type': type,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
})
