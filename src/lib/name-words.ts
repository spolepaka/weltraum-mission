/** Kid-safe word banks for generated pilot names. Keep entries short so patterns fit NAME_MAX. */

export type DeGender = 'm' | 'f' | 'n';
export type DeNoun = { word: string; gender: DeGender };

export const ADJ_EN = [
  'Cosmic', 'Stellar', 'Nova', 'Lunar', 'Solar', 'Comet', 'Orbit', 'Quantum', 'Astro', 'Polar',
  'Ion', 'Turbo', 'Super', 'Mega', 'Ultra', 'Tiny', 'Mighty', 'Happy', 'Silly', 'Lucky',
  'Brave', 'Swift', 'Fuzzy', 'Sparkly', 'Bouncy', 'Zippy', 'Peppy', 'Jolly', 'Sunny', 'Frosty',
  'Misty', 'Dusty', 'Neon', 'Pixel', 'Laser', 'Plasma', 'Starry', 'Shiny', 'Golden', 'Silver',
  'Crystal', 'Velvet', 'Cotton', 'Bubble', 'Jelly', 'Candy', 'Cookie', 'Waffle', 'Pepper', 'Ginger',
  'Lemon', 'Berry', 'Mango', 'Peach', 'Apple', 'Cocoa', 'Maple', 'Honey', 'Minty', 'Spicy',
  'Crunchy', 'Cheesy', 'Toasty', 'Roasty', 'Zesty', 'Nifty', 'Dandy', 'Plucky', 'Perky', 'Chipper',
  'Gleamy', 'Glowy', 'Flashy', 'Dashy', 'Zoomy', 'Wiggly', 'Giggly', 'Snappy', 'Twinkly', 'Spark',
  'Blazing', 'Icy', 'Stormy', 'Windy', 'Cloudy', 'Rainy', 'Snowy', 'Mossy', 'Leafy', 'Petal',
  'Rocket', 'Galaxy', 'Meteor', 'Quark', 'Kind', 'Gentle', 'Clever', 'Witty', 'Merry', 'Cheerful',
  'Playful', 'Curious', 'Bold', 'Nimble', 'Bright', 'Fancy', 'Cozy', 'Zany', 'Dizzy', 'Jaunty',
] as const;

export const NOUN_EN = [
  'Fox', 'Owl', 'Rocket', 'Star', 'Wolf', 'Hawk', 'Bear', 'Kit', 'Puffin', 'Drake',
  'Penguin', 'Otter', 'Panda', 'Koala', 'Bunny', 'Puppy', 'Kitten', 'Cub', 'Duck', 'Goose',
  'Swan', 'Finch', 'Robin', 'Wren', 'Parrot', 'Toucan', 'Falcon', 'Eagle', 'Raven', 'Jay',
  'Seal', 'Whale', 'Dolphin', 'Orca', 'Ray', 'Crab', 'Lobster', 'Squid', 'Octopus', 'Turtle',
  'Frog', 'Newt', 'Gecko', 'Dragon', 'Phoenix', 'Griffin', 'Unicorn', 'Robot', 'Bot', 'Droid',
  'Mech', 'Rover', 'Probe', 'Shuttle', 'Comet', 'Meteor', 'Planet', 'Moon', 'Sun', 'Pulsar',
  'Nebula', 'Galaxy', 'Beacon', 'Signal', 'Antenna', 'Capsule', 'Helmet', 'Visor', 'Jet', 'Wing',
  'Fin', 'Paw', 'Bean', 'Pea', 'Sprout', 'Seed', 'Acorn', 'Nut', 'Pretzel', 'Waffle',
  'Cookie', 'Muffin', 'Cupcake', 'Donut', 'Bagel', 'Toast', 'Popcorn', 'Noodle', 'Taco', 'Pizza',
  'Toaster', 'Blender', 'Whisk', 'Teapot', 'Kettle', 'Mug', 'Cup', 'Spoon', 'Fork', 'Bowl',
  'Radio', 'Piano', 'Drum', 'Banjo', 'Flute', 'Harp', 'Bell', 'Gong', 'Kite', 'Balloon',
  'Marble', 'Puzzle', 'Crayon', 'Stamp', 'Sticker', 'Button', 'Zipper', 'Pocket', 'Backpack', 'Goggles',
  'Boots', 'Socks', 'Scarf', 'Mitten', 'Cape', 'Crown', 'Badge', 'Medal', 'Trophy', 'Flag',
  'Compass', 'Map', 'Scope', 'Camera', 'Lantern', 'Torch', 'Spark', 'Cloud', 'Storm', 'Rainbow',
  'Snowflake', 'Puddle', 'Brook', 'River', 'Lake', 'Ocean', 'Wave', 'Tide', 'Reef', 'Island',
  'Canyon', 'Valley', 'Peak', 'Hill', 'Meadow', 'Forest', 'Grove', 'Garden', 'Blossom', 'Pebble',
] as const;

/** Real German adjectives. Inflect in nominative without article: -er / -e / -es. */
export const ADJ_DE = [
  'Lustig', 'Frostig', 'Schlau', 'Fidel', 'Neugierig', 'Sternig', 'Mutig', 'Froh', 'Flink', 'Kuschelig',
  'Munter', 'Sonnig', 'Neblig', 'Knusprig', 'Knackig', 'Funkelig', 'Eisig', 'Stuermisch', 'Windig', 'Wolkig',
  'Moosig', 'Tapfer', 'Freundlich', 'Sanft', 'Witzig', 'Frohlich', 'Heiter', 'Spielerisch', 'Kuehn', 'Bunt',
  'Flauschig', 'Knuffig', 'Wuerzig', 'Roestig', 'Flott', 'Keck', 'Regnerisch', 'Schneelig', 'Blaettrig', 'Flitzig',
  'Winzig', 'Riesig', 'Quirlig', 'Zappelig', 'Tollpatschig', 'Quatschig', 'Kicherig', 'Putzig', 'Niedlich', 'Drollig',
  'Ulkig', 'Kess', 'Frech', 'Schelmisch', 'Traeumerisch', 'Magisch', 'Mystisch', 'Kosmisch', 'Galaktisch', 'Polar',
  'Samtig', 'Staubig', 'Glitzrig', 'Blitzig', 'Wackelig', 'Zuckrig', 'Kaesig', 'Minzig', 'Pfeffrig', 'Saftig',
  'Knuffelig', 'Quietschig', 'Kribbelig', 'Kitzelig', 'Mondig', 'Dunkel', 'Hell', 'Silbern', 'Golden', 'Astral',
  'Solar', 'Pixelig', 'Weltraumig', 'Plitschig', 'Toll', 'Cool', 'Nett', 'Lieb', 'Suess', 'Albern',
  'Komisch', 'Seltsam', 'Geheim', 'Edel', 'Fein', 'Lebhaft', 'Wild', 'Lockig', 'Stachelig', 'Blumig',
  'Matschig', 'Klebrig', 'Glitschig', 'Rutschig', 'Luftig', 'Duftig', 'Knallig', 'Fetzig', 'Pfiffig', 'Genial',
] as const;

export const NOUN_DE: readonly DeNoun[] = [
  { word: 'Fuchs', gender: 'm' }, { word: 'Eule', gender: 'f' }, { word: 'Rakete', gender: 'f' },
  { word: 'Stern', gender: 'm' }, { word: 'Wolf', gender: 'm' }, { word: 'Falke', gender: 'm' },
  { word: 'Baer', gender: 'm' }, { word: 'Kitz', gender: 'n' }, { word: 'Drache', gender: 'm' },
  { word: 'Pilot', gender: 'm' }, { word: 'Pinguin', gender: 'm' }, { word: 'Otter', gender: 'm' },
  { word: 'Panda', gender: 'm' }, { word: 'Koala', gender: 'm' }, { word: 'Hase', gender: 'm' },
  { word: 'Welpe', gender: 'm' }, { word: 'Kaetzchen', gender: 'n' }, { word: 'Ente', gender: 'f' },
  { word: 'Gans', gender: 'f' }, { word: 'Schwan', gender: 'm' }, { word: 'Fink', gender: 'm' },
  { word: 'Papagei', gender: 'm' }, { word: 'Tukan', gender: 'm' }, { word: 'Adler', gender: 'm' },
  { word: 'Rabe', gender: 'm' }, { word: 'Haeher', gender: 'm' }, { word: 'Robbe', gender: 'f' },
  { word: 'Wal', gender: 'm' }, { word: 'Delfin', gender: 'm' }, { word: 'Orca', gender: 'm' },
  { word: 'Rochen', gender: 'm' }, { word: 'Krabbe', gender: 'f' }, { word: 'Hummer', gender: 'm' },
  { word: 'Krake', gender: 'f' }, { word: 'Frosch', gender: 'm' }, { word: 'Molch', gender: 'm' },
  { word: 'Gecko', gender: 'm' }, { word: 'Phoenix', gender: 'm' }, { word: 'Greif', gender: 'm' },
  { word: 'Einhorn', gender: 'n' }, { word: 'Roboter', gender: 'm' }, { word: 'Bot', gender: 'm' },
  { word: 'Droid', gender: 'm' }, { word: 'Mech', gender: 'm' }, { word: 'Rover', gender: 'm' },
  { word: 'Sonde', gender: 'f' }, { word: 'Komet', gender: 'm' }, { word: 'Meteor', gender: 'm' },
  { word: 'Planet', gender: 'm' }, { word: 'Mond', gender: 'm' }, { word: 'Sonne', gender: 'f' },
  { word: 'Pulsar', gender: 'm' }, { word: 'Nebel', gender: 'm' }, { word: 'Galaxie', gender: 'f' },
  { word: 'Bake', gender: 'f' }, { word: 'Signal', gender: 'n' }, { word: 'Antenne', gender: 'f' },
  { word: 'Kapsel', gender: 'f' }, { word: 'Helm', gender: 'm' }, { word: 'Visier', gender: 'n' },
  { word: 'Jet', gender: 'm' }, { word: 'Fluegel', gender: 'm' }, { word: 'Flosse', gender: 'f' },
  { word: 'Pfote', gender: 'f' }, { word: 'Bohne', gender: 'f' }, { word: 'Erbse', gender: 'f' },
  { word: 'Spross', gender: 'm' }, { word: 'Kern', gender: 'm' }, { word: 'Eichel', gender: 'f' },
  { word: 'Nuss', gender: 'f' }, { word: 'Brezel', gender: 'f' }, { word: 'Waffel', gender: 'f' },
  { word: 'Keks', gender: 'm' }, { word: 'Muffin', gender: 'm' }, { word: 'Donut', gender: 'm' },
  { word: 'Toast', gender: 'm' }, { word: 'Popcorn', gender: 'n' }, { word: 'Nudel', gender: 'f' },
  { word: 'Taco', gender: 'm' }, { word: 'Pizza', gender: 'f' }, { word: 'Toaster', gender: 'm' },
  { word: 'Mixer', gender: 'm' }, { word: 'Quirl', gender: 'm' }, { word: 'Kanne', gender: 'f' },
  { word: 'Kessel', gender: 'm' }, { word: 'Tasse', gender: 'f' }, { word: 'Becher', gender: 'm' },
  { word: 'Loeffel', gender: 'm' }, { word: 'Gabel', gender: 'f' }, { word: 'Schuessel', gender: 'f' },
  { word: 'Radio', gender: 'n' }, { word: 'Klavier', gender: 'n' }, { word: 'Trommel', gender: 'f' },
  { word: 'Banjo', gender: 'n' }, { word: 'Floete', gender: 'f' }, { word: 'Harfe', gender: 'f' },
  { word: 'Glocke', gender: 'f' }, { word: 'Gong', gender: 'm' }, { word: 'Drachen', gender: 'm' },
  { word: 'Ballon', gender: 'm' }, { word: 'Murmel', gender: 'f' }, { word: 'Puzzle', gender: 'n' },
  { word: 'Kreide', gender: 'f' }, { word: 'Stempel', gender: 'm' }, { word: 'Knopf', gender: 'm' },
  { word: 'Tasche', gender: 'f' }, { word: 'Rucksack', gender: 'm' }, { word: 'Brille', gender: 'f' },
  { word: 'Stiefel', gender: 'm' }, { word: 'Socke', gender: 'f' }, { word: 'Schal', gender: 'm' },
  { word: 'Faeustling', gender: 'm' }, { word: 'Umhang', gender: 'm' }, { word: 'Krone', gender: 'f' },
  { word: 'Medaille', gender: 'f' }, { word: 'Pokal', gender: 'm' }, { word: 'Fahne', gender: 'f' },
  { word: 'Kompass', gender: 'm' }, { word: 'Karte', gender: 'f' }, { word: 'Fernrohr', gender: 'n' },
  { word: 'Kamera', gender: 'f' }, { word: 'Laterne', gender: 'f' }, { word: 'Fackel', gender: 'f' },
  { word: 'Funke', gender: 'm' }, { word: 'Wolke', gender: 'f' }, { word: 'Sturm', gender: 'm' },
  { word: 'Regenbogen', gender: 'm' }, { word: 'Flocke', gender: 'f' }, { word: 'Pfuetze', gender: 'f' },
  { word: 'Bach', gender: 'm' }, { word: 'Fluss', gender: 'm' }, { word: 'See', gender: 'm' },
  { word: 'Ozean', gender: 'm' }, { word: 'Welle', gender: 'f' }, { word: 'Riff', gender: 'n' },
  { word: 'Insel', gender: 'f' }, { word: 'Schlucht', gender: 'f' }, { word: 'Tal', gender: 'n' },
  { word: 'Gipfel', gender: 'm' }, { word: 'Huegel', gender: 'm' }, { word: 'Ufo', gender: 'n' },
  { word: 'Qualle', gender: 'f' }, { word: 'Seestern', gender: 'm' }, { word: 'Muschel', gender: 'f' },
  { word: 'Igel', gender: 'm' }, { word: 'Maus', gender: 'f' }, { word: 'Hamster', gender: 'm' },
  { word: 'Banane', gender: 'f' }, { word: 'Gurke', gender: 'f' }, { word: 'Moehre', gender: 'f' },
  { word: 'Kartoffel', gender: 'f' }, { word: 'Tomate', gender: 'f' }, { word: 'Lolli', gender: 'm' },
  { word: 'Eis', gender: 'n' }, { word: 'Kaese', gender: 'm' }, { word: 'Muetze', gender: 'f' },
  { word: 'Hut', gender: 'm' }, { word: 'Kissen', gender: 'n' }, { word: 'Decke', gender: 'f' },
  { word: 'Bagger', gender: 'm' }, { word: 'Traktor', gender: 'm' }, { word: 'Zeppelin', gender: 'm' },
  { word: 'Kobold', gender: 'm' }, { word: 'Fee', gender: 'f' }, { word: 'Troll', gender: 'm' },
  { word: 'Asteroid', gender: 'm' }, { word: 'Satellit', gender: 'm' }, { word: 'Teller', gender: 'm' },
  { word: 'Pantoffel', gender: 'm' }, { word: 'Gummibaer', gender: 'm' }, { word: 'Kakadu', gender: 'm' },
];

export const PUNS_EN = [
  'Moon Bean', 'Star Nut', 'Orbit Otter', 'Nova Noodle', 'Comet Cup', 'Lunar Llama',
  'Solar Sock', 'Astro Bagel', 'Quark Duck', 'Pixel Fox', 'Turbo Toaster', 'Nebula Nugget',
  'Plasma Pea', 'Ion Igloo', 'Galaxy Goose', 'Rocket Raisin', 'Meteor Muffin', 'Cosmic Cocoa',
];

export const PUNS_DE = [
  'Mond-Bohne', 'Stern-Nuss', 'Orbit-Otter', 'Nova-Nudel', 'Komet-Keks', 'Luna-Lama',
  'Solar-Socke', 'Astro-Brezel', 'Quark-Ente', 'Pixel-Fuchs', 'Turbo-Toaster', 'Nebel-Nugget',
  'Plasma-Erbse', 'Ionen-Iglu', 'Galaxie-Gans', 'Raketen-Rosine', 'Meteor-Muffin', 'Kosmo-Kakao',
];

export function inflectDeAdj(adj: string, gender: DeGender): string {
  const ending = gender === 'm' ? 'er' : gender === 'f' ? 'e' : 'es';
  return `${adj}${ending}`;
}
