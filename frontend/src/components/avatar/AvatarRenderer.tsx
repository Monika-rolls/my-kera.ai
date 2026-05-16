import { useEffect, useRef, useState } from 'react'
import {
  type AvatarBaseState, type EyeState, type GestureType, type AvatarDataEvent,
} from './avatarConfig'
import { AvatarStateMachine } from './AvatarStateMachine'
import { ExpressionController } from './ExpressionController'
import { GestureController } from './GestureController'
import { useAvatarAudio } from './useAvatarAudio'
import AvatarCanvas from './AvatarCanvas'
import type { AgentState } from '../../hooks/useVoiceAgent'

interface Props {
  agentState:   AgentState
  mouthOpenness: number
  avatarEvent?:  AvatarDataEvent | null
  size?:         number
}

const sm = new AvatarStateMachine()

export default function AvatarRenderer({ agentState, mouthOpenness, avatarEvent, size = 200 }: Props) {
  const [base,           setBase]           = useState<AvatarBaseState>('idle')
  const [eyes,           setEyes]           = useState<EyeState>('eyes_open')
  const [gesture,        setGesture]        = useState<GestureType | null>(null)
  const [gestureOpacity, setGestureOpacity] = useState(0)

  const mouth = useAvatarAudio(agentState === 'speaking' ? mouthOpenness : 0)

  const exprCtrl    = useRef(new ExpressionController())
  const gestureCtrl = useRef(new GestureController())

  // Map agent state → avatar base expression
  useEffect(() => {
    setBase(sm.resolve(agentState, avatarEvent))
  }, [agentState, avatarEvent])

  // Handle backend avatar_state gesture events
  useEffect(() => {
    if (!avatarEvent?.gesture) return
    const g = avatarEvent.gesture as GestureType
    gestureCtrl.current.play(g, 3000, (gg, op) => {
      setGesture(gg)
      setGestureOpacity(op)
    })
  }, [avatarEvent])

  // Trigger contextual gestures on state changes
  useEffect(() => {
    const ctrl = gestureCtrl.current
    const upd  = (g: GestureType | null, op: number) => { setGesture(g); setGestureOpacity(op) }
    if (agentState === 'connected') {
      ctrl.play('wave', 2500, upd)
    } else if (agentState === 'ended') {
      ctrl.play('namaste', 3200, upd)
    }
  }, [agentState])

  // Start autonomous blinking on mount
  useEffect(() => {
    const ec = exprCtrl.current
    const gc = gestureCtrl.current
    ec.start(setEyes)
    return () => { ec.stop(); gc.stop() }
  }, [])

  return (
    <AvatarCanvas
      base={base}
      mouth={mouth}
      eyes={eyes}
      gesture={gesture}
      gestureOpacity={gestureOpacity}
      agentState={agentState}
      size={size}
    />
  )
}
