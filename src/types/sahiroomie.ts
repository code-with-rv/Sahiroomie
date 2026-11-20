export type Language = 'en' | 'hi' | 'kn' | 'mr';

export type ListingType = 'Room in a flat' | 'PG' | 'Roommate' | 'Flat';
export type GenderPref = 'Any' | 'Male' | 'Female' | 'Other';
export type SheetSnap = 'peek' | 'half' | 'full';
export type AppTab = 'home' | 'find' | 'chats' | 'alerts' | 'profile';
export type SortOption = 'nearest' | 'bestVibe' | 'lowest' | 'newest' | 'fillsSoonest';

export interface CityMeta {
  id: string;
  name: string;
  hi: string;
  kn: string;
  mr: string;
  state: string;
  lat: number;
  lng: number;
  zoom: number;
  landmarks: string[];
}

export interface ExistingRoommate {
  name: string;
  age: number;
  roleTag: string;
  sleepVibe: 'Early Bird' | 'Night Owl' | 'Flexible';
  socialBattery: 'Introvert' | 'Ambivert' | 'Extrovert';
  cleanlinessVibe: 'Pinterest Clean' | 'Organized Chaos';
  wfhNoise: string;
  vibeTags: string[];
  expectations: string;
}

export interface NearbyPlace {
  name: string;
  category: 'Transit' | 'Work/Study' | 'Essentials';
  dist: string;
  walk: string;
}

export interface ListingHost {
  userId?: string;
  name: string;
  role: string;
  isRoomManager: boolean;
  verified: boolean;
  responseTime: string;
  listingsCount: number;
  avatar: string;
}

export interface ListingCompatibility {
  smoking: string;
  drinking: string;
  pets: string;
  diet: string;
  sleep: string;
  wfh: string;
  coupleFriendly: boolean;
}

export interface Listing {
  id: string;
  title: string;
  titleHi?: string;
  titleKn?: string;
  titleMr?: string;
  type: ListingType;
  city: string;
  state: string;
  area: string;
  landmark: string;
  rent: number;
  deposit: number;
  sizeSqFt: number;
  gender: GenderPref;
  urgentDays: number;
  countdownSeconds: number;
  distanceKm: number;
  createdHoursAgo: number;
  hygieneRating: number;
  hygieneVerified: boolean;
  furnishing: string;
  attachedBath: boolean;
  balcony: boolean;
  parking: string;
  moveInDate: string;
  lat: number;
  lng: number;
  pinX: number;
  pinY: number;
  existingRoommate: ExistingRoommate;
  nearbyPlaces: NearbyPlace[];
  host: ListingHost;
  compatibility: ListingCompatibility;
  description: string;
  houseRules: string;
  photos: string[];
  vibeScore?: number;
}

export interface FinderGenZ {
  sleepVibe: 'Early Bird' | 'Night Owl' | 'Flexible';
  socialBattery: 'Introvert' | 'Ambivert' | 'Extrovert';
  cleanlinessVibe: 'Pinterest Clean' | 'Organized Chaos';
  vibeTags: string[];
  customExpectation: string;
}

export interface VibeAnalysis {
  score: number;
  badgeLabel: string;
  roommate: ExistingRoommate;
  dimensions: { label: string; pct: number }[];
  greenFlags: string[];
  frictionFlags: string[];
  icebreaker: string;
}

export interface ChatMessage {
  id: string;
  sender: 'me' | 'them';
  text: string;
  time: string;
  date: string;
  read: boolean;
}

export interface ChatThread {
  id: string;
  listingId: string;
  peerName: string;
  peerRole: string;
  isRoomManager: boolean;
  verified: boolean;
  online: boolean;
  unread: number;
  messages: ChatMessage[];
}

export interface AppNotification {
  id: string;
  group: 'Today' | 'Yesterday' | 'Earlier';
  type: 'urgent' | 'chat' | 'match' | 'visit' | 'security';
  title: string;
  desc: string;
  time: string;
  unread: boolean;
  targetTab?: AppTab;
  listingId?: string;
  chatId?: string;
}

export interface RoomRequirement {
  targetCity: string;
  preferredArea: string;
  listingType: ListingType;
  maxRent: number;
  moveInTimeline: 'Within 7 days' | 'This month' | 'Next month' | 'Flexible';
  preferredGender: GenderPref;
}

export interface UserProfile {
  userId: string;
  name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  occupation: string;
  bio: string;
  photoUrl: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  authProvider: 'google' | 'email' | 'guest';
  onboardingCompleted: boolean;
  phoneVerified: boolean;
  emailVerified: boolean;
  idVerified: boolean;
  kycBadgeToken: string;
  driveFolder: string;
  photoVerified: boolean;
  privacyExactArea: boolean;
  privacyShowAge: boolean;
  roomRequirement: RoomRequirement;
}

export interface FilterState {
  rentPreset: string;
  minRent: number;
  maxRent: number;
  gender: string;
  type: string;
  hygieneImportant: boolean;
  diet: string;
  smoking: string;
  wfh: boolean;
  coupleFriendly: boolean;
  minSizeSqFt: number;
}

export interface ModerationItem {
  id: string;
  target: string;
  reason: string;
  status: string;
}

