import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth.js';
import Login from './pages/Login.js';
import Explorer from './pages/Explorer.js';
import Buscar from './pages/Buscar.js';
import Pipeline from './pages/Pipeline.js';
import Tareas from './pages/Tareas.js';
import Nav from './components/Nav.js';
import './index.css';

const queryClient = new QueryClient();

function RequireAuth({ children }: { children: ReactNode }) {
  const { authed } = useAuth();
  if (!authed) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Nav />
            <Explorer />
          </RequireAuth>
        }
      />
      <Route
        path="/buscar"
        element={
          <RequireAuth>
            <Nav />
            <Buscar />
          </RequireAuth>
        }
      />
      <Route
        path="/pipeline"
        element={
          <RequireAuth>
            <Nav />
            <Pipeline />
          </RequireAuth>
        }
      />
      <Route
        path="/tareas"
        element={
          <RequireAuth>
            <Nav />
            <Tareas />
          </RequireAuth>
        }
      />
    </Routes>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
