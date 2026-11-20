import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatINR,
  formatCompactINR,
  formatCountdown,
  validateIndianPhone,
  validateEmail,
  validateAadhaarVerhoeff,
  validatePan,
  maskGovernmentId,
  projectAllIndiaPin,
  computeGenZCompatibility,
  filterAndSortListings,
  hasScamKeyword,
} from './compatibility';
import {
  INITIAL_LISTINGS,
  LANGUAGE_OPTIONS,
  TRANSLATIONS,
  getLocalizedCityLabel,
  getLocalizedListingTitle,
} from '../data/seedData';
import { buildZipArchive, collectProjectEntries } from './projectZip';
import type { FinderGenZ, Listing } from '../types/sahiroomie';

const sampleListing: Listing = {
  id: 'lst-test-1',
  title: 'Sunlit Master Room',
  type: 'Room in a flat',
  city: 'Bengaluru',
  state: 'Karnataka',
  area: 'Koramangala',
  landmark: 'Sony World',
  rent: 14500,
  deposit: 40000,
  sizeSqFt: 185,
  gender: 'Female',
  urgentDays: 2,
  countdownSeconds: 90000,
  distanceKm: 1.5,
  createdHoursAgo: 4,
  hygieneRating: 4.9,
  hygieneVerified: true,
  furnishing: 'Fully Furnished',
  attachedBath: true,
  balcony: true,
  parking: '2-Wheeler',
  moveInDate: '2026-11-16',
  lat: 12.9352,
  lng: 77.6245,
  pinX: 56,
  pinY: 44,
  existingRoommate: {
    name: 'Ananya Rao',
    age: 24,
    roleTag: 'Product Designer',
    sleepVibe: 'Early Bird',
    socialBattery: 'Ambivert',
    cleanlinessVibe: 'Pinterest Clean',
    wfhNoise: 'Quiet WFH',
    vibeTags: ['Splitwise 50-50', 'Earphones After 11 PM'],
    expectations: 'Hygienic flatmate who respects WFH calls',
  },
  nearbyPlaces: [],
  host: {
    name: 'Ananya Rao',
    role: 'Flatmate',
    isRoomManager: false,
    verified: true,
    responseTime: 'Replies in 8 mins',
    listingsCount: 1,
    avatar: 'AR',
  },
  compatibility: {
    smoking: 'No smoking',
    drinking: 'Occasional',
    pets: 'No pets',
    diet: 'Veg / Egg',
    sleep: 'Early bird',
    wfh: 'Hybrid WFH',
    coupleFriendly: false,
  },
  description: 'Spacious corner room',
  houseRules: 'No loud music after 10:30 PM',
  photos: ['/images/rooms/sunlit-bedroom.svg'],
};

test('INR formatting follows Indian grouping', () => {
  assert.equal(formatINR(125000), '₹1,25,000');
  assert.equal(formatINR(8500), '₹8,500');
  assert.equal(formatCompactINR(8500), '₹8.5k');
  assert.equal(formatCompactINR(125000), '₹1.25L');
});

test('Countdown formats days, hours, minutes accurately', () => {
  assert.equal(formatCountdown(90060), '1d 1h 1m');
  assert.equal(formatCountdown(-10), '0d 0h 0m');
});

test('Indian phone validation accepts valid 10-digit numbers starting 6-9', () => {
  assert.equal(validateIndianPhone('9876543210'), '9876543210');
  assert.equal(validateIndianPhone('1234567890'), null);
  assert.equal(validateIndianPhone('98765'), null);
});

test('Email validation normalizes valid emails and rejects invalid ones', () => {
  assert.equal(validateEmail('  Priya.Nair@Example.COM '), 'priya.nair@example.com');
  assert.equal(validateEmail('bad-email'), null);
  assert.equal(validateEmail('user@domain'), null);
});

test('Aadhaar Verhoeff checksum and PAN validation work correctly', () => {
  // 234567890125 is invalid or valid depending on Verhoeff digit; let's verify known valid/invalid
  // 200000000008 -> let's test PAN and masking and Verhoeff behavior
  assert.equal(validatePan('ABCDE1234F'), true);
  assert.equal(validatePan('12345ABCDE'), false);
  assert.equal(maskGovernmentId('AADHAAR', '234567890125'), 'XXXX-XXXX-0125');
  assert.equal(maskGovernmentId('PAN', 'ABCDE1234F'), 'ABCDE****F');
  assert.equal(validateAadhaarVerhoeff('123456789012'), false); // starts with 1
  // 999999990019 is a standard valid Verhoeff test Aadhaar number
  assert.equal(validateAadhaarVerhoeff('999999990019'), true);
  assert.equal(validateAadhaarVerhoeff('999999990018'), false);
});

test('All-India lat/lng projection separates Delhi and Bengaluru coordinates', () => {
  const blr = projectAllIndiaPin(12.97, 77.59);
  const del = projectAllIndiaPin(28.54, 77.20);
  assert.ok(del.y < blr.y, 'Delhi must appear north (smaller y) of Bengaluru');
});

test('Gen-Z compatibility engine scores aligned profiles higher than mismatched ones', () => {
  const aligned: FinderGenZ = {
    sleepVibe: 'Early Bird',
    socialBattery: 'Ambivert',
    cleanlinessVibe: 'Pinterest Clean',
    vibeTags: ['Splitwise 50-50', 'Earphones After 11 PM'],
    customExpectation: 'Need quiet WFH and Splitwise bills',
  };
  const mismatched: FinderGenZ = {
    sleepVibe: 'Night Owl',
    socialBattery: 'Extrovert',
    cleanlinessVibe: 'Organized Chaos',
    vibeTags: [],
    customExpectation: '',
  };
  const high = computeGenZCompatibility(aligned, sampleListing);
  const low = computeGenZCompatibility(mismatched, sampleListing);
  assert.ok(high.score > low.score);
  assert.ok(high.score >= 90);
});

test('Filter and sort respects radius, hygiene, and scam keyword detector', () => {
  const lst2: Listing = {
    ...sampleListing,
    id: 'lst-test-2',
    city: 'Mumbai',
    rent: 7500,
    distanceKm: 12,
    hygieneVerified: false,
  };
  const res = filterAndSortListings([sampleListing, lst2], {
    searchQuery: '',
    radiusKm: 5,
    filters: {
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
    },
    sortBy: 'nearest',
    userGender: 'Female',
  });
  assert.equal(res.length, 1);
  assert.equal(res[0].id, 'lst-test-1');
  assert.equal(hasScamKeyword('Please pay UPI advance deposit now'), true);
  assert.equal(hasScamKeyword('What time can I visit today?'), false);
});

test('Multi-language support includes English, Hindi, Kannada, and Marathi with full key parity', () => {
  const codes = LANGUAGE_OPTIONS.map((o) => o.code);
  assert.deepEqual(codes, ['en', 'hi', 'kn', 'mr']);

  const baseKeys = Object.keys(TRANSLATIONS.en).sort();
  for (const code of codes) {
    const dict = TRANSLATIONS[code];
    assert.deepEqual(Object.keys(dict).sort(), baseKeys, `Missing keys for ${code}`);
    for (const key of baseKeys) {
      assert.ok((dict as Record<string, string>)[key].trim().length > 0, `Empty key ${key} in ${code}`);
    }
  }

  assert.equal(getLocalizedCityLabel('Bengaluru', 'kn'), 'ಬೆಂಗಳೂರು');
  assert.equal(getLocalizedCityLabel('Pune', 'mr'), 'पुणे');
  assert.equal(getLocalizedCityLabel('All India', 'kn'), 'ಸಂಪೂರ್ಣ ಭಾರತ');
  assert.equal(getLocalizedCityLabel('All India', 'mr'), 'संपूर्ण भारत');
  assert.ok(getLocalizedListingTitle(INITIAL_LISTINGS[0], 'kn').includes('ಕೋರಮಂಗಲ'));
  assert.ok(getLocalizedListingTitle(INITIAL_LISTINGS[0], 'mr').includes('कोरमंगला'));
});

test('Project ZIP builder creates a valid PKZIP archive buffer', () => {
  const zip = buildZipArchive([
    { name: 'sahiroomie/vercel.json', data: Buffer.from('{"framework":"vite"}') },
    { name: 'sahiroomie/README.md', data: Buffer.from('# Sahiroomie') },
  ]);
  // PKZIP Local File Header signature: 0x50 0x4b 0x03 0x04
  assert.equal(zip.readUInt32LE(0), 0x04034b50);
  assert.ok(zip.includes(Buffer.from('sahiroomie/vercel.json')));
  assert.ok(zip.includes(Buffer.from('sahiroomie/README.md')));
});

test('Project ZIP collector excludes firebase-applet-config.json and includes example template', () => {
  const entries = collectProjectEntries(process.cwd());
  const names = entries.map((e) => e.name);
  assert.equal(names.includes('sahiroomie/firebase-applet-config.json'), false);
  assert.equal(names.includes('sahiroomie/firebase-applet-config.example.json'), true);
});
