import { useSyncExternalStore } from 'react';

function measureKeyboardInset() {
  if (typeof window === 'undefined' || !window.visualViewport) return 0;

  const { height, offsetTop } = window.visualViewport;
  return Math.max(0, window.innerHeight - height - offsetTop);
}

export default function useKeyboardInset(enabled = true) {
  const subscribe = (onStoreChange) => {
    if (!enabled || typeof window === 'undefined' || !window.visualViewport) {
      return () => {};
    }

    const viewport = window.visualViewport;
    viewport.addEventListener('resize', onStoreChange);
    viewport.addEventListener('scroll', onStoreChange);
    window.addEventListener('orientationchange', onStoreChange);

    return () => {
      viewport.removeEventListener('resize', onStoreChange);
      viewport.removeEventListener('scroll', onStoreChange);
      window.removeEventListener('orientationchange', onStoreChange);
    };
  };

  const getSnapshot = () => {
    if (!enabled) return 0;
    return measureKeyboardInset();
  };

  return useSyncExternalStore(subscribe, getSnapshot, () => 0);
}