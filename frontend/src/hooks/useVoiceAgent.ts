import { useCallback, useEffect, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  Track,
  LocalParticipant,
  RemoteTrack,
  ConnectionState,
} from "livekit-client";
import { getToken, type Message, type ToolEvent, type CallSummary } from "../lib/api";

export type AgentState = "idle" | "connecting" | "connected" | "speaking" | "listening" | "thinking" | "ended";

export interface VoiceAgentState {
  agentState: AgentState;
  connectionState: ConnectionState;
  transcript: Message[];
  toolEvents: ToolEvent[];
  callSummary: CallSummary | null;
  isMicMuted: boolean;
  mouthOpenness: number; // 0–1 for avatar animation
  startCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMic: () => void;
}

const ROOM_NAME = "mykare-health";

export function useVoiceAgent(): VoiceAgentState {
  const roomRef = useRef<Room | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number>(0);

  const [agentState, setAgentState] = useState<AgentState>("idle");
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.Disconnected);
  const [transcript, setTranscript] = useState<Message[]>([]);
  const [toolEvents, setToolEvents] = useState<ToolEvent[]>([]);
  const [callSummary, setCallSummary] = useState<CallSummary | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [mouthOpenness, setMouthOpenness] = useState(0);

  // Animate avatar mouth from analyser data
  const startMouthAnimation = useCallback((track: RemoteTrack) => {
    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;

    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;

    const source = audioCtx.createMediaStreamSource(
      new MediaStream([track.mediaStreamTrack])
    );
    source.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.slice(0, 32).reduce((a, b) => a + b, 0) / 32;
      setMouthOpenness(Math.min(avg / 80, 1));
      animFrameRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, []);

  const stopMouthAnimation = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    analyserRef.current = null;
    setMouthOpenness(0);
  }, []);

  const startCall = useCallback(async () => {
    setAgentState("connecting");
    setTranscript([]);
    setToolEvents([]);
    setCallSummary(null);

    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;

    room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
      setConnectionState(state);
      if (state === ConnectionState.Connected) setAgentState("connected");
      if (state === ConnectionState.Disconnected) setAgentState("ended");
    });

    room.on(RoomEvent.DataReceived, (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg.type === "transcript") {
          setTranscript((prev) => [...prev, { role: msg.role, content: msg.content, timestamp: msg.timestamp }]);
          setAgentState(msg.role === "assistant" ? "speaking" : "listening");
        } else if (msg.type === "tool_event") {
          setToolEvents((prev) => [...prev, msg as ToolEvent]);
          if (msg.status === "calling") setAgentState("thinking");
          else setAgentState("connected");
        } else if (msg.type === "call_summary") {
          setCallSummary(msg.summary as CallSummary);
          setAgentState("ended");
        }
      } catch {
        // ignore malformed
      }
    });

    room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
      if (track.kind === Track.Kind.Audio) {
        track.attach();
        startMouthAnimation(track);
      }
    });

    room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
      if (track.kind === Track.Kind.Audio) {
        track.detach();
        stopMouthAnimation();
      }
    });

    room.on(RoomEvent.ParticipantConnected, () => setAgentState("connected"));

    const { token, livekit_url } = await getToken(ROOM_NAME);
    await room.connect(livekit_url, token);
    await room.localParticipant.setMicrophoneEnabled(true);
    setAgentState("connected");
  }, [startMouthAnimation, stopMouthAnimation]);

  const endCall = useCallback(async () => {
    stopMouthAnimation();
    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
    }
    setAgentState("ended");
  }, [stopMouthAnimation]);

  const toggleMic = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    const enabled = !isMicMuted;
    room.localParticipant.setMicrophoneEnabled(enabled);
    setIsMicMuted(!enabled);
  }, [isMicMuted]);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      stopMouthAnimation();
      roomRef.current?.disconnect();
    };
  }, [stopMouthAnimation]);

  return {
    agentState,
    connectionState,
    transcript,
    toolEvents,
    callSummary,
    isMicMuted,
    mouthOpenness,
    startCall,
    endCall,
    toggleMic,
  };
}
