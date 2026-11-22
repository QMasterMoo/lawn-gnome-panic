// Chapter 4: "Sandpit Protocol" (The Dust Flats: Desert Airfield & Fort Sandpit).
import type { GnomeLook } from '@lawn/gnome';
import { AIRFIELD, BASE } from '../config';
import type { QuestDef } from './types';

const PIP_LOOK: Partial<GnomeLook> = { hat: 0xd93636, shirt: 0x2f8a4a, beard: 0x6b5b4b };
const TANSY_LOOK: Partial<GnomeLook> = { hat: 0xf2c230, shirt: 0x2b2e34, glasses: true };
const DIGGS_LOOK: Partial<GnomeLook> = { hat: 0x556b2f, shirt: 0x6b7a3a, beard: 0x4a3b2c };
const HOA_LOOK: Partial<GnomeLook> = { hat: 0x18181e, shirt: 0xc9b99b };

export const CHAPTER_4_QUESTS: readonly QuestDef[] = [
  {
    id: 'ch4-runway-flares',
    title: 'Runway Flares',
    giver: 'dust-overlook',
    prereq: 'ch3-tundra-drift-run',
    chapter: 4,
    rewardAcorns: 950,
    radioBulletin: 'ch4-runway-flares',
    cutscene: {
      kind: 'dialogue',
      room: 'dust-overlook',
      lines: [
        {
          speaker: 'Tansy Clayfoot',
          text: 'I\'ve got the Fescue Stopping Stone, but we\'re not driving a Combine through Fort Sandpit\'s front gate.',
          look: TANSY_LOOK,
          hz: 165,
        },
        {
          speaker: 'Pip Potsworth',
          text: 'Clear the two Spade Guard apron patrols at the Desert Airfield, steal a Crop Duster, and buzz the Dust Flats to signal the Unmowed team.',
          look: PIP_LOOK,
          hz: 215,
        },
        {
          speaker: 'Wind-Sock Wally',
          text: 'Stall speed\'s 22, kid. Don\'t clip my lawn chair on the way up.',
          look: { hat: 0xc29b61, shirt: 0x5c4a32, beard: 0xdddddd },
          hz: 155,
        },
      ],
    },
    objectives: [
      {
        kind: 'crack',
        text: 'Clear the two Spade Guard patrols on the Desert Airfield apron',
        targets: [
          { id: 'apron-spade-1', name: 'Spade Guard Apron I', near: [430, -85], hint: 'Desert Airfield', look: DIGGS_LOOK },
          { id: 'apron-spade-2', name: 'Spade Guard Apron II', near: [450, -95], hint: 'Desert Airfield', look: DIGGS_LOOK },
        ],
      },
      {
        kind: 'steal-deliver',
        text: 'Steal a Crop Duster and fly low over the Dust Flats flare zone',
        vehicleKind: 'plane',
        spawnAt: [440, -92, AIRFIELD.yaw],
        dropAt: [310, 120],
        radius: 28,
        hint: 'Dust Flats Flare Zone',
        heatOnEnter: 2,
      },
      {
        kind: 'visit',
        text: 'Drop the second flare over the northern Dust Flats ridge',
        at: [360, -140],
        radius: 30,
        hint: 'Northern Dust Flats',
      },
    ],
    doneText: 'Flares dropped. The Unmowed spotters are in position outside Fort Sandpit.',
  },
  {
    id: 'ch4-sandpit-drop',
    title: 'The Sandpit Drop',
    giver: 'dust-overlook',
    prereq: 'ch4-runway-flares',
    chapter: 4,
    rewardAcorns: 1200,
    achievement: 'gta-mid-air-jack',
    radioBulletin: 'ch4-sandpit-drop',
    cutscene: {
      kind: 'dialogue',
      room: 'dust-overlook',
      lines: [
        {
          speaker: 'Pip Potsworth',
          text: 'Okay, hear me out. Five Spade Guard snipers watch the gate—so we fly a Crop Duster over the wall and bail out without checking the parachute.',
          look: PIP_LOOK,
          hz: 215,
        },
        {
          speaker: 'Tansy Clayfoot',
          text: 'Land on the Whirligig pad inside Fort Sandpit—that\'s the chopper Vesper cited for "unauthorized verticality." Lift off and bring it back here.',
          look: TANSY_LOOK,
          hz: 165,
        },
      ],
    },
    objectives: [
      {
        kind: 'air-drop',
        text: 'Fly over Fort Sandpit, parachute onto the pad, and steal The Whirligig',
        planeAt: [415, -92],
        dropZone: [BASE.padX, 0, BASE.padZ],
        radius: 22,
        targetVehicle: 'whirligig',
        hint: 'Fort Sandpit Whirligig Pad',
        heatOnLand: 2,
        heatOnBoard: 3,
      },
      {
        kind: 'crack',
        text: 'Clear the Spade Guard perimeter snipers if they block your takeoff',
        targets: [
          { id: 'sandpit-sniper-1', name: 'Spade Guard Sniper I', near: [368, 30], hint: 'Fort Sandpit Perimeter', look: DIGGS_LOOK },
          { id: 'sandpit-sniper-2', name: 'Spade Guard Sniper II', near: [348, 6], hint: 'Fort Sandpit Perimeter', look: DIGGS_LOOK },
        ],
      },
      {
        kind: 'visit',
        text: 'Fly The Whirligig back to Dust Flats Overlook',
        at: [280, 40],
        radius: 18,
        hint: 'Dust Flats Overlook',
      },
    ],
    doneText: 'The Whirligig is yours—and Commander Diggs is tearing out of the gate on a Zero-Turn.',
  },
  {
    id: 'ch4-spade-truce',
    title: 'Nobody Fires the Guard',
    giver: 'dust-overlook',
    prereq: 'ch4-sandpit-drop',
    chapter: 4,
    rewardAcorns: 1000,
    radioBulletin: 'ch4-spade-truce',
    cutscene: {
      kind: 'dialogue',
      room: 'dust-overlook',
      lines: [
        {
          speaker: 'Commander Diggs',
          text: 'Hold it—Vesper just remotely locked Fort Sandpit\'s armory and declared the Spade Guard "redundant"!',
          look: DIGGS_LOOK,
          hz: 145,
        },
        {
          speaker: 'Tansy Clayfoot',
          text: 'Nobody fires the Guard. Especially not a guy in a porcelain hat. Looks like we\'re on the same side, Commander.',
          look: TANSY_LOOK,
          hz: 165,
        },
        {
          speaker: 'Commander Diggs',
          text: 'Roll with me back to the gate and help me reclaim the armory!',
          look: DIGGS_LOOK,
          hz: 140,
        },
      ],
    },
    objectives: [
      {
        kind: 'chase-follow',
        text: 'Follow Commander Diggs back to the Fort Sandpit gate',
        leaderName: 'Commander Diggs',
        leaderKind: 'zero-turn',
        leaderLook: DIGGS_LOOK,
        waypoints: [[300, 40], [340, 56], [BASE.gateX, BASE.gateZ]],
        speed: 18,
        maxDist: 80,
        hint: 'Fort Sandpit Gate',
      },
      {
        kind: 'crack',
        text: 'Crack the HOA lockout enforcers outside Fort Sandpit',
        targets: [
          { id: 'armory-hoa-1', name: 'Lockout Enforcer Cobb', near: [368, 42], hint: 'Fort Sandpit Gate', look: HOA_LOOK },
          { id: 'armory-hoa-2', name: 'Lockout Enforcer Marl', near: [380, 42], hint: 'Fort Sandpit Gate', look: HOA_LOOK },
          { id: 'armory-hoa-3', name: 'Lockout Enforcer Shale', near: [374, 52], hint: 'Fort Sandpit Gate', look: HOA_LOOK },
        ],
      },
      {
        kind: 'visit',
        text: 'Reclaim the Fort Sandpit armory inside the gate',
        at: [374, 10],
        radius: 12,
        hint: 'Fort Sandpit Armory',
      },
    ],
    doneText: 'Spade Guard, Unmowed, Carburettors, and Cloverfield—every crew in four biomes is now aligned against Vesper.',
  },
];
