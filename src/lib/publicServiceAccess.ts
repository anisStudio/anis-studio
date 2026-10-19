/**
 * Pure access rules for public department routes.
 * Used by PublicServiceGuard and unit tests — no React, no network.
 */

export type PublicService = 'interiors' | 'lrc' | 'webAtelier'

export type PublicServiceSettingKey =
  | 'interiors_public_visible'
  | 'lrc_public_visible'
  | 'web_atelier_public_visible'

export type PublicServiceAccessState =
  | 'loading'
  | 'allowed_public'
  | 'allowed_admin_preview'
  | 'denied'

export interface ResolvePublicServiceAccessInput {
  /** True only when the department flag is explicitly enabled. */
  publicVisible: boolean
  isAdmin: boolean
  /** Settings and/or admin auth still resolving — fail closed. */
  loading: boolean
  /** Settings fetch failed or missing — non-admins denied; admins may preview. */
  settingsUnavailable?: boolean
}

/**
 * Fail closed while loading. Never expose department content before
 * settings + admin role checks settle. Admin preview requires is_admin === true.
 */
export function resolvePublicServiceAccess(
  input: ResolvePublicServiceAccessInput,
): PublicServiceAccessState {
  if (input.loading) return 'loading'

  if (input.settingsUnavailable) {
    return input.isAdmin ? 'allowed_admin_preview' : 'denied'
  }

  if (input.publicVisible) return 'allowed_public'
  if (input.isAdmin) return 'allowed_admin_preview'
  return 'denied'
}

export const PUBLIC_SERVICE_SETTING_KEY: Record<PublicService, PublicServiceSettingKey> = {
  interiors: 'interiors_public_visible',
  lrc: 'lrc_public_visible',
  webAtelier: 'web_atelier_public_visible',
}

export const PUBLIC_SERVICE_LABEL: Record<PublicService, string> = {
  interiors: "Ani's Interijeri",
  lrc: "Ani's LRC",
  webAtelier: "Ani's Web Atelier",
}

export type PublicDepartmentVisibility = Record<PublicService, boolean>

export const PUBLIC_DEPARTMENTS_HIDDEN: PublicDepartmentVisibility = {
  interiors: false,
  lrc: false,
  webAtelier: false,
}

/**
 * Public listing / nav / hub cards — not admin preview.
 * Only `=== true` counts as visible. While settings are not ready
 * (loading or error), every department stays hidden (fail closed).
 */
export function publicDepartmentVisibilityFromSettings(
  settings: Partial<Record<PublicServiceSettingKey, boolean>> | null | undefined,
  options?: { ready?: boolean },
): PublicDepartmentVisibility {
  if (options?.ready === false) {
    return { ...PUBLIC_DEPARTMENTS_HIDDEN }
  }
  return {
    interiors: settings?.interiors_public_visible === true,
    lrc: settings?.lrc_public_visible === true,
    webAtelier: settings?.web_atelier_public_visible === true,
  }
}

export function isPublicDepartmentListed(
  visibility: PublicDepartmentVisibility,
  service: PublicService,
): boolean {
  return visibility[service] === true
}

/** All 8 flag combinations for regression matrices (interiors × lrc × webAtelier). */
export function allPublicVisibilityCombinations(): PublicDepartmentVisibility[] {
  const bits = [false, true] as const
  const out: PublicDepartmentVisibility[] = []
  for (const interiors of bits) {
    for (const lrc of bits) {
      for (const webAtelier of bits) {
        out.push({ interiors, lrc, webAtelier })
      }
    }
  }
  return out
}

export interface DepartmentPreviewLink {
  label: string
  path: string
  /** Form / booking / inquiry that writes production data if submitted. */
  createsProductionData?: boolean
}

/** Real public routes used by Admin → Pregled stranice (not mocks). */
export const DEPARTMENT_PREVIEW_LINKS: Record<PublicService, DepartmentPreviewLink[]> = {
  interiors: [
    { label: 'Glavna stranica', path: '/interijeri' },
    { label: 'Cjenik', path: '/cjenici/interijeri' },
    {
      label: 'Upit za klijente',
      path: '/interijeri/klijenti',
      createsProductionData: true,
    },
    {
      label: 'Upit za stolare',
      path: '/interijeri/stolari',
      createsProductionData: true,
    },
  ],
  lrc: [
    { label: 'Glavna stranica', path: '/lrc' },
    {
      label: 'Upit / webshop upit',
      path: '/lrc/upit',
      createsProductionData: true,
    },
  ],
  webAtelier: [
    { label: 'Glavna stranica', path: '/web-atelier' },
    {
      label: 'Upit / konfigurator',
      path: '/web-atelier/upit',
      createsProductionData: true,
    },
    { label: 'Demo — cvjećarna', path: '/web-atelier/demo/cvjecarna' },
    { label: 'Demo — grooming', path: '/web-atelier/demo/grooming' },
    { label: 'Demo — stolarija', path: '/web-atelier/demo/stolarija' },
  ],
}
