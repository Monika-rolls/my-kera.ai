import axios from "axios";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

const api = axios.create({ baseURL: BASE, timeout: 15_000 });

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function getToken(roomName: string, participantName = "user") {
  const res = await api.post("/token", { room_name: roomName, participant_name: participantName });
  return res.data as { token: string; room_name: string; livekit_url: string };
}

// ── Categories ────────────────────────────────────────────────────────────────

export interface Category {
  id: number;
  name: string;
  display_name: string;
  description: string;
  icon: string;
}

export async function getCategories(): Promise<Category[]> {
  const res = await api.get("/categories");
  return res.data as Category[];
}

// ── Doctors ───────────────────────────────────────────────────────────────────

export interface Doctor {
  id: number;
  name: string;
  specialization: string;
  category_id: number | null;
  available_days: string[];
  available_times: string[];
}

export async function getDoctors(specialization?: string, categoryId?: number): Promise<Doctor[]> {
  const res = await api.get("/doctors", {
    params: {
      ...(specialization ? { specialization } : {}),
      ...(categoryId ? { category_id: categoryId } : {}),
    },
  });
  return res.data as Doctor[];
}

// ── Appointments ──────────────────────────────────────────────────────────────

export interface Appointment {
  id: number;
  date: string;
  time: string;
  status: string;
  doctor_name?: string;
  category_name?: string;
  email?: string;
  notes?: string;
  created_at?: string;
}

export async function getAppointments(phoneNumber: string): Promise<Appointment[]> {
  const res = await api.get(`/appointments/${phoneNumber}`);
  return res.data as Appointment[];
}

export async function postSummary(transcript: Message[], appointments: unknown[]) {
  const res = await api.post("/summary", { transcript, appointments });
  return res.data as CallSummary;
}

export interface CallSessionRecord {
  id: number;
  room_name: string;
  phone_number: string | null;
  user_name: string | null;
  intent: string;
  sentiment: string;
  summary_text: string | null;
  summary_json: CallSummary | null;
  tokens_total: number | null;
  cost_usd: number | null;
  created_at: string | null;
}

export async function getCallSessions(limit = 50): Promise<CallSessionRecord[]> {
  const res = await api.get("/sessions", { params: { limit } });
  return res.data as CallSessionRecord[];
}

// ── Slots / availability ──────────────────────────────────────────────────────

export async function getSlots(
  date: string,
  doctorId?: number,
  categoryId?: number,
) {
  const res = await api.get("/slots", {
    params: {
      date,
      ...(doctorId !== undefined ? { doctor_id: doctorId } : {}),
      ...(categoryId !== undefined ? { category_id: categoryId } : {}),
    },
  });
  return res.data as {
    date: string;
    doctor_id: number | null;
    category_id: number | null;
    slots: string[];
  };
}

export async function getMonthlyAvailability(
  year: number,
  month: number,
  categoryId?: number,
): Promise<Record<string, number>> {
  const res = await api.get("/availability", {
    params: {
      year,
      month,
      ...(categoryId !== undefined ? { category_id: categoryId } : {}),
    },
  });
  return res.data as Record<string, number>;
}

// ── Shared types ──────────────────────────────────────────────────────────────

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

export interface TokensUsed {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
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
  sheets_saved?: boolean;
  tokens_used?: TokensUsed;
  estimated_cost_usd?: number;
  model?: string;
  provider?: string;
}
