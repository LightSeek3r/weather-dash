import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushSync, mount, tick, unmount } from 'svelte'
import InstallPrompt from '../../../src/components/InstallPrompt.svelte'
import {
  INSTALL_DELAY_MS,
  INSTALL_DISMISSED_KEY,
  installOffer,
  installed,
  type BeforeInstallPromptEvent
} from '../../../src/lib/core/install'

function fakeOffer(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const prompt = vi.fn().mockResolvedValue(undefined)
  const offer = Object.assign(new Event('beforeinstallprompt'), {
    prompt,
    userChoice: Promise.resolve({ outcome })
  }) as BeforeInstallPromptEvent
  return { offer, prompt }
}

async function waitDelay(ms = INSTALL_DELAY_MS): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms)
  await tick()
}

const banner = () => document.querySelector('aside.install')
const button = (label: string) =>
  [...document.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === label
  )

describe('InstallPrompt', () => {
  let app: ReturnType<typeof mount> | undefined

  function render(props: { suppressed?: boolean } = {}) {
    app = mount(InstallPrompt, { target: document.body, props })
    flushSync()
  }

  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    installOffer.set(null)
    installed.set(false)
  })
  afterEach(() => {
    if (app) void unmount(app)
    app = undefined
    document.body.innerHTML = ''
    vi.useRealTimers()
  })

  it('stays hidden until the browser offers an install', async () => {
    render()
    await waitDelay()
    expect(banner()).toBeNull()
  })

  it('shows the Install button after the delay, not before', async () => {
    installOffer.set(fakeOffer().offer)
    render()
    await waitDelay(INSTALL_DELAY_MS - 1)
    expect(banner()).toBeNull()
    await waitDelay(1)
    expect(button('Install')).toBeTruthy()
  })

  it('does not start the delay while suppressed', async () => {
    installOffer.set(fakeOffer().offer)
    app = mount(InstallPrompt, {
      target: document.body,
      props: { suppressed: true }
    })
    await waitDelay()
    expect(banner()).toBeNull()
    void unmount(app)
    // A fresh mount stands in for the prop flipping once the overlay is gone.
    render({ suppressed: false })
    await waitDelay()
    expect(button('Install')).toBeTruthy()
  })

  it('opens the browser dialog once, then goes away', async () => {
    const { offer, prompt } = fakeOffer()
    installOffer.set(offer)
    render()
    await waitDelay()
    button('Install')!.click()
    await tick()
    expect(prompt).toHaveBeenCalledTimes(1)
    expect(banner()).toBeNull()
  })

  it('remembers a close for the next visit', async () => {
    installOffer.set(fakeOffer().offer)
    render()
    await waitDelay()
    button('Not now')!.click()
    await tick()
    expect(localStorage.getItem(INSTALL_DISMISSED_KEY)).not.toBeNull()
    expect(banner()).toBeNull()

    void unmount(app!)
    installOffer.set(fakeOffer().offer)
    render()
    await waitDelay()
    expect(banner()).toBeNull()
  })

  it('hides once the app reports it is installed', async () => {
    installOffer.set(fakeOffer().offer)
    render()
    await waitDelay()
    expect(banner()).not.toBeNull()
    installed.set(true)
    await tick()
    expect(banner()).toBeNull()
  })
})
