import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api.js';
import { useAuth } from '../auth.js';

export default function Login() {
  const { signIn } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [err, setErr] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr('');
    try { const { token } = await login(email, pw); signIn(token); nav('/'); }
    catch (e) { setErr((e as Error).message); }
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4">
      <form onSubmit={submit} className="w-full max-w-sm card p-8 space-y-4">
        <h1 className="text-3xl font-semibold text-ink tracking-tight">LeadHub</h1>
        <label className="sr-only" htmlFor="login-email">Email</label>
        <input id="login-email" autoComplete="email" className="input w-full" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <label className="sr-only" htmlFor="login-password">Contraseña</label>
        <input id="login-password" autoComplete="current-password" className="input w-full" type="password" placeholder="Contraseña" value={pw} onChange={(e) => setPw(e.target.value)} />
        {err && <p role="alert" className="text-[13px] text-danger">{err}</p>}
        <button className="btn w-full">Entrar</button>
      </form>
    </div>
  );
}
