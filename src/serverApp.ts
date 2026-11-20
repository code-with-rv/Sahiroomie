import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenAI, Type } from '@google/genai';
import { CITIES_DATA, INITIAL_LISTINGS } from './data/seedData.js';
import {
  maskGovernmentId,
  validateAadhaarVerhoeff,
  validatePan,
} from './utils/compatibility.js';
import { buildZipArchive, collectProjectEntries } from './utils/projectZip.js';
import { buildRouteSeo, buildSitemapXml, parseAppUrlPath } from './utils/seo.js';

// In-memory KYC verification session store (TTL 5m)
const kycSessions = new Map<
  string,
  {
    userId: string;
    idType: 'AADHAAR' | 'PAN';
    maskedId: string;
    otp: string;
    expiresAt: number;
  }
>();

function getOrigin(req: express.Request): string {
  const configured = process.env.APP_URL;
  if (configured && configured !== 'MY_APP_URL') {
    return configured.replace(/\/+$/, '');
  }
  const host = req.get('host') || 'localhost:3000';
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  return `${proto}://${host}`;
}

function escapeHtmlAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function injectRouteSeoIntoHtml(html: string, req: express.Request): string {
  const origin = getOrigin(req);
  const parsed = parseAppUrlPath(req.path || '/');
  const selectedListing = parsed.listingId
    ? INITIAL_LISTINGS.find((l) => l.id === parsed.listingId)
    : undefined;
  const seo = buildRouteSeo({
    origin,
    pathname: req.path || '/',
    selectedCity: parsed.city || 'Bengaluru',
    activeTab: parsed.tab,
    selectedListing,
    listingsCount: INITIAL_LISTINGS.length,
    showFaq: parsed.showFaq,
  });

  const safeTitle = escapeHtmlAttr(seo.title);
  const safeDesc = escapeHtmlAttr(seo.description);
  const canonicalUrl = escapeHtmlAttr(`${origin}${seo.canonicalPath}`);
  const ldString = JSON.stringify(seo.jsonLd).replace(/</g, '\\u003c');

  return html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${safeTitle}</title>`)
    .replace(
      /<meta\s+name="description"[\s\S]*?\/>/i,
      `<meta name="description" content="${safeDesc}" />`
    )
    .replace(
      /<meta\s+property="og:title"[\s\S]*?\/>/i,
      `<meta property="og:title" content="${safeTitle}" />`
    )
    .replace(
      /<meta\s+property="og:description"[\s\S]*?\/>/i,
      `<meta property="og:description" content="${safeDesc}" />`
    )
    .replace(
      /<meta\s+name="twitter:title"[\s\S]*?\/>/i,
      `<meta name="twitter:title" content="${safeTitle}" />`
    )
    .replace(
      /<meta\s+name="twitter:description"[\s\S]*?\/>/i,
      `<meta name="twitter:description" content="${safeDesc}" />`
    )
    .replace(
      /<link\s+rel="canonical"[\s\S]*?\/>/i,
      `<link rel="canonical" href="${canonicalUrl}" />\n    <meta property="og:url" content="${canonicalUrl}" />`
    )
    .replace(
      /<script\s+id="sahiroomie-dynamic-jsonld"[\s\S]*?<\/script>/i,
      `<script id="sahiroomie-dynamic-jsonld" type="application/ld+json">${ldString}</script>`
    );
}

function getGeminiClient(): GoogleGenAI | null {
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

export function createSahiroomieApp(): express.Express {
  const app = express();
  app.use(express.json());

  // SEO Crawl Endpoints
  app.get('/robots.txt', (req, res) => {
    const origin = getOrigin(req);
    res.type('text/plain').send(`User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
  });

  app.get('/sitemap.xml', (req, res) => {
    const origin = getOrigin(req);
    const xml = buildSitemapXml(
      origin,
      CITIES_DATA.map((c) => c.id),
      INITIAL_LISTINGS.map((l) => l.id)
    );
    res.type('application/xml').send(xml);
  });

  // Downloadable GitHub & Vercel-ready project ZIP bundle
  const handleProjectDownload = (_req: express.Request, res: express.Response) => {
    try {
      const rootDir = process.cwd();
      const entries = collectProjectEntries(rootDir);
      const zipBuffer = buildZipArchive(entries);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="sahiroomie-app.zip"');
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).send(zipBuffer);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Could not generate project archive.' });
    }
  };
  app.get('/api/download-project', handleProjectDownload);
  app.get('/sahiroomie-app.zip', handleProjectDownload);

  // Runtime Firebase client config served from server only (keeps keys out of static dist bundles)
  app.get('/api/firebase-config', (req, res) => {
    const fetchSite = String(req.headers['sec-fetch-site'] || '').toLowerCase();
    if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'same-site' && fetchSite !== 'none') {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    let fileConfig: Record<string, string> = {};
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      try {
        fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      } catch {
        fileConfig = {};
      }
    }

    const apiKey = process.env.FIREBASE_API_KEY || fileConfig.apiKey || '';
    const projectId = process.env.FIREBASE_PROJECT_ID || fileConfig.projectId || '';
    const appId = process.env.FIREBASE_APP_ID || fileConfig.appId || '';
    const authDomain = process.env.FIREBASE_AUTH_DOMAIN || fileConfig.authDomain || '';
    const firestoreDatabaseId =
      process.env.FIREBASE_DATABASE_ID || fileConfig.firestoreDatabaseId || '(default)';
    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || fileConfig.storageBucket || '';
    const messagingSenderId =
      process.env.FIREBASE_MESSAGING_SENDER_ID || fileConfig.messagingSenderId || '';

    if (!apiKey || !projectId || !appId) {
      res.status(404).json({ configured: false });
      return;
    }

    res.json({
      configured: true,
      config: {
        apiKey,
        authDomain,
        projectId,
        appId,
        firestoreDatabaseId,
        storageBucket,
        messagingSenderId,
      },
    });
  });

  // 1. Server-side Gemini AI Gen-Z Vibe Coach endpoint
  app.post('/api/vibe-analysis', async (req, res) => {
    const { finderGenZ, analysis, listing } = req.body || {};
    if (!finderGenZ || !analysis || !listing) {
      res.status(400).json({ error: 'Missing finderGenZ, analysis, or listing payload.' });
      return;
    }

    const ai = getGeminiClient();
    const topGreen = analysis.greenFlags?.[0] || 'aligned daily schedules';
    const watchout = analysis.frictionFlags?.[0]
      ? `Quick vibe-check tip: ${analysis.frictionFlags[0]}.`
      : 'Ask about their Splitwise grocery & maid split during your visit!';

    const fallbackResponse = {
      verdict: `${analysis.score}% Sahiroomie match with ${analysis.roommate?.name?.split(' ')[0] || 'your host'}! Strong overlap on ${topGreen.toLowerCase()}, making day-to-day co-living low-drama and predictable.`,
      tip: watchout,
      poweredBy: 'Sahiroomie AI Vibe Engine',
    };

    if (!ai) {
      res.json(fallbackResponse);
      return;
    }

    try {
      const systemInstruction =
        "You are Sahiroomie's Gen-Z Roommate Compatibility AI Coach for India. Be crisp, candid, practical, and friendly (max 2 short sentences for verdict, 1 sentence for tip).";
      const userPrompt = `Seeker vibe: Sleep=${finderGenZ.sleepVibe}, Social=${finderGenZ.socialBattery}, Cleanliness=${finderGenZ.cleanlinessVibe}, Tags=${(finderGenZ.vibeTags || []).join(', ')}, CustomExpectation="${finderGenZ.customExpectation || 'None'}". Existing roommate (${analysis.roommate?.name}, ${analysis.roommate?.roleTag}): Sleep=${analysis.roommate?.sleepVibe}, Social=${analysis.roommate?.socialBattery}, Cleanliness=${analysis.roommate?.cleanlinessVibe}, Bio="${analysis.roommate?.expectations}". Computed match score: ${analysis.score}%. Listing: ${listing.title} in ${listing.area}, ${listing.city}.`;

      const response = await Promise.race([
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: userPrompt,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                verdict: { type: Type.STRING },
                tip: { type: Type.STRING },
              },
              required: ['verdict', 'tip'],
            },
          },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('GEMINI_TIMEOUT')), 6000)
        ),
      ]);

      const rawText = (response.text || '').trim();
      if (!rawText) {
        res.json(fallbackResponse);
        return;
      }
      const parsed = JSON.parse(rawText);
      res.json({
        verdict: parsed.verdict || fallbackResponse.verdict,
        tip: parsed.tip || fallbackResponse.tip,
        poweredBy: 'Gemini AI Vibe Coach',
      });
    } catch (err) {
      console.error('Gemini vibe analysis fallback:', err);
      res.json(fallbackResponse);
    }
  });

  // 2. Masked Aadhaar / PAN KYC Verification (zero raw ID retention)
  app.post('/api/kyc/initiate', (req, res) => {
    const { userId, idType, idNumber, dob } = req.body || {};
    if (!idType || !idNumber) {
      res.status(400).json({ error: 'ID type and number are required.' });
      return;
    }

    if (dob) {
      const birth = new Date(dob);
      const today = new Date();
      let years = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) years--;
      if (years < 18) {
        res.status(400).json({ error: 'KYC requires applicant age to be 18+.' });
        return;
      }
    }

    const normalizedType = idType === 'PAN' ? 'PAN' : 'AADHAAR';
    const valid =
      normalizedType === 'AADHAAR'
        ? validateAadhaarVerhoeff(String(idNumber))
        : validatePan(String(idNumber));

    if (!valid) {
      res.status(400).json({
        error:
          normalizedType === 'AADHAAR'
            ? 'Invalid 12-digit Aadhaar number (failed Verhoeff checksum).'
            : 'Invalid PAN format (expected 5 letters, 4 digits, 1 letter e.g. ABCDE1234F).',
      });
      return;
    }

    const maskedId = maskGovernmentId(normalizedType, String(idNumber));
    const transactionId = `KYC-${Date.now().toString(36).toUpperCase()}`;
    const kycOtp = String(Math.floor(100000 + Math.random() * 900000));
    kycSessions.set(transactionId, {
      userId: String(userId || 'USR-DEMO101'),
      idType: normalizedType,
      maskedId,
      otp: kycOtp,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    res.json({
      success: true,
      transactionId,
      maskedId,
      devPreviewKycOtp: kycOtp,
    });
  });

  app.post('/api/kyc/verify', (req, res) => {
    const { transactionId, otp } = req.body || {};
    const session = kycSessions.get(String(transactionId || ''));
    if (!session || session.expiresAt < Date.now()) {
      res.status(400).json({ error: 'KYC session expired. Please initiate again.' });
      return;
    }
    if (String(otp || '').trim() !== session.otp) {
      res.status(400).json({ error: 'Incorrect 6-digit KYC OTP.' });
      return;
    }
    kycSessions.delete(String(transactionId));
    const badgeToken = `SR-KYC-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    res.json({
      success: true,
      kyc: {
        badgeToken,
        maskedId: session.maskedId,
        idType: session.idType,
      },
      googleDriveStorage: {
        folderName: 'Sahiroomie_Customer_Data_Vault',
        syncedAt: new Date().toISOString(),
      },
    });
  });

  return app;
}
