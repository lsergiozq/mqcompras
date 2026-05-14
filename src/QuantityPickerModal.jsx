import { useState } from 'react';

const QUICK_AMOUNTS = ['1', '2', '3', '4', '5', '6'];

export default function QuantityPickerModal({
  open,
  title,
  itemName,
  initialQuantity = '1',
  confirmLabel = 'Salvar',
  allowRemove = false,
  onCancel,
  onConfirm,
  onRemove,
}) {
  const [quantity, setQuantity] = useState(initialQuantity);

  if (!open) return null;

  const handleConfirm = () => {
    const nextQuantity = quantity.trim();
    if (!nextQuantity) return;
    onConfirm(nextQuantity);
  };

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 500,
        padding: '16px',
      }}
    >
      <div
        className="card"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '480px',
          marginBottom: 0,
          borderRadius: '20px',
          padding: '20px',
        }}
      >
        <h3 style={{ margin: 0, fontSize: '1.125rem' }}>{title}</h3>
        {itemName && (
          <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {itemName}
          </p>
        )}

        <input
          className="input-field"
          inputMode="decimal"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          placeholder="Ex: 2"
          autoFocus
          style={{
            fontSize: '1.25rem',
            textAlign: 'center',
            marginTop: '16px',
            fontWeight: 700,
          }}
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '12px' }}>
          {QUICK_AMOUNTS.map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => setQuantity(amount)}
              className="btn"
              style={{
                padding: '12px 8px',
                backgroundColor: quantity === amount ? 'var(--primary)' : 'var(--background)',
                color: quantity === amount ? '#fff' : 'var(--text-main)',
              }}
            >
              {amount}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
          {allowRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="btn"
              style={{ backgroundColor: '#FEE2E2', color: 'var(--danger)' }}
            >
              Remover
            </button>
          )}

          <button
            type="button"
            onClick={onCancel}
            className="btn"
            style={{ flex: 1, backgroundColor: 'var(--background)', color: 'var(--text-main)' }}
          >
            Cancelar
          </button>

          <button type="button" onClick={handleConfirm} className="btn btn-primary" style={{ flex: 1 }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}