import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Smarter Firestore initialization
// If the specific database ID is provided and common, use it. 
// Fallback to (default) if named database is not ready or fails.
const getFirestoreDb = () => {
  const configDbId = (firebaseConfig as any).firestoreDatabaseId;
  try {
    return getFirestore(app, configDbId || '(default)');
  } catch (error) {
    console.error("Failed to initialize Firestore with ID:", configDbId, error);
    return getFirestore(app, '(default)');
  }
};

export const db = getFirestoreDb();
export const auth = getAuth(app);
export const analytics = typeof window !== 'undefined' && firebaseConfig.measurementId ? getAnalytics(app) : null;
export const googleProvider = new GoogleAuthProvider();

export const signIn = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    console.log("Sign-in successful:", result.user.email);
    return result;
  } catch (error) {
    console.error("Sign-in error:", error);
    throw error;
  }
};

export const signOut = () => auth.signOut();

// Connection test
async function testConnection() {
  try {
    // Try to read a dummy doc to verify connection/rules
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection test completed.");
  } catch (error: any) {
    // We expect a permission-denied or similar if rules are working and doc doesn't exist,
    // but a network error if config is wrong.
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();
