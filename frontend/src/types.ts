export type AgentState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'ended'

export interface TranscriptEntry {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface ToolEvent {
  type: 'tool_event'
  tool: string
  status: 'calling' | 'success' | 'error'
  data: Record<string, unknown>
  timestamp: string
}

export interface CallSummary {
  summary: string
  user_name: string | null
  phone_number: string | null
  intent: string
  appointments: unknown[]
  user_preferences: string[]
  follow_up_needed: boolean
  sentiment: string
  call_duration_estimate: string
}

export interface Appointment {
  id: number
  date: string
  time: string
  status: string
  notes: string | null
  created_at: string
}

export interface TokenResponse {
  token: string
  room_name: string
  livekit_url: string
}

export interface LiveKitMessage {
  type: 'transcript' | 'tool_event' | 'call_summary'
  [key: string]: unknown
}
