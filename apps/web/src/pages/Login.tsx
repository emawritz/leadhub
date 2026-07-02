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
    <form onSubmit={submit} className="max-w-sm mx-auto mt-24 space-y-3 p-6">
      <h1 className="text-2xl font-bold">LeadHub</h1>
      <input className="border p-2 w-full" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className="border p-2 w-full" type="password" placeholder="Contraseña" value={pw} onChange={(e) => setPw(e.target.value)} />
      {err && <p className="text-red-600 text-sm">{err}</p>}
      <button className="bg-black text-white px-4 py-2 rounded w-full">Entrar</button>
    </form>
  );
}
