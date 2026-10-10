/**
 * Game Integration Layer
 * Patches the existing game with i18n and SpacetimeDB support
 */

import { initLanguage, getLanguage, toggleLanguage, onLanguageChange, type Language } from './i18n';
import { initSpacetime, getSpacetimeClient, type SyncStatus } from './lib/spacetime-client';

const I18N_STRINGS: Record<string, Record<Language, string>> = {
  // Title and map
  'Weltraum-Mission': { de: 'Weltraum-Mission', en: 'Space Mission' },
  'Weltraum': { de: 'Weltraum', en: 'Space' },
  'Level': { de: 'Level', en: 'Level' },
  'Punkte': { de: 'Punkte', en: 'Score' },
  'Rekord': { de: 'Rekord', en: 'Record' },
  
  // Buttons
  'Spielen': { de: 'Spielen', en: 'Play' },
  'Weiter': { de: 'Weiter', en: 'Continue' },
  'Nächstes Level': { de: 'Nächstes Level', en: 'Next Level' },
  'Zur Karte': { de: 'Zur Karte', en: 'Back to Map' },
  'Neu starten': { de: 'Neu starten', en: 'Restart' },
  'Schließen': { de: 'Schließen', en: 'Close' },
  
  // Map hints
  '👆 Tippe auf einen Planeten!': { de: '👆 Tippe auf einen Planeten!', en: '👆 Tap on a planet!' },
  
  // Shop
  'Raumschiff-Hangar': { de: 'Raumschiff-Hangar', en: 'Spaceship Hangar' },
  'Ausgerüstet': { de: 'Ausgerüstet', en: 'Equipped' },
  'Ausrüsten': { de: 'Ausrüsten', en: 'Equip' },
  'Kaufen': { de: 'Kaufen', en: 'Buy' },
  'Gekauft!': { de: 'Gekauft!', en: 'Purchased!' },
  'Nicht genug Münzen!': { de: 'Nicht genug Münzen!', en: 'Not enough coins!' },
  
  // Upgrades
  '❤️ Extra-Herz': { de: '❤️ Extra-Herz', en: '❤️ Extra Heart' },
  '🔥 Schussgeschwindigkeit': { de: '🔥 Schussgeschwindigkeit', en: '🔥 Fire Rate' },
  '💥 Schaden': { de: '💥 Schaden', en: '💥 Damage' },
  '⏱️ Power-up-Dauer': { de: '⏱️ Power-up-Dauer', en: '⏱️ Power-up Duration' },
  '🧲 Münz-Magnet': { de: '🧲 Münz-Magnet', en: '🧲 Coin Magnet' },
  
  // Game messages
  'Level geschafft!': { de: 'Level geschafft!', en: 'Level Complete!' },
  'Verloren!': { de: 'Verloren!', en: 'Game Over!' },
  'Neuer Rekord!': { de: 'Neuer Rekord!', en: 'New Record!' },
  
  // Online
  'Online Co-op': { de: 'Online Co-op', en: 'Online Co-op' },
  'Raum erstellen': { de: 'Raum erstellen', en: 'Create Room' },
  'Raum beitreten': { de: 'Raum beitreten', en: 'Join Room' },
  'Verbunden!': { de: 'Verbunden!', en: 'Connected!' },
  'Der Raum ist voll': { de: 'Der Raum ist voll', en: 'Room is full' },
  
  // Missions
  'Missionen': { de: 'Missionen', en: 'Missions' },
  'Erfolge': { de: 'Erfolge', en: 'Achievements' },
  
  // Settings
  '2 Spieler': { de: '2 Spieler', en: '2 Player' },
  'Geister': { de: 'Geister', en: 'Ghost' },
  
  // Sectors
  'Heimat-Galaxie': { de: 'Heimat-Galaxie', en: 'Home Galaxy' },
  'Nebel-Galaxie': { de: 'Nebel-Galaxie', en: 'Nebula Galaxy' },
  'Frost-Galaxie': { de: 'Frost-Galaxie', en: 'Frost Galaxy' },
  'Sonnen-Galaxie': { de: 'Sonnen-Galaxie', en: 'Solar Galaxy' },
  'Asteroiden-Gürtel': { de: 'Asteroiden-Gürtel', en: 'Asteroid Belt' },
  'Schatten-Galaxie': { de: 'Schatten-Galaxie', en: 'Shadow Galaxy' },
  'Jenseits-Galaxie': { de: 'Jenseits-Galaxie', en: 'Beyond Galaxy' },
  
  // Secret codes
  'Geheimcode aktiviert!': { de: 'Geheimcode aktiviert!', en: 'Secret code activated!' },
  'Testmodus: Alle Level offen! 🔓': { de: 'Testmodus: Alle Level offen! 🔓', en: 'Test mode: All levels unlocked! 🔓' },
};

function translateText(text: string, lang: Language): string {
  const entry = I18N_STRINGS[text];
  if (entry) {
    return entry[lang];
  }
  
  for (const [, translations] of Object.entries(I18N_STRINGS)) {
    if (translations.de === text) {
      return translations[lang];
    }
  }
  
  return text;
}

let currentLang: Language = 'en';
let syncIndicator: HTMLElement | null = null;

function createSyncIndicator(): void {
  if (syncIndicator) return;
  
  syncIndicator = document.createElement('div');
  syncIndicator.id = 'syncIndicator';
  syncIndicator.style.cssText = `
    position: fixed;
    bottom: 10px;
    left: 10px;
    padding: 6px 12px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: bold;
    z-index: 9999;
    pointer-events: none;
    transition: opacity 0.3s, transform 0.3s;
    opacity: 0;
    transform: translateY(10px);
  `;
  document.body.appendChild(syncIndicator);
}

function updateSyncIndicator(status: SyncStatus): void {
  if (!syncIndicator) createSyncIndicator();
  if (!syncIndicator) return;
  
  const lang = currentLang;
  
  switch (status) {
    case 'connected':
      syncIndicator.textContent = lang === 'de' ? '✓ Gespeichert' : '✓ Saved';
      syncIndicator.style.background = 'rgba(125, 255, 168, 0.9)';
      syncIndicator.style.color = '#1a4a2a';
      syncIndicator.style.opacity = '1';
      syncIndicator.style.transform = 'translateY(0)';
      setTimeout(() => {
        if (syncIndicator) {
          syncIndicator.style.opacity = '0';
          syncIndicator.style.transform = 'translateY(10px)';
        }
      }, 2000);
      break;
    case 'syncing':
      syncIndicator.textContent = lang === 'de' ? '⟳ Speichern...' : '⟳ Saving...';
      syncIndicator.style.background = 'rgba(125, 200, 255, 0.9)';
      syncIndicator.style.color = '#1a2a4a';
      syncIndicator.style.opacity = '1';
      syncIndicator.style.transform = 'translateY(0)';
      break;
    case 'disconnected':
    case 'error':
      syncIndicator.textContent = lang === 'de' ? '⚠ Offline' : '⚠ Offline';
      syncIndicator.style.background = 'rgba(255, 180, 100, 0.9)';
      syncIndicator.style.color = '#4a2a1a';
      syncIndicator.style.opacity = '1';
      syncIndicator.style.transform = 'translateY(0)';
      break;
    default:
      syncIndicator.style.opacity = '0';
  }
}

function createLanguageToggle(): void {
  const toggle = document.createElement('button');
  toggle.id = 'langBtn';
  toggle.className = 'mapBtn';
  toggle.style.cssText = `
    top: calc(262px + env(safe-area-inset-top));
    left: max(14px, env(safe-area-inset-left));
    font-size: 16px;
    font-weight: bold;
    background: rgba(60, 80, 140, 0.85);
    border-color: #a0c0ff;
  `;
  toggle.textContent = currentLang === 'en' ? '🇩🇪 DE' : '🇬🇧 EN';
  toggle.setAttribute('aria-label', 'Toggle language');
  
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const newLang = toggleLanguage();
    currentLang = newLang;
    toggle.textContent = newLang === 'en' ? '🇩🇪 DE' : '🇬🇧 EN';
    applyTranslations();
    
    const client = getSpacetimeClient();
    client.setLanguage(newLang);
  });
  
  const mapHud = document.getElementById('mapHud');
  if (mapHud) {
    mapHud.appendChild(toggle);
  }
}

function applyTranslations(): void {
  document.title = currentLang === 'de' ? 'Weltraum-Mission' : 'Space Mission';
  document.documentElement.lang = currentLang;
  
  const textNodes = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null
  );
  
  let node: Text | null;
  while ((node = textNodes.nextNode() as Text | null)) {
    const text = node.textContent?.trim();
    if (text) {
      const translated = translateText(text, currentLang);
      if (translated !== text) {
        node.textContent = node.textContent?.replace(text, translated) || null;
      }
    }
  }
}

function setupErrorReporting(): void {
  const client = getSpacetimeClient();
  
  window.addEventListener('error', (event) => {
    client.reportError({
      errorType: 'uncaught_error',
      message: event.message,
      stack: event.error?.stack,
      context: JSON.stringify({
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      }),
    });
  });
  
  window.addEventListener('unhandledrejection', (event) => {
    client.reportError({
      errorType: 'unhandled_rejection',
      message: String(event.reason),
      stack: event.reason?.stack,
    });
  });
}

function hookGameEvents(): void {
  const client = getSpacetimeClient();
  
  const originalSave = (window as unknown as { saveProgress?: (...args: unknown[]) => void }).saveProgress;
  if (typeof originalSave === 'function') {
    (window as unknown as { saveProgress: (...args: unknown[]) => void }).saveProgress = function(...args: unknown[]) {
      originalSave.apply(this, args);
      
      const progress = (window as unknown as { progress?: { unlocked?: number; stars?: Record<string, { stars: number; bestScore: number }> } }).progress;
      if (progress) {
        const shop = (window as unknown as { shop?: { coins?: number; equipped?: string; owned?: string[]; up?: Record<string, number> } }).shop;
        const coins = BigInt(shop?.coins || 0);
        const equipped = shop?.equipped || 'starter';
        client.syncProgress(progress.unlocked || 1, coins, equipped);
        
        const levelStars = progress.stars || {};
        for (const [levelStr, starData] of Object.entries(levelStars)) {
          const level = parseInt(levelStr, 10);
          if (!isNaN(level) && starData) {
            client.syncLevelStars(level, starData.stars, BigInt(starData.bestScore || 0));
          }
        }
        
        const localData = client.getLocalData();
        localData.coins = coins;
        localData.equippedShip = equipped;
        localData.ownedShips = shop?.owned || ['starter'];
        localData.upgrades = shop?.up || {};
        localData.language = currentLang;
        client.saveLocalData(localData);
      }
    };
  }
}

export async function initGameIntegration(): Promise<void> {
  console.log('[GameIntegration] Initializing...');
  
  initLanguage();
  currentLang = getLanguage();
  
  onLanguageChange((lang) => {
    currentLang = lang;
    applyTranslations();
  });
  
  createSyncIndicator();
  
  const client = getSpacetimeClient();
  client.onStatusChange(updateSyncIndicator);
  
  await initSpacetime();
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      createLanguageToggle();
      setupErrorReporting();
      hookGameEvents();
      applyTranslations();
    });
  } else {
    createLanguageToggle();
    setupErrorReporting();
    hookGameEvents();
    applyTranslations();
  }
  
  console.log('[GameIntegration] Ready, language:', currentLang);
}

// Extend global with game integration
if (typeof window !== 'undefined') {
  (window as typeof window & { initGameIntegration?: typeof initGameIntegration }).initGameIntegration = initGameIntegration;
  initGameIntegration();
}
