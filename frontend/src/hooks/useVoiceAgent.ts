import { useCallback, useEffect, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  Track,
  RemoteTrack,
  ConnectionState,
} from "livekit-client";
import { getToken, postSummary, type Message, type ToolEvent, type CallSummary } from "../lib/api";
import type { AvatarDataEvent } from "../components/avatar/avatarConfig";

export type AgentState = "idle" | "connecting" | "connected" | "speaking" | "listening" | "thinking" | "ended";

export interface VoiceAgentState {
  agentState: AgentState;
  connectionState: ConnectionState;
  transcript: Message[];
  toolEvents: ToolEvent[];
  callSummary: CallSummary | null;
  isMicMuted: boolean;
  mouthOpenness: number;
  avatarEvent: AvatarDataEvent | null;
  startCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMic: () => void;
}

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
  const [avatarEvent, setAvatarEvent] = useState<AvatarDataEvent | null>(null);

  // Refs so endCall can read latest state without stale closure
  const transcriptRef = useRef<Message[]>([]);
  const toolEventsRef = useRef<ToolEvent[]>([]);
  const callSummaryRef = useRef<CallSummary | null>(null);
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);
  useEffect(() => { toolEventsRef.current = toolEvents; }, [toolEvents]);
  useEffect(() => { callSummaryRef.current = callSummary; }, [callSummary]);

  const startMouthAnimation = useCallback((track: RemoteTrack) => {
    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;
    const source = audioCtx.createMediaStreamSource(new MediaStream([track.mediaStreamTrack]));
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

    // Unique room per session prevents duplicate agent dispatch
    const roomName = `mykare-${Date.now()}`;
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
          setTranscript(prev => [...prev, {
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp,
          }]);
          setAgentState(msg.role === "assistant" ? "speaking" : "listening");
        } else if (msg.type === "tool_event") {
          setToolEvents(prev => [...prev, msg as ToolEvent]);
          if (msg.status === "calling") setAgentState("thinking");
          else setAgentState("connected");
        } else if (msg.type === "call_summary") {
          setCallSummary(msg.summary as CallSummary);
          setAgentState("ended");
        } else if (msg.type === "avatar_state") {
          setAvatarEvent(msg as AvatarDataEvent);
        }
      } catch {
        // ignore malformed packets
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

    const { token, livekit_url } = await getToken(roomName);
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

    // If the agent never sent a call_summary (user hung up early), generate one now
    if (!callSummaryRef.current && transcriptRef.current.length > 0) {
      try {
        const bookedAppts = toolEventsRef.current
          .filter(e => e.tool === "book_appointment" && e.status === "success")
          .map(e => e.data);
        const summary = await postSummary(transcriptRef.current, bookedAppts);
        setCallSummary(summary);
      } catch {
        // Non-fatal: user can still read the transcript
      }
    }
  }, [stopMouthAnimation]);

  const toggleMic = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    const nowMuted = !isMicMuted;
    room.localParticipant.setMicrophoneEnabled(!nowMuted);
    setIsMicMuted(nowMuted);
  }, [isMicMuted]);

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
    avatarEvent,
    startCall,
    endCall,
    toggleMic,
  };
}
