import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';
import { usePlace } from './PlaceContext';
import { ArrowLeft, Download, CheckSquare, Square, Image as ImageIcon } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function ImportFromPlace() {
  const { user } = useAuth();
  const { places, currentPlaceId, currentPlace } = usePlace();
  const navigate = useNavigate();

  const otherPlaces = (places || []).filter(p => p.id !== currentPlaceId);

  const [sourcePlaceId, setSourcePlaceId] = useState(otherPlaces[0]?.id || '');
  const [delta, setDelta] = useState([]);          // produtos do source que ainda não existem no atual
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [done, setDone] = useState(0);

  useEffect(() => {
    if (sourcePlaceId && currentPlaceId) loadDelta();
  }, [sourcePlaceId, currentPlaceId]);

  const loadDelta = async () => {
    setLoading(true);
    setSelected(new Set());
    try {
      const [{ data: srcProducts }, { data: dstProducts }] = await Promise.all([
        supabase.from('products').select('id, name, thumbnail_url').eq('place_id', sourcePlaceId),
        supabase.from('products').select('name').eq('place_id', currentPlaceId),
      ]);
      const existing = new Set((dstProducts || []).map(p => p.name.trim().toLowerCase()));
      const onlyNew = (srcProducts || []).filter(p => !existing.has(p.name.trim().toLowerCase()));
      setDelta(onlyNew);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const toggle = (id) => {
    setSelected(prev => {
      const ns = new Set(prev);
      if (ns.has(id)) ns.delete(id); else ns.add(id);
      return ns;
    });
  };

  const toggleAll = () => {
    if (selected.size === delta.length) setSelected(new Set());
    else setSelected(new Set(delta.map(d => d.id)));
  };

  const handleImport = async () => {
    if (selected.size === 0) return;
    setWorking(true);
    setDone(0);
    const toCopy = delta.filter(d => selected.has(d.id));

    // Insere sem area_id (corredores podem ser diferentes entre Locais)
    const toInsert = toCopy.map(p => ({
      place_id: currentPlaceId,
      area_id: null,
      name: p.name,
      thumbnail_url: p.thumbnail_url,
      order_index: 0,
    }));

    const chunkSize = 50;
    for (let i = 0; i < toInsert.length; i += chunkSize) {
      const slice = toInsert.slice(i, i + chunkSize);
      await supabase.from('products').insert(slice);
      setDone(prev => prev + slice.length);
    }

    setWorking(false);
    alert(`${toCopy.length} ${toCopy.length === 1 ? 'produto importado' : 'produtos importados'} para ${currentPlace?.name || 'este Local'}.`);
    navigate('/catalog');
  };

  if (otherPlaces.length === 0) {
    return (
      <div style={{ paddingBottom: '80px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px', gap: '12px' }}>
          <Link to="/settings" style={{ color: 'var(--text-main)' }}><ArrowLeft /></Link>
          <h2 style={{ fontSize: '1.25rem' }}>Importar Produtos</h2>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '24px' }}>
          <p>Você só tem este Local. Crie um novo Local antes para poder importar produtos de outro.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: '120px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', gap: '12px' }}>
        <Link to="/settings" style={{ color: 'var(--text-main)' }}><ArrowLeft /></Link>
        <h2 style={{ fontSize: '1.25rem' }}>Importar Produtos</h2>
      </div>

      <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '0.875rem' }}>
        Traga produtos de outro Local seu para <b>{currentPlace?.name}</b>. Só aparecem os produtos que ainda <b>não existem</b> aqui.
      </p>

      <div className="card" style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>Importar de:</label>
        <select
          className="input-field"
          value={sourcePlaceId}
          onChange={e => setSourcePlaceId(e.target.value)}
        >
          {otherPlaces.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
          Buscando produtos...
        </div>
      ) : delta.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '24px' }}>
          <p>Nenhum produto novo. Todos os produtos do Local origem já estão aqui.</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {delta.length} {delta.length === 1 ? 'produto disponível' : 'produtos disponíveis'}
            </span>
            <button onClick={toggleAll} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>
              {selected.size === delta.length ? 'Desmarcar todos' : 'Marcar todos'}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {delta.map(p => {
              const isSel = selected.has(p.id);
              return (
                <div
                  key={p.id}
                  onClick={() => toggle(p.id)}
                  className="card"
                  style={{
                    marginBottom: 0, padding: '10px 12px',
                    display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer',
                    border: isSel ? '2px solid var(--primary)' : '1px solid var(--border)',
                    background: isSel ? 'rgba(79, 70, 229, 0.04)' : 'var(--surface)',
                  }}
                >
                  {isSel
                    ? <CheckSquare color="var(--primary)" size={22} />
                    : <Square color="var(--text-muted)" size={22} />}

                  {p.thumbnail_url ? (
                    <img src={p.thumbnail_url} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: 36, height: 36, borderRadius: 6, backgroundColor: 'var(--background)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ImageIcon size={18} color="var(--text-muted)" />
                    </div>
                  )}

                  <span style={{ flex: 1, fontWeight: 500 }}>{p.name}</span>
                </div>
              );
            })}
          </div>

          {/* Botão flutuante de importar */}
          <div style={{
            position: 'fixed',
            bottom: 'calc(64px + env(safe-area-inset-bottom, 0px) + 12px)',
            left: 0, right: 0, padding: '0 16px',
            display: 'flex', justifyContent: 'center', zIndex: 30, pointerEvents: 'none'
          }}>
            <button
              onClick={handleImport}
              disabled={selected.size === 0 || working}
              className="btn btn-primary"
              style={{
                width: '100%', maxWidth: '600px', padding: '16px',
                boxShadow: 'var(--shadow-lg)',
                opacity: selected.size === 0 ? 0.5 : 1,
                pointerEvents: 'auto',
              }}
            >
              <Download size={20} />
              {working
                ? `Importando... ${done}/${selected.size}`
                : `Importar ${selected.size} ${selected.size === 1 ? 'produto' : 'produtos'}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
