import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { CountdownLabel, Icon } from './components/Icon';
import { InteractiveCityMap } from './components/InteractiveCityMap';
import type { OnboardingCompletePayload } from './components/OnboardingModal';
import { SahiroomieLogo } from './components/SahiroomieLogo';
import {
  INITIAL_CHATS,
  INITIAL_LISTINGS,
  INITIAL_NOTIFICATIONS,
  TRANSLATIONS,
  getLocalizedListingTitle,
} from './data/seedData';
import type {
  AppNotification,
  AppTab,
  ChatThread,
  FilterState,
  FinderGenZ,
  Language,
  Listing,
  ModerationItem,
  SheetSnap,
  SortOption,
  UserProfile,
} from './types/sahiroomie';
import {
  computeGenZCompatibility,
  filterAndSortListings,
  formatINR,
} from './utils/compatibility';
import { buildRouteSeo, cityToSlug, parseAppUrlPath, syncDocumentSeo } from './utils/seo';

const AlertsScreen = lazy(() =>
  import('./components/AlertsScreen').then((m) => ({ default: m.AlertsScreen }))
);
const ChatsScreen = lazy(() =>
  import('./components/ChatsScreen').then((m) => ({ default: m.ChatsScreen }))
);
const FilterSheetModal = lazy(() =>
  import('./components/FilterSheetModal').then((m) => ({ default: m.FilterSheetModal }))
);
const GovIdKycModal = lazy(() =>
  import('./components/GovIdKycModal').then((m) => ({ default: m.GovIdKycModal }))
);
const ListingDetailScreen = lazy(() =>
  import('./components/ListingDetailScreen').then((m) => ({ default: m.ListingDetailScreen }))
);
const OnboardingModal = lazy(() =>
  import('./components/OnboardingModal').then((m) => ({ default: m.OnboardingModal }))
);
const PostListingWizard = lazy(() =>
  import('./components/PostListingWizard').then((m) => ({ default: m.PostListingWizard }))
);
const ProfileScreen = lazy(() =>
  import('./components/ProfileScreen').then((m) => ({ default: m.ProfileScreen }))
);
const SeoFaqSection = lazy(() =>
  import('./components/SeoFaqSection').then((m) => ({ default: m.SeoFaqSection }))
);
const VibeStudioModal = lazy(() =>
  import('./components/VibeStudioModal').then((m) => ({ default: m.VibeStudioModal }))
);
const VoiceConciergeModal = lazy(() =>
  import('./components/VoiceConciergeModal').then((m) => ({ default: m.VoiceConciergeModal }))
);

let firebaseModulePromise: Promise<typeof import('./lib/firebase')> | null = null;
function loadFirebase() {
  if (!firebaseModulePromise) {
    firebaseModulePromise = import('./lib/firebase');
  }
  return firebaseModulePromise;
}

function ensureIndicFontLoaded(lang: Language) {
  if (typeof document === 'undefined') return;
  const fontMap: Partial<Record<Language, { id: string; href: string }>> = {
    hi: {
      id: 'sahi-font-devanagari',
      href: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700&display=swap',
    },
    mr: {
      id: 'sahi-font-devanagari',
      href: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700&display=swap',
    },
    kn: {
      id: 'sahi-font-kannada',
      href: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Kannada:wght@400;600;700&display=swap',
    },
  };
  const target = fontMap[lang];
  if (!target || document.getElementById(target.id)) return;
  const link = document.createElement('link');
  link.id = target.id;
  link.rel = 'stylesheet';
  link.href = target.href;
  document.head.appendChild(link);
}

const DEFAULT_FILTERS: FilterState = {
  rentPreset: 'Any',
  minRent: 2000,
  maxRent: 35000,
  gender: 'Any',
  type: 'Any',
  hygieneImportant: false,
  diet: 'Any',
  smoking: 'Any',
  wfh: false,
  coupleFriendly: false,
  minSizeSqFt: 80,
};

const SESSION_STORAGE_KEY = 'sahiroomie_session_v1';

const DEFAULT_FRESH_PROFILE: UserProfile = {
  userId: 'USR-GUEST',
  name: '',
  age: 22,
  gender: 'Male',
  occupation: '',
  bio: '',
  photoUrl: '',
  phone: '',
  email: '',
  city: 'Bengaluru',
  state: 'Karnataka',
  authProvider: 'guest',
  onboardingCompleted: false,
  phoneVerified: false,
  emailVerified: false,
  idVerified: false,
  kycBadgeToken: 'PENDING',
  driveFolder: 'Sahiroomie_Customer_Data_Vault',
  photoVerified: false,
  privacyExactArea: false,
  privacyShowAge: true,
  roomRequirement: {
    targetCity: 'Bengaluru',
    preferredArea: '',
    listingType: 'Room in a flat',
    maxRent: 15000,
    moveInTimeline: 'This month',
    preferredGender: 'Any',
  },
};

const DEFAULT_FINDER_GENZ: FinderGenZ = {
  sleepVibe: 'Early Bird',
  socialBattery: 'Ambivert',
  cleanlinessVibe: 'Pinterest Clean',
  vibeTags: ['Splitwise 50-50', 'WFH Zoom Quiet Hours'],
  customExpectation: '',
};

function readStoredSession(): {
  userProfile?: UserProfile;
  finderGenZ?: FinderGenZ;
  savedIds?: string[];
  guestSkipped?: boolean;
  lang?: Language;
} {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export default function App() {
  const initialRoute = useMemo(() => {
    if (typeof window === 'undefined') return { tab: 'home' as AppTab };
    return parseAppUrlPath(window.location.pathname);
  }, []);

  const initialSession = useMemo(() => {
    if (typeof window === 'undefined') return {};
    return readStoredSession();
  }, []);

  const autostartBypass =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('autostart') === '1';

  const [darkMode, setDarkMode] = useState(false);
  const [lang, setLang] = useState<Language>(() => {
    const saved = initialSession.lang;
    return saved === 'hi' || saved === 'kn' || saved === 'mr' || saved === 'en' ? saved : 'en';
  });
  const t = TRANSLATIONS[lang];

  // Navigation & Overlays (driven by crawlable URLs)
  const [activeTab, setActiveTab] = useState<AppTab>(initialRoute.tab);
  const [showFaqSection, setShowFaqSection] = useState<boolean>(Boolean(initialRoute.showFaq));
  const [guestSkipped, setGuestSkipped] = useState<boolean>(Boolean(initialSession.guestSkipped));
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    if (autostartBypass) return false;
    if (initialSession.userProfile?.onboardingCompleted) return false;
    if (initialSession.guestSkipped) return false;
    return true;
  });
  const [showPostWizard, setShowPostWizard] = useState(false);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(
    initialRoute.listingId || null
  );
  const [mapPreviewListingId, setMapPreviewListingId] = useState<string | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [showVibeStudio, setShowVibeStudio] = useState(false);
  const [showVoiceConcierge, setShowVoiceConcierge] = useState(false);

  // Home Sheet & Filters
  const [sheetSnap, setSheetSnap] = useState<SheetSnap>('peek');
  const [selectedCity, setSelectedCity] = useState(
    initialRoute.city || initialSession.userProfile?.roomRequirement?.targetCity || 'Bengaluru'
  );
  const [quickChip, setQuickChip] = useState('All');

  // Core Data State (clean fresh state — zero fake existing chats or notifications)
  const [listings, setListings] = useState<Listing[]>(INITIAL_LISTINGS);
  const [savedIds, setSavedIds] = useState<string[]>(initialSession.savedIds || []);
  const [myListingIds, setMyListingIds] = useState<string[]>([]);
  const [inquiredIds, setInquiredIds] = useState<string[]>([]);
  const [chats, setChats] = useState<ChatThread[]>(INITIAL_CHATS);
  const [notifications, setNotifications] = useState<AppNotification[]>(INITIAL_NOTIFICATIONS);
  const [blockedNames, setBlockedNames] = useState<string[]>([]);
  const [loadingSkeleton, setLoadingSkeleton] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skeletonTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Seeker's Gen-Z Compatibility Profile
  const [finderGenZ, setFinderGenZ] = useState<FinderGenZ>(() => ({
    ...DEFAULT_FINDER_GENZ,
    ...(initialSession.finderGenZ || {}),
  }));

  // Find Screen State
  const [searchQuery, setSearchQuery] = useState('');
  const [radiusKm, setRadiusKm] = useState(8);
  const [sortBy, setSortBy] = useState<SortOption>('nearest');
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  // User Profile & Compliance State (fresh unseeded defaults unless restored from session/Firestore)
  const [userProfile, setUserProfile] = useState<UserProfile>(() => ({
    ...DEFAULT_FRESH_PROFILE,
    ...(initialSession.userProfile || {}),
    roomRequirement: {
      ...DEFAULT_FRESH_PROFILE.roomRequirement,
      ...(initialSession.userProfile?.roomRequirement || {}),
    },
  }));
  const [firebaseUid, setFirebaseUid] = useState<string | null>(null);
  const [showIdVerifyModal, setShowIdVerifyModal] = useState(false);
  const [showDpdpModal, setShowDpdpModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ type: string; name: string } | null>(null);
  const [reportReason, setReportReason] = useState('Fake photos / misleading rent');
  const [moderationQueue, setModerationQueue] = useState<ModerationItem[]>([]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (skeletonTimerRef.current) clearTimeout(skeletonTimerRef.current);
    };
  }, []);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMsg(''), 2600);
  };

  const triggerSkeleton = () => {
    setLoadingSkeleton(true);
    if (skeletonTimerRef.current) clearTimeout(skeletonTimerRef.current);
    skeletonTimerRef.current = setTimeout(() => setLoadingSkeleton(false), 260);
  };

  // Persist local session safely (non-PII + local resume state)
  useEffect(() => {
    try {
      window.localStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({ userProfile, finderGenZ, savedIds, guestSkipped, lang })
      );
    } catch {
      // Ignore quota errors
    }
  }, [userProfile, finderGenZ, savedIds, guestSkipped, lang]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
      ensureIndicFontLoaded(lang);
    }
  }, [lang]);

  // Lazy-initialize Firebase Auth & Firestore subscriptions off the critical render path
  useEffect(() => {
    let active = true;
    let unsubAuth: (() => void) | null = null;
    let unsubListings: (() => void) | null = null;

    const timer = setTimeout(() => {
      loadFirebase()
        .then((fb) => {
          if (!active) return;
          unsubAuth = fb.subscribeAuthState(async (user) => {
            if (!active) return;
            if (!user) {
              setFirebaseUid(null);
              return;
            }
            setFirebaseUid(user.uid);
            try {
              const remote = await fb.loadUserProfileFromFirestore(user.uid);
              if (!active) return;
              if (remote?.profileUpdates) {
                setUserProfile((prev) => ({
                  ...prev,
                  ...remote.profileUpdates,
                  authProvider: 'google',
                  email: user.email || remote.profileUpdates?.email || prev.email,
                  emailVerified: Boolean(user.emailVerified),
                  roomRequirement: {
                    ...prev.roomRequirement,
                    ...(remote.profileUpdates?.roomRequirement || {}),
                  },
                }));
                if (remote.profileUpdates.onboardingCompleted) {
                  setShowOnboarding(false);
                }
              }
              if (remote?.finderUpdates) {
                setFinderGenZ((prev) => ({ ...prev, ...remote.finderUpdates }));
              }
              if (remote?.savedIds) {
                setSavedIds(remote.savedIds);
              }
            } catch {
              // Keep local state if remote fetch fails gracefully
            }
          });

          try {
            unsubListings = fb.subscribeActiveListings((remoteDocs) => {
              if (!active || !remoteDocs.length) return;
              setListings((prev) => {
                const seedMap = new Map(prev.map((item) => [item.id, item]));
                for (const docItem of remoteDocs) {
                  if (!docItem.id || seedMap.has(docItem.id)) continue;
                  const fallbackBase = INITIAL_LISTINGS[0];
                  seedMap.set(docItem.id, {
                    ...fallbackBase,
                    ...docItem,
                    id: docItem.id,
                    photos: docItem.photos?.length ? docItem.photos : fallbackBase.photos,
                  } as Listing);
                }
                return Array.from(seedMap.values());
              });
            });
          } catch {
            // Firestore offline fallback uses seed catalog cleanly
          }
        })
        .catch(() => {
          // Offline / seed mode works seamlessly without Firebase
        });
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
      if (unsubAuth) unsubAuth();
      if (unsubListings) unsubListings();
    };
  }, []);

  // Browser back/forward URL synchronization
  useEffect(() => {
    const handlePopState = () => {
      const parsed = parseAppUrlPath(window.location.pathname);
      setActiveTab(parsed.tab);
      setShowFaqSection(Boolean(parsed.showFaq));
      setSelectedListingId(parsed.listingId || null);
      if (parsed.city) setSelectedCity(parsed.city);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Synchronize clean crawlable URL + <title>, <meta>, canonical & JSON-LD Schema.org
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const selectedListing = selectedListingId
      ? listings.find((l) => l.id === selectedListingId)
      : undefined;

    let targetPath = '/';
    if (selectedListing) {
      targetPath = `/stays/${selectedListing.id}`;
    } else if (showFaqSection && activeTab === 'find') {
      targetPath = '/faq';
    } else if (activeTab === 'find') {
      targetPath = '/find';
    } else if (activeTab === 'chats') {
      targetPath = '/chats';
    } else if (activeTab === 'alerts') {
      targetPath = '/alerts';
    } else if (activeTab === 'profile') {
      targetPath = '/profile';
    } else if (selectedCity && selectedCity !== 'All India') {
      targetPath = `/city/${cityToSlug(selectedCity)}`;
    }

    const seoMeta = buildRouteSeo({
      origin: window.location.origin,
      pathname: targetPath,
      selectedCity,
      activeTab,
      selectedListing,
      listingsCount: listings.length,
      showFaq: showFaqSection && activeTab === 'find',
    });

    syncDocumentSeo(seoMeta);

    const currentQuery = window.location.search || '';
    if (window.location.pathname !== targetPath) {
      window.history.replaceState(null, '', `${targetPath}${currentQuery}`);
    }
  }, [activeTab, selectedCity, selectedListingId, listings, showFaqSection]);

  useEffect(() => {
    if (showFaqSection && activeTab === 'find') {
      const timer = setTimeout(() => {
        document.getElementById('sahiroomie-seo-faq')?.scrollIntoView({ behavior: 'smooth' });
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [showFaqSection, activeTab]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const enrichedListings = useMemo(() => {
    return listings.map((l) => ({
      ...l,
      vibeScore: computeGenZCompatibility(finderGenZ, l).score,
    }));
  }, [listings, finderGenZ]);

  const homeListings = useMemo(() => {
    return enrichedListings.filter((l) => {
      if (selectedCity !== 'All India' && l.city !== selectedCity) return false;
      if (quickChip === 'AI Match' && (l.vibeScore || 0) < 85) return false;
      if (quickChip === 'Roommate' && l.type !== 'Roommate' && l.type !== 'Room in a flat') return false;
      if (quickChip === 'PG' && l.type !== 'PG') return false;
      if (quickChip === 'Near me' && l.distanceKm > 3.0) return false;
      if (quickChip === 'Under ₹10k' && l.rent >= 10000) return false;
      if (quickChip === 'Women only' && l.gender !== 'Female') return false;
      return true;
    });
  }, [enrichedListings, selectedCity, quickChip]);

  const urgentListings = useMemo(() => {
    const withinSix = homeListings.filter((l) => l.urgentDays <= 6);
    return withinSix.length ? withinSix : enrichedListings.filter((l) => l.urgentDays <= 6);
  }, [homeListings, enrichedListings]);

  const findResults = useMemo(() => {
    return filterAndSortListings(enrichedListings, {
      searchQuery,
      radiusKm,
      filters,
      sortBy,
      userGender: userProfile.gender,
    });
  }, [enrichedListings, searchQuery, radiusKm, filters, sortBy, userProfile.gender]);

  const toggleSaveListing = (id: string) => {
    setSavedIds((prev) => {
      const exists = prev.includes(id);
      const next = exists ? prev.filter((x) => x !== id) : [id, ...prev];
      triggerToast(exists ? 'Removed from Saved' : 'Saved to offline list');
      if (firebaseUid) {
        loadFirebase()
          .then((fb) => {
            if (fb.auth.currentUser?.emailVerified) {
              return fb.syncSavedListingsToFirestore(firebaseUid, next);
            }
          })
          .catch(() => {
            // Kept locally if offline
          });
      }
      return next;
    });
  };

  const handleSendInquiry = (listing: Listing, customIcebreaker?: string) => {
    if (!inquiredIds.includes(listing.id)) {
      setInquiredIds((prev) => [listing.id, ...prev]);
    }
    const existing = chats.find((c) => c.listingId === listing.id);
    if (existing) {
      setSelectedListingId(null);
      setActiveTab('chats');
      setActiveChatId(existing.id);
      setChats((prev) => prev.map((c) => (c.id === existing.id ? { ...c, unread: 0 } : c)));
      return;
    }
    const initialText =
      customIcebreaker ||
      `Hi ${listing.host.name}, I'm interested in "${listing.title}" (${formatINR(listing.rent)}/mo). Is it still available?`;

    const newChat: ChatThread = {
      id: 'chat-' + Date.now(),
      listingId: listing.id,
      peerName: listing.host.name,
      peerRole: listing.host.role,
      isRoomManager: listing.host.isRoomManager,
      verified: listing.host.verified,
      online: true,
      unread: 0,
      messages: [
        {
          id: 'm-' + Date.now(),
          sender: 'me',
          text: initialText,
          time: 'Just now',
          date: 'Today',
          read: true,
        },
      ],
    };
    setChats((prev) => [newChat, ...prev]);
    setSelectedListingId(null);
    setActiveTab('chats');
    setActiveChatId(newChat.id);
    triggerToast('Inquiry sent with AI vibe match!');
  };

  const handleSendMessage = (chatId: string, text: string, fromPeer = false, isViewing = true) => {
    setChats((prev) =>
      prev.map((c) => {
        if (c.id !== chatId) return c;
        return {
          ...c,
          unread: fromPeer && !isViewing ? c.unread + 1 : 0,
          messages: [
            ...c.messages,
            {
              id: 'm-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
              sender: fromPeer ? 'them' : 'me',
              text,
              time: 'Just now',
              date: 'Today',
              read: !fromPeer || isViewing,
            },
          ],
        };
      })
    );
  };

  const handleScheduleVisit = (chatId: string, slot: string) => {
    handleSendMessage(chatId, `Visit requested for ${slot}. Please confirm exact building pin.`, false, true);
    setNotifications((prev) => [
      {
        id: 'n-' + Date.now(),
        group: 'Today',
        type: 'visit',
        title: 'Visit request sent',
        desc: `Scheduled for ${slot}. Exact address unlocks on confirmation.`,
        time: 'Just now',
        unread: true,
        targetTab: 'chats',
        chatId,
      },
      ...prev,
    ]);
    triggerToast('Visit scheduled!');
  };

  const handlePublishListing = async (newListing: Listing) => {
    setListings((prev) => [newListing, ...prev]);
    setMyListingIds((prev) => [newListing.id, ...prev]);
    setSelectedCity(newListing.city);
    setShowPostWizard(false);
    setActiveTab('home');
    setSheetSnap('peek');
    setMapPreviewListingId(newListing.id);
    if (firebaseUid) {
      try {
        const fb = await loadFirebase();
        if (fb.auth.currentUser?.emailVerified) {
          await fb.publishListingToFirestore(firebaseUid, newListing);
        }
      } catch {
        // Already available optimistically in session
      }
    }
    triggerToast('Listing published live on Sahiroomie!');
  };

  const applyRentPreset = (preset: string) => {
    const ranges: Record<string, [number, number]> = {
      Any: [2000, 35000],
      'Under ₹3,000': [1000, 3000],
      '₹3,000–5,000': [3000, 5000],
      '₹5,000–7,000': [5000, 7000],
      '₹7,000–10,000': [7000, 10000],
      '₹10,000–15,000': [10000, 15000],
      '₹15,000–30,000': [15000, 30000],
      '₹30,000+': [30000, 35000],
    };
    const [minRent, maxRent] = ranges[preset] || [2000, 35000];
    setFilters((f) => ({ ...f, rentPreset: preset, minRent, maxRent }));
  };

  const resetAllFindFilters = () => {
    setSearchQuery('');
    setRadiusKm(20);
    setFilters(DEFAULT_FILTERS);
  };

  const unreadAlertsCount = notifications.filter((n) => n.unread).length;
  const unreadChatsCount = chats.reduce((sum, c) => sum + c.unread, 0);
  const previewListing = enrichedListings.find((l) => l.id === mapPreviewListingId);
  const hideBottomBar =
    Boolean(activeChatId) ||
    showPostWizard ||
    Boolean(selectedListingId) ||
    showOnboarding ||
    showVoiceConcierge;

  return (
    <div
      className="w-full h-dvh flex flex-col overflow-hidden"
      style={{ backgroundColor: 'var(--bg)', color: 'var(--text-primary)' }}
    >
      {/* Desktop Top Navigation Bar (Clean 3-Zone Contract on lg+) */}
      <header
        className="hidden lg:flex items-center justify-between gap-8 px-6 py-3 border-b shrink-0 z-30"
        style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
      >
        <button
          type="button"
          onClick={() => {
            setActiveTab('home');
            setActiveChatId(null);
          }}
          className="whitespace-nowrap shrink-0 text-left"
        >
          <SahiroomieLogo size="md" />
        </button>

        <nav className="flex items-center gap-6 text-sm font-semibold" aria-label="Desktop Navigation">
          {(
            [
              { id: 'home', label: t.navHome },
              { id: 'find', label: t.navFind },
              { id: 'chats', label: `${t.navChats}${unreadChatsCount ? ` (${unreadChatsCount})` : ''}` },
              { id: 'alerts', label: `${t.navAlerts}${unreadAlertsCount ? ` (${unreadAlertsCount})` : ''}` },
              { id: 'profile', label: 'Profile' },
            ] as const
          ).map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  setShowFaqSection(false);
                  if (item.id !== 'chats') setActiveChatId(null);
                }}
                className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
                  active ? 'text-[#4F46E5] border-[#4F46E5] font-bold' : 'border-transparent hover:text-[#4F46E5]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowVoiceConcierge(true)}
            className="px-3.5 h-10 rounded-full border text-xs font-bold whitespace-nowrap shrink-0 flex items-center gap-1.5 hover:border-[#4F46E5]/60 transition-colors"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
            aria-label="Open AI Voice Concierge"
          >
            <Icon name="mic" size={15} className="text-[#4F46E5]" />
            <span>Voice</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('profile');
              setShowFaqSection(false);
            }}
            className="flex items-center gap-2 pr-3 pl-1.5 h-10 rounded-full border text-xs font-bold whitespace-nowrap"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
            aria-label="Open my profile"
          >
            <span className="w-7 h-7 rounded-full bg-[#0F172A] text-white text-[11px] font-extrabold flex items-center justify-center overflow-hidden shrink-0">
              {userProfile.photoUrl ? (
                <img src={userProfile.photoUrl} alt={userProfile.name || 'Profile'} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
              ) : (
                (userProfile.name.trim() || 'SR').slice(0, 2).toUpperCase()
              )}
            </span>
            <span>{userProfile.name ? userProfile.name.split(' ')[0] : 'Sign In'}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowPostWizard(true)}
            className="px-4 h-10 rounded-full bg-[#4F46E5] text-white text-xs font-bold whitespace-nowrap shrink-0 flex items-center gap-1.5 shadow-sm hover:opacity-95"
          >
            <Icon name="plus" size={16} /> Post Room / PG
          </button>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* TAB 1: HOME */}
        {activeTab === 'home' && (
          <div className="relative flex-1 flex flex-col lg:flex-row overflow-hidden">
            {/* Map Canvas */}
            <div className="relative flex-1 overflow-hidden">
              <InteractiveCityMap
                listings={homeListings}
                selectedCity={selectedCity}
                onSelectCity={(c) => {
                  setSelectedCity(c);
                  setMapPreviewListingId(null);
                  triggerSkeleton();
                }}
                selectedPinId={mapPreviewListingId}
                onSelectPin={(id) => {
                  setMapPreviewListingId(id);
                  setSheetSnap('peek');
                }}
                darkMode={darkMode}
                lang={lang}
              />

              {/* Floating Search Pill + Mobile Voice & Profile Controls */}
              <div className="absolute top-3 left-3 right-3 z-30 flex items-center gap-2 lg:max-w-md">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('find');
                    setShowFaqSection(false);
                  }}
                  className="flex-1 min-w-0 h-11 lg:h-12 pl-2 pr-3.5 rounded-full shadow-lg border flex items-center gap-2 text-left transition-transform active:scale-[0.99]"
                  style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
                >
                  <SahiroomieLogo size="sm" showWordmark={false} />
                  <span className="text-xs sm:text-sm font-semibold truncate flex-1 min-w-0">
                    {t.searchPlaceholder}
                  </span>
                  <Icon name="search" size={17} className="text-[#4F46E5] shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => setShowVoiceConcierge(true)}
                  className="lg:hidden w-11 h-11 rounded-full bg-[#4F46E5] text-white shadow-lg border-2 border-white flex items-center justify-center shrink-0"
                  aria-label="Open Voice Concierge"
                >
                  <Icon name="mic" size={18} />
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('profile')}
                  className="lg:hidden w-11 h-11 rounded-full bg-[#0F172A] text-white font-extrabold text-xs shadow-lg border-2 border-white flex items-center justify-center shrink-0 overflow-hidden"
                  aria-label="Open Profile"
                >
                  {userProfile.photoUrl ? (
                    <img src={userProfile.photoUrl} alt={userProfile.name || 'Profile'} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                  ) : (
                    (userProfile.name.trim() || 'SR').slice(0, 2).toUpperCase()
                  )}
                </button>
              </div>

              {/* Pin Preview Card (only visible when sheet is in peek mode on mobile, or always bottom-left on desktop) */}
              {previewListing && (sheetSnap === 'peek' || typeof window !== 'undefined') && (
                <div
                  className={`absolute left-3 right-3 z-30 p-3 rounded-2xl shadow-2xl border flex items-center gap-3 animate-fade-in lg:right-auto lg:w-96 lg:bottom-4 ${
                    sheetSnap === 'peek' ? 'bottom-[276px]' : 'hidden lg:flex'
                  }`}
                  style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedListingId(previewListing.id)}
                    className="flex-1 flex items-center gap-3 text-left min-w-0"
                  >
                    <img
                      src={previewListing.photos[0]}
                      alt={previewListing.title}
                      referrerPolicy="no-referrer"
                      className="w-20 h-20 rounded-xl object-cover shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold whitespace-nowrap overflow-hidden">
                        <span className="text-[#4F46E5] truncate">{previewListing.type}</span>
                        <span aria-hidden="true" className="shrink-0">·</span>
                        <span className="text-[#059669] shrink-0">{previewListing.vibeScore}% Match</span>
                        {previewListing.urgentDays <= 6 && (
                          <>
                            <span aria-hidden="true" className="shrink-0">·</span>
                            <span className="text-[#DC2626] shrink-0">
                              {previewListing.urgentDays}d left
                            </span>
                          </>
                        )}
                      </div>
                      <div className="font-extrabold text-xs truncate mt-0.5">{previewListing.title}</div>
                      <div className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                        {previewListing.area}
                      </div>
                      <div className="text-sm font-extrabold mt-1 font-mono-num">
                        {formatINR(previewListing.rent)}
                        <span className="text-[11px] font-normal">{t.perMonth}</span>
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapPreviewListingId(null)}
                    className="w-10 h-10 rounded-full flex items-center justify-center self-start shrink-0"
                    aria-label="Close pin preview"
                  >
                    <Icon name="close" size={16} />
                  </button>
                </div>
              )}
            </div>

            {/* Bottom Sheet on Mobile / Right Discovery Panel on Desktop */}
            <aside
              style={{
                backgroundColor: 'var(--bg)',
                borderColor: 'var(--border)',
                height: sheetSnap === 'peek' ? '264px' : sheetSnap === 'half' ? '55%' : '86%',
              }}
              className="absolute bottom-0 inset-x-0 z-20 rounded-t-2xl border-t flex flex-col spring-sheet lg:static lg:h-full! lg:w-[440px] lg:rounded-none lg:border-t-0 lg:border-l lg:shadow-none"
            >
              {/* Quick Chips */}
              <div className="px-3 pt-3 pb-2 flex items-center gap-1.5 overflow-x-auto lg:overflow-x-visible lg:flex-wrap no-scrollbar shrink-0">
                {[
                  { id: 'All', label: 'All' },
                  { id: 'AI Match', label: t.chipAiMatch },
                  { id: 'Roommate', label: t.chipRoommate },
                  { id: 'PG', label: t.chipPG },
                  { id: 'Near me', label: t.chipNearMe },
                  { id: 'Under ₹10k', label: t.chipUnder10k },
                  { id: 'Women only', label: t.chipWomenOnly },
                ].map((chip) => {
                  const active = quickChip === chip.id;
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => {
                        setQuickChip(active && chip.id !== 'All' ? 'All' : chip.id);
                        triggerSkeleton();
                      }}
                      className="px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition-colors shrink-0"
                      style={{
                        backgroundColor: active ? '#4F46E5' : 'var(--surface)',
                        color: active ? '#FFFFFF' : 'var(--text-primary)',
                        borderColor: active ? '#4F46E5' : 'var(--border)',
                      }}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>

              {/* Mobile Drag Handle */}
              <button
                type="button"
                onClick={() => {
                  const nextSnap: SheetSnap =
                    sheetSnap === 'peek' ? 'half' : sheetSnap === 'half' ? 'full' : 'peek';
                  setSheetSnap(nextSnap);
                  if (nextSnap !== 'peek') setMapPreviewListingId(null);
                }}
                className="lg:hidden w-full py-1.5 flex flex-col items-center justify-center shrink-0"
                aria-label="Toggle bottom sheet height"
              >
                <span className="w-10 h-1.5 rounded-full bg-gray-400/50" />
              </button>

              {/* Sheet / Panel Scrollable Content */}
              <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4 no-scrollbar">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-extrabold tracking-wide text-[#DC2626] flex items-center gap-1.5">
                      <Icon name="clock" size={14} /> {t.urgentHeader}
                    </h2>
                    <button
                      type="button"
                      onClick={() => setShowVibeStudio(true)}
                      className="text-[11px] font-extrabold text-[#4F46E5] py-1"
                    >
                      Tune AI Vibe
                    </button>
                  </div>

                  {loadingSkeleton ? (
                    <div className="flex gap-3 overflow-hidden">
                      {[1, 2].map((s) => (
                        <div key={s} className="w-64 h-24 rounded-2xl skeleton shrink-0" />
                      ))}
                    </div>
                  ) : (
                    <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 pr-2">
                      {urgentListings.map((l) => (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => setSelectedListingId(l.id)}
                          className="w-[244px] p-2.5 rounded-2xl border flex items-center gap-2.5 shrink-0 text-left transition-transform active:scale-[0.99]"
                          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
                        >
                          <img
                            src={l.photos[0]}
                            alt={l.title}
                            loading="lazy"
                            decoding="async"
                            referrerPolicy="no-referrer"
                            className="w-20 h-20 rounded-xl object-cover shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 text-[10px] font-extrabold">
                              <span className="text-[#DC2626]">
                                {t.fillsIn} {l.urgentDays}d
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="text-[#059669]">{l.vibeScore}% match</span>
                            </div>
                            <div className="text-[10px] font-bold text-[#4F46E5] mt-0.5">
                              <CountdownLabel initialSeconds={l.countdownSeconds} />
                            </div>
                            <div className="font-extrabold text-xs truncate mt-0.5">{l.area}</div>
                            <div className="text-xs font-extrabold mt-0.5 font-mono-num">
                              {formatINR(l.rent)}
                              <span className="text-[10px] font-normal">{t.perMonth}</span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Expanded List (Always visible on desktop, visible on half/full snap on mobile) */}
                <div className={`space-y-2.5 pt-1 ${sheetSnap === 'peek' ? 'hidden lg:block' : 'block animate-fade-in'}`}>
                  <h3 className="text-xs font-extrabold tracking-wide" style={{ color: 'var(--text-muted)' }}>
                    {t.nearbyHeader} ({homeListings.length})
                  </h3>
                  {homeListings.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setSelectedListingId(l.id)}
                      className="w-full p-3 rounded-2xl border flex items-center gap-3 text-left hover:border-[#4F46E5]/50 transition-colors"
                      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
                    >
                      <img src={l.photos[0]} alt={l.title} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="w-20 h-20 rounded-xl object-cover shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 text-[11px] font-bold">
                          <span className="text-[#4F46E5]">
                            {l.type} · {l.gender}
                          </span>
                          <span className="text-[#059669]">{l.vibeScore}% Vibe</span>
                        </div>
                        <div className="font-extrabold text-xs truncate mt-0.5">{getLocalizedListingTitle(l, lang)}</div>
                        <div className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                          {l.area}, {l.city}
                        </div>
                        <div className="text-sm font-extrabold mt-1 font-mono-num">
                          {formatINR(l.rent)}
                          <span className="text-[11px] font-normal">{t.perMonth}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* TAB 2: FIND */}
        {activeTab === 'find' && (
          <div className="flex-1 flex flex-col overflow-hidden max-w-6xl w-full mx-auto" style={{ backgroundColor: 'var(--bg)' }}>
            <div className="p-3.5 lg:px-6 border-b space-y-2.5" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2">
                <div
                  className="flex-1 h-11 px-3.5 rounded-full border flex items-center gap-2"
                  style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  <Icon name="search" size={16} className="text-[#4F46E5]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="City, area, metro or landmark..."
                    aria-label="Search city, area, metro or landmark"
                    className="bg-transparent flex-1 text-xs font-semibold outline-none"
                  />
                  {searchQuery && (
                    <button type="button" onClick={() => setSearchQuery('')} aria-label="Clear search">
                      <Icon name="close" size={14} />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowFilterSheet(true)}
                  className="h-11 px-4 rounded-full bg-[#0F172A] text-white dark:bg-[#4F46E5] text-xs font-bold flex items-center gap-1.5 shrink-0 whitespace-nowrap"
                >
                  <Icon name="sliders" size={15} /> {t.filters}
                </button>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => setShowVibeStudio(true)}
                  className="px-3 py-1.5 rounded-full text-[11px] font-extrabold whitespace-nowrap bg-[#4F46E5] text-white flex items-center gap-1 shrink-0"
                >
                  <Icon name="sparkles" size={11} /> AI Vibe Setup
                </button>
                {[
                  'Koramangala',
                  'Indiranagar',
                  'HSR',
                  'Andheri',
                  'Powai',
                  'Hauz Khas',
                  'Gurugram',
                  'Viman Nagar',
                  'Gachibowli',
                  'Bhopal',
                ].map((loc) => (
                      <button
                        key={loc}
                        type="button"
                        onClick={() => setSearchQuery(searchQuery === loc ? '' : loc)}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap border shrink-0 ${
                          searchQuery === loc ? 'bg-[#4F46E5] text-white border-[#4F46E5]' : ''
                        }`}
                        style={searchQuery !== loc ? { backgroundColor: 'var(--surface)', borderColor: 'var(--border)' } : {}}
                      >
                        {loc}
                      </button>
                    ))}
              </div>

              <div className="flex items-center justify-between gap-4 pt-0.5">
                <div className="flex-1 max-w-sm">
                  <div className="flex justify-between text-[11px] font-bold mb-1">
                    <span>
                      {t.radius}: <span className="text-[#4F46E5] font-mono-num">{radiusKm} km</span>
                    </span>
                    <span className="font-mono-num">1–20 km</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={20}
                    aria-label="Search radius in kilometers"
                    value={radiusKm}
                    onChange={(e) => setRadiusKm(Number(e.target.value))}
                    className="w-full sahi-range"
                  />
                </div>
                <select
                  value={sortBy}
                  aria-label="Sort results"
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="h-10 px-3 rounded-xl border text-xs font-bold outline-none"
                  style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                >
                  <option value="nearest">Sort: Nearest</option>
                  <option value="bestVibe">Best AI Vibe Match</option>
                  <option value="lowest">Lowest rent</option>
                  <option value="newest">Newest</option>
                  <option value="fillsSoonest">Fills soonest</option>
                </select>
              </div>

              <div className="flex items-center justify-between text-xs pt-0.5">
                <span className="font-extrabold">
                  {findResults.length} {t.resultsFound}
                </span>
                <button type="button" onClick={resetAllFindFilters} className="font-bold text-[#4F46E5] py-1">
                  {t.clearAll}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3.5 lg:p-6 pb-24 no-scrollbar">
              {findResults.length === 0 ? (
                <div
                  className="p-6 rounded-2xl border text-center space-y-3 my-4 max-w-md mx-auto"
                  style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  <div className="w-12 h-12 rounded-full bg-[#4F46E5]/15 text-[#4F46E5] flex items-center justify-center mx-auto">
                    <Icon name="pin" size={22} />
                  </div>
                  <h3 className="text-base font-extrabold">No rooms match within {radiusKm} km</h3>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    Try expanding your search radius to 20 km or resetting your rent & lifestyle filters.
                  </p>
                  <button
                    type="button"
                    onClick={resetAllFindFilters}
                    className="px-5 h-11 rounded-full bg-[#4F46E5] text-white text-xs font-bold"
                  >
                    Reset Filters & Widen to 20 km
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {findResults.map((l) => {
                    const isSaved = savedIds.includes(l.id);
                    return (
                      <div
                        key={l.id}
                        className="rounded-2xl border overflow-hidden relative flex flex-col"
                        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
                      >
                        <button
                          type="button"
                          onClick={() => toggleSaveListing(l.id)}
                          className="absolute top-3 right-3 z-10 w-10 h-10 rounded-full bg-white/95 dark:bg-black/75 flex items-center justify-center shadow"
                          aria-label={isSaved ? `Remove ${l.title} from saved` : `Save ${l.title}`}
                        >
                          <Icon name={isSaved ? 'heartFilled' : 'heart'} size={18} />
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedListingId(l.id)}
                          className="text-left flex-1 flex flex-col"
                        >
                          <div className="relative h-44 w-full pg-photo-fallback">
                            <img src={l.photos[0]} alt={l.title} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/75 to-transparent" />
                            <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/80 text-white text-[11px] font-extrabold backdrop-blur-sm">
                              {l.vibeScore}% Vibe Match
                            </div>
                            <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-[11px] font-extrabold text-white">
                              <span>
                                {l.type} · {l.gender}
                              </span>
                              {l.urgentDays <= 6 && (
                                <span className="text-[#A7F3D0]">
                                  {t.fillsIn} {l.urgentDays}d
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="p-3.5 space-y-1.5 flex-1 flex flex-col justify-between w-full">
                            <div>
                              <div className="flex items-start justify-between gap-2">
                                <h3 className="font-extrabold text-sm leading-snug">{getLocalizedListingTitle(l, lang)}</h3>
                                <span className="text-xs font-bold shrink-0 text-[#059669] font-mono-num">
                                  {l.distanceKm} km
                                </span>
                              </div>
                              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                                {l.area}, {l.city} · Roomie: {l.existingRoommate?.name} ({l.existingRoommate?.sleepVibe})
                              </p>
                            </div>
                            <div className="flex items-center justify-between pt-2">
                              <div className="text-base font-extrabold text-[#4F46E5] font-mono-num">
                                {formatINR(l.rent)}
                                <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
                                  {t.perMonth}
                                </span>
                              </div>
                              {l.hygieneVerified && (
                                <span className="text-[11px] font-bold text-[#059669]">
                                  Hygiene {l.hygieneRating}★
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <Suspense fallback={null}>
                <SeoFaqSection
                  selectedCity={selectedCity}
                  highlighted={showFaqSection}
                  onSelectCityRoute={(cityName) => {
                    setSelectedCity(cityName);
                    setShowFaqSection(false);
                    setActiveTab('home');
                    triggerSkeleton();
                  }}
                  onOpenFaqRoute={() => {
                    setActiveTab('find');
                    setShowFaqSection(true);
                  }}
                />
              </Suspense>
            </div>
          </div>
        )}

        {/* TAB 4: CHATS */}
        {activeTab === 'chats' && (
          <div className="flex-1 flex flex-col overflow-hidden max-w-4xl w-full mx-auto lg:border-x" style={{ borderColor: 'var(--border)' }}>
            <Suspense fallback={<div className="p-6 text-xs font-bold opacity-60">Loading chats...</div>}>
              <ChatsScreen
                chats={chats}
                listings={listings}
                activeChatId={activeChatId}
                onSelectChat={(id) => {
                  setActiveChatId(id);
                  if (id) {
                    setChats((prev) => prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
                  }
                }}
                onSendMessage={handleSendMessage}
                onScheduleVisit={handleScheduleVisit}
                onReportUser={(name) => setReportTarget({ type: 'User', name })}
                blockedNames={blockedNames}
                onToggleBlock={(name) => {
                  const alreadyBlocked = blockedNames.includes(name);
                  setBlockedNames((prev) => (alreadyBlocked ? prev.filter((x) => x !== name) : [...prev, name]));
                  triggerToast(alreadyBlocked ? `Unblocked ${name}` : `Blocked ${name}`);
                }}
                onBrowseStays={() => {
                  setActiveTab('find');
                  setShowFaqSection(false);
                }}
                lang={lang}
              />
            </Suspense>
          </div>
        )}

        {/* TAB 5: ALERTS */}
        {activeTab === 'alerts' && (
          <div className="flex-1 flex flex-col overflow-hidden max-w-4xl w-full mx-auto lg:border-x" style={{ borderColor: 'var(--border)' }}>
            <Suspense fallback={<div className="p-6 text-xs font-bold opacity-60">Loading alerts...</div>}>
              <AlertsScreen
                notifications={notifications}
                onMarkRead={(id) =>
                  setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, unread: false } : n)))
                }
                onMarkAllRead={() => {
                  setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
                  triggerToast('All alerts marked as read');
                }}
                onOpenNotification={(n) => {
                  setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, unread: false } : x)));
                  if (n.listingId) {
                    setSelectedListingId(n.listingId);
                  } else if (n.chatId && chats.some((c) => c.id === n.chatId)) {
                    setActiveTab('chats');
                    setActiveChatId(n.chatId);
                    setChats((prev) => prev.map((c) => (c.id === n.chatId ? { ...c, unread: 0 } : c)));
                  } else if (n.targetTab) {
                    setActiveTab(n.targetTab);
                  }
                }}
                lang={lang}
              />
            </Suspense>
          </div>
        )}

        {/* PROFILE TAB */}
        {activeTab === 'profile' && (
          <div className="flex-1 flex flex-col overflow-hidden max-w-3xl w-full mx-auto lg:border-x" style={{ borderColor: 'var(--border)' }}>
            <Suspense fallback={<div className="p-6 text-xs font-bold opacity-60">Loading profile...</div>}>
              <ProfileScreen
                userProfile={userProfile}
                setUserProfile={setUserProfile}
                finderGenZ={finderGenZ}
                listings={listings}
                savedIds={savedIds}
                myListingIds={myListingIds}
                inquiredIds={inquiredIds}
                lang={lang}
                setLang={setLang}
                darkMode={darkMode}
                setDarkMode={setDarkMode}
                moderationQueue={moderationQueue}
                onBackHome={() => {
                  setActiveTab('home');
                  setShowFaqSection(false);
                }}
                onOpenOnboarding={() => setShowOnboarding(true)}
                onConnectGoogle={async () => {
                  try {
                    const fb = await loadFirebase();
                    const user = await fb.signInWithGoogle();
                    setFirebaseUid(user.uid);
                    const nextProfile: UserProfile = {
                      ...userProfile,
                      userId: user.uid,
                      authProvider: 'google',
                      email: user.email || userProfile.email,
                      emailVerified: Boolean(user.emailVerified),
                      name: userProfile.name || user.displayName || '',
                      photoUrl: userProfile.photoUrl || user.photoURL || '',
                    };
                    setUserProfile(nextProfile);
                    if (user.emailVerified) {
                      await fb.saveUserProfileToFirestore(user.uid, nextProfile, finderGenZ, savedIds);
                    }
                    triggerToast('Google account linked & synced!');
                  } catch {
                    triggerToast('Could not connect Google account.');
                  }
                }}
                onSaveProfileToCloud={async () => {
                  if (firebaseUid) {
                    try {
                      const fb = await loadFirebase();
                      if (fb.auth.currentUser?.emailVerified) {
                        await fb.saveUserProfileToFirestore(firebaseUid, userProfile, finderGenZ, savedIds);
                        triggerToast('Profile & room requirements synced to cloud!');
                        return;
                      }
                    } catch {
                      // Fallback toast below
                    }
                  }
                  triggerToast('Profile & room requirements saved!');
                }}
                onOpenFaq={() => {
                  setActiveTab('find');
                  setShowFaqSection(true);
                }}
                onOpenVibeStudio={() => setShowVibeStudio(true)}
                onOpenIdVerify={() => setShowIdVerifyModal(true)}
                onOpenPostWizard={() => setShowPostWizard(true)}
                onSelectListing={(id) => setSelectedListingId(id)}
                onOpenDpdpModal={() => setShowDpdpModal(true)}
                onOpenAdminModal={() => setShowAdminModal(true)}
                onOpenDeleteConfirm={() => setShowDeleteConfirm(true)}
                onLogout={() => {
                  loadFirebase()
                    .then((fb) => fb.signOutFirebase())
                    .catch(() => {});
                  setFirebaseUid(null);
                  setUserProfile(DEFAULT_FRESH_PROFILE);
                  setFinderGenZ(DEFAULT_FINDER_GENZ);
                  setSavedIds([]);
                  setInquiredIds([]);
                  setChats([]);
                  setNotifications([]);
                  setGuestSkipped(false);
                  try {
                    window.localStorage.removeItem(SESSION_STORAGE_KEY);
                  } catch {
                    // Ignore
                  }
                  setShowOnboarding(true);
                  triggerToast('Signed out cleanly');
                }}
              />
            </Suspense>
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      {!hideBottomBar && (
        <nav
          className="lg:hidden h-[70px] px-2 border-t flex items-center justify-around shrink-0 z-30"
          style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
          aria-label="Primary Bottom Navigation"
        >
          {(
            [
              { id: 'home', label: t.navHome, icon: 'home' },
              { id: 'find', label: t.navFind, icon: 'search' },
              { id: 'post', label: t.navPost, icon: 'plus', isCenter: true },
              { id: 'chats', label: t.navChats, icon: 'chat', badge: unreadChatsCount },
              { id: 'alerts', label: t.navAlerts, icon: 'bell', badge: unreadAlertsCount },
            ] as const
          ).map((tab) => {
            if ('isCenter' in tab && tab.isCenter) {
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setShowPostWizard(true)}
                  className="flex flex-col items-center justify-center -mt-5"
                  aria-label="Post a listing"
                >
                  <span
                    className="w-[52px] h-[52px] rounded-full bg-[#4F46E5] text-white shadow-lg flex items-center justify-center border-4"
                    style={{ borderColor: 'var(--bg)' }}
                  >
                    <Icon name="plus" size={24} />
                  </span>
                  <span className="text-[10px] font-extrabold mt-0.5">{tab.label}</span>
                </button>
              );
            }

            const isActive = activeTab === tab.id;
            const badge = 'badge' in tab ? tab.badge : 0;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as AppTab)}
                className="relative min-w-[56px] h-12 flex flex-col items-center justify-center gap-0.5"
                style={{ color: isActive ? '#4F46E5' : 'var(--text-muted)' }}
              >
                <div className="relative">
                  <Icon name={tab.icon} size={21} />
                  {badge > 0 && (
                    <span className="absolute -top-1 -right-1.5 w-2.5 h-2.5 rounded-full bg-[#4F46E5] border border-white" />
                  )}
                </div>
                <span className="text-[10px] font-bold">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      )}

      {/* Overlays & Modals */}
      <Suspense fallback={null}>
        {selectedListingId && (
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]">
            <ListingDetailScreen
              listing={enrichedListings.find((l) => l.id === selectedListingId)}
              isSaved={savedIds.includes(selectedListingId)}
              onToggleSave={toggleSaveListing}
              onBack={() => setSelectedListingId(null)}
              onSendInquiry={handleSendInquiry}
              onReportListing={(lst) => setReportTarget({ type: 'Listing', name: lst.title })}
              finderGenZ={finderGenZ}
              onOpenVibeStudio={() => setShowVibeStudio(true)}
              lang={lang}
              darkMode={darkMode}
            />
          </div>
        )}

        {showPostWizard && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]">
            <PostListingWizard
              userProfile={userProfile}
              lang={lang}
              darkMode={darkMode}
              onClose={() => setShowPostWizard(false)}
              onPublish={handlePublishListing}
            />
          </div>
        )}

        {showOnboarding && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]">
            <OnboardingModal
              initialProfile={userProfile}
              initialFinder={finderGenZ}
              onBrowseAsGuest={() => {
                setGuestSkipped(true);
                setShowOnboarding(false);
              }}
              onComplete={async (payload: OnboardingCompletePayload) => {
                const nextProfile: UserProfile = {
                  ...userProfile,
                  ...payload.profileUpdates,
                  onboardingCompleted: true,
                  roomRequirement: {
                    ...userProfile.roomRequirement,
                    ...(payload.profileUpdates.roomRequirement || {}),
                  },
                };
                const nextFinder: FinderGenZ = {
                  ...finderGenZ,
                  ...payload.finderUpdates,
                };
                setUserProfile(nextProfile);
                setFinderGenZ(nextFinder);
                if (nextProfile.roomRequirement.targetCity) {
                  setSelectedCity(nextProfile.roomRequirement.targetCity);
                }
                if (payload.firebaseUid) {
                  setFirebaseUid(payload.firebaseUid);
                  try {
                    const fb = await loadFirebase();
                    if (fb.auth.currentUser?.emailVerified) {
                      await fb.saveUserProfileToFirestore(payload.firebaseUid, nextProfile, nextFinder, savedIds);
                    }
                  } catch {
                    // Saved locally cleanly
                  }
                }
                setGuestSkipped(false);
                setShowOnboarding(false);
                triggerToast('Profile & room requirements saved!');
              }}
            />
          </div>
        )}

        {showVibeStudio && (
          <VibeStudioModal
            finderGenZ={finderGenZ}
            setFinderGenZ={setFinderGenZ}
            onSave={() => {
              setShowVibeStudio(false);
              triggerToast('AI compatibility scores updated!');
            }}
            onClose={() => setShowVibeStudio(false)}
          />
        )}

        {showVoiceConcierge && (
          <VoiceConciergeModal
            selectedCity={selectedCity}
            lang={lang}
            onClose={() => setShowVoiceConcierge(false)}
          />
        )}

        {showFilterSheet && (
          <FilterSheetModal
            filters={filters}
            setFilters={setFilters}
            applyRentPreset={applyRentPreset}
            resultsCount={findResults.length}
            onClose={() => setShowFilterSheet(false)}
            lang={lang}
          />
        )}

        {showIdVerifyModal && (
          <GovIdKycModal
            userProfile={userProfile}
            onClose={() => setShowIdVerifyModal(false)}
            onVerified={({ badgeToken, driveFolder }) => {
              setUserProfile((p) => ({
                ...p,
                idVerified: true,
                kycBadgeToken: badgeToken,
                driveFolder: driveFolder || p.driveFolder,
              }));
              setShowIdVerifyModal(false);
              triggerToast(`ID Verified (${badgeToken})!`);
            }}
          />
        )}
      </Suspense>

      {showDpdpModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center p-3">
          <div className="w-full max-w-md p-4 rounded-2xl space-y-3 modal-slide-up" style={{ backgroundColor: 'var(--bg)' }}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold">DPDP Act 2023 Data Privacy</h3>
              <button type="button" onClick={() => setShowDpdpModal(false)} aria-label="Close DPDP modal" className="w-10 h-10 flex items-center justify-center">
                <Icon name="close" />
              </button>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              In compliance with India’s Digital Personal Data Protection Act, 2023:
              <br />• Purpose limitation: Your verified email and approximate location are used solely for roommate matching on Sahiroomie.
              <br />• Exact house coordinates remain masked inside a 1 km circle until a visit is scheduled.
              <br />• Right to erasure: You may permanently delete your account and personal records anytime from Profile.
            </p>
            <button
              type="button"
              onClick={() => setShowDpdpModal(false)}
              className="w-full h-11 rounded-full bg-[#0F172A] text-white dark:bg-[#4F46E5] text-xs font-bold"
            >
              Acknowledge
            </button>
          </div>
        </div>
      )}

      {showAdminModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center p-3">
          <div className="w-full max-w-md p-4 rounded-2xl space-y-3 modal-slide-up" style={{ backgroundColor: 'var(--bg)' }}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold">{t.adminPanel}</h3>
              <button type="button" onClick={() => setShowAdminModal(false)} aria-label="Close admin panel" className="w-10 h-10 flex items-center justify-center">
                <Icon name="close" />
              </button>
            </div>
            <div className="space-y-2">
              {moderationQueue.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl border space-y-2"
                  style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold">{item.target}</span>
                    <span className="text-[11px] font-bold text-[#4F46E5] shrink-0">{item.status}</span>
                  </div>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {item.reason}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setModerationQueue((q) =>
                          q.map((x) => (x.id === item.id ? { ...x, status: 'Approved / Verified' } : x))
                        );
                        triggerToast('Action recorded');
                      }}
                      className="px-3 py-1.5 rounded-full bg-[#059669] text-white text-[11px] font-bold"
                    >
                      Approve / Verify
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setModerationQueue((q) =>
                          q.map((x) => (x.id === item.id ? { ...x, status: 'Banned & Removed' } : x))
                        );
                        triggerToast('Listing/User banned');
                      }}
                      className="px-3 py-1.5 rounded-full bg-[#DC2626] text-white text-[11px] font-bold"
                    >
                      Ban & Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {reportTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center p-3">
          <div className="w-full max-w-md p-4 rounded-2xl space-y-3 modal-slide-up" style={{ backgroundColor: 'var(--bg)' }}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold">Report {reportTarget.type}</h3>
              <button type="button" onClick={() => setReportTarget(null)} aria-label="Close report modal" className="w-10 h-10 flex items-center justify-center">
                <Icon name="close" />
              </button>
            </div>
            <p className="text-xs font-semibold">{reportTarget.name}</p>
            <select
              value={reportReason}
              aria-label="Report reason"
              onChange={(e) => setReportReason(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border text-xs font-bold"
              style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            >
              <option>Fake photos / misleading rent</option>
              <option>Asked for advance deposit before visit</option>
              <option>Broker posing as direct roommate</option>
              <option>Harassment or unsafe behavior</option>
            </select>
            <button
              type="button"
              onClick={async () => {
                const repId = 'rep-' + Date.now();
                setModerationQueue((q) => [
                  {
                    id: repId,
                    target: `${reportTarget.type}: ${reportTarget.name}`,
                    reason: reportReason,
                    status: 'Pending',
                  },
                  ...q,
                ]);
                if (firebaseUid) {
                  try {
                    const fb = await loadFirebase();
                    if (fb.auth.currentUser?.emailVerified) {
                      await fb.submitSafetyReportToFirestore(
                        firebaseUid,
                        repId,
                        reportTarget.type,
                        reportTarget.name,
                        reportReason
                      );
                    }
                  } catch {
                    // Kept in local queue
                  }
                }
                setReportTarget(null);
                triggerToast('Report submitted to safety team');
              }}
              className="w-full h-11 rounded-full bg-[#DC2626] text-white text-xs font-bold"
            >
              Submit Safety Report
            </button>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center p-3">
          <div className="w-full max-w-md p-4 rounded-2xl space-y-3 modal-slide-up" style={{ backgroundColor: 'var(--bg)' }}>
            <h3 className="text-base font-extrabold text-[#DC2626]">Permanently delete account?</h3>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Your profile, active listings, saved searches, and chat history will be erased in accordance with DPDP Act 2023.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 h-11 rounded-full border text-xs font-bold"
                style={{ borderColor: 'var(--border)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  loadFirebase()
                    .then((fb) => fb.signOutFirebase())
                    .catch(() => {});
                  setFirebaseUid(null);
                  setShowDeleteConfirm(false);
                  setUserProfile(DEFAULT_FRESH_PROFILE);
                  setFinderGenZ(DEFAULT_FINDER_GENZ);
                  setSavedIds([]);
                  setInquiredIds([]);
                  setMyListingIds([]);
                  setChats([]);
                  setNotifications([]);
                  setActiveChatId(null);
                  setGuestSkipped(false);
                  try {
                    window.localStorage.removeItem(SESSION_STORAGE_KEY);
                  } catch {
                    // Ignore
                  }
                  setShowOnboarding(true);
                  triggerToast('Account data erased');
                }}
                className="flex-1 h-11 rounded-full bg-[#DC2626] text-white text-xs font-bold"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMsg && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[#0F172A] text-white text-xs font-bold shadow-xl whitespace-nowrap animate-fade-in">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
