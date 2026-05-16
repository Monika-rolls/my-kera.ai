import {
  BASE_SVGS, EYE_SVGS, MOUTH_SVGS, GESTURE_SVGS,
  type AvatarBaseState, type MouthState, type EyeState, type GestureType,
} from './avatarConfig'

interface Props {
  base:           AvatarBaseState
  mouth:          MouthState
  eyes:           EyeState
  gesture:        GestureType | null
  gestureOpacity: number
  agentState:     string
  size?:          number
}

const STATE_GLOW: Record<string, string> = {
  speaking:   '0 0 0 2px rgba(20,184,166,0.5), 0 0 36px rgba(20,184,166,0.2)',
  connected:  '0 0 0 2px rgba(20,184,166,0.4), 0 0 28px rgba(20,184,166,0.12)',
  listening:  '0 0 0 2px rgba(59,130,246,0.5), 0 0 36px rgba(59,130,246,0.18)',
  thinking:   '0 0 0 2px rgba(245,158,11,0.5), 0 0 36px rgba(245,158,11,0.15)',
  connecting: '0 0 0 2px rgba(245,158,11,0.4), 0 0 24px rgba(245,158,11,0.10)',
}

export default function AvatarCanvas({
  base, mouth, eyes, gesture, gestureOpacity, agentState, size = 200,
}: Props) {
  const h = Math.round(size * 1.2)
  const glow = STATE_GLOW[agentState] ?? 'none'
  const isIdle = agentState === 'idle' || agentState === 'connected'

  return (
    <div style={{ position: 'relative', width: size, height: h, flexShrink: 0 }}>

      {/* Glow ring behind avatar */}
      <div style={{
        position: 'absolute',
        top: Math.round((h - size) * 0.25),
        left: 0,
        width: size,
        height: size,
        borderRadius: '50%',
        boxShadow: glow,
        transition: 'box-shadow 0.6s ease',
        pointerEvents: 'none',
      }} />

      {/* Float wrapper */}
      <div
        className={isIdle ? 'avatar-float' : ''}
        style={{ position: 'relative', width: size, height: h }}
      >

        {/* Layer 1 — base expression (only active one visible) */}
        {(Object.entries(BASE_SVGS) as [AvatarBaseState, string][]).map(([key, src]) => (
          <img
            key={key}
            src={src}
            alt=""
            draggable={false}
            style={{
              position: 'absolute', top: 0, left: 0,
              width: '100%', height: '100%',
              opacity: key === base ? 1 : 0,
              transition: 'opacity 0.2s ease',
              willChange: 'opacity',
              userSelect: 'none',
            }}
          />
        ))}

        {/* Layer 2 — eyes */}
        {(Object.entries(EYE_SVGS) as [EyeState, string][]).map(([key, src]) => (
          <img
            key={key}
            src={src}
            alt=""
            draggable={false}
            style={{
              position: 'absolute', top: 0, left: 0,
              width: '100%', height: '100%',
              opacity: key === eyes ? 1 : 0,
              transition: 'opacity 0.08s ease',
              willChange: 'opacity',
              userSelect: 'none',
            }}
          />
        ))}

        {/* Layer 3 — mouth */}
        {(Object.entries(MOUTH_SVGS) as [MouthState, string][]).map(([key, src]) => (
          <img
            key={key}
            src={src}
            alt=""
            draggable={false}
            style={{
              position: 'absolute', top: 0, left: 0,
              width: '100%', height: '100%',
              opacity: key === mouth ? 1 : 0,
              transition: 'opacity 0.06s ease',
              willChange: 'opacity',
              userSelect: 'none',
            }}
          />
        ))}

        {/* Layer 4 — gesture overlay */}
        {gesture && GESTURE_SVGS[gesture] && (
          <img
            src={GESTURE_SVGS[gesture]}
            alt=""
            draggable={false}
            style={{
              position: 'absolute', top: 0, left: 0,
              width: '100%', height: '100%',
              opacity: gestureOpacity,
              willChange: 'opacity',
              userSelect: 'none',
              pointerEvents: 'none',
            }}
          />
        )}
      </div>
    </div>
  )
}
