import React, { useState, useRef, useEffect } from 'react';
import { usePlace } from './PlaceContext';
import { ChevronDown, Home, Check } from 'lucide-react';

export default function PlaceSwitcher() {
  const { places, currentPlace, currentPlaceId, switchPlace } = usePlace();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Fecha ao clicar fora
  useEffect(() => {
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // Só renderiza quando o usuário tem mais de 1 Local
  if (!places || places.length <= 1 || !currentPlace) return null;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: 'var(--background)', border: '1px solid var(--border)',
          borderRadius: '999px', padding: '6px 10px 6px 8px',
          cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600,
          color: 'var(--text-main)', maxWidth: '160px',
        }}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Home size={14} color="var(--primary)" />
        <span style={{
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100px'
        }}>
          {currentPlace.name}
        </span>
        <ChevronDown size={14} color="var(--text-muted)" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0,
            minWidth: '220px', background: 'var(--surface)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)', zIndex: 200, overflow: 'hidden',
          }}
        >
          {places.map(p => {
            const active = p.id === currentPlaceId;
            return (
              <button
                key={p.id}
                onClick={() => { switchPlace(p.id); setOpen(false); }}
                role="menuitem"
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  width: '100%', padding: '12px 14px',
                  background: active ? 'rgba(79, 70, 229, 0.06)' : 'transparent',
                  border: 'none', cursor: active ? 'default' : 'pointer',
                  textAlign: 'left', color: 'var(--text-main)',
                }}
              >
                <Home size={16} color="var(--primary)" />
                <span style={{ flex: 1, fontWeight: active ? 600 : 500 }}>{p.name}</span>
                {active && <Check size={16} color="var(--primary)" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
