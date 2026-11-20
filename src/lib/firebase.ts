import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Firestore,
} from 'firebase/firestore';
import type { FinderGenZ, Listing, UserProfile } from '../types/sahiroomie';

interface FirebaseAppletConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId: string;
  storageBucket?: string;
  messagingSenderId?: string;
}

interface FirebaseServices {
  app: FirebaseApp;
  db: Firestore;
  auth: Auth;
  googleProvider: GoogleAuthProvider;
}

let servicesPromise: Promise<FirebaseServices | null> | null = null;
let cachedAuth: Auth | null = null;

export const auth = {
  get currentUser(): User | null {
    return cachedAuth?.currentUser ?? null;
  },
};

async function fetchRuntimeFirebaseConfig(): Promise<FirebaseAppletConfig | null> {
  try {
    const res = await fetch('/api/firebase-config', {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.configured || !data?.config?.apiKey || !data?.config?.projectId) {
      return null;
    }
    return data.config as FirebaseAppletConfig;
  } catch {
    return null;
  }
}

async function testConnection(db: Firestore) {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

async function getFirebaseServices(): Promise<FirebaseServices | null> {
  if (!servicesPromise) {
    servicesPromise = (async () => {
      const config = await fetchRuntimeFirebaseConfig();
      if (!config) return null;
      const app = initializeApp(config);
      const db = getFirestore(app, config.firestoreDatabaseId || '(default)');
      const auth = getAuth(app);
      cachedAuth = auth;
      const googleProvider = new GoogleAuthProvider();
      googleProvider.setCustomParameters({ prompt: 'select_account' });
      void testConnection(db);
      return { app, db, auth, googleProvider };
    })();
  }
  return servicesPromise;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
  authInstance?: Auth | null
): never {
  const activeAuth = authInstance || cachedAuth;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: activeAuth?.currentUser?.uid,
      email: activeAuth?.currentUser?.email,
      emailVerified: activeAuth?.currentUser?.emailVerified,
      isAnonymous: activeAuth?.currentUser?.isAnonymous,
      tenantId: activeAuth?.currentUser?.tenantId,
      providerInfo:
        activeAuth?.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function signInWithGoogle(): Promise<User> {
  const services = await getFirebaseServices();
  if (!services) {
    throw new Error('Firebase authentication is not configured on this server.');
  }
  const result = await signInWithPopup(services.auth, services.googleProvider);
  return result.user;
}

export async function signOutFirebase(): Promise<void> {
  const services = await getFirebaseServices();
  if (!services) return;
  await signOut(services.auth);
}

export function subscribeAuthState(callback: (user: User | null) => void): () => void {
  let active = true;
  let unsubscribe: (() => void) | null = null;

  void getFirebaseServices().then((services) => {
    if (!active) return;
    if (!services) {
      callback(null);
      return;
    }
    unsubscribe = onAuthStateChanged(services.auth, callback);
  });

  return () => {
    active = false;
    unsubscribe?.();
  };
}

function clampStr(val: string | undefined, max: number): string {
  return String(val || '').trim().slice(0, max);
}

export async function loadUserProfileFromFirestore(
  uid: string
): Promise<{
  profileUpdates?: Partial<UserProfile>;
  finderUpdates?: Partial<FinderGenZ>;
  savedIds?: string[];
} | null> {
  const services = await getFirebaseServices();
  if (!services) return null;
  const { db, auth } = services;

  const publicPath = `users/${uid}/public/profile`;
  const privatePath = `users/${uid}/private/info`;

  let pubSnap;
  let privSnap;
  try {
    pubSnap = await getDoc(doc(db, 'users', uid, 'public', 'profile'));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, publicPath, auth);
  }

  try {
    privSnap = await getDoc(doc(db, 'users', uid, 'private', 'info'));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, privatePath, auth);
  }

  if (!pubSnap.exists() && !privSnap.exists()) return null;

  const pubData = pubSnap.exists() ? pubSnap.data() : {};
  const privData = privSnap.exists() ? privSnap.data() : {};

  return {
    profileUpdates: {
      userId: uid,
      name: pubData.displayName || '',
      photoUrl: pubData.photoUrl || '',
      occupation: pubData.occupation || '',
      bio: pubData.bio || '',
      gender: pubData.gender || 'Male',
      city: pubData.city || 'Bengaluru',
      state: pubData.state || 'Karnataka',
      onboardingCompleted: Boolean(pubData.onboardingCompleted),
      roomRequirement: pubData.roomRequirement || undefined,
      email: privData.email || '',
      phone: privData.phone || '',
      age: typeof privData.age === 'number' ? privData.age : 22,
      phoneVerified: Boolean(privData.phoneVerified),
      emailVerified: Boolean(privData.emailVerified),
      idVerified: Boolean(privData.idVerified),
      kycBadgeToken: privData.kycBadgeToken || 'PENDING',
      privacyExactArea: Boolean(privData.privacyExactArea),
      privacyShowAge: privData.privacyShowAge !== false,
    },
    finderUpdates: {
      sleepVibe: pubData.sleepVibe || 'Early Bird',
      socialBattery: pubData.socialBattery || 'Ambivert',
      cleanlinessVibe:
        pubData.cleanlinessVibe === 'Organized Chaos' ? 'Organized Chaos' : 'Pinterest Clean',
      vibeTags: Array.isArray(pubData.vibeTags) ? pubData.vibeTags : [],
      customExpectation: pubData.bio || '',
    },
    savedIds: Array.isArray(privData.savedListingIds) ? privData.savedListingIds : undefined,
  };
}

export async function saveUserProfileToFirestore(
  uid: string,
  profile: UserProfile,
  finderGenZ: FinderGenZ,
  savedListingIds: string[]
): Promise<void> {
  const services = await getFirebaseServices();
  if (!services) return;
  const { db, auth } = services;

  const publicPath = `users/${uid}/public/profile`;
  const privatePath = `users/${uid}/private/info`;
  const publicRef = doc(db, 'users', uid, 'public', 'profile');
  const privateRef = doc(db, 'users', uid, 'private', 'info');

  let pubExists = false;
  let privExists = false;
  try {
    pubExists = (await getDoc(publicRef)).exists();
    privExists = (await getDoc(privateRef)).exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, publicPath, auth);
  }

  const sanitizedName = clampStr(profile.name, 80) || 'Sahiroomie Member';
  const publicPayload: Record<string, any> = {
    userId: uid,
    displayName: sanitizedName.length >= 2 ? sanitizedName : `${sanitizedName} Member`,
    photoUrl: clampStr(profile.photoUrl, 195000),
    occupation: clampStr(profile.occupation, 80),
    gender: ['Male', 'Female', 'Other', 'Any'].includes(profile.gender) ? profile.gender : 'Male',
    city: clampStr(profile.city, 60) || 'Bengaluru',
    state: clampStr(profile.state, 60) || 'Karnataka',
    bio: clampStr(profile.bio || finderGenZ.customExpectation, 400),
    sleepVibe: finderGenZ.sleepVibe,
    socialBattery: finderGenZ.socialBattery,
    cleanlinessVibe: finderGenZ.cleanlinessVibe,
    vibeTags: (finderGenZ.vibeTags || []).slice(0, 8),
    ...(profile.roomRequirement ? { roomRequirement: profile.roomRequirement } : {}),
    onboardingCompleted: Boolean(profile.onboardingCompleted),
    updatedAt: serverTimestamp(),
  };
  if (!pubExists) {
    publicPayload.createdAt = serverTimestamp();
  }

  try {
    if (pubExists) {
      await setDoc(publicRef, publicPayload, { merge: true });
    } else {
      await setDoc(publicRef, publicPayload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, publicPath, auth);
  }

  const safeAge = Math.max(18, Math.min(99, Number(profile.age) || 18));
  const privatePayload: Record<string, any> = {
    userId: uid,
    email: clampStr(profile.email, 120),
    phone: clampStr(profile.phone, 24),
    age: safeAge,
    phoneVerified: Boolean(profile.phoneVerified),
    emailVerified: Boolean(profile.emailVerified),
    idVerified: Boolean(profile.idVerified),
    kycBadgeToken: clampStr(profile.kycBadgeToken, 40),
    privacyExactArea: Boolean(profile.privacyExactArea),
    privacyShowAge: Boolean(profile.privacyShowAge),
    savedListingIds: savedListingIds.slice(0, 100),
    updatedAt: serverTimestamp(),
  };
  if (!privExists) {
    privatePayload.createdAt = serverTimestamp();
  }

  try {
    if (privExists) {
      await setDoc(privateRef, privatePayload, { merge: true });
    } else {
      await setDoc(privateRef, privatePayload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, privatePath, auth);
  }
}

export async function syncSavedListingsToFirestore(
  uid: string,
  savedListingIds: string[]
): Promise<void> {
  const services = await getFirebaseServices();
  if (!services) return;
  const { db, auth } = services;

  const privatePath = `users/${uid}/private/info`;
  const privateRef = doc(db, 'users', uid, 'private', 'info');
  try {
    const snap = await getDoc(privateRef);
    if (!snap.exists()) return;
    await setDoc(
      privateRef,
      {
        savedListingIds: savedListingIds.slice(0, 100),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, privatePath, auth);
  }
}

export async function publishListingToFirestore(
  uid: string,
  listing: Listing
): Promise<void> {
  const services = await getFirebaseServices();
  if (!services) return;
  const { db, auth } = services;

  const path = `listings/${listing.id}`;
  const payload = {
    ownerId: uid,
    title: clampStr(listing.title, 140) || 'Verified Room Stay',
    type: listing.type,
    city: clampStr(listing.city, 60) || 'Bengaluru',
    state: clampStr(listing.state, 60) || 'Karnataka',
    area: clampStr(listing.area, 80) || 'Central',
    landmark: clampStr(listing.landmark, 120),
    rent: Math.max(1000, Math.min(250000, Number(listing.rent) || 10000)),
    deposit: Math.max(0, Math.min(1000000, Number(listing.deposit) || 0)),
    sizeSqFt: Math.max(40, Math.min(10000, Number(listing.sizeSqFt) || 120)),
    gender: listing.gender,
    urgentDays: Math.max(1, Math.min(90, Number(listing.urgentDays) || 7)),
    hygieneRating: Math.max(1, Math.min(5, Number(listing.hygieneRating) || 4.8)),
    hygieneVerified: Boolean(listing.hygieneVerified),
    furnishing: clampStr(listing.furnishing, 40),
    attachedBath: Boolean(listing.attachedBath),
    balcony: Boolean(listing.balcony),
    parking: clampStr(listing.parking, 40),
    moveInDate: clampStr(listing.moveInDate, 30),
    lat: Number(listing.lat) || 12.9716,
    lng: Number(listing.lng) || 77.5946,
    pinX: Number(listing.pinX) || 45,
    pinY: Number(listing.pinY) || 45,
    description: clampStr(listing.description, 1200),
    houseRules: clampStr(listing.houseRules, 600),
    photos: (listing.photos || []).slice(0, 10),
    status: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'listings', listing.id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path, auth);
  }
}

export function subscribeActiveListings(
  onData: (remoteListings: Partial<Listing>[]) => void
): () => void {
  let active = true;
  let unsubscribe: (() => void) | null = null;
  const path = 'listings';

  void getFirebaseServices().then((services) => {
    if (!active || !services) return;
    const { db, auth } = services;
    const q = query(collection(db, 'listings'), where('status', '==', 'active'));
    unsubscribe = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Partial<Listing>[];
        onData(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path, auth);
      }
    );
  });

  return () => {
    active = false;
    unsubscribe?.();
  };
}

export async function submitSafetyReportToFirestore(
  uid: string,
  reportId: string,
  targetType: string,
  targetName: string,
  reason: string
): Promise<void> {
  const services = await getFirebaseServices();
  if (!services) return;
  const { db, auth } = services;

  const path = `reports/${reportId}`;
  try {
    await setDoc(doc(db, 'reports', reportId), {
      reporterId: uid,
      targetType: clampStr(targetType, 40),
      targetName: clampStr(targetName, 140),
      reason: clampStr(reason, 200),
      status: 'Pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path, auth);
  }
}
