import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Language } from '../types/sahiroomie';
import { float32ToPcm16Base64, pcm16Base64ToFloat32 } from '../utils/pcmAudio';
import { Icon } from './Icon';

interface VoiceConciergeModalProps {
  selectedCity: string;
  lang: Language;
  onClose: () => void;
}

interface TranscriptEntry {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

const STARTER_PROMPTS: Record<Language, string[]> = {
  en: [
    'Find me a clean PG under ₹12,000 near Metro',
    'Which flatmates match an Early Bird WFH routine?',
    'What should I check before paying a room deposit?',
  ],
  hi: [
    'मेट्रो के पास ₹12,000 के अंदर साफ PG बताओ',
    'WFH और शांत रूममेट के लिए कौन सा ऑप्शन बेस्ट है?',
    'रूम विजिट से पहले किन सेफ्टी रूल्स का ध्यान रखूं?',
  ],
  kn: [
    'ಮೆಟ್ರೋ ಹತ್ತಿರ ₹12,000 ಒಳಗೆ ಸ್ವಚ್ಛವಾದ PG ತೋರಿಸಿ',
    'WFH ರೂಮ್‌ಮೇಟ್‌ಗೆ ಯಾವ ಫ್ಲಾಟ್ ಉತ್ತಮ?',
    'ಡಿಪಾಸಿಟ್ ಕೊಡುವ ಮುನ್ನ ಏನು ಪರಿಶೀಲಿಸಬೇಕು?',
  ],
  mr: [
    'मेट्रोजवळ ₹12,000 च्या आत स्वच्छ PG सुचवा',
    'WFH आणि शांत रूममेटसाठी कोणता फ्लॅट योग्य आहे?',
    'डिपॉझिट देण्यापूर्वी कोणत्या गोष्टी तपासाव्यात?',
  ],
};

const LANG_DISPLAY: Record<Language, string> = {
  en: 'English',
  hi: 'हिन्दी',
  kn: 'ಕನ್ನಡ',
  mr: 'मराठी',
};

export const VoiceConciergeModal: React.FC<VoiceConciergeModalProps> = ({
  selectedCity,
  lang,
  onClose,
}) => {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'live' | 'error'>('idle');
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [micAvailable, setMicAvailable] = useState(true);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mutedRef = useRef(false);
  const nextStartTimeRef = useRef(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  const stopPlaybackQueue = useCallback(() => {
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
      } catch {
        // Ignore already stopped source
      }
    });
    activeSourcesRef.current.clear();
    if (outputCtxRef.current) {
      nextStartTimeRef.current = outputCtxRef.current.currentTime;
    } else {
      nextStartTimeRef.current = 0;
    }
    setSpeaking(false);
  }, []);

  const cleanupSession = useCallback(() => {
    stopPlaybackQueue();

    if (processorRef.current) {
      processorRef.current.onaudioprocess = null;
      try {
        processorRef.current.disconnect();
      } catch {
        // Ignore
      }
      processorRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (inputCtxRef.current) {
      inputCtxRef.current.close().catch(() => {});
      inputCtxRef.current = null;
    }

    if (outputCtxRef.current) {
      outputCtxRef.current.close().catch(() => {});
      outputCtxRef.current = null;
    }

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // Ignore
      }
      wsRef.current = null;
    }
  }, [stopPlaybackQueue]);

  useEffect(() => {
    return () => {
      cleanupSession();
    };
  }, [cleanupSession]);

  const scheduleAudioChunk = useCallback((base64Pcm: string) => {
    const ctx = outputCtxRef.current;
    if (!ctx) return;

    const samples = pcm16Base64ToFloat32(base64Pcm);
    if (samples.length === 0) return;

    const buffer = ctx.createBuffer(1, samples.length, 24000);
    buffer.getChannelData(0).set(samples);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const startAt = Math.max(ctx.currentTime + 0.02, nextStartTimeRef.current);
    source.start(startAt);
    nextStartTimeRef.current = startAt + buffer.duration;

    activeSourcesRef.current.add(source);
    setSpeaking(true);

    source.onended = () => {
      activeSourcesRef.current.delete(source);
      if (activeSourcesRef.current.size === 0) {
        setSpeaking(false);
      }
    };
  }, []);

  const appendTranscript = useCallback((role: 'user' | 'assistant', chunk: string) => {
    const cleaned = chunk.trim();
    if (!cleaned) return;
    setTranscript((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === role) {
        const separator = last.text.endsWith(' ') || cleaned.startsWith(' ') ? '' : ' ';
        return [...prev.slice(0, -1), { ...last, text: `${last.text}${separator}${cleaned}` }];
      }
      return [
        ...prev,
        { id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, role, text: cleaned },
      ];
    });
  }, []);

  const startSession = useCallback(
    async (initialTextPrompt?: string) => {
      cleanupSession();
      setErrorMsg('');
      setStatus('connecting');

      const AudioCtx =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      const outputCtx = new AudioCtx({ sampleRate: 24000 });
      outputCtxRef.current = outputCtx;
      nextStartTimeRef.current = outputCtx.currentTime;

      let mediaStream: MediaStream | null = null;
      try {
        if (navigator.mediaDevices?.getUserMedia) {
          mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          streamRef.current = mediaStream;
          setMicAvailable(true);
        } else {
          setMicAvailable(false);
        }
      } catch {
        setMicAvailable(false);
        if (!initialTextPrompt) {
          setErrorMsg(
            'Microphone access was blocked. Allow microphone permission or tap a quick question below.'
          );
        }
      }

      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const params = new URLSearchParams({
        city: selectedCity,
        lang,
      });
      const ws = new WebSocket(`${wsProtocol}//${window.location.host}/api/live-voice?${params.toString()}`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (mediaStream) {
          try {
            const inputCtx = new AudioCtx({ sampleRate: 16000 });
            inputCtxRef.current = inputCtx;
            const source = inputCtx.createMediaStreamSource(mediaStream);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (event) => {
              if (mutedRef.current) return;
              const socket = wsRef.current;
              if (!socket || socket.readyState !== WebSocket.OPEN) return;
              const channelData = event.inputBuffer.getChannelData(0);
              const base64 = float32ToPcm16Base64(channelData, inputCtx.sampleRate, 16000);
              socket.send(JSON.stringify({ audio: base64 }));
            };

            source.connect(processor);
            processor.connect(inputCtx.destination);
          } catch {
            setMicAvailable(false);
          }
        }
      };

      ws.onmessage = (event) => {
        let msg: {
          ready?: boolean;
          audio?: string;
          interrupted?: boolean;
          inputTranscript?: string;
          outputTranscript?: string;
          error?: string;
          closed?: boolean;
        };
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }

        if (msg.error) {
          setErrorMsg(msg.error);
          setStatus('error');
          return;
        }

        if (msg.ready) {
          setStatus('live');
          if (initialTextPrompt && ws.readyState === WebSocket.OPEN) {
            appendTranscript('user', initialTextPrompt);
            ws.send(JSON.stringify({ text: initialTextPrompt }));
          }
        }

        if (msg.interrupted) {
          stopPlaybackQueue();
        }

        if (msg.audio) {
          if (outputCtxRef.current?.state === 'suspended') {
            outputCtxRef.current.resume().catch(() => {});
          }
          scheduleAudioChunk(msg.audio);
        }

        if (msg.inputTranscript) {
          appendTranscript('user', msg.inputTranscript);
        }

        if (msg.outputTranscript) {
          appendTranscript('assistant', msg.outputTranscript);
        }

        if (msg.closed) {
          setStatus('idle');
        }
      };

      ws.onerror = () => {
        setErrorMsg('Could not connect to the live voice channel. Please try again.');
        setStatus('error');
      };

      ws.onclose = () => {
        setStatus((prev) => (prev === 'error' ? 'error' : 'idle'));
      };
    },
    [appendTranscript, cleanupSession, lang, scheduleAudioChunk, selectedCity, stopPlaybackQueue]
  );

  const handleEndSession = () => {
    cleanupSession();
    setStatus('idle');
  };

  const handleStarterPrompt = (prompt: string) => {
    if (status === 'live' && wsRef.current?.readyState === WebSocket.OPEN) {
      appendTranscript('user', prompt);
      wsRef.current.send(JSON.stringify({ text: prompt }));
      return;
    }
    startSession(prompt);
  };

  const prompts = STARTER_PROMPTS[lang] || STARTER_PROMPTS.en;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-concierge-title"
    >
      <div
        className="w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[88dvh] modal-slide-up"
        style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
      >
        {/* Header */}
        <div
          className="px-4 py-3.5 border-b flex items-center justify-between gap-2 shrink-0"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-9 h-9 rounded-full bg-[#4F46E5] text-white flex items-center justify-center shrink-0">
              <Icon name="mic" size={18} />
            </span>
            <div className="min-w-0">
              <h2 id="voice-concierge-title" className="text-sm font-extrabold truncate">
                Sahiroomie Voice Concierge
              </h2>
              <p className="text-[11px] font-semibold truncate" style={{ color: 'var(--text-muted)' }}>
                {selectedCity} · {LANG_DISPLAY[lang]}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              cleanupSession();
              onClose();
            }}
            aria-label="Close Voice Concierge"
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Live Orb & Controls */}
        <div className="px-4 py-5 flex flex-col items-center gap-3 shrink-0 border-b" style={{ borderColor: 'var(--border)' }}>
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${
              status === 'live'
                ? speaking
                  ? 'bg-[#059669] text-white ring-8 ring-[#059669]/20 scale-105'
                  : 'bg-[#4F46E5] text-white ring-8 ring-[#4F46E5]/20'
                : 'bg-[#4F46E5]/12 text-[#4F46E5]'
            }`}
          >
            <Icon name="mic" size={32} />
          </div>

          <div className="text-center space-y-1">
            <div className="text-xs font-extrabold">
              {status === 'idle' && 'Ask about PGs, flatmates & rent by voice'}
              {status === 'connecting' && 'Connecting live voice channel...'}
              {status === 'live' &&
                (speaking
                  ? 'Concierge is speaking...'
                  : muted || !micAvailable
                    ? 'Connected · Tap a prompt or unmute mic'
                    : 'Listening — speak naturally anytime')}
              {status === 'error' && 'Voice session unavailable'}
            </div>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              Speak in English, हिन्दी, ಕನ್ನಡ, or मराठी. Interrupt anytime to refine your search.
            </p>
          </div>

          <div className="flex items-center gap-2.5 pt-1">
            {status !== 'live' && status !== 'connecting' ? (
              <button
                type="button"
                onClick={() => startSession()}
                className="px-6 h-11 rounded-full bg-[#4F46E5] text-white text-xs font-extrabold shadow-md flex items-center gap-2"
              >
                <Icon name="mic" size={16} /> Start Live Voice
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setMuted((m) => !m)}
                  disabled={!micAvailable}
                  className="px-4 h-11 rounded-full border text-xs font-bold disabled:opacity-40"
                  style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  {muted ? 'Unmute Mic' : 'Mute Mic'}
                </button>
                <button
                  type="button"
                  onClick={handleEndSession}
                  className="px-5 h-11 rounded-full bg-[#DC2626] text-white text-xs font-extrabold"
                >
                  End Voice Call
                </button>
              </>
            )}
          </div>

          {errorMsg && (
            <div className="w-full p-2.5 rounded-xl bg-[#DC2626]/10 border border-[#DC2626]/30 text-[11px] font-bold text-[#DC2626] text-center">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Live Transcript & Starter Prompts */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
          {transcript.length === 0 ? (
            <div className="space-y-2">
              <div className="text-[11px] font-extrabold tracking-wide" style={{ color: 'var(--text-muted)' }}>
                TRY ASKING ABOUT {selectedCity.toUpperCase()}
              </div>
              {prompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handleStarterPrompt(prompt)}
                  className="w-full p-3 rounded-2xl border text-left text-xs font-semibold hover:border-[#4F46E5]/60 transition-colors flex items-center justify-between gap-2"
                  style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  <span>{prompt}</span>
                  <Icon name="chevronRight" size={14} className="text-[#4F46E5] shrink-0" />
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-2.5">
              {transcript.map((item) => (
                <div
                  key={item.id}
                  className={`flex ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${
                      item.role === 'user'
                        ? 'bg-[#4F46E5] text-white rounded-br-sm font-semibold'
                        : 'border rounded-bl-sm font-medium'
                    }`}
                    style={
                      item.role === 'assistant'
                        ? { backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }
                        : undefined
                    }
                  >
                    {item.text}
                  </div>
                </div>
              ))}
              <div ref={transcriptEndRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
