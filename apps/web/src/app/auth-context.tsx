import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { PortalUser } from "@portal/shared";
import { ApiError, api } from "../api/client.js";

type AuthStatus = "loading" | "anonymous" | "authenticated" | "unavailable";
type AuthContextValue = {
  user: PortalUser | null;
  status: AuthStatus;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PortalUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    let active = true;
    api.me().then((currentUser) => {
      if (!active) return;
      setUser(currentUser);
      setStatus("authenticated");
    }).catch((error: unknown) => {
      if (!active) return;
      if (error instanceof ApiError && error.status === 401) {
        setUser(null);
        setStatus("anonymous");
      } else {
        setStatus("unavailable");
      }
    });
    return () => { active = false; };
  }, []);

  async function signIn(email: string, password: string) {
    const currentUser = await api.login(email, password);
    setUser(currentUser);
    setStatus("authenticated");
  }

  async function signOut() {
    await api.logout();
    setUser(null);
    setStatus("anonymous");
  }

  return (
    <AuthContext.Provider value={{ user, status, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}