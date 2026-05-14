import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';
import { usePlace } from './PlaceContext';
import { fetchActiveCatalogPresets, applyCatalogPreset } from './catalogPresets';
import { Home, Users, Plus, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const DEFAULT_AREAS = ['Hortifruti', 'Padaria', 'Frios', 'Açougue', 'Limpeza', 'Mercearia'];

export default function Welcome() {
  const { user } = useAuth();
  const { refreshPlaces } = usePlace();
  const navigate = useNavigate();

  const [mode, setMode] = useState(null); // null | 'create' | 'join'
  const [placeName, setPlaceName] = useState('Casa');
  const [inviteCode, setInviteCode] = useState('');
  const [presets, setPresets] = useState([]);
  const [startOption, setStartOption] = useState('empty');
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

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!placeName.trim()) return;
    setLoading(true);
    try {
      const { data: newPlace, error: e1 } = await supabase
        .from('places')
        .insert([{ name: placeName.trim() }])
        .select()
        .single();
      if (e1) throw e1;

      const { error: e2 } = await supabase
        .from('user_places')
        .insert([{ user_id: user.id, place_id: newPlace.id }]);
      if (e2) throw e2;

      if (startOption === 'empty') {
        const areasToInsert = DEFAULT_AREAS.map((name, i) => ({
          place_id: newPlace.id,
          name,
          order_index: i,
        }));
        await supabase.from('areas').insert(areasToInsert);
      } else {
        await applyCatalogPreset(newPlace.id, startOption);
      }

      window.localStorage.setItem('currentPlaceId', newPlace.id);
      await refreshPlaces();
      navigate('/', { replace: true });
    } catch (err) {
      console.error(err);
      alert('Erro ao criar o Local. Tente novamente.');
    }
    setLoading(false);
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    const raw = inviteCode.trim();
    if (!raw) return;

    // Aceita link completo .../join/<token> ou token solto
    let token = raw;
    const match = raw.match(/\/join\/([^/?#\s]+)/i);
    if (match) token = match[1];

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('redeem_place_invite', { invite_token: token });
      if (error) {
        const msg = (error.message || '').toUpperCase();
        if (msg.includes('NOT_FOUND'))  { alert('Convite inválido. Verifique o link.'); setLoading(false); return; }
        if (msg.includes('EXPIRED'))    { alert('Este link expirou. Peça um novo.'); setLoading(false); return; }
        if (msg.includes('EXHAUSTED'))  { alert('Este link já foi usado o número máximo de vezes. Peça um novo.'); setLoading(false); return; }
        throw error;
      }

      const row = Array.isArray(data) ? data[0] : data;
      if (row?.place_id) {
        window.localStorage.setItem('currentPlaceId', row.place_id);
      }
      await refreshPlaces();
      navigate('/', { replace: true });
    } catch (err) {
      console.error(err);
      alert('Erro ao entrar no Local.');
    }
    setLoading(false);
  };

  if (mode === null) {
    return (
      <div style={{ padding: '20px 0' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🛒</div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Bem-vindo ao Comprou?</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            Antes de começar, vamos configurar seu primeiro Local de compras.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            onClick={() => setMode('create')}
            className="card"
            style={{
              display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer',
              border: '2px solid var(--primary)', textAlign: 'left', marginBottom: 0,
              background: 'var(--surface)',
            }}
          >
            <div style={{ padding: '12px', backgroundColor: 'rgba(79, 70, 229, 0.1)', borderRadius: '12px' }}>
              <Plus color="var(--primary)" size={24} />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: '1.125rem', marginBottom: '4px' }}>Criar novo Local</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                Ex: Casa, Sítio, Apartamento da Praia
              </p>
            </div>
            <ArrowRight color="var(--text-muted)" size={20} />
          </button>

          <button
            onClick={() => setMode('join')}
            className="card"
            style={{
              display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer',
              textAlign: 'left', marginBottom: 0, background: 'var(--surface)',
            }}
          >
            <div style={{ padding: '12px', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px' }}>
              <Users color="var(--secondary)" size={24} />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: '1.125rem', marginBottom: '4px' }}>Entrar com código compartilhado do Local</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                Recebeu um código de alguém? Cole aqui.
              </p>
            </div>
            <ArrowRight color="var(--text-muted)" size={20} />
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'create') {
    return (
      <div style={{ padding: '20px 0' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Criar novo Local</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
          Dê um nome ao seu Local. Você pode renomear depois.
        </p>

        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card" style={{ marginBottom: 0 }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Nome do Local</label>
            <input
              className="input-field"
              value={placeName}
              onChange={e => setPlaceName(e.target.value)}
              placeholder="Ex: Casa"
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
                  border: `2px solid ${startOption === 'empty' ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-lg)', cursor: 'pointer',
                  background: startOption === 'empty' ? 'rgba(79, 70, 229, 0.04)' : 'transparent',
                }}
              >
                <input
                  type="radio"
                  name="startOption"
                  value="empty"
                  checked={startOption === 'empty'}
                  onChange={() => setStartOption('empty')}
                />
                <Plus color="var(--primary)" size={20} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>Começar vazio</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Cria só os corredores padrão. Você cadastra os produtos depois.
                  </div>
                </div>
              </label>

              {presets.map((preset) => (
                <label
                  key={preset.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '12px',
                    border: `2px solid ${startOption === preset.slug ? 'var(--primary)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-lg)', cursor: 'pointer',
                    background: startOption === preset.slug ? 'rgba(79, 70, 229, 0.04)' : 'transparent',
                  }}
                >
                  <input
                    type="radio"
                    name="startOption"
                    value={preset.slug}
                    checked={startOption === preset.slug}
                    onChange={() => setStartOption(preset.slug)}
                  />
                  <Home color="var(--primary)" size={20} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{preset.name}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {preset.description || 'Começa com um catálogo mínimo pronto.'}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setMode(null)}
              className="btn"
              style={{ flex: 1, backgroundColor: 'var(--background)', color: 'var(--text-main)' }}
            >
              Voltar
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ flex: 2 }}>
              {loading ? 'Criando...' : 'Criar Local'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (mode === 'join') {
    return (
      <div style={{ padding: '20px 0' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Entrar com código compartilhado do Local</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
          Cole abaixo o código que a outra pessoa enviou.
        </p>

        <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card" style={{ marginBottom: 0 }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Link de convite</label>
            <input
              className="input-field"
              value={inviteCode}
              onChange={e => setInviteCode(e.target.value)}
              placeholder="Cole o link aqui"
              autoFocus
              required
              style={{ fontSize: '0.9rem' }}
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
              Pode colar o link inteiro que vem no WhatsApp — o app entende.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setMode(null)}
              className="btn"
              style={{ flex: 1, backgroundColor: 'var(--background)', color: 'var(--text-main)' }}
            >
              Voltar
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ flex: 2 }}>
              {loading ? 'Entrando...' : 'Entrar no Local'}
            </button>
          </div>
        </form>
      </div>
    );
  }
}
