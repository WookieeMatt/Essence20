import { jest } from '@jest/globals';

// Round-9 engine pieces (docs/RULES_CONVERSION_GUIDE.md, "Engine features added 2026-10-06 (round 9)").

const hooks = {};
global.Hooks = { on: (name, fn) => (hooks[name] = [...(hooks[name] ?? []), fn]), callAll: () => {} };

const rows = [];
jest.unstable_mockModule('./mechanics/combat/reaction-engine.mjs', () => ({
  rollVsMany: jest.fn(async (actor, skill, actors) => actors.map((other, i) => ({ targetUuid: other.uuid, success: rows[i] ?? false }))),
}));

const { contextFor, evaluateTag } = await import('./predicate.mjs');
const { resolveValue } = await import('./formula.mjs');
const { runSteps, stepContext, stepErrors, recipients } = await import('./steps.mjs');
const { rebuildIndex } = await import('./index.mjs');
await import('./triggers.mjs');

function setPath(object, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((at, key) => (at[key] ??= {}), object)[last] = value;
}

let nextId = 1;
function makeActor(name, items = [], extra = {}) {
  const actor = {
    id: `a${nextId++}`, name, type: 'playerCharacter', documentName: 'Actor', isOwner: true, flags: { essence20: {} }, statuses: new Set(),
    system: { level: 2, health: { value: 5, max: 10 }, powers: { personal: { value: 3, max: 3 } }, skills: { athletics: { shift: 'd10' }, might: { shift: 'd2' } } },
    ...extra,
    async update(data) {
      for (const [key, value] of Object.entries(data)) {
        setPath(this, key, value);
      }
    },
    async createEmbeddedDocuments(type, datas) {
      const made = datas.map(data => ({ ...data, id: `n${nextId++}`, parent: this }));
      this.items.contents.push(...made);
      return made;
    },
    async deleteEmbeddedDocuments(type, ids) {
      this.items.contents = this.items.contents.filter(item => !ids.includes(item.id));
    },
  };
  actor.uuid = `Actor.${actor.id}`;
  actor.items = {
    contents: items, get: id => actor.items.contents.find(i => i.id == id), find: fn => actor.items.contents.find(fn),
    [Symbol.iterator]: () => actor.items.contents[Symbol.iterator](),
  };
  for (const item of items) {
    item.parent = actor;
  }

  return actor;
}

function ruleItem(extra = {}) {
  return { id: `i${nextId++}`, name: 'Perk', flags: {}, ...extra, async update(data) {
    for (const [key, value] of Object.entries(data)) {
      setPath(this, key, value);
    }
  } };
}

beforeEach(() => {
  rows.length = 0;
  global.game = {
    combat: null, combats: { get: () => null }, user: { id: 'u', isGM: true, targets: new Set() }, actors: { contents: [] },
    users: { contents: [] }, settings: { get: () => 1 }, i18n: { localize: key => key, format: key => key },
  };
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.foundry = { ...(global.foundry ?? {}), utils: { ...(global.foundry?.utils ?? {}), setProperty: setPath, getProperty: (o, k) => k.split('.').reduce((at, key) => at?.[key], o) } };
});

describe('recipients, quiet, ladder caps', () => {
  test('to: picked:<key> reaches the stored actor', () => {
    const zord = makeActor('Rex', [], { type: 'zord' });
    global.fromUuidSync = uuid => (uuid == zord.uuid ? zord : null);
    const ctx = stepContext({ actor: makeActor('Hero'), item: ruleItem({ flags: { essence20: { rules: { choices: { mount: zord.uuid } } } } }), targets: [] });
    expect(recipients({ to: 'picked:mount' }, ctx)).toEqual([zord]);
    expect(recipients({ to: 'picked:none' }, ctx)).toEqual([]);
    expect(stepErrors([{ do: 'heal', to: 'picked:mount' }])).toEqual([]);
    delete global.fromUuidSync;
  });

  test('quiet keeps the dice line out of chat; ladderMax caps the die', async () => {
    const hero = makeActor('Hero');
    const ctx = stepContext({ actor: hero, item: ruleItem(), targets: [] });
    ctx.random = () => 0.99;
    await runSteps([{ do: 'heal', amount: '1d4', quiet: true }], ctx);
    expect(ctx.chat.join(' ')).not.toContain('DiceRolled');
    await runSteps([{ do: 'updateActor', ladder: { 'system.skills.athletics.shift': 3 }, ladderMax: 'd12' }], ctx);
    expect(hero.system.skills.athletics.shift).toBe('d12');
  });
});

describe('pick and record', () => {
  test('pick skill by die range; pick a target\'s item; pickGrant record + item:pickedSource', async () => {
    global.CONFIG = { E20: { skills: {}, skillToEssence: {} } };
    const hero = makeActor('Hero');
    const ctx = stepContext({ actor: hero, item: ruleItem(), targets: [] });
    let offered;
    ctx.askPick = async (step, options) => {
      offered = options.map(o => o.value);
      return options[0]?.value;
    };

    await runSteps([{ do: 'pick', key: 's', from: 'skill', minShift: 'd4' }], ctx);
    expect(offered).toEqual(['athletics']);
    const sword = { id: 'w', name: 'Sword', type: 'weapon', system: { equipped: true }, flags: {}, uuid: 'Actor.x.Item.w' };
    const foe = makeActor('Foe', [sword, { id: 'g', name: 'Rope', type: 'gear', system: {}, flags: {} }]);
    ctx.targets = [foe];
    await runSteps([{ do: 'pick', key: 'loot', from: 'targetItem', itemType: 'weapon' }], ctx);
    expect(offered).toEqual([sword.uuid]);

    const helpers = { findItems: jest.fn(async () => [{ uuid: 'C.rifle', name: 'Rifle' }, { uuid: 'C.saw', name: 'Saw' }]), pickOne: jest.fn(async () => 'C.rifle'), grantCopy: jest.fn() };
    ctx.grantHelpers = helpers;
    await runSteps([{ do: 'pickGrant', record: true, key: 'trained', from: { type: 'weapon' } }], ctx);
    helpers.pickOne = jest.fn(async () => 'C.saw');
    await runSteps([{ do: 'pickGrant', record: true, key: 'trained', max: 1, from: { type: 'weapon' } }], ctx);
    expect(helpers.grantCopy).not.toHaveBeenCalled();
    expect(ctx.item.flags.essence20.rules.choices.trained).toEqual([{ uuid: 'C.saw', name: 'Saw' }]);
    const owned = { name: 'Saw', type: 'weapon', flags: { core: { sourceId: 'C.other-printing' } } };
    expect(evaluateTag('item:pickedSource:trained', contextFor({ item: owned, ruleItem: ctx.item }))).toBe(true);
    expect(evaluateTag('item:pickedSource:trained', contextFor({ item: { name: 'Rifle', flags: {} }, ruleItem: ctx.item }))).toBe(false);
    delete global.CONFIG;
  });
});

describe('item steps against targets', () => {
  test('takeItem moves the picked item; rollVsEach runs onHit / onMiss per recipient', async () => {
    const hero = makeActor('Hero');
    const sword = { id: 'w', name: 'Sword', type: 'weapon', system: {}, flags: {}, toObject() {
      return { _id: 'w', name: 'Sword', type: 'weapon', system: {} };
    } };
    const foe = makeActor('Foe', [sword]);
    sword.parent = foe;
    global.fromUuidSync = uuid => (uuid == 'U.sword' ? sword : null);
    const ctx = stepContext({ actor: hero, item: ruleItem({ flags: { essence20: { rules: { choices: { loot: 'U.sword' } } } } }), targets: [foe] });
    await runSteps([{ do: 'takeItem', item: 'choice:loot' }], ctx);
    expect(foe.items.contents).toEqual([]);
    expect(hero.items.contents.map(i => i.name)).toEqual(['Sword']);
    delete global.fromUuidSync;

    const one = makeActor('One');
    const two = makeActor('Two');
    rows.push(true, false);
    const roll = stepContext({ actor: hero, item: ruleItem(), targets: [one, two] });
    await runSteps([{ do: 'rollVsEach', skill: 'intimidation', defense: 'willpower', onHit: [{ do: 'mark', to: 'target', key: 'cowed' }], onMiss: [{ do: 'chat', text: 'shrugs {target}' }] }], roll);
    expect(one.flags.essence20.ruleMarks.cowed).toBeTruthy();
    expect(two.flags.essence20.ruleMarks).toBeUndefined();
    expect(roll.chat).toContain('shrugs Two');
    expect(roll.vars.hits).toBe(1);
    expect(stepErrors([{ do: 'rollVsEach' }, { do: 'spendAction', action: 'big' }])).toHaveLength(2);
  });
});

describe('formulas and events', () => {
  test('@sum.equippedTrait; droppedToZero; afterRoll @var.skill', async () => {
    const vest = { id: 'v', type: 'armor', system: { equipped: true, traits: ['computerized'], evasion: 2 } };
    const coat = { id: 'c', type: 'armor', system: { equipped: true, traits: [], evasion: 3 } };
    const hero = makeActor('Hero', [vest, coat, { id: 'p', name: 'Watcher', type: 'perk', flags: {}, system: { rules: [
      { type: 'Trigger', event: 'droppedToZero', steps: [{ do: 'chat', text: 'zero {var.resource}' }] },
    ] } }]);
    expect(resolveValue('@sum.equippedTrait.computerized.armor.system.evasion', { actor: hero })).toBe(2);
    rebuildIndex(hero);
    const seen = [];
    ChatMessage.create = jest.fn(async data => seen.push(data.content));
    const options = {};
    hooks.preUpdateActor.forEach(fn => fn(hero, {}, options));
    hero.system.powers.personal.value = 0;
    await Promise.all(hooks.updateActor.map(fn => fn(hero, { system: { powers: { personal: { value: 0 } } } }, options, 'u')));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(seen.join(' ')).toContain('zero power');
  });
});
