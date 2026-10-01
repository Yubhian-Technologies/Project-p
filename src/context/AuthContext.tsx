import { createContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../services/firebase/config";
import { getUserProfile } from "../services/firebase/firestore";
import { signOutUser } from "../services/firebase/auth";
import type { UserProfile, Role } from "../types/user";

export interface AuthContextValue {
  currentUser: User | null;
  profile: UserProfile | null;
  role: Role | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user) {
        setProfile(null);
        setLoading(false);
      }
      // When a user is present, the profile listener below takes over
      // loading (it needs the first snapshot before we know the profile).
    });
    return unsubscribe;
  }, []);

  // Live-subscribed rather than fetched once: an Admin reassigning this
  // account's role/campus/college while the tab stays open must be reflected
  // immediately, otherwise campus/college-scoped writes get silently
  // rejected by Firestore rules against a stale cached profile.
  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);
    const unsubscribe = onSnapshot(doc(db, "users", currentUser.uid), (snapshot) => {
      setProfile(snapshot.exists() ? (snapshot.data() as UserProfile) : null);
      setLoading(false);
    });
    return unsubscribe;
  }, [currentUser]);

  // Tells the intro splash (index.html / main.tsx) that the first auth check is done.
  useEffect(() => {
    if (!loading) window.dispatchEvent(new Event("app-ready"));
  }, [loading]);

  async function refreshProfile() {
    if (currentUser) {
      setProfile(await getUserProfile(currentUser.uid));
    }
  }

  const value: AuthContextValue = {
    currentUser,
    profile,
    role: profile?.role ?? null,
    loading,
    logout: signOutUser,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
