import React from 'react';
import { LogOut, ListTodo, Library, Settings as SettingsIcon } from 'lucide-react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { usePlace } from './PlaceContext';
import { supabase } from './supabase';
import Auth from './Auth';
import ShoppingList from './ShoppingList';
import Areas from './Areas';
import AddProduct from './AddProduct';
import Catalog from './Catalog';
import SettingsPage from './Settings';
import History from './History';
import Welcome from './Welcome';
import Places from './Places';
import AddPlace from './AddPlace';
import ImportFromPlace from './ImportFromPlace';
import PWAInstallPrompt from './PWAInstallPrompt';
import PlaceSwitcher from './PlaceSwitcher';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  const { places, loading: placesLoading } = usePlace();
  if (loading || placesLoading) return <div style={{ padding: 20 }}>Carregando...</div>;
  if (!user) return <Navigate to="/login" />;
  if (places.length === 0) return <Navigate to="/welcome" />;
  return children;
}

function WelcomeGate({ children }) {
  const { user, loading } = useAuth();
  const { places, loading: placesLoading } = usePlace();
  if (loading || placesLoading) return <div style={{ padding: 20 }}>Carregando...</div>;
  if (!user) return <Navigate to="/login" />;
  // Se o usuário já tem Local, não precisa ver Welcome
  if (places.length > 0) return <Navigate to="/" />;
  return children;
}

function BottomNav() {
  const location = useLocation();
  const { user } = useAuth();
  const { places } = usePlace();

  if (!user || places.length === 0 || location.pathname === '/login' || location.pathname === '/welcome') return null;

  const settingsActive =
    location.pathname.startsWith('/settings')
    || location.pathname === '/areas'
    || location.pathname === '/history'
    || location.pathname.startsWith('/places')
    || location.pathname === '/import-products';

  return (
    <nav className="bottom-nav">
      <Link to="/" className={`nav-item ${location.pathname === '/' ? 'active' : ''}`}>
        <ListTodo size={24} />
        <span>Lista</span>
      </Link>
      <Link to="/catalog" className={`nav-item ${location.pathname === '/catalog' ? 'active' : ''}`}>
        <Library size={24} />
        <span>Catálogo</span>
      </Link>
      <Link to="/settings" className={`nav-item ${settingsActive ? 'active' : ''}`}>
        <SettingsIcon size={24} />
        <span>Ajustes</span>
      </Link>
    </nav>
  );
}

function App() {
  const { user } = useAuth();

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <Router>
      <div className="app-container">
        <header className="app-header">
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.25rem', color: 'var(--primary)', fontWeight: 700 }}>
            🛒 Comprou?
          </h1>
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PlaceSwitcher />
              <button onClick={handleLogout} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px' }}>
                <LogOut color="var(--text-muted)" size={20} />
              </button>
            </div>
          )}
        </header>

        <main className="container" style={{ paddingBottom: '90px' }}>
          <Routes>
            <Route path="/login" element={user ? <Navigate to="/" /> : <Auth />} />
            <Route path="/welcome" element={<WelcomeGate><Welcome /></WelcomeGate>} />
            <Route path="/" element={<PrivateRoute><ShoppingList /></PrivateRoute>} />
            <Route path="/catalog" element={<PrivateRoute><Catalog /></PrivateRoute>} />
            <Route path="/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
            <Route path="/areas" element={<PrivateRoute><Areas /></PrivateRoute>} />
            <Route path="/add" element={<PrivateRoute><AddProduct /></PrivateRoute>} />
            <Route path="/history" element={<PrivateRoute><History /></PrivateRoute>} />
            <Route path="/places" element={<PrivateRoute><Places /></PrivateRoute>} />
            <Route path="/places/new" element={<PrivateRoute><AddPlace /></PrivateRoute>} />
            <Route path="/import-products" element={<PrivateRoute><ImportFromPlace /></PrivateRoute>} />
          </Routes>
        </main>

        <BottomNav />
        {user && <PWAInstallPrompt />}
      </div>
    </Router>
  );
}

export default App;
