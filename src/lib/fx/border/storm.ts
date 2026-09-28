/**
 * Storm: the tier's rain effect at full density, plus lightning — a real
 * flash that lights the whole screen, brightest where the bolt struck: a
 * near-white burst, a few return-stroke flickers, then a fast fade. Product
 * decision: full-strength flashes are the point of the effect, so there is
 * no flash-rate/opacity cap; strikes stay seconds apart, and reduced motion
 * or `fxQuality: 'off'` still turns the whole effect off (tiers.ts).
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

const STRIKES: Keyframe[][] = [
  [
    { opacity: 0 },
    { opacity: 1, offset: 0.03 },
    { opacity: 0.35, offset: 0.12 },
    { opacity: 0 }
  ],
  [
    { opacity: 0 },
    { opacity: 0.9, offset: 0.03 },
    { opacity: 0.1, offset: 0.09 },
    { opacity: 1, offset: 0.15 },
    { opacity: 0.4, offset: 0.3 },
    { opacity: 0 }
  ],
  [
    { opacity: 0 },
    { opacity: 1, offset: 0.02 },
    { opacity: 0.15, offset: 0.07 },
    { opacity: 0.85, offset: 0.12 },
    { opacity: 0.1, offset: 0.18 },
    { opacity: 1, offset: 0.24 },
    { opacity: 0.45, offset: 0.4 },
    { opacity: 0 }
  ]
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
    animation = flash.animate(
      STRIKES[Math.floor(rand(0, STRIKES.length))] ?? STRIKES[0],
      { duration: rand(900, 1500), easing: 'ease-out' }
    )
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
        'background:radial-gradient(90% 75% at var(--strike-x, 50%) 0,' +
          'rgb(250 252 255 / 0.97),rgb(214 230 255 / 0.75) 40%,' +
          'rgb(170 196 240 / 0.5) 100%)',
        'box-shadow:inset 0 0 18vmin rgb(226 238 255 / 0.8)'
      ].join(';')
      host.appendChild(flash)

      let countdown = Math.round(rand(3, 8))
      stopTicks = scheduler.on('second', () => {
        countdown -= 1
        if (countdown > 0) return
        countdown = Math.round(rand(6, 20))
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
