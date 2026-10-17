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
import { getSupabasePublicDiagnostics } from '../lib/supabasePublicConfig'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

export interface AdminLoginResult {
  success: boolean
  error?: string
  /** Machine-readable failure class for safe UI / tests — never secrets. */
  failureKind?: AdminAuthFailureKind
}

interface AdminAuthContextValue {
  session: Session | null
  user: User | null
  isAdmin: boolean
  loading: boolean
  login: (email: string, password: string) => Promise<AdminLoginResult>
  logout: () => Promise<void>
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
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
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

  const value = useMemo<AdminAuthContextValue>(() => {
    const user = session?.user ?? null

    return {
      session,
      user,
      isAdmin,
      loading,
      login,
      logout,
    }
  }, [session, isAdmin, loading, login, logout])

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
