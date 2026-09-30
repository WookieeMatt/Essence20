import { jest } from '@jest/globals';
import {
  creatureTagsOf, isImmuneToSkill, isMachineEmpire, isMechanical, isNonHuman, isNonHumanoid, isObjectOrStructure, isPuttyOrTenga, isRobotic,
} from './creature-tags.mjs';
import { applyDefenseDamage, clearDefenseDamage, defenseDamageOf, essenceDamageOf, healEssenceDamage } from './essence-damage.mjs';
import { movementPenaltyFor, pushDestination } from './forced-movement.mjs';
import { resolveSaveRoll } from './save-riders.mjs';
import { coatingCost, coatingOf, isHackerPoison, poisonAffects, resolveCoatingRoll, wipeCoating } from './poison-coating.mjs';
import { canUseRider, isRiderUse, riderUseFor } from './rider-uses.mjs';
import {
  addMark, applyDialogRiders, applyRollRiders, armorUpgradeBonuses, buildRiderContext, disarm, fanaticCap, findMark, getMarks,
  handleRiderButton, hasConditionFrom, isGremlinsMischiefActive, isVsPrimaryQuarry, isWreckingBallActive, noteRoller, onDamageDealt, removeMark,
  RIDER, riderDefenseAdjust, riderDialogFlags, rollRiderSources, stampConditionSource, stanceOf, untilEndOfNextTurn, weaponUnusable,
  ablativeLossOf,
} from './target-riders.mjs';

function flagged(obj) {
  obj.flags ??= {};
  obj.flags.essence20 ??= {};
  obj.getFlag = (scope, key) => obj.flags?.[scope]?.[key];
  obj.setFlag = jest.fn(async (scope, key, value) => {
    obj.flags[scope] ??= {};
    obj.flags[scope][key] = value;
  });
  obj.unsetFlag = jest.fn(async (scope, key) => {
    delete obj.flags?.[scope]?.[key];
  });
  return obj;
}

const item = (pack, id, extra = {}) => flagged({
  type: extra.type ?? 'perk', name: extra.name ?? id, id: extra.id ?? id,
  flags: { core: { sourceId: `Compendium.essence20.${pack}.Item.${id}` }, essence20: { ...(extra.flags ?? {}) } },
  system: extra.system ?? {},
  update: jest.fn(async function (changes) {
    for (const [path, value] of Object.entries(changes)) {
      const parts = path.split('.');
      let o = this;
      for (const part of parts.slice(0, -1)) {
        o[part] ??= {};
        o = o[part];
      }

      o[parts.at(-1)] = value;
    }
  }),
  delete: jest.fn(),
});
const perk = uuid => {
  const [, , pack, , id] = uuid.split('.');
  return item(pack, id);
};

function makeActor(items = [], extra = {}) {
  const list = [...items];
  const actor = flagged({
    id: extra.id ?? 'a1', uuid: extra.uuid ?? `Actor.${extra.id ?? 'a1'}`, name: extra.name ?? 'Tester', type: extra.type ?? 'npc',
    statuses: new Set(extra.statuses ?? []), effects: extra.effects ?? [],
    system: { essences: {}, skills: {}, ...(extra.system ?? {}) },
    items: Object.assign(list, {
      contents: list,
      get: id => list.find(i => i.id == id),
    }),
    update: jest.fn(async () => {}),
    toggleStatusEffect: jest.fn(async () => {}),
  });
  for (const i of list) {
    i.parent = actor;
  }

  return actor;
}

beforeEach(() => {
  global.game = {
    i18n: { localize: k => k, format: k => k },
    settings: { get: () => 1 },
    combat: null,
    user: { targets: new Set(), isGM: true, isActiveGM: true },
    actors: { get: () => null },
  };
  global.CONFIG = {
    E20: {
      actorSizes: { small: '', common: '', large: '' }, essences: { strength: 'S', speed: 'Sp', smarts: 'Sm', social: 'So' },
      damageTypes: { fire: 'Fire', sharp: 'Sharp', stun: 'Stun' }, defenses: { toughness: 'T' }, skills: {}, poisonApplications: { contact: '', ingested: '', inhaled: '' },
      availabilityDifficulties: { standard: 0 },
    },
    statusEffects: [],
  };
  global.canvas = { tokens: { placeables: [] }, scene: { regions: { contents: [] } }, dimensions: { size: 100, distancePixels: 20 } };
  global.fromUuid = jest.fn(async () => null);
  global.ChatMessage = { create: jest.fn(), getSpeaker: jest.fn(() => ({})) };
});

describe("a vehicle's switched-on Radar Jammer", () => {
  test("gives Technology tests within its radius a Snag", () => {
    const roller = makeActor([], { id: 'r' });
    const own = { center: { x: 0 }, actor: roller };
    roller.getActiveTokens = () => [own];
    const vehicle = { name: 'Jammer Truck', items: [], flags: { essence20: { jamming: 50 } } };
    canvas.grid = { measurePath: ([a, b]) => ({ distance: Math.abs(a.x - b.x) }) };
    canvas.tokens.placeables = [own, { center: { x: 40 }, actor: vehicle }];

    expect(rollRiderSources(roller, null, { rolledSkill: 'technology' }).sources.some(s => s.id == 'rider-jammer' && s.snag)).toBe(true);
    expect(rollRiderSources(roller, null, { rolledSkill: 'alertness' }).sources.some(s => s.id == 'rider-jammer')).toBe(false);
    canvas.tokens.placeables[1].center.x = 60;
    expect(rollRiderSources(roller, null, { rolledSkill: 'technology' }).sources.some(s => s.id == 'rider-jammer')).toBe(false);
  });
});

describe("creature tags", () => {
  test("typed tags, and what an actor's type implies", () => {
    expect([...creatureTagsOf({ system: { creatureTags: 'Robot, Machine Empire' } })]).toEqual(['robot', 'machine empire']);
    expect(isRobotic({ system: { canTransform: true } })).toBe(true);
    expect(isMechanical({ type: 'vehicle', system: {} })).toBe(true);
    expect(isRobotic({ type: 'companion', system: { type: 'drone' } })).toBe(true);
    expect(isPuttyOrTenga({ name: 'Putty Patroller', system: {} })).toBe(true);
    expect(isMachineEmpire({ system: { creatureTags: 'machine empire' } })).toBe(true);
    expect(isNonHumanoid({ system: { creatureTags: 'monster' } })).toBe(true);
    expect(isNonHumanoid({ system: { creatureTags: 'monster, robot' } })).toBe(false);
    expect(isNonHuman({ system: { creatureTags: 'alien' } })).toBe(true);
    expect(isNonHuman({ type: 'companion', system: { type: 'human' } })).toBe(false);
    expect(isObjectOrStructure({ system: { creatureTags: 'wall' } })).toBe(true);
    expect(isImmuneToSkill({ system: { creatureTags: 'immune:persuasion' } }, 'persuasion')).toBe(true);
    expect(isImmuneToSkill({ system: { creatureTags: 'mindless' } }, 'deception')).toBe(true);
    expect(isImmuneToSkill({ system: {} }, 'deception')).toBe(false);
  });
});

describe("Essence and Defense damage", () => {
  test("Essence damage is the gap below max; healing fills the worst first", async () => {
    const actor = makeActor([], { system: { essences: { strength: { max: 3, value: 1 }, speed: { max: 2, value: 1 } } } });
    expect(essenceDamageOf(actor)).toBe(3);
    expect(await healEssenceDamage(actor, 2)).toBe(2);
    expect(actor.update).toHaveBeenCalledWith({ 'system.essences.strength.value': 3 });
  });

  test("Defense damage builds up and clears", async () => {
    const actor = makeActor();
    await applyDefenseDamage(actor, 'evasion');
    await applyDefenseDamage(actor, 'evasion');
    expect(defenseDamageOf(actor)).toEqual({ evasion: 2 });
    await clearDefenseDamage(actor);
    expect(defenseDamageOf(actor)).toEqual({});
  });
});

describe("forced movement", () => {
  test("a push stops at the first wall", () => {
    const token = { center: { x: 0, y: 0 }, checkCollision: jest.fn((next) => next.x > 250) };
    expect(pushDestination(token, { x: 1, y: 0 }, 20)).toEqual({ x: 200, y: 0 });
  });

  test("Muzzle Punch's slow lands on the target's own turn only", () => {
    const actor = makeActor();
    actor.flags.essence20.movementPenalty = { feet: 5, combatId: 'c', round: 2 };
    game.combat = { id: 'c', round: 2, combatant: { actor } };
    expect(movementPenaltyFor(actor)).toBe(5);
    game.combat.round = 3;
    expect(movementPenaltyFor(actor)).toBe(0);
  });
});

describe("saves", () => {
  test("a failure applies the Condition, an escape success removes it", async () => {
    const actor = makeActor();
    await resolveSaveRoll(actor, { status: 'prone' }, false);
    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('prone', { active: true });
    actor.toggleStatusEffect.mockClear();
    await resolveSaveRoll(actor, { status: 'prone' }, true);
    expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
    await resolveSaveRoll(actor, { status: 'restrained', removeOnSuccess: true }, true);
    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('restrained', { active: false });
  });
});

describe("poisons", () => {
  test("coating cost, hacker poisons and what a coating roll does", async () => {
    const poison = item('cobra_codex', 'poison1', { type: 'weapon', id: 'p1', system: { isPoison: true, quantity: 2 } });
    const weapon = item('gi_joe_crb', 'knife', { type: 'weapon', id: 'w1', system: {} });
    const effect = item('cobra_codex', 'fx', { type: 'weaponEffect', id: 'e1', flags: { parentId: 'p1' }, system: { damageValue: 1, damageType: 'poison' } });
    const actor = makeActor([poison, weapon, effect, perk('Compendium.essence20.cobra_codex.Item.9kQxCeLIm10zB1h7')]);
    expect(coatingCost(actor)).toBe('move');
    expect(isHackerPoison(poison)).toBe(false);
    expect(poisonAffects({ hacker: true }, makeActor())).toBe(false);
    expect(poisonAffects({ hacker: true }, makeActor([], { system: { creatureTags: 'robot' } }))).toBe(true);

    await resolveCoatingRoll(actor, { poisonId: 'p1', weaponId: 'w1' }, { success: true, isCrit: false, isFumble: false });
    expect(coatingOf(weapon)).toEqual({ name: 'poison1', damageValue: 1, damageType: 'poison', hacker: false });
    expect(poison.update).toHaveBeenCalledWith({ 'system.quantity': 1 });
    await wipeCoating(weapon);
    expect(coatingOf(weapon)).toBeNull();
  });
});

describe("Use buttons", () => {
  test("which items get one", () => {
    const actor = makeActor();
    const quake = perk(RIDER.powerQuake);
    quake.parent = actor;
    expect(riderUseFor(quake)).toBe('powerQuake');
    expect(isRiderUse({ type: 'weapon', system: { isPoison: true, poisonApplication: { contact: true } }, flags: {} })).toBe(true);
    expect(canUseRider(quake)).toBe(true);
    expect(isRiderUse({ flags: {} })).toBe(false);
  });
});

describe("marks, stances and Conditions", () => {
  test("marks come and go", async () => {
    const target = makeActor();
    await addMark(target, { kind: 'revealWeakness', by: 'Actor.x' });
    expect(findMark(target, 'revealWeakness')).toBeTruthy();
    await removeMark(target, 'revealWeakness');
    expect(getMarks(target)).toEqual([]);
  });

  test("a Condition knows who caused it", () => {
    noteRoller({ uuid: 'Actor.src' });
    const effect = { parent: { uuid: 'Actor.t' }, updateSource: jest.fn() };
    stampConditionSource(effect, { statuses: ['frightened'] });
    expect(effect.updateSource).toHaveBeenCalledWith({ 'flags.essence20.conditionSource': 'Actor.src' });
    const target = makeActor([], { statuses: ['frightened'], effects: [{ statuses: new Set(['frightened']), flags: { essence20: { conditionSource: 'Actor.src' } } }] });
    expect(hasConditionFrom(target, 'frightened', { uuid: 'Actor.src' })).toBe(true);
    expect(hasConditionFrom(target, 'frightened', { uuid: 'Actor.other' })).toBe(false);
  });

  test("the dialog's downshifts, and the stance they leave", async () => {
    const actor = makeActor([perk(RIDER.allOutAttack)]);
    const options = { shiftDown: 0, allOutAttackShifts: 2, evasiveFightingShifts: 1, applyMakeAnOpening: true };
    await applyDialogRiders(actor, options);
    expect(options.shiftDown).toBe(5);
    expect(stanceOf(actor)).toEqual({ allOutAttack: 2, evasiveFighting: 1 });
    expect(riderDialogFlags(actor, { type: 'weaponEffect', system: { classification: { skill: 'might', style: 'melee' } }, flags: {} }).allOutAttackMax).toBe(5);
    expect(untilEndOfNextTurn(actor)).toEqual({});
  });
});

describe("before the roll", () => {
  test("a target's stance, marks and tags", () => {
    const attacker = makeActor([perk(RIDER.gridChampion), perk(RIDER.botHunter)], { id: 'att' });
    const target = makeActor([perk(RIDER.fragIt)], { id: 'tgt', name: 'Putty', system: { creatureTags: 'putty, robot' } });
    target.flags.essence20.riderStance = { allOutAttack: 2, evasiveFighting: 1 };
    const { sources } = rollRiderSources(attacker, target, { item: { type: 'weaponEffect', system: { radius: 10 } }, isAttack: true });
    const ids = sources.map(s => s.id);
    expect(ids).toEqual(expect.arrayContaining(['rider-fragIt', 'rider-allOutAttack', 'rider-evasiveFighting', 'rider-gridChampion', 'rider-botHunter']));
  });

  test("Defense changes: Energic Shields and Bot-Hunter", () => {
    const shields = perk(RIDER.energicShields);
    shields.flags.essence20.riderChoice = 'fire';
    const target = makeActor([shields, perk(RIDER.botHunter)], { system: { isMorphed: true } });
    const robot = makeActor([], { system: { creatureTags: 'robot' } });
    expect(riderDefenseAdjust(robot, target, 'toughness', { item: { system: { damageType: 'fire' } }, isAttack: true })).toBe(4);
  });

  test("Armor Upgrade bonuses on worn armor", () => {
    const armor = item('gi_joe_crb', 'armor', { type: 'armor', id: 'ar', system: { equipped: true } });
    const upgrade = item('gi_joe_crb', 'plate', { type: 'upgrade', id: 'up', flags: { parentId: 'ar' }, system: { type: 'armor', armorBonus: { defense: 'toughness', value: 2 } } });
    expect(armorUpgradeBonuses(makeActor([armor, upgrade]), 'toughness')).toEqual([2]);
  });

  test("Fanatic caps a big downshift near a commander", () => {
    const actor = makeActor([perk(RIDER.fanatic)]);
    canvas.tokens.placeables = [{ actor: { system: { creatureTags: 'commander' }, items: [] }, document: { disposition: 1 } }];
    expect(fanaticCap(actor, 0, 4).shiftUp).toBe(2);
    expect(fanaticCap(actor, 0, 2)).toBeNull();
  });
});

describe("after the roll", () => {
  test("Reveal Weakness adds damage; Ablative Matrix wears down on a crit", async () => {
    const attacker = makeActor();
    const ablative = item('enigma_of_combination', 'fuztUMiuiIXsk2sI', { type: 'upgrade', system: { armorBonus: { value: 5 } } });
    ablative._source = { system: { armorBonus: { value: 5 } } };
    const target = makeActor([ablative], { uuid: 'Actor.t' });
    target.flags.essence20.riderMarks = [{ kind: 'revealWeakness', by: 'x' }];
    fromUuid.mockImplementation(async uuid => (uuid == 'Actor.t' ? target : uuid == 'Item.fx' ? { type: 'weaponEffect' } : null));
    const results = [{ targetUuid: 'Actor.t', success: true, damageValue: 2, multiplier: 1, criticalOptions: [] }];
    await applyRollRiders(attacker, results, { entries: [{}], riderContext: { itemUuid: 'Item.fx', consumes: [] } }, { isCrit: true });
    expect(results[0].damageValue).toBe(3);
    expect(ablativeLossOf(ablative)).toBe(1);
  });

  test("Headache offers its own Psychic damage button instead of adding to the punch", async () => {
    const attacker = makeActor([perk(RIDER.headache)], { system: { essences: { strength: { max: 4, value: 2 } } } });
    const target = makeActor([], { uuid: 'Actor.t' });
    fromUuid.mockImplementation(async uuid => (uuid == 'Actor.t' ? target : uuid == 'Item.fx' ? { type: 'weaponEffect' } : null));
    const results = [{ targetUuid: 'Actor.t', success: true, damageValue: 2, damageType: 'blunt', multiplier: 1, criticalOptions: [] }];
    await applyRollRiders(attacker, results, { entries: [{}], riderContext: { itemUuid: 'Item.fx', consumes: [], isUnarmed: true } });
    expect(results[0].damageValue).toBe(2);
    expect(results[0].riderOptions).toEqual([expect.objectContaining({ key: 'headache', damageValue: 2, damageType: 'psychic' })]);
  });

  test("the rider context reads the dataset", () => {
    const context = buildRiderContext(makeActor(), null, { riderSpec: '{"kind":"save"}', skill: 'brawn' }, { applyDisarmingShot: true });
    expect(context.spec).toEqual({ kind: 'save' });
    expect(context.disarmingShot).toBe(true);
  });

  test("card buttons: Defense damage and a mark", async () => {
    const target = makeActor();
    expect(await handleRiderButton({ speaker: {} }, { dataset: { defense: 'toughness' } }, target)).toBe(true);
    expect(defenseDamageOf(target)).toEqual({ toughness: 1 });
    expect(await handleRiderButton({ speaker: {} }, { dataset: { rider: 'nextAttackSnag' } }, target)).toBe(true);
    expect(findMark(target, 'nextAttackSnag')).toBeTruthy();
    expect(await handleRiderButton({ speaker: {} }, { dataset: {} }, target)).toBe(false);
  });

  test("Shots Fired marks whoever was damaged", async () => {
    const attacker = makeActor([perk(RIDER.shotsFired)]);
    const target = makeActor([], { id: 't' });
    await onDamageDealt(attacker, target, 1);
    expect(findMark(target, 'shotsFired', attacker.uuid)).toBeTruthy();
  });

  test("a disarmed or dismantled weapon can't be used", async () => {
    foundry.utils.escapeHTML ??= t => t;
    foundry.applications = { api: { DialogV2: { wait: jest.fn(async () => 'w1'), confirm: jest.fn(async () => false) } } };
    const weapon = item('gi_joe_crb', 'gun', { type: 'weapon', id: 'w1', system: { equipped: true, traits: [] } });
    const target = makeActor([weapon]);
    const dropped = await disarm(makeActor(), target, { source: 'Snatch' });
    expect(dropped).toBe(weapon);
    weapon.flags.essence20.disarmed = true;
    weapon.system.equipped = false;
    expect(weaponUnusable(weapon)).toBe('E20.WeaponDisarmed');
    weapon.flags.essence20.dismantled = true;
    expect(weaponUnusable(weapon)).toBe('E20.WeaponDismantled');
  });
});

describe("turn switches", () => {
  test("Gremlins' Mischief and Wrecking Ball last the turn", () => {
    const actor = makeActor();
    game.combat = { id: 'c', round: 1, turn: 2 };
    actor.flags.essence20.gremlinsMischief = { combatId: 'c', round: 1, turn: 2 };
    actor.flags.essence20.wreckingBall = { combatId: 'c', round: 1, turn: 1 };
    expect(isGremlinsMischiefActive(actor)).toBe(true);
    expect(isWreckingBallActive(actor)).toBe(false);
  });

  test("Secondary Mark makes a second Primary Quarry", () => {
    const actor = makeActor([perk(RIDER.secondaryQuarry)]);
    actor.flags.essence20.secondaryQuarryUuid = 'Actor.q2';
    expect(isVsPrimaryQuarry(actor, { uuid: 'Actor.q2' })).toBe(true);
    expect(isVsPrimaryQuarry(actor, { uuid: 'Actor.q3' })).toBe(false);
  });
});
