import type { AppTab, Listing } from '../types/sahiroomie';

export interface SeoFaqItem {
  question: string;
  answer: string;
}

export const SAHIROOMIE_FAQS: SeoFaqItem[] = [
  {
    question: 'How does Sahiroomie protect my exact home address before a visit?',
    answer:
      'Every room and PG listing displays an approximate 1 km privacy circle on the map. Your exact street and house number remain hidden until both you and the host confirm a visit slot in chat.',
  },
  {
    question: 'How can I sign in and set up my roommate profile on Sahiroomie?',
    answer:
      'You can sign in with Google or continue with your email address, upload your personal photo, add your occupation and age (18+), and save your room budget and move-in timeline.',
  },
  {
    question: 'How does AI Gen-Z Roommate Compatibility scoring work?',
    answer:
      'Sahiroomie compares sleep schedules, social battery, cleanliness standards, WFH quiet hours, and house rules like Splitwise splits to compute a live match percentage and AI Vibe Coach breakdown.',
  },
  {
    question: 'Does Sahiroomie charge brokerage or allow advance deposit scams?',
    answer:
      'Sahiroomie connects roommates and verified PG managers directly with zero brokerage. Built-in anti-scam alerts warn you automatically if anyone asks for UPI or advance token deposits before an in-person visit.',
  },
];

export interface RouteSeoMeta {
  title: string;
  description: string;
  canonicalPath: string;
  jsonLd: Record<string, any>[];
}

export function cityToSlug(city: string): string {
  return city
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function slugToCityName(slug: string): string {
  const map: Record<string, string> = {
    'all-india': 'All India',
    bengaluru: 'Bengaluru',
    bangalore: 'Bengaluru',
    mumbai: 'Mumbai',
    'delhi-ncr': 'Delhi NCR',
    delhi: 'Delhi NCR',
    pune: 'Pune',
    hyderabad: 'Hyderabad',
    bhopal: 'Bhopal',
  };
  return map[slug.toLowerCase()] || 'Bengaluru';
}

export function parseAppUrlPath(pathname: string): {
  tab: AppTab;
  city?: string;
  listingId?: string;
  showFaq?: boolean;
} {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/faq') return { tab: 'find', showFaq: true };
  if (clean === '/find') return { tab: 'find' };
  if (clean === '/chats') return { tab: 'chats' };
  if (clean === '/alerts') return { tab: 'alerts' };
  if (clean === '/profile') return { tab: 'profile' };

  const cityMatch = clean.match(/^\/city\/([a-z0-9-]+)$/i);
  if (cityMatch) {
    return { tab: 'home', city: slugToCityName(cityMatch[1]) };
  }

  const stayMatch = clean.match(/^\/stays\/([a-zA-Z0-9_-]+)$/);
  if (stayMatch) {
    return { tab: 'home', listingId: stayMatch[1] };
  }

  return { tab: 'home' };
}

export function buildRouteSeo(options: {
  origin: string;
  pathname: string;
  selectedCity: string;
  activeTab: AppTab;
  selectedListing?: Listing;
  listingsCount: number;
  showFaq?: boolean;
}): RouteSeoMeta {
  const { origin, selectedCity, activeTab, selectedListing, listingsCount, showFaq } = options;

  const baseAppJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Sahiroomie',
    url: origin,
    applicationCategory: 'LifestyleApplication',
    operatingSystem: 'All',
    inLanguage: ['en-IN', 'hi-IN', 'kn-IN', 'mr-IN'],
    description:
      'Find verified roommates, PG beds, and flatshares across India with AI Gen-Z vibe matching and 1 km privacy protection.',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'INR',
    },
  };

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: SAHIROOMIE_FAQS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  if (selectedListing) {
    const suffix = ' | Sahiroomie';
    const maxBase = 60 - suffix.length;
    const baseTitle =
      selectedListing.title.length > maxBase
        ? `${selectedListing.title.slice(0, maxBase - 1).trimEnd()}…`
        : selectedListing.title;
    const title = `${baseTitle}${suffix}`;
    const description =
      `${selectedListing.type} in ${selectedListing.area}, ${selectedListing.city} at ₹${selectedListing.rent}/mo. ${selectedListing.furnishing}, verified roommate vibe match & 1 km privacy radius.`.slice(
        0,
        158
      );
    const listingJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Apartment',
      name: selectedListing.title,
      description: selectedListing.description,
      url: `${origin}/stays/${selectedListing.id}`,
      address: {
        '@type': 'PostalAddress',
        addressLocality: selectedListing.area,
        addressRegion: selectedListing.city,
        addressCountry: 'IN',
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: selectedListing.lat,
        longitude: selectedListing.lng,
      },
      offers: {
        '@type': 'Offer',
        price: String(selectedListing.rent),
        priceCurrency: 'INR',
        availability: 'https://schema.org/InStock',
      },
    };
    return {
      title,
      description,
      canonicalPath: `/stays/${selectedListing.id}`,
      jsonLd: [baseAppJsonLd, listingJsonLd],
    };
  }

  if (showFaq) {
    return {
      title: 'Roommate & PG Safety FAQ | Sahiroomie India',
      description:
        'Answers on 1 km address privacy, Google Sign-In & onboarding, AI roommate compatibility, and zero-brokerage PG safety across India.',
      canonicalPath: '/faq',
      jsonLd: [baseAppJsonLd, faqJsonLd],
    };
  }

  if (activeTab === 'find') {
    return {
      title: `Search ${listingsCount} Verified Rooms & PGs | Sahiroomie`,
      description:
        'Filter verified PGs, rooms in flats, and flatmates across Bengaluru, Mumbai, Delhi NCR, Pune, Hyderabad, and Bhopal by budget and AI vibe score.',
      canonicalPath: '/find',
      jsonLd: [baseAppJsonLd, faqJsonLd],
    };
  }

  if (activeTab === 'chats') {
    return {
      title: 'Chats & Visit Scheduling | Sahiroomie',
      description: 'Direct anti-scam protected chats with verified roommates and PG managers on Sahiroomie.',
      canonicalPath: '/chats',
      jsonLd: [baseAppJsonLd],
    };
  }

  if (activeTab === 'alerts') {
    return {
      title: 'Match Alerts & Visit Updates | Sahiroomie',
      description: 'Track roommate match alerts, visit confirmations, and listing updates on Sahiroomie.',
      canonicalPath: '/alerts',
      jsonLd: [baseAppJsonLd],
    };
  }

  if (activeTab === 'profile') {
    return {
      title: 'Profile & Room Requirements | Sahiroomie',
      description: 'Manage your Sahiroomie profile, Gen-Z compatibility vibe, language preferences, and room requirements.',
      canonicalPath: '/profile',
      jsonLd: [baseAppJsonLd],
    };
  }

  if (selectedCity && selectedCity !== 'All India') {
    const slug = cityToSlug(selectedCity);
    return {
      title: `Rooms, PGs & Flatmates in ${selectedCity} | Sahiroomie`.slice(0, 60),
      description:
        `Explore verified shared flats, PG beds, and AI-matched roommates in ${selectedCity} with 1 km privacy circles and zero brokerage.`.slice(
          0,
          158
        ),
      canonicalPath: `/city/${slug}`,
      jsonLd: [baseAppJsonLd, faqJsonLd],
    };
  }

  return {
    title: 'Sahiroomie — Verified Roommate, PG & Flat Finder India',
    description:
      'Find verified roommates, PG beds, and flatshares across India with AI vibe matching, 1 km privacy circles, and instant visit scheduling.',
    canonicalPath: '/',
    jsonLd: [baseAppJsonLd, faqJsonLd],
  };
}

export function buildSitemapXml(origin: string, cities: string[], listingIds: string[]): string {
  const staticPaths = ['/', '/find', '/faq', ...cities.map((c) => `/city/${cityToSlug(c)}`), ...listingIds.map((id) => `/stays/${id}`)];
  const uniquePaths = Array.from(new Set(staticPaths));
  const urls = uniquePaths
    .map(
      (p) =>
        `  <url>\n    <loc>${origin}${p}</loc>\n    <changefreq>daily</changefreq>\n    <priority>${p === '/' ? '1.0' : p.startsWith('/city/') ? '0.9' : '0.8'}</priority>\n  </url>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
}

export function syncDocumentSeo(meta: RouteSeoMeta): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  document.title = meta.title;

  const setMeta = (selector: string, attrName: 'name' | 'property', key: string, content: string) => {
    let el = document.head.querySelector(selector) as HTMLMetaElement | null;
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attrName, key);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  const fullUrl = `${window.location.origin}${meta.canonicalPath}`;
  setMeta('meta[name="description"]', 'name', 'description', meta.description);
  setMeta('meta[property="og:title"]', 'property', 'og:title', meta.title);
  setMeta('meta[property="og:description"]', 'property', 'og:description', meta.description);
  setMeta('meta[property="og:url"]', 'property', 'og:url', fullUrl);
  setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', meta.title);
  setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', meta.description);

  let canonical = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  canonical.setAttribute('href', fullUrl);

  let ldScript = document.getElementById('sahiroomie-dynamic-jsonld') as HTMLScriptElement | null;
  if (!ldScript) {
    ldScript = document.createElement('script');
    ldScript.id = 'sahiroomie-dynamic-jsonld';
    ldScript.type = 'application/ld+json';
    document.head.appendChild(ldScript);
  }
  ldScript.textContent = JSON.stringify(meta.jsonLd);
}
