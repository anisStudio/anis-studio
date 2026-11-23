import { useSyncExternalStore } from 'react'
import {
  readLrcWebshopPreview,
  removeLrcWebshopPreview,
  resolveLrcWebshopState,
  writeLrcWebshopPreview,
  type LrcWebshopPreview,
  type ResolvedLrcWebshop,
} from './lrcWebshop'

interface ServerWebshop {
  enabled: boolean
  url: string | null
}

let ready = false
let server: ServerWebshop = { enabled: false, url: null }
let preview: LrcWebshopPreview | null =
  typeof window === 'undefined' ? null : readLrcWebshopPreview(window.localStorage)

const listeners = new Set<() => void>()

function emit() {
  cached = current()
  listeners.forEach((listener) => listener())
}

function current(): ResolvedLrcWebshop {
  return resolveLrcWebshopState({
    settingsReady: ready,
    serverEnabled: server.enabled,
    serverUrl: server.url,
    preview,
  })
}

let cached = current()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return cached
}

export function publishLrcWebshopServer(next: ServerWebshop) {
  ready = true
  server = {
    enabled: next.enabled === true,
    url: next.url?.trim() ? next.url.trim() : null,
  }
  emit()
}

export function setLrcWebshopPreview(next: LrcWebshopPreview) {
  preview = {
    enabled: next.enabled === true,
    url: next.url?.trim() ? next.url.trim() : null,
  }
  if (typeof window !== 'undefined') {
    writeLrcWebshopPreview(window.localStorage, preview)
  }
  emit()
}

export function confirmLrcWebshopServer(next: ServerWebshop) {
  ready = true
  server = {
    enabled: next.enabled === true,
    url: next.url?.trim() ? next.url.trim() : null,
  }
  preview = null
  if (typeof window !== 'undefined') {
    removeLrcWebshopPreview(window.localStorage)
  }
  emit()
}

export function useLrcWebshopSnapshot(): ResolvedLrcWebshop {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
