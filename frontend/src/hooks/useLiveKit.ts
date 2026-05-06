import { useCallback, useRef, useState } from 'react'
import {
  Room,
  RoomEvent,
  Track,
  type RemoteTrack,
} from 'livekit-client'
import { api } from '../api'
import type { AgentState, CallSummary, ToolEvent, TranscriptEntry } from '../types'

export function useLiveKit() {
  const roomRef = useRef<Room | null>(null)
  const volumeRef = useRef<number>(0)
  const animFrameRef = useRef<number>(0)

  const [state, setState] = useState<AgentState>('idle')
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [toolEvents, setToolEvents] = useState<ToolEvent[]>([])
  const [callSummary, setCallSummary] = useState<CallSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleDataReceived = useCallback((payload: Uint8Array) => {
    try {
      const msg = JSON.parse(new TextDecoder().decode(payload))

      if (msg.type === 'transcript') {
        const entry: TranscriptEntry = {
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
        }
        setTranscript((prev) => [...prev, entry])
        setState(msg.role === 'user' ? 'listening' : 'speaking')
      } else if (msg.type === 'tool_event') {
        const ev: ToolEvent = {
          type: 'tool_event',
          tool: msg.tool,
          status: msg.status,
          data: msg.data || {},
          timestamp: msg.timestamp,
        }
        setToolEvents((prev) => {
          // Replace the calling event with its result when success/error arrives
          if (ev.status !== 'calling') {
            const idx = [...prev].reverse().findIndex(
              (e) => e.tool === ev.tool && e.status === 'calling'
            )
            if (idx !== -1) {
              const realIdx = prev.length - 1 - idx
              const next = [...prev]
              next[realIdx] = ev
              return next
            }
          }
          return [...prev, ev]
        })
        if (ev.status === 'calling') setState('thinking')
        else setState('connected')
      } else if (msg.type === 'call_summary') {
        setCallSummary(msg.summary)
        setState('ended')
      }
    } catch {
      // ignore malformed messages
    }
  }, [])

  const attachAudioAnalyser = useCallback((track: RemoteTrack) => {
    if (track.kind !== Track.Kind.Audio) return
    track.attach()

    try {
      const audioCtx = new AudioContext()
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      const source = audioCtx.createMediaStreamSource(
        new MediaStream([track.mediaStreamTrack])
      )
      source.connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)

      const tick = () => {
        analyser.getByteFrequencyData(data)
        const avg = data.slice(0, 32).reduce((a, b) => a + b, 0) / 32
        volumeRef.current = Math.min(1, avg / 80)
        animFrameRef.current = requestAnimationFrame(tick)
      }
      tick()
    } catch {
      // AudioContext may not be available in all environments
    }
  }, [])

  const connect = useCallback(async () => {
    setState('connecting')
    setError(null)
    setTranscript([])
    setToolEvents([])
    setCallSummary(null)

    try {
      const { data } = await api.getToken()
      const room = new Room({ adaptiveStream: true, dynacast: true })
      roomRef.current = room

      room.on(RoomEvent.DataReceived, handleDataReceived)
      room.on(RoomEvent.TrackSubscribed, attachAudioAnalyser)
      room.on(RoomEvent.Disconnected, () => {
        setState((prev) => (prev === 'ended' ? 'ended' : 'idle'))
        cancelAnimationFrame(animFrameRef.current)
      })

      await room.connect(data.livekit_url, data.token)
      await room.localParticipant.setMicrophoneEnabled(true)
      setState('connected')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed'
      setError(msg)
      setState('idle')
    }
  }, [handleDataReceived, attachAudioAnalyser])

  const disconnect = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current)
    roomRef.current?.disconnect()
    roomRef.current = null
    volumeRef.current = 0
    setState('idle')
  }, [])

  return {
    connect,
    disconnect,
    state,
    transcript,
    toolEvents,
    callSummary,
    volumeRef,
    error,
  }
}
