import React, { useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';
import { usePlace } from './PlaceContext';
import { Copy, Users, ListTree, History as HistoryIcon, Home, Download, Share2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function SettingsPage() {
  const { user } = useAuth();
  const { currentPlace, currentPlaceId, places, refreshPlaces } = usePlace();
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);

  const buildShareMessage = () => {
    const placeName = currentPlace?.name || 'meu Local';
    return (
`🛒 Bora compartilhar nossa lista de compras no app *Comprou?*

Estou te convidando para o Local "${placeName}". A gente vai dividir a mesma lista, catálogo de produtos e corredores do mercado — tudo em tempo real.

Como entrar:
1️⃣ Abra (ou instale) o app: ${window.location.origin}
2️⃣ Entre com sua conta Google.
3️⃣ Na tela de boas-vindas, escolha *"Entrar com código compartilhado do Local"* e cole o código abaixo. (Se você já usa o app, vá em Ajustes → "Recebeu um código?".)

Código do Local:
${currentPlaceId}`
    );
  };

  const copyToClipboard = async () => {
    if (!currentPlaceId) return;
    try {
      await navigator.clipboard.writeText(currentPlaceId);
      alert('Código copiado!');
    } catch {
      alert('Não foi possível copiar automaticamente. Selecione o código e copie manualmente.');
    }
  };

  const shareInvite = async () => {
    if (!currentPlaceId) return;
    const message = buildShareMessage();

    // 1) Tenta a Web Share API (Android/iOS modernos abrem o seletor nativo, incluindo WhatsApp)
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Convite — Comprou?',
          text: message,
        });
        return;
      } catch (err) {
        // Usuário cancelou — não cai pro fallback
        if (err && err.name === 'AbortError') return;
      }
    }

    // 2) Fallback: abre o WhatsApp diretamente em nova aba (funciona desktop e mobile)
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleJoinPlace = async (e) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(inviteCode.trim())) {
      alert('Código inválido. Verifique se copiou e colou inteiro sem espaços a mais.');
      return;
    }

    setLoading(true);
    try {
      const { data: place } = await supabase.from('places').select('id').eq('id', inviteCode.trim()).single();
      if (!place) {
        alert('Local não encontrado com esse código.');
        setLoading(false);
        return;
      }

      const { error } = await supabase.from('user_places').insert([{
        user_id: user.id,
        place_id: inviteCode.trim()
      }]);

      if (error && error.code !== '23505') throw error; // 23505 = unique violation (já é membro)

      alert('Sincronizado com sucesso! Agora vocês dividem este Local.');
      await refreshPlaces();
      window.location.href = '/';
    } catch (err) {
      console.error(err);
      alert('Erro ao tentar entrar no Local.');
    }
    setLoading(false);
  };

  return (
    <div style={{ paddingBottom: '80px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px', gap: '12px' }}>
        <h2 style={{ fontSize: '1.5rem' }}>Configurações</h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Local atual */}
        {currentPlace && (
          <div className="card" style={{ marginBottom: 0, backgroundColor: 'rgba(79, 70, 229, 0.05)', borderColor: 'rgba(79, 70, 229, 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Home color="var(--primary)" size={20} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Local atual</div>
                <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>{currentPlace.name}</div>
              </div>
            </div>
          </div>
        )}

        {/* Meus Locais */}
        <Link to="/places" className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', textDecoration: 'none', color: 'inherit', marginBottom: 0 }}>
          <div style={{ padding: '12px', backgroundColor: 'rgba(79, 70, 229, 0.1)', borderRadius: '12px' }}>
            <Home color="var(--primary)" size={24} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '1.125rem', marginBottom: '4px' }}>Meus Locais</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {places.length === 1 ? '1 Local cadastrado' : `${places.length} Locais cadastrados`} · adicionar, renomear, sair
            </p>
          </div>
        </Link>

        {/* Corredores */}
        <Link to="/areas" className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', textDecoration: 'none', color: 'inherit', marginBottom: 0 }}>
          <div style={{ padding: '12px', backgroundColor: 'rgba(79, 70, 229, 0.1)', borderRadius: '12px' }}>
            <ListTree color="var(--primary)" size={24} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '1.125rem', marginBottom: '4px' }}>Organizar Corredores</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Mude a ordem das áreas deste Local</p>
          </div>
        </Link>

        {/* Histórico */}
        <Link to="/history" className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', textDecoration: 'none', color: 'inherit', marginBottom: 0 }}>
          <div style={{ padding: '12px', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px' }}>
            <HistoryIcon color="var(--secondary)" size={24} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '1.125rem', marginBottom: '4px' }}>Histórico de Compras</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Veja tudo o que você já comprou neste Local</p>
          </div>
        </Link>

        {/* Importar produtos de outro Local — Mitigante 1 */}
        {places.length > 1 && (
          <Link to="/import-products" className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', textDecoration: 'none', color: 'inherit', marginBottom: 0 }}>
            <div style={{ padding: '12px', backgroundColor: 'rgba(124, 58, 237, 0.1)', borderRadius: '12px' }}>
              <Download color="#7C3AED" size={24} />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: '1.125rem', marginBottom: '4px' }}>Importar Produtos</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Copie produtos de outro Local seu para este</p>
            </div>
          </Link>
        )}

        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '8px 0' }} />

        {/* Compartilhamento */}
        <div>
          <h3 style={{ fontSize: '1.125rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={20} color="var(--primary)" />
            Compartilhar este Local
          </h3>

          <div className="card">
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Convide alguém para dividir este Local com você. O app abre o WhatsApp já com a mensagem pronta — basta escolher o contato.
            </p>

            <button
              onClick={shareInvite}
              className="btn btn-primary"
              style={{ width: '100%', padding: '14px', backgroundColor: '#25D366', gap: '8px' }}
            >
              <Share2 size={20} />
              Compartilhar convite no WhatsApp
            </button>

            <details style={{ marginTop: '12px' }}>
              <summary style={{ cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Prefiro copiar o código manualmente
              </summary>
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <input
                  className="input-field"
                  value={currentPlaceId || ''}
                  readOnly
                  style={{ backgroundColor: 'var(--background)', color: 'var(--text-muted)', fontSize: '0.7rem', fontFamily: 'monospace' }}
                />
                <button onClick={copyToClipboard} className="btn" style={{ padding: '0 16px', backgroundColor: 'var(--background)', color: 'var(--primary)' }}>
                  <Copy size={20} />
                </button>
              </div>
            </details>
          </div>

          <div className="card" style={{ marginBottom: 0 }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Recebeu um código? Cole aqui para entrar com código compartilhado do Local:
            </p>
            <form onSubmit={handleJoinPlace} style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
              <input
                className="input-field"
                placeholder="Cole o código grande aqui"
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value)}
                required
              />
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Sincronizando...' : 'Entrar no Local'}
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
