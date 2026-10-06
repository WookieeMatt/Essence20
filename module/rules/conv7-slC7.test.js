import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rebuildIndex } from './index.mjs';
import { ruleDerived, ruleDialogSwitches, ruleRollSources } from './adapter.mjs';
import { evaluateTag, contextFor } from './predicate.mjs';
import { useAvailable } from './triggers.mjs';
import { runSteps, stepContext } from './steps.mjs';
import { pressRuleButton } from './buttons.mjs';

/**
 * Round 7 of the slC slices (gij1, gij2, gij3, fix3-gij, situational1, situational2): items moved from
 * hand-written code to item rules with the round-7 engine pieces (endOfNextTurnOrScene, turnOrUntilCombat,
 * to: partyActor, a clicker's button acting for the selected token, combat:enemy:<tags>). Each item is
 * loaded from its pack source and must do what the removed slice code did:
 * - Targeting Eye (gij3): the Free-action mark, ↓1 on own melee attacks, ↑1 for melee attacks against
 *   the holder, projectile ranges doubled unless Scoped - until the end of the holder's next turn.
 * - Junker (gij3): once per mission, +1 attempt on the Party's Requisition pool and an Edge banked for
 *   the next Requisition Test.
 * - Recoil Brace (gij1): once per scene, the braced weapon counts as one-handed for the turn.
 * - Let It Rip (gij1): a Signature Weapon counts as one-handed for the turn (Free action).
 * - Caltrops (situational2): a card whose button makes whoever crosses roll Acrobatics DIF 15.
 * - Bookworm (situational2): its Initiative ↓1 in a library or against a hostile Librarian.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));
const GIJ = id => `Compendium.essence20.gi_joe_crb.Item.${id}`;

const FILES = {
  targetingEye: 'qgtgitems/_source/Targeting_Eye_k8OE8GB2ux24SkQo.json',
  junker: 'qgtgitems/_source/Junker_VpQqwE8GNeqFAHbg.json',
  recoilBrace: 'ccitems/_source/Recoil_Brace_2gURwr6VrgTuIRFQ.json',
  letItRip: 'ccitems/_source/Let_It_Rip_dtB9EUFE45oZNAOR.json',
  caltrops: 'prcrbitems/_source/Caltrops_LN0w8SB1fHhidIVp.json',
  bookworm: 'wtnvcgitems/_source/Bookworm_p2Qk0B5PWp10ZaqN.json',
};

let nextId = 1;
let sceneEpoch = 1;

function setPath(object, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((at, key) => (at[key] ??= {}), object)[last] = value;
}

function updater(doc) {
  return async data => {
    for (const [key, value] of Object.entries(data)) {
      setPath(doc, key, value);
    }
  };
}

/** An item from a pack source (or plain data), ready to sit on an actor. */
function packItem(file, extra = {}) {
  const doc = file ? fromPack(file) : {};
  const item = {
    id: extra.id ?? `i${nextId++}`, name: extra.name ?? doc.name, type: extra.type ?? doc.type,
    flags: { ...(extra.source ? { core: { sourceId: extra.source } } : {}), essence20: { ...(extra.flags ?? {}) } },
    system: { ...(doc.system ?? {}), ...(extra.system ?? {}) },
  };
  item.uuid = `Item.${item.id}`;
  item.update = updater(item);
  return item;
}

function makeActor(items, { system = {}, type = 'playerCharacter', name = 'Hero', statuses = [] } = {}) {
  const actor = {
    id: `a${nextId++}`, name, type, isOwner: true, statuses: new Set(statuses),
    flags: { essence20: {} },
    system: { level: 3, health: { value: 5, max: 10 }, ...system },
    getActiveTokens: () => [],
  };
  actor.uuid = `Actor.${actor.id}`;
  actor.update = updater(actor);
  actor.items = { contents: items, get: id => items.find(item => item.id == id), [Symbol.iterator]: () => items[Symbol.iterator]() };
  items.forEach(item => (item.parent = actor));
  rebuildIndex(actor);
  return actor;
}

const rulesOf = item => item.system.rules;
const useOf = item => rulesOf(item).find(rule => rule.type == 'Use');
const available = item => useAvailable(item, useOf(item), rulesOf(item).indexOf(useOf(item)));

async function use(actor, item, extra = {}) {
  const ctx = stepContext({ actor, item, rule: useOf(item), targets: [] });
  Object.assign(ctx, extra);
  const result = await runSteps(useOf(item).steps, ctx);
  rebuildIndex(actor);
  return { ctx, result };
}

beforeEach(() => {
  sceneEpoch = 1;
  global.game = {
    combat: null, combats: { get: () => null }, user: { id: 'u', isGM: true, targets: new Set() }, users: { contents: [] }, actors: { contents: [] },
    i18n: { localize: k => k, format: k => k },
    // The Scene Clock reads its epochs from settings (mechanics/resources/scene-clock.mjs).
    settings: { get: () => sceneEpoch, set: async () => {} },
  };
  global.ChatMessage = { create: jest.fn(async data => data), getSpeaker: () => ({}) };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
  global.fromUuidSync = () => null;
  global.foundry = {
    ...(global.foundry ?? {}),
    utils: { ...(global.foundry?.utils ?? {}), setProperty: setPath, getProperty: (o, k) => k.split('.').reduce((at, key) => at?.[key], o), randomID: () => `r${nextId++}` },
  };
});

afterEach(() => {
  delete global.canvas;
});

/* -------------------------------------------- */
/*  gij3: Targeting Eye                          */
/* -------------------------------------------- */

describe('Targeting Eye', () => {
  const SCOPE = 'Compendium.essence20.gi_joe_crb.Item.cBiD2lBLRwnxu8Rx';
  const MELEE = { isAttack: true, isMelee: true, item: { type: 'weaponEffect', system: {}, flags: {} } };
  const RANGED = { isAttack: true, isMelee: false, item: { type: 'weaponEffect', system: {}, flags: {} } };
  const marked = actor => evaluateTag('self:marked:gij3TargetingEye', contextFor({ self: actor }));

  function setup({ scoped = false, long = 100 } = {}) {
    const eye = packItem(FILES.targetingEye);
    const rifle = { id: 'w1', name: 'Rifle', type: 'weapon', system: {}, flags: {} };
    const shot = { id: 'e1', name: 'Shot', type: 'weaponEffect', system: { classification: { style: 'projectile' }, range: { value: 50, ...(long ? { long } : {}) } }, flags: { essence20: { parentId: 'w1' } } };
    const blade = { id: 'e2', name: 'Slash', type: 'weaponEffect', system: { classification: { style: 'melee' }, range: { value: 5 } }, flags: { essence20: { parentId: 'w1' } } };
    const items = [eye, rifle, shot, blade];
    if (scoped) {
      items.push({ id: 's1', name: 'Scope', type: 'upgrade', system: {}, flags: { core: { sourceId: SCOPE }, essence20: { parentId: 'w1' } } });
    }

    return { eye, shot, blade, actor: makeActor(items) };
  }

  test('the Free-action Use marks the holder; not offered again while it lasts', async () => {
    const { eye, actor } = setup();
    expect(useOf(eye).cost).toEqual({ action: 'free' });
    expect(available(eye)).toBe(true);
    await use(actor, eye);
    expect(marked(actor)).toBe(true);
    expect(actor.flags.essence20.ruleMarks.gij3TargetingEye.until).toBe('endOfNextTurnOrScene');
    expect(available(eye)).toBe(false);
  });

  test('↓1 on the holder\'s melee attacks, ↑1 on melee attacks against the holder - only while in use', async () => {
    const { eye, actor } = setup();
    const attacker = makeActor([], { name: 'Foe', type: 'npc' });
    expect(ruleRollSources(actor, null, MELEE).sources).toEqual([]);
    expect(ruleRollSources(attacker, actor, MELEE).sources).toEqual([]);
    await use(actor, eye);
    expect(ruleRollSources(actor, null, MELEE).sources.map(s => [s.shiftDown, s.shiftUp])).toEqual([[1, 0]]);
    expect(ruleRollSources(actor, null, RANGED).sources).toEqual([]);
    expect(ruleRollSources(attacker, actor, MELEE).sources.map(s => [s.shiftUp, s.shiftDown])).toEqual([[1, 0]]);
    expect(ruleRollSources(attacker, actor, RANGED).sources).toEqual([]);
    expect(ruleDialogSwitches(actor, MELEE)).toEqual([]);
  });

  test('projectile ranges doubled (both bands) unless the weapon is Scoped; recorded in upgradeTouched', async () => {
    const plain = setup();
    ruleDerived(plain.actor);
    expect(plain.shot.system.range).toEqual({ value: 50, long: 100 });
    await use(plain.actor, plain.eye);
    ruleDerived(plain.actor);
    expect(plain.shot.system.range).toEqual({ value: 100, long: 200 });
    expect(plain.shot.system.upgradeTouched).toEqual(expect.arrayContaining(['range.value', 'range.long']));
    expect(plain.blade.system.range).toEqual({ value: 5 });

    const noLong = setup({ long: 0 });
    await use(noLong.actor, noLong.eye);
    ruleDerived(noLong.actor);
    expect(noLong.shot.system.range).toEqual({ value: 100 });

    const scoped = setup({ scoped: true });
    await use(scoped.actor, scoped.eye);
    ruleDerived(scoped.actor);
    expect(scoped.shot.system.range).toEqual({ value: 50, long: 100 });
  });

  test('lasts through the end of the holder\'s next turn in combat, and ends with the scene', async () => {
    const { eye, actor } = setup();
    const other = makeActor([], { name: 'Other' });
    const combat = { id: 'c', started: true, round: 1, turn: 0, turns: [{ actor }, { actor: other }] };
    game.combat = combat;
    await use(actor, eye);
    for (const [round, turn, live] of [[1, 1, true], [2, 0, true], [2, 1, false], [3, 0, false]]) {
      Object.assign(combat, { round, turn });
      expect([round, turn, marked(actor)]).toEqual([round, turn, live]);
    }

    Object.assign(combat, { round: 1, turn: 0 });
    await use(actor, eye);
    sceneEpoch = 2;
    expect(marked(actor)).toBe(false);

    // Out of combat: the scene.
    game.combat = null;
    await use(actor, eye);
    expect(marked(actor)).toBe(true);
    sceneEpoch = 3;
    expect(marked(actor)).toBe(false);
  });
});

/* -------------------------------------------- */
/*  gij3: Junker                                 */
/* -------------------------------------------- */

describe('Junker', () => {
  test('once per mission: +1 Requisition attempt on the Party, Edge banked for the next Requisition Test only', async () => {
    const junker = packItem(FILES.junker);
    const actor = makeActor([junker]);
    const party = { id: 'p', uuid: 'Actor.p', name: 'Squad', type: 'party', isOwner: true, members: [actor], system: { requisition: { attempts: 2 } } };
    party.update = jest.fn(updater(party));
    game.actors = { contents: [actor, party], party };
    expect(useOf(junker).limit).toEqual({ per: 'mission' });
    expect(available(junker)).toBe(true);

    const { ctx } = await use(actor, junker);
    expect(party.update).toHaveBeenCalledWith({ 'system.requisition.attempts': 3 });
    expect(ctx.chat.join(' ')).toContain('Hero adds a requisition attempt');

    const requisition = ruleRollSources(actor, null, { rolledSkill: 'athletics', dataset: { requisitionItemName: 'Vest' } });
    expect(requisition.sources.filter(s => s.edge).map(s => s.label)).toEqual(['Junker']);
    expect(requisition.consumes).toEqual([expect.objectContaining({ ext: 'rulesBank', actorUuid: actor.uuid })]);
    expect(ruleRollSources(actor, null, { rolledSkill: 'athletics', dataset: {} }).sources).toEqual([]);
  });

  test('no Party: still banks the Edge', async () => {
    const junker = packItem(FILES.junker);
    const actor = makeActor([junker]);
    await use(actor, junker);
    expect(ruleRollSources(actor, null, { rolledSkill: 'targeting', dataset: { requisitionItemName: 'Rifle' } }).sources.map(s => s.edge)).toEqual([true]);
  });
});

/* -------------------------------------------- */
/*  gij1: Recoil Brace, Let It Rip               */
/* -------------------------------------------- */

describe('Recoil Brace', () => {
  function setup({ attached = true } = {}) {
    const rifle = { id: 'w1', name: 'Rifle', type: 'weapon', system: { equipped: true, derivedHands: 2 }, flags: {} };
    const other = { id: 'w2', name: 'Cannon', type: 'weapon', system: { equipped: true, derivedHands: 2 }, flags: {} };
    const brace = packItem(FILES.recoilBrace, { flags: attached ? { parentId: 'w1' } : {} });
    return { brace, rifle, other, actor: makeActor([rifle, other, brace]) };
  }

  test('offered once per scene while attached to a weapon', () => {
    expect(useOf(setup().brace).limit).toEqual({ per: 'scene' });
    expect(available(setup().brace)).toBe(true);
    expect(available(setup({ attached: false }).brace)).toBe(false);
  });

  test('the braced weapon (only) counts as one-handed for the rest of the turn in combat', async () => {
    const { brace, rifle, other, actor } = setup();
    const combat = { id: 'c', started: true, round: 1, turn: 0, turns: [{ actor }] };
    game.combat = combat;
    await use(actor, brace);
    ruleDerived(actor);
    expect([rifle.system.derivedHands, other.system.derivedHands]).toEqual([1, 2]);
    combat.turn = 1;
    rifle.system.derivedHands = 2;
    ruleDerived(actor);
    expect(rifle.system.derivedHands).toBe(2);
  });

  test('out of combat: until a combat starts', async () => {
    const { brace, rifle, actor } = setup();
    await use(actor, brace);
    ruleDerived(actor);
    expect(rifle.system.derivedHands).toBe(1);
    game.combat = { id: 'c', started: true, round: 1, turn: 0, turns: [] };
    rifle.system.derivedHands = 2;
    ruleDerived(actor);
    expect(rifle.system.derivedHands).toBe(2);
  });
});

describe('Let It Rip', () => {
  const SIGNATURE = GIJ('PFuzUrcYw14JRLf9');
  const SIGNATURE2 = GIJ('Jnjio1DtAx0QgE85');
  const weapon = (id, source) => ({ id, name: id, type: 'weapon', system: { equipped: true, derivedHands: 2 }, flags: { core: { sourceId: source } } });

  test('offered only with a Signature Weapon; a Free action', () => {
    expect(useOf(packItem(FILES.letItRip)).cost).toEqual({ action: 'free' });
    const without = packItem(FILES.letItRip);
    makeActor([without, weapon('other', GIJ('notSignature0001'))]);
    expect(available(without)).toBe(false);
    const holder = packItem(FILES.letItRip);
    makeActor([holder, weapon('blade', SIGNATURE)]);
    expect(available(holder)).toBe(true);
  });

  test('a lone Signature Weapon is taken unasked and counts as one-handed for the turn - no other weapon', async () => {
    const perk = packItem(FILES.letItRip);
    const blade = weapon('blade', SIGNATURE);
    const other = weapon('other', GIJ('notSignature0001'));
    const actor = makeActor([perk, blade, other]);
    game.combat = { id: 'c', started: true, round: 1, turn: 0, turns: [{ actor }] };
    const askPick = jest.fn();
    await use(actor, perk, { askPick });
    expect(askPick).not.toHaveBeenCalled();
    ruleDerived(actor);
    expect([blade.system.derivedHands, other.system.derivedHands]).toEqual([1, 2]);
    game.combat.turn = 1;
    blade.system.derivedHands = 2;
    ruleDerived(actor);
    expect(blade.system.derivedHands).toBe(2);
  });

  test('with two Signature Weapons it asks which, offering only those', async () => {
    const perk = packItem(FILES.letItRip);
    const blade = weapon('blade', SIGNATURE);
    const tool = weapon('tool', SIGNATURE2);
    const actor = makeActor([perk, blade, tool, weapon('other', GIJ('notSignature0001'))]);
    let offered = null;
    await use(actor, perk, { askPick: async (step, options) => {
      offered = options.map(option => option.value);
      return 'tool';
    } });
    expect(offered).toEqual(['blade', 'tool']);
    ruleDerived(actor);
    expect([blade.system.derivedHands, tool.system.derivedHands]).toEqual([2, 1]);
    expect(useOf(perk).steps[0].beforeCost).toBe(true);
  });
});

/* -------------------------------------------- */
/*  situational2: Caltrops, Bookworm             */
/* -------------------------------------------- */

describe('Caltrops', () => {
  async function scatter() {
    const gear = packItem(FILES.caltrops);
    const owner = makeActor([gear], { name: 'Scatterer' });
    await use(owner, gear);
    const data = ChatMessage.create.mock.calls.at(-1)[0];
    const message = { flags: data.flags, update: jest.fn() };
    global.fromUuidSync = uuid => ({ [owner.uuid]: owner, [gear.uuid]: gear }[uuid] ?? null);
    return { owner, data, message };
  }

  function crosser(success) {
    const actor = makeActor([], { name: 'Runner', system: { essences: { speed: { value: 3, max: 3 } } } });
    actor._dice = { rollSkill: jest.fn(async () => ({ success, outcomes: [] })) };
    return actor;
  }

  test('the card\'s button is for anyone, acts for the presser\'s selected token, and stays pressable', async () => {
    const { data } = await scatter();
    expect(data.content).toContain('Cross the caltrops');
    expect(data.flags.essence20.ruleButton).toMatchObject({ who: 'anyone', runAs: 'clicker', once: false });
  });

  test('a failed DIF 15 Acrobatics test: stops, 1 Speed Essence damage; a pass costs nothing', async () => {
    const { message } = await scatter();
    const runner = crosser(false);
    const user = { id: 'p', isGM: false, character: null };
    game.user = user;
    global.canvas = { tokens: { controlled: [{ actor: runner }] } };
    expect(await pressRuleButton(message, user)).toBe(true);
    expect(runner._dice.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ skill: 'acrobatics', dif: '15' }), runner);
    expect(runner.system.essences.speed.value).toBe(2);
    expect(ChatMessage.create.mock.calls.at(-1)[0].content).toContain('Runner steps on the caltrops');

    const lucky = crosser(true);
    global.canvas = { tokens: { controlled: [] } };
    user.character = lucky;
    expect(await pressRuleButton(message, user)).toBe(true);
    expect(lucky.system.essences.speed.value).toBe(3);
    expect(ChatMessage.create.mock.calls.at(-1)[0].content).toContain('Runner picks a way through');
    expect(message.update).not.toHaveBeenCalled();
  });
});

describe('Bookworm (Initiative half)', () => {
  const INIT = { rolledSkill: 'initiative', dataset: { isInitiative: true } };
  const shifts = actor => ruleRollSources(actor, null, INIT).sources.map(s => s.shiftDown);

  afterEach(() => {
    delete game.scenes;
  });

  test('↓1 on Initiative in a library scene, or with a hostile Librarian (by name or creature tag) in the fight', () => {
    const actor = makeActor([packItem(FILES.bookworm)]);
    expect(shifts(actor)).toEqual([]);
    game.scenes = { active: { name: 'Night Vale Public Library' } };
    expect(shifts(actor)).toEqual([1]);
    delete game.scenes;

    const librarian = makeActor([], { name: 'The Librarian', type: 'npc' });
    game.combat = { id: 'c', started: false, combatants: { contents: [{ actor }, { actor: librarian }] } };
    expect(shifts(actor)).toEqual([1]);
    const tagged = makeActor([], { name: 'Thing in the Stacks', type: 'npc', system: { creatureTags: ['librarian'] } });
    game.combat.combatants.contents = [{ actor }, { actor: tagged }];
    expect(shifts(actor)).toEqual([1]);
    expect(ruleDialogSwitches(actor, INIT)).toEqual([]);
  });

  test('not for a friendly Librarian, nor without one; the non-Initiative rule is unchanged', () => {
    const actor = makeActor([packItem(FILES.bookworm)]);
    const friend = makeActor([], { name: 'Librarian Pal' });
    game.combat = { id: 'c', started: true, combatants: { contents: [{ actor }, { actor: friend }] } };
    expect(shifts(actor)).toEqual([]);
    game.combat.combatants.contents = [{ actor }, { actor: makeActor([], { name: 'Goon', type: 'npc' }) }];
    expect(shifts(actor)).toEqual([]);
    game.scenes = { active: { name: 'Public Library' } };
    expect(ruleRollSources(actor, null, { rolledSkill: 'culture', dataset: {} }).sources.map(s => s.shiftDown)).toEqual([1]);
  });
});
