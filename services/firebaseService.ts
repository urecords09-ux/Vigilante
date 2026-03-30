import { db, auth } from '../firebase';
import { doc, getDoc, setDoc, getDocFromServer } from 'firebase/firestore';
import { Grid, CityStats, AIGoal, NewsItem, CityData } from '../types';

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
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const saveCityData = async (userId: string, data: CityData) => {
  const path = `cities/${userId}`;
  try {
    // Firestore doesn't support nested arrays (Grid is TileData[][])
    const serializedData = {
      ...data,
      grid: JSON.stringify(data.grid)
    };
    await setDoc(doc(db, 'cities', userId), serializedData);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const loadCityData = async (userId: string): Promise<CityData | null> => {
  const path = `cities/${userId}`;
  try {
    const docSnap = await getDoc(doc(db, 'cities', userId));
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        ...data,
        grid: typeof data.grid === 'string' ? JSON.parse(data.grid) : data.grid
      } as CityData;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
};

export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}
