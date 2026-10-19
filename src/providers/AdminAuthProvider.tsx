import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import {
  failureFromSupabaseAuthError,
  messageForAdminAuthFailure,
  type AdminAuthFailureKind,
} from '../lib/adminAuthErrors'
import {
  ADMIN_PASSWORD_MIN_LENGTH,
  buildAdminPasswordRecoveryRedirectTo,
  messageForPasswordValidation,
  validateNewPasswordPair,
} from '../lib/adminPassword'
import { getSupabasePublicDiagnostics } from '../lib/supabasePublicConfig'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

export interface AdminLoginResult {
  success: boolean
  error?: string
  /** Machine-readable failure class for safe UI / tests — never secrets. */
  failureKind?: AdminAuthFailureKind
}

export interface AdminPasswordActionResult {
  success: boolean
  error?: string
}

interface AdminAuthContextValue {
  session: Session | null
  user: User | null
  isAdmin: boolean
  loading: boolean
  /** True after Supabase fires PASSWORD_RECOVERY for this tab. */
  passwordRecoveryActive: boolean
  login: (email: string, password: string) => Promise<AdminLoginResult>
  logout: () => Promise<void>
  changePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<AdminPasswordActionResult>
  requestPasswordReset: (email: string) => Promise<AdminPasswordActionResult>
  completePasswordRecovery: (
    newPassword: string,
  ) => Promise<AdminPasswordActionResult>
}

const AdminAuthContext = createContext<AdminAuthContextValue | undefined>(undefined)

/**
 * Fail closed. Only a boolean true from public.is_admin() is authorization.
 * The client is untyped, so the RPC payload is unknown until this check.
 */
async function fetchIsAdmin(): Promise<boolean> {
  if (!supabase) return false

  const { data, error } = await supabase.rpc('is_admin')
  if (error) {
    console.error('[AdminAuth] is_admin check failed:', error.message)
    return false
  }

  return data === true
}

export const AdminAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [passwordRecoveryActive, setPasswordRecoveryActive] = useState(false)

  const requestIdRef = useRef(0)
  const resolvedUserIdRef = useRef<string | null>(null)
  const inFlightUserIdRef = useRef<string | null>(null)
  const inFlightRequestIdRef = useRef(0)

  const clearAuthenticatedState = useCallback(() => {
    requestIdRef.current += 1
    resolvedUserIdRef.current = null
    inFlightUserIdRef.current = null
    inFlightRequestIdRef.current = 0
    setSession(null)
    setIsAdmin(false)
    setPasswordRecoveryActive(false)
    setLoading(false)
  }, [])

  const applySession = useCallback((nextSession: Session | null) => {
    const userId = nextSession?.user?.id ?? null
    setSession(nextSession)

    if (!userId) {
      requestIdRef.current += 1
      resolvedUserIdRef.current = null
      inFlightUserIdRef.current = null
      inFlightRequestIdRef.current = 0
      setIsAdmin(false)
      setLoading(false)
      return
    }

    // Same user is already authorized, or a check for this user is still current.
    // Token refresh must not flip isAdmin off or start another RPC.
    // A cancelled check must not block the next one.
    if (userId === resolvedUserIdRef.current) {
      return
    }
    if (
      userId === inFlightUserIdRef.current &&
      inFlightRequestIdRef.current === requestIdRef.current
    ) {
      return
    }

    const requestId = ++requestIdRef.current
    inFlightUserIdRef.current = userId
    inFlightRequestIdRef.current = requestId
    resolvedUserIdRef.current = null
    setIsAdmin(false)
    setLoading(true)

    // Defer the RPC so it does not run inside the auth-state lock.
    window.setTimeout(() => {
      void (async () => {
        if (requestId !== requestIdRef.current) return

        try {
          const allowed = await fetchIsAdmin()
          if (requestId !== requestIdRef.current) return

          if (allowed) {
            resolvedUserIdRef.current = userId
            setIsAdmin(true)
          } else {
            setIsAdmin(false)
          }
        } catch (err) {
          if (requestId !== requestIdRef.current) return
          const message = err instanceof Error ? err.message : 'unknown error'
          console.error('[AdminAuth] is_admin check failed:', message)
          setIsAdmin(false)
        } finally {
          if (requestId === requestIdRef.current) {
            inFlightUserIdRef.current = null
            inFlightRequestIdRef.current = 0
            setLoading(false)
          }
        }
      })()
    }, 0)
  }, [])

  useEffect(() => {
    if (!supabase || !isSupabaseConfigured) {
      clearAuthenticatedState()
      return
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecoveryActive(true)
      }
      applySession(nextSession)
    })

    return () => {
      requestIdRef.current += 1
      inFlightUserIdRef.current = null
      inFlightRequestIdRef.current = 0
      subscription.unsubscribe()
    }
  }, [applySession, clearAuthenticatedState])

  const login = useCallback(async (email: string, password: string): Promise<AdminLoginResult> => {
    const diagnostics = getSupabasePublicDiagnostics()
    if (
      !supabase ||
      !isSupabaseConfigured ||
      diagnostics.status === 'missing' ||
      diagnostics.status === 'invalid_url'
    ) {
      return {
        success: false,
        failureKind: 'not_configured',
        error: messageForAdminAuthFailure('not_configured'),
      }
    }
    if (diagnostics.status === 'url_key_mismatch') {
      return {
        success: false,
        failureKind: 'misconfigured',
        error: messageForAdminAuthFailure('misconfigured'),
      }
    }

    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) {
      return { success: false, error: 'Unesite e-poštu i lozinku.' }
    }

    let signInError: { message?: string; status?: number; name?: string } | null = null
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      })
      signInError = error
    } catch (err) {
      const message = err instanceof Error ? err.message : 'failed to fetch'
      const name = err instanceof Error ? err.name : null
      const failure = failureFromSupabaseAuthError({ message, name })
      return { success: false, failureKind: failure.kind, error: failure.message }
    }

    if (signInError) {
      const failure = failureFromSupabaseAuthError({
        message: signInError.message,
        status: signInError.status,
        name: signInError.name,
      })
      return { success: false, failureKind: failure.kind, error: failure.message }
    }

    // Distinguish auth success vs missing admin role before the UI navigates.
    const allowed = await fetchIsAdmin()
    if (!allowed) {
      await supabase.auth.signOut({ scope: 'global' })
      clearAuthenticatedState()
      return {
        success: false,
        failureKind: 'not_admin',
        error: messageForAdminAuthFailure('not_admin'),
      }
    }

    return { success: true }
  }, [clearAuthenticatedState])

  const logout = useCallback(async (): Promise<void> => {
    // Immediate teardown so AdminRoute redirects before sign-out finishes.
    clearAuthenticatedState()

    if (!supabase || !isSupabaseConfigured) {
      return
    }

    await supabase.auth.signOut({ scope: 'global' })

    const { data } = await supabase.auth.getSession()
    applySession(data.session ?? null)
  }, [applySession, clearAuthenticatedState])

  const changePassword = useCallback(
    async (
      currentPassword: string,
      newPassword: string,
    ): Promise<AdminPasswordActionResult> => {
      if (!supabase || !isSupabaseConfigured) {
        return { success: false, error: messageForAdminAuthFailure('not_configured') }
      }
      if (!isAdmin) {
        return { success: false, error: messageForAdminAuthFailure('not_admin') }
      }

      const email = session?.user?.email?.trim()
      if (!email) {
        return {
          success: false,
          error: 'Prijava nije potpuna. Odjavite se i prijavite ponovo.',
        }
      }
      if (!currentPassword) {
        return { success: false, error: messageForPasswordValidation('current_required') }
      }

      const validation = validateNewPasswordPair({
        newPassword,
        confirmPassword: newPassword,
        currentPassword,
      })
      if (validation && validation !== 'mismatch') {
        return { success: false, error: messageForPasswordValidation(validation) }
      }

      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      })
      if (reauthError) {
        const failure = failureFromSupabaseAuthError({
          message: reauthError.message,
          status: reauthError.status,
          name: reauthError.name,
        })
        if (failure.kind === 'invalid_credentials') {
          return { success: false, error: 'Trenutačna lozinka nije ispravna.' }
        }
        return { success: false, error: failure.message }
      }

      const allowed = await fetchIsAdmin()
      if (!allowed) {
        await supabase.auth.signOut({ scope: 'global' })
        clearAuthenticatedState()
        return { success: false, error: messageForAdminAuthFailure('not_admin') }
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })
      if (updateError) {
        const msg = updateError.message?.toLowerCase() ?? ''
        if (msg.includes('same') || msg.includes('should be different')) {
          return {
            success: false,
            error: messageForPasswordValidation('same_as_current'),
          }
        }
        if (msg.includes('weak') || msg.includes('least') || msg.includes('characters')) {
          return {
            success: false,
            error: messageForPasswordValidation('too_short', ADMIN_PASSWORD_MIN_LENGTH),
          }
        }
        return {
          success: false,
          error: 'Promjena lozinke nije uspjela. Pokušajte ponovo.',
        }
      }

      return { success: true }
    },
    [clearAuthenticatedState, isAdmin, session?.user?.email],
  )

  const requestPasswordReset = useCallback(
    async (email: string): Promise<AdminPasswordActionResult> => {
      if (!supabase || !isSupabaseConfigured) {
        return { success: false, error: messageForAdminAuthFailure('not_configured') }
      }

      const trimmed = email.trim()
      if (!trimmed) {
        return { success: false, error: 'Unesite adresu e-pošte.' }
      }

      const redirectTo = buildAdminPasswordRecoveryRedirectTo(window.location.origin)
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo,
      })

      // Always return the same success copy when the request was accepted or when
      // Supabase withholds whether the email exists. Only surface config/network failures.
      if (error) {
        const failure = failureFromSupabaseAuthError({
          message: error.message,
          status: error.status,
          name: error.name,
        })
        if (
          failure.kind === 'network' ||
          failure.kind === 'not_configured' ||
          failure.kind === 'misconfigured'
        ) {
          return { success: false, error: failure.message }
        }
      }

      // Intentionally identical success path (no email enumeration).
      return { success: true }
    },
    [],
  )

  const completePasswordRecovery = useCallback(
    async (newPassword: string): Promise<AdminPasswordActionResult> => {
      if (!supabase || !isSupabaseConfigured) {
        return { success: false, error: messageForAdminAuthFailure('not_configured') }
      }

      const validation = validateNewPasswordPair({
        newPassword,
        confirmPassword: newPassword,
      })
      if (validation) {
        return { success: false, error: messageForPasswordValidation(validation) }
      }

      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) {
        return {
          success: false,
          error:
            'Sesija za reset lozinke nije aktivna. Zatražite novu poveznicu e-poštom.',
        }
      }

      const allowed = await fetchIsAdmin()
      if (!allowed) {
        await supabase.auth.signOut({ scope: 'global' })
        clearAuthenticatedState()
        return { success: false, error: messageForAdminAuthFailure('not_admin') }
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })
      if (updateError) {
        return {
          success: false,
          error:
            'Promjena lozinke nije uspjela. Pokušajte ponovo ili zatražite novu poveznicu.',
        }
      }

      // Force a clean login with the new password (recovery session ends).
      await supabase.auth.signOut({ scope: 'global' })
      clearAuthenticatedState()
      return { success: true }
    },
    [clearAuthenticatedState],
  )

  const value = useMemo<AdminAuthContextValue>(() => {
    const user = session?.user ?? null

    return {
      session,
      user,
      isAdmin,
      loading,
      passwordRecoveryActive,
      login,
      logout,
      changePassword,
      requestPasswordReset,
      completePasswordRecovery,
    }
  }, [
    session,
    isAdmin,
    loading,
    passwordRecoveryActive,
    login,
    logout,
    changePassword,
    requestPasswordReset,
    completePasswordRecovery,
  ])

  return (
    <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>
  )
}

export const useAdminAuth = (): AdminAuthContextValue => {
  const context = useContext(AdminAuthContext)
  if (context === undefined) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider')
  }
  return context
}
