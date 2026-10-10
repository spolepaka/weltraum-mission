export const en = {
  title: 'Space Mission',
  
  // HUD
  hearts: 'Hearts',
  coins: 'Coins',
  score: 'Score',
  record: 'Record',
  
  // Level
  level: 'Level',
  sector: 'Sector',
  
  // Map screen
  mapHint: 'Tap on a planet!',
  newFeature: 'NEW',
  totalScore: 'Total Score',
  bestStart: 'Best Start',
  
  // Buttons
  play: 'Play',
  restart: 'Restart',
  continue: 'Continue',
  back: 'Back',
  close: 'Close',
  pause: 'Pause',
  shop: 'Shop',
  
  // Game states
  levelComplete: 'Level Complete!',
  gameOver: 'Game Over',
  newRecord: 'New Record!',
  levelUnlocked: 'Level {level} is now open!',
  
  // Win screen
  nextLevel: 'Next Level',
  backToMap: 'Back to Map',
  
  // Sectors
  sectors: {
    home: 'Home Galaxy',
    nebel: 'Nebula Galaxy',
    frost: 'Frost Galaxy',
    sonnen: 'Solar Galaxy',
    asteroid: 'Asteroid Belt',
    schatten: 'Shadow Galaxy',
    jenseits: 'Beyond Galaxy',
  },
  
  // Shop
  shopTitle: 'Spaceship Hangar',
  owned: 'Owned',
  equipped: 'Equipped',
  buy: 'Buy',
  equip: 'Equip',
  locked: 'Locked',
  insufficientCoins: 'Not enough coins!',
  alreadyOwned: 'Already owned!',
  purchased: 'Purchased!',
  
  // Upgrades
  upgrades: {
    heart: { name: 'Extra Heart', info: '+1 heart (once)' },
    rate: { name: 'Fire Rate', info: 'Fire faster' },
    dmg: { name: 'Damage', info: '+25% damage per level' },
    dur: { name: 'Power-up Duration', info: 'Power-ups last longer' },
    mag: { name: 'Coin Magnet', info: 'Coins fly to you' },
  },
  upgradeMax: 'MAX',
  
  // Ships (keeping short descriptions)
  ships: {
    starter: { name: 'Starter Rocket', desc: 'Your trusty first rocket. Reliable and brave!' },
    blitz: { name: 'Lightning Hunter', desc: 'Super fast! Flies faster and shoots faster.' },
    komet: { name: 'Comet Glider', desc: 'Blazing fast and tiny like a comet. Harder to hit!' },
  },
  
  // Achievements
  achievements: 'Achievements',
  
  // Online
  onlinePlay: 'Online Co-op',
  createRoom: 'Create Room',
  joinRoom: 'Join Room',
  roomCode: 'Room Code',
  roomFull: 'Room is full',
  playerBusy: 'Player is busy',
  waiting: 'Waiting for players...',
  connected: 'Connected!',
  disconnected: 'Disconnected',
  hostLeft: 'Host left the game',
  
  // Settings
  mute: 'Sound On/Off',
  fullscreen: 'Fullscreen',
  twoPlayer: '2 Player Mode',
  ghost: 'Ghost Mode',
  reset: 'Reset Progress',
  help: 'Help',
  language: 'Language',
  
  // Controls
  left: 'Left',
  right: 'Right',
  fire: 'Fire',
  
  // Features
  features: {
    meteor: 'Meteors',
    sniper: 'Snipers',
    worm: 'Wormholes',
    flare: 'Solar Flares',
    mines: 'Mines',
    wells: 'Gravity Wells',
    cloak: 'Cloaked UFOs',
    grid: 'Laser Grid',
    missile: 'Missiles',
    storm: 'Hole Storm',
    wind: 'Solar Wind',
    holes: 'Black Holes',
    icy: 'Ice Rain',
    ion: 'Ion Storm',
    magm: 'Magnet Mines',
    sat: 'Shield Satellite',
  },
  
  // Missions
  missions: 'Missions',
  missionComplete: 'Mission Complete!',
  claim: 'Claim',
  
  // Secret codes
  secretCode: 'Secret Code',
  codeActivated: 'Code activated!',
  invalidCode: 'Invalid code',
  codeAlreadyUsed: 'Code already used',
  testMode: 'Test Mode: All levels unlocked!',
  
  // Sync status
  synced: 'Progress saved',
  syncing: 'Saving...',
  offline: 'Offline',
  syncError: 'Sync failed',
  
  // Misc
  loading: 'Loading...',
  error: 'Error',
  yes: 'Yes',
  no: 'No',
  ok: 'OK',
  cancel: 'Cancel',
};

export type Translations = typeof en;
