import { jest } from '@jest/globals';

/**
 * Round 12, group I engine pieces (module/rules/ext/i/): @rolePoints / @flagList, the flagList step, pick from config,
 * holder:asOther, DialogSwitch on alliesAnywhere ({holder} labels), picked-scope Reroll rules (+ the legacy effect
 * sweep), RequisitionDif, castHitDamage - and the engine edits beside them: updateActor set / add paths filling
 * {choice.x}, pickGrant text flags filling {choice.x}, ActionCost `per: day` with a named counter (limit.key).
 */

const grants = {
  findItems: jest.fn(async ({ matches }) => [{ uuid: 'Compendium.x.Item.gun', name: 'Gun', type: 'weapon', system: {} }].filter(entry => !matches || matches(entry))),
  pickOne: jest.fn(async (title, rows) => rows[0]?.uuid ?? null),
  grantCopy: jest.fn(async () => ({ name: 'Gun' })),
  chooseSelect: jest.fn(async (title, prompt, options) => options[0]?.value ?? null),
};
jest.unstable_mockModule('./mechanics/resources/grants.mjs', () => grants);

const { rebuildIndex } = await import('./index.mjs');
await import('./plugins/index.mjs');
const { runSteps, stepContext, stepErrors, pickOptions } = await import('./steps.mjs');
const { resolveValue } = await import('./formula.mjs');
const { evaluate, contextFor } = await import('./predicate.mjs');
const { validateRule } = await import('./types.mjs');
const { ruleDialogSwitches } = await import('./adapter.mjs');
const { pickedRerollGrants, legacyRerollEffects } = await import('./plugins/rolls/ally-and-picked-scopes.mjs');
const { ruleRequisitionDif } = await import('./plugins/resources/requisition-dif.mjs');
const { castHitDamage } = await import('./plugins/combat/cast-hit-damage.mjs');
const { costRulesFor } = await import('./actions.mjs');
const { rerollGrants } = await import('../mechanics/item-hooks.mjs');

let nextId = 1;
const ALL = [];
function setPath(object, key, value) {
  const keys = key.split('.');
  const last = keys.pop();
  const parent = keys.reduce((o, k) => (o[k] ??= {}), object);
  parent[last] = value;
}

function item(data = {}, rules = []) {
  const made = { id: `i${nextId++}`, name: 'Thing', type: 'perk', flags: { essence20: {} }, ...data, system: { ...(data.system ?? {}), rules } };
  made.uuid = `Item.${made.id}`;
  made.update = jest.fn(async changes => Object.entries(changes).forEach(([key, value]) => setPath(made, key, value)));
  ALL.push(made);
  return made;
}

function actor(items = [], extra = {}) {
  const list = [...items];
  const made = {
    id: `a${nextId++}`, name: extra.name ?? 'Hero', type: extra.type ?? 'playerCharacter', flags: { essence20: { ...(extra.flags ?? {}) } },
    system: { size: 'common', skills: {}, ...(extra.system ?? {}) }, isOwner: true, documentName: 'Actor',
    items: { contents: list, get: id => list.find(i => i.id == id), [Symbol.iterator]: () => list[Symbol.iterator]() },
    effects: { contents: extra.effects ?? [] },
    getActiveTokens: () => [],
  };
  made.uuid = `Actor.${made.id}`;
  made.update = jest.fn(async changes => {
    Object.entries(changes).forEach(([key, value]) => setPath(made, key, value));
    rebuildIndex(made);
  });
  list.forEach(i => (i.parent = made));
  ALL.push(made);
  global.game.actors.push(made);
  rebuildIndex(made);
  return made;
}

beforeEach(() => {
  ALL.length = 0;
  global.game.actors = [];
  global.game.actors.get = id => ALL.find(a => a.id == id && a.documentName == 'Actor');
  global.game.user = { id: 'u', isGM: true, targets: new Set() };
  global.game.combat = null;
  global.game.settings = { get: () => 1 };
  global.game.i18n = { localize: k => `L:${k}`, format: k => k, has: () => false };
  global.fromUuidSync = uuid => ALL.find(doc => doc.uuid == uuid) ?? null;
  global.foundry.utils.setProperty = setPath;
  global.foundry.utils.getProperty = (object, key) => key.split('.').reduce((at, part) => at?.[part], object);
});

describe('values: @rolePoints, @flagList, flagList, pick from config', () => {
  test('@rolePoints reads the base Role Points (or the named ones); @flagList counts a flag list', () => {
    const base = item({ name: 'Mystical Points', type: 'rolePoints', system: { resource: { value: 4 } } });
    const moxie = item({ name: 'Old Moxie', type: 'rolePoints', system: { resource: { value: 2 } } });
    const hero = actor([base, moxie], { flags: { essentialResearch: ['speed', 'speed', 'smarts'] } });
    hero._getBaseRolePoints = () => base;
    expect(resolveValue('@rolePoints', { actor: hero }, 0)).toBe(4);
    expect(resolveValue('@rolePoints.Old_Moxie + 1', { actor: hero }, 0)).toBe(3);
    expect(resolveValue('@flagList.essentialResearch', { actor: hero }, 0)).toBe(3);
    expect(resolveValue('@flagList.essentialResearch.speed', { actor: hero }, 0)).toBe(2);
    expect(resolveValue('@flagList.nothing', { actor: hero }, 0)).toBe(0);
    expect(resolveValue('@rolePoints', { actor: actor() }, 0)).toBe(0);
  });

  test('flagList adds a filled text to the list, or clears it (no write when empty); bad steps are refused', async () => {
    const own = item({ flags: { essence20: { rules: { choices: { essence: 'smarts' } } } } });
    const hero = actor([own]);
    const ctx = stepContext({ actor: hero, item: own, targets: [] });
    await runSteps([{ do: 'flagList', flag: 'list', add: '{choice.essence}' }, { do: 'flagList', flag: 'list', add: 'x' }], ctx);
    expect(hero.flags.essence20.list).toEqual(['smarts', 'x']);
    await runSteps([{ do: 'flagList', flag: 'list', clear: true }], ctx);
    expect(hero.flags.essence20.list).toEqual([]);
    hero.update.mockClear();
    await runSteps([{ do: 'flagList', flag: 'list', clear: true }], ctx);
    expect(hero.update).not.toHaveBeenCalled();
    expect(stepErrors([{ do: 'flagList', flag: 'list' }])).toHaveLength(1);
    expect(stepErrors([{ do: 'flagList', add: 'x' }])).toHaveLength(1);
  });

  test('pick from config offers CONFIG.E20.<path> with localised labels', () => {
    global.CONFIG.E20.weaponTypes = { shotguns: 'E20.WeaponTypeShotguns', thrown: 'E20.WeaponTypeThrown' };
    expect(pickOptions({ from: 'config', path: 'weaponTypes' }, { actor: actor(), targets: [] })).toEqual([
      { value: 'shotguns', label: 'L:E20.WeaponTypeShotguns' }, { value: 'thrown', label: 'L:E20.WeaponTypeThrown' },
    ]);
    expect(pickOptions({ from: 'config', path: 'nope' }, { actor: actor(), targets: [] })).toEqual([]);
  });
});

describe('holder:asOther', () => {
  test('a self: tag asked of the holder, the reached actor as the other party', () => {
    const holder = actor([], { system: { size: 'large', isTransformed: true } });
    const small = actor([], { system: { size: 'common' } });
    const huge = actor([], { system: { size: 'huge' } });
    const ask = (tag, self) => evaluate([tag], contextFor({ self, holder, other: null }));
    expect(ask('holder:asOther:sizeDiff>=0', small)).toBe(true);
    expect(ask('holder:asOther:sizeDiff>=0', huge)).toBe(false);
    expect(ask('holder:asOther:transformed', small)).toBe(true);
    expect(ask('holder:asOther:sizeDiff>=0', actor([], { system: { size: 'weird' } }))).toBeNull();
  });
});

describe('engine edits: updateActor paths and pickGrant flags fill {choice.x}', () => {
  test('updateActor set / add paths read a pick; with no pick they are left alone', async () => {
    const own = item({ flags: { essence20: { rules: { choices: { essence: 'speed' } } } } });
    const hero = actor([own], { system: { essences: { speed: { max: 2, value: 1 } } } });
    await runSteps([{ do: 'updateActor', add: { 'system.essences.{choice.essence}.max': 1 }, set: { 'system.essences.{choice.essence}.value': 5 } }], stepContext({ actor: hero, item: own, targets: [] }));
    expect(hero.system.essences.speed).toEqual({ max: 3, value: 5 });
    const blank = item();
    const other = actor([blank]);
    await runSteps([{ do: 'updateActor', add: { 'system.essences.{choice.essence}.max': 1 } }], stepContext({ actor: other, item: blank, targets: [] }));
    expect(other.update).not.toHaveBeenCalled();
  });

  test('pickGrant writes text flags with {choice.x} / {var.x} filled', async () => {
    const own = item({ flags: { essence20: { rules: { choices: { type: 'shotguns' } } } } });
    const hero = actor([own]);
    const ctx = stepContext({ actor: hero, item: own, targets: [] });
    ctx.vars.extra = 'v';
    await runSteps([{ do: 'pickGrant', from: { type: 'weapon' }, flags: { kind: '{choice.type}', note: '{var.extra}', qualified: true } }], ctx);
    expect(grants.grantCopy).toHaveBeenCalledWith(hero, 'Compendium.x.Item.gun', expect.objectContaining({ flags: { kind: 'shotguns', note: 'v', qualified: true } }));
  });
});

describe('DialogSwitch on alliesAnywhere', () => {
  test('validates; offered on an ally\'s roll with {holder} filled, not on the holder\'s own or an enemy\'s', () => {
    const rule = { type: 'DialogSwitch', scope: 'alliesAnywhere', label: '{holder} helps', upshift: 1, forget: true };
    expect(validateRule(rule)).toEqual([]);
    const helper = actor([item({}, [rule])], { name: 'Helper' });
    const ally = actor([], { name: 'Ally' });
    const enemy = actor([], { name: 'Enemy', type: 'npc' });
    const mine = who => ruleDialogSwitches(who, { rolledSkill: 'athletics' }).filter(s => s.entry.rule.scope == 'alliesAnywhere');
    expect(mine(ally)).toEqual([expect.objectContaining({ label: 'Helper helps', value: false })]);
    expect(mine(helper)).toEqual([]);
    expect(mine(enemy)).toEqual([]);
  });
});

describe('Reroll scope picked', () => {
  test('needs `picked`; reaches the actors in the pick list (an unlinked token\'s actor as its world actor); includeHolder adds the holder', () => {
    expect(validateRule({ type: 'Reroll', scope: 'picked', mode: 'ones' })).toHaveLength(1);
    const rule = { type: 'Reroll', scope: 'picked', picked: 'team', mode: 'ones', target: 'skillDice', maxUses: 0, skills: ['{choice.a}'] };
    expect(validateRule(rule)).toEqual([]);
    const perk = item({ name: 'Bond', flags: { essence20: { rules: { choices: { team: [], a: 'might' } } } } }, [rule]);
    const holder = actor([perk], { name: 'Holder' });
    const mate = actor([], { name: 'Mate' });
    perk.flags.essence20.rules.choices.team = [mate.uuid];
    rebuildIndex(holder);
    expect(pickedRerollGrants(mate)).toEqual([expect.objectContaining({ name: 'Bond', mode: 'ones', skills: ['might'], source: `${perk.uuid}#rule0` })]);
    expect(pickedRerollGrants(holder)).toEqual([]);
    const token = { ...mate, uuid: 'Scene.s.Token.t.Actor.x', isToken: true };
    expect(pickedRerollGrants(token)).toHaveLength(1);
    perk.system.rules[0].includeHolder = true;
    rebuildIndex(holder);
    expect(pickedRerollGrants(holder)).toHaveLength(1);
    // The reroll engine asks it (mechanics/item-hooks.mjs#rerollGrants).
    expect(rerollGrants()).toContain(pickedRerollGrants);
  });

  test('legacyEffects: old effects flagged with a holder of such a rule are found for the start-up sweep', () => {
    const holder = actor([item({}, [{ type: 'Reroll', scope: 'picked', picked: 'team', legacyEffects: 'oldBy', mode: 'ones' }])]);
    const stranger = actor([]);
    const mate = actor([], { effects: [{ id: 'e1', flags: { essence20: { oldBy: holder.uuid } } }, { id: 'e2', flags: { essence20: { oldBy: stranger.uuid } } }] });
    expect(legacyRerollEffects(global.game.actors)).toEqual([{ actor: mate, ids: ['e1'] }]);
  });
});

describe('RequisitionDif', () => {
  test('amount for matching items, floored at min (default 0); several apply in turn; when gates it', () => {
    const ruleA = { type: 'RequisitionDif', amount: -5, items: ['item:availability>=prototype'] };
    expect(validateRule(ruleA)).toEqual([]);
    expect(validateRule({ type: 'RequisitionDif' })).not.toEqual([]);
    const hero = actor([item({}, [ruleA]), item({}, [{ type: 'RequisitionDif', amount: 2, min: 18, when: ['self:type:playerCharacter'] }])]);
    const gear = { type: 'weapon', system: {} };
    expect(ruleRequisitionDif(hero, gear, 'prototype', 20)).toBe(18);
    expect(ruleRequisitionDif(hero, gear, 'limited', 10)).toBe(18);
    const npc = actor([item({}, [{ type: 'RequisitionDif', amount: -50 }])], { type: 'npc' });
    expect(ruleRequisitionDif(npc, gear, 'limited', 10)).toBe(0);
    expect(ruleRequisitionDif(actor([]), gear, 'limited', 10)).toBe(10);
  });
});

describe('castHitDamage', () => {
  test('the damage as it is with no spell or no cast riders; a cast HitRider for the spell adds its note', async () => {
    const spell = item({ name: 'Storm', type: 'spell' });
    const plain = actor([spell]);
    expect(await castHitDamage(plain, spell, 3, 'element')).toBe(3);
    expect(await castHitDamage(plain, null, 3)).toBe(3);
    const rider = item({ name: 'Boost' }, [{ type: 'HitRider', on: 'cast', note: 2, when: ['item:type:spell'] }]);
    const storm = item({ name: 'Storm', type: 'spell' });
    const mage = actor([rider, storm]);
    expect(await castHitDamage(mage, storm, 3, 'element')).toBe(5);
  });
});

describe('ActionCost per day, limit.key', () => {
  test('validates per: day; the cost rule\'s counter id is limit.key', () => {
    const rule = { type: 'ActionCost', action: 'useASkill', to: 'move', limit: { per: 'day', max: 3, key: 'shared' } };
    expect(validateRule(rule)).toEqual([]);
    expect(validateRule({ ...rule, limit: { per: 'week' } })).toHaveLength(1);
    const own = item({}, [rule]);
    const hero = actor([own]);
    expect(costRulesFor(hero)).toEqual([expect.objectContaining({ id: 'shared', limit: { window: 'day', max: 3 } })]);
    const plainRule = item({}, [{ type: 'ActionCost', action: 'sprint', to: 'free' }]);
    expect(costRulesFor(actor([plainRule]))[0].id).toBe(`rule-${plainRule.id}-0`);
  });
});
