import { parseStatBlock } from "./stat-block-parser.mjs";
import { buildSimpleItems, printedBonusUpdate, printedEnergonPool } from "./stat-block-import.mjs";

/** Transformers Combiners: members' Combiner features, and a Combiner's own block onto its Megaform (made-up text). */

const member = [
  'Test Tank',
  'THREAT LEVEL: 6',
  'SIZE: Huge HEALTH: 9',
  'PERKS',
  'Gestalt Combiner (Commander [Strength, Speed]): Can combine with the others.',
  'Matched Combiner (Core Essence [Speed], Enhanced Move [Aerial]): Can combine too.',
  'Tough Hide (Rank 2): Not a Combiner Perk.',
].join('\n');

test("a member's Gestalt / Matched Combiner Perk brings the Megaform Traits it names, with their choices", () => {
  const ir = parseStatBlock(member);
  expect(ir.megaformTraits.map(trait => [trait.name, trait.overrides])).toEqual([
    ['Commander [Strength, Speed]', { system: {}, flags: { commanderEssences: ['strength', 'speed'] } }],
    ['Core Essence [Speed]', { system: { essence: 'speed', skill: null }, flags: {} }],
    ['Enhanced Move [Aerial]', { system: { movementType: 'aerial' }, flags: {} }],
  ]);
  expect(ir.megaformTraits[0].matchNames).toContain('Commander');
  // The Perk itself is found by its name before the brackets.
  expect(ir.perks.map(perk => perk.matchNames)).toEqual([['Gestalt Combiner'], ['Matched Combiner'], ['Tough Hide']]);

  const traits = buildSimpleItems(ir, { type: 'npc' }).filter(item => item.type == 'megaformTrait');
  expect(traits[1]).toMatchObject({ system: { essence: 'speed', skill: null }, flags: { essence20: {} } });
  expect(traits[0].flags.essence20.commanderEssences).toEqual(['strength', 'speed']);
});

const combiner = [
  'Test Gestalt',
  'THREAT LEVEL: 16',
  'SIZE: Towering HEALTH: 16/12/9/9/8',
  'MOVEMENT: 40ft Ground',
  'STRENGTH: 13 SPEED: 11',
  'SMARTS: 6 SOCIAL: 8',
  'TOUGHNESS: 25 EVASION: 24',
  'WILLPOWER: 16 CLEVERNESS: 18',
  'PERKS',
  'Energon Pool: It has an Energon Pool of 8.',
].join('\n');

test("a Combiner's own block reads as a Megaform's, with its printed Energon Pool", () => {
  const ir = parseStatBlock(combiner);
  expect(ir.isMegaform).toBe(true);
  expect(printedEnergonPool(ir)).toBe(8);
  expect(printedEnergonPool(parseStatBlock(member))).toBeNull();
});

test("the Bonuses that bring the worked-out Defenses and Movement to the printed numbers", () => {
  const ir = parseStatBlock(combiner);
  const system = {
    defenses: {
      toughness: { total: 24, bonus: 0 }, evasion: { total: 21, bonus: 0 },
      willpower: { total: 19, bonus: 0 }, cleverness: { total: 18, bonus: 0 },
    },
    movement: { ground: { total: 38, bonus: -2 } },
  };
  expect(printedBonusUpdate(ir, system)).toEqual({
    'system.defenses.toughness.bonus': 1,
    'system.defenses.evasion.bonus': 3,
    'system.defenses.willpower.bonus': -3,
    'system.movement.ground.bonus': 0,
  });
});
