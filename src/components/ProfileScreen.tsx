import React, { useEffect, useState } from 'react';
import {
  CITIES_DATA,
  INDIAN_STATES_UTS,
  LANGUAGE_OPTIONS,
  TRANSLATIONS,
} from '../data/seedData';
import type {
  FinderGenZ,
  GenderPref,
  Language,
  Listing,
  ListingType,
  ModerationItem,
  RoomRequirement,
  UserProfile,
} from '../types/sahiroomie';
import { formatINR } from '../utils/compatibility';
import { resizeImageFileToDataUrl } from '../utils/imageResize';
import { Icon } from './Icon';
import { SahiroomieLogo } from './SahiroomieLogo';

interface ProfileScreenProps {
  userProfile: UserProfile;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  finderGenZ: FinderGenZ;
  listings: Listing[];
  savedIds: string[];
  myListingIds: string[];
  inquiredIds: string[];
  lang: Language;
  setLang: React.Dispatch<React.SetStateAction<Language>>;
  darkMode: boolean;
  setDarkMode: React.Dispatch<React.SetStateAction<boolean>>;
  moderationQueue: ModerationItem[];
  onBackHome: () => void;
  onOpenOnboarding: () => void;
  onConnectGoogle?: () => void;
  onSaveProfileToCloud?: () => void;
  onOpenFaq?: () => void;
  onOpenVibeStudio: () => void;
  onOpenIdVerify: () => void;
  onOpenPostWizard: () => void;
  onSelectListing: (id: string) => void;
  onOpenDpdpModal: () => void;
  onOpenAdminModal: () => void;
  onOpenDeleteConfirm: () => void;
  onLogout: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  userProfile,
  setUserProfile,
  finderGenZ,
  listings,
  savedIds,
  myListingIds,
  inquiredIds,
  lang,
  setLang,
  darkMode,
  setDarkMode,
  moderationQueue,
  onBackHome,
  onOpenOnboarding,
  onConnectGoogle,
  onSaveProfileToCloud,
  onOpenFaq,
  onOpenVibeStudio,
  onOpenIdVerify,
  onOpenPostWizard,
  onSelectListing,
  onOpenDpdpModal,
  onOpenAdminModal,
  onOpenDeleteConfirm,
  onLogout,
}) => {
  const t = TRANSLATIONS[lang];
  const [profileSubTab, setProfileSubTab] = useState<'saved' | 'my' | 'inquiries'>('saved');
  const [ageInput, setAgeInput] = useState(String(userProfile.age));
  const [ageError, setAgeError] = useState('');
  const [photoError, setPhotoError] = useState('');

  useEffect(() => {
    setAgeInput(String(userProfile.age));
  }, [userProfile.age]);

  const myPostedListings = listings.filter(
    (l) => myListingIds.includes(l.id) || l.host.userId === userProfile.userId
  );

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError('');
    try {
      const compressed = await resizeImageFileToDataUrl(file, 220);
      setUserProfile((p) => ({
        ...p,
        photoUrl: compressed,
        photoVerified: true,
      }));
    } catch (err: any) {
      setPhotoError(err?.message || 'Could not process image.');
    }
  };

  const updateRequirement = <K extends keyof RoomRequirement>(key: K, value: RoomRequirement[K]) => {
    setUserProfile((p) => ({
      ...p,
      roomRequirement: {
        ...p.roomRequirement,
        [key]: value,
      },
    }));
  };

  const displayName = userProfile.name.trim() || 'Fresh Member (Setup Incomplete)';
  const initials = (userProfile.name.trim() || 'SR').slice(0, 2).toUpperCase();
  const authBadgeLabel =
    userProfile.authProvider === 'google'
      ? 'Google Verified'
      : userProfile.authProvider === 'email'
        ? 'Email Profile'
        : 'Guest Session';

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="px-4 pt-4 pb-3 border-b flex items-center justify-between gap-2" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBackHome}
            className="w-11 h-11 rounded-full border flex items-center justify-center"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
            aria-label="Back to Home"
          >
            <Icon name="chevronLeft" size={18} />
          </button>
          <span className="lg:hidden">
            <SahiroomieLogo size="sm" />
          </span>
          <h1 className="hidden lg:block text-base font-extrabold">My Profile & Room Requirements</h1>
        </div>
        <button
          type="button"
          onClick={onOpenOnboarding}
          className="px-3.5 py-2 rounded-full text-xs font-bold border whitespace-nowrap"
          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          Sign In / Switch
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5 pb-24 no-scrollbar">
        {/* Identity & Personal Photo Header Card */}
        <div className="p-4 rounded-2xl border space-y-3" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3.5">
            <div className="relative w-16 h-16 rounded-full bg-[#0F172A] text-white font-extrabold text-lg flex items-center justify-center overflow-hidden border-2 border-[#4F46E5]/50 shrink-0">
              {userProfile.photoUrl ? (
                <img src={userProfile.photoUrl} alt={displayName} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
              ) : (
                <span>{initials}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-extrabold truncate">
                  {displayName}
                  {userProfile.privacyShowAge && userProfile.name ? `, ${userProfile.age}` : ''}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#059669]/15 text-[#059669]">
                  {authBadgeLabel}
                </span>
              </div>
              {userProfile.occupation && (
                <p className="text-xs font-semibold text-[#4F46E5] truncate">{userProfile.occupation}</p>
              )}
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {userProfile.city}, {userProfile.state}
              </p>
              {userProfile.email && (
                <p className="text-[11px] font-semibold mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                  {userProfile.email}
                </p>
              )}
            </div>
          </div>

          {userProfile.bio && (
            <p className="text-xs leading-relaxed p-2.5 rounded-xl border" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}>
              “{userProfile.bio}”
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <label className="px-3 py-1.5 rounded-full bg-[#4F46E5] text-white text-[11px] font-bold cursor-pointer">
              {userProfile.photoUrl ? 'Change Personal Photo' : 'Upload Personal Photo'}
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
                aria-label="Upload personal photo"
              />
            </label>
            {userProfile.authProvider !== 'google' && onConnectGoogle && (
              <button
                type="button"
                onClick={onConnectGoogle}
                className="px-3 py-1.5 rounded-full border text-[11px] font-bold"
                style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
              >
                Connect Google for Cloud Sync
              </button>
            )}
          </div>
          {photoError && <p className="text-[11px] font-bold text-[#DC2626]">{photoError}</p>}

          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-bold">
            {[
              { label: 'Google verified', ok: userProfile.authProvider === 'google' },
              { label: 'ID verified', ok: userProfile.idVerified },
              { label: 'Photo added', ok: Boolean(userProfile.photoUrl) || userProfile.photoVerified },
              { label: 'Room prefs set', ok: Boolean(userProfile.roomRequirement?.targetCity) },
            ].map((b) => (
              <span
                key={b.label}
                className={`inline-flex items-center gap-1 ${b.ok ? 'text-[#059669]' : 'opacity-60'}`}
              >
                <Icon name="shield" size={12} /> {b.label}
              </span>
            ))}
          </div>

          <div className="p-3 rounded-xl border space-y-2" style={{ backgroundColor: 'var(--bg)', borderColor: 'rgba(79, 70, 229, 0.35)' }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-[#4F46E5]">My Gen-Z Roommate Vibe</span>
              <button
                type="button"
                onClick={onOpenVibeStudio}
                className="text-xs font-bold underline text-[#4F46E5]"
              >
                Customize
              </button>
            </div>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {finderGenZ.sleepVibe} · {finderGenZ.socialBattery} · {finderGenZ.cleanlinessVibe}
            </p>
            {finderGenZ.customExpectation && (
              <p className="text-[11px] italic">“{finderGenZ.customExpectation}”</p>
            )}
          </div>

          <button
            type="button"
            onClick={onOpenIdVerify}
            className="w-full h-11 rounded-full border text-xs font-bold"
            style={{ borderColor: 'var(--border)' }}
          >
            Manage Govt ID / Aadhaar Masked KYC ({userProfile.kycBadgeToken})
          </button>
        </div>

        {/* My Room Requirement Card */}
        <div className="p-4 rounded-2xl border space-y-3" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold tracking-wide text-[#4F46E5]">
              MY ROOM REQUIREMENT
            </h3>
            <span className="text-[11px] font-extrabold font-mono-num">
              Up to {formatINR(userProfile.roomRequirement.maxRent)}/mo
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label htmlFor="prof-req-city" className="text-[11px] font-bold block mb-1">Target City</label>
              <select
                id="prof-req-city"
                value={userProfile.roomRequirement.targetCity}
                onChange={(e) => updateRequirement('targetCity', e.target.value)}
                className="w-full h-10 px-2.5 rounded-xl border text-xs font-bold outline-none"
                style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              >
                {CITIES_DATA.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="prof-req-area" className="text-[11px] font-bold block mb-1">Preferred Area</label>
              <input
                id="prof-req-area"
                type="text"
                placeholder="e.g. Koramangala"
                value={userProfile.roomRequirement.preferredArea}
                onChange={(e) => updateRequirement('preferredArea', e.target.value)}
                className="w-full h-10 px-3 rounded-xl border text-xs font-bold outline-none"
                style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
            </div>
            <div>
              <label htmlFor="prof-req-type" className="text-[11px] font-bold block mb-1">Stay Type</label>
              <select
                id="prof-req-type"
                value={userProfile.roomRequirement.listingType}
                onChange={(e) => updateRequirement('listingType', e.target.value as ListingType)}
                className="w-full h-10 px-2.5 rounded-xl border text-xs font-bold outline-none"
                style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              >
                <option value="Room in a flat">Room in a flat</option>
                <option value="PG">PG Bed</option>
                <option value="Flat">Full Shared Flat</option>
                <option value="Roommate">Roommate Search</option>
              </select>
            </div>
            <div>
              <label htmlFor="prof-req-timeline" className="text-[11px] font-bold block mb-1">Move-in Timeline</label>
              <select
                id="prof-req-timeline"
                value={userProfile.roomRequirement.moveInTimeline}
                onChange={(e) => updateRequirement('moveInTimeline', e.target.value as RoomRequirement['moveInTimeline'])}
                className="w-full h-10 px-2.5 rounded-xl border text-xs font-bold outline-none"
                style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              >
                <option value="Within 7 days">Within 7 days</option>
                <option value="This month">This month</option>
                <option value="Next month">Next month</option>
                <option value="Flexible">Flexible</option>
              </select>
            </div>
            <div>
              <label htmlFor="prof-req-budget" className="text-[11px] font-bold block mb-1">Max Rent (₹)</label>
              <input
                id="prof-req-budget"
                type="number"
                min={2000}
                max={100000}
                step={500}
                value={userProfile.roomRequirement.maxRent}
                onChange={(e) => updateRequirement('maxRent', Math.max(2000, Number(e.target.value) || 10000))}
                className="w-full h-10 px-3 rounded-xl border text-xs font-bold outline-none"
                style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
            </div>
            <div>
              <label htmlFor="prof-req-gender" className="text-[11px] font-bold block mb-1">Flatmate Pref</label>
              <select
                id="prof-req-gender"
                value={userProfile.roomRequirement.preferredGender}
                onChange={(e) => updateRequirement('preferredGender', e.target.value as GenderPref)}
                className="w-full h-10 px-2.5 rounded-xl border text-xs font-bold outline-none"
                style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              >
                <option value="Any">Any</option>
                <option value="Female">Women only</option>
                <option value="Male">Men only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Editable Personal Details */}
        <div className="p-4 rounded-2xl border space-y-3" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
          <h3 className="text-xs font-extrabold tracking-wide" style={{ color: 'var(--text-muted)' }}>
            Personal Details (Seeker & Host Account)
          </h3>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label htmlFor="profile-full-name" className="text-[11px] font-bold block mb-1">Full Name</label>
              <input
                id="profile-full-name"
                type="text"
                value={userProfile.name}
                placeholder="Your full name"
                onChange={(e) => setUserProfile((p) => ({ ...p, name: e.target.value }))}
                className="w-full h-10 px-3 rounded-xl border text-xs font-bold outline-none"
                style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
            </div>
            <div>
              <label htmlFor="profile-age" className="text-[11px] font-bold block mb-1">Age (18+)</label>
              <input
                id="profile-age"
                type="number"
                min={18}
                max={99}
                value={ageInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setAgeInput(val);
                  const n = Number(val);
                  if (!val || Number.isNaN(n) || n < 18) {
                    setAgeError('Must be 18+');
                  } else {
                    setAgeError('');
                    setUserProfile((p) => ({ ...p, age: Math.min(99, n) }));
                  }
                }}
                onBlur={() => {
                  const n = Number(ageInput);
                  if (!ageInput || Number.isNaN(n) || n < 18) {
                    setAgeInput(String(userProfile.age));
                    setAgeError('');
                  }
                }}
                className="w-full h-10 px-3 rounded-xl border text-xs font-bold outline-none"
                style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
              {ageError && <span className="text-[10px] font-bold text-[#DC2626]">{ageError}</span>}
            </div>
            <div className="col-span-2">
              <label htmlFor="profile-occupation" className="text-[11px] font-bold block mb-1">Occupation / College</label>
              <input
                id="profile-occupation"
                type="text"
                value={userProfile.occupation}
                placeholder="e.g. Product Engineer / MBA Student"
                onChange={(e) => setUserProfile((p) => ({ ...p, occupation: e.target.value }))}
                className="w-full h-10 px-3 rounded-xl border text-xs font-bold outline-none"
                style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
            </div>
            <div>
              <label htmlFor="profile-city" className="text-[11px] font-bold block mb-1">City</label>
              <input
                id="profile-city"
                type="text"
                value={userProfile.city}
                onChange={(e) => setUserProfile((p) => ({ ...p, city: e.target.value }))}
                className="w-full h-10 px-3 rounded-xl border text-xs font-bold outline-none"
                style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
            </div>
            <div>
              <label htmlFor="profile-state" className="text-[11px] font-bold block mb-1">State / UT</label>
              <select
                id="profile-state"
                value={userProfile.state}
                onChange={(e) => setUserProfile((p) => ({ ...p, state: e.target.value }))}
                className="w-full h-10 px-2.5 rounded-xl border text-xs font-bold outline-none"
                style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              >
                {INDIAN_STATES_UTS.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label htmlFor="profile-bio" className="text-[11px] font-bold block mb-1">Bio / Roommate Note</label>
              <textarea
                id="profile-bio"
                rows={2}
                value={userProfile.bio}
                placeholder="Share a quick intro for potential flatmates"
                onChange={(e) => setUserProfile((p) => ({ ...p, bio: e.target.value }))}
                className="w-full p-2.5 rounded-xl border text-xs font-medium outline-none resize-none"
                style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
            </div>
          </div>
              {onSaveProfileToCloud && (
            <button
              type="button"
              onClick={onSaveProfileToCloud}
              className="w-full h-11 rounded-full bg-[#4F46E5] text-white text-xs font-bold"
            >
              Save Profile & Requirements
            </button>
          )}
        </div>

        {/* Saved / My Listings / Inquiries Tabs */}
        <div className="space-y-2.5">
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl" style={{ backgroundColor: 'var(--surface)' }}>
            {(
              [
                { id: 'saved', label: `${t.savedListings} (${savedIds.length})` },
                { id: 'my', label: `${t.myListings} (${myPostedListings.length})` },
                { id: 'inquiries', label: `${t.appliedInquiries} (${inquiredIds.length})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setProfileSubTab(tab.id)}
                className={`py-2.5 rounded-xl text-xs font-extrabold transition-colors whitespace-nowrap ${
                  profileSubTab === tab.id ? 'bg-[#4F46E5] text-white' : ''
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {profileSubTab === 'saved' && (
            <div className="space-y-2">
              {listings.filter((l) => savedIds.includes(l.id)).map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => onSelectListing(l.id)}
                  className="w-full p-2.5 rounded-2xl border flex items-center gap-3 text-left"
                  style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  <img src={l.photos[0]} alt={l.title} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="w-16 h-14 rounded-xl object-cover shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-xs truncate">{l.title}</div>
                    <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {l.area}, {l.city}
                    </div>
                    <div className="text-xs font-extrabold text-[#4F46E5] mt-0.5 font-mono-num">
                      {formatINR(l.rent)}/mo
                    </div>
                  </div>
                </button>
              ))}
              {savedIds.length === 0 && (
                <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>
                  No saved rooms yet. Tap the heart icon on any listing to save it offline.
                </p>
              )}
            </div>
          )}

          {profileSubTab === 'my' && (
            <div className="space-y-2">
              {myPostedListings.length === 0 ? (
                <div className="p-4 rounded-2xl border text-center space-y-2" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    You haven’t posted a room or PG bed yet.
                  </p>
                  <button
                    type="button"
                    onClick={onOpenPostWizard}
                    className="px-4 py-2.5 rounded-full bg-[#4F46E5] text-white text-xs font-bold"
                  >
                    + Post a Listing
                  </button>
                </div>
              ) : (
                myPostedListings.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => onSelectListing(l.id)}
                    className="w-full p-2.5 rounded-2xl border flex items-center gap-3 text-left"
                    style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
                  >
                    <img src={l.photos[0]} alt={l.title} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="w-16 h-14 rounded-xl object-cover shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-xs truncate">{l.title}</div>
                      <div className="text-xs font-extrabold text-[#059669] mt-0.5 font-mono-num">
                        {formatINR(l.rent)}/mo · Active
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {profileSubTab === 'inquiries' && (
            <div className="space-y-2">
              {inquiredIds.length === 0 ? (
                <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>
                  No inquiries sent yet. Explore verified rooms to connect with hosts cleanly.
                </p>
              ) : (
                listings.filter((l) => inquiredIds.includes(l.id)).map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => onSelectListing(l.id)}
                    className="w-full p-3 rounded-2xl border flex items-center justify-between gap-2 text-left"
                    style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-xs truncate">{l.title}</div>
                      <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        Host: {l.host.name}
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-[#059669] shrink-0">
                      Inquiry Sent
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-extrabold tracking-wide" style={{ color: 'var(--text-muted)' }}>
            Settings & Compliance
          </h3>

          <div
            className="w-full p-3.5 rounded-2xl border space-y-2.5"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">{t.languageLabel}</span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[#4F46E5]/15 text-[#4F46E5]">
                {LANGUAGE_OPTIONS.find((item) => item.code === lang)?.nativeLabel || 'English'}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="radiogroup" aria-label={t.languageLabel}>
              {LANGUAGE_OPTIONS.map((option) => {
                const active = lang === option.code;
                return (
                  <button
                    key={option.code}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setLang(option.code)}
                    className={`px-3 py-2 rounded-xl border text-left transition-all flex items-center justify-between gap-1.5 ${
                      active
                        ? 'bg-[#4F46E5] text-white border-[#4F46E5] shadow-sm'
                        : 'hover:border-[#4F46E5]/50'
                    }`}
                    style={
                      !active
                        ? { backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }
                        : {}
                    }
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold truncate">{option.nativeLabel}</div>
                      <div
                        className={`text-[10px] font-semibold truncate ${
                          active ? 'text-white/85' : ''
                        }`}
                        style={!active ? { color: 'var(--text-muted)' } : {}}
                      >
                        {option.englishLabel}
                      </div>
                    </div>
                    {active && <Icon name="check" size={14} className="shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setDarkMode((d) => !d)}
            className="w-full p-3.5 rounded-2xl border flex items-center justify-between"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <span className="text-xs font-bold">{t.darkModeLabel}</span>
            <span className="text-xs font-extrabold text-[#4F46E5]">{darkMode ? 'ON' : 'OFF'}</span>
          </button>

          <button
            type="button"
            onClick={() => setUserProfile((p) => ({ ...p, privacyExactArea: !p.privacyExactArea }))}
            className="w-full p-3.5 rounded-2xl border flex items-center justify-between"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <span className="text-xs font-bold">Privacy: Show exact area before visit</span>
            <span className="text-xs font-extrabold">
              {userProfile.privacyExactArea ? 'ON' : 'OFF (1 km circle)'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setUserProfile((p) => ({ ...p, privacyShowAge: !p.privacyShowAge }))}
            className="w-full p-3.5 rounded-2xl border flex items-center justify-between"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <span className="text-xs font-bold">Privacy: Show my age on profile</span>
            <span className="text-xs font-extrabold">{userProfile.privacyShowAge ? 'Visible' : 'Hidden'}</span>
          </button>

          {onOpenFaq && (
            <button
              type="button"
              onClick={onOpenFaq}
              className="w-full p-3.5 rounded-2xl border flex items-center justify-between"
              style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <span className="text-xs font-bold">Roommate Safety & City Guides (FAQ)</span>
              <Icon name="chevronRight" size={16} />
            </button>
          )}

          <button
            type="button"
            onClick={onOpenDpdpModal}
            className="w-full p-3.5 rounded-2xl border flex items-center justify-between"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <span className="text-xs font-bold">{t.dpdpPrivacy}</span>
            <Icon name="chevronRight" size={16} />
          </button>

          <button
            type="button"
            onClick={onOpenAdminModal}
            className="w-full p-3.5 rounded-2xl border flex items-center justify-between"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <span className="text-xs font-bold">{t.adminPanel}</span>
            <span className="text-xs font-extrabold text-[#4F46E5]">
              {moderationQueue.filter((m) => m.status === 'Pending').length} pending
            </span>
          </button>

          <div className="pt-2 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onLogout}
              className="h-11 rounded-full border text-xs font-bold"
              style={{ borderColor: 'var(--border)' }}
            >
              {t.logout}
            </button>
            <button
              type="button"
              onClick={onOpenDeleteConfirm}
              className="h-11 rounded-full bg-[#DC2626]/12 text-[#DC2626] text-xs font-bold"
            >
              {t.deleteAccount}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
