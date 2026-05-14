import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

/**
 * Captura o evento `beforeinstallprompt` do Chrome/Edge/Android e oferece
 * um botão flutuante "Instalar App". Em iOS (Safari) mostra dica para usar
 * "Compartilhar → Adicionar à Tela Inicial", pois iOS não dispara o evento.
 */
export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [dismissed, setDismissed] = useState(
    typeof window !== 'undefined' && window.localStorage.getItem('pwa-install-dismissed') === '1'
  );
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    if (isStandalone) return; // já instalado

    // iOS Safari não emite beforeinstallprompt
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const iosDismissed = window.localStorage.getItem('pwa-ios-hint-dismissed') === '1';
    if (isIos && !iosDismissed) {
      setShowIosHint(true);
      return;
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setDeferredPrompt(null));

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    window.localStorage.setItem('pwa-install-dismissed', '1');
    setDismissed(true);
  };

  const handleDismissIos = () => {
    window.localStorage.setItem('pwa-ios-hint-dismissed', '1');
    setShowIosHint(false);
  };

  if (dismissed) return null;

  if (showIosHint) {
    return (
      <div style={banner}>
        <div style={{ flex: 1, fontSize: '0.875rem', lineHeight: 1.4 }}>
          Para instalar o app no iPhone: toque em <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>.
        </div>
        <button onClick={handleDismissIos} style={dismissBtn} aria-label="Fechar dica">
          <X size={18} />
        </button>
      </div>
    );
  }

  if (!deferredPrompt) return null;

  return (
    <div style={banner}>
      <button onClick={handleInstall} className="btn btn-primary" style={{ flex: 1, padding: '10px 14px', fontSize: '0.95rem' }}>
        <Download size={18} />
        Instalar app na tela inicial
      </button>
      <button onClick={handleDismiss} style={dismissBtn} aria-label="Dispensar">
        <X size={18} />
      </button>
    </div>
  );
}

const banner = {
  position: 'fixed',
  bottom: '80px',
  left: '12px',
  right: '12px',
  padding: '10px 12px',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-lg)',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  zIndex: 200,
  maxWidth: '600px',
  margin: '0 auto',
};

const dismissBtn = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text-muted)',
  padding: '8px',
  display: 'flex',
  alignItems: 'center',
};
