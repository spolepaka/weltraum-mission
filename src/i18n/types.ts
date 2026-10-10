export type Language = 'en' | 'de';

export const SUPPORTED_LANGUAGES: readonly Language[] = ['en', 'de'] as const;

export const LANGUAGE_META: Record<Language, { nativeName: string; toggleLabel: string; htmlLang: string; title: string }> = {
  en: { nativeName: 'English', toggleLabel: '🇩🇪 DE', htmlLang: 'en', title: 'Space Mission' },
  de: { nativeName: 'Deutsch', toggleLabel: '🇬🇧 EN', htmlLang: 'de', title: 'Weltraum-Mission' },
};

export interface NamedDesc {
  name: string;
  desc: string;
}

export interface NamedInfo {
  name: string;
  info: string;
}

export interface FeatCopy {
  title: string;
  desc: string;
}

export interface AchCopy {
  name: string;
  desc: string;
}

/**
 * Canonical translation catalog.
 * Add a new language by copying `en.ts` to `xx.ts` and registering it in `index.ts`.
 */
export interface Translations {
  title: string;
  hearts: string;
  coins: string;
  score: string;
  record: string;
  level: string;
  sector: string;
  mapHint: string;
  newFeature: string;
  totalScore: string;
  bestStart: string;
  play: string;
  restart: string;
  continue: string;
  back: string;
  close: string;
  pause: string;
  shop: string;
  levelComplete: string;
  gameOver: string;
  newRecord: string;
  levelUnlocked: string;
  nextLevel: string;
  backToMap: string;
  continueToMap: string;
  playAgain: string;
  bossDefeated: string;
  bossDefeatedSub: string;
  coinsEarned: string;
  collected: string;
  levelBonus: string;
  bossBonus: string;
  starBonus: string;
  nowYouHave: string;
  sectors: {
    home: string;
    nebel: string;
    frost: string;
    sonnen: string;
    asteroid: string;
    schatten: string;
    jenseits: string;
  };
  shopTitle: string;
  shipsHeading: string;
  upgradesHeading: string;
  upgradesForEveryShip: string;
  owned: string;
  equipped: string;
  buy: string;
  equip: string;
  locked: string;
  insufficientCoins: string;
  alreadyOwned: string;
  purchased: string;
  nowEquipped: string;
  backToMapShop: string;
  upgrades: {
    heart: NamedInfo;
    rate: NamedInfo;
    dmg: NamedInfo;
    dur: NamedInfo;
    mag: NamedInfo;
  };
  upgradeMax: string;
  ships: Record<string, { name: string; desc: string; perk: string }>;
  achievements: string;
  achievementsTitle: string;
  rocketEffects: string;
  unlockedByAchievements: string;
  yourRecords: string;
  onlinePlay: string;
  onlineTitle: string;
  onlineIntro: string;
  createRoom: string;
  joinRoom: string;
  roomCode: string;
  roomCodeLabel: string;
  roomFull: string;
  playerBusy: string;
  waiting: string;
  connected: string;
  disconnected: string;
  hostLeft: string;
  enterRoomCode: string;
  connect: string;
  leaveRoom: string;
  startGo: string;
  friendsEnterCode: string;
  onlineFooter: string;
  joinRequests: string;
  approve: string;
  reject: string;
  mute: string;
  fullscreen: string;
  twoPlayer: string;
  twoPlayerOn: string;
  twoPlayerOff: string;
  ghost: string;
  ghostOn: string;
  ghostOff: string;
  reset: string;
  help: string;
  language: string;
  left: string;
  right: string;
  fire: string;
  features: Record<string, string>;
  missions: string;
  dailyMissions: string;
  dailyMissionsIntro: string;
  missionComplete: string;
  missionCompleteToast: string;
  claim: string;
  claimed: string;
  done: string;
  secretCode: string;
  secretPlaceholder: string;
  codeActivated: string;
  invalidCode: string;
  codeAlreadyUsed: string;
  testMode: string;
  synced: string;
  syncing: string;
  offline: string;
  syncError: string;
  loading: string;
  error: string;
  yes: string;
  no: string;
  ok: string;
  cancel: string;
  really: string;
  noGoBack: string;
  helpTitle: string;
  helpClose: string;
  helpIntro: string;
  pauseTitle: string;
  pauseBody: string;
  resume: string;
  breakTitle: string;
  breakBody: string;
  breakSaved: string;
  breakOk: string;
  breakGo: string;
  resetTitle: string;
  resetBody: string;
  resetYes: string;
  howTo: string;
  account: {
    button: string;
    title: string;
    guest: string;
    signedIn: string;
    playerId: string;
    status: string;
    online: string;
    offline: string;
    saved: string;
    signIn: string;
    signInSave: string;
    google: string;
    emailLink: string;
    emailPlaceholder: string;
    emailSent: string;
    apple: string;
    signOut: string;
    close: string;
    needConfig: string;
    needConfigDetail: string;
    linking: string;
    linked: string;
    linkFailed: string;
    anonymousPlay: string;
  };
  game: {
    neuBanner: string;
    bossLevel: string;
    letsGo: string;
    defeatBoss: string;
    bossDefeatedShort: string;
    bossComing: string;
    levelLocked: string;
    universeSaved: string;
    allLevelsDone: string;
    newGalaxy: string;
    newShipUnlocked: string;
    swallowed: string;
    swallowedScore: string;
    bossScore: string;
    missionEnded: string;
    holeDeath: string;
    wellDone: string;
    shotStats: string;
    coinsCollectedOver: string;
    lookInShop: string;
    shieldActive: string;
    tripleShot: string;
    laser: string;
    shieldCharging: string;
    magnet: string;
    slowFire: string;
    bossAlarm: string;
    phase: string;
    shieldIncoming: string;
    immune: string;
    safe: string;
    yourGhost: string;
    ghostPoints: string;
    again: string;
    sectorBoss: string;
    finale: string;
    boss: string;
    goldRain: string;
    satelliteDown: string;
    treasure: string;
    cometHit: string;
    missionMapReward: string;
    twoPlayerOnMsg: string;
    onePlayer: string;
    connectionLost: string;
    beatFirst: string;
    together: string;
    newRecordGhost: string;
    extraHeart: string;
  };
  canvas: {
    bossAlarm: string;
    slowFire: string;
    shieldIncoming: string;
    immune: string;
    safe: string;
    yourGhost: string;
    ghostPoints: string;
    again: string;
    sectorBoss: string;
    finale: string;
    boss: string;
    newLabel: string;
  };
  feats: Record<string, FeatCopy>;
  ach: Record<string, AchCopy>;
  missionText: {
    rocks: string;
    ufos: string;
    coins: string;
    levels: string;
    boss: string;
    nohit: string;
    stars: string;
    powers: string;
  };
  helpItems: string[];
  confirm: {
    yes: string;
    no: string;
  };
  bosses: Record<string, string>;
  bossNouns: Record<string, string[]>;
  bossAdj: string[];
  bossShort: Record<string, string>;
  youScored: string;
  tips: Record<string, string>;
  skins: Record<string, string>;
}
