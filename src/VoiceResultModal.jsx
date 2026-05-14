import { useState } from 'react';
import { X, Mic, CheckCircle2, AlertCircle, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Mostra o resumo da entrada por voz:
 *  - "Vou adicionar": lista com checkbox (desmarque para não adicionar aquele item)
 *  - "Não encontrei": lista com botão "Cadastrar este produto"
 *
 * Props:
 *  open: bool
 *  transcript: string (o que foi falado, pra debug/transparência)
 *  matched: [{ phrase, product }]    -> itens reconhecidos
 *  unmatched: [string]               -> palavras que não bateram no catálogo
 *  onCancel: () => void
 *  onConfirm: (selectedProducts: Product[]) => void
 */
export default function VoiceResultModal({ open, transcript, matched, unmatched, onCancel, onConfirm }) {
  const navigate = useNavigate();
  const [excluded, setExcluded] = useState(new Set()); // ids excluídos

  if (!open) return null;

  const toggleExcluded = (id) => {
    setExcluded(prev => {
      const ns = new Set(prev);
      if (ns.has(id)) ns.delete(id); else ns.add(id);
      return ns;
    });
  };

  const handleConfirm = () => {
    const toAdd = matched
      .filter(m => !excluded.has(m.product.id))
      .map(m => m.product);
    onConfirm(toAdd);
  };

  const goRegister = (suggestedName) => {
    onCancel();
    navigate('/add', { state: { suggestedName } });
  };

  const willAddCount = matched.length - excluded.size;

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        zIndex: 1000, padding: '0',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '600px', background: 'var(--surface)',
          borderTopLeftRadius: '20px', borderTopRightRadius: '20px',
          padding: '20px 16px', maxHeight: '85vh', overflowY: 'auto',
          paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Mic size={20} color="var(--primary)" />
          <h3 style={{ flex: 1, fontSize: '1.1rem' }}>O que entendi</h3>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
            <X size={20} color="var(--text-muted)" />
          </button>
        </div>

        {transcript && (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px', fontStyle: 'italic' }}>
            "{transcript}"
          </p>
        )}

        {matched.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <CheckCircle2 size={16} color="var(--secondary)" />
              <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                Vou adicionar {willAddCount} {willAddCount === 1 ? 'item' : 'itens'}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
              {matched.map(({ phrase, product }) => {
                const isOff = excluded.has(product.id);
                return (
                  <div
                    key={product.id}
                    onClick={() => toggleExcluded(product.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '10px 12px', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-lg)', cursor: 'pointer',
                      background: isOff ? 'transparent' : 'rgba(16, 185, 129, 0.06)',
                      opacity: isOff ? 0.5 : 1,
                    }}
                  >
                    <input type="checkbox" checked={!isOff} readOnly />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, textDecoration: isOff ? 'line-through' : 'none' }}>
                        {product.name}
                      </div>
                      {phrase.toLowerCase() !== product.name.toLowerCase() && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Você falou: "{phrase}"
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {unmatched.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <AlertCircle size={16} color="var(--danger)" />
              <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Não encontrei no catálogo</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
              {unmatched.map((name) => (
                <div
                  key={name}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 12px', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                  }}
                >
                  <div style={{ flex: 1, fontWeight: 500 }}>{name}</div>
                  <button
                    onClick={() => goRegister(name)}
                    className="btn"
                    style={{ padding: '6px 10px', backgroundColor: 'var(--background)', color: 'var(--primary)', fontSize: '0.8rem', gap: '4px' }}
                  >
                    <Plus size={14} /> Cadastrar
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {matched.length === 0 && unmatched.length === 0 && (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
            Não consegui entender nada. Tente falar mais devagar e claro.
          </p>
        )}

        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <button onClick={onCancel} className="btn" style={{ flex: 1, backgroundColor: 'var(--background)', color: 'var(--text-main)' }}>
            Cancelar
          </button>
          {matched.length > 0 && (
            <button
              onClick={handleConfirm}
              disabled={willAddCount === 0}
              className="btn btn-primary"
              style={{ flex: 2, opacity: willAddCount === 0 ? 0.5 : 1 }}
            >
              Adicionar {willAddCount} {willAddCount === 1 ? 'item' : 'itens'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
