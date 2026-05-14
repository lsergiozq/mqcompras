import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';
import { usePlace } from './PlaceContext';
import { fetchActiveCatalogPresets, applyCatalogPreset } from './catalogPresets';
import { ArrowLeft, Sparkles, Copy } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const DEFAULT_AREAS = ['Hortifruti', 'Padaria', 'Frios', 'Açougue', 'Limpeza', 'Mercearia'];

export default function AddPlace() {
  const { user } = useAuth();
  const { places, refreshPlaces, switchPlace } = usePlace();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [presets, setPresets] = useState([]);
  const [mode, setMode] = useState('empty');     // 'empty' | 'copy' | preset slug
  const [sourcePlaceId, setSourcePlaceId] = useState(places[0]?.id || '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    const loadPresets = async () => {
      try {
        const rows = await fetchActiveCatalogPresets();
        if (active) setPresets(rows);
      } catch (err) {
        console.error(err);
      }
    };

    loadPresets();

    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);

    try {
      // 1) Cria o novo Local
      const { data: newPlace, error: e1 } = await supabase
        .from('places')
        .insert([{ name: name.trim() }])
        .select()
        .single();
      if (e1) throw e1;

      // 2) Vincula o usuário ao Local
      const { error: e2 } = await supabase
        .from('user_places')
        .insert([{ user_id: user.id, place_id: newPlace.id }]);
      if (e2) throw e2;

      // 3) Modo "vazio": cria corredores padrão
      if (mode === 'empty') {
        const areasToInsert = DEFAULT_AREAS.map((n, i) => ({
          place_id: newPlace.id, name: n, order_index: i,
        }));
        await supabase.from('areas').insert(areasToInsert);
      }

      if (mode !== 'empty' && mode !== 'copy') {
        await applyCatalogPreset(newPlace.id, mode);
      }

      // 4) Modo "copiar": copia áreas e produtos do Local origem (sem lista_items)
      if (mode === 'copy' && sourcePlaceId) {
        // Áreas
        const { data: srcAreas } = await supabase
          .from('areas')
          .select('id, name, order_index')
          .eq('place_id', sourcePlaceId)
          .order('order_index', { ascending: true });

        const areaIdMap = {};
        if (srcAreas && srcAreas.length > 0) {
          const newAreas = srcAreas.map(a => ({
            place_id: newPlace.id,
            name: a.name,
            order_index: a.order_index,
          }));
          const { data: insertedAreas } = await supabase
            .from('areas')
            .insert(newAreas)
            .select();

          // Mapeia old.id -> new.id (pela ordem)
          if (insertedAreas) {
            insertedAreas.forEach((newA) => {
              const oldA = srcAreas.find(o => o.name === newA.name && o.order_index === newA.order_index);
              if (oldA) areaIdMap[oldA.id] = newA.id;
            });
          }
        }

        // Produtos
        const { data: srcProducts } = await supabase
          .from('products')
          .select('name, thumbnail_url, area_id, order_index')
          .eq('place_id', sourcePlaceId);

        if (srcProducts && srcProducts.length > 0) {
          const newProducts = srcProducts.map(p => ({
            place_id: newPlace.id,
            name: p.name,
            thumbnail_url: p.thumbnail_url, // reaproveita URL pública
            area_id: p.area_id ? (areaIdMap[p.area_id] || null) : null,
            order_index: p.order_index || 0,
          }));
          // Insere em lotes de 100 para evitar payload grande
          const chunkSize = 100;
          for (let i = 0; i < newProducts.length; i += chunkSize) {
            await supabase.from('products').insert(newProducts.slice(i, i + chunkSize));
          }
        }
      }

      await refreshPlaces();
      switchPlace(newPlace.id);
      navigate('/places', { replace: true });
    } catch (err) {
      console.error(err);
      alert('Erro ao criar o Local. Tente novamente.');
    }
    setLoading(false);
  };

  return (
    <div style={{ paddingBottom: '80px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px', gap: '12px' }}>
        <Link to="/places" style={{ color: 'var(--text-main)' }}><ArrowLeft /></Link>
        <h2 style={{ fontSize: '1.25rem' }}>Novo Local</h2>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="card" style={{ marginBottom: 0 }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Nome do Local</label>
          <input
            className="input-field"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ex: Casa da Praia"
            autoFocus
            required
          />
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <label style={{ display: 'block', marginBottom: '12px', fontWeight: 500 }}>Como você quer começar?</label>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label
              style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '12px',
                border: `2px solid ${mode === 'empty' ? 'var(--primary)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-lg)', cursor: 'pointer',
                background: mode === 'empty' ? 'rgba(79, 70, 229, 0.04)' : 'transparent',
              }}
            >
              <input
                type="radio"
                name="mode"
                value="empty"
                checked={mode === 'empty'}
                onChange={() => setMode('empty')}
              />
              <Sparkles color="var(--primary)" size={20} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>Começar vazio</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Apenas os corredores padrão. Você cadastra os produtos depois.
                </div>
              </div>
            </label>

            {presets.map((preset) => (
              <label
                key={preset.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '12px',
                  border: `2px solid ${mode === preset.slug ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-lg)', cursor: 'pointer',
                  background: mode === preset.slug ? 'rgba(79, 70, 229, 0.04)' : 'transparent',
                }}
              >
                <input
                  type="radio"
                  name="mode"
                  value={preset.slug}
                  checked={mode === preset.slug}
                  onChange={() => setMode(preset.slug)}
                />
                <Sparkles color="var(--primary)" size={20} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{preset.name}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {preset.description || 'Começa com um catálogo mínimo pronto.'}
                  </div>
                </div>
              </label>
            ))}

            {places.length > 0 && (
              <label
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '12px',
                  border: `2px solid ${mode === 'copy' ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-lg)', cursor: 'pointer',
                  background: mode === 'copy' ? 'rgba(79, 70, 229, 0.04)' : 'transparent',
                }}
              >
                <input
                  type="radio"
                  name="mode"
                  value="copy"
                  checked={mode === 'copy'}
                  onChange={() => setMode('copy')}
                />
                <Copy color="var(--primary)" size={20} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>Copiar de outro Local</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Traz os corredores e produtos. Depois cada Local é independente.
                  </div>
                </div>
              </label>
            )}
          </div>

          {mode === 'copy' && (
            <div style={{ marginTop: '12px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: 500 }}>
                Copiar de:
              </label>
              <select
                className="input-field"
                value={sourcePlaceId}
                onChange={e => setSourcePlaceId(e.target.value)}
                required
              >
                {places.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <button type="submit" disabled={loading} className="btn btn-primary" style={{ padding: '16px', fontSize: '1.05rem' }}>
          {loading ? 'Criando...' : 'Criar Local'}
        </button>
      </form>
    </div>
  );
}
