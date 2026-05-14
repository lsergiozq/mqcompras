import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';
import { usePlace } from './PlaceContext';
import { History as HistoryIcon, Image as ImageIcon, Calendar, ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function History() {
  const { user } = useAuth();
  const { currentPlaceId } = usePlace();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && currentPlaceId) loadHistory();
  }, [user, currentPlaceId]);

  const loadHistory = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('list_items')
      .select(`
        id, quantity, archived_at,
        product:products(id, name, thumbnail_url)
      `)
      .eq('place_id', currentPlaceId)
      .not('archived_at', 'is', null)
      .order('archived_at', { ascending: false });

    if (data) setItems(data);
    setLoading(false);
  };

  // Agrupa por data (yyyy-mm-dd) usando o fuso local
  const groupByDay = items.reduce((acc, item) => {
    if (!item.archived_at) return acc;
    const d = new Date(item.archived_at);
    const key = d.toISOString().slice(0, 10); // yyyy-mm-dd estável p/ ordenação
    if (!acc[key]) acc[key] = { date: d, items: [] };
    acc[key].items.push(item);
    return acc;
  }, {});

  const sortedDays = Object.keys(groupByDay).sort((a, b) => b.localeCompare(a));

  const formatDay = (d) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const dayDate = new Date(d);
    dayDate.setHours(0, 0, 0, 0);

    if (dayDate.getTime() === today.getTime()) return 'Hoje';
    if (dayDate.getTime() === yesterday.getTime()) return 'Ontem';

    return d.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <div style={{ paddingBottom: '80px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
        <Link to="/settings" style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
          <ChevronLeft size={24} />
        </Link>
        <h2 style={{ fontSize: '1.5rem' }}>Histórico</h2>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
          Carregando...
        </div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
          <HistoryIcon size={48} style={{ opacity: 0.2, margin: '0 auto 16px' }} />
          <p>Nenhuma compra finalizada ainda.</p>
          <p style={{ fontSize: '0.875rem', marginTop: '8px' }}>
            Finalize uma compra na tela "Lista" para ver o histórico aqui.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {sortedDays.map(dayKey => {
            const group = groupByDay[dayKey];
            return (
              <div key={dayKey}>
                <h3 style={{
                  fontSize: '1rem',
                  marginBottom: '12px',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  textTransform: 'capitalize',
                }}>
                  <Calendar size={18} />
                  {formatDay(group.date)}
                  <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.875rem' }}>
                    · {group.items.length} {group.items.length === 1 ? 'item' : 'itens'}
                  </span>
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {group.items.map(item => (
                    <div key={item.id} className="card" style={{
                      marginBottom: 0,
                      padding: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                    }}>
                      {/* [IMG-OFF] Thumbnail desabilitada.
                      {item.product?.thumbnail_url ? (
                        <img
                          src={item.product.thumbnail_url}
                          alt=""
                          style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{
                          width: 40,
                          height: 40,
                          borderRadius: 8,
                          backgroundColor: 'var(--background)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <ImageIcon size={20} color="var(--text-muted)" />
                        </div>
                      )}
                      */}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>{item.product?.name || 'Produto removido'}</div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Qtd: {item.quantity}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
