import React from 'react';
import { ShoppingCart } from 'lucide-react';

function App() {
  return (
    <div className="app-container">
      <header className="app-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.25rem', color: 'var(--text-main)' }}>
          <ShoppingCart color="var(--primary)" />
          Comprou?
        </h1>
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--border)' }}></div>
      </header>
      
      <main className="container">
        <div className="card">
          <h2 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Bem-vindo ao Comprou?</h2>
          <p style={{ color: 'var(--text-muted)' }}>
            Sua lista de compras inteligente, compartilhada em tempo real com sua família.
          </p>
          <button className="btn btn-primary" style={{ marginTop: '16px', width: '100%' }}>
            Começar
          </button>
        </div>
      </main>
    </div>
  );
}

export default App;
