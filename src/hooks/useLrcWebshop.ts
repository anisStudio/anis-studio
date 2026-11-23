import { useEffect } from 'react'
import { useSettings } from './useSettings'
import {
  publishLrcWebshopServer,
  useLrcWebshopSnapshot,
} from '../lib/lrcWebshopStore'

/** Cart and the external shop link. Off while settings are still loading. */
export function useLrcWebshop() {
  const { settings, isLoading } = useSettings()
  const webshop = useLrcWebshopSnapshot()

  useEffect(() => {
    if (isLoading) return
    publishLrcWebshopServer({
      enabled: settings?.lrc_webshop_enabled === true,
      url: settings?.lrc_webshop_url ?? null,
    })
  }, [isLoading, settings?.lrc_webshop_enabled, settings?.lrc_webshop_url])

  return webshop
}
