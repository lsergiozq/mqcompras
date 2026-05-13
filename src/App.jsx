import React from 'react';
import { LogOut, ListTodo, Library, Settings } from 'lucide-react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { supabase } from './supabase';
import Auth from './Auth';
import ShoppingList from './ShoppingList';
import Areas from './Areas';
import AddProduct from './AddProduct';
import Catalog from './Catalog';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 20 }}>Carregando...</div>;
  return user ? children : <Navigate to="/login" />;
}

function BottomNav() {
  const location = useLocation();
  const { user } = useAuth();
  
  if (!user || location.pathname === '/login') return null;

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
      <Link to="/areas" className={`nav-item ${location.pathname === '/areas' ? 'active' : ''}`}>
        <Settings size={24} />
        <span>Corredores</span>
      </Link>
    </nav>
  );
}

function App() {
  const { user } = useAuth();

  const handleLogout = async () => {
    await supabase.auth.signOut();
  }

  return (
    <Router>
      <div className="app-container">
        <header className="app-header">
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.25rem', color: 'var(--primary)', fontWeight: 700 }}>
            🛒 Comprou?
          </h1>
          {user && (
            <button onClick={handleLogout} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px' }}>
              <LogOut color="var(--text-muted)" size={20} />
            </button>
          )}
        </header>
        
        <main className="container" style={{ paddingBottom: '90px' }}>
          <Routes>
            <Route path="/login" element={user ? <Navigate to="/" /> : <Auth />} />
            <Route path="/" element={<PrivateRoute><ShoppingList /></PrivateRoute>} />
            <Route path="/catalog" element={<PrivateRoute><Catalog /></PrivateRoute>} />
            <Route path="/areas" element={<PrivateRoute><Areas /></PrivateRoute>} />
            <Route path="/add" element={<PrivateRoute><AddProduct /></PrivateRoute>} />
          </Routes>
        </main>
        
        <BottomNav />
      </div>
    </Router>
  );
}

export default App;
