/**
 * Storm: the tier's rain effect at full density, plus an occasional
 * lightning flash — a soft cold glow along the top edge and around the
 * frame, one or two quick flickers then a slow fade. Deliberately gentle
 * for a screen people live next to: peak opacity ~0.5, edges only, at most
 * two flickers per strike and strikes 12–35s apart (well under the WCAG
 * three-flashes-per-second threshold).
 *
 * Strike timing rides the shared scheduler's `second` tick (which already
 * pauses while the tab is hidden) and the flash itself is a Web Animations
 * API opacity animation — compositor-driven, so it costs no frame loop.
 */
import { scheduler } from '../../core/scheduler'
import { rand } from './common'
import { createEffect as createEcoRain } from './rain-eco'
import { createEffect as createWebglRain } from './rain-webgl'
import type { BorderEffect } from './types'

const SINGLE: Keyframe[] = [
  { opacity: 0 },
  { opacity: 0.5, offset: 0.06 },
  { opacity: 0.18, offset: 0.3 },
  { opacity: 0 }
]
const DOUBLE: Keyframe[] = [
  { opacity: 0 },
  { opacity: 0.45, offset: 0.05 },
  { opacity: 0.08, offset: 0.14 },
  { opacity: 0.5, offset: 0.22 },
  { opacity: 0.15, offset: 0.45 },
  { opacity: 0 }
]

export function createEffect(): BorderEffect {
  let rain: BorderEffect | null = null
  let flash: HTMLDivElement | null = null
  let animation: Animation | null = null
  let stopTicks: (() => void) | null = null

  function strike(): void {
    if (!flash || typeof flash.animate !== 'function') return
    flash.style.setProperty('--strike-x', `${Math.round(rand(15, 85))}%`)
    animation?.cancel()
    animation = flash.animate(Math.random() < 0.4 ? DOUBLE : SINGLE, {
      duration: rand(900, 1400),
      easing: 'ease-out'
    })
  }

  return {
    mount(host, opts) {
      if (rain) return
      rain = opts.tier === 'high' ? createWebglRain() : createEcoRain()
      rain.mount(host, opts)

      flash = document.createElement('div')
      flash.setAttribute('aria-hidden', 'true')
      flash.dataset.fxFlash = ''
      flash.style.cssText = [
        'position:absolute',
        'inset:0',
        'opacity:0',
        'pointer-events:none',
        'background:radial-gradient(55% 22vmin at var(--strike-x, 50%) 0,' +
          'rgb(226 238 252 / 0.9),rgb(166 220 255 / 0.25) 55%,transparent 80%)',
        'box-shadow:inset 0 0 12vmin rgb(200 225 255 / 0.55)'
      ].join(';')
      host.appendChild(flash)

      let countdown = Math.round(rand(6, 14))
      stopTicks = scheduler.on('second', () => {
        countdown -= 1
        if (countdown > 0) return
        countdown = Math.round(rand(12, 35))
        strike()
      })
    },
    unmount() {
      stopTicks?.()
      stopTicks = null
      animation?.cancel()
      animation = null
      flash?.remove()
      flash = null
      rain?.unmount()
      rain = null
    }
  }
}
