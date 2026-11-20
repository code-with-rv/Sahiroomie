import L from 'leaflet';
import React, { useEffect, useRef, useState } from 'react';
import { CITIES_DATA, PG_PHOTOS, SAMPLE_PG_GALLERY } from '../data/seedData';
import type { GenderPref, Language, Listing, ListingType, UserProfile } from '../types/sahiroomie';
import { formatINR } from '../utils/compatibility';
import { MAP_TILE_ATTRIBUTIONS, MAP_TILE_URLS } from '../utils/mapClustering';
import { Icon } from './Icon';

interface PostListingWizardProps {
  onClose: () => void;
  onPublish: (listing: Listing) => void;
  userProfile: UserProfile;
  lang: Language;
  darkMode: boolean;
}

export const PostListingWizard: React.FC<PostListingWizardProps> = ({
  onClose,
  onPublish,
  userProfile,
  darkMode,
}) => {
  const initialCityMeta = CITIES_DATA.find((c) => c.id === userProfile.city) || CITIES_DATA[0];
  const [step, setStep] = useState(1);
  const [type, setType] = useState<ListingType>('Room in a flat');
  const [city, setCity] = useState(initialCityMeta.id);
  const [area, setArea] = useState(initialCityMeta.landmarks[0]);
  const [areaTouched, setAreaTouched] = useState(false);
  const [pinPos, setPinPos] = useState({ x: 34, y: 34 });
  const [latLng, setLatLng] = useState({ lat: initialCityMeta.lat, lng: initialCityMeta.lng });
  const wizardMapRef = useRef<HTMLDivElement | null>(null);
  const [rent, setRent] = useState('11500');
  const [deposit, setDeposit] = useState('25000');
  const [availableFrom, setAvailableFrom] = useState('2026-11-20');
  const [urgentDays, setUrgentDays] = useState(3);
  const [sizeSqFt, setSizeSqFt] = useState('160');
  const [furnishing, setFurnishing] = useState('Fully Furnished');
  const [attachedBath, setAttachedBath] = useState(true);
  const [balcony, setBalcony] = useState(true);
  const [parking, setParking] = useState('2-Wheeler');
  const [photos, setPhotos] = useState<string[]>([
    PG_PHOTOS.sunlitBedroom,
    PG_PHOTOS.attachedBathroom,
    PG_PHOTOS.studyDeskRoom,
  ]);
  const [prefGender, setPrefGender] = useState<GenderPref>('Any');
  const [smoking, setSmoking] = useState('No smoking');
  const [drinking, setDrinking] = useState('Occasional');
  const [pets, setPets] = useState('No pets');
  const [diet, setDiet] = useState('Veg / Egg');
  const [hygieneVerified, setHygieneVerified] = useState(true);
  const [title, setTitle] = useState(`Bright ${type} — ${area}, ${city}`);
  const [titleTouched, setTitleTouched] = useState(false);
  const [description, setDescription] = useState(
    'Well-ventilated room with attached washroom, high-speed Wi-Fi, and peaceful flatmates.'
  );
  const [houseRules, setHouseRules] = useState(
    'Keep common kitchen clean. No loud parties on weekdays.'
  );

  const totalSteps = 8;

  const handleCityChange = (newCity: string) => {
    setCity(newCity);
    const meta = CITIES_DATA.find((c) => c.id === newCity);
    if (meta) {
      setLatLng({ lat: meta.lat, lng: meta.lng });
      if (!areaTouched) {
        setArea(meta.landmarks[0]);
      }
    }
  };

  useEffect(() => {
    if (!titleTouched) {
      setTitle(`Bright ${type} — ${area}, ${city}`);
    }
  }, [type, area, city, titleTouched]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const urls = files.map((f) => URL.createObjectURL(f));
    setPhotos((prev) => [...prev, ...urls]);
  };

  const addSamplePhoto = () => {
    const pool = Object.values(PG_PHOTOS);
    const next = pool[photos.length % pool.length];
    setPhotos((prev) => [...prev, next]);
  };

  const movePhoto = (idx: number, dir: number) => {
    const target = idx + dir;
    if (target < 0 || target >= photos.length) return;
    const copy = [...photos];
    [copy[idx], copy[target]] = [copy[target], copy[idx]];
    setPhotos(copy);
  };

  useEffect(() => {
    if (step !== 2 || !wizardMapRef.current) return;
    const cityMeta = CITIES_DATA.find((c) => c.id === city) || CITIES_DATA[0];
    const initialCenter: [number, number] = [cityMeta.lat, cityMeta.lng];
    setLatLng({ lat: cityMeta.lat, lng: cityMeta.lng });

    const map = L.map(wizardMapRef.current, {
      center: initialCenter,
      zoom: 13,
      zoomControl: true,
      attributionControl: true,
    });
    map.attributionControl.setPrefix(false);

    L.tileLayer(MAP_TILE_URLS.street, {
      attribution: MAP_TILE_ATTRIBUTIONS.street,
      maxZoom: 18,
    }).addTo(map);

    const circle = L.circle(initialCenter, {
      color: '#4F46E5',
      weight: 2,
      dashArray: '5 4',
      fillColor: '#4F46E5',
      fillOpacity: 0.16,
      radius: 1000,
    }).addTo(map);

    const pinDot = L.circleMarker(initialCenter, {
      radius: 6,
      color: '#FFFFFF',
      weight: 2,
      fillColor: '#4F46E5',
      fillOpacity: 1,
    }).addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      const clicked = { lat: e.latlng.lat, lng: e.latlng.lng };
      setLatLng(clicked);
      circle.setLatLng(e.latlng);
      pinDot.setLatLng(e.latlng);
      map.panTo(e.latlng, { animate: true });
    });

    const timer = window.setTimeout(() => map.invalidateSize({ animate: false }), 180);

    return () => {
      window.clearTimeout(timer);
      map.remove();
    };
  }, [step, city]);

  const handleFinalPublish = () => {
    const cityMeta = CITIES_DATA.find((c) => c.id === city) || CITIES_DATA[0];
    const newListing: Listing = {
      id: 'lst-' + Date.now(),
      title: title.trim() || `${type} in ${area}`,
      titleHi: `${area}, ${cityMeta.hi} में ${type}`,
      titleKn: `${cityMeta.kn} (${area}) ನಲ್ಲಿ ${type}`,
      titleMr: `${area}, ${cityMeta.mr} येथे ${type}`,
      type,
      city,
      state: cityMeta.state,
      area,
      landmark: `Near ${cityMeta.landmarks[0]}`,
      rent: Math.max(1500, Number(rent) || 10000),
      deposit: Math.max(0, Number(deposit) || 20000),
      sizeSqFt: Math.max(60, Number(sizeSqFt) || 140),
      gender: prefGender,
      urgentDays: Number(urgentDays),
      countdownSeconds: Number(urgentDays) * 24 * 3600,
      distanceKm: 1.1,
      createdHoursAgo: 0,
      hygieneRating: hygieneVerified ? 4.9 : 4.4,
      hygieneVerified,
      furnishing,
      attachedBath,
      balcony,
      parking,
      moveInDate: availableFrom,
      lat: latLng.lat,
      lng: latLng.lng,
      pinX: pinPos.x,
      pinY: pinPos.y,
      existingRoommate: {
        name: userProfile.name,
        age: userProfile.age,
        roleTag: 'Verified Sahiroomie Host',
        sleepVibe: 'Flexible',
        socialBattery: 'Ambivert',
        cleanlinessVibe: hygieneVerified ? 'Pinterest Clean' : 'Organized Chaos',
        wfhNoise: 'Quiet WFH',
        vibeTags: ['Splitwise 50-50', 'Earphones After 11 PM'],
        expectations: description,
      },
      nearbyPlaces: [
        { name: `${cityMeta.landmarks[0]} Metro / Transit`, category: 'Transit', dist: '450 m', walk: '5 min walk' },
        { name: `${cityMeta.landmarks[3] || 'Tech Hub'}`, category: 'Work/Study', dist: '1.8 km', walk: '7 min auto' },
        { name: '24x7 Pharmacy & Supermarket', category: 'Essentials', dist: '250 m', walk: '3 min walk' },
      ],
      host: {
        userId: userProfile.userId,
        name: userProfile.name,
        role: type === 'PG' ? 'Room manager' : 'Host',
        isRoomManager: type === 'PG',
        verified: true,
        responseTime: 'Replies in 5 mins',
        listingsCount: 1,
        avatar: userProfile.name.slice(0, 2).toUpperCase(),
      },
      compatibility: {
        smoking,
        drinking,
        pets,
        diet,
        sleep: 'Flexible',
        wfh: 'Hybrid WFH',
        coupleFriendly: false,
      },
      description,
      houseRules,
      photos: photos.length >= 3 ? photos : SAMPLE_PG_GALLERY,
    };
    onPublish(newListing);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col modal-slide-up lg:max-w-2xl lg:mx-auto lg:my-4 lg:rounded-3xl lg:border lg:shadow-2xl overflow-hidden"
      style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
    >
      <div className="px-4 pt-3 pb-2 border-b space-y-2.5" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => (step > 1 ? setStep(step - 1) : onClose())}
            className="w-11 h-11 rounded-full flex items-center justify-center border"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
            aria-label={step > 1 ? 'Previous step' : 'Close wizard'}
          >
            <Icon name={step > 1 ? 'chevronLeft' : 'close'} size={18} />
          </button>
          <span className="text-xs font-extrabold tracking-wide">
            Step {step} of {totalSteps}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold px-3 py-2"
            style={{ color: 'var(--text-muted)' }}
          >
            Cancel
          </button>
        </div>
        <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'var(--surface)' }}>
          <div
            className="h-full bg-[#4F46E5] transition-all duration-300"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
        {step === 1 && (
          <div className="space-y-3">
            <h2 className="text-xl font-extrabold">What are you listing?</h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Choose the accommodation type so seekers find you faster.
            </p>
            {(
              [
                { id: 'Room in a flat', title: 'Room in a flat', desc: 'Private or shared bedroom in an existing flat' },
                { id: 'PG', title: 'PG Bed', desc: 'Paying Guest accommodation with meals or housekeeping' },
                { id: 'Flat', title: 'Full Flat / Roommate Search', desc: 'Looking for flatmates to rent a 1BHK/2BHK/3BHK together' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setType(opt.id)}
                className={`w-full p-4 rounded-2xl border text-left transition-all ${
                  type === opt.id ? 'border-[#4F46E5] ring-2 ring-[#4F46E5]/20' : ''
                }`}
                style={{
                  backgroundColor: 'var(--surface)',
                  borderColor: type === opt.id ? '#4F46E5' : 'var(--border)',
                }}
              >
                <div className="font-extrabold text-sm">{opt.title}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{opt.desc}</div>
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <h2 className="text-xl font-extrabold">Pin neighborhood location</h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Your exact house number is hidden inside a <strong>1 km privacy circle</strong> until a visit is scheduled.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={city}
                onChange={(e) => handleCityChange(e.target.value)}
                aria-label="City"
                className="h-11 px-3 rounded-2xl border text-xs font-bold outline-none"
                style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              >
                {CITIES_DATA.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <input
                type="text"
                value={area}
                aria-label="Area or Sector"
                onChange={(e) => {
                  setAreaTouched(true);
                  setArea(e.target.value);
                }}
                placeholder="Area / Sector"
                className="h-11 px-3 rounded-2xl border text-xs font-bold outline-none"
                style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
            </div>

            <div className="relative h-60 rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
              <div ref={wizardMapRef} className="w-full h-full isolate z-0 sahi-street-map" />
              <div className="absolute bottom-2 left-2 z-10 px-2.5 py-1 rounded-full bg-black/75 text-white text-[10px] font-semibold pointer-events-none">
                1 km Privacy Circle · Tap map to move ({latLng.lat.toFixed(4)}, {latLng.lng.toFixed(4)})
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-xl font-extrabold">Rent, deposit & urgency</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="wizard-rent" className="text-xs font-bold block mb-1">Monthly Rent (₹)</label>
                <input
                  id="wizard-rent"
                  type="number"
                  value={rent}
                  onChange={(e) => setRent(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-2xl border text-sm font-extrabold outline-none"
                  style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
                <span className="text-[11px] font-semibold text-[#4F46E5]">{formatINR(rent)}/mo</span>
              </div>
              <div>
                <label htmlFor="wizard-deposit" className="text-xs font-bold block mb-1">Security Deposit (₹)</label>
                <input
                  id="wizard-deposit"
                  type="number"
                  value={deposit}
                  onChange={(e) => setDeposit(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-2xl border text-sm font-extrabold outline-none"
                  style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{formatINR(deposit)}</span>
              </div>
            </div>

            <div>
              <label htmlFor="wizard-available" className="text-xs font-bold block mb-1">Available From</label>
              <input
                id="wizard-available"
                type="date"
                value={availableFrom}
                onChange={(e) => setAvailableFrom(e.target.value)}
                className="w-full h-11 px-3.5 rounded-2xl border text-sm font-semibold outline-none"
                style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
            </div>

            <div>
              <label className="text-xs font-bold block mb-1.5">Need to fill within (Urgency badge)</label>
              <div className="flex flex-wrap gap-2">
                {[1, 3, 6, 15, 30].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setUrgentDays(d)}
                    className={`px-4 py-2 rounded-full text-xs font-bold border ${
                      urgentDays === d ? 'bg-[#4F46E5] text-white border-[#4F46E5]' : ''
                    }`}
                    style={urgentDays !== d ? { backgroundColor: 'var(--surface)', borderColor: 'var(--border)' } : {}}
                  >
                    {d} {d === 1 ? 'day' : 'days'}
                  </button>
                ))}
              </div>
              {urgentDays <= 6 && (
                <p className="text-[11px] font-semibold text-[#059669] mt-1.5">
                  Featured in the Home “Urgent: moving in within 6 days” carousel!
                </p>
              )}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-xl font-extrabold">Room details & amenities</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold block mb-1">Room Size (sq ft)</label>
                <input
                  type="number"
                  value={sizeSqFt}
                  onChange={(e) => setSizeSqFt(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-2xl border text-sm font-bold outline-none"
                  style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">Furnishing</label>
                <select
                  value={furnishing}
                  onChange={(e) => setFurnishing(e.target.value)}
                  className="w-full h-11 px-3 rounded-2xl border text-xs font-bold outline-none"
                  style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                >
                  <option>Fully Furnished</option>
                  <option>Semi-Furnished</option>
                  <option>Unfurnished</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              {[
                { label: 'Attached Washroom', val: attachedBath, set: setAttachedBath },
                { label: 'Private / Shared Balcony', val: balcony, set: setBalcony },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => item.set(!item.val)}
                  className="w-full p-3.5 rounded-2xl border flex items-center justify-between"
                  style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  <span className="text-xs font-bold">{item.label}</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-extrabold ${item.val ? 'bg-[#059669] text-white' : 'bg-gray-300/40'}`}>
                    {item.val ? 'Yes' : 'No'}
                  </span>
                </button>
              ))}
            </div>

            <div>
              <label className="text-xs font-bold block mb-1.5">Parking</label>
              <div className="flex gap-2">
                {['None', '2-Wheeler', 'Car & Bike'].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setParking(p)}
                    className={`px-3.5 py-2 rounded-full text-xs font-bold border ${
                      parking === p ? 'bg-[#0F172A] text-white border-[#0F172A] dark:bg-[#4F46E5] dark:border-[#4F46E5]' : ''
                    }`}
                    style={parking !== p ? { backgroundColor: 'var(--surface)', borderColor: 'var(--border)' } : {}}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-extrabold">Room photos (min 3)</h2>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Upload real photos or add sample interiors. Reorder cover photo.
                </p>
              </div>
              <span className={`text-xs font-bold ${photos.length >= 3 ? 'text-[#059669]' : 'text-[#DC2626]'}`}>
                {photos.length}/3+
              </span>
            </div>

            <div className="flex gap-2">
              <label className="flex-1 h-11 rounded-2xl border border-dashed flex items-center justify-center gap-2 text-xs font-bold cursor-pointer" style={{ borderColor: '#4F46E5', color: '#4F46E5' }}>
                <Icon name="camera" size={16} /> Upload Camera / Gallery
                <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="hidden" />
              </label>
              <button
                type="button"
                onClick={addSamplePhoto}
                className="px-3.5 h-11 rounded-2xl border text-xs font-bold"
                style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                + Sample PG Photo
              </button>
            </div>

            {photos.length < 3 && (
              <p className="text-xs font-semibold text-[#DC2626]">
                Please include at least 3 room photos to continue.
              </p>
            )}

            <div className="space-y-2">
              {photos.map((src, idx) => (
                <div key={idx} className="p-2 rounded-2xl border flex items-center gap-3" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <img src={src} alt={`Room preview ${idx + 1}`} referrerPolicy="no-referrer" className="w-16 h-12 rounded-xl object-cover shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold">{idx === 0 ? 'Cover Photo' : `Photo #${idx + 1}`}</div>
                    <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Ready for listing</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => movePhoto(idx, -1)}
                      disabled={idx === 0}
                      aria-label={`Move photo ${idx + 1} up`}
                      className="w-8 h-8 text-xs font-bold rounded-lg border disabled:opacity-30"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => movePhoto(idx, 1)}
                      disabled={idx === photos.length - 1}
                      aria-label={`Move photo ${idx + 1} down`}
                      className="w-8 h-8 text-xs font-bold rounded-lg border disabled:opacity-30"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      ↓
                    </button>
                    {photos.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setPhotos(photos.filter((_, i) => i !== idx))}
                        className="w-8 h-8 flex items-center justify-center text-[#DC2626]"
                        aria-label={`Remove photo ${idx + 1}`}
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-4">
            <h2 className="text-xl font-extrabold">Compatibility & hygiene</h2>
            <div>
              <label className="text-xs font-bold block mb-1.5">Preferred Gender</label>
              <div className="flex flex-wrap gap-2">
                {(['Any', 'Male', 'Female', 'Other'] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setPrefGender(g)}
                    className={`px-3.5 py-2 rounded-full text-xs font-bold border ${prefGender === g ? 'bg-[#4F46E5] text-white border-[#4F46E5]' : ''}`}
                    style={prefGender !== g ? { backgroundColor: 'var(--surface)', borderColor: 'var(--border)' } : {}}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-xs font-bold block mb-1">Diet</label>
                <select value={diet} onChange={(e) => setDiet(e.target.value)} className="w-full h-11 px-3 rounded-2xl border text-xs font-bold" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                  <option>Veg / Egg</option>
                  <option>Pure Veg</option>
                  <option>Veg & Non-Veg</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">Smoking</label>
                <select value={smoking} onChange={(e) => setSmoking(e.target.value)} className="w-full h-11 px-3 rounded-2xl border text-xs font-bold" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                  <option>No smoking</option>
                  <option>Balcony only</option>
                  <option>Allowed</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">Drinking</label>
                <select value={drinking} onChange={(e) => setDrinking(e.target.value)} className="w-full h-11 px-3 rounded-2xl border text-xs font-bold" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                  <option>Occasional</option>
                  <option>No alcohol</option>
                  <option>Social</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">Pets</label>
                <select value={pets} onChange={(e) => setPets(e.target.value)} className="w-full h-11 px-3 rounded-2xl border text-xs font-bold" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                  <option>No pets</option>
                  <option>Pet friendly</option>
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setHygieneVerified(!hygieneVerified)}
              className="w-full p-3.5 rounded-2xl border flex items-center justify-between text-left"
              style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <div>
                <div className="text-xs font-bold">Commit to Hygiene Standard</div>
                <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Regular washroom & common-area cleaning schedule</div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-extrabold ${hygieneVerified ? 'bg-[#059669] text-white' : 'bg-gray-300/40'}`}>
                {hygieneVerified ? 'Enabled' : 'Off'}
              </span>
            </button>
          </div>
        )}

        {step === 7 && (
          <div className="space-y-3">
            <h2 className="text-xl font-extrabold">Description & house rules</h2>
            <div>
              <label className="text-xs font-bold block mb-1">Listing Headline</label>
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitleTouched(true);
                  setTitle(e.target.value);
                }}
                className="w-full h-11 px-3.5 rounded-2xl border text-xs font-bold outline-none"
                style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
            </div>
            <div>
              <label className="text-xs font-bold block mb-1">About the Room & Flatmates</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-3.5 rounded-2xl border text-xs leading-relaxed outline-none"
                style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
            </div>
            <div>
              <label className="text-xs font-bold block mb-1">House Rules</label>
              <textarea
                rows={2}
                value={houseRules}
                onChange={(e) => setHouseRules(e.target.value)}
                className="w-full p-3.5 rounded-2xl border text-xs leading-relaxed outline-none"
                style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
            </div>
          </div>
        )}

        {step === 8 && (
          <div className="space-y-4">
            <h2 className="text-xl font-extrabold">Preview & publish</h2>
            <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
              <img src={photos[0]} alt="Cover preview" referrerPolicy="no-referrer" className="w-full h-40 object-cover" />
              <div className="p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#4F46E5]">{type} · {prefGender}</span>
                  <span className="text-xs font-extrabold text-[#DC2626]">Fills in {urgentDays}d</span>
                </div>
                <div className="font-extrabold text-sm">{title}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {area}, {city} · {sizeSqFt} sq ft
                </div>
                <div className="text-base font-extrabold pt-1 font-mono-num">
                  {formatINR(rent)}/mo{' '}
                  <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
                    (Deposit {formatINR(deposit)})
                  </span>
                </div>
              </div>
            </div>
            <div className="p-3 rounded-2xl border text-xs flex items-start gap-2" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
              <Icon name="shield" size={16} className="text-[#059669] shrink-0 mt-0.5" />
              <span>Moderation note: Listings are automatically checked for duplicate photos, contact spam, and DPDP compliance.</span>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
        <button
          type="button"
          onClick={() => {
            if (step < totalSteps) {
              setStep(step + 1);
            } else {
              handleFinalPublish();
            }
          }}
          disabled={step === 5 && photos.length < 3}
          className="w-full h-12 rounded-full bg-[#4F46E5] text-white font-bold text-sm shadow-lg disabled:opacity-40"
        >
          {step < totalSteps ? 'Continue' : 'Publish Listing Live'}
        </button>
      </div>
    </div>
  );
};
