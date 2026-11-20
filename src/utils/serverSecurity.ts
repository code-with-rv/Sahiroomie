export interface OriginRequestLike {
  headers: Record<string, string | string[] | undefined>;
  protocol?: string;
  get?: (name: string) => string | undefined;
}

const SAFE_HOST_REGEX = /^[a-zA-Z0-9.-]+(?::\d{1,5})?$/;
const ALLOWED_LANGS = new Set(['en', 'hi', 'kn', 'mr']);
const ALLOWED_CITIES = new Set([
  'All India',
  'Bengaluru',
  'Mumbai',
  'Delhi NCR',
  'Pune',
  'Hyderabad',
  'Bhopal',
]);

function readHeader(req: OriginRequestLike, name: string): string {
  const fromGetter = typeof req.get === 'function' ? req.get(name) : undefined;
  const raw = fromGetter ?? req.headers[name.toLowerCase()];
  if (Array.isArray(raw)) return String(raw[0] || '').trim();
  return String(raw || '').trim();
}

/**
 * Validates and normalizes an explicit public URL from env vars.
 * Returns null if unset, placeholder, or non-http(s).
 */
export function parseConfiguredOrigin(rawUrl: string | undefined): string | null {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed || trimmed === 'MY_APP_URL') return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

/**
 * Resolves a safe canonical origin immune to Host header injection / XSS.
 * Prioritizes PUBLIC_APP_URL / APP_URL env vars; validates Host strictly on fallback.
 */
export function resolveSafeOrigin(
  req: OriginRequestLike,
  env: Record<string, string | undefined> = process.env
): string {
  const configured =
    parseConfiguredOrigin(env.PUBLIC_APP_URL) || parseConfiguredOrigin(env.APP_URL);
  if (configured) return configured;

  const rawHost = readHeader(req, 'host').split(',')[0].trim();
  const safeHost = SAFE_HOST_REGEX.test(rawHost) ? rawHost : 'localhost:3000';

  const rawProto = (readHeader(req, 'x-forwarded-proto').split(',')[0] || req.protocol || 'http')
    .trim()
    .toLowerCase();
  const safeProto = rawProto === 'https' ? 'https' : 'http';

  return `${safeProto}://${safeHost}`;
}

export function escapeHtmlAttr(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function safeSerializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/**
 * Verifies WebSocket Origin header during HTTP upgrade to defend against CSWSH.
 */
export function isAllowedWebSocketOrigin(
  originHeader: string | undefined,
  hostHeader: string | undefined,
  env: Record<string, string | undefined> = process.env
): boolean {
  const rawOrigin = String(originHeader || '').trim();
  if (!rawOrigin) {
    return false;
  }

  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(rawOrigin);
  } catch {
    return false;
  }

  if (parsedOrigin.protocol !== 'http:' && parsedOrigin.protocol !== 'https:') {
    return false;
  }

  const allowedOrigins = new Set<string>();

  const configuredPublic = parseConfiguredOrigin(env.PUBLIC_APP_URL);
  const configuredApp = parseConfiguredOrigin(env.APP_URL);
  if (configuredPublic) allowedOrigins.add(configuredPublic);
  if (configuredApp) allowedOrigins.add(configuredApp);

  const safeHost = String(hostHeader || '').split(',')[0].trim();
  if (SAFE_HOST_REGEX.test(safeHost)) {
    allowedOrigins.add(`http://${safeHost}`);
    allowedOrigins.add(`https://${safeHost}`);
  }

  if (env.NODE_ENV !== 'production') {
    if (
      parsedOrigin.hostname === 'localhost' ||
      parsedOrigin.hostname === '127.0.0.1'
    ) {
      return true;
    }
  }

  return allowedOrigins.has(parsedOrigin.origin);
}

export function sanitizeVoiceCity(rawCity: string | null | undefined): string {
  const candidate = String(rawCity || '').trim();
  if (ALLOWED_CITIES.has(candidate)) return candidate;
  const matched = Array.from(ALLOWED_CITIES).find(
    (c) => c.toLowerCase() === candidate.toLowerCase()
  );
  return matched || 'Bengaluru';
}

export function sanitizeVoiceLang(rawLang: string | null | undefined): string {
  const candidate = String(rawLang || '').trim().toLowerCase();
  return ALLOWED_LANGS.has(candidate) ? candidate : 'en';
}

export function stripControlChars(input: unknown, maxLen: number): string {
  return String(input ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

export interface SanitizedVibeAnalysisInput {
  finderGenZ: {
    sleepVibe: string;
    socialBattery: string;
    cleanlinessVibe: string;
    vibeTags: string[];
    customExpectation: string;
  };
  analysis: {
    score: number;
    greenFlags: string[];
    frictionFlags: string[];
    roommate: {
      name: string;
      roleTag: string;
      sleepVibe: string;
      socialBattery: string;
      cleanlinessVibe: string;
      expectations: string;
    };
  };
  listing: {
    id: string;
    title: string;
    area: string;
    city: string;
  };
}

export function validateVibeAnalysisPayload(
  body: unknown
): { ok: true; data: SanitizedVibeAnalysisInput } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Request body must be a JSON object.' };
  }

  const record = body as Record<string, any>;
  if (
    !record.finderGenZ ||
    typeof record.finderGenZ !== 'object' ||
    !record.analysis ||
    typeof record.analysis !== 'object' ||
    !record.listing ||
    typeof record.listing !== 'object'
  ) {
    return { ok: false, error: 'Missing finderGenZ, analysis, or listing payload.' };
  }

  const rawScore = Number(record.analysis.score);
  if (!Number.isFinite(rawScore) || rawScore < 0 || rawScore > 100) {
    return { ok: false, error: 'Invalid compatibility score.' };
  }

  const listingTitle = stripControlChars(record.listing.title, 140);
  if (!listingTitle) {
    return { ok: false, error: 'Listing title is required.' };
  }

  const rawTags = Array.isArray(record.finderGenZ.vibeTags)
    ? record.finderGenZ.vibeTags.slice(0, 10).map((t: unknown) => stripControlChars(t, 40)).filter(Boolean)
    : [];

  const rawGreen = Array.isArray(record.analysis.greenFlags)
    ? record.analysis.greenFlags.slice(0, 6).map((g: unknown) => stripControlChars(g, 140)).filter(Boolean)
    : [];

  const rawFriction = Array.isArray(record.analysis.frictionFlags)
    ? record.analysis.frictionFlags.slice(0, 6).map((f: unknown) => stripControlChars(f, 140)).filter(Boolean)
    : [];

  const roommateObj =
    record.analysis.roommate && typeof record.analysis.roommate === 'object'
      ? record.analysis.roommate
      : {};

  return {
    ok: true,
    data: {
      finderGenZ: {
        sleepVibe: stripControlChars(record.finderGenZ.sleepVibe, 40) || 'Flexible',
        socialBattery: stripControlChars(record.finderGenZ.socialBattery, 40) || 'Ambivert',
        cleanlinessVibe: stripControlChars(record.finderGenZ.cleanlinessVibe, 40) || 'Pinterest Clean',
        vibeTags: rawTags,
        customExpectation: stripControlChars(record.finderGenZ.customExpectation, 240),
      },
      analysis: {
        score: Math.round(rawScore),
        greenFlags: rawGreen,
        frictionFlags: rawFriction,
        roommate: {
          name: stripControlChars(roommateObj.name, 60) || 'Roommate',
          roleTag: stripControlChars(roommateObj.roleTag, 80) || 'Verified Member',
          sleepVibe: stripControlChars(roommateObj.sleepVibe, 40) || 'Flexible',
          socialBattery: stripControlChars(roommateObj.socialBattery, 40) || 'Ambivert',
          cleanlinessVibe: stripControlChars(roommateObj.cleanlinessVibe, 40) || 'Pinterest Clean',
          expectations: stripControlChars(roommateObj.expectations, 300),
        },
      },
      listing: {
        id: stripControlChars(record.listing.id, 80),
        title: listingTitle,
        area: stripControlChars(record.listing.area, 80) || 'Central',
        city: stripControlChars(record.listing.city, 60) || 'Bengaluru',
      },
    },
  };
}

/**
 * Lightweight, zero-dependency fixed-window rate limiter with automatic pruning.
 */
export class FixedWindowRateLimiter {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number
  ) {}

  consume(key: string, now = Date.now()): { allowed: boolean; retryAfterSec: number; remaining: number } {
    if (this.buckets.size > 2000) {
      for (const [k, entry] of this.buckets.entries()) {
        if (entry.resetAt <= now) {
          this.buckets.delete(k);
        }
      }
    }

    const existing = this.buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return {
        allowed: true,
        retryAfterSec: 0,
        remaining: Math.max(0, this.maxRequests - 1),
      };
    }

    if (existing.count >= this.maxRequests) {
      return {
        allowed: false,
        retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
        remaining: 0,
      };
    }

    existing.count += 1;
    return {
      allowed: true,
      retryAfterSec: 0,
      remaining: Math.max(0, this.maxRequests - existing.count),
    };
  }
}

export function getClientIp(req: {
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
  ip?: string;
}): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim().slice(0, 64);
  }
  return String(req.ip || req.socket?.remoteAddress || 'unknown').slice(0, 64);
}
