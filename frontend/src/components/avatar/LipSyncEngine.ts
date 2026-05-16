import { AMPLITUDE_TO_MOUTH, type MouthState } from './avatarConfig'

export class LipSyncEngine {
  private smoothed = 0
  private readonly alpha = 0.28

  update(rawAmplitude: number): MouthState {
    this.smoothed = this.alpha * rawAmplitude + (1 - this.alpha) * this.smoothed
    for (const [threshold, state] of AMPLITUDE_TO_MOUTH) {
      if (this.smoothed >= threshold) return state
    }
    return 'mouth_closed'
  }

  reset(): void { this.smoothed = 0 }
}
