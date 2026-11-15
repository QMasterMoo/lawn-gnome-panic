// Content pack: Mossbottom Vale (Chapter 1, levels 1-6). Prefix for new ids: mb-.
import { look, type ContentPack } from '../../config';

export const PACK: ContentPack = {
  id: 'mossbottom',

  items: {
    'rusty-trowel': { id: 'rusty-trowel', name: 'Rusty trowel', icon: '🗡️', kind: 'weapon', slot: 'weapon', ilvl: 1, damageType: 'slash', hands: 1, weaponClass: 'melee', value: 5, examine: 'It has dug a thousand flowerbeds.' },
    'bronze-shears': { id: 'bronze-shears', name: 'Bronze shears', icon: '✂️', kind: 'weapon', slot: 'weapon', ilvl: 3, damageType: 'slash', hands: 1, weaponClass: 'melee', value: 45, examine: 'Sharp enough to trim a hedge or a beetle.' },
    'garden-mallet': { id: 'garden-mallet', name: 'Garden mallet', icon: '🔨', kind: 'weapon', slot: 'weapon', ilvl: 3, damageType: 'crush', hands: 1, weaponClass: 'melee', value: 35, examine: 'For croquet, and for disagreements.' },
    'iron-pick': { id: 'iron-pick', name: 'Iron pick', icon: '⛏️', kind: 'weapon', slot: 'weapon', ilvl: 5, damageType: 'crush', hands: 2, weaponClass: 'melee', value: 140, examine: 'Heavy. Very heavy.' },
    'mole-claw': { id: 'mole-claw', name: 'Mole King claw', icon: '🦴', kind: 'weapon', slot: 'weapon', ilvl: 7, rarity: 'heirloom', damageType: 'slash', hands: 1, weaponClass: 'melee', value: 260, examine: 'Torn from Grubthorn himself.' },
    'pot-lid': { id: 'pot-lid', name: 'Pot lid', icon: '🍳', kind: 'offhand', slot: 'offhand', ilvl: 1, armorType: 'shield', value: 10, examine: 'Someone is missing their soup lid.' },
    'oak-shield': { id: 'oak-shield', name: 'Oak shield', icon: '🛡️', kind: 'offhand', slot: 'offhand', ilvl: 4, armorType: 'shield', value: 70, examine: 'Carved from a fallen acorn tree.' },
    'acorn-cap': { id: 'acorn-cap', name: 'Acorn cap', icon: '🌰', kind: 'armor', slot: 'head', ilvl: 1, armorType: 'leather', value: 8, examine: 'A snug, nutty helmet.' },
    'thimble-helm': { id: 'thimble-helm', name: 'Thimble helm', icon: '🪖', kind: 'armor', slot: 'head', ilvl: 4, armorType: 'plate', value: 80, examine: 'A giant\'s thimble, polished to a shine.' },
    'moss-tunic': { id: 'moss-tunic', name: 'Moss tunic', icon: '👕', kind: 'armor', slot: 'body', ilvl: 1, armorType: 'cloth', value: 12, examine: 'Soft, green and a bit damp.' },
    'bark-vest': { id: 'bark-vest', name: 'Bark vest', icon: '🦺', kind: 'armor', slot: 'body', ilvl: 3, armorType: 'leather', value: 60, examine: 'Stiff, but it turns a blade.' },
    'beetle-plate': { id: 'beetle-plate', name: 'Beetle plate', icon: '🥋', kind: 'armor', slot: 'body', ilvl: 6, armorType: 'plate', value: 180, examine: 'Shell plates riveted on leather.' },
    'red-potion': { id: 'red-potion', name: 'Red potion', icon: '🧪', kind: 'potion', heal: 14, stackable: true, value: 15, examine: 'Restores 14 hit points.' },
    'blue-potion': { id: 'blue-potion', name: 'Blue potion', icon: '🫙', kind: 'potion', mana: 15, stackable: true, value: 20, examine: 'Restores 15 mana.' },
    mushroom: { id: 'mushroom', name: 'Mushroom', icon: '🍄', kind: 'potion', heal: 4, stackable: true, value: 3, examine: 'Probably edible. Restores 4 hit points.' },
    'slug-slime': { id: 'slug-slime', name: 'Slug slime', icon: '🟢', kind: 'misc', stackable: true, value: 2, examine: 'Sticky. Elder Fernwick wants it for some reason.' },
    'beetle-shell': { id: 'beetle-shell', name: 'Beetle shell', icon: '🐚', kind: 'misc', stackable: true, value: 6, examine: 'Glossy and hard. Tansy grinds these into potions.' },
    'mole-crown': { id: 'mole-crown', name: 'Mole crown', icon: '👑', kind: 'misc', value: 300, examine: 'The muddy crown of the Mole King.' },
  },

  // hpOverride, damageOverride and defense keep the old numbers until epic 2 retunes this pack.
  enemies: {
    slug: { id: 'slug', name: 'Garden slug', level: 1, rank: 'trivial', family: 'soft', damageType: 'crush', hpOverride: 6, damageOverride: [1, 3], defense: 0, attackSeconds: 3, aggressive: false, loot: [{ item: 'slug-slime', chance: 0.85 }, { item: 'mushroom', chance: 0.2 }], gold: [0, 2], model: 'slug', color: 0x9bb06a, scale: 1, respawnSeconds: 20, examine: 'Slow, slimy and surprisingly bitey.', wants: 'Wet lettuce, shade.' },
    mole: { id: 'mole', name: 'Mole', level: 2, rank: 'normal', family: 'furred', damageType: 'slash', hpOverride: 10, damageOverride: [1, 4], defense: 1, attackSeconds: 2.6, aggressive: false, loot: [{ item: 'mushroom', chance: 0.5 }, { item: 'acorn-cap', chance: 0.1 }], gold: [1, 4], model: 'mole', color: 0x4a3b33, scale: 1, respawnSeconds: 25, examine: 'It digs up the meadow for fun.', wants: 'To get away. They\'re digging south.' },
    'feral-gnome': { id: 'feral-gnome', name: 'Feral gnome', level: 3, rank: 'normal', family: 'fired', damageType: 'crush', hpOverride: 14, damageOverride: [1, 6], defense: 2, attackSeconds: 2.4, aggressive: true, loot: [{ item: 'red-potion', chance: 0.3 }, { item: 'acorn-cap', chance: 0.12 }, { item: 'pot-lid', chance: 0.12 }, { item: 'garden-mallet', chance: 0.06 }], gold: [3, 12], model: 'gnome', color: 0x3b3b3b, scale: 1, respawnSeconds: 30, examine: 'A gnome who left the garden and never came back.', wants: 'Everything you own.' },
    beetle: { id: 'beetle', name: 'Stag beetle', level: 4, rank: 'normal', family: 'shelled', damageType: 'slash', hpOverride: 18, damageOverride: [1, 6], defense: 4, attackSeconds: 2.4, aggressive: true, loot: [{ item: 'beetle-shell', chance: 0.9 }, { item: 'blue-potion', chance: 0.15 }, { item: 'bark-vest', chance: 0.05 }], gold: [0, 6], model: 'beetle', color: 0x5a2e14, scale: 1.2, respawnSeconds: 30, examine: 'Its jaws could snip a trowel in half.', wants: 'To protect their grubs in the log mounds.' },
    'mole-king': { id: 'mole-king', name: 'Grubthorn the Mole King', level: 8, rank: 'boss', family: 'furred', damageType: 'slash', hpOverride: 60, damageOverride: [2, 12], defense: 6, attackSeconds: 2.8, aggressive: true, loot: [{ item: 'mole-crown', chance: 1 }, { item: 'mole-claw', chance: 1 }, { item: 'red-potion', chance: 1, count: 2 }], gold: [50, 80], model: 'mole', color: 0x2b211c, scale: 2.4, respawnSeconds: 120, examine: 'The king beneath the hill. He wears a muddy crown.', wants: 'To lead his clan south, away from the shaking.' },
  },

  spawns: [
    { zone: 'mossbottom', enemy: 'slug', x: 45, z: 12, count: 6, spread: 14 },
    { zone: 'mossbottom', enemy: 'mole', x: 52, z: 28, count: 3, spread: 10 },
    { zone: 'mossbottom', enemy: 'slug', x: 30, z: 40, count: 3, spread: 8 },
    { zone: 'mossbottom', enemy: 'feral-gnome', x: -55, z: 20, count: 5, spread: 12 },
    { zone: 'mossbottom', enemy: 'beetle', x: -45, z: -60, count: 5, spread: 14 },
    { zone: 'mossbottom', enemy: 'mole-king', x: 10, z: -88, count: 1, spread: 0 },
  ],

  npcs: {
    fernwick: {
      id: 'fernwick', name: 'Elder Fernwick', look: look(0x7b3fb0, 0x4b2a6e, 0xf4f4f4, { glasses: true }), zone: 'mossbottom', x: 0, z: 6, wander: 0,
      examine: 'The oldest gnome in Mossbottom. His beard has its own postcode.',
      greetings: [
        { when: { questStage: { id: 'slime-time', stage: 1 } }, node: 'slimeTurnIn' },
        { when: { questStage: { id: 'mole-king', stage: 1 } }, node: 'kingTurnIn' },
        { when: { quest: { id: 'mole-king', status: 'done' } }, node: 'hero' },
        { when: { quest: { id: 'mole-king', status: 'active' } }, node: 'kingWaiting' },
        { when: { quest: { id: 'slime-time', status: 'done' } }, node: 'offerKing' },
        { when: { quest: { id: 'slime-time', status: 'active' } }, node: 'slimeWaiting' },
        { node: 'intro' },
      ],
      nodes: {
        intro: {
          hub: true,
          text: 'Ah, you are awake at last! Welcome to Mossbottom, in the land of Gnomomia. You washed up in the brook three days ago, clutching that trowel.',
          options: [
            { text: 'Where am I, exactly?', next: 'where' },
            { text: 'Is there any work for me?', next: 'offerSlime' },
            { text: 'Goodbye.' },
          ],
        },
        where: {
          text: 'Mossbottom! Slugs to the east in Dewdrop Meadow, feral gnomes camped to the west, beetles in the barrows to the south-west, and in the north... Grubthorn. Best not to think about him yet.',
          options: [{ text: 'Is there any work for me?', next: 'offerSlime' }, { text: 'Goodbye.' }],
        },
        offerSlime: {
          text: 'Work? Splendid. My knees need slug slime, for the ointment. Bring me 5 and I will make it worth your while.',
          options: [
            { text: 'I will gather the slime.', action: { type: 'startQuest', quest: 'slime-time' } },
            { text: 'Maybe later.' },
          ],
        },
        slimeWaiting: { text: 'Five slug slimes, from Dewdrop Meadow to the east. My knees are counting on you.', options: [{ text: 'On my way.' }] },
        slimeTurnIn: {
          text: 'Is that... yes! Lovely, sticky slime. Here, take these potions and a few coins.',
          options: [{ text: 'Glad to help.' }],
        },
        offerKing: {
          text: 'My knees are young again. But I have a bigger worry: Grubthorn the Mole King is tunnelling under the village from his burrow up north. Will you face him?',
          options: [
            { text: 'I will deal with the Mole King.', action: { type: 'startQuest', quest: 'mole-king' } },
            { text: 'I am not ready yet.' },
          ],
        },
        kingWaiting: { text: 'Grubthorn\'s burrow lies far to the north. Bring potions. Bring friends, if you have any.', options: [{ text: 'I will be back.' }] },
        kingTurnIn: {
          text: 'The crown of Grubthorn! Mossbottom is safe. From this day you are the Hero of Gnomomia.',
          options: [{ text: 'It was nothing.' }],
        },
        hero: { text: 'Our hero returns! The children have started calling you "Gnomezilla".', options: [{ text: 'Goodbye.' }] },
      },
    },
    bramble: {
      id: 'bramble', name: 'Bramble the Smith', look: look(0x9a3324, 0x3c3c3c, 0x8b4513), zone: 'mossbottom', x: -9, z: -4, wander: 1.5,
      examine: 'His apron is more burn mark than apron.',
      greetings: [{ node: 'hello' }],
      nodes: {
        hello: {
          hub: true,
          text: 'Need a blade? A lid to hide behind? I forge it all, for a fair price.',
          options: [{ text: 'Show me your wares.', action: { type: 'openShop' } }, { text: 'Goodbye.' }],
        },
      },
      shop: ['bronze-shears', 'garden-mallet', 'iron-pick', 'pot-lid', 'oak-shield', 'acorn-cap', 'bark-vest'],
    },
    tansy: {
      id: 'tansy', name: 'Tansy the Herbalist', look: look(0xe86fb0, 0x4fae5a, null, { hair: { color: 0xd8902f, style: 'pigtails' }, dress: true, freckles: true }), zone: 'mossbottom', x: 9, z: -3, wander: 1.5,
      examine: 'She smells of mint and something you cannot place.',
      greetings: [
        { when: { questStage: { id: 'shells', stage: 1 } }, node: 'turnIn' },
        { when: { quest: { id: 'shells', status: 'active' } }, node: 'waiting' },
        { when: { quest: { id: 'shells', status: 'done' } }, node: 'shop' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          hub: true,
          text: 'Potions! Remedies! Mushrooms of questionable origin! Also, I need beetle shells, if you are the brave type.',
          options: [
            { text: 'Let me see your potions.', action: { type: 'openShop' } },
            { text: 'Beetle shells?', next: 'offer' },
            { text: 'Could you patch me up?', action: { type: 'heal' } },
            { text: 'Goodbye.' },
          ],
        },
        offer: {
          text: 'The stag beetles in Beetle Barrows, to the south-west. Their shells grind into the best mana tonic. Bring me 4.',
          options: [{ text: 'I will bring 4 shells.', action: { type: 'startQuest', quest: 'shells' } }, { text: 'Too scary.' }],
        },
        waiting: {
          text: 'Four beetle shells, from the barrows. Mind the jaws!',
          options: [{ text: 'Let me see your potions.', action: { type: 'openShop' } }, { text: 'Could you patch me up?', action: { type: 'heal' } }, { text: 'Goodbye.' }],
        },
        turnIn: { text: 'Oh, beautiful shells! Here, a helm I took in trade, some tonic and a little gold.', options: [{ text: 'Thank you!' }] },
        shop: {
          text: 'My favourite shell hunter! What do you need?',
          options: [{ text: 'Let me see your potions.', action: { type: 'openShop' } }, { text: 'Could you patch me up?', action: { type: 'heal' } }, { text: 'Goodbye.' }],
        },
      },
      shop: ['red-potion', 'blue-potion', 'mushroom'],
    },
    pip: {
      id: 'pip', name: 'Captain Pip', look: look(0x2a4fa8, 0x8a8a8a, 0x222222), zone: 'mossbottom', x: -20, z: 2, wander: 2,
      examine: 'Captain of the Mossbottom guard. The guard is him.',
      greetings: [
        { when: { questStage: { id: 'feral-trouble', stage: 1 } }, node: 'turnIn' },
        { when: { quest: { id: 'feral-trouble', status: 'active' } }, node: 'waiting' },
        { when: { quest: { id: 'feral-trouble', status: 'done' } }, node: 'done' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          hub: true,
          text: 'Halt! Oh, it is you. Feral gnomes have made a camp to the west and they keep stealing our garden furniture. I could use a sword arm.',
          options: [
            { text: 'I will drive them off.', action: { type: 'startQuest', quest: 'feral-trouble' } },
            { text: 'Not my problem.' },
          ],
        },
        waiting: { text: 'Five ferals should teach the rest a lesson. The camp is due west.', options: [{ text: 'Understood.' }] },
        turnIn: { text: 'Five ferals! The garden furniture is safe. Take my old shield, it served me well.', options: [{ text: 'Thanks, Captain.' }] },
        done: { text: 'The west is quiet. Mostly. Good work, recruit.', options: [{ text: 'Goodbye.' }] },
      },
    },
    thistle: {
      id: 'thistle', name: 'Old Thistle', look: look(0x8f8f2a, 0x6b4a2e, 0xbbbbbb), zone: 'mossbottom', x: 6, z: 14, wander: 5,
      examine: 'He has been sweeping the same path for forty years.',
      greetings: [{ node: 'hello' }],
      nodes: {
        hello: {
          hub: true,
          text: 'Hrm? In my day we fought slugs with our bare hands. Uphill. Both ways.',
          options: [{ text: 'Any advice?', next: 'advice' }, { text: 'Goodbye.' }],
        },
        advice: {
          text: 'Skills grow when you use them, youngster. Swing a blade, get better with blades. Get hit a lot, your armor skill grows. Ten skill-ups and you level. Simple!',
          options: [{ text: 'Thanks, Thistle.' }],
        },
      },
    },
  },

  quests: {
    'slime-time': {
      id: 'slime-time', name: 'Slime Time', giver: 'fernwick', zone: 'mossbottom', level: 2, tier: 'side', chain: 'Chapter 1: Mossbottom',
      stages: [
        { text: 'Gather 5 slug slime from the garden slugs in Dewdrop Meadow, east of Mossbottom.', objective: { type: 'collect', item: 'slug-slime', count: 5 } },
        { text: 'Bring the slime to Elder Fernwick.', objective: { type: 'talk', npc: 'fernwick' }, takeItems: [{ item: 'slug-slime', count: 5 }] },
      ],
      reward: { gold: 30, items: [{ item: 'red-potion', count: 3 }] },
    },
    'feral-trouble': {
      id: 'feral-trouble', name: 'Feral Trouble', giver: 'pip', zone: 'mossbottom', level: 4, tier: 'side', chain: 'Chapter 1: Mossbottom',
      stages: [
        { text: 'Defeat 5 feral gnomes at the camp west of Mossbottom.', objective: { type: 'kill', enemy: 'feral-gnome', count: 5 } },
        { text: 'Report back to Captain Pip.', objective: { type: 'talk', npc: 'pip' } },
      ],
      reward: { gold: 80, items: [{ item: 'oak-shield', count: 1 }] },
    },
    shells: {
      id: 'shells', name: 'Shells for Tansy', giver: 'tansy', zone: 'mossbottom', level: 5, tier: 'side', chain: 'Chapter 1: Mossbottom',
      stages: [
        { text: 'Collect 4 beetle shells from the stag beetles in Beetle Barrows, south-west of Mossbottom.', objective: { type: 'collect', item: 'beetle-shell', count: 4 } },
        { text: 'Bring the shells to Tansy the Herbalist.', objective: { type: 'talk', npc: 'tansy' }, takeItems: [{ item: 'beetle-shell', count: 4 }] },
      ],
      reward: { gold: 60, items: [{ item: 'thimble-helm', count: 1 }, { item: 'blue-potion', count: 2 }] },
    },
    'mole-king': {
      id: 'mole-king', name: 'The Mole King', giver: 'fernwick', zone: 'mossbottom', level: 6, tier: 'finale', chain: 'Chapter 1: Mossbottom',
      stages: [
        { text: 'Defeat Grubthorn the Mole King in his burrow, far to the north.', objective: { type: 'kill', enemy: 'mole-king', count: 1 } },
        { text: 'Bring news of your victory to Elder Fernwick.', objective: { type: 'talk', npc: 'fernwick' } },
      ],
      reward: { gold: 300, items: [{ item: 'beetle-plate', count: 1 }] },
    },
  },
};
