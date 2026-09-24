/**
 * Toast store/logic (rendering lives in `ToastStack.svelte`).
 *
 * Plan premortem P6 names "24 identical toasts stacked by morning" as a
 * failure mode for a 24/7 kiosk with an unattended overnight API retry
 * loop — so identical (kind + message) toasts within a rate-limit window
 * bump a counter on the existing entry instead of stacking a new one.
 */
import { writable, type Readable } from 'svelte/store'

export type ToastKind = 'info' | 'success' | 'error'

export interface Toast {
  id: number
  kind: ToastKind
  message: string
  /** How many times this exact (kind, message) has fired within the dedup window. */
  count: number
  createdAt: number
  updatedAt: number
  /** ms from `updatedAt` until this toast auto-dismisses. */
  dismissAfterMs: number
}

export interface ToastOptions {
  /** Override the auto-dismiss duration (ms) for this toast. */
  durationMs?: number
  /** Override the dedup/rate-limit window (ms) for this toast. */
  dedupWindowMs?: number
}

// deliberate: errors stay up longer than info/success — they're more likely
// to need reading (and re-reading) before the viewer walks away from the wall.
const DEFAULT_DURATIONS_MS: Record<ToastKind, number> = {
  info: 4000,
  success: 4000,
  error: 8000
}

export const DEFAULT_DEDUP_WINDOW_MS = 5 * 60 * 1000 // 5 minutes, per plan P6

const toastsStore = writable<Toast[]>([])
export const toasts: Readable<Toast[]> = toastsStore

let nextId = 1
const dismissTimers = new Map<number, ReturnType<typeof setTimeout>>()

function clearDismissTimer(id: number): void {
  const timer = dismissTimers.get(id)
  if (timer !== undefined) {
    clearTimeout(timer)
    dismissTimers.delete(id)
  }
}

function scheduleDismiss(id: number, delayMs: number): void {
  clearDismissTimer(id)
  const timer = setTimeout(() => dismiss(id), delayMs)
  dismissTimers.set(id, timer)
}

function push(kind: ToastKind, message: string, opts: ToastOptions = {}): void {
  const now = Date.now()
  const durationMs = opts.durationMs ?? DEFAULT_DURATIONS_MS[kind]
  const dedupWindowMs = opts.dedupWindowMs ?? DEFAULT_DEDUP_WINDOW_MS

  let dedupedId: number | null = null
  toastsStore.update((list) => {
    const existing = list.find(
      (t) =>
        t.kind === kind &&
        t.message === message &&
        now - t.updatedAt <= dedupWindowMs
    )
    if (existing) {
      dedupedId = existing.id
      return list.map((t) =>
        t.id === existing.id ? { ...t, count: t.count + 1, updatedAt: now } : t
      )
    }
    const toast: Toast = {
      id: nextId++,
      kind,
      message,
      count: 1,
      createdAt: now,
      updatedAt: now,
      dismissAfterMs: durationMs
    }
    return [...list, toast]
  })

  scheduleDismiss(dedupedId ?? nextId - 1, durationMs)
}

export function dismiss(id: number): void {
  clearDismissTimer(id)
  toastsStore.update((list) => list.filter((t) => t.id !== id))
}

/** Test/dev helper — clears all toasts and pending timers. */
export function clearAllToasts(): void {
  for (const id of dismissTimers.keys()) clearTimeout(dismissTimers.get(id))
  dismissTimers.clear()
  toastsStore.set([])
}

export const toast = {
  info: (message: string, opts?: ToastOptions) => push('info', message, opts),
  success: (message: string, opts?: ToastOptions) =>
    push('success', message, opts),
  error: (message: string, opts?: ToastOptions) => push('error', message, opts),
  dismiss
}
