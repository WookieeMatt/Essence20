import { jest } from '@jest/globals';
import { parseStatBlock } from "./stat-block-parser.mjs";
import {
  applyCompendiumMatches,
  buildMatchLookup,
  actorToIr,
  createActorFromStatBlock,
  armorBonusFor,
  buildActorData,
  buildHealth,
  buildSimpleItems,
  buildWeaponData,
  buildWeaponEffectData,
  computeDefenseBonus,
  inferWeaponStyle,
} from "./stat-block-import.mjs";

/*
 * The fixture is the same synthesized Power Rangers CRB-shaped block the parser tests use, run
 * through the real parser - so these tests exercise the actual IR shape rather than a hand-built
 * stand-in that could drift away from what the parser emits.
 */
const STAT_BLOCK = `
Gravel Golem (Normal)
THREAT LEVEL: 6
SIZE: GIGANTIC | HEALTH: 8
GROUND MOVEMENT: 30ft | AERIAL
MOVEMENT: 45ft
STRENGTH: 5 | SPEED: 4
SMARTS: 2 | SOCIAL: 1
TOUGHNESS: 15 | EVASION: 14
WILLPOWER: 12 | CLEVERNESS: 11
SKILLS
Alertness (Insight) +d4*
Conditioning +3
Initiative +d4
PERKS
Stone Skin: The Gravel Golem reduces all incoming damage by 1.
ATTACKS
Boulder Toss (Might): +d6*, Reach x2 (1 Blunt damage)
Alternate Effects: 2 Acid damage
Hands: 2
Grit Spray (Targeting): +d4, Range 20ft/40ft (1 Energy damage)
POWERS
Quarry Quake (2/scene, Standard): The golem stamps the ground.
HANG-UPS
Slow to Start: Cannot take a Move action on the first round.
EQUIPMENT
Armor: Scree Carapace (+3 deflective to Toughness)
`;

const ir = parseStatBlock(STAT_BLOCK);

describe("computeDefenseBonus", () => {
  test("returns the residual the sheet needs to display the printed Defense", () => {
    // _prepareDefenses computes 10 + essence + bonus, so a printed 15 off Strength 5 needs 0.
    expect(computeDefenseBonus(15, 5)).toBe(0);
  });

  test("subtracts armour already accounted for in the .armor field", () => {
    expect(computeDefenseBonus(30, 14, 6)).toBe(0);
  });

  test("treats a missing Essence as zero rather than throwing", () => {
    expect(computeDefenseBonus(12, null)).toBe(2);
  });

  test("returns null when the block printed no value", () => {
    expect(computeDefenseBonus(null, 4)).toBeNull();
  });

  test("can go negative, which the UI surfaces rather than silently clamping", () => {
    expect(computeDefenseBonus(8, 5)).toBe(-7);
  });
});

describe("buildHealth", () => {
  test("takes Conditioning back out of origin, since printed Health already includes it", () => {
    // Polluticorn (Grown): printed Health 13 with Conditioning +3 -> origin 10, so
    // _prepareHealth's own origin + conditioning lands back on 13 instead of 16.
    expect(buildHealth(13, 3)).toEqual({ origin: 10, value: 13 });
  });

  test("leaves origin equal to the printed value when there is no Conditioning", () => {
    expect(buildHealth(7, 0)).toEqual({ origin: 7, value: 7 });
  });

  test("returns zeroes for a block with no printed Health", () => {
    expect(buildHealth(null)).toEqual({ origin: 0, value: 0 });
  });
});

describe("armorBonusFor", () => {
  test("totals armour deflection attributed to one Defense", () => {
    expect(armorBonusFor(ir, 'toughness')).toBe(3);
  });

  test("returns zero for a Defense no equipment mentions", () => {
    expect(armorBonusFor(ir, 'evasion')).toBe(0);
  });
});

describe("buildActorData", () => {
  const data = buildActorData(ir, { raw: STAT_BLOCK });

  test("creates an npc by default and carries the printed name", () => {
    expect(data.type).toBe('npc');
    expect(data.name).toBe('Gravel Golem (Normal)');
  });

  test("writes Essences to both max and value", () => {
    expect(data.system.essences.strength).toEqual({ max: 5, value: 5 });
    expect(data.system.essences.social).toEqual({ max: 1, value: 1 });
  });

  test("writes the armour to .armor and only the remainder to .bonus", () => {
    // Printed Toughness 15 = 10 base + 5 Strength + 3 armour would overshoot by 3, so the
    // residual has to be -3 for the sheet to actually show 15.
    expect(data.system.defenses.toughness).toEqual({ armor: 3, bonus: -3 });
    expect(data.system.defenses.evasion).toEqual({ armor: 0, bonus: 0 });
  });

  test("writes Health net of Conditioning, and Conditioning itself", () => {
    expect(data.system.health).toEqual({ origin: 5, value: 8 });
    expect(data.system.conditioning).toBe(3);
  });

  test("writes movement bases", () => {
    expect(data.system.movement).toEqual({ ground: { base: 30 }, aerial: { base: 45 } });
  });

  test("marks every parsed skill as chosen so it shows on the NPC sheet", () => {
    expect(data.system.skills.initiative).toMatchObject({ isChosen: true, shift: 'd4' });
  });

  test("records a parenthetical as a granted specialization keyed by its slug", () => {
    expect(data.system.skills.alertness.isSpecialized).toBe(true);
    expect(data.system.skills.alertness.specializations.insight).toMatchObject({
      name: 'Insight', shift: 'd4', isSpecialized: true, granted: true,
    });
  });

  test("sizes the prototype token from the Size class", () => {
    // _preUpdate only syncs token size when Size CHANGES, so creation has to set it explicitly
    // or a Gigantic Threat would arrive as a 1x1 token.
    expect(data.prototypeToken).toEqual({ width: 4, height: 4 });
  });

  test("falls back to a common-sized token when Size is unknown", () => {
    const sizeless = buildActorData({ ...ir, size: null });
    expect(sizeless.prototypeToken).toEqual({ width: 1, height: 1 });
  });

  test("stores the raw paste and the IR for later re-parsing", () => {
    expect(data.flags.essence20.statBlockSource.raw).toBe(STAT_BLOCK);
    expect(data.flags.essence20.statBlockSource.ir.threatLevel).toBe(6);
  });

  test("omits Essences and Defenses the block printed as '--'", () => {
    const vehicle = parseStatBlock([
      'Rig', 'THREAT LEVEL: 2', 'SIZE: Large | HEALTH: 4',
      'STRENGTH: 3 | SPEED: 2 | SMARTS: -- | SOCIAL: --',
      'TOUGHNESS: 13 | EVASION: 12', 'WILLPOWER: -- | CLEVERNESS: --',
    ].join('\n'));
    const built = buildActorData(vehicle);

    expect(built.system.essences).toEqual({ strength: { max: 3, value: 3 }, speed: { max: 2, value: 2 } });
    expect(Object.keys(built.system.defenses)).toEqual(['toughness', 'evasion']);
  });
});

describe("buildActorData - vehicle and Zord actor types", () => {
  const vehicleIr = parseStatBlock([
    'A.P.C.', 'THREAT LEVEL: 2', 'SIZE: Extended | HEALTH: 5',
    'MOVEMENT: 45 ft Ground',
    'STRENGTH: 4 | SPEED: 1 | SMARTS: -- | SOCIAL: --',
    'TOUGHNESS: 15 | EVASION: 11', 'WILLPOWER: -- | CLEVERNESS: --',
  ].join('\n'));

  test("writes machine Essences as {value} only, since machine.mjs has no .max", () => {
    // data/actor/templates/machine.mjs uses {usesDrivers, value}; _prepareDefenses already falls
    // back to .value, so the Defense arithmetic is unaffected.
    const built = buildActorData(vehicleIr, { type: 'vehicle' });
    expect(built.system.essences).toEqual({ strength: { value: 4 }, speed: { value: 1 } });
  });

  test("still writes {max, value} for a character-shaped actor type", () => {
    expect(buildActorData(vehicleIr, { type: 'npc' }).system.essences.strength)
      .toEqual({ max: 4, value: 4 });
  });

  test("computes the same Defense residual for a machine as for an NPC", () => {
    const vehicle = buildActorData(vehicleIr, { type: 'vehicle' });
    const npc = buildActorData(vehicleIr, { type: 'npc' });
    expect(vehicle.system.defenses).toEqual(npc.system.defenses);
    expect(vehicle.system.defenses.toughness).toEqual({ armor: 0, bonus: 1 });
  });

  test("keeps Threat Level for a vehicle", () => {
    expect(buildActorData(vehicleIr, { type: 'vehicle' }).system.threatLevel).toBe(2);
  });

  test("omits Threat Level for a Zord, which has no such field", () => {
    // data/actor/zord.mjs composes common + machine + zordBase, none of which define threatLevel.
    expect(buildActorData(vehicleIr, { type: 'zord' }).system.threatLevel).toBeUndefined();
  });

  test("sizes a machine's prototype token from its Size like any other type", () => {
    expect(buildActorData(vehicleIr, { type: 'vehicle' }).prototypeToken)
      .toEqual({ width: 4, height: 2 });
  });
});

describe("inferWeaponStyle", () => {
  test("reads a Reach clause as melee", () => {
    expect(inferWeaponStyle({ isReach: true, damageType: 'blunt' })).toBe('melee');
  });

  test("reads a Blast shape as explosive", () => {
    expect(inferWeaponStyle({ isReach: false, shape: 'burst', damageType: 'sharp' })).toBe('explosive');
  });

  test("reads an energy-ish damage type as energy", () => {
    expect(inferWeaponStyle({ isReach: false, damageType: 'element' })).toBe('energy');
  });

  test("falls back to projectile", () => {
    expect(inferWeaponStyle({ isReach: false, damageType: 'sharp' })).toBe('projectile');
  });
});

describe("buildWeaponData", () => {
  const melee = buildWeaponData(ir.attacks.find(attack => attack.name === 'Boulder Toss'));
  const ranged = buildWeaponData(ir.attacks.find(attack => attack.name === 'Grit Spray'));

  test("creates one weapon carrying the traits and required skill", () => {
    expect(melee.weapon).toMatchObject({ name: 'Boulder Toss', type: 'weapon' });
    expect(melee.weapon.system.requirements.skill).toBe('might');
    expect(melee.weapon.system.equipped).toBe(true);
  });

  test("creates one weaponEffect per printed damage clause", () => {
    expect(melee.effects).toHaveLength(2);
    expect(melee.effects[0].system).toMatchObject({ damageValue: 1, damageType: 'blunt' });
    expect(melee.effects[1].system).toMatchObject({ damageValue: 2, damageType: 'acid' });
  });

  test("carries the reach multiplier and infers a melee style", () => {
    expect(melee.effects[0].system.range.reachMultiplier).toBe(2);
    expect(melee.effects[0].system.classification).toEqual({ skill: 'might', style: 'melee' });
  });

  test("carries printed ranges and infers an energy style for Energy damage", () => {
    expect(ranged.effects[0].system.range).toMatchObject({ value: 20, long: 40 });
    expect(ranged.effects[0].system.classification.style).toBe('energy');
    expect(ranged.effects[0].system.damageType).toBe('element');
  });

  test("applies the parsed Hands count to every effect on the weapon", () => {
    expect(melee.effects.map(effect => effect.system.numHands)).toEqual([2, 2]);
  });

  test("defends against Toughness unless the block says otherwise", () => {
    expect(ranged.effects[0].system.defenseType).toBe('toughness');
  });
});

describe("buildWeaponEffectData", () => {
  test("fills safe defaults for a clause with no printed damage", () => {
    const effect = buildWeaponEffectData({ isReach: true }, { name: 'Shove', skill: 'might' });
    expect(effect.system).toMatchObject({ damageValue: 0, damageType: 'blunt', numHands: 1 });
    expect(effect.system.range).toEqual({ min: null, long: null, reachMultiplier: null, value: null });
  });
});

describe("buildSimpleItems", () => {
  const items = buildSimpleItems(ir);

  test("creates a perk, a power and a hang-up", () => {
    expect(items.map(item => item.type)).toEqual(['perk', 'power', 'hangUp']);
  });

  test("keeps each entry's text as its description", () => {
    expect(items[0].system.description).toBe('The Gravel Golem reduces all incoming damage by 1.');
  });

  test("types a Threat Power as threat and carries its uses and action", () => {
    expect(items[1].system).toMatchObject({
      type: 'threat', usesPer: 2, usesInterval: 'perScene', actionType: 'standard',
    });
  });

  test("types a Threat Perk as general, since E20.perkTypes has no threat key", () => {
    expect(items[0].system.type).toBe('general');
  });

  test("omits uses fields entirely for a Power that prints none", () => {
    const [power] = buildSimpleItems({ powers: [{ name: 'Aura', text: 'x', usesPer: null }] });
    expect(power.system.usesPer).toBeUndefined();
    expect(power.system.usesInterval).toBeUndefined();
  });
});

describe("actorToIr", () => {
  /** A stand-in for a live NPC: only the fields actorToIr reads, with derived totals filled in. */
  const makeActor = (overrides = {}) => ({
    name: 'Rust Wraith',
    getFlag: () => null,
    system: {
      threatLevel: 14,
      size: 'towering',
      conditioning: 2,
      health: { max: 18, origin: 16, value: 18 },
      essences: { strength: { max: 12 }, speed: { max: 9 }, smarts: { max: 7 }, social: { max: 4 } },
      defenses: {
        toughness: { total: 28 }, evasion: { total: 19 },
        willpower: { total: 17 }, cleverness: { total: 14 },
      },
      movement: { ground: { total: 40 }, aerial: { total: 30 }, swim: { total: 0 }, climb: { total: 0 } },
      languages: ['Machine Cant'],
      skills: {
        might: { isChosen: true, shift: 'd8', isSpecialized: true, specializations: { brawling: { name: 'Brawling' } } },
        alertness: { isChosen: true, shift: 'd6', isSpecialized: false, specializations: {} },
        driving: { isChosen: false, shift: 'd20', specializations: {} },
      },
      ...overrides,
    },
    items: [
      { id: 'w1', name: 'Oxide Blade', type: 'weapon', system: { traits: ['acid'], requirements: { skill: 'finesse' } } },
      {
        id: 'e1', name: 'Oxide Blade', type: 'weaponEffect', flags: { essence20: { parentId: 'w1' } },
        system: {
          damageValue: 5, damageType: 'sharp', numHands: 1, radius: 0, shape: null,
          defenseType: 'toughness', classification: { skill: 'finesse' },
          range: { value: null, long: null, min: null, reachMultiplier: 2 },
        },
      },
      {
        id: 'e2', name: 'Acid Wash', type: 'weaponEffect', flags: { essence20: { parentId: 'w1' } },
        system: {
          damageValue: 2, damageType: 'acid', numHands: 1, radius: 0, shape: null,
          defenseType: 'toughness', classification: { skill: 'finesse' },
          range: { value: null, long: null, min: null, reachMultiplier: null },
        },
      },
      { name: 'Corroding Touch', type: 'perk', system: { description: 'Oxidizes what it grapples.' } },
      { name: 'Scrap Surge', type: 'power', system: { description: 'Hurls shrapnel.', usesPer: 1, usesInterval: 'perScene', actionType: 'standard' } },
      { name: 'Brittle', type: 'hangUp', system: { description: 'Cracks under cold.' } },
    ],
  });

  test("reads the printed numbers straight off the derived totals", () => {
    const read = actorToIr(makeActor());
    expect(read).toMatchObject({
      name: 'Rust Wraith', threatLevel: 14, size: 'towering', health: 18, conditioning: 2,
      essences: { strength: 12, speed: 9, smarts: 7, social: 4 },
      defenses: { toughness: 28, evasion: 19, willpower: 17, cleverness: 14 },
      languages: ['Machine Cant'],
    });
  });

  test("treats a zero movement total as absent rather than as 0ft", () => {
    expect(actorToIr(makeActor()).movement).toEqual({ ground: 40, aerial: 30, swim: null, climb: null });
  });

  test("includes only the skills the sheet itself shows", () => {
    const read = actorToIr(makeActor());
    expect(read.skills.map(s => s.key)).toEqual(['might', 'alertness']);
    expect(read.skills[0]).toMatchObject({ shift: 'd8', isSpecialized: true, specialization: 'Brawling' });
  });

  test("rebuilds an attack from its weapon and child weaponEffects", () => {
    const [attack] = actorToIr(makeActor()).attacks;
    expect(attack).toMatchObject({
      name: 'Oxide Blade', skill: 'finesse', damageValue: 5, damageType: 'sharp', traits: ['acid'],
    });
    expect(attack.range.reachMultiplier).toBe(2);
    expect(attack.alternateEffects).toHaveLength(1);
    expect(attack.alternateEffects[0]).toMatchObject({ name: 'Acid Wash', damageValue: 2, damageType: 'acid' });
  });

  test("sorts items back into their own sections", () => {
    const read = actorToIr(makeActor());
    expect(read.perks.map(p => p.name)).toEqual(['Corroding Touch']);
    expect(read.powers[0]).toMatchObject({ name: 'Scrap Surge', usesPer: 1, actionType: 'standard' });
    expect(read.hangUps.map(h => h.name)).toEqual(['Brittle']);
  });

  test("prefers the lossless statBlockSource flag when the actor has one", () => {
    const actor = makeActor();
    actor.getFlag = () => ({ ir: { name: 'From The Flag', threatLevel: 99 } });
    expect(actorToIr(actor)).toMatchObject({ name: 'From The Flag', threatLevel: 99 });
  });

  test("re-reads the document when told to ignore the flag", () => {
    const actor = makeActor();
    actor.getFlag = () => ({ ir: { name: 'From The Flag' } });
    expect(actorToIr(actor, { preferFlag: false }).name).toBe('Rust Wraith');
  });
});

describe("buildMatchLookup", () => {
  test("keys every matched entry by type and name, ignoring unmatched ones", () => {
    const lookup = buildMatchLookup({
      perks: [{ name: 'Stone Skin', match: { uuid: 'x' } }, { name: 'Nothing', match: null }],
      powers: [{ name: 'Quarry Quake', match: { uuid: 'y' } }],
      hangUps: [],
    });

    expect(lookup.get('perk::stoneskin')).toEqual({ uuid: 'x' });
    expect(lookup.get('power::quarryquake')).toEqual({ uuid: 'y' });
    expect(lookup.has('perk::nothing')).toBe(false);
    expect(lookup.size).toBe(2);
  });
});

describe("applyCompendiumMatches", () => {
  const bare = () => [
    { name: 'Stone Skin', type: 'perk', system: { description: 'Reduces damage by 1.', type: 'general' } },
    { name: 'Unmatched Perk', type: 'perk', system: { description: 'Nothing matches me.', type: 'general' } },
  ];

  afterEach(() => {
    global.fromUuid.mockReset();
    delete global.game.items;
  });

  test("returns the bare items untouched when there are no matches", async () => {
    const items = bare();
    await expect(applyCompendiumMatches(items, null)).resolves.toEqual({ items, substituted: 0 });
  });

  test("swaps a matched item for a real compendium copy", async () => {
    const source = { name: 'Stone Skin', type: 'perk' };
    global.fromUuid.mockResolvedValue(source);
    global.game.items = {
      fromCompendium: jest.fn(() => ({
        name: 'Stone Skin',
        type: 'perk',
        system: { description: '', type: 'threat' },
        effects: [{ name: 'An Active Effect' }],
        _stats: { compendiumSource: 'Compendium.essence20.pr_crb.Item.aaa' },
      })),
    };

    const { items, substituted } = await applyCompendiumMatches(bare(), {
      perks: [{ name: 'Stone Skin', match: { uuid: 'Compendium.essence20.pr_crb.Item.aaa' } }],
    });

    expect(substituted).toBe(1);
    // The compendium copy's Active Effects and provenance are what make automation work at all.
    expect(items[0].effects).toEqual([{ name: 'An Active Effect' }]);
    expect(items[0]._stats.compendiumSource).toBe('Compendium.essence20.pr_crb.Item.aaa');
    // Shipped packs omit descriptions for copyright reasons, so the pasted text fills the gap.
    expect(items[0].system.description).toBe('Reduces damage by 1.');
    // Everything unmatched is left exactly as it was.
    expect(items[1].name).toBe('Unmatched Perk');
  });

  test("keeps the compendium item's own description when it has one", async () => {
    global.fromUuid.mockResolvedValue({ name: 'Stone Skin', type: 'perk' });
    global.game.items = {
      fromCompendium: jest.fn(() => ({
        name: 'Stone Skin', type: 'perk', system: { description: 'Official text.' },
      })),
    };

    const { items } = await applyCompendiumMatches(bare(), {
      perks: [{ name: 'Stone Skin', match: { uuid: 'uuid' } }],
    });
    expect(items[0].system.description).toBe('Official text.');
  });

  test("falls back to the bare item when the match can no longer be resolved", async () => {
    global.fromUuid.mockResolvedValue(null);
    const { items, substituted } = await applyCompendiumMatches(bare(), {
      perks: [{ name: 'Stone Skin', match: { uuid: 'Compendium.gone.Item.zzz' } }],
    });

    expect(substituted).toBe(0);
    expect(items[0].system.description).toBe('Reduces damage by 1.');
  });
});

describe("createActorFromStatBlock", () => {
  test("refuses to write into a compendium pack", async () => {
    // Parsed book text is only ever allowed to land in the GM's own world - see the standing
    // rule against putting rulebook text into shipped compendium items.
    await expect(createActorFromStatBlock(ir, { pack: 'essence20.prcrbitems' }))
      .rejects.toThrow(/world documents only/);
  });
});
