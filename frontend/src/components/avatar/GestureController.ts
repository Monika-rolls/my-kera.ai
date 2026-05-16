import { GESTURE_FADE, type GestureType } from './avatarConfig'

type UpdateFn = (gesture: GestureType | null, opacity: number) => void

export class GestureController {
  private rafId    = 0
  private t0       = 0
  private holdMs   = 2000
  private phase: 'idle' | 'in' | 'hold' | 'out' = 'idle'
  private cb: UpdateFn | null = null
  private current: GestureType | null = null

  play(gesture: GestureType, durationMs: number, cb: UpdateFn): void {
    this.stop()
    this.current = gesture
    this.holdMs  = durationMs
    this.cb      = cb
    this.phase   = 'in'
    this.t0      = performance.now()
    this.rafId   = requestAnimationFrame(this.tick)
  }

  stop(): void {
    cancelAnimationFrame(this.rafId)
    this.phase = 'idle'
    this.cb?.(null, 0)
  }

  private tick = (now: number): void => {
    const elapsed = now - this.t0
    if (this.phase === 'in') {
      const t = Math.min(elapsed / GESTURE_FADE, 1)
      this.cb?.(this.current, t)
      if (t >= 1) { this.phase = 'hold'; this.t0 = now }
    } else if (this.phase === 'hold') {
      this.cb?.(this.current, 1)
      if (elapsed >= this.holdMs) { this.phase = 'out'; this.t0 = now }
    } else if (this.phase === 'out') {
      const t = Math.max(1 - elapsed / GESTURE_FADE, 0)
      this.cb?.(this.current, t)
      if (t <= 0) { this.phase = 'idle'; this.cb?.(null, 0); return }
    }
    if (this.phase !== 'idle') this.rafId = requestAnimationFrame(this.tick)
  }
}
