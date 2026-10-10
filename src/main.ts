/**
 * Weltraum-Mission Main Entry Point
 * Initializes i18n, SpacetimeDB, and game systems
 */

import { initLanguage, getLanguage, setLanguage, toggleLanguage, t, onLanguageChange } from './i18n';
import { initSpacetime, getSpacetimeClient, type SyncStatus, type SpacetimeClient } from './lib/spacetime-client';

declare global {
  interface Window {
    __weltraum?: {
      i18n: {
        t: typeof t;
        getLanguage: typeof getLanguage;
        setLanguage: typeof setLanguage;
        toggleLanguage: typeof toggleLanguage;
        onLanguageChange: typeof onLanguageChange;
      };
      spacetime: SpacetimeClient;
      syncStatus: SyncStatus;
      onSyncStatusChange: (callback: (status: SyncStatus) => void) => () => void;
    };
  }
}

async function init(): Promise<void> {
  console.log('[Weltraum] Initializing...');
  
  initLanguage();
  console.log('[Weltraum] Language:', getLanguage());
  
  const spacetimeClient = getSpacetimeClient();
  
  window.__weltraum = {
    i18n: {
      t,
      getLanguage,
      setLanguage,
      toggleLanguage,
      onLanguageChange,
    },
    spacetime: spacetimeClient,
    syncStatus: 'disconnected',
    onSyncStatusChange: (callback: (status: SyncStatus) => void) => {
      return spacetimeClient.onStatusChange((status: SyncStatus) => {
        if (window.__weltraum) {
          window.__weltraum.syncStatus = status;
        }
        callback(status);
      });
    },
  };
  
  initSpacetime().then((connected) => {
    if (connected) {
      console.log('[Weltraum] SpacetimeDB connected');
    } else {
      console.log('[Weltraum] Running in offline mode');
    }
  }).catch((err) => {
    console.error('[Weltraum] SpacetimeDB init error:', err);
  });
  
  console.log('[Weltraum] Ready');
}

init();

export { t, getLanguage, setLanguage, toggleLanguage };
