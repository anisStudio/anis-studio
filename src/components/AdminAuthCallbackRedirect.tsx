import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ADMIN_PASSWORD_RECOVERY_PATH,
  isAuthRecoveryCallback,
  parseAuthCallbackParams,
} from '../lib/adminPassword'

/**
 * When Supabase recovery/error lands on Site URL (e.g. `/`) with hash/query,
 * forward to the admin reset page so the user never sees a blank home page.
 * Preserves search + hash so the client can finish Auth exchange.
 */
export function AdminAuthCallbackRedirect() {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (location.pathname.startsWith(ADMIN_PASSWORD_RECOVERY_PATH)) return
    if (location.pathname.startsWith('/admin/forgot-password')) return

    const href = `${window.location.origin}${location.pathname}${location.search}${location.hash}`
    const params = parseAuthCallbackParams(href)
    if (!isAuthRecoveryCallback(params)) return

    navigate(
      {
        pathname: ADMIN_PASSWORD_RECOVERY_PATH,
        search: location.search,
        hash: location.hash,
      },
      { replace: true },
    )
  }, [location.hash, location.pathname, location.search, navigate])

  return null
}
