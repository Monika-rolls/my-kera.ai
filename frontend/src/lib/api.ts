import axios from "axios";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

const api = axios.create({ baseURL: BASE, timeout: 15_000 });

export async function getToken(roomName: string, participantName = "user") {
  const res = await api.post("/token", { room_name: roomName, participant_name: participantName });
  return res.data as { token: string; room_name: string; livekit_url: string };
}

export async function getAppointments(phoneNumber: string) {
  const res = await api.get(`/appointments/${phoneNumber}`);
  return res.data as Appointment[];
}

export async function postSummary(transcript: Message[], appointments: unknown[]) {
  const res = await api.post("/summary", { transcript, appointments });
  return res.data as CallSummary;
}

export interface Appointment {
  id: number;
  date: string;
  time: string;
  status: string;
  notes?: string;
  created_at?: string;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

export interface ToolEvent {
  type: "tool_event";
  tool: string;
  status: "calling" | "success" | "error";
  data: Record<string, unknown>;
  timestamp: string;
}

export interface CallSummary {
  summary: string;
  user_name: string | null;
  phone_number: string | null;
  intent: string;
  appointments: Appointment[];
  user_preferences: string[];
  follow_up_needed: boolean;
  sentiment: "positive" | "neutral" | "negative";
  call_duration_estimate?: string;
}
