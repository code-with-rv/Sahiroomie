import type {
  FilterState,
  FinderGenZ,
  Listing,
  SortOption,
  VibeAnalysis,
} from '../types/sahiroomie';

export function formatINR(amount: number | string): string {
  const n = Math.round(Number(amount) || 0);
  return '₹' + n.toLocaleString('en-IN');
}

export function formatCompactINR(amount: number | string): string {
  const n = Number(amount) || 0;
  if (n >= 100000) {
    return '₹' + (n / 100000).toFixed(2).replace(/\.00$/, '') + 'L';
  }
  if (n >= 1000) {
    const k = n / 1000;
    return '₹' + (Number.isInteger(k) ? k : k.toFixed(1).replace(/\.0$/, '')) + 'k';
  }
  return '₹' + n;
}

export function formatCountdown(secs: number): string {
  const safe = Math.max(0, Math.floor(secs));
  const d = Math.floor(safe / 86400);
  const h = Math.floor((safe % 86400) / 3600);
  const m = Math.floor((safe % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

export function validateIndianPhone(raw: string): string | null {
  const cleaned = raw.replace(/\D/g, '');
  if (!/^[6-9]\d{9}$/.test(cleaned)) {
    return null;
  }
  return cleaned;
}

export function validateEmail(raw: string): string | null {
  const cleaned = raw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleaned)) {
    return null;
  }
  return cleaned;
}

// Verhoeff algorithm tables for 12-digit Aadhaar checksum validation
const D_TABLE = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

const P_TABLE = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

export function validateAadhaarVerhoeff(raw: string): boolean {
  const digits = raw.replace(/\s+/g, '');
  if (!/^[2-9]\d{11}$/.test(digits)) return false;
  let c = 0;
  const inverted = digits.split('').reverse().map(Number);
  for (let i = 0; i < inverted.length; i++) {
    c = D_TABLE[c][P_TABLE[i % 8][inverted[i]]];
  }
  return c === 0;
}

export function validatePan(raw: string): boolean {
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(raw.trim().toUpperCase());
}

export function maskGovernmentId(idType: 'AADHAAR' | 'PAN', raw: string): string {
  const clean = raw.replace(/\s+/g, '').toUpperCase();
  if (idType === 'AADHAAR') {
    return `XXXX-XXXX-${clean.slice(-4)}`;
  }
  return `${clean.slice(0, 5)}****${clean.slice(-1)}`;
}

/**
 * Projects lat/lng coordinates onto normalized [12..88]% viewport coordinates
 * when viewing "All India" so markers from different cities never pile up.
 */
export function projectAllIndiaPin(lat: number, lng: number): { x: number; y: number } {
  const minLat = 8.0;
  const maxLat = 32.5;
  const minLng = 68.0;
  const maxLng = 88.5;
  const normX = ((lng - minLng) / (maxLng - minLng)) * 72 + 14;
  const normY = ((maxLat - lat) / (maxLat - minLat)) * 68 + 16;
  return {
    x: Math.max(10, Math.min(90, Math.round(normX * 10) / 10)),
    y: Math.max(14, Math.min(86, Math.round(normY * 10) / 10)),
  };
}

export function computeGenZCompatibility(finderGenZ: FinderGenZ, listing: Listing): VibeAnalysis {
  const rm = listing.existingRoommate || {
    name: listing.host.name,
    age: 24,
    roleTag: 'Working Professional',
    sleepVibe: listing.compatibility.sleep === 'Night owl' ? 'Night Owl' : 'Early Bird',
    socialBattery: 'Ambivert',
    cleanlinessVibe: listing.hygieneVerified ? 'Pinterest Clean' : 'Organized Chaos',
    wfhNoise: listing.compatibility.wfh.includes('Full') ? 'Quiet WFH' : 'Hybrid Chill',
    vibeTags: ['Splitwise 50-50', 'Earphones After 11 PM', 'Respects Closed-Door Time'],
    expectations: 'Looking for a drama-free flatmate who splits bills on time and keeps common spaces neat.',
  };

  let sleepScore = 72;
  if (finderGenZ.sleepVibe === rm.sleepVibe) {
    sleepScore = 98;
  } else if (finderGenZ.sleepVibe === 'Flexible' || rm.sleepVibe === 'Flexible') {
    sleepScore = 88;
  } else {
    sleepScore = 62;
  }

  let socialScore = 75;
  if (finderGenZ.socialBattery === rm.socialBattery) {
    socialScore = 96;
  } else if (finderGenZ.socialBattery === 'Ambivert' || rm.socialBattery === 'Ambivert') {
    socialScore = 86;
  } else {
    socialScore = 60;
  }

  let cleanScore = 78;
  if (finderGenZ.cleanlinessVibe === rm.cleanlinessVibe) {
    cleanScore = 97;
  } else if (
    (finderGenZ.cleanlinessVibe === 'Pinterest Clean' && rm.cleanlinessVibe === 'Organized Chaos') ||
    (finderGenZ.cleanlinessVibe === 'Organized Chaos' && rm.cleanlinessVibe === 'Pinterest Clean')
  ) {
    cleanScore = 68;
  } else {
    cleanScore = 82;
  }

  const sharedTags = (finderGenZ.vibeTags || []).filter((tag) => (rm.vibeTags || []).includes(tag));
  const tagBonus = Math.min(22, sharedTags.length * 7);
  let promptKeywordBonus = 0;
  const customPrompt = (finderGenZ.customExpectation || '').toLowerCase();
  if (customPrompt) {
    if ((customPrompt.includes('quiet') || customPrompt.includes('wfh') || customPrompt.includes('call')) && rm.wfhNoise.includes('Quiet')) {
      promptKeywordBonus += 8;
    }
    if ((customPrompt.includes('split') || customPrompt.includes('bill') || customPrompt.includes('zepto')) && (rm.vibeTags || []).includes('Splitwise 50-50')) {
      promptKeywordBonus += 8;
    }
    if ((customPrompt.includes('clean') || customPrompt.includes('hygiene')) && listing.hygieneVerified) {
      promptKeywordBonus += 7;
    }
    if ((customPrompt.includes('chill') || customPrompt.includes('party')) && rm.socialBattery === 'Extrovert') {
      promptKeywordBonus += 7;
    }
  }
  const vibeAlignmentScore = Math.min(99, 70 + tagBonus + promptKeywordBonus);

  const rawTotal = Math.round((sleepScore + socialScore + cleanScore + vibeAlignmentScore) / 4);
  const score = Math.max(58, Math.min(99, rawTotal));

  const greenFlags: string[] = [];
  const frictionFlags: string[] = [];

  if (sleepScore >= 88) {
    greenFlags.push(`Synced routine: Both lean ${rm.sleepVibe.toLowerCase()}`);
  } else {
    frictionFlags.push(`Different sleep clocks (${finderGenZ.sleepVibe} vs ${rm.sleepVibe}) — agree on quiet hours`);
  }

  if (socialScore >= 86) {
    greenFlags.push(`Matching social battery (${rm.socialBattery} energy)`);
  } else {
    frictionFlags.push(`Social contrast (${finderGenZ.socialBattery} vs ${rm.socialBattery}) — align on weekend guests`);
  }

  if (cleanScore >= 85) {
    greenFlags.push(`Aligned hygiene vibe (${rm.cleanlinessVibe})`);
  } else {
    frictionFlags.push(`Cleanliness gap: You prefer ${finderGenZ.cleanlinessVibe}, roomie is ${rm.cleanlinessVibe}`);
  }

  sharedTags.slice(0, 2).forEach((tag) => {
    greenFlags.push(`Shared Gen-Z rule: "${tag}"`);
  });

  if (greenFlags.length === 0) {
    greenFlags.push(`Verified ${rm.roleTag} with transparent house rules`);
  }

  const badgeLabel =
    score >= 90 ? 'Soulmate Roomie' : score >= 80 ? 'High Vibe Match' : score >= 70 ? 'Solid Match' : 'Talk Boundaries';

  const icebreaker = `Hey ${rm.name.split(' ')[0]}! Saw we have a ${score}% Sahiroomie vibe match (${greenFlags[0]?.toLowerCase() || 'similar WFH & living habits'}). Would love to check out the room!`;

  return {
    score,
    badgeLabel,
    roommate: rm,
    dimensions: [
      { label: 'Sleep & Hustle', pct: sleepScore },
      { label: 'Social Battery', pct: socialScore },
      { label: 'Cleanliness', pct: cleanScore },
      { label: 'Gen-Z Boundaries', pct: vibeAlignmentScore },
    ],
    greenFlags,
    frictionFlags,
    icebreaker,
  };
}

export function filterAndSortListings(
  listings: Listing[],
  opts: {
    searchQuery: string;
    radiusKm: number;
    filters: FilterState;
    sortBy: SortOption;
    userGender: string;
  }
): Listing[] {
  const q = opts.searchQuery.trim().toLowerCase();
  const filtered = listings.filter((l) => {
    if (l.distanceKm > opts.radiusKm) return false;
    if (q && ![l.city, l.area, l.landmark, l.title, l.state].some((f) => f.toLowerCase().includes(q))) {
      return false;
    }
    if (l.rent < opts.filters.minRent) return false;
    if (opts.filters.maxRent < 35000 && l.rent > opts.filters.maxRent) return false;

    if (opts.filters.gender === 'Matches my profile') {
      if (l.gender !== 'Any' && l.gender !== opts.userGender) return false;
    } else if (opts.filters.gender !== 'Any' && l.gender !== opts.filters.gender) {
      return false;
    }

    if (opts.filters.type !== 'Any' && l.type !== opts.filters.type) return false;
    if (opts.filters.hygieneImportant && !l.hygieneVerified) return false;
    if (opts.filters.diet !== 'Any' && !l.compatibility.diet.toLowerCase().includes(opts.filters.diet.toLowerCase())) return false;
    if (opts.filters.smoking === 'No smoking' && l.compatibility.smoking !== 'No smoking') return false;
    if (opts.filters.wfh && !l.compatibility.wfh.toLowerCase().includes('wfh')) return false;
    if (opts.filters.coupleFriendly && !l.compatibility.coupleFriendly) return false;
    if (l.sizeSqFt < opts.filters.minSizeSqFt) return false;
    return true;
  });

  return [...filtered].sort((a, b) => {
    if (opts.sortBy === 'bestVibe') return (b.vibeScore || 0) - (a.vibeScore || 0);
    if (opts.sortBy === 'lowest') return a.rent - b.rent;
    if (opts.sortBy === 'newest') return a.createdHoursAgo - b.createdHoursAgo;
    if (opts.sortBy === 'fillsSoonest') return a.urgentDays - b.urgentDays;
    return a.distanceKm - b.distanceKm;
  });
}

export const MONEY_SCAM_REGEX = /(deposit|advance|token|pay|upi|gpay|phonepe|paytm|transfer|money|₹|\brs\b)/i;

export function hasScamKeyword(text: string): boolean {
  return MONEY_SCAM_REGEX.test(text);
}
