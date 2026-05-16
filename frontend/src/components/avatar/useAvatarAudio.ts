import { useRef } from 'react'
import { LipSyncEngine } from './LipSyncEngine'
import type { MouthState } from './avatarConfig'

export function useAvatarAudio(mouthOpenness: number): MouthState {
  const engineRef = useRef(new LipSyncEngine())
  return engineRef.current.update(mouthOpenness)
}
