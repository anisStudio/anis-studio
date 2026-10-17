import {
  handleBookingRequest,
  type BookingGatewayEnv,
} from '../../../src/lib/smartBookingEdgeHandler.ts'
import { resolveDevHostAccess } from '../../../src/lib/webAtelierGatewayPolicy.ts'

function envFlag(name: string): boolean {
  return Deno.env.get(name) === 'true'
}

function readEnv(): BookingGatewayEnv | null {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY') ?? ''
  if (!supabaseUrl || !serviceRoleKey || !turnstileSecret) return null
  return {
    supabaseUrl,
    serviceRoleKey,
    turnstileSecret,
    allowWww: envFlag('TURNSTILE_ALLOW_WWW'),
    allowDevHosts: resolveDevHostAccess(supabaseUrl, envFlag('TURNSTILE_ALLOW_DEV_HOSTS')),
  }
}

const env = readEnv()

Deno.serve((req: Request) => handleBookingRequest(req, { env, fetchImpl: fetch }))
