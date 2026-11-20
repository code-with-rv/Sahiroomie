# Sahiroomie

[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=0F172A)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-7-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vite.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9-199900?style=flat-square&logo=leaflet&logoColor=white)](https://leafletjs.com/)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore_%26_Auth-DD2C00?style=flat-square&logo=firebase&logoColor=white)](https://firebase.google.com/)
[![Express](https://img.shields.io/badge/Express-4-0F172A?style=flat-square&logo=express&logoColor=white)](https://expressjs.com/)
[![Tests](https://img.shields.io/badge/Tests-19_passing-059669?style=flat-square&logo=checkmarx&logoColor=white)](#checks--unit-tests)
[![License: MIT](https://img.shields.io/badge/License-MIT-4F46E5?style=flat-square)](LICENSE)

<!-- Once pushed to GitHub, uncomment and replace <owner>/<repo> to show a live GitHub Actions CI badge:
[![CI](https://github.com/<owner>/<repo>/actions/workflows/ci.yml/badge.svg)](https://github.com/<owner>/<repo>/actions/workflows/ci.yml)
-->

**Verified Roommate, PG & Flat Finder for India** — built with React, TypeScript, Vite, Express, Tailwind CSS, Leaflet, and Firebase (Firestore & Auth).

![Sahiroomie Desktop Street Map & Live Listings Preview](docs/screenshots/desktop-street-map.png)

## Preview Gallery

| All India Live City Clusters | Satellite Map View | Mobile Experience |
| :---: | :---: | :---: |
| ![All India Live Map](docs/screenshots/desktop-all-india-map.png) | ![Satellite View](docs/screenshots/desktop-satellite-map.png) | ![Mobile Home View](docs/screenshots/mobile-home.png) |

## Current Features

- **Real Interactive Street & Satellite Map**: Zoomable, pannable Leaflet map powered by Esri World Street Map and World Imagery tiles (with place-name labels), plotting live listings across **Bengaluru, Mumbai, Delhi NCR, Pune, Hyderabad, Bhopal**, and **All India**.
- **Zoom-Aware City Clustering & Map Controls**: Automatically groups multi-listing cities into compact cluster badges (`3 · ₹8.5k+`) on national zoom, expands into individual neighborhood price pills on zoom-in, and includes Street/Satellite toggle, zoom controls, browser geolocation (**Locate Me**), dark-mode tile styling, and one-tap **Open area in Google Maps** links.
- **1 km Privacy-First Location Masking**: Keeps exact flat and PG addresses private inside an interactive 1 km dashed privacy halo across the homepage map, Listing Detail view, and Post Listing Wizard until a visit is scheduled.
- **Real-Time AI Voice Concierge**: Hands-free voice assistant for discovering rooms, comparing areas, and navigating listings with live audio streaming and transcripts.
- **Gen-Z Vibe Compatibility & AI Vibe Coach**: Weighted roommate compatibility scoring across sleep schedule, cleanliness, social battery, WFH noise, and house habits, paired with an editable **Vibe Studio** and on-demand coaching insights (`/api/vibe-analysis`).
- **Firebase Auth & Real-Time Firestore Sync**: Sign in with Google or continue with email to set up a profile, publish live listings that sync in real time across sessions, persist saved shortlists, and manage host chats and alerts.
- **8-Step Listing Wizard & Trust Controls**: Publish rooms in flats, PG beds, or full-flat roommate searches with tap-to-pin 1 km map selection, photo ordering, urgency countdowns, scam-keyword screening, and Aadhaar (Verhoeff checksum) / PAN verification utilities.
- **Smart Discovery & Urgent Stays**: Quick filters (`85%+ Vibe Match`, `Roommate`, `PG`, `Near me`, `Under ₹10k`, `Women only`), full filter modal (budget range, radius, gender, hygiene, furnishing, diet/smoking/pets), and an **Urgent: moving in within 6 days** live countdown carousel.
- **Multi-Language & Dark Mode UI**: Full interface support for **English**, **हिन्दी (Hindi)**, **ಕನ್ನಡ (Kannada)**, and **मराठी (Marathi)**, with light and dark themes.
- **SEO-Ready Architecture**: Clean URL routes (`/city/:slug`, `/stays/:id`, `/find`, `/faq`), dynamic Schema.org JSON-LD (`Apartment` and `FAQPage`), `/robots.txt`, and `/sitemap.xml`.

## Local Development

```bash
cp .env.example .env
# Optional: set server-side FIREBASE_* variables in .env
# (or copy firebase-applet-config.example.json to firebase-applet-config.json locally)
npm install
npm run dev
```

> **Security Note**: `firebase-applet-config.json` and `.env` are gitignored, and Firebase client config is loaded dynamically from the server (`/api/firebase-config`) so no API key is baked into static frontend bundles or committed to GitHub.

## Checks & Unit Tests

```bash
npm run lint
npm run build
npx tsx --test src/utils/compatibility.test.ts src/utils/seo.test.ts src/utils/pcmAudio.test.ts src/utils/mapClustering.test.ts
```
