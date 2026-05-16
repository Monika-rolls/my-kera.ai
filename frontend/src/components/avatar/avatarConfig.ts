import base_idle       from '../../assets/avatar/mia/base/idle.svg'
import base_listening  from '../../assets/avatar/mia/base/listening.svg'
import base_thinking   from '../../assets/avatar/mia/base/thinking.svg'
import base_speaking   from '../../assets/avatar/mia/base/speaking.svg'
import base_happy      from '../../assets/avatar/mia/base/happy.svg'
import base_concern    from '../../assets/avatar/mia/base/concern.svg'
import base_goodbye    from '../../assets/avatar/mia/base/goodbye.svg'

import eye_open   from '../../assets/avatar/mia/eyes/eyes_open.svg'
import eye_half   from '../../assets/avatar/mia/eyes/eyes_half.svg'
import eye_closed from '../../assets/avatar/mia/eyes/eyes_closed.svg'

import m_closed from '../../assets/avatar/mia/mouth/mouth_closed.svg'
import m_small  from '../../assets/avatar/mia/mouth/mouth_small.svg'
import m_medium from '../../assets/avatar/mia/mouth/mouth_medium.svg'
import m_open   from '../../assets/avatar/mia/mouth/mouth_open.svg'
import m_wide   from '../../assets/avatar/mia/mouth/mouth_wide.svg'

import g_wave     from '../../assets/avatar/mia/gestures/wave.svg'
import g_point    from '../../assets/avatar/mia/gestures/point_calendar.svg'
import g_typing   from '../../assets/avatar/mia/gestures/typing.svg'
import g_namaste  from '../../assets/avatar/mia/gestures/namaste.svg'

export type AvatarBaseState  = 'idle'|'listening'|'thinking'|'speaking'|'happy'|'concern'|'goodbye'
export type MouthState       = 'mouth_closed'|'mouth_small'|'mouth_medium'|'mouth_open'|'mouth_wide'
export type EyeState         = 'eyes_open'|'eyes_half'|'eyes_closed'
export type GestureType      = 'wave'|'point_calendar'|'typing'|'namaste'

export interface AvatarDataEvent {
  type: 'avatar_state'
  state?: string
  emotion?: string
  gesture?: string
}

export const AGENT_STATE_TO_AVATAR: Record<string, AvatarBaseState> = {
  idle:       'idle',
  connecting: 'thinking',
  connected:  'idle',
  speaking:   'speaking',
  listening:  'listening',
  thinking:   'thinking',
  ended:      'goodbye',
}

// [threshold, mouthState] — checked from highest to lowest
export const AMPLITUDE_TO_MOUTH: [number, MouthState][] = [
  [0.80, 'mouth_wide'],
  [0.55, 'mouth_open'],
  [0.30, 'mouth_medium'],
  [0.12, 'mouth_small'],
  [0,    'mouth_closed'],
]

export const BLINK_MIN_MS  = 2000
export const BLINK_MAX_MS  = 6000
export const BLINK_HALF_MS = 60
export const BLINK_SHUT_MS = 80
export const BLINK_OPEN_MS = 60
export const GESTURE_FADE  = 300

export const BASE_SVGS: Record<AvatarBaseState, string> = {
  idle:      base_idle,
  listening: base_listening,
  thinking:  base_thinking,
  speaking:  base_speaking,
  happy:     base_happy,
  concern:   base_concern,
  goodbye:   base_goodbye,
}

export const EYE_SVGS: Record<EyeState, string> = {
  eyes_open:   eye_open,
  eyes_half:   eye_half,
  eyes_closed: eye_closed,
}

export const MOUTH_SVGS: Record<MouthState, string> = {
  mouth_closed:  m_closed,
  mouth_small:   m_small,
  mouth_medium:  m_medium,
  mouth_open:    m_open,
  mouth_wide:    m_wide,
}

export const GESTURE_SVGS: Record<GestureType, string> = {
  wave:           g_wave,
  point_calendar: g_point,
  typing:         g_typing,
  namaste:        g_namaste,
}
