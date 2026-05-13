import React from 'react';
import { useAuth } from './AuthContext';
import { Link } from 'react-router-dom';
import { Settings, ShoppingBag, ArrowRight } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div>
      <div className="card" style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)', color: 'white', border: 'none' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Sua Lista</h2>
        <p style={{ opacity: 0.9 }}>
          Pronto para ir ao mercado?
        </p>
        <button className="btn" style={{ marginTop: '16px', backgroundColor: 'white', color: 'var(--primary)', width: '100%' }}>
          <ShoppingBag size={18} /> Começar Compras
        </button>
      </div>

      <h3 style={{ marginTop: '24px', marginBottom: '12px', fontSize: '1rem', color: 'var(--text-muted)' }}>Configurações</h3>
      
      <Link to="/areas" style={{ textDecoration: 'none' }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '8px', backgroundColor: 'var(--background)', borderRadius: 'var(--radius-md)' }}>
              <Settings size={20} color="var(--primary)" />
            </div>
            <div>
              <h4 style={{ color: 'var(--text-main)', margin: 0 }}>Corredores</h4>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Organizar ordem do mercado</span>
            </div>
          </div>
          <ArrowRight color="var(--text-muted)" size={20} />
        </div>
      </Link>
    </div>
  );
}
