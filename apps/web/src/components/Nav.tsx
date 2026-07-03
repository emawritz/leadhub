import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth.js';

export default function Nav() {
  const { signOut } = useAuth();
  const cls = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded ${isActive ? 'bg-black text-white' : 'text-black hover:bg-gray-100'}`;
  return (
    <nav className="flex items-center gap-2 border-b px-6 py-3">
      <span className="font-bold mr-4">LeadHub</span>
      <NavLink to="/" className={cls} end>Explorar</NavLink>
      <NavLink to="/buscar" className={cls}>Buscar</NavLink>
      <NavLink to="/pipeline" className={cls}>Pipeline</NavLink>
      <NavLink to="/tareas" className={cls}>Tareas</NavLink>
      <NavLink to="/dashboard" className={cls}>Dashboard</NavLink>
      <button onClick={signOut} className="ml-auto text-sm text-gray-600 hover:underline">Salir</button>
    </nav>
  );
}
