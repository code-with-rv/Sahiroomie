import type { Server as HttpServer } from 'node:http';
import { GoogleGenAI, Modality, type LiveServerMessage } from '@google/genai';
import { WebSocket, WebSocketServer } from 'ws';
import { INITIAL_LISTINGS } from './data/seedData.js';
import {
  FixedWindowRateLimiter,
  getClientIp,
  isAllowedWebSocketOrigin,
  sanitizeVoiceCity,
  sanitizeVoiceLang,
} from './utils/serverSecurity.js';

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  hi: 'Hindi (हिन्दी)',
  kn: 'Kannada (ಕನ್ನಡ)',
  mr: 'Marathi (मराठी)',
};

const MAX_CONCURRENT_VOICE_SESSIONS = 20;
const MAX_CONCURRENT_PER_IP = 2;
const MAX_SESSION_DURATION_MS = 10 * 60 * 1000;
const MAX_WS_PAYLOAD_BYTES = 256 * 1024;
const voiceConnectionLimiter = new FixedWindowRateLimiter(10, 10 * 60 * 1000);

function buildVoiceSystemInstruction(city: string, lang: string): string {
  const cityListings = INITIAL_LISTINGS.filter(
    (l) => city === 'All India' || l.city.toLowerCase() === city.toLowerCase()
  ).slice(0, 6);

  const catalogSummary = (cityListings.length ? cityListings : INITIAL_LISTINGS.slice(0, 6))
    .map(
      (l) =>
        `- ${l.title} (${l.type}, ${l.area}, ${l.city}): Rs ${l.rent}/mo, gender: ${l.gender}, hygiene: ${l.hygieneRating}/5, urgent: ${l.urgentDays}d, roommate: ${l.existingRoommate.name} (${l.existingRoommate.sleepVibe}, ${l.existingRoommate.cleanlinessVibe})`
    )
    .join('\n');

  const preferredLang = LANGUAGE_LABELS[lang] || 'English';

  return [
    'You are Sahiroomie Voice Concierge, a warm, concise, practical Indian roommate, PG, and shared-flat advisor.',
    `Default language: ${preferredLang}. If the user speaks in Hindi, Kannada, Marathi, Hinglish, or English, reply naturally in the same language.`,
    `Selected city: ${city}. Keep every spoken response brief (2-3 crisp sentences), conversational, and actionable.`,
    'Always uphold Sahiroomie rules: zero brokerage, 1 km address privacy until a visit is scheduled, and never ask users to pay advance deposits before an in-person visit.',
    'Current verified listings context:',
    catalogSummary,
  ].join('\n');
}

function createLiveGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function safeSend(ws: WebSocket, payload: Record<string, unknown>) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

export function attachLiveVoiceBridge(server: HttpServer): void {
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_WS_PAYLOAD_BYTES,
  });

  let activeTotal = 0;
  const activeByIp = new Map<string, number>();

  server.on('upgrade', (request, socket, head) => {
    try {
      const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
      if (url.pathname !== '/api/live-voice') {
        return;
      }

      // 1. Defend against Cross-Site WebSocket Hijacking (CSWSH)
      if (!isAllowedWebSocketOrigin(request.headers.origin, request.headers.host)) {
        socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
        socket.destroy();
        return;
      }

      // 2. Enforce per-IP rate limit and concurrency caps to prevent quota abuse
      const clientIp = getClientIp(request);
      const rateCheck = voiceConnectionLimiter.consume(clientIp);
      const ipActive = activeByIp.get(clientIp) || 0;
      if (
        !rateCheck.allowed ||
        ipActive >= MAX_CONCURRENT_PER_IP ||
        activeTotal >= MAX_CONCURRENT_VOICE_SESSIONS
      ) {
        socket.write('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } catch {
      socket.destroy();
    }
  });

  wss.on('connection', async (clientWs, request) => {
    const clientIp = getClientIp(request);
    activeTotal += 1;
    activeByIp.set(clientIp, (activeByIp.get(clientIp) || 0) + 1);

    let released = false;
    const releaseSlot = () => {
      if (released) return;
      released = true;
      activeTotal = Math.max(0, activeTotal - 1);
      const nextCount = (activeByIp.get(clientIp) || 1) - 1;
      if (nextCount <= 0) {
        activeByIp.delete(clientIp);
      } else {
        activeByIp.set(clientIp, nextCount);
      }
    };

    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    const city = sanitizeVoiceCity(url.searchParams.get('city'));
    const lang = sanitizeVoiceLang(url.searchParams.get('lang'));

    const ai = createLiveGeminiClient();
    if (!ai) {
      safeSend(clientWs, {
        error:
          'Voice concierge requires GEMINI_API_KEY to be configured in Settings > Secrets.',
      });
      clientWs.close(1011, 'Missing GEMINI_API_KEY');
      releaseSlot();
      return;
    }

    let closedByClient = false;
    const maxDurationTimer = setTimeout(() => {
      if (clientWs.readyState === WebSocket.OPEN) {
        safeSend(clientWs, { closed: true });
        clientWs.close(1000, 'Session duration limit reached');
      }
    }, MAX_SESSION_DURATION_MS);

    const sessionPromise = ai.live
      .connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Zephyr' },
            },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: buildVoiceSystemInstruction(city, lang),
        },
        callbacks: {
          onopen: () => {
            safeSend(clientWs, { ready: true, city, lang });
          },
          onmessage: (message: LiveServerMessage) => {
            const content = message.serverContent;
            if (content?.inputTranscription?.text) {
              safeSend(clientWs, { inputTranscript: content.inputTranscription.text });
            }
            if (content?.outputTranscription?.text) {
              safeSend(clientWs, { outputTranscript: content.outputTranscription.text });
            }
            for (const part of content?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                safeSend(clientWs, { audio: part.inlineData.data });
              }
            }
            if (content?.interrupted) {
              safeSend(clientWs, { interrupted: true });
            }
            if (content?.turnComplete) {
              safeSend(clientWs, { turnComplete: true });
            }
          },
          onerror: () => {
            safeSend(clientWs, { error: 'Voice session encountered an upstream error.' });
          },
          onclose: () => {
            if (!closedByClient && clientWs.readyState === WebSocket.OPEN) {
              safeSend(clientWs, { closed: true });
              clientWs.close(1000, 'Live session ended');
            }
          },
        },
      })
      .catch(() => {
        safeSend(clientWs, {
          error: 'Unable to establish live voice session. Please retry.',
        });
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.close(1011, 'Live connect failed');
        }
        return null;
      });

    clientWs.on('message', (raw) => {
      let parsed: { audio?: unknown; text?: unknown };
      try {
        parsed = JSON.parse(raw.toString());
      } catch {
        return;
      }

      sessionPromise.then((session) => {
        if (!session || closedByClient) return;
        try {
          if (typeof parsed.audio === 'string' && parsed.audio.length > 0 && parsed.audio.length <= 200_000) {
            session.sendRealtimeInput({
              audio: {
                data: parsed.audio,
                mimeType: 'audio/pcm;rate=16000',
              },
            });
          } else if (typeof parsed.text === 'string' && parsed.text.trim()) {
            session.sendRealtimeInput({
              text: parsed.text.trim().slice(0, 500),
            });
          }
        } catch {
          safeSend(clientWs, {
            error: 'Failed to stream audio to voice session.',
          });
        }
      });
    });

    clientWs.on('close', () => {
      closedByClient = true;
      clearTimeout(maxDurationTimer);
      releaseSlot();
      sessionPromise.then((session) => {
        try {
          session?.close();
        } catch {
          // Ignore close race
        }
      });
    });
  });
}
