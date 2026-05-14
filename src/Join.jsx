import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';
import { usePlace } from './PlaceContext';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Home, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function Join() {
  const { token } = useParams();
  const { user, loading: authLoading } = useAuth();
  const { refreshPlaces, switchPlace } = usePlace();
  const navigate = useNavigate();

  const [status, setStatus] = useState('working'); // 'working' | 'ok' | 'error'
  const [message, setMessage] = useState('Estamos te adicionando ao Local...');
  const [placeName, setPlaceName] = useState(null);

  useEffect(() => {
    if (authLoading) return;

    // Se não está logado, guarda o token e manda pro login
    if (!user) {
      window.localStorage.setItem('pendingJoinToken', token);
      navigate('/login', { replace: true });
      return;
    }

    redeem();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, token]);

  const redeem = async () => {
    setStatus('working');
    try {
      const { data, error } = await supabase.rpc('redeem_place_invite', { invite_token: token });

      if (error) {
        const msg = (error.message || '').toUpperCase();
        if (msg.includes('NOT_FOUND'))   throw new Error('Convite inválido. Talvez tenha sido digitado errado.');
        if (msg.includes('EXPIRED'))     throw new Error('Este link de convite expirou. Peça um novo para quem te chamou.');
        if (msg.includes('EXHAUSTED'))   throw new Error('Este link já foi usado o número máximo de vezes. Peça um novo.');
        if (msg.includes('AUTHENTICATED'))throw new Error('Você precisa estar logado para entrar.');
        throw new Error('Não conseguimos te adicionar agora. Tente de novo em alguns segundos.');
      }

      const row = Array.isArray(data) ? data[0] : data;
      const newPlaceId = row?.place_id;
      const newPlaceName = row?.place_name;

      setPlaceName(newPlaceName || 'Local');
      setMessage(`Você foi adicionado ao Local "${newPlaceName}".`);
      setStatus('ok');

      // Limpa token pendente, atualiza contexto e navega
      window.localStorage.removeItem('pendingJoinToken');
      window.localStorage.setItem('currentPlaceId', newPlaceId);
      await refreshPlaces();
      if (newPlaceId) switchPlace(newPlaceId);

      setTimeout(() => navigate('/', { replace: true }), 1400);
    } catch (err) {
      console.error(err);
      setMessage(err.message || 'Erro ao processar o convite.');
      setStatus('error');
    }
  };

  return (
    <div style={{ padding: '40px 0', textAlign: 'center' }}>
      {status === 'working' && (
        <>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>⏳</div>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Validando convite</h2>
          <p style={{ color: 'var(--text-muted)' }}>{message}</p>
        </>
      )}

      {status === 'ok' && (
        <>
          <CheckCircle2 size={64} color="var(--secondary)" style={{ margin: '0 auto 12px' }} />
          <h2 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Tudo certo!</h2>
          <p style={{ color: 'var(--text-muted)' }}>{message}</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '12px' }}>Levando você para a lista...</p>
        </>
      )}

      {status === 'error' && (
        <>
          <AlertCircle size={64} color="var(--danger)" style={{ margin: '0 auto 12px' }} />
          <h2 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Não foi possível entrar</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>{message}</p>
          <Link to="/" className="btn btn-primary" style={{ display: 'inline-flex' }}>
            <Home size={18} /> Ir para o app
          </Link>
        </>
      )}
    </div>
  );
}
