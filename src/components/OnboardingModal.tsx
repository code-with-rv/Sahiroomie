import React, { useState } from 'react';
import { CITIES_DATA, GENZ_VIBE_TAGS, INDIAN_STATES_UTS } from '../data/seedData';
import type { FinderGenZ, GenderPref, ListingType, RoomRequirement, UserProfile } from '../types/sahiroomie';
import { formatINR, validateEmail } from '../utils/compatibility';
import { resizeImageFileToDataUrl } from '../utils/imageResize';
import { Icon } from './Icon';
import { SahiroomieLogo } from './SahiroomieLogo';

export interface OnboardingCompletePayload {
  profileUpdates: Partial<UserProfile>;
  finderUpdates: Partial<FinderGenZ>;
  firebaseUid?: string;
}

interface OnboardingModalProps {
  initialProfile: UserProfile;
  initialFinder: FinderGenZ;
  onComplete: (payload: OnboardingCompletePayload) => void;
  onBrowseAsGuest: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  initialProfile,
  initialFinder,
  onComplete,
  onBrowseAsGuest,
}) => {
  const [phase, setPhase] = useState<'auth' | 'profile' | 'requirement'>('auth');
  const [authProvider, setAuthProvider] = useState<'google' | 'email' | 'guest'>(
    initialProfile.authProvider || 'guest'
  );
  const [firebaseUid, setFirebaseUid] = useState<string | undefined>(undefined);
  const [emailInput, setEmailInput] = useState(initialProfile.email || '');
  const [verifiedEmail, setVerifiedEmail] = useState(initialProfile.email || '');
  const [emailVerified, setEmailVerified] = useState(Boolean(initialProfile.emailVerified));
  const [submitting, setSubmitting] = useState(false);

  // Step 2: Fresh Personal Photo & Details (no pre-seeded dummy name)
  const [photoUrl, setPhotoUrl] = useState(initialProfile.photoUrl || '');
  const [name, setName] = useState(initialProfile.onboardingCompleted ? initialProfile.name : '');
  const [age, setAge] = useState(initialProfile.onboardingCompleted ? String(initialProfile.age) : '22');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>(initialProfile.gender || 'Male');
  const [occupation, setOccupation] = useState(initialProfile.occupation || '');
  const [bio, setBio] = useState(initialProfile.bio || '');
  const [city, setCity] = useState(initialProfile.city || 'Bengaluru');
  const [stateUt, setStateUt] = useState(initialProfile.state || 'Karnataka');

  // Step 3: Room Requirement & Vibe
  const [reqCity, setReqCity] = useState(initialProfile.roomRequirement?.targetCity || city || 'Bengaluru');
  const [reqArea, setReqArea] = useState(initialProfile.roomRequirement?.preferredArea || '');
  const [reqType, setReqType] = useState<ListingType>(
    initialProfile.roomRequirement?.listingType || 'Room in a flat'
  );
  const [reqMaxRent, setReqMaxRent] = useState<number>(
    initialProfile.roomRequirement?.maxRent || 15000
  );
  const [reqTimeline, setReqTimeline] = useState<RoomRequirement['moveInTimeline']>(
    initialProfile.roomRequirement?.moveInTimeline || 'This month'
  );
  const [reqGender, setReqGender] = useState<GenderPref>(
    initialProfile.roomRequirement?.preferredGender || 'Any'
  );
  const [sleepVibe, setSleepVibe] = useState<FinderGenZ['sleepVibe']>(initialFinder.sleepVibe || 'Early Bird');
  const [cleanlinessVibe, setCleanlinessVibe] = useState<FinderGenZ['cleanlinessVibe']>(
    initialFinder.cleanlinessVibe || 'Pinterest Clean'
  );
  const [vibeTags, setVibeTags] = useState<string[]>(
    initialFinder.vibeTags?.length ? initialFinder.vibeTags : ['Splitwise 50-50', 'WFH Zoom Quiet Hours']
  );

  const [err, setErr] = useState('');

  const handleGoogleSignIn = async () => {
    setErr('');
    setSubmitting(true);
    try {
      const { loadUserProfileFromFirestore, signInWithGoogle } = await import('../lib/firebase');
      const user = await signInWithGoogle();
      setAuthProvider('google');
      setFirebaseUid(user.uid);
      setVerifiedEmail(user.email || '');
      setEmailVerified(Boolean(user.emailVerified));

      // Check if returning user already completed setup in Firestore
      try {
        const remote = await loadUserProfileFromFirestore(user.uid);
        if (remote?.profileUpdates?.onboardingCompleted && remote.profileUpdates.name) {
          onComplete({
            profileUpdates: {
              ...remote.profileUpdates,
              authProvider: 'google',
              email: user.email || remote.profileUpdates.email || '',
              emailVerified: Boolean(user.emailVerified),
              onboardingCompleted: true,
            },
            finderUpdates: remote.finderUpdates || {},
            firebaseUid: user.uid,
          });
          return;
        }
      } catch {
        // Proceed cleanly to fresh profile setup if Firestore doc doesn't exist yet
      }

      if (user.displayName && !name) setName(user.displayName);
      if (user.photoURL && !photoUrl) setPhotoUrl(user.photoURL);
      setPhase('profile');
    } catch (authErr: any) {
      const code = authErr?.code || '';
      if (code === 'auth/popup-closed-by-user') {
        setErr('Google sign-in popup was closed. Please try again or continue with your email below.');
      } else {
        setErr(authErr?.message || 'Google sign-in could not be completed. Continue with your email below.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleContinueWithEmail = () => {
    const cleaned = validateEmail(emailInput);
    if (!cleaned) {
      setErr('Enter a valid email address (e.g. name@gmail.com).');
      return;
    }
    setErr('');
    setVerifiedEmail(cleaned);
    setEmailVerified(false);
    setAuthProvider('email');
    setPhase('profile');
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr('');
    try {
      const compressed = await resizeImageFileToDataUrl(file, 220);
      setPhotoUrl(compressed);
    } catch (uploadErr: any) {
      setErr(uploadErr?.message || 'Failed to process photo.');
    }
  };

  const handleContinueToRequirement = () => {
    const numericAge = Number(age);
    if (!name.trim() || name.trim().length < 2) {
      setErr('Please enter your full name (at least 2 characters).');
      return;
    }
    if (Number.isNaN(numericAge) || numericAge < 18 || numericAge > 99) {
      setErr('You must be 18+ years old to join Sahiroomie.');
      return;
    }
    setErr('');
    if (!reqCity.trim()) setReqCity(city || 'Bengaluru');
    setPhase('requirement');
  };

  const handleFinishSetup = async () => {
    const numericAge = Math.max(18, Math.min(99, Number(age) || 22));
    const roomRequirement: RoomRequirement = {
      targetCity: reqCity.trim() || city.trim() || 'Bengaluru',
      preferredArea: reqArea.trim(),
      listingType: reqType,
      maxRent: reqMaxRent,
      moveInTimeline: reqTimeline,
      preferredGender: reqGender,
    };

    const finderUpdates: Partial<FinderGenZ> = {
      sleepVibe,
      cleanlinessVibe,
      vibeTags,
      customExpectation: bio.trim() || initialFinder.customExpectation,
    };

    const resolvedEmail = verifiedEmail || validateEmail(emailInput) || emailInput.trim();
    const handleSlug = resolvedEmail
      ? resolvedEmail.split('@')[0].replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase() || 'MEM'
      : 'MEM';
    const generatedId =
      firebaseUid ||
      (initialProfile.userId && initialProfile.userId !== 'USR-GUEST'
        ? initialProfile.userId
        : `USR-${handleSlug}-${Date.now().toString().slice(-3)}`);

    onComplete({
      profileUpdates: {
        userId: generatedId,
        name: name.trim(),
        age: numericAge,
        gender,
        occupation: occupation.trim(),
        bio: bio.trim(),
        photoUrl,
        phone: '',
        email: resolvedEmail,
        city: city.trim() || roomRequirement.targetCity,
        state: stateUt,
        authProvider,
        phoneVerified: false,
        emailVerified,
        photoVerified: Boolean(photoUrl),
        onboardingCompleted: true,
        roomRequirement,
      },
      finderUpdates,
      firebaseUid,
    });
  };

  const stepIndex = phase === 'auth' ? 1 : phase === 'profile' ? 2 : 3;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-between p-5 modal-slide-up lg:max-w-lg lg:mx-auto lg:my-4 lg:rounded-3xl lg:border lg:shadow-2xl overflow-hidden"
      style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between pt-1 shrink-0">
        <SahiroomieLogo size="md" />
        <button
          type="button"
          onClick={onBrowseAsGuest}
          className="px-3 py-1.5 rounded-full text-xs font-bold border"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
        >
          Browse stays first
        </button>
      </div>

      {/* Step Progress Bar */}
      <div className="pt-3 pb-1 shrink-0">
        <div className="flex items-center justify-between text-[11px] font-bold mb-1.5" style={{ color: 'var(--text-muted)' }}>
          <span>Step {stepIndex} of 3</span>
          <span>
            {stepIndex === 1 ? 'Sign In' : stepIndex === 2 ? 'Photo & Personal Info' : 'Room Requirement'}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'var(--surface)' }}>
          <div
            className="h-full bg-[#4F46E5] transition-all duration-300"
            style={{ width: `${(stepIndex / 3) * 100}%` }}
          />
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto no-scrollbar py-3 space-y-4">
        {phase === 'auth' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="text-[11px] font-extrabold tracking-wider text-[#4F46E5]">
                ZERO BROKERAGE · 1 KM ADDRESS PRIVACY
              </div>
              <h1 className="text-2xl font-extrabold leading-tight">
                Sign in & set up your roommate profile
              </h1>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Verified accounts help hosts trust your inquiry. Fresh accounts start clean with zero fake messages.
              </p>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={submitting}
              className="w-full h-12 rounded-2xl border font-extrabold text-sm flex items-center justify-center gap-2.5 transition-transform active:scale-[0.99] disabled:opacity-60"
              style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <span className="w-5 h-5 rounded-full bg-white text-[#0F172A] font-black text-xs flex items-center justify-center border border-black/10">
                G
              </span>
              {submitting ? 'Connecting Google...' : 'Continue with Google'}
            </button>

            <div className="flex items-center gap-3 text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>
              <span className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
              <span>OR CONTINUE WITH EMAIL</span>
              <span className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
            </div>

            <div className="space-y-2.5">
              <label htmlFor="onboard-email" className="text-xs font-bold block">
                Email Address
              </label>
              <div
                className="flex items-center gap-2 p-3 rounded-2xl border"
                style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                <span className="font-bold text-xs px-2 border-r" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                  @
                </span>
                <input
                  id="onboard-email"
                  type="email"
                  autoComplete="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleContinueWithEmail()}
                  placeholder="yourname@gmail.com"
                  className="bg-transparent flex-1 text-sm font-bold outline-none"
                />
              </div>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                Enter your email to set up a clean roommate profile directly—no OTP code needed.
              </p>
              <button
                type="button"
                onClick={handleContinueWithEmail}
                className="w-full h-12 rounded-full bg-[#4F46E5] text-white font-bold text-sm shadow-lg"
              >
                Continue to Profile Setup →
              </button>
            </div>
          </div>
        )}

        {phase === 'profile' && (
          <div className="space-y-3.5">
            <div>
              <h2 className="text-xl font-extrabold">Add personal photo & details</h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Flatmates reply faster to profiles with a clear photo and occupation.
              </p>
            </div>

            {/* Personal Photo Uploader */}
            <div
              className="p-3 rounded-2xl border flex items-center gap-3.5"
              style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <div className="w-16 h-16 rounded-full overflow-hidden bg-[#0F172A] text-white font-extrabold text-lg flex items-center justify-center shrink-0 border-2 border-[#4F46E5]/40">
                {photoUrl ? (
                  <img src={photoUrl} alt="Your profile preview" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                ) : (
                  <span>{(name.trim() || 'YOU').slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="text-xs font-extrabold">Personal Profile Photo</div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="px-3 py-1.5 rounded-full bg-[#4F46E5] text-white text-[11px] font-bold cursor-pointer">
                    {photoUrl ? 'Change Photo' : 'Upload Photo'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                      aria-label="Upload personal photo"
                    />
                  </label>
                  {photoUrl && (
                    <button
                      type="button"
                      onClick={() => setPhotoUrl('')}
                      className="text-[11px] font-bold"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              <div>
                <label htmlFor="setup-full-name" className="text-xs font-bold block mb-1">
                  Full Name *
                </label>
                <input
                  id="setup-full-name"
                  type="text"
                  value={name}
                  placeholder="Enter your full name"
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-2xl border text-sm font-medium outline-none"
                  style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="setup-age" className="text-xs font-bold block mb-1">
                    Age (18+) *
                  </label>
                  <input
                    id="setup-age"
                    type="number"
                    min={18}
                    max={99}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-2xl border text-sm font-medium outline-none"
                    style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label htmlFor="setup-gender" className="text-xs font-bold block mb-1">
                    Gender
                  </label>
                  <select
                    id="setup-gender"
                    value={gender}
                    onChange={(e) => setGender(e.target.value as 'Male' | 'Female' | 'Other')}
                    className="w-full h-11 px-3 rounded-2xl border text-sm font-medium outline-none"
                    style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="setup-occupation" className="text-xs font-bold block mb-1">
                  Occupation / College
                </label>
                <input
                  id="setup-occupation"
                  type="text"
                  value={occupation}
                  placeholder="e.g. Software Engineer, B.Tech Student"
                  onChange={(e) => setOccupation(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-2xl border text-sm font-medium outline-none"
                  style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="setup-city" className="text-xs font-bold block mb-1">
                    Current City
                  </label>
                  <input
                    id="setup-city"
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-2xl border text-sm font-medium outline-none"
                    style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label htmlFor="setup-state" className="text-xs font-bold block mb-1">
                    State / UT
                  </label>
                  <select
                    id="setup-state"
                    value={stateUt}
                    onChange={(e) => setStateUt(e.target.value)}
                    className="w-full h-11 px-2.5 rounded-2xl border text-xs font-medium outline-none"
                    style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  >
                    {INDIAN_STATES_UTS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="setup-bio" className="text-xs font-bold block mb-1">
                  Short Intro / Living Habits
                </label>
                <textarea
                  id="setup-bio"
                  rows={2}
                  value={bio}
                  placeholder="e.g. Non-smoker, WFH 3 days/week, likes cooking and Splitwise bills"
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full p-3 rounded-2xl border text-xs font-medium outline-none resize-none"
                  style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
            </div>
          </div>
        )}

        {phase === 'requirement' && (
          <div className="space-y-3.5">
            <button
              type="button"
              onClick={() => {
                setErr('');
                setPhase('profile');
              }}
              className="text-xs font-bold text-[#4F46E5] flex items-center gap-1"
            >
              <Icon name="chevronLeft" size={14} /> Edit personal details
            </button>

            <div>
              <h2 className="text-xl font-extrabold">Set your room requirement</h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                We’ll tailor map results and AI compatibility scores to your exact move-in criteria.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="req-city" className="text-xs font-bold block mb-1">
                  Target City
                </label>
                <select
                  id="req-city"
                  value={reqCity}
                  onChange={(e) => setReqCity(e.target.value)}
                  className="w-full h-11 px-3 rounded-2xl border text-xs font-bold outline-none"
                  style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                >
                  {CITIES_DATA.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="req-area" className="text-xs font-bold block mb-1">
                  Preferred Locality
                </label>
                <input
                  id="req-area"
                  type="text"
                  value={reqArea}
                  placeholder="e.g. Indiranagar, Powai"
                  onChange={(e) => setReqArea(e.target.value)}
                  className="w-full h-11 px-3 rounded-2xl border text-xs font-medium outline-none"
                  style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="req-type" className="text-xs font-bold block mb-1">
                  Stay Type
                </label>
                <select
                  id="req-type"
                  value={reqType}
                  onChange={(e) => setReqType(e.target.value as ListingType)}
                  className="w-full h-11 px-3 rounded-2xl border text-xs font-bold outline-none"
                  style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                >
                  <option value="Room in a flat">Room in a flat</option>
                  <option value="PG">PG Bed</option>
                  <option value="Flat">Full Shared Flat</option>
                  <option value="Roommate">Roommate Search</option>
                </select>
              </div>
              <div>
                <label htmlFor="req-timeline" className="text-xs font-bold block mb-1">
                  Move-in Timeline
                </label>
                <select
                  id="req-timeline"
                  value={reqTimeline}
                  onChange={(e) => setReqTimeline(e.target.value as RoomRequirement['moveInTimeline'])}
                  className="w-full h-11 px-3 rounded-2xl border text-xs font-bold outline-none"
                  style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                >
                  <option value="Within 7 days">Within 7 days</option>
                  <option value="This month">This month</option>
                  <option value="Next month">Next month</option>
                  <option value="Flexible">Flexible</option>
                </select>
              </div>
            </div>

            <div
              className="p-3.5 rounded-2xl border space-y-2"
              style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center justify-between text-xs font-bold">
                <span>Max Monthly Rent Budget</span>
                <span className="text-[#4F46E5] font-extrabold font-mono-num">
                  {formatINR(reqMaxRent)}/mo
                </span>
              </div>
              <input
                type="range"
                min={4000}
                max={35000}
                step={500}
                aria-label="Maximum monthly rent budget"
                value={reqMaxRent}
                onChange={(e) => setReqMaxRent(Number(e.target.value))}
                className="w-full sahi-range"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="req-gender" className="text-xs font-bold block mb-1">
                  Flatmate Preference
                </label>
                <select
                  id="req-gender"
                  value={reqGender}
                  onChange={(e) => setReqGender(e.target.value as GenderPref)}
                  className="w-full h-11 px-3 rounded-2xl border text-xs font-bold outline-none"
                  style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                >
                  <option value="Any">Any</option>
                  <option value="Female">Women only</option>
                  <option value="Male">Men only</option>
                </select>
              </div>
              <div>
                <label htmlFor="req-sleep" className="text-xs font-bold block mb-1">
                  Sleep Vibe
                </label>
                <select
                  id="req-sleep"
                  value={sleepVibe}
                  onChange={(e) => setSleepVibe(e.target.value as FinderGenZ['sleepVibe'])}
                  className="w-full h-11 px-3 rounded-2xl border text-xs font-bold outline-none"
                  style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                >
                  <option value="Early Bird">Early Bird</option>
                  <option value="Night Owl">Night Owl</option>
                  <option value="Flexible">Flexible</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-bold">Cleanliness & Top Lifestyle Rules</div>
              <div className="flex gap-2">
                {(['Pinterest Clean', 'Organized Chaos'] as const).map((cv) => (
                  <button
                    key={cv}
                    type="button"
                    onClick={() => setCleanlinessVibe(cv)}
                    className={`flex-1 py-2 rounded-xl border text-xs font-bold ${
                      cleanlinessVibe === cv ? 'bg-[#4F46E5] text-white border-[#4F46E5]' : ''
                    }`}
                    style={
                      cleanlinessVibe !== cv
                        ? { backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }
                        : {}
                    }
                  >
                    {cv}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {GENZ_VIBE_TAGS.slice(0, 6).map((tag) => {
                  const active = vibeTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() =>
                        setVibeTags((prev) =>
                          prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]
                        )
                      }
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                        active ? 'bg-[#4F46E5]/15 text-[#4F46E5] border-[#4F46E5]' : ''
                      }`}
                      style={!active ? { backgroundColor: 'var(--surface)', borderColor: 'var(--border)' } : {}}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {err && (
          <div className="p-3 rounded-xl bg-[#DC2626]/10 border border-[#DC2626]/30 text-xs font-bold text-[#DC2626]">
            {err}
          </div>
        )}
      </div>

      {/* Bottom Action Footer */}
      <div className="pt-2 shrink-0">
        {phase === 'profile' && (
          <button
            type="button"
            onClick={handleContinueToRequirement}
            className="w-full h-12 rounded-full bg-[#4F46E5] text-white font-bold text-sm shadow-lg"
          >
            Next: Room Requirement →
          </button>
        )}
        {phase === 'requirement' && (
          <button
            type="button"
            onClick={handleFinishSetup}
            disabled={submitting}
            className="w-full h-12 rounded-full bg-[#4F46E5] text-white font-bold text-sm shadow-lg disabled:opacity-50"
          >
            {submitting ? 'Saving verified profile...' : 'Save & Explore Matching Stays'}
          </button>
        )}
      </div>
    </div>
  );
};
