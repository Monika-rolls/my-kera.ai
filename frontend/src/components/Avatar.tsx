import { useEffect, useRef } from 'react'
import type { AgentState } from '../types'

interface Props {
  state: AgentState
  volumeRef: React.RefObject<number>
}

const STATE_COLORS: Record<AgentState, string> = {
  idle: '#475569',
  connecting: '#475569',
  connected: '#14b8a6',
  listening: '#3b82f6',
  thinking: '#f59e0b',
  speaking: '#14b8a6',
  ended: '#475569',
}

const STATE_LABELS: Record<AgentState, string> = {
  idle: 'Idle',
  connecting: 'Connecting…',
  connected: 'Ready',
  listening: 'Listening',
  thinking: 'Thinking…',
  speaking: 'Speaking',
  ended: 'Call ended',
}

export default function Avatar({ state, volumeRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const blinkRef = useRef(1)
  const blinkTimerRef = useRef(0)
  const frameRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    const cx = W / 2
    const cy = H / 2
    const r = W * 0.38

    const scheduleBlink = () => {
      blinkTimerRef.current = window.setTimeout(() => {
        blinkRef.current = 0
        window.setTimeout(() => {
          blinkRef.current = 1
          scheduleBlink()
        }, 150)
      }, 3000 + Math.random() * 2000)
    }
    scheduleBlink()

    const draw = () => {
      frameRef.current = requestAnimationFrame(draw)
      ctx.clearRect(0, 0, W, H)

      const color = STATE_COLORS[state]
      const volume = volumeRef.current ?? 0

      // --- outer ring ---
      ctx.beginPath()
      ctx.arc(cx, cy, r + 10, 0, Math.PI * 2)
      ctx.strokeStyle = color + '40'
      ctx.lineWidth = 1.5
      ctx.stroke()

      // speaking/listening pulse
      if (state === 'speaking' || state === 'listening') {
        const pulse = 1 + (state === 'speaking' ? volume * 0.15 : 0.05 * Math.sin(Date.now() / 400))
        ctx.beginPath()
        ctx.arc(cx, cy, (r + 18) * pulse, 0, Math.PI * 2)
        ctx.strokeStyle = color + '25'
        ctx.lineWidth = 2
        ctx.stroke()
      }

      // --- head ---
      const grad = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, r * 0.05, cx, cy, r)
      grad.addColorStop(0, '#1e293b')
      grad.addColorStop(1, '#0f172a')
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fillStyle = grad
      ctx.fill()
      ctx.strokeStyle = color + '60'
      ctx.lineWidth = 2
      ctx.stroke()

      // --- eyes ---
      const eyeY = cy - r * 0.18
      const eyeOffX = r * 0.28
      const eyeH = r * 0.13 * blinkRef.current
      const eyeW = r * 0.1

      ;[-eyeOffX, eyeOffX].forEach((ox) => {
        ctx.beginPath()
        ctx.ellipse(cx + ox, eyeY, eyeW, Math.max(eyeH, 1), 0, 0, Math.PI * 2)
        ctx.fillStyle = '#f1f5f9'
        ctx.fill()

        // pupil
        ctx.beginPath()
        ctx.ellipse(cx + ox, eyeY + 1, eyeW * 0.45, Math.max(eyeH * 0.55, 0.5), 0, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.fill()
      })

      // --- mouth ---
      const mouthY = cy + r * 0.28
      const mouthW = r * 0.38
      const openness = state === 'speaking' ? volume * r * 0.22 : 0

      if (openness > 2) {
        // open mouth
        ctx.beginPath()
        ctx.ellipse(cx, mouthY, mouthW, openness, 0, 0, Math.PI * 2)
        ctx.fillStyle = '#020617'
        ctx.fill()
        ctx.strokeStyle = '#334155'
        ctx.lineWidth = 1.5
        ctx.stroke()
      } else {
        // smile
        ctx.beginPath()
        ctx.moveTo(cx - mouthW, mouthY)
        ctx.quadraticCurveTo(cx, mouthY + r * 0.1, cx + mouthW, mouthY)
        ctx.strokeStyle = '#64748b'
        ctx.lineWidth = 2
        ctx.lineCap = 'round'
        ctx.stroke()
      }

      // thinking dots overlay
      if (state === 'thinking') {
        const dotY = cy + r + 28
        const spacing = 8
        ;[-spacing, 0, spacing].forEach((ox, i) => {
          const t = (Date.now() / 300 - i * 0.7) % 1
          const scale = Math.max(0, Math.sin(t * Math.PI))
          ctx.beginPath()
          ctx.arc(cx + ox, dotY, 3 * scale, 0, Math.PI * 2)
          ctx.fillStyle = '#f59e0b'
          ctx.fill()
        })
      }
    }

    draw()
    return () => {
      cancelAnimationFrame(frameRef.current)
      clearTimeout(blinkTimerRef.current)
    }
  }, [state, volumeRef])

  const color = STATE_COLORS[state]

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={200}
          height={200}
          className="rounded-full"
          style={{ filter: `drop-shadow(0 0 16px ${color}40)` }}
        />
      </div>

      {/* State label */}
      <div className="flex items-center gap-2">
        <span
          className="h-1.5 w-1.5 rounded-full animate-pulse"
          style={{ backgroundColor: color }}
        />
        <span className="font-mono text-xs tracking-widest uppercase" style={{ color }}>
          {STATE_LABELS[state]}
        </span>
      </div>
    </div>
  )
}
