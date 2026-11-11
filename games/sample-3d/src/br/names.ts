/** Generates `count` distinct campy gamertags, like a console auto-suggesting one for you. */

const ADJECTIVES = [
  'Mulch', 'Turf', 'Lawn', 'Gnome', 'Sod', 'Hedge', 'Compost', 'Weed', 'Sprinkler',
  'Grass', 'Acorn', 'Shrub', 'Topiary', 'Clover', 'Moss', 'Pebble', 'Trowel', 'Garden',
];

const NOUNS = [
  'Lord', 'Slayer', 'Sniper', 'Goblin', 'Wizard', 'Destroyer', 'Ninja', 'Gamer', 'Bandit',
  'Overlord', 'Gremlin', 'Legend', 'Muncher', 'Whisperer', 'Viking', 'Goose', 'Boi',
];

const SPECIALS = [
  'Sir Mows-a-Lot', 'LawnRanger', 'TurfBurger', 'GnomeChompsky', 'Gnometallica',
  'HoeDown2009', 'MowMentum', 'Weedward', 'Gnome Alone 2', 'ShrubShrubShrub',
];

const MAX_LENGTH = 18;
const SPECIAL_CHANCE = 0.25;

function pick<T>(items: readonly T[], rng: () => number): T {
  return items[Math.floor(rng() * items.length) % items.length];
}

/** A year 1998-2012, or 2-3 random digits, or nothing. */
function randomNumber(rng: () => number): string {
  const roll = rng();
  if (roll < 1 / 3) return String(1998 + Math.floor(rng() * 15));
  if (roll < 2 / 3) return String(10 + Math.floor(rng() * 990));
  return '';
}

function buildName(rng: () => number): string {
  const adj = pick(ADJECTIVES, rng);
  const noun = pick(NOUNS, rng);
  const num = randomNumber(rng);
  const patterns = [
    `${adj}${noun}${num}`,
    `xX_${adj}${noun}_Xx`,
    `The${adj}${noun}`,
    `${adj}_${noun}${num}`,
    `x${adj}${noun}x`,
    `Pro${adj}${noun}`,
  ];
  return pick(patterns, rng);
}

export function generateGamertags(count: number, rng: () => number = Math.random): string[] {
  const names: string[] = [];
  const used = new Set<string>();
  const unusedSpecials = [...SPECIALS];

  while (names.length < count) {
    let name: string | undefined;
    if (unusedSpecials.length > 0 && rng() < SPECIAL_CHANCE) {
      const index = Math.floor(rng() * unusedSpecials.length) % unusedSpecials.length;
      const special = unusedSpecials.splice(index, 1)[0];
      if (special.length <= MAX_LENGTH && !used.has(special)) name = special;
    } else {
      const candidate = buildName(rng);
      if (candidate.length <= MAX_LENGTH && !used.has(candidate)) name = candidate;
    }
    if (name !== undefined) {
      used.add(name);
      names.push(name);
    }
  }

  return names;
}
