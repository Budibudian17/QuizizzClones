import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { createClient, createPlayerClient } from "@/utils/supabase/client";

type VoiceSignal = {
  from: string;
  to: string;
  kind: "offer" | "answer" | "candidate";
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};

type PeerConnectionState = {
  connection: RTCPeerConnection;
  pendingCandidates: RTCIceCandidateInit[];
};

type Client = ReturnType<typeof createClient>;

export function RoomVoiceChat({
  roomId,
  peerId,
  isHost = false,
}: {
  roomId: string;
  peerId: string;
  isHost?: boolean;
}) {
  const [active, setActive] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [peerCount, setPeerCount] = useState(0);
  const [error, setError] = useState("");
  const streamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const clientRef = useRef<Client | null>(null);
  const peersRef = useRef(new Map<string, PeerConnectionState>());
  const offeredPeersRef = useRef(new Set<string>());
  const audioElementsRef = useRef(new Map<string, HTMLAudioElement>());

  const sendSignal = (signal: VoiceSignal) => {
    const channel = channelRef.current;
    if (!channel) return;
    void channel
      .send({
        type: "broadcast",
        event: "signal",
        payload: signal,
      })
      .then((status) => {
        if (status !== "ok") {
          console.error("Voice chat signal delivery failed.", status);
          setError("Sinyal voice chat gagal terkirim. Periksa koneksi internet.");
        }
      })
      .catch((cause: unknown) => {
        console.error("Voice chat signal delivery failed.", cause);
        setError("Sinyal voice chat gagal terkirim. Periksa koneksi internet.");
      });
  };

  const getPeerConnection = (remoteId: string): PeerConnectionState => {
    const existing = peersRef.current.get(remoteId);
    if (existing) return existing;

    const connection = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    const state: PeerConnectionState = { connection, pendingCandidates: [] };
    peersRef.current.set(remoteId, state);

    for (const track of streamRef.current?.getTracks() ?? []) {
      connection.addTrack(track, streamRef.current!);
    }

    connection.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal({
          from: peerId,
          to: remoteId,
          kind: "candidate",
          candidate: event.candidate.toJSON(),
        });
      }
    };
    connection.ontrack = (event) => {
      let audio = audioElementsRef.current.get(remoteId);
      if (!audio) {
        audio = new Audio();
        audio.autoplay = true;
        audio.setAttribute("playsinline", "");
        audioElementsRef.current.set(remoteId, audio);
      }
      audio.srcObject = event.streams[0] ?? new MediaStream([event.track]);
      void audio.play().catch((cause: unknown) => {
        console.error("Could not play incoming voice chat audio.", cause);
        setError("Ketuk layar sekali lagi agar suara voice chat dapat diputar.");
      });
    };
    connection.onconnectionstatechange = () => {
      if (connection.connectionState === "failed") {
        setError("Koneksi langsung voice chat gagal pada jaringan ini.");
      }
    };
    return state;
  };

  const applyPendingCandidates = async (state: PeerConnectionState) => {
    const queued = state.pendingCandidates.splice(0);
    for (const candidate of queued) {
      await state.connection.addIceCandidate(candidate);
    }
  };

  const handleSignal = async (payload: unknown) => {
    if (!payload || typeof payload !== "object") return;
    const signal = payload as VoiceSignal;
    if (signal.to !== peerId || signal.from === peerId || !signal.from) return;

    try {
      const state = getPeerConnection(signal.from);
      const connection = state.connection;
      if (signal.kind === "offer" && signal.description) {
        await connection.setRemoteDescription(signal.description);
        await applyPendingCandidates(state);
        const answer = await connection.createAnswer();
        await connection.setLocalDescription(answer);
        const description = connection.localDescription?.toJSON();
        if (description) {
          sendSignal({ from: peerId, to: signal.from, kind: "answer", description });
        }
      } else if (signal.kind === "answer" && signal.description) {
        await connection.setRemoteDescription(signal.description);
        await applyPendingCandidates(state);
      } else if (signal.kind === "candidate" && signal.candidate) {
        if (connection.remoteDescription) {
          await connection.addIceCandidate(signal.candidate);
        } else {
          state.pendingCandidates.push(signal.candidate);
        }
      }
    } catch (cause) {
      console.error("Failed to establish a voice chat connection.", cause);
      setError("Koneksi voice chat gagal. Coba keluar lalu gabung kembali.");
    }
  };

  const syncPeers = async (channel: RealtimeChannel) => {
    const presence = channel.presenceState();
    const remoteIds = Object.keys(presence).filter((id) => id !== peerId);
    setPeerCount(remoteIds.length);

    for (const [id, state] of peersRef.current) {
      if (remoteIds.includes(id)) continue;
      state.connection.close();
      peersRef.current.delete(id);
      offeredPeersRef.current.delete(id);
      audioElementsRef.current.get(id)?.remove();
      audioElementsRef.current.delete(id);
    }

    for (const remoteId of remoteIds) {
      const { connection } = getPeerConnection(remoteId);
      if (peerId.localeCompare(remoteId) >= 0 || offeredPeersRef.current.has(remoteId)) continue;
      offeredPeersRef.current.add(remoteId);
      try {
        const offer = await connection.createOffer();
        await connection.setLocalDescription(offer);
        const description = connection.localDescription?.toJSON();
        if (description) {
          sendSignal({ from: peerId, to: remoteId, kind: "offer", description });
        }
      } catch (cause) {
        console.error("Failed to create a voice chat offer.", cause);
        setError("Tidak dapat memulai koneksi voice chat.");
      }
    }
  };

  const leaveVoice = async () => {
    const channel = channelRef.current;
    const client = clientRef.current;
    channelRef.current = null;
    clientRef.current = null;
    channel?.unsubscribe();
    for (const { connection } of peersRef.current.values()) connection.close();
    peersRef.current.clear();
    offeredPeersRef.current.clear();
    for (const audio of audioElementsRef.current.values()) {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
    }
    audioElementsRef.current.clear();
    for (const track of streamRef.current?.getTracks() ?? []) track.stop();
    streamRef.current = null;
    setPeerCount(0);
    setActive(false);
    setConnecting(false);
    setMuted(false);
    if (channel && client) await client.removeChannel(channel);
  };

  const joinVoice = async () => {
    if (connecting || active) return;
    setError("");
    setConnecting(true);
    let stream: MediaStream;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("microphone-api-unavailable");
      }
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
    } catch (cause) {
      console.error("Microphone permission failed.", cause);
      setError(
        cause instanceof DOMException && cause.name === "NotAllowedError"
          ? "Izin mikrofon ditolak. Aktifkan izin mikrofon di browser lalu coba lagi."
          : cause instanceof Error && cause.message === "microphone-api-unavailable"
            ? "Voice chat memerlukan browser modern dan koneksi HTTPS."
            : "Mikrofon tidak tersedia. Periksa perangkat audio lalu coba lagi.",
      );
      setConnecting(false);
      return;
    }

    streamRef.current = stream;
    try {
      const client: Client = isHost ? createClient() : createPlayerClient();
      const channel = client.channel(`voice:${roomId}`, {
        config: {
          private: true,
          broadcast: { self: false },
          presence: { key: peerId },
        },
      });
      clientRef.current = client;
      channelRef.current = channel;

      channel
        .on("presence", { event: "sync" }, () => void syncPeers(channel))
        .on(
          "broadcast",
          { event: "signal" },
          (message: { payload: unknown }) => void handleSignal(message.payload),
        );

      await new Promise<void>((resolve, reject) => {
        channel.subscribe((status: string, cause?: Error) => {
          if (status === "SUBSCRIBED") {
            void channel.track({ peerId }).then((result: string) => {
              if (result !== "ok") {
                reject(new Error("voice-presence-failed"));
                return;
              }
              setActive(true);
              void syncPeers(channel);
              resolve();
            }, reject);
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            reject(cause ?? new Error("voice-channel-failed"));
          }
        });
      });
    } catch (cause) {
      console.error("Failed to join voice chat.", cause);
      await leaveVoice();
      setError(
        cause instanceof Error && cause.message === "voice-presence-failed"
          ? "Tidak dapat bergabung ke voice chat room ini."
          : "Voice chat gagal tersambung. Pastikan migration terbaru sudah diterapkan.",
      );
    } finally {
      setConnecting(false);
    }
  };

  const resumePlayback = () => {
    for (const audio of audioElementsRef.current.values()) {
      void audio.play().catch((cause: unknown) => {
        console.error("Could not resume incoming voice chat audio.", cause);
        setError("Browser masih memblokir pemutaran audio remote.");
      });
    }
    setError("");
  };

  useEffect(() => {
    for (const track of streamRef.current?.getAudioTracks() ?? []) track.enabled = !muted;
  }, [muted]);

  useEffect(
    () => () => {
      const channel = channelRef.current;
      const client = clientRef.current;
      channelRef.current = null;
      clientRef.current = null;
      if (channel && client) void client.removeChannel(channel);
      for (const { connection } of peersRef.current.values()) connection.close();
      for (const audio of audioElementsRef.current.values()) {
        audio.pause();
        audio.srcObject = null;
        audio.remove();
      }
      for (const track of streamRef.current?.getTracks() ?? []) track.stop();
    },
    [],
  );

  return (
    <div className="fixed bottom-4 left-4 z-40 flex max-w-[calc(100vw-2rem)] flex-col items-start gap-2">
      {error && (
        <div
          role="alert"
          className="max-w-72 rounded-xl border border-destructive/30 bg-background/95 px-3 py-2 text-xs text-destructive shadow-lg"
        >
          {error}
          {error.includes("Ketuk layar") && (
            <button type="button" onClick={resumePlayback} className="ml-1 underline">
              Aktifkan pemutaran
            </button>
          )}
        </div>
      )}
      <div className="glass flex items-center gap-2 rounded-full p-1.5 shadow-lg">
        {!active ? (
          <button
            type="button"
            onClick={() => void joinVoice()}
            disabled={connecting}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            <Phone className="h-4 w-4" />
            {connecting ? "Menghubungkan…" : "Gabung voice"}
          </button>
        ) : (
          <>
            <span className="px-2 text-xs font-medium text-muted-foreground">
              Voice · {peerCount} terhubung
            </span>
            <button
              type="button"
              onClick={() => setMuted((current) => !current)}
              aria-label={muted ? "Nyalakan mikrofon" : "Matikan mikrofon"}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-background/70"
            >
              {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => void leaveVoice()}
              aria-label="Keluar dari voice chat"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-destructive/10 text-destructive"
            >
              <PhoneOff className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
      {!active && (
        <p className="max-w-72 rounded-lg bg-background/80 px-2 py-1 text-[10px] text-muted-foreground">
          Peer-to-peer: peserta voice dapat melihat alamat jaringanmu. Mikrofon aktif setelah
          bergabung.
        </p>
      )}
    </div>
  );
}
