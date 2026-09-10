import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, type User } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, writeBatch, deleteDoc, onSnapshot } from "firebase/firestore";
import { db as localDb, type Expense } from "./db";

// ── Firebase config ──
// Replace these with your Firebase project credentials
// Go to: https://console.firebase.google.com → Create project → Add web app → Copy config
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
};

// Only init if config exists
const hasConfig = !!(firebaseConfig.apiKey && firebaseConfig.projectId);
const app = hasConfig && getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = hasConfig ? getAuth(app) : null;
const firestore = hasConfig ? getFirestore(app) : null;
const googleProvider = hasConfig ? new GoogleAuthProvider() : null;

// ── Auth functions ──

export function isFirebaseConfigured(): boolean {
  return hasConfig;
}

export async function signInWithGoogle(): Promise<User | null> {
  if (!auth || !googleProvider) return null;
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (err) {
    console.error("Google sign-in failed:", err);
    return null;
  }
}

export async function signOutUser(): Promise<void> {
  if (!auth) return;
  await signOut(auth);
}

export function onAuthChange(callback: (user: User | null) => void): () => void {
  if (!auth) { callback(null); return () => {}; }
  return onAuthStateChanged(auth, callback);
}

export function getCurrentUser(): User | null {
  return auth?.currentUser ?? null;
}

// ── Sync functions ──

export async function syncToCloud(userId: string): Promise<number> {
  if (!firestore) return 0;
  const localExpenses = await localDb.expenses.toArray();
  const batch = writeBatch(firestore);
  let count = 0;

  for (const exp of localExpenses) {
    const docRef = doc(firestore, "users", userId, "expenses", exp.id);
    batch.set(docRef, {
      amount: exp.amount,
      description: exp.description,
      category: exp.category,
      type: exp.type || "expense",
      date: exp.date,
      time: exp.time,
      location: exp.location || null,
      createdAt: exp.createdAt,
    });
    count++;
  }

  if (count > 0) await batch.commit();
  return count;
}

export async function syncFromCloud(userId: string): Promise<number> {
  if (!firestore) return 0;
  const q = query(collection(firestore, "users", userId, "expenses"));
  const snapshot = await getDocs(q);
  let count = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const expense: Expense = {
      id: docSnap.id,
      amount: data.amount,
      description: data.description,
      category: data.category,
      type: data.type || "expense",
      date: data.date,
      time: data.time,
      location: data.location || undefined,
      createdAt: data.createdAt,
    };
    await localDb.expenses.put(expense); // put = upsert
    count++;
  }

  return count;
}

export async function syncExpenseToCloud(userId: string, expense: Expense): Promise<void> {
  if (!firestore) return;
  const docRef = doc(firestore, "users", userId, "expenses", expense.id);
  await setDoc(docRef, {
    amount: expense.amount,
    description: expense.description,
    category: expense.category,
    type: expense.type || "expense",
    date: expense.date,
    time: expense.time,
    location: expense.location || null,
    createdAt: expense.createdAt,
  });
}

export async function deleteExpenseFromCloud(userId: string, expenseId: string): Promise<void> {
  if (!firestore) return;
  await deleteDoc(doc(firestore, "users", userId, "expenses", expenseId));
}

// ── Real-time listener for cross-device sync ──

export function listenToCloudChanges(userId: string, onUpdate: () => void): () => void {
  if (!firestore) return () => {};
  const q = query(collection(firestore, "users", userId, "expenses"));
  return onSnapshot(q, async (snapshot) => {
    for (const change of snapshot.docChanges()) {
      if (change.type === "added" || change.type === "modified") {
        const data = change.doc.data();
        await localDb.expenses.put({
          id: change.doc.id,
          amount: data.amount,
          description: data.description,
          category: data.category,
          type: data.type || "expense",
          date: data.date,
          time: data.time,
          location: data.location || undefined,
          createdAt: data.createdAt,
        });
      } else if (change.type === "removed") {
        await localDb.expenses.delete(change.doc.id);
      }
    }
    onUpdate();
  });
}
