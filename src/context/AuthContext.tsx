import { createContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../services/firebase/config";
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
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      setCurrentUser(user);
      setProfile(user ? await getUserProfile(user.uid) : null);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

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
