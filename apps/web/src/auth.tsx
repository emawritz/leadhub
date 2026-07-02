import { createContext, useContext, useState, type ReactNode } from 'react';
import { getToken, setToken } from './api.js';

const Ctx = createContext<{ authed: boolean; signIn: (t: string) => void; signOut: () => void }>({ authed: false, signIn: () => {}, signOut: () => {} });
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(!!getToken());
  return <Ctx.Provider value={{
    authed,
    signIn: (t) => { setToken(t); setAuthed(true); },
    signOut: () => { setToken(null); setAuthed(false); },
  }}>{children}</Ctx.Provider>;
}
