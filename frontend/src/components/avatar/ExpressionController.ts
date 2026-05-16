import {
  BLINK_MIN_MS, BLINK_MAX_MS,
  BLINK_HALF_MS, BLINK_SHUT_MS, BLINK_OPEN_MS,
  type EyeState,
} from './avatarConfig'

export class ExpressionController {
  private timerId = 0
  private active  = false

  start(onEye: (s: EyeState) => void): void {
    this.active = true
    this.schedule(onEye)
  }

  stop(): void {
    this.active = false
    clearTimeout(this.timerId)
  }

  private schedule(onEye: (s: EyeState) => void): void {
    const delay = BLINK_MIN_MS + Math.random() * (BLINK_MAX_MS - BLINK_MIN_MS)
    this.timerId = window.setTimeout(() => {
      if (!this.active) return
      this.blink(onEye)
    }, delay)
  }

  private blink(onEye: (s: EyeState) => void): void {
    onEye('eyes_half')
    window.setTimeout(() => {
      onEye('eyes_closed')
      window.setTimeout(() => {
        onEye('eyes_half')
        window.setTimeout(() => {
          onEye('eyes_open')
          if (this.active) this.schedule(onEye)
        }, BLINK_OPEN_MS)
      }, BLINK_SHUT_MS)
    }, BLINK_HALF_MS)
  }
}
