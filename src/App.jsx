import React from 'react';
import { LogOut } from 'lucide-react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { supabase } from './supabase';
import Auth from './Auth';
import ShoppingList from './ShoppingList';
import Areas from './Areas';
import AddProduct from './AddProduct';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div>Carregando...</div>;
  return user ? children : <Navigate to="/login" />;
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
        
        <main className="container">
          <Routes>
            <Route path="/login" element={user ? <Navigate to="/" /> : <Auth />} />
            <Route path="/" element={<PrivateRoute><ShoppingList /></PrivateRoute>} />
            <Route path="/areas" element={<PrivateRoute><Areas /></PrivateRoute>} />
            <Route path="/add" element={<PrivateRoute><AddProduct /></PrivateRoute>} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
