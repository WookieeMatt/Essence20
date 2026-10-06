import { jest } from '@jest/globals';
import {
  creatureTagsOf, isImmuneToSkill, isMachineEmpire, isMechanical, isNonHuman, isNonHumanoid, isObjectOrStructure, isPuttyOrTenga, isRobotic,
} from '../characters/creature-tags.mjs';
import { applyDefenseDamage, clearDefenseDamage, defenseDamageOf, essenceDamageOf, healEssenceDamage } from './essence-damage.mjs';
import { movementPenaltyFor, pushDestination } from './forced-movement.mjs';
import { resolveSaveRoll } from './save-riders.mjs';
import { coatingCost, coatingOf, isHackerPoison, poisonAffects, resolveCoatingRoll, wipeCoating } from '../../items/gear/poison-coating.mjs';
import { canUseRider, isRiderUse, riderUseFor } from './rider-uses.mjs';
import {
  addMark, applyRollRiders, buildRiderContext, disarm, findMark, getMarks,
  handleRiderButton, hasConditionFrom, isVsPrimaryQuarry, noteRoller, removeMark,
  RIDER, rollRiderSources, stampConditionSource, stanceOf, untilEndOfNextTurn, weaponUnusable,
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

// (A vehicle's switched-on Radar Jammer is an aura RollModifier rule on the upgrade now - rules/conv14-systems.test.js.)

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
    const actor = makeActor([poison, weapon, effect]);
    expect(coatingCost(actor)).toBe('standard');
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
    const quake = perk(RIDER.suppressingFire);
    quake.parent = actor;
    expect(riderUseFor(quake)).toBe('suppressingFire');
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

  // (Make an Opening's dialog downshift is a DialogSwitch rule now - rules/conv15-uses.test.js.)
  test("a stance read off its flag", async () => {
    const actor = makeActor();
    actor.flags.essence20.riderStance = { allOutAttack: 2, evasiveFighting: 1 };
    expect(stanceOf(actor)).toEqual({ allOutAttack: 2, evasiveFighting: 1 });
    expect(untilEndOfNextTurn(actor)).toEqual({});
  });

  // (Pinpoint is a DialogSwitch rule now - rules/conv15-uses.test.js.)
});

describe("before the roll", () => {
  test("a target's stance, marks and tags", () => {
    const attacker = makeActor([], { id: 'att' });
    const target = makeActor([], { id: 'tgt', name: 'Putty', system: { creatureTags: 'putty, robot' } });
    target.flags.essence20.riderStance = { allOutAttack: 2, evasiveFighting: 1 };
    const { sources } = rollRiderSources(attacker, target, { item: { type: 'weaponEffect', system: { radius: 10 } }, isAttack: true });
    const ids = sources.map(s => s.id);
    expect(ids).toEqual(expect.arrayContaining(['rider-allOutAttack', 'rider-evasiveFighting']));
  });

  // (Armor Upgrade bonuses - rules/plugins/combat/armor-upgrades.mjs, rules/engine15-uses.test.js.)
});

describe("after the roll", () => {
  // (Reveal Weakness's +1 is a HitRider rule now - rules/conv15-uses.test.js.)
  test("an Ablative Matrix's loss is read off its flag", async () => {
    const attacker = makeActor();
    const ablative = item('enigma_of_combination', 'fuztUMiuiIXsk2sI', { type: 'upgrade', system: { armorBonus: { value: 5 } } });
    ablative._source = { system: { armorBonus: { value: 5 } } };
    const target = makeActor([ablative], { uuid: 'Actor.t' });
    fromUuid.mockImplementation(async uuid => (uuid == 'Actor.t' ? target : uuid == 'Item.fx' ? { type: 'weaponEffect' } : null));
    const results = [{ targetUuid: 'Actor.t', success: true, damageValue: 2, multiplier: 1, criticalOptions: [] }];
    await applyRollRiders(attacker, results, { entries: [{}], riderContext: { itemUuid: 'Item.fx', consumes: [] } }, { isCrit: true });
    expect(results[0].damageValue).toBe(2);
    expect(ablativeLossOf(ablative)).toBe(0);
    ablative.flags.essence20.ablativeLoss = 2;
    expect(ablativeLossOf(ablative)).toBe(2);
  });

  test("the rider context reads the dataset", () => {
    // Disarming Shot is its DialogSwitch's key now (ruleKeys); the old applyDisarmingShot flag nothing sets is ignored.
    const context = buildRiderContext(makeActor(), null, { riderSpec: '{"kind":"save"}', skill: 'brawn' }, { ruleKeys: ['disarmingShot'] });
    expect(context.spec).toEqual({ kind: 'save' });
    expect(context.disarmingShot).toBe(true);
    expect(buildRiderContext(makeActor(), null, {}, { applyDisarmingShot: true }).disarmingShot).toBe(false);
  });

  test("card buttons: Defense damage and a mark", async () => {
    const target = makeActor();
    expect(await handleRiderButton({ speaker: {} }, { dataset: { defense: 'toughness' } }, target)).toBe(true);
    expect(defenseDamageOf(target)).toEqual({ toughness: 1 });
    expect(await handleRiderButton({ speaker: {} }, { dataset: { rider: 'nextAttackSnag' } }, target)).toBe(true);
    expect(findMark(target, 'nextAttackSnag')).toBeTruthy();
    expect(await handleRiderButton({ speaker: {} }, { dataset: {} }, target)).toBe(false);
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
  // (Wrecking Ball is a setToggle Use rule now - rules/conv15-uses.test.js.)
  test("Secondary Mark makes a second Primary Quarry", () => {
    const actor = makeActor([perk(RIDER.secondaryQuarry)]);
    actor.flags.essence20.secondaryQuarryUuid = 'Actor.q2';
    expect(isVsPrimaryQuarry(actor, { uuid: 'Actor.q2' })).toBe(true);
    expect(isVsPrimaryQuarry(actor, { uuid: 'Actor.q3' })).toBe(false);
  });
});
