import axios from 'axios'
import type { Appointment, TokenResponse } from './types'

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const client = axios.create({
  baseURL: apiUrl,
  timeout: 15000,
})

export const api = {
  health: () =>
    client.get<{ status: string; timestamp: string }>('/health'),

  getToken: (roomName = 'mykare-health', participantName = 'user') =>
    client.post<TokenResponse>('/token', {
      room_name: roomName,
      participant_name: participantName,
    }),

  getAppointments: (phoneNumber: string) =>
    client.get<Appointment[]>(`/appointments/${phoneNumber}`),

  createAppointment: (data: {
    user_id: string
    name: string
    phone_number: string
    date: string
    time: string
    notes?: string
  }) => client.post<{ id: number; message: string }>('/appointments', data),

  cancelAppointment: (id: number) =>
    client.delete<{ message: string }>(`/appointments/${id}`),
}
