import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth.js';
import { useTheme } from '../theme.js';

export default function Nav() {
  const { signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const cls = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-1.5 rounded-sm text-[13px] tracking-tight transition-colors ${isActive ? 'text-on-nav font-semibold' : 'text-on-nav opacity-70 hover:opacity-100'}`;
  return (
    <nav className="flex items-center gap-1 bg-nav px-6 h-12">
      <span className="font-semibold text-on-nav mr-4 tracking-tight">LeadHub</span>
      <NavLink to="/" className={cls} end>Explorar</NavLink>
      <NavLink to="/buscar" className={cls}>Buscar</NavLink>
      <NavLink to="/pipeline" className={cls}>Pipeline</NavLink>
      <NavLink to="/tareas" className={cls}>Tareas</NavLink>
      <NavLink to="/dashboard" className={cls}>Dashboard</NavLink>
      <div className="ml-auto flex items-center gap-3">
        <button onClick={toggle} aria-label="Cambiar tema" className="text-on-nav opacity-70 hover:opacity-100 text-[15px]">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <button onClick={signOut} className="btn-utility">Salir</button>
      </div>
    </nav>
  );
}
