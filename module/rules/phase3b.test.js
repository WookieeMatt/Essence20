import { jest } from '@jest/globals';
import { readdirSync, readFileSync } from 'fs';
import { formulaError, resolveValue } from './formula.mjs';
import { contextFor, evaluateTag, markOf, unknownTags } from './predicate.mjs';
import { LINK_HOLDERS, isItemActive, rebuildIndex, ruleLabel } from './index.mjs';
import {
  applyRuleSwitches, ruleDamageDealt, ruleDerived, ruleDialogSwitches, ruleMovement, ruleRequisitionAccess, ruleRollSources, ruleScaledDamage, ruleSenses, ruleSurpriseModes,
} from './adapter.mjs';
import { runSteps, stepContext, stepErrors } from './steps.mjs';
import { countsTowardLimit, fireTriggers } from './triggers.mjs';
import { summarizeRule, validateRule } from './types.mjs';
import { auraReaches, partyMates } from './links.mjs';


let nextId = 1;
const actors = new Map();

function makeActor(rules = [], extra = {}) {
  const items = (extra.items ?? []).concat(rules.length ? [makeItem(rules)] : []);
  const actor = {
    id: `a${nextId++}`, type: extra.type ?? 'playerCharacter', name: extra.name ?? 'Hero', isOwner: true, statuses: new Set(),
    flags: { essence20: {} },
    system: { level: 2, actors: extra.crew ?? {}, health: { value: 5, max: 10 }, defenses: { toughness: { total: 10, string: '10' } } },
    getActiveTokens: () => extra.token ? [extra.token] : [],
    async update(data) {
      for (const [key, value] of Object.entries(data)) {
        foundry.utils.setProperty(this, key, value);
      }
    },
    deleteEmbeddedDocuments: jest.fn(async () => []),
  };
  actor.uuid = `Actor.${actor.id}`;
  actor.items = { contents: items, get: id => items.find(item => item.id == id), [Symbol.iterator]: () => items[Symbol.iterator]() };
  for (const item of items) {
    item.parent = actor;
  }

  actors.set(actor.uuid, actor);
  rebuildIndex(actor);
  return actor;
}

function makeItem(rules, extra = {}) {
  return {
    id: `i${nextId++}`, name: extra.name ?? 'Thing', type: 'perk', flags: extra.flags ?? {}, system: { rules, ...(extra.system ?? {}) },
    async update(data) {
      for (const [key, value] of Object.entries(data)) {
        foundry.utils.setProperty(this, key, value);
      }
    },
  };
}

beforeEach(() => {
  actors.clear();
  LINK_HOLDERS.clear();
  global.fromUuidSync = uuid => actors.get(uuid) ?? null;
  global.game = {
    combat: null, user: { id: 'u', targets: new Set() }, actors: { contents: [] }, settings: { get: () => 1 },
    i18n: { localize: key => key, format: key => key }, scenes: { active: { name: 'The Old Library' } },
  };
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.foundry = {
    ...(global.foundry ?? {}),
    utils: {
      ...(global.foundry?.utils ?? {}),
      getProperty: (object, key) => key.split('.').reduce((o, k) => o?.[k], object),
      setProperty: (object, key, value) => {
        const keys = key.split('.');
        const last = keys.pop();
        keys.reduce((o, k) => (o[k] ??= {}), object)[last] = value;
      },
      randomID: () => `r${nextId++}`,
    },
  };
});

describe('formula references', () => {
  test('skill rank, spent, vars and counts', () => {
    const actor = { system: { level: 3, skills: { athletics: { shift: 'd8' }, driving: { shift: 'd20' } } } };
    expect(resolveValue('@skill.athletics.rank', { actor })).toBe(4);
    expect(resolveValue('@skill.driving.rank', { actor })).toBe(0);
    expect(resolveValue('@skill.missing.rank', { actor })).toBe(0);
    expect(resolveValue('@spent * 2', { actor, vars: { spent: 3 } })).toBe(6);
    expect(resolveValue('@var.hits', { actor, vars: { hits: 2 } })).toBe(2);
    expect(resolveValue('@count.allies.10', { actor })).toBe(0);
    expect(formulaError('@skill.x.rank + @spent + @var.y + @count.enemies.5')).toBeNull();
    expect(formulaError('@nope')).toMatch(/Unknown reference/);
  });

  test('@count counts allied or enemy tokens in range', () => {
    const mine = { center: { x: 0, y: 0 }, document: { disposition: 1 } };
    const self = makeActor([], { token: mine });
    mine.actor = self;
    const others = [[5, 1], [8, 1], [40, 1], [5, -1]].map(([x, disposition]) => {
      const token = { center: { x, y: 0 }, document: { disposition } };
      const actor = makeActor([], { token });
      token.actor = actor;
      return token;
    });
    global.canvas = { grid: { measurePath: ([a, b]) => ({ distance: Math.abs(a.x - b.x) }) }, tokens: { placeables: [mine, ...others] } };
    expect(resolveValue('@count.allies.10', { actor: self })).toBe(2);
    expect(resolveValue('@count.enemies.10', { actor: self })).toBe(1);
    delete global.canvas;
  });
});

describe('data tags', () => {
  test('read any stored value on the actor, the target or the rolled item', () => {
    const self = makeActor([], {});
    self.system.energon = { dark: { value: 2 } };
    self.flags.essence20.lanceOfLightActive = true;
    const item = { type: 'weaponEffect', system: { isPoison: true, damageType: 'Blunt', isRam: true } };
    const ctx = contextFor({ self, item });
    expect(evaluateTag('self:data:system.energon.dark.value>0', ctx)).toBe(true);
    expect(evaluateTag('self:data:system.energon.dark.value>=3', ctx)).toBe(false);
    expect(evaluateTag('self:data:flags.essence20.lanceOfLightActive', ctx)).toBe(true);
    expect(evaluateTag('self:data:flags.essence20.missing', ctx)).toBe(false);
    expect(evaluateTag('item:data:system.isPoison', ctx)).toBe(true);
    expect(evaluateTag('item:data:system.damageType=blunt', ctx)).toBe(true);
    expect(evaluateTag('item:data:system.damageType!=blunt', ctx)).toBe(false);
    expect(evaluateTag('attack:ram', contextFor({ self, item, isAttack: true }))).toBe(true);
    expect(validateRule({ type: 'RollModifier', upshift: 1, when: ['self:data:system.x>1', 'item:data:system.y'] })).toEqual([]);
  });

  test('{item.choice} reads the item\'s own pick', () => {
    const ruleItem = { system: { choice: 'athletics' }, flags: {} };
    expect(evaluateTag('skill:{item.choice}', contextFor({ ruleItem, rolledSkill: 'athletics' }))).toBe(true);
    expect(evaluateTag('skill:{item.choice}', contextFor({ ruleItem: { system: {}, flags: {} }, rolledSkill: 'athletics' }))).toBe(false);
  });
});

describe('marks', () => {
  test('mark and unmark a target; tags read it, and a timed mark runs out', async () => {
    const actor = makeActor([]);
    const foe = makeActor([]);
    const ctx = stepContext({ actor, item: makeItem([]), targets: [foe] });
    await runSteps([{ do: 'mark', key: 'prey', to: 'target' }], ctx);
    expect(markOf(foe, 'prey')).toBe(true);
    expect(evaluateTag('target:marked:prey', contextFor({ self: actor, other: foe }))).toBe(true);
    expect(evaluateTag('self:marked:prey', contextFor({ self: foe }))).toBe(true);
    await runSteps([{ do: 'unmark', key: 'prey', to: 'target' }], ctx);
    expect(foe.flags.essence20.ruleMarks['-=prey']).toBeNull();

    foe.flags.essence20.ruleMarks = { quarry: { until: 'endOfTurn', stamp: { combatId: 'old', round: 1, turn: 0 } } };
    global.game.combat = { started: true, id: 'c', round: 1, turn: 0 };
    expect(markOf(foe, 'quarry')).toBe(false);
    expect(stepErrors([{ do: 'mark' }])).toEqual(['steps[0]: mark needs key']);
  });
});

describe('variable spends', () => {
  test('the player picks how much; later steps read @spent', async () => {
    const actor = makeActor([]);
    actor.system.energon = { normal: { value: 5 } };
    const ctx = stepContext({ actor, item: makeItem([]), targets: [], askNumber: async (step, min, max) => (min == 1 && max == 3 ? 2 : null) });
    const done = await runSteps([
      { do: 'spend', resource: { path: 'system.energon.normal.value' }, amount: { min: 1, max: 3 } },
      { do: 'chat', text: 'x' },
    ], ctx);
    expect(done).toBe(true);
    expect(actor.system.energon.normal.value).toBe(3);
    expect(ctx.vars.spent).toBe(2);
    expect(stepErrors([{ do: 'spend', resource: { path: 'x' }, amount: { min: 1, max: '@bad' } }])[0]).toMatch(/amount.max/);
    const backedOut = stepContext({ actor, item: makeItem([]), targets: [], askNumber: async () => null });
    expect(await runSteps([{ do: 'spend', resource: { path: 'system.energon.normal.value' }, amount: { min: 1, max: 3 } }], backedOut)).toBe(false);
  });
});

describe('alternatives and limits', () => {
  test('ticked switches in one stack group: only the biggest applies', async () => {
    const actor = makeActor([
      { type: 'DialogSwitch', label: 'Big', upshift: 2, stack: 'key' },
      { type: 'DialogSwitch', label: 'Small', upshift: 1, stack: 'key' },
      { type: 'DialogSwitch', label: 'Other', upshift: 1 },
    ]);
    const ext = Object.fromEntries(ruleDialogSwitches(actor).map(s => [s.name, true]));
    const options = { ext };
    await applyRuleSwitches(actor, options);
    expect(options.shiftUp).toBe(3);
  });

  test('a limit that only counts on a success', () => {
    const rule = { limit: { per: 'scene', onlyOnSuccess: true } };
    expect(countsTowardLimit(rule, { vars: { lastRoll: { success: false } } })).toBe(false);
    expect(countsTowardLimit(rule, { vars: { lastRoll: { success: true } } })).toBe(true);
    expect(countsTowardLimit(rule, { vars: {} })).toBe(true);
    expect(countsTowardLimit({ limit: { per: 'scene' } }, { vars: { lastRoll: { success: false } } })).toBe(true);
    expect(validateRule({ type: 'Use', limit: { per: 'scene', onlyOnSuccess: 'yes' }, steps: [] })).toContain('limit.onlyOnSuccess must be true or false');
    expect(summarizeRule({ type: 'Use', label: 'Go', limit: { per: 'scene', onlyOnSuccess: true }, steps: [] })).toContain('(on a success)');
  });
});

describe('labels, choices and Matured', () => {
  test('labels fill in picks', () => {
    const item = { name: 'Student', system: { choice: 'Chemistry' }, flags: { essence20: { rules: { choices: { subject: 'History' } } } } };
    expect(ruleLabel({ label: 'Studying {choice.subject}' }, item)).toBe('Studying History');
    expect(ruleLabel({ label: 'Expert in {item.choice}' }, item)).toBe('Expert in Chemistry');
    expect(ruleLabel({ label: 'Studying {choice.other}' }, item)).toBe('Studying …');
    expect(validateRule({ type: 'ChoiceSet', key: 'subject', from: 'text' })).toEqual([]);
  });

  test('a Hang-Up ignored through Matured has no rules', () => {
    expect(isItemActive({ type: 'hangUp', flags: { essence20: { maturedIgnored: true } }, system: {} })).toBe(false);
    expect(isItemActive({ type: 'hangUp', flags: {}, system: {} })).toBe(true);
  });
});

describe('party and aura scopes', () => {
  test('a party rule reaches the rest of the roster, not the holder', () => {
    const giver = makeActor([{ type: 'RollModifier', label: 'Team spirit', upshift: 1, scope: 'party' }], { name: 'Giver' });
    const mate = makeActor([], { name: 'Mate' });
    const stranger = makeActor([], { name: 'Stranger' });
    const party = { type: 'party', system: { actors: { a: { uuid: giver.uuid }, b: { uuid: mate.uuid } } } };
    global.game.actors = { contents: [giver, mate, stranger, party] };
    expect(partyMates(mate)).toEqual([giver]);
    expect(ruleRollSources(mate, null, { rolledSkill: 'athletics' }).sources.map(s => s.shiftUp)).toEqual([1]);
    expect(ruleRollSources(stranger, null, { rolledSkill: 'athletics' }).sources).toEqual([]);
    expect(ruleRollSources(giver, null, { rolledSkill: 'athletics' }).sources).toEqual([]);
  });

  test('an aura reaches allies in range only', () => {
    const rule = { type: 'Defense', defense: 'evasion', amount: 1, scope: 'aura', radius: 10 };
    const holderToken = { center: { x: 0, y: 0 }, document: { disposition: 1 } };
    const holder = makeActor([rule], { token: holderToken });
    holderToken.actor = holder;
    const at = (x, disposition) => {
      const token = { center: { x, y: 0 }, document: { disposition } };
      const actor = makeActor([], { token });
      token.actor = actor;
      return actor;
    };

    const near = at(5, 1);
    const far = at(30, 1);
    const foe = at(5, -1);
    global.canvas = { grid: { measurePath: ([a, b]) => ({ distance: Math.abs(a.x - b.x) }) }, tokens: { placeables: [holderToken, ...[near, far, foe].map(a => a.getActiveTokens()[0])] } };
    expect(auraReaches(rule, holder, near)).toBe(true);
    expect(auraReaches(rule, holder, far)).toBe(false);
    expect(auraReaches(rule, holder, foe)).toBe(false);
    expect(auraReaches({ ...rule, affects: 'enemies' }, holder, foe)).toBe(true);
    expect(auraReaches({ ...rule, affects: 'all' }, holder, holder)).toBe(false);
    expect(validateRule({ ...rule, radius: undefined })).toContain('an aura needs a radius (feet)');
    expect(validateRule({ ...rule, affects: 'friends' })).toContain('affects must be allies, enemies or all');
    expect(summarizeRule(rule)).toMatch(/^Allies within 10 ft: /);
    delete global.canvas;
  });
});

describe('new rule types', () => {
  test('SurpriseExemption: the modes whose conditions hold', () => {
    const actor = makeActor([
      { type: 'SurpriseExemption', mode: 'move' },
      { type: 'SurpriseExemption', mode: 'normal', when: ['self:morphed'] },
    ]);
    expect([...ruleSurpriseModes(actor)]).toEqual(['move']);
    actor.system.isMorphed = true;
    expect([...ruleSurpriseModes(actor)].sort()).toEqual(['move', 'normal']);
    expect(validateRule({ type: 'SurpriseExemption', mode: 'sometimes' })[0]).toMatch(/mode/);
    expect(summarizeRule({ type: 'SurpriseExemption', mode: 'move' })).toBe('When Surprised, can still Move and make Skill Tests');
  });

  test('Sense: vision grants with a range formula and a condition', () => {
    const actor = makeActor([
      { type: 'Sense', range: '10 * @level' },
      { type: 'Sense', mode: 'lightAmplification', range: 90, when: ['self:morphed'] },
    ]);
    expect(ruleSenses(actor)).toEqual([{ mode: 'darkvision', range: 20 }]);
    actor.system.isMorphed = true;
    expect(ruleSenses(actor)).toHaveLength(2);
    expect(validateRule({ type: 'Sense' })).toContain('range is required');
  });

  test('ItemModifier: changes matching items, never its own', () => {
    const rules = [{ type: 'ItemModifier', items: ['item:type:weapon'], path: 'system.range.max', op: 'add', value: 10 }];
    const holder = makeItem(rules, { name: 'Long Arms' });
    holder.type = 'weapon';
    holder.system.range = { max: 5 };
    const rifle = { id: 'rifle', type: 'weapon', name: 'Rifle', flags: {}, system: { range: { max: 30 } } };
    const knife = { id: 'knife', type: 'gear', name: 'Knife', flags: {}, system: { range: { max: 0 } } };
    const actor = makeActor([], { items: [holder, rifle, knife] });
    ruleDerived(actor);
    expect(rifle.system.range.max).toBe(40);
    expect(knife.system.range.max).toBe(0);
    expect(holder.system.range.max).toBe(5);
    expect(validateRule({ type: 'ItemModifier', items: [], path: 'flags.x', value: 1 })).toEqual(['items must be a list of item: tags', 'path must start with system.']);
  });
});

describe('more rule types', () => {
  test('MovementAction: Rough Terrain and Push Yourself', () => {
    const actor = makeActor([
      { type: 'MovementAction', pushFeet: 10 },
      { type: 'MovementAction', ignoreRoughTerrain: true, pushUnlimited: true, when: ['self:transformed'] },
    ]);
    expect(ruleMovement(actor)).toEqual({ ignoreRoughTerrain: false, pushFeet: 10, pushUnlimited: false });
    actor.system.isTransformed = true;
    expect(ruleMovement(actor)).toEqual({ ignoreRoughTerrain: true, pushFeet: 10, pushUnlimited: true });
    expect(validateRule({ type: 'MovementAction' })).toEqual(['changes nothing']);
  });

  test('Qualification: widest access among matching rules', () => {
    const actor = makeActor([
      { type: 'Qualification', items: ['item:type:weapon', 'item:data:system.availability=standard'] },
      { type: 'Qualification', access: 'trained', items: ['item:name~rifle'] },
    ]);
    expect(ruleRequisitionAccess(actor, { type: 'weapon', name: 'Pistol', system: { availability: 'standard' } })).toBe('qualified');
    expect(ruleRequisitionAccess(actor, { type: 'weapon', name: 'Big Rifle', system: { availability: 'restricted' } })).toBe('trained');
    expect(ruleRequisitionAccess(actor, { type: 'armor', name: 'Vest', system: { availability: 'standard' } })).toBeNull();
    expect(validateRule({ type: 'Qualification', items: [] })).toEqual(['items or upgrades must be a list of item: tags']);
  });
});

describe('Lend Assistance events', () => {
  test('lendAssistance fires on the helper, aimed at the ally, filtered by kind', async () => {
    const ally = makeActor([], { name: 'Ally' });
    const helper = makeActor([{ type: 'Trigger', event: 'lendAssistance', when: ['assist:skill'], steps: [{ do: 'mark', key: 'helped', to: 'target' }] }]);
    await fireTriggers(helper, 'lendAssistance', { roll: { assistKind: 'attack' }, targets: [ally] });
    expect(markOf(ally, 'helped')).toBe(false);
    await fireTriggers(helper, 'lendAssistance', { roll: { assistKind: 'skill' }, targets: [ally] });
    expect(markOf(ally, 'helped')).toBe(true);
    expect(validateRule({ type: 'Trigger', event: 'assisted', steps: [] })).toEqual([]);
    expect(summarizeRule({ type: 'Trigger', event: 'assisted', steps: [{ do: 'chat' }] })).toBe('When someone Lends you Assistance: chat');
  });
});


describe('round 5 gaps', () => {
  test('data tags compare with another stored value', () => {
    const self = makeActor([]);
    self.system.power = { value: 2, max: 6 };
    expect(evaluateTag('self:data:system.power.value<$system.power.max', contextFor({ self }))).toBe(true);
    self.system.power.value = 6;
    expect(evaluateTag('self:data:system.power.value<$system.power.max', contextFor({ self }))).toBe(false);
  });

  test('weapon: reads the weapon a weapon effect belongs to', () => {
    const rifle = { id: 'w1', type: 'weapon', name: 'Venom Rifle', system: { isPoison: true } };
    const effect = { type: 'weaponEffect', flags: { essence20: { parentId: 'w1' } }, system: {}, parent: { items: { get: id => (id == 'w1' ? rifle : null) } } };
    expect(evaluateTag('weapon:data:system.isPoison', contextFor({ item: effect }))).toBe(true);
    expect(evaluateTag('weapon:name~venom', contextFor({ item: effect }))).toBe(true);
    expect(evaluateTag('weapon:data:system.isPoison', contextFor({ item: { type: 'weaponEffect', flags: {}, system: {} } }))).toBe(false);
  });

  test('a roll modifier that has to ask can start ticked', () => {
    const actor = makeActor([{ type: 'RollModifier', label: 'Maybe', edge: true, when: ['ask:sneaking'], default: true }]);
    expect(ruleDialogSwitches(actor)[0].value).toBe(true);
  });
});

describe('acts as (phase 5)', () => {
  test('offered for items with no book source, or already pointed at one', async () => {
    const { actsAsContext } = await import('./sheet.mjs');
    global.fromUuidSync = uuid => (uuid == 'Compendium.e.p.Item.luck' ? { name: 'Luck' } : null);
    expect(actsAsContext({ flags: {}, _stats: {} })).toEqual({ uuid: null, name: null });
    expect(actsAsContext({ flags: { essence20: { rulesSource: 'Compendium.e.p.Item.luck' } }, _stats: {} })).toEqual({ uuid: 'Compendium.e.p.Item.luck', name: 'Luck' });
    expect(actsAsContext({ flags: {}, _stats: { compendiumSource: 'Compendium.e.p.Item.own' } })).toBeNull();
  });
});


describe('round 6 tags', () => {
  test('wearing equipped armor of a class', () => {
    const vest = { type: 'armor', name: 'Vest', system: { classification: 'medium', equipped: true } };
    const plate = { type: 'armor', name: 'Plate', system: { classification: 'heavy', equipped: false } };
    const self = makeActor([], { items: [vest, plate] });
    const ctx = contextFor({ self });
    expect(evaluateTag('self:wearing:medium', ctx)).toBe(true);
    expect(evaluateTag('self:wearing:heavy', ctx)).toBe(false);
    expect(evaluateTag('self:wearing>=light', ctx)).toBe(true);
    expect(evaluateTag('self:wearing>=heavy', ctx)).toBe(false);
    expect(evaluateTag('self:wearing<=medium', ctx)).toBe(true);
    expect(evaluateTag('self:wearing:mythril', ctx)).toBeNull();
  });

  test('rule:data reads the rule\'s own item', () => {
    const ruleItem = { system: { choice: 'akimbo' } };
    expect(evaluateTag('rule:data:system.choice=akimbo', contextFor({ ruleItem }))).toBe(true);
    expect(evaluateTag('rule:data:system.choice=sniper', contextFor({ ruleItem }))).toBe(false);
    expect(validateRule({ type: 'RollModifier', edge: true, when: ['rule:data:system.choice=akimbo', 'self:wearing>=heavy'] })).toEqual([]);
  });
});


describe('round 7: upgrades on their host, data formulas', () => {
  test('item:isHost and item:onHost, seen from an upgrade', () => {
    const upgrade = { id: 'u', flags: { essence20: { parentId: 'w' } } };
    const ctx = item => contextFor({ ruleItem: upgrade, item });
    expect(evaluateTag('item:isHost', ctx({ id: 'w', flags: {} }))).toBe(true);
    expect(evaluateTag('item:onHost', ctx({ id: 'e', flags: { essence20: { parentId: 'w' } } }))).toBe(true);
    expect(evaluateTag('item:onHost', ctx({ id: 'x', flags: { essence20: { parentId: 'other' } } }))).toBe(false);
    expect(evaluateTag('item:onHost', ctx(upgrade))).toBe(false);
    expect(evaluateTag('item:isHost', contextFor({ ruleItem: { flags: {} }, item: { id: 'w' } }))).toBe(false);
  });

  test('an upgrade changes its host weapon\'s effects', () => {
    const rules = [{ type: 'ItemModifier', items: ['item:type:weaponEffect', 'item:onHost'], path: 'system.range.max', value: 10 }];
    const upgrade = makeItem(rules, { name: 'Long Barrel' });
    upgrade.type = 'upgrade';
    upgrade.flags = { essence20: { parentId: 'w1' } };
    const mine = { id: 'e1', type: 'weaponEffect', flags: { essence20: { parentId: 'w1' } }, system: { range: { max: 30 } } };
    const other = { id: 'e2', type: 'weaponEffect', flags: { essence20: { parentId: 'w2' } }, system: { range: { max: 30 } } };
    const weapon = { id: 'w1', type: 'weapon', flags: {}, system: { equipped: true } };
    const actor = makeActor([], { items: [weapon, upgrade, mine, other] });
    ruleDerived(actor);
    expect(mine.system.range.max).toBe(40);
    expect(other.system.range.max).toBe(30);
  });

  test('@actor and @item read stored numbers', () => {
    const actor = { system: { movement: { swim: { total: 20 } } } };
    expect(resolveValue('@actor.system.movement.swim.total / 2', { actor })).toBe(10);
    expect(resolveValue('@item.system.uses + 1', { actor, item: { system: { uses: 2 } } })).toBe(3);
    expect(resolveValue('@actor.system.nothing', { actor })).toBe(0);
    expect(formulaError('@actor.system.x + @item.system.y')).toBeNull();
  });
});


describe('round 8: steps', () => {
  test('Role Points as a resource', async () => {
    const points = { type: 'rolePoints', flags: {}, system: { resource: { value: 3, max: 5 } }, async update(d) {
      this.system.resource.value = d['system.resource.value']; 
    } };
    const actor = makeActor([], { items: [points] });
    const ctx = stepContext({ actor, item: makeItem([]), targets: [] });
    expect(await runSteps([{ do: 'spend', resource: { rolePoints: true }, amount: 2 }], ctx)).toBe(true);
    expect(points.system.resource.value).toBe(1);
    expect(await runSteps([{ do: 'spend', resource: { rolePoints: true }, amount: 2 }], ctx)).toBe(false);
    await runSteps([{ do: 'gainResource', resource: { rolePoints: true }, amount: 9 }], ctx);
    expect(points.system.resource.value).toBe(5);
  });

  test('allies within a range as recipients', async () => {
    const mine = { center: { x: 0, y: 0 }, document: { disposition: 1 } };
    const actor = makeActor([], { token: mine });
    mine.actor = actor;
    const at = (x, disposition) => {
      const token = { center: { x, y: 0 }, document: { disposition } }; const a = makeActor([], { token }); token.actor = a; return a; 
    };

    const near = at(5, 1);
    const far = at(50, 1);
    const foe = at(5, -1);
    global.canvas = { grid: { measurePath: ([p, q]) => ({ distance: Math.abs(p.x - q.x) }) }, tokens: { placeables: [mine, ...[near, far, foe].map(a => a.getActiveTokens()[0])] } };
    const ctx = stepContext({ actor, item: makeItem([]), targets: [] });
    await runSteps([{ do: 'mark', key: 'rallied', to: 'allies:10' }], ctx);
    expect([near, far, foe].map(a => markOf(a, 'rallied'))).toEqual([true, false, false]);
    await runSteps([{ do: 'mark', key: 'menaced', to: 'enemies:10' }], ctx);
    expect(markOf(foe, 'menaced')).toBe(true);
    expect(stepErrors([{ do: 'mark', key: 'x', to: 'friends:5' }])[0]).toMatch(/to must be/);
    expect(stepErrors([{ do: 'roll', skill: 'might', difDefense: 'luck' }])[0]).toMatch(/difDefense/);
    delete global.canvas;
  });
});


describe('round 9: events and asking for a number', () => {
  test('askNumber stores a value later steps read as @var', async () => {
    const actor = makeActor([]);
    const ctx = stepContext({ actor, item: makeItem([]), targets: [], askNumber: async (step, min, max) => max });
    await runSteps([{ do: 'askNumber', var: 'hp', min: 1, max: '@level + 1' }, { do: 'heal', amount: '@var.hp' }], ctx);
    expect(ctx.vars.hp).toBe(3);
    expect(actor.system.health.value).toBe(8);
    expect(stepErrors([{ do: 'askNumber', var: 'bad name' }])[0]).toMatch(/var must be/);
  });

  test('the new events are valid and read out', () => {
    for (const event of ['combatStart', 'combatEnd', 'initiativeRolled', 'storyPointSpent']) {
      expect(validateRule({ type: 'Trigger', event, steps: [] })).toEqual([]);
    }

    expect(summarizeRule({ type: 'Trigger', event: 'storyPointSpent', steps: [{ do: 'chat' }] })).toBe('When you spend a Story Point: chat');
  });
});


describe('round 10: untrained and vehicle kinds', () => {
  test('roll:untrained, vehicle:moves and the untrained-Snag immunity', async () => {
    const { ruleNoUntrainedSnag } = await import('./adapter.mjs');
    const actor = makeActor([{ type: 'RollModifier', immune: ['untrainedSnag'], when: ['skill:driving', 'vehicle:driving', 'vehicle:moves:aerial'] }]);
    actor.system.skills = { driving: { shift: 'd20' }, athletics: { shift: 'd6' } };
    const jet = makeActor([], { type: 'vehicle', crew: { a: { uuid: actor.uuid, vehicleRole: 'driver' } } });
    jet.system.movement = { aerial: { base: 60 }, ground: { base: 0 } };
    game.actors.contents = [actor, jet];
    expect(evaluateTag('roll:untrained', contextFor({ self: actor, rolledSkill: 'driving' }))).toBe(true);
    expect(evaluateTag('roll:untrained', contextFor({ self: actor, rolledSkill: 'athletics' }))).toBe(false);
    expect(evaluateTag('vehicle:moves:aerial', contextFor({ self: actor }))).toBe(true);
    expect(evaluateTag('vehicle:moves:ground', contextFor({ self: actor }))).toBe(false);
    expect(ruleNoUntrainedSnag(actor, 'driving')).toBe(true);
    expect(ruleNoUntrainedSnag(actor, 'athletics')).toBe(false);
    game.actors.contents = [];
    expect(validateRule({ type: 'RollModifier', immune: ['untrainedSnag'] })).toEqual([]);
  });
});


describe('round 11: condition immunity', () => {
  test('own and aura ConditionImmunity rules', async () => {
    const { ruleConditionImmune } = await import('./adapter.mjs');
    const self = makeActor([{ type: 'ConditionImmunity', conditions: ['frightened', 'mesmerized'] }]);
    expect(ruleConditionImmune(self, 'frightened')).toBe(true);
    expect(ruleConditionImmune(self, 'stunned')).toBe(false);
    const morphOnly = makeActor([{ type: 'ConditionImmunity', conditions: ['surprised'], when: ['self:morphed'] }]);
    expect(ruleConditionImmune(morphOnly, 'surprised')).toBe(false);
    morphOnly.system.isMorphed = true;
    expect(ruleConditionImmune(morphOnly, 'surprised')).toBe(true);
    expect(validateRule({ type: 'ConditionImmunity', conditions: [] })).toContain('conditions must list at least one Condition');
    expect(summarizeRule({ type: 'ConditionImmunity', conditions: ['frightened'], scope: 'aura', radius: 10 })).toBe('Allies within 10 ft: Immune to frightened');
  });
});


describe('round 12: pickGrant', () => {
  test('filters the compendium by tags, gives the pick, stamps a duration', async () => {
    const actor = makeActor([]);
    const granted = [];
    const seen = {};
    const grantHelpers = {
      findItems: async ({ type, availabilities, matches }) => {
        Object.assign(seen, { type, availabilities });
        const rows = [
          { uuid: 'C.a', name: 'Silent Pistol', system: { traits: ['silent'] } },
          { uuid: 'C.b', name: 'Loud Rifle', system: { traits: [] } },
        ];
        return matches ? rows.filter(matches) : rows;
      },
      pickOne: async (title, rows) => rows.map(row => row.uuid).join(','),
      grantCopy: async (who, uuid, options) => {
        granted.push({ who, uuid, options }); return { name: 'Silent Pistol' }; 
      },
    };
    const ctx = stepContext({ actor, item: makeItem([], { name: 'Armory' }), targets: [] });
    ctx.grantHelpers = grantHelpers;
    await runSteps([{ do: 'pickGrant', from: { type: 'weapon', availabilities: ['standard'], tags: ['item:trait:silent'] }, integrated: true, until: 'scene' }], ctx);
    expect(seen).toEqual({ type: 'weapon', availabilities: ['standard'] });
    expect(granted[0].uuid).toBe('C.a');
    expect(granted[0].options.integrated).toBe(true);
    expect(granted[0].options.flags.rulesExpiry.until).toBe('scene');
    expect(ctx.vars.picked).toBe('C.a');
    expect(stepErrors([{ do: 'pickGrant', from: {} }])).toEqual(['steps[0]: pickGrant needs from.type']);
    expect(stepErrors([{ do: 'pickGrant', from: { type: 'weapon', tags: ['wobble:x'] } }])[0]).toMatch(/unknown tag/);
  });
});


describe('round 13: Story Point gains need someone to receive them', () => {
  test('no GM connected: the gain stops the run', async () => {
    const { setStoryPointHelpers } = await import('./steps.mjs');
    const granted = [];
    let canWrite = false;
    setStoryPointHelpers({
      canSpendForActor: () => true, spendForActor: async () => {}, poolFor: () => 'story',
      requestStoryPointGrant: async (actor, amount) => granted.push(amount), canWriteStoryPoints: () => canWrite,
    });
    global.ui = { notifications: { warn: jest.fn() } };
    const actor = makeActor([]);
    const ctx = () => stepContext({ actor, item: makeItem([]), targets: [] });
    expect(await runSteps([{ do: 'gainResource', resource: { storyPoints: true }, amount: 1 }, { do: 'chat', text: 'after' }], ctx())).toBe(false);
    expect(granted).toEqual([]);
    expect(ui.notifications.warn).toHaveBeenCalled();
    canWrite = true;
    expect(await runSteps([{ do: 'gainResource', resource: { storyPoints: true }, amount: 1 }], ctx())).toBe(true);
    expect(granted).toEqual([1]);
    setStoryPointHelpers(null);
  });
});


describe('round 14: limits on incoming rules', () => {
  test('an incoming modifier with a used-up limit stops applying', async () => {
    const { rollRules } = await import('./adapter.mjs');
    const defender = makeActor([{ type: 'RollModifier', scope: 'incoming', snag: true, limit: { per: 'rest', max: 1 } }]);
    defender.getFlag = (scope, key) => foundry.utils.getProperty(defender.flags[scope] ?? {}, key);
    const roller = makeActor([]);
    const first = rollRules(roller, defender, { rolledSkill: 'athletics' }).find(e => e.owner === defender);
    expect(first.answer).toBe(true);
    const item = defender.items.contents[0];
    defender.flags.essence20.ruleUses = { [`${item.id}-0`]: { count: 1 } };
    const after = rollRules(roller, defender, { rolledSkill: 'athletics' }).find(e => e.owner === defender);
    expect(after.answer).toBe(false);
  });
});

describe('round 15: AttackCount', () => {
  test('counts and extras whose condition fits the attack', async () => {
    const { ruleAttackCounts } = await import('./adapter.mjs');
    const actor = makeActor([
      { type: 'AttackCount', label: 'Twice', count: '1 + max(1, @item.system.advances.currentValue)' },
      { type: 'AttackCount', label: 'Melee extra', additional: 1, when: ['attack:melee'] },
    ]);
    actor.items.contents[0].system.advances = { currentValue: 2 };
    const ranged = ruleAttackCounts(actor, { type: 'weaponEffect', flags: {}, system: { classification: { style: 'ranged' } } });
    expect(ranged).toEqual([{ count: 3, label: 'Twice', when: null }]);
    const melee = ruleAttackCounts(actor, { type: 'weaponEffect', flags: {}, system: { classification: { style: 'melee' } } });
    expect(melee.map(e => e.additional ?? e.count)).toEqual([3, 1]);
    expect(validateRule({ type: 'AttackCount' })).toContain('give either count or additional');
    expect(validateRule({ type: 'AttackCount', count: 2, additional: 1 })).toContain('give either count or additional');
    expect(summarizeRule({ type: 'AttackCount', count: 2 })).toBe('2 attacks per Attack action');
  });
});


describe('round 16: bonusAttack', () => {
  test('grants filtered extra attacks through the action economy; no combat stops the run', async () => {
    const actor = makeActor([]);
    const grants = [];
    let inCombat = true;
    const economy = {
      grantBonusAttack: async (who, options) => {
        if (inCombat) {
          grants.push(options);
        }

        return inCombat;
      },
    };
    const ctx = () => Object.assign(stepContext({ actor, item: makeItem([], { name: 'Triple Strike' }), targets: [] }), { economy });
    expect(await runSteps([{ do: 'bonusAttack', count: 2, cost: 'none', when: ['attack:melee'] }], ctx())).toBe(true);
    expect(grants).toEqual([
      { source: 'Triple Strike', cost: 'none', filter: { when: ['attack:melee'] }, psychicOnMiss: 0 },
      { source: 'Triple Strike', cost: 'none', filter: { when: ['attack:melee'] }, psychicOnMiss: 0 },
    ]);
    inCombat = false;
    expect(await runSteps([{ do: 'bonusAttack' }], ctx())).toBe(false);
    expect(stepErrors([{ do: 'bonusAttack', cost: 'lots' }])[0]).toMatch(/cost must be/);
  });
});

describe('round 17: vehicle kind', () => {
  test('vehicle:type reads what is being crewed', () => {
    const pilot = makeActor([]);
    const zord = makeActor([], { type: 'zord', crew: { a: { uuid: pilot.uuid, vehicleRole: 'driver' } } });
    game.actors.contents = [pilot, zord];
    expect(evaluateTag('vehicle:type:zord', contextFor({ self: pilot }))).toBe(true);
    expect(evaluateTag('vehicle:type:vehicle', contextFor({ self: pilot }))).toBe(false);
    game.actors.contents = [];
    expect(evaluateTag('vehicle:type:zord', contextFor({ self: pilot }))).toBe(false);
  });
});

describe('round 18: weapon traits and hardpoints', () => {
  test('WeaponTrait gives matching weapons their traits', async () => {
    const { ruleWeaponTraits } = await import('./adapter.mjs');
    const actor = makeActor([
      { type: 'WeaponTrait', traits: ['wrecker'] },
      { type: 'WeaponTrait', traits: ['antiTank'], items: ['item:trait:fire'] },
    ]);
    expect(ruleWeaponTraits(actor, { name: 'Flamer', flags: {}, system: {} }, ['fire'])).toEqual(['wrecker', 'antiTank']);
    expect(ruleWeaponTraits(actor, { name: 'Rifle', flags: {}, system: {} }, ['ballistic'])).toEqual(['wrecker']);
  });

  test('Hardpoints add slots and Reinforced fire', async () => {
    const { ruleHardpoints, ruleFiresAsReinforced } = await import('./adapter.mjs');
    const actor = makeActor([
      { type: 'Hardpoints', external: 2 },
      { type: 'Hardpoints', integrated: 1, when: ['rule:data:system.choice=hardpoint'] },
      { type: 'Hardpoints', reinforced: true, items: ['item:trait:ballistic'] },
    ]);
    expect(ruleHardpoints(actor)).toEqual({ external: 2, integrated: 0, nonWeapon: 0, perWeapon: 0 });
    actor.items.contents[0].system.choice = 'hardpoint';
    expect(ruleHardpoints(actor).integrated).toBe(1);
    expect(ruleFiresAsReinforced(actor, { flags: {}, system: { traits: ['ballistic'] } })).toBe(true);
    expect(ruleFiresAsReinforced(actor, { flags: {}, system: { traits: [] } })).toBe(false);
    expect(validateRule({ type: 'Hardpoints' })).toEqual(['changes nothing']);
  });
});


describe('round 19: what the hit was', () => {
  test('damage:<type> and damage>=N read a damage Trigger\'s hit; unknown elsewhere', () => {
    const ctx = contextFor({ damageType: 'Stun', damageAmount: 3 });
    expect(evaluateTag('damage:stun', ctx)).toBe(true);
    expect(evaluateTag('damage:sharp', ctx)).toBe(false);
    expect(evaluateTag('damage>=3', ctx)).toBe(true);
    expect(evaluateTag('damage>3', ctx)).toBe(false);
    expect(evaluateTag('damage:stun', contextFor({}))).toBeNull();
    expect(unknownTags(['damage>=2', 'damage:fire'])).toEqual([]);
  });

  test('a takesDamage Trigger can ask what hit it', async () => {
    const actor = makeActor([{ type: 'Trigger', event: 'takesDamage', when: ['damage:fire', 'damage>=2'], steps: [{ do: 'mark', key: 'burnt' }] }]);
    await fireTriggers(actor, 'takesDamage', { damage: { amount: 1, damageType: 'fire' }, roll: { damageType: 'fire', damageAmount: 1 } });
    expect(markOf(actor, 'burnt')).toBe(false);
    await fireTriggers(actor, 'takesDamage', { damage: { amount: 2, damageType: 'fire' }, roll: { damageType: 'fire', damageAmount: 2 } });
    expect(markOf(actor, 'burnt')).toBe(true);
  });
});

describe('round 20: outcomes', () => {
  test('an afterRoll Trigger wanting success takes a crit too; failure takes a fumble', async () => {
    const actor = makeActor([
      { type: 'Trigger', event: 'afterRoll', outcome: 'success', steps: [{ do: 'mark', key: 'won' }] },
      { type: 'Trigger', event: 'afterRoll', outcome: 'failure', steps: [{ do: 'mark', key: 'lost' }] },
    ]);
    await fireTriggers(actor, 'afterRoll', { outcome: 'crit' });
    expect(markOf(actor, 'won')).toBe(true);
    expect(markOf(actor, 'lost')).toBe(false);
    await fireTriggers(actor, 'afterRoll', { outcome: 'fumble' });
    expect(markOf(actor, 'lost')).toBe(true);
  });
});

describe('round 21: Triggers that reach other actors', () => {
  test('an aura Trigger fires for the ally it reaches, not its holder, and its limit is the holder\'s', async () => {
    const { LINK_HOLDERS } = await import('./index.mjs');
    const holder = makeActor([{ type: 'Trigger', event: 'turnStart', scope: 'aura', radius: 30, affects: 'allies', limit: { per: 'encounter' }, steps: [{ do: 'mark', key: 'cheered' }] }]);
    const ally = makeActor([]);
    for (const actor of [holder, ally]) {
      actor.getFlag = (scope, key) => foundry.utils.getProperty(actor.flags[scope] ?? {}, key);
      actor.setFlag = async (scope, key, value) => foundry.utils.setProperty(actor.flags[scope] ??= {}, key, value);
    }

    const tokenOf = (actor, x) => ({ actor, center: { x, y: 0 }, document: { disposition: 1, x, y: 0, width: 1, height: 1 } });
    const tokens = [tokenOf(holder, 0), tokenOf(ally, 100)];
    holder.getActiveTokens = () => [tokens[0]];
    ally.getActiveTokens = () => [tokens[1]];
    global.canvas = { tokens: { placeables: tokens }, grid: { size: 100, distance: 5, measurePath: ([a, b]) => ({ distance: Math.hypot(a.x - b.x, a.y - b.y) / 100 * 5 }) }, dimensions: { size: 100, distance: 5 } };
    holder.id ??= 'holder';
    LINK_HOLDERS.add(holder.id);
    await fireTriggers(holder, 'turnStart');
    expect(markOf(holder, 'cheered')).toBe(false);
    await fireTriggers(ally, 'turnStart');
    expect(markOf(ally, 'cheered')).toBe(true);
    const { usesLeft } = await import('./limits.mjs');
    const item = holder.items.contents[0];
    expect(usesLeft(holder, item.system.rules[0], item, 0)).toBe(0);
    expect(usesLeft(ally, item.system.rules[0], item, 0)).toBe(1);
    LINK_HOLDERS.delete(holder.id);
    delete global.canvas;
  });
});

describe('round 22: holder tags', () => {
  test('Defender\'s Oath: the Protected Target within 10 ft stays at 1 Health while the Bodyguard stands', async () => {
    const { LINK_HOLDERS } = await import('./index.mjs');
    const { wouldBeDefeated } = await import('./triggers.mjs');
    const rules = JSON.parse(readFileSync('packs/gijcrbitems/_source/' + readdirSync('packs/gijcrbitems/_source').find(n => n.endsWith('_LuQoEjHVOM8Yoc0Y.json')), 'utf8')).system.rules;
    const guard = makeActor(rules);
    const ward = makeActor([]);
    const other = makeActor([]);
    for (const actor of [guard, ward, other]) {
      actor.getFlag = (scope, key) => foundry.utils.getProperty(actor.flags[scope] ?? {}, key);
      actor.setFlag = async (scope, key, value) => foundry.utils.setProperty(actor.flags[scope] ??= {}, key, value);
    }

    guard.flags.essence20.protectedTargetUuid = ward.uuid;
    const tokenOf = (actor, x) => ({ actor, center: { x, y: 0 }, document: { disposition: 1 } });
    const tokens = [tokenOf(guard, 0), tokenOf(ward, 100), tokenOf(other, 100)];
    guard.getActiveTokens = () => [tokens[0]];
    ward.getActiveTokens = () => [tokens[1]];
    other.getActiveTokens = () => [tokens[2]];
    global.canvas = { tokens: { placeables: tokens }, grid: { measurePath: ([a, b]) => ({ distance: Math.abs(a.x - b.x) / 10 }) } };
    LINK_HOLDERS.add(guard.id);
    expect(await wouldBeDefeated(ward, 9, 'sharp')).toBe(4);
    expect(await wouldBeDefeated(other, 9, 'sharp')).toBe(9);
    guard.statuses.add('defeated');
    expect(await wouldBeDefeated(ward, 9, 'sharp')).toBe(9);
    guard.statuses.delete('defeated');
    tokens[1].center.x = 200;
    expect(await wouldBeDefeated(ward, 9, 'sharp')).toBe(9);
    LINK_HOLDERS.delete(guard.id);
    delete global.canvas;
  });
});

describe('round 23: pickAlly', () => {
  test('the targeted ally is taken; otherwise allies in range that pass the filter are offered', async () => {
    const me = makeActor([]);
    const near = makeActor([]);
    const morphed = makeActor([]);
    morphed.system.isMorphed = true;
    const tokenOf = (actor, x) => ({ actor, center: { x, y: 0 }, document: { disposition: 1 } });
    const tokens = [tokenOf(me, 0), tokenOf(near, 10), tokenOf(morphed, 20)];
    for (const [index, actor] of [me, near, morphed].entries()) {
      actor.getActiveTokens = () => [tokens[index]];
      actor.items.find = () => undefined;
      actor.items.filter = () => [];
    }

    global.canvas = { tokens: { placeables: tokens }, grid: { measurePath: ([a, b]) => ({ distance: Math.abs(a.x - b.x) }) } };
    let offered = null;
    const wait = async ({ content }) => {
      offered = content;
      return morphed.id;
    };

    global.foundry.applications = { api: { DialogV2: { wait } } };
    global.game.user = { targets: new Set() };
    global.game.i18n = { localize: key => key, format: key => key };
    const ctx = stepContext({ actor: me, item: { name: 'Test' }, targets: [] });
    await runSteps([{ do: 'pickAlly', within: 30, filter: ['target:morphed'] }], ctx);
    expect(ctx.targets).toEqual([morphed]);
    expect(offered).not.toContain(near.id);
    global.game.user = { targets: new Set([tokens[1]]) };
    const ctx2 = stepContext({ actor: me, item: { name: 'Test' }, targets: [] });
    await runSteps([{ do: 'pickAlly' }], ctx2);
    expect(ctx2.targets).toEqual([near]);
    delete global.canvas;
    delete global.game.user;
  });
});

describe('round 24: banked Defense bonuses', () => {
  test('a banked Defense bonus counts against that Defense once; a persisting one keeps counting; roll sources ignore both', async () => {
    const { bankRollBonus, bankedDefense, bankedSources } = await import('./bank.mjs');
    const actor = makeActor([]);
    await bankRollBonus(actor, { label: 'Brace', defense: 'toughness', defenseBonus: 2 });
    await bankRollBonus(actor, { label: 'Shield', defense: 'any', defenseBonus: 1, persist: true, until: 'scene' });
    expect(bankedSources(actor, null, {}).sources).toEqual([]);
    expect(await bankedDefense(actor, 'evasion')).toBe(1);
    expect(await bankedDefense(actor, 'toughness')).toBe(3);
    expect(await bankedDefense(actor, 'toughness')).toBe(1);
  });

  test('the bank step carries a Defense bonus and the validator checks it', async () => {
    const actor = makeActor([]);
    const ctx = stepContext({ actor, item: { name: 'Hard Target' }, targets: [] });
    await runSteps([{ do: 'bank', defense: 'evasion', defenseBonus: '1 + 1' }], ctx);
    const { bankedDefense } = await import('./bank.mjs');
    expect(await bankedDefense(actor, 'evasion')).toBe(2);
    expect(stepErrors([{ do: 'bank', defense: 'luck' }])).toEqual(['steps[0]: defense must be toughness, evasion, willpower, cleverness or any']);
  });
});

describe('round 25: rule:banked', () => {
  test('a Use can wait until its own banked bonus is spent', async () => {
    const actor = makeActor([{ type: 'Use', when: ['not:rule:banked'], steps: [{ do: 'bank', upshift: 1 }] }]);
    const item = actor.items.contents[0];
    const ctx = contextFor({ self: actor, ruleItem: item });
    expect(evaluateTag('rule:banked', ctx)).toBe(false);
    await runSteps([{ do: 'bank', upshift: 1 }], stepContext({ actor, item, targets: [] }));
    expect(evaluateTag('rule:banked', ctx)).toBe(true);
    expect(evaluateTag('rule:banked', contextFor({ self: actor, ruleItem: { id: 'other' } }))).toBe(false);
  });
});

describe('round 26: Qualification upgrades and availability', () => {
  test('item:availability compares the effective tier; item:id matches any printing', () => {
    const rifle = { name: 'Rifle', flags: { core: { sourceId: 'Compendium.essence20.a.Item.ABCDEFGHIJKLMNOP' } }, system: { availability: 'standard', totalAvailability: 'limited' } };
    expect(evaluateTag('item:availability<=standard', contextFor({ item: rifle }))).toBe(false);
    expect(evaluateTag('item:availability<=standard', contextFor({ item: rifle, effectiveAvailability: 'standard' }))).toBe(true);
    expect(evaluateTag('item:id:ABCDEFGHIJKLMNOP', contextFor({ item: rifle }))).toBe(true);
    expect(unknownTags(['item:availability>=restricted', 'item:id:x'])).toEqual([]);
  });

  test('a Qualification rule\'s upgrades are Qualified upgrades', async () => {
    const { ruleQualifiedUpgrade } = await import('./adapter.mjs');
    const actor = makeActor([{ type: 'Qualification', upgrades: [{ any: ['item:id:ihSql0Px1kNgTBfP', 'item:name~microtech'] }] }]);
    expect(ruleQualifiedUpgrade(actor, { uuid: 'Compendium.essence20.x.Item.ihSql0Px1kNgTBfP', name: 'Microtech Weapon' })).toBe(true);
    expect(ruleQualifiedUpgrade(actor, { uuid: 'Compendium.essence20.x.Item.zzzzzzzzzzzzzzzz', name: 'Traumatic' })).toBe(false);
    expect(validateRule({ type: 'Qualification', upgrades: ['item:name~organic'] })).toEqual([]);
    expect(validateRule({ type: 'Qualification' })).toEqual(['items or upgrades must be a list of item: tags']);
  });
});

describe('round 27: pickPerk', () => {
  test('validated, and its level formulas resolve before the picker runs', async () => {
    expect(stepErrors([{ do: 'pickPerk' }])).toEqual(['steps[0]: pickPerk needs from: role, focus or branch']);
    expect(stepErrors([{ do: 'pickPerk', from: 'role', maxLevel: 'floor(@level / 2)' }])).toEqual([]);
  });
});

describe('round 28: nextTurn, includeSelf, Defense lists', () => {
  test('nextTurn runs out when the holder\'s next turn starts', async () => {
    const { stampFor, isExpired } = await import('./expiry.mjs');
    const me = { id: 'me' };
    const combat = { id: 'c', started: true, round: 2, turn: 3, turns: [{ actor: { id: 'x' } }, { actor: me }, { actor: { id: 'y' } }, { actor: { id: 'z' } }] };
    const entry = { until: 'nextTurn', stamp: stampFor('nextTurn', combat, me) };
    expect(isExpired(entry, { ...combat, round: 3, turn: 0 })).toBe(false);
    expect(isExpired(entry, { ...combat, round: 3, turn: 1 })).toBe(true);
    const early = { until: 'nextTurn', stamp: stampFor('nextTurn', { ...combat, turn: 0 }, me) };
    expect(isExpired(early, { ...combat, round: 2, turn: 0 })).toBe(false);
    expect(isExpired(early, { ...combat, round: 2, turn: 1 })).toBe(true);
    expect(isExpired(entry, { ...combat, id: 'other' })).toBe(true);
  });

  test('a bank can cover several Defenses, used up together by one attack', async () => {
    const { bankRollBonus, bankedDefense } = await import('./bank.mjs');
    const actor = makeActor([]);
    await bankRollBonus(actor, { defense: ['toughness', 'evasion'], defenseBonus: 2 });
    expect(await bankedDefense(actor, 'willpower')).toBe(0);
    expect(await bankedDefense(actor, 'evasion')).toBe(2);
    expect(await bankedDefense(actor, 'toughness')).toBe(0);
    expect(stepErrors([{ do: 'bank', defense: ['toughness', 'luck'] }])).toHaveLength(1);
  });
});

describe('round 29: pick before paying', () => {
  test('a Use whose first step is pickAlly pays nothing when the pick is cancelled', async () => {
    const { runUse } = await import('./triggers.mjs');
    const actor = makeActor([{ type: 'Use', cost: { action: 'standard', resource: { path: 'system.powers.personal.value' }, amount: 1 }, steps: [{ do: 'pickAlly' }, { do: 'heal', to: 'target', amount: 1 }] }]);
    actor.system.powers = { personal: { value: 3, max: 3 } };
    actor.getActiveTokens = () => [];
    global.game.user = { targets: new Set() };
    global.game.i18n = { localize: key => key, format: key => key };
    global.ui = { notifications: { warn: () => {} } };
    const pay = jest.fn(async () => true);
    expect(await runUse(actor.items.contents[0], pay, { pick: async (item, list) => list[0] })).toBeNull();
    expect(pay).not.toHaveBeenCalled();
    expect(actor.system.powers.personal.value).toBe(3);
    delete global.game.user;
  });
});

describe('round 30: temporary Health', () => {
  test('heal with temporary adds to the Health bonus, not the value', async () => {
    const actor = makeActor([]);
    await runSteps([{ do: 'heal', amount: 2, temporary: true }], stepContext({ actor, item: { name: 'x' }, targets: [] }));
    expect(actor.system.health.bonus).toBe(2);
    expect(actor.system.health.value).toBe(5);
  });
});

describe('round 31: named Role Points, every ally', () => {
  test('{rolePoints: name} reads and spends that Role Points item', async () => {
    const { rolePointsOf, readResource, changeResource } = await import('./steps.mjs');
    const moxie = { type: 'rolePoints', name: 'Moxie', system: { resource: { value: 2, max: 3 } }, async update(data) {
      this.system.resource.value = data['system.resource.value']; 
    } };
    const actor = makeActor([], { items: [moxie] });
    expect(rolePointsOf(actor, 'moxie')).toBe(moxie);
    const ctx = stepContext({ actor, item: { name: 'x' }, targets: [] });
    expect(readResource({ rolePoints: 'Moxie' }, ctx)).toBe(2);
    expect(await changeResource({ rolePoints: 'Moxie' }, -1, ctx)).toBe(true);
    expect(moxie.system.resource.value).toBe(1);
    expect(await changeResource({ rolePoints: 'Cheer' }, -1, ctx)).toBe(false);
  });
});

describe('round 32: grants bring their attached items; overrides', () => {
  test('pickGrant hands its flags and system overrides to grantCopy', async () => {
    const actor = makeActor([]);
    const calls = [];
    const helpers = {
      findItems: async () => [{ uuid: 'Compendium.x.Item.a', name: 'Skin' }],
      pickOne: async () => 'Compendium.x.Item.a',
      grantCopy: async (who, uuid, options) => {
        calls.push(options); return { name: 'Skin' }; 
      },
    };
    const ctx = stepContext({ actor, item: { id: 'p', name: 'Tempering' }, targets: [] });
    ctx.grantHelpers = helpers;
    await runSteps([{ do: 'pickGrant', from: { type: 'upgrade' }, flags: { alterationWorn: true }, system: { quantity: 2 } }], ctx);
    expect(calls[0].flags).toEqual({ alterationWorn: true });
    expect(calls[0].system).toEqual({ quantity: 2 });
  });
});

describe('round 33: mark setters, endOfNextRound', () => {
  test('markedBy / markedByMe check who set the mark; endOfNextRound lasts through next round', async () => {
    const { isExpired, stampFor } = await import('./expiry.mjs');
    const me = { uuid: 'Actor.me', flags: { essence20: { ruleMarks: {} } } };
    const foe = { uuid: 'Actor.foe', flags: { essence20: { ruleMarks: { diverted: { by: 'Actor.me' } } } } };
    expect(evaluateTag('markedByMe:diverted', contextFor({ self: me, other: foe }))).toBe(true);
    expect(evaluateTag('markedBy:diverted', contextFor({ self: foe, other: me }))).toBe(true);
    expect(evaluateTag('markedBy:diverted', contextFor({ self: foe, other: { uuid: 'Actor.x' } }))).toBe(false);
    expect(evaluateTag('markedBy:diverted', contextFor({ self: foe }))).toBeNull();
    const combat = { id: 'c', started: true, round: 2, turn: 1 };
    const entry = { until: 'endOfNextRound', stamp: stampFor('endOfNextRound', combat) };
    expect(isExpired(entry, { ...combat, round: 3, turn: 4 })).toBe(false);
    expect(isExpired(entry, { ...combat, round: 4, turn: 0 })).toBe(true);
    expect(unknownTags(['markedBy:x', 'markedByMe:y'])).toEqual([]);
  });
});

describe('round 34: specializedIn', () => {
  test('self:specializedIn:<skill> - holds a Specialization item in that Skill', () => {
    const actor = makeActor([], { items: [{ id: 's1', type: 'specialization', name: 'Chemistry', system: { skill: 'science' } }] });
    expect(evaluateTag('self:specializedIn:science', contextFor({ self: actor }))).toBe(true);
    expect(evaluateTag('self:specializedIn:technology', contextFor({ self: actor }))).toBe(false);
  });
});

test('specializedIn reads system.skills.<skill>.specializations; roll:specialized counts a chosen Specialization', () => {
  const actor = makeActor([]);
  actor.system.skills = { science: { specializations: { a1: { name: 'Chemistry' } } } };
  expect(evaluateTag('self:specializedIn:science', contextFor({ self: actor }))).toBe(true);
  expect(evaluateTag('self:specializedIn:technology', contextFor({ self: actor }))).toBe(false);
  expect(evaluateTag('roll:specialized', contextFor({ dataset: { specializationKey: 'a1' } }))).toBe(true);
});

describe('round 35: scaled damage', () => {
  test('scaled dealt DamageModifiers join the attack bonus and skip the post-hit note', () => {
    const actor = makeActor([
      { type: 'DamageModifier', direction: 'dealt', amount: 2, scaled: true, when: ['attack'] },
      { type: 'DamageModifier', direction: 'dealt', amount: 1, scaled: true, damageType: 'sharp' },
      { type: 'DamageModifier', direction: 'dealt', amount: 1 },
    ]);
    const blunt = { type: 'weaponEffect', system: { damageType: 'blunt', classification: { skill: 'might', style: 'melee' } } };
    const scaled = ruleScaledDamage(actor, null, { item: blunt, rolledSkill: 'might' });
    expect(scaled.amount).toBe(2);
    expect(scaled.sources).toHaveLength(1);
    const notes = [];
    ruleDamageDealt(actor, null, { damageValue: 3 }, { skill: 'might' }, { damageBonusNote: (result, amount) => notes.push(amount) });
    expect(notes).toEqual([1]);
    expect(validateRule({ type: 'DamageModifier', direction: 'taken', amount: 1, scaled: true })).toContain('scaled only applies to damage dealt');
  });

  test('a ticked DialogSwitch damage joins the attack bonus', async () => {
    const actor = makeActor([
      { type: 'DialogSwitch', label: 'Hit harder', damage: 2 },
      { type: 'DialogSwitch', label: 'Unticked', damage: 5 },
    ]);
    expect(validateRule({ type: 'DialogSwitch', damage: 2 })).toEqual([]);
    const [hitHarder] = ruleDialogSwitches(actor);
    const options = { ext: { [hitHarder.name]: true } };
    await applyRuleSwitches(actor, options);
    expect(options.ruleDamage).toBe(2);
    expect(options.ruleDamageSources).toEqual(['Hit harder']);
    expect(options.shiftUp).toBe(0);
    // Remembered as ticked - unless it forgets (or has a limit), like a plain one-roll checkbox.
    expect(ruleDialogSwitches(actor)[0].value).toBe(true);
    actor.items.contents[0].system.rules[0].forget = true;
    rebuildIndex(actor);
    expect(ruleDialogSwitches(actor)[0].value).toBe(false);
  });

  test('DialogSwitch useSkill: the shift difference to that Skill, only for a Skill the actor has', async () => {
    global.CONFIG = { ...(global.CONFIG ?? {}), E20: { ...(global.CONFIG?.E20 ?? {}), skillShiftList: ['d20', 'd12', 'd10', 'd8', 'd6', 'd4', 'd2'] } };
    const actor = makeActor([
      { type: 'DialogSwitch', label: 'Fast talk', useSkill: 'deception' },
      { type: 'DialogSwitch', label: 'Missing', useSkill: 'driving' },
    ]);
    actor.system.skills = { initiative: { shift: 'd8' }, deception: { shift: 'd12' } };
    const switches = ruleDialogSwitches(actor, { rolledSkill: 'initiative' });
    expect(switches.map(s => s.label)).toEqual(['Fast talk']);
    const options = { ext: { [switches[0].name]: true } };
    await applyRuleSwitches(actor, options, { rolledSkill: 'initiative' });
    expect(options.shiftUp).toBe(2);
    expect(ruleDialogSwitches(actor, { rolledSkill: 'deception' })).toEqual([]);
  });

  test('sizeDiff compares the two actors’ sizes; @size is the place in the size order', () => {
    const me = makeActor([], { name: 'Me' });
    const foe = makeActor([], { name: 'Foe' });
    me.system.size = 'common';
    foe.system.size = 'huge';
    const ctx = contextFor({ self: me, other: foe });
    expect(evaluateTag('target:sizeDiff>=2', ctx)).toBe(true);
    expect(evaluateTag('target:sizeDiff>=4', ctx)).toBe(false);
    expect(evaluateTag('self:sizeDiff>=1', ctx)).toBe(false);
    expect(evaluateTag('self:sizeDiff<0', ctx)).toBe(true);
    expect(evaluateTag('self:sizeDiff>=1', contextFor({ self: me }))).toBeNull();
    expect(unknownTags(['self:sizeDiff>=1', 'target:sizeDiff<=-1'])).toEqual([]);
    expect(resolveValue('@size', { actor: foe })).toBe(4);
    expect(formulaError('@size + 1')).toBeNull();
  });

  test('ally:within counts allies the system way when the lookup is set (Frenemy, Ally Awareness...)', async () => {
    const { setWorldLookups } = await import('./predicate.mjs');
    const me = makeActor([], { name: 'Me' });
    const friend = makeActor([], { name: 'Friend' });
    const asked = [];
    setWorldLookups({ alliesWithin: (actor, feet) => (asked.push(feet), feet >= 10 ? [friend, me, friend] : []) });
    try {
      expect(evaluateTag('ally:within:10', contextFor({ self: me }))).toBe(true);
      expect(evaluateTag('ally:within:5', contextFor({ self: me }))).toBe(false);
      expect(asked).toEqual([10, 5]);
    } finally {
      setWorldLookups({ alliesWithin: null });
    }
  });

  test('Cover: the attacker ignores or reduces it (biggest reduction), the target grants, raises or adds to it', async () => {
    const { ruleCover } = await import('./adapter.mjs');
    const shooter = makeActor([
      { type: 'Cover', mode: 'reduce', amount: 1 },
      { type: 'Cover', mode: 'reduce', amount: 2, when: ['item:trait:sniper'] },
      { type: 'Cover', mode: 'ignore', when: ['item:trait:shotgun'] },
    ]);
    const hider = makeActor([
      { type: 'Cover', mode: 'grant', against: true, when: ['self:transformed'] },
      { type: 'Cover', mode: 'base', amount: 3, against: true },
      { type: 'Cover', mode: 'add', amount: 1, against: true },
    ]);
    const rifle = { type: 'weaponEffect', system: { traits: ['sniper'], classification: { style: 'ranged' } } };
    expect(ruleCover(shooter, hider, { item: rifle })).toEqual({ ignore: false, reduce: 2, grant: false, base: 3, add: 1 });
    hider.system.isTransformed = true;
    const shotgun = { type: 'weaponEffect', system: { traits: ['shotgun'], classification: { style: 'ranged' } } };
    expect(ruleCover(shooter, hider, { item: shotgun })).toMatchObject({ ignore: true, reduce: 1, grant: true });
    expect(ruleCover(null, null, {})).toEqual({ ignore: false, reduce: 0, grant: false, base: 0, add: 0 });
    expect(validateRule({ type: 'Cover', mode: 'grant' })).toContain('grant only applies to attacks against the holder (against: true)');
    expect(validateRule({ type: 'Cover', mode: 'reduce', amount: 1, against: true })).toContain("reduce only applies to the holder's own attacks");
    expect(summarizeRule({ type: 'Cover', mode: 'base', amount: 3, against: true })).toBe('Cover is ↓3 against it');
  });

  test('Movement: per stage and type, set then multiply then add then max/min; null when nothing applies', async () => {
    const { ruleMovementStages } = await import('./adapter.mjs');
    const none = ruleMovementStages(makeActor([]));
    expect(none('final', 'ground', 30)).toBeNull();
    const actor = makeActor([
      { type: 'Movement', movement: 'ground', op: 'add', value: 10 },
      { type: 'Movement', movement: 'ground', op: 'multiply', value: 2 },
      { type: 'Movement', movement: 'all', op: 'min', value: 100, when: ['self:transformed'] },
      { type: 'Movement', movement: 'climb', stage: 'adjust', op: 'set', value: '@actor.system.movement.ground.total' },
    ]);
    actor.system.movement = { ground: { total: 30 } };
    const apply = ruleMovementStages(actor);
    expect(apply('final', 'ground', 30)).toBe(70);
    expect(apply('final', 'aerial', 60)).toBeNull();
    expect(apply('adjust', 'climb', 15)).toBe(30);
    expect(apply('adjust', 'ground', 30)).toBeNull();
    actor.system.isTransformed = true;
    expect(apply('final', 'ground', 60)).toBe(100);
    expect(validateRule({ type: 'Movement', movement: 'ground', op: 'add', value: 5 })).toEqual([]);
    expect(summarizeRule({ type: 'Movement', movement: 'ground', op: 'add', value: 5 })).toBe('Ground Movement + 5');
  });

  test('a bank step can carry damage for the next attack; its source says so', async () => {
    const { bankedSources } = await import('./bank.mjs');
    const actor = makeActor([{ type: 'Use', label: 'Charge up', steps: [{ do: 'bank', damage: 2, appliesWhen: ['attack'] }] }]);
    const ctx = stepContext({ actor, item: actor.items.contents[0], targets: [] });
    await runSteps(actor.items.contents[0].system.rules[0].steps, ctx);
    expect(ctx.chat.join(' ')).toContain('+2 damage');
    expect(bankedSources(actor, null, { isAttack: false }).sources).toEqual([]);
    expect(bankedSources(actor, null, { isAttack: true }).sources).toEqual([expect.objectContaining({ damage: 2, shiftUp: 0 })]);
  });

  test('a ticked DialogSwitch with a limit uses it up; spent, it is no longer offered', async () => {
    const actor = makeActor([{ type: 'DialogSwitch', label: 'Once a rest', damage: 1, limit: { per: 'rest' } }]);
    actor.getFlag = (scope, key) => foundry.utils.getProperty(actor.flags, `${scope}.${key}`);
    actor.setFlag = async (scope, key, value) => foundry.utils.setProperty(actor.flags, `${scope}.${key}`, value);
    const [once] = ruleDialogSwitches(actor);
    expect(once.value).toBe(false);
    await applyRuleSwitches(actor, { ext: { [once.name]: true } });
    expect(ruleDialogSwitches(actor)).toEqual([]);
  });

  test('scaled damage sees the Defense the dialog settled on, and the resolved Snag', async () => {
    const actor = makeActor([
      { type: 'DamageModifier', direction: 'dealt', scaled: true, amount: 1, when: ['defense:cleverness'] },
      { type: 'DamageModifier', direction: 'dealt', scaled: true, amount: 2, when: ['roll:snag'] },
    ]);
    const hit = { type: 'weaponEffect', system: { defenseType: 'toughness', classification: {} } };
    expect(ruleScaledDamage(actor, null, { item: hit, snag: false }).amount).toBe(0);
    expect(ruleScaledDamage(actor, null, { item: hit, defenseType: 'cleverness', snag: true }).amount).toBe(3);
    expect(evaluateTag('roll:snag', contextFor({}))).toBeNull();
  });

  test('a DialogSwitch that spends an amount: a number box up to what can be paid; @spent scales it', async () => {
    const actor = makeActor([{ type: 'DialogSwitch', label: 'Overcharge', spend: { resource: { path: 'system.charge' }, max: 3 }, damage: '@spent', downshift: '@spent' }]);
    actor.system.charge = 2;
    const [box] = ruleDialogSwitches(actor);
    expect(box).toMatchObject({ type: 'number', value: 0, max: 2 });
    const options = { ext: { [box.name]: '5' } };
    await applyRuleSwitches(actor, options);
    expect(options).toMatchObject({ shiftDown: 2, ruleDamage: 2 });
    expect(actor.system.charge).toBe(0);
    expect(ruleDialogSwitches(actor)).toEqual([]);
    expect(validateRule({ type: 'DialogSwitch', spend: {}, damage: 1 })).toContain('spend needs a resource or a max');
  });

  test('check:<name> asks a registered helper; self:/target: forms; unknown names are flagged', async () => {
    const { registerCheck, CHECK_NAMES } = await import('./predicate.mjs');
    const me = makeActor([], { name: 'Me' });
    const foe = makeActor([], { name: 'Foe' });
    registerCheck('bulwark', actor => actor === foe);
    registerCheck('wisdomOfTheElders', (actor, option) => option == 'lightfoilWings');
    registerCheck('energyAffinityAttack', (actor, option, ctx) => ctx.item?.system?.damageType == 'fire');
    const ctx = contextFor({ self: me, other: foe, item: { system: { damageType: 'fire' } } });
    expect(evaluateTag('check:bulwark', ctx)).toBe(false);
    expect(evaluateTag('target:check:bulwark', ctx)).toBe(true);
    expect(evaluateTag('self:check:wisdomOfTheElders:lightfoilWings', ctx)).toBe(true);
    expect(evaluateTag('check:wisdomOfTheElders:enhancedReflexes', ctx)).toBe(false);
    expect(evaluateTag('check:energyAffinityAttack', ctx)).toBe(true);
    expect(evaluateTag('check:skiing', ctx)).toBeNull();
    expect(unknownTags(['check:bulwark', 'target:check:skiing', 'check:nope', 'self:check:nope'])).toEqual(['check:nope', 'self:check:nope']);
    expect(() => registerCheck('nope', () => true)).toThrow();
    expect(CHECK_NAMES).toContain('environmentalExpertise');
  });

  test('@target.size / @target.<path> read the roll target; a RollModifier upshift can scale with it', () => {
    const me = makeActor([{ type: 'RollModifier', label: 'Bigger they are', upshift: 'max(0, @target.size - @size)' }]);
    const foe = makeActor([], { name: 'Foe' });
    me.system.size = 'common';
    foe.system.size = 'huge';
    expect(resolveValue('@target.size', { actor: me, other: foe })).toBe(4);
    expect(resolveValue('@target.system.health.max', { actor: me, other: foe })).toBe(10);
    expect(resolveValue('@target.size', { actor: me })).toBe(0);
    expect(formulaError('@target.size + 1')).toBeNull();
    expect(ruleRollSources(me, foe, {}).sources[0]).toMatchObject({ shiftUp: 3 });
    expect(ruleRollSources(me, null, {}).sources).toEqual([]);
  });

  test('gainResource on a .value path stops at its .max, never taking away what is above it', async () => {
    const actor = makeActor([]);
    actor.system.powers = { personal: { value: 4, max: 5 } };
    const ctx = stepContext({ actor, item: null, targets: [] });
    await runSteps([{ do: 'gainResource', resource: { path: 'system.powers.personal.value' }, amount: 3 }], ctx);
    expect(actor.system.powers.personal.value).toBe(5);
    actor.system.powers.personal.value = 7;
    await runSteps([{ do: 'gainResource', resource: { path: 'system.powers.personal.value' }, amount: 1 }], ctx);
    expect(actor.system.powers.personal.value).toBe(7);
    actor.system.charge = 2;
    await runSteps([{ do: 'gainResource', resource: { path: 'system.charge' }, amount: 3 }], ctx);
    expect(actor.system.charge).toBe(5);
  });

  test('DialogSwitch clearSnag: its Edge removes the Snag instead of cancelling with it', async () => {
    const actor = makeActor([{ type: 'DialogSwitch', label: 'Steam', edge: true, clearSnag: true }]);
    expect(validateRule(actor.items.contents[0].system.rules[0])).toEqual([]);
    const [steam] = ruleDialogSwitches(actor);
    const options = { snag: true, ext: { [steam.name]: true } };
    await applyRuleSwitches(actor, options);
    expect(options).toMatchObject({ edge: true, snag: false });
  });

  test('a spend box with no resource: a plain 0..max number, nothing paid', async () => {
    const actor = makeActor([{ type: 'DialogSwitch', label: 'Push it', spend: { max: 3 }, downshift: '@spent', damage: '@spent' }]);
    const [box] = ruleDialogSwitches(actor);
    expect(box).toMatchObject({ type: 'number', max: 3 });
    const options = { ext: { [box.name]: '2' } };
    await applyRuleSwitches(actor, options);
    expect(options).toMatchObject({ shiftDown: 2, ruleDamage: 2 });
  });

  test('roll:dataset:, roll:specialization~ and combat:first', () => {
    const me = makeActor([], { name: 'Me' });
    me.system.skills = { science: { specializations: { s1: { name: 'Chemistry' } } } };
    const roll = dataset => contextFor({ self: me, rolledSkill: 'science', dataset });
    expect(evaluateTag('roll:dataset:isRouseAttempt', roll({ isRouseAttempt: true }))).toBe(true);
    expect(evaluateTag('roll:dataset:isRouseAttempt', roll({ isRouseAttempt: 'false' }))).toBe(false);
    expect(evaluateTag('roll:dataset:kind=Grapple', roll({ kind: 'grapple' }))).toBe(true);
    expect(evaluateTag('roll:dataset:kind', contextFor({ self: me }))).toBeNull();
    expect(evaluateTag('roll:specialization~chem', roll({ specializationKey: 's1' }))).toBe(true);
    expect(evaluateTag('roll:specialization~chem', roll({}))).toBe(false);
    const other = makeActor([], { name: 'Other' });
    const combat = { started: true, turns: [{ actor: me }, { actor: other }] };
    expect(evaluateTag('combat:first', contextFor({ self: me, combat }))).toBe(true);
    expect(evaluateTag('combat:first', contextFor({ self: other, combat }))).toBe(false);
    expect(evaluateTag('combat:first', contextFor({ self: me, combat: null }))).toBe(false);
    expect(unknownTags(['roll:dataset:x', 'roll:specialization~y', 'combat:first'])).toEqual([]);
  });

  test('hit / miss fire for any roll against a target, not only attacks', async () => {
    const { runPostRoll } = await import('../helpers/extensions.mjs');
    const foe = makeActor([], { name: 'Foe' });
    const missed = makeActor([], { name: 'Other' });
    const actor = makeActor([
      { type: 'Trigger', event: 'hit', when: ['skill:intimidation'], steps: [{ do: 'mark', key: 'cowed', to: 'target' }] },
      { type: 'Trigger', event: 'miss', steps: [{ do: 'mark', key: 'shrugged', to: 'target' }] },
    ]);
    await runPostRoll(actor, [], {}, { rider: { skill: 'intimidation' }, hits: [{ target: foe, hit: true }, { target: missed, hit: false }] });
    expect(markOf(foe, 'cowed')).toBe(true);
    expect(markOf(missed, 'shrugged')).toBe(true);
    expect(markOf(missed, 'cowed')).toBe(false);
  });

  test('outcome double: a success by double the DIF (or a crit); success still matches it', async () => {
    const { runPostRoll } = await import('../helpers/extensions.mjs');
    const foe = makeActor([], { name: 'Foe' });
    const actor = makeActor([
      { type: 'Trigger', event: 'hit', outcome: 'double', steps: [{ do: 'mark', key: 'big', to: 'target' }] },
      { type: 'Trigger', event: 'hit', outcome: 'success', steps: [{ do: 'mark', key: 'any', to: 'target' }] },
      { type: 'Trigger', event: 'afterRoll', outcome: 'double', steps: [{ do: 'mark', key: 'rolledBig' }] },
    ]);
    await runPostRoll(actor, [{ success: true, multiplier: 1 }], {}, { rider: {}, hits: [{ target: foe, hit: true, result: { success: true, multiplier: 1 } }] });
    expect(markOf(foe, 'any')).toBe(true);
    expect(markOf(foe, 'big')).toBe(false);
    expect(markOf(actor, 'rolledBig')).toBe(false);
    await runPostRoll(actor, [{ success: true, multiplier: 2 }], {}, { rider: {}, hits: [{ target: foe, hit: true, result: { success: true, multiplier: 2 } }] });
    expect(markOf(foe, 'big')).toBe(true);
    expect(markOf(actor, 'rolledBig')).toBe(true);
  });
});
