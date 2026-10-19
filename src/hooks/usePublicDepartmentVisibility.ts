import {
  publicDepartmentVisibilityFromSettings,
  type PublicDepartmentVisibility,
} from '../lib/publicServiceAccess'
import { useSettings } from './useSettings'

export type PublicDepartmentVisibilityState = PublicDepartmentVisibility & {
  /** Settings fetch still in flight. */
  isLoading: boolean
  /** True when settings loaded without error — safe to trust flags. */
  ready: boolean
}

/**
 * Centralized public department listing visibility (nav, home, /cjenici, CTAs).
 * Fail closed while loading or on settings error. Does not grant admin preview.
 */
export function usePublicDepartmentVisibility(): PublicDepartmentVisibilityState {
  const { settings, isLoading, error } = useSettings()
  const ready = !isLoading && error === null && settings !== null
  const visibility = publicDepartmentVisibilityFromSettings(settings, { ready })
  return {
    ...visibility,
    isLoading,
    ready,
  }
}
