import React, { useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';
import { usePlace } from './PlaceContext';
import { ArrowLeft, Plus, Edit2, LogOut, Home, Check } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function Places() {
  const { user } = useAuth();
  const { places, currentPlaceId, switchPlace, refreshPlaces } = usePlace();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const handleRename = async (place) => {
    const newName = window.prompt('Novo nome do Local:', place.name);
    if (newName === null || newName.trim() === '' || newName.trim() === place.name) return;
    await supabase.from('places').update({ name: newName.trim() }).eq('id', place.id);
    await refreshPlaces();
  };

  const handleLeave = async (place) => {
    const isOnlyOne = places.length === 1;
    const warn = isOnlyOne
      ? `Este é seu único Local. Se você sair, "${place.name}" e todos os dados dele (catálogo, corredores, histórico) serão APAGADOS, e você terá que criar outro Local. Tem certeza?`
      : `Tem certeza que deseja sair de "${place.name}"? Se você for o último membro, o Local e todos os dados serão apagados.`;

    if (!window.confirm(warn)) return;

    setBusy(true);
    try {
      const { error } = await supabase
        .from('user_places')
        .delete()
        .eq('user_id', user.id)
        .eq('place_id', place.id);
      if (error) throw error;

      // Se saiu do Local atual, troca pra outro
      if (currentPlaceId === place.id) {
        const remaining = places.filter(p => p.id !== place.id);
        if (remaining.length > 0) {
          switchPlace(remaining[0].id);
        } else {
          window.localStorage.removeItem('currentPlaceId');
        }
      }

      await refreshPlaces();

      if (places.length === 1) {
        // Não tem mais nenhum Local — vai para /welcome
        navigate('/welcome', { replace: true });
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao sair do Local.');
    }
    setBusy(false);
  };

  return (
    <div style={{ paddingBottom: '80px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', gap: '12px' }}>
        <Link to="/settings" style={{ color: 'var(--text-main)' }}><ArrowLeft /></Link>
        <h2 style={{ fontSize: '1.25rem', flex: 1 }}>Meus Locais</h2>
        <Link to="/places/new" className="btn btn-primary" style={{ padding: '8px 14px', fontSize: '0.875rem' }}>
          <Plus size={18} /> Novo
        </Link>
      </div>

      <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '0.875rem' }}>
        Cada Local tem sua própria lista de compras, catálogo e corredores. Toque para alternar.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {places.map(p => {
          const isCurrent = p.id === currentPlaceId;
          return (
            <div
              key={p.id}
              className="card"
              onClick={() => !isCurrent && switchPlace(p.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                marginBottom: 0, padding: '14px',
                cursor: isCurrent ? 'default' : 'pointer',
                border: isCurrent ? '2px solid var(--primary)' : '1px solid var(--border)',
                background: isCurrent ? 'rgba(79, 70, 229, 0.04)' : 'var(--surface)',
              }}
            >
              <div style={{ padding: '10px', backgroundColor: 'rgba(79, 70, 229, 0.1)', borderRadius: '10px' }}>
                <Home color="var(--primary)" size={22} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {p.name}
                  {isCurrent && <span style={{ fontSize: '0.7rem', background: 'var(--primary)', color: 'white', padding: '2px 8px', borderRadius: '999px' }}>Atual</span>}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleRename(p); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px' }}
                title="Renomear"
              >
                <Edit2 color="var(--primary)" size={18} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleLeave(p); }}
                disabled={busy}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px' }}
                title="Sair deste Local"
              >
                <LogOut color="var(--danger)" size={18} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
