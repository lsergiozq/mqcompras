import React, { useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';
import { usePlace } from './PlaceContext';
import { Copy, Users, ListTree, History as HistoryIcon, Home, Download, Share2 } from 'lucide-react';
import { Link } from 'react-router-dom';

// Gera token curto e legível (sem ambiguidade 0/O, 1/l/I) — 12 chars ≈ 70 bits
function generateInviteToken(len = 12) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnpqrstuvwxyz';
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[arr[i] % alphabet.length];
  return out;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { currentPlace, currentPlaceId, places, refreshPlaces } = usePlace();
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState(false);

  // Gera um link de convite NOVO (válido 48h ou 5 usos) e devolve a URL completa
  const createInviteLink = async () => {
    if (!currentPlaceId) return null;
    const token = generateInviteToken();
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase.from('place_invites').insert([{
      token,
      place_id: currentPlaceId,
      created_by: user.id,
      expires_at: expiresAt,
      max_uses: 5,
      uses: 0,
    }]);

    if (error) {
      console.error(error);
      alert('Não foi possível gerar o link de convite. Tente novamente.');
      return null;
    }

    return `${window.location.origin}/join/${token}`;
  };

  const buildShareMessage = (inviteUrl) => {
    const placeName = currentPlace?.name || 'meu Local';
    return (
`🛒 Bora compartilhar nossa lista de compras no app *Comprou?*

Estou te convidando para o Local "${placeName}". A gente vai dividir a mesma lista, catálogo de produtos e corredores do mercado — tudo em tempo real.

É só clicar no link abaixo, fazer login com Google e pronto, você já entra direto:

${inviteUrl}

(O link vale por 48 horas.)`
    );
  };

  const copyToClipboard = async () => {
    if (!currentPlaceId || sharing) return;
    setSharing(true);
    try {
      const url = await createInviteLink();
      if (!url) return;
      await navigator.clipboard.writeText(url);
      alert('Link copiado! Vale por 48 horas.');
    } catch {
      alert('Não foi possível copiar automaticamente.');
    } finally {
      setSharing(false);
    }
  };

  const shareInvite = async () => {
    if (!currentPlaceId || sharing) return;
    setSharing(true);
    try {
      const url = await createInviteLink();
      if (!url) return;
      const message = buildShareMessage(url);

      // 1) Web Share API (celular abre seletor nativo)
      if (navigator.share) {
        try {
          await navigator.share({
            title: 'Convite — Comprou?',
            text: message,
            url, // alguns apps usam isso como link preview
          });
          return;
        } catch (err) {
          if (err && err.name === 'AbortError') return;
        }
      }

      // 2) Fallback: WhatsApp Web/app via wa.me
      const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    } finally {
      setSharing(false);
    }
  };

  const handleJoinPlace = async (e) => {
    e.preventDefault();
    const raw = inviteCode.trim();
    if (!raw) return;

    // Aceita: 1) link completo .../join/<token>  2) token solto
    let token = raw;
    const match = raw.match(/\/join\/([^/?#\s]+)/i);
    if (match) token = match[1];

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('redeem_place_invite', { invite_token: token });

      if (error) {
        const msg = (error.message || '').toUpperCase();
        if (msg.includes('NOT_FOUND'))    { alert('Convite inválido. Verifique o link.'); setLoading(false); return; }
        if (msg.includes('EXPIRED'))      { alert('Este link de convite expirou. Peça um novo.'); setLoading(false); return; }
        if (msg.includes('EXHAUSTED'))    { alert('Este link já foi usado o número máximo de vezes. Peça um novo.'); setLoading(false); return; }
        throw error;
      }

      const row = Array.isArray(data) ? data[0] : data;
      alert(`Pronto! Você entrou no Local "${row?.place_name || ''}".`);
      await refreshPlaces();
      if (row?.place_id) {
        window.localStorage.setItem('currentPlaceId', row.place_id);
      }
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
              Gere um link e mande pelo WhatsApp. A pessoa clica, faz login com Google e entra direto neste Local. Cada link vale por <b>48 horas</b> ou até <b>5 entradas</b>.
            </p>

            <button
              onClick={shareInvite}
              disabled={sharing}
              className="btn btn-primary"
              style={{ width: '100%', padding: '14px', backgroundColor: '#25D366', gap: '8px', opacity: sharing ? 0.7 : 1 }}
            >
              <Share2 size={20} />
              {sharing ? 'Gerando link...' : 'Compartilhar convite no WhatsApp'}
            </button>

            <button
              onClick={copyToClipboard}
              disabled={sharing}
              className="btn"
              style={{
                width: '100%', padding: '12px', marginTop: '8px',
                backgroundColor: 'var(--background)', color: 'var(--primary)', gap: '8px',
                opacity: sharing ? 0.7 : 1
              }}
            >
              <Copy size={18} />
              {sharing ? 'Gerando...' : 'Só copiar o link'}
            </button>
          </div>

          <div className="card" style={{ marginBottom: 0 }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Recebeu um link de convite e prefere colar manualmente? Cole o link (ou só o código dele) aqui:
            </p>
            <form onSubmit={handleJoinPlace} style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
              <input
                className="input-field"
                placeholder="Cole o link aqui"
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value)}
                required
              />
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Entrando...' : 'Entrar no Local'}
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
