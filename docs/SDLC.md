# Sahiroomie Software Development Life Cycle (SDLC)

This document records the end-to-end engineering lifecycle for **Sahiroomie** — India's privacy-first, AI-vibe-matched roommate, PG, and shared-flat discovery platform.

---

## 1. Planning & Requirements Analysis
- **Fresh User Onboarding**: Every first-time visitor starts cleanly with **zero pre-existing fake chats or notifications** (`INITIAL_CHATS = []`, `INITIAL_NOTIFICATIONS = []`), signs in via **Google Sign-In** or **Indian +91 Mobile OTP**, uploads/selects a **personal photo**, fills out **personal profile details** (name, 18+ age, gender, occupation, city, state, bio), and defines their **room requirement** (target city, preferred area, accommodation type, max rent budget, move-in timeline).
- **Privacy & Compliance**: Exact residential coordinates remain masked inside a 1 km privacy circle until visit confirmation, Aadhaar/PAN inputs are strictly verified via Verhoeff/format checksums without raw ID persistence, and account deletion honors DPDP Act 2023 erasure.
- **Search Engine Optimization (SEO)**: Clean crawlable routes (`/`, `/find`, `/faq`, `/city/:slug`, `/stays/:id`), SSR metadata & Schema.org JSON-LD injection, `/robots.txt`, and `/sitemap.xml`.

## 2. System & Database Architecture
- **Frontend**: React 19 + TypeScript + Tailwind CSS v4 + Vite.
- **Backend**: Express (`server.ts`) hosting SSR HTML SEO injection, `/robots.txt`, `/sitemap.xml`, +91 OTP endpoints (`/api/auth/otp/send`, `/api/auth/otp/verify`), KYC verification (`/api/kyc/initiate`, `/api/kyc/verify`), and Gemini AI Vibe Coach (`/api/vibe-analysis`).
- **Database & Auth (`firebase-blueprint.json`)**:
  - Provisioned Firebase Auth (Google provider) and Cloud Firestore (`ai-studio-sahiroomie-...`).
  - PII separation: public profile data resides at `users/{uid}/public/profile` (`displayName`, `photoUrl`, `occupation`, `sleepVibe`, `roomRequirement`, etc.), while sensitive PII resides strictly in owner-scoped `users/{uid}/private/info` (`email`, `phone`, `age`, `kycBadgeToken`, `savedListingIds`).
  - Public catalog in `listings/{listingId}`, moderation reports in `reports/{reportId}`, and participant-gated chat threads in `chats/{chatId}`.

## 3. Security Engineering & Threat Modeling
- Documented in `security_spec.md` and enforced in `firestore.rules`:
  - `email_verified == true` enforcement for authenticated Firestore writes.
  - Strict field whitelists (`hasAll` / `hasOnly`), immutable `createdAt` & ownership IDs (`ownerId` / `userId`), server-timestamp integrity (`request.time`), and `photoUrl` payload cap (`< 200 KB`).
  - Client-side canvas compression ensures uploaded profile photos stay compact and safe for Firestore storage.
  - Zero raw credentials or client secrets in code; verified via `npx eslint firestore.rules`.

## 4. Technical SEO & Discoverability Implementation
- **Crawlable History API Routing**: Clean URLs (`/city/bengaluru`, `/stays/lst-101`, `/find`, `/faq`) synchronized bi-directionally with React state (`parseAppUrlPath` + `syncDocumentSeo`).
- **Server-Side Metadata & Structured Data Injection (`server.ts`)**: `injectRouteSeoIntoHtml` dynamically populates `<title>`, `<meta name="description">`, `<link rel="canonical">`, OpenGraph, Twitter Cards, and Schema.org JSON-LD (`WebApplication`, `Apartment` with `Offer` & `GeoCoordinates`, and `FAQPage`) directly into the HTML response before serving.
- **Visible Content Parity**: `SeoFaqSection.tsx` renders crawlable `<a>` city landing links and visible FAQ cards matching `FAQPage` JSON-LD text verbatim.

## 5. Verification & Quality Assurance
1. **Pure Logic Unit Tests (`node:test`)**:
   - `src/utils/compatibility.test.ts`: Validates INR formatting, Verhoeff Aadhaar/PAN masking, Indian +91 phone validation, Gen-Z vibe scoring, and search sorting/filtering.
   - `src/utils/seo.test.ts`: Validates URL slug parsing, per-route `<title>`/`<meta>` length budgets, `Apartment` & `FAQPage` JSON-LD schemas, and `sitemap.xml` generation.
2. **Static & Rules Validation**:
   - `npx eslint firestore.rules`
   - `npm run build` / `tsc --noEmit`
   - `npm run lint`
3. **End-to-End Browser Verification (Playwright)**:
   - Desktop (`1440x900`) and Mobile (`390x844`) responsive checks.
   - Fresh visitor flow: Onboarding auth choice -> personal photo & profile details -> room requirement -> zero existing fake chats -> profile display & SEO FAQ/metadata inspection.

## 6. Deployment & Operations
- Single-port Express + Vite production server (`npm run build && npm start`) on port `3000`.
- Firestore security rules deployed cleanly via Firebase Admin/RPC tooling.
