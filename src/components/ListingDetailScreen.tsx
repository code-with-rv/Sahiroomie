import L from 'leaflet';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PG_PHOTOS, TRANSLATIONS, getLocalizedListingTitle } from '../data/seedData';
import type { FinderGenZ, Language, Listing } from '../types/sahiroomie';
import { computeGenZCompatibility, formatINR } from '../utils/compatibility';
import { MAP_TILE_ATTRIBUTIONS, MAP_TILE_URLS } from '../utils/mapClustering';
import { Icon } from './Icon';

interface ListingDetailScreenProps {
  listing: Listing | undefined;
  isSaved: boolean;
  onToggleSave: (id: string) => void;
  onBack: () => void;
  onSendInquiry: (listing: Listing, icebreaker: string) => void;
  onReportListing: (listing: Listing) => void;
  finderGenZ: FinderGenZ;
  onOpenVibeStudio: () => void;
  lang: Language;
  darkMode: boolean;
}

export const ListingDetailScreen: React.FC<ListingDetailScreenProps> = ({
  listing,
  isSaved,
  onToggleSave,
  onBack,
  onSendInquiry,
  onReportListing,
  finderGenZ,
  onOpenVibeStudio,
  lang,
  darkMode,
}) => {
  const t = TRANSLATIONS[lang];
  const [photoIdx, setPhotoIdx] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [placeFilter, setPlaceFilter] = useState<'All' | 'Transit' | 'Work/Study' | 'Essentials'>('All');
  const [aiInsight, setAiInsight] = useState<{ verdict: string; tip: string; poweredBy: string } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const detailMapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setPhotoIdx(0);
    setPlaceFilter('All');
    setMenuOpen(false);
  }, [listing?.id]);

  const vibeAnalysis = useMemo(() => {
    if (!listing) return null;
    return computeGenZCompatibility(finderGenZ, listing);
  }, [finderGenZ, listing]);

  useEffect(() => {
    setAiInsight(null);
  }, [listing?.id, finderGenZ]);

  const handleRunAiVibeCheck = async () => {
    if (!listing || !vibeAnalysis) return;
    setAiLoading(true);
    try {
      const res = await fetch('/api/vibe-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          finderGenZ,
          analysis: vibeAnalysis,
          listing: {
            id: listing.id,
            title: listing.title,
            area: listing.area,
            city: listing.city,
          },
        }),
      });
      if (!res.ok) throw new Error('API_ERROR');
      const data = await res.json();
      setAiInsight(data);
    } catch {
      const topGreen = vibeAnalysis.greenFlags[0] || 'aligned daily schedules';
      const watchout = vibeAnalysis.frictionFlags[0]
        ? `Quick vibe-check tip: ${vibeAnalysis.frictionFlags[0]}.`
        : 'Ask about their Splitwise grocery & maid split during your visit!';
      setAiInsight({
        verdict: `${vibeAnalysis.score}% Sahiroomie match with ${vibeAnalysis.roommate.name.split(' ')[0]}! Strong overlap on ${topGreen.toLowerCase()}, making day-to-day co-living low-drama and predictable.`,
        tip: watchout,
        poweredBy: 'Sahiroomie AI Vibe Engine',
      });
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    if (!listing || !detailMapRef.current) return;
    const center: [number, number] = [listing.lat || 12.9352, listing.lng || 77.6245];
    const map = L.map(detailMapRef.current, {
      center,
      zoom: 13,
      zoomControl: false,
      attributionControl: true,
    });
    map.attributionControl.setPrefix(false);

    L.tileLayer(MAP_TILE_URLS.street, {
      attribution: MAP_TILE_ATTRIBUTIONS.street,
      maxZoom: 18,
    }).addTo(map);

    L.circle(center, {
      color: '#4F46E5',
      weight: 2,
      dashArray: '5 4',
      fillColor: '#4F46E5',
      fillOpacity: 0.16,
      radius: 1000,
    }).addTo(map);

    L.circleMarker(center, {
      radius: 6,
      color: '#FFFFFF',
      weight: 2,
      fillColor: '#4F46E5',
      fillOpacity: 1,
    }).addTo(map);

    const timer = window.setTimeout(() => map.invalidateSize({ animate: false }), 180);

    return () => {
      window.clearTimeout(timer);
      map.remove();
    };
  }, [listing?.id, listing?.lat, listing?.lng]);

  if (!listing || !vibeAnalysis) return null;

  const allLocalPlaces = listing.nearbyPlaces || [];
  const visiblePlaces =
    placeFilter === 'All'
      ? allLocalPlaces
      : allLocalPlaces.filter((p) => p.category === placeFilter);

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col animate-fade-in lg:max-w-2xl lg:mx-auto lg:my-4 lg:rounded-3xl lg:border lg:shadow-2xl overflow-hidden"
      style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
        <button
          type="button"
          onClick={onBack}
          className="w-11 h-11 rounded-full flex items-center justify-center border"
          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
          aria-label="Back to listings"
        >
          <Icon name="chevronLeft" />
        </button>
        <div className="flex items-center gap-2 text-xs font-bold">
          <span className="text-[#4F46E5]">{listing.type}</span>
          {listing.urgentDays <= 6 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-[#DC2626]">
                {t.fillsIn} {listing.urgentDays} {listing.urgentDays === 1 ? t.day : t.days}
              </span>
            </>
          )}
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="w-11 h-11 rounded-full flex items-center justify-center border"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
            aria-label="Listing options"
          >
            <Icon name="moreVertical" />
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 mt-2 w-48 rounded-2xl shadow-xl border py-1.5 z-50"
              style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
            >
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onReportListing(listing);
                }}
                className="w-full px-4 py-2.5 text-left text-xs font-bold text-[#C0392B] flex items-center gap-2 hover:opacity-80"
              >
                <Icon name="flag" size={15} /> Report listing
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
        <div
          className="relative h-60 w-full overflow-hidden select-none pg-photo-fallback"
          onTouchStart={(e) => {
            touchStartX.current = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            if (touchStartX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchStartX.current;
            if (dx < -35) setPhotoIdx((i) => (i + 1) % listing.photos.length);
            if (dx > 35) setPhotoIdx((i) => (i - 1 + listing.photos.length) % listing.photos.length);
            touchStartX.current = null;
          }}
        >
          <img
            src={listing.photos[photoIdx] || PG_PHOTOS.sunlitBedroom}
            alt={listing.title}
            referrerPolicy="no-referrer"
            onError={(e) => {
              e.currentTarget.src = PG_PHOTOS.sunlitBedroom;
            }}
            className="w-full h-full object-cover"
          />
          {listing.photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => setPhotoIdx((i) => (i - 1 + listing.photos.length) % listing.photos.length)}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/55 text-white flex items-center justify-center"
                aria-label="Previous photo"
              >
                <Icon name="chevronLeft" size={18} />
              </button>
              <button
                type="button"
                onClick={() => setPhotoIdx((i) => (i + 1) % listing.photos.length)}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/55 text-white flex items-center justify-center"
                aria-label="Next photo"
              >
                <Icon name="chevronRight" size={18} />
              </button>
            </>
          )}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 px-2.5 py-1 rounded-full bg-black/50">
            {listing.photos.map((_, idx) => (
              <span
                key={idx}
                className={`h-1.5 rounded-full transition-all ${photoIdx === idx ? 'w-5 bg-white' : 'w-1.5 bg-white/50'}`}
              />
            ))}
          </div>
        </div>

        <div className="p-4 space-y-5">
          <div>
            <h1 className="text-xl font-extrabold leading-snug hindi-safe">
              {getLocalizedListingTitle(listing, lang)}
            </h1>
            <p className="text-xs font-medium mt-1 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
              <Icon name="pin" size={14} className="text-[#4F46E5]" />
              {listing.area}, {listing.city} · {listing.landmark}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 rounded-2xl border" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
              <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Monthly Rent</div>
              <div className="text-base font-extrabold text-[#4F46E5] mt-0.5 font-mono-num">{formatINR(listing.rent)}</div>
            </div>
            <div className="p-3 rounded-2xl border" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
              <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{t.deposit}</div>
              <div className="text-base font-extrabold mt-0.5 font-mono-num">{formatINR(listing.deposit)}</div>
            </div>
            <div className="p-3 rounded-2xl border" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
              <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{t.roomSize}</div>
              <div className="text-base font-extrabold mt-0.5 font-mono-num">
                {listing.sizeSqFt} {t.sqFt}
              </div>
            </div>
          </div>

          {/* AI Gen-Z Compatibility Card */}
          <div
            className="p-4 rounded-2xl border space-y-3.5"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'rgba(79, 70, 229, 0.35)' }}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#4F46E5]">
                  <Icon name="sparkles" size={13} /> {t.aiVibeTitle}
                </div>
                <h2 className="text-sm font-extrabold mt-0.5">
                  You × {vibeAnalysis.roommate.name} ({vibeAnalysis.roommate.age})
                </h2>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  Existing Roomie · {vibeAnalysis.roommate.roleTag}
                </p>
              </div>
              <div className="text-right shrink-0">
                <div className="px-3 py-1 rounded-full bg-[#059669] text-white text-sm font-extrabold font-mono-num">
                  {vibeAnalysis.score}%
                </div>
                <div className="text-[10px] font-bold text-[#059669] mt-1">{vibeAnalysis.badgeLabel}</div>
              </div>
            </div>

            <div className="p-3 rounded-xl border text-xs leading-relaxed" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}>
              <span className="font-bold text-[#4F46E5]">Roomie’s vibe note: </span>
              “{vibeAnalysis.roommate.expectations}”
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {vibeAnalysis.dimensions.map((dim) => (
                <div key={dim.label} className="space-y-1">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span>{dim.label}</span>
                    <span className="text-[#4F46E5] font-mono-num">{dim.pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
                    <div className="h-full bg-[#4F46E5] rounded-full" style={{ width: `${dim.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-1.5 text-xs">
              {vibeAnalysis.greenFlags.map((gf, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[#059669] font-semibold">
                  <Icon name="check" size={14} className="shrink-0 mt-0.5" />
                  <span>{gf}</span>
                </div>
              ))}
              {vibeAnalysis.frictionFlags.map((ff, i) => (
                <div key={i} className="flex items-start gap-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>
                  <Icon name="alertTriangle" size={14} className="shrink-0 mt-0.5 text-[#4F46E5]" />
                  <span>{ff}</span>
                </div>
              ))}
            </div>

            {aiInsight && (
              <div className="p-3 rounded-xl border space-y-1 animate-fade-in" style={{ backgroundColor: 'var(--bg)', borderColor: '#4F46E5' }}>
                <div className="text-[10px] font-extrabold text-[#4F46E5]">{aiInsight.poweredBy}</div>
                <p className="text-xs font-semibold leading-relaxed">{aiInsight.verdict}</p>
                <p className="text-[11px] font-medium text-[#059669]">{aiInsight.tip}</p>
              </div>
            )}

            <div className="flex gap-2 pt-0.5">
              <button
                type="button"
                onClick={handleRunAiVibeCheck}
                disabled={aiLoading}
                className="flex-1 h-11 rounded-full bg-[#0F172A] text-white dark:bg-[#4F46E5] text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <Icon name="sparkles" size={14} />
                {aiLoading ? 'Analyzing vibe...' : aiInsight ? 'Refresh AI Vibe Check' : 'Ask AI Vibe Coach'}
              </button>
              <button
                type="button"
                onClick={onOpenVibeStudio}
                className="px-4 h-11 rounded-full border text-xs font-bold whitespace-nowrap"
                style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
              >
                Edit My Vibe
              </button>
            </div>
          </div>

          {/* Unboxed Metadata Strip */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
            {listing.hygieneVerified && (
              <span className="text-[#059669] font-bold">Hygiene {listing.hygieneRating}★</span>
            )}
            {listing.hygieneVerified && <span aria-hidden="true">·</span>}
            <span>{listing.furnishing}</span>
            {listing.attachedBath && (
              <>
                <span aria-hidden="true">·</span>
                <span>Attached Bath</span>
              </>
            )}
            {listing.balcony && (
              <>
                <span aria-hidden="true">·</span>
                <span>Balcony</span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span>Gender: {listing.gender}</span>
          </div>

          <div className="p-4 rounded-2xl border space-y-3" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
            <h3 className="text-sm font-bold">{t.compatibility}</h3>
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="flex items-center gap-2"><Icon name="check" size={15} className="text-[#059669]" /> <span>Diet: <strong>{listing.compatibility.diet}</strong></span></div>
              <div className="flex items-center gap-2"><Icon name="check" size={15} className="text-[#059669]" /> <span>Smoke: <strong>{listing.compatibility.smoking}</strong></span></div>
              <div className="flex items-center gap-2"><Icon name="check" size={15} className="text-[#059669]" /> <span>Drink: <strong>{listing.compatibility.drinking}</strong></span></div>
              <div className="flex items-center gap-2"><Icon name="check" size={15} className="text-[#059669]" /> <span>Sleep: <strong>{listing.compatibility.sleep}</strong></span></div>
              <div className="flex items-center gap-2"><Icon name="check" size={15} className="text-[#059669]" /> <span>Work: <strong>{listing.compatibility.wfh}</strong></span></div>
              <div className="flex items-center gap-2"><Icon name="check" size={15} className="text-[#059669]" /> <span>Pets: <strong>{listing.compatibility.pets}</strong></span></div>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-bold">About this space</h3>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{listing.description}</p>
            <div className="p-3 rounded-2xl border text-xs" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
              <strong>House rules:</strong> {listing.houseRules}
            </div>
          </div>

          <div className="p-4 rounded-2xl border flex items-center justify-between" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#0F172A] text-white font-extrabold flex items-center justify-center text-sm">
                {listing.host.avatar}
              </div>
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-sm">{listing.host.name}</span>
                  {listing.host.verified && (
                    <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-[#059669]">
                      <Icon name="shield" size={12} /> Verified
                    </span>
                  )}
                  {listing.host.isRoomManager && (
                    <span className="text-[11px] font-bold text-[#4F46E5]">
                      · {t.roomManager}
                    </span>
                  )}
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {listing.host.responseTime} · {listing.host.listingsCount} active {listing.host.listingsCount === 1 ? 'listing' : 'listings'}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold">Neighborhood & Local Places</h3>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  `${listing.lat},${listing.lng}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-bold text-[#4F46E5] hover:underline"
              >
                Open area in Google Maps ↗
              </a>
            </div>

            <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
              <div className="relative h-48" style={{ backgroundColor: 'var(--map-bg)' }}>
                <div ref={detailMapRef} className="w-full h-full isolate z-0 sahi-street-map" />
                <div className="absolute bottom-2 left-2 right-2 z-10 px-3 py-1.5 rounded-xl bg-black/75 text-white text-[11px] flex items-center gap-1.5 backdrop-blur-sm pointer-events-none">
                  <Icon name="lock" size={13} />
                  <span>{t.privacyBanner}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              {(['All', 'Transit', 'Work/Study', 'Essentials'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setPlaceFilter(cat)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold border whitespace-nowrap ${
                    placeFilter === cat
                      ? 'bg-[#0F172A] text-white border-[#0F172A] dark:bg-[#4F46E5] dark:border-[#4F46E5]'
                      : ''
                  }`}
                  style={placeFilter !== cat ? { backgroundColor: 'var(--surface)', borderColor: 'var(--border)' } : {}}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {visiblePlaces.map((pl, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-2xl border flex items-center justify-between gap-2"
                  style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[#4F46E5]/12 text-[#4F46E5] flex items-center justify-center shrink-0">
                      <Icon name="pin" size={15} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate">{pl.name}</div>
                      <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{pl.category}</div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-extrabold">{pl.dist}</div>
                    <div className="text-[10px] font-semibold text-[#059669]">{pl.walk}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div
        className="absolute bottom-0 inset-x-0 p-3.5 border-t flex items-center gap-3"
        style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
      >
        <button
          type="button"
          onClick={() => onToggleSave(listing.id)}
          className="w-12 h-12 rounded-full border flex items-center justify-center shrink-0"
          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
          aria-label={isSaved ? 'Remove from saved listings' : 'Save listing'}
        >
          <Icon name={isSaved ? 'heartFilled' : 'heart'} />
        </button>
        <button
          type="button"
          onClick={() => onSendInquiry(listing, vibeAnalysis.icebreaker)}
          className="flex-1 h-12 rounded-full bg-[#4F46E5] text-white font-bold text-sm shadow-lg active:scale-[0.99] transition-transform"
        >
          {t.sendInquiry} · {vibeAnalysis.score}% Match
        </button>
      </div>
    </div>
  );
};
