import { jest } from '@jest/globals';

// Round-4 engine pieces (docs/RULES_CONVERSION_GUIDE.md, "Engine features added 2026-10-05 (round 4)").

const copies = [];
jest.unstable_mockModule('./sheet-handlers/attachment-handler.mjs', () => ({
  ...Object.fromEntries(['onAttachableParentDrop', 'onEquipmentPackageDrop', 'grantItemEntry', 'onAttachmentDrop', '_attachSelectedItemOptionHandler',
    '_attachItem', 'grantLinkedWeaponEffect', 'createEntry', '_addItemIfUnique', 'deleteAttachmentsForItem'].map(name => [name, jest.fn()])),
  setEntryAndAddItem: jest.fn(async () => 'k1'),
  createItemCopies: jest.fn(async (items, owner, type, host) => {
    for (const entry of Object.values(items ?? {}).filter(e => e.type == type)) {
      const child = { id: `c${copies.length}`, name: entry.name, type, flags: { essence20: { parentId: host.id } } };
      copies.push(child);
      owner.items.contents.push(child);
    }
  }),
}));

const { contextFor, evaluateTag } = await import('./predicate.mjs');
const { isExpired, stampFor, isValidUntil } = await import('./expiry.mjs');
const { resolveValue } = await import('./formula.mjs');
const { runSteps, stepContext, stepErrors, recipients } = await import('./steps.mjs');
const { attachGrantedChildren } = await import('./lifecycle.mjs');
const { legacyChoiceUpdates } = await import('./legacy-choices.mjs');
const { fireTriggers } = await import('./triggers.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { validateRule } = await import('./types.mjs');

/** foundry.utils.setProperty, for plain objects. */
function setPath(object, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((at, key) => (at[key] ??= {}), object)[last] = value;
}

let nextId = 1;
function makeActor(name, items = [], extra = {}) {
  const actor = {
    id: `a${nextId++}`, name, type: 'playerCharacter', isOwner: true, flags: { essence20: {} }, statuses: new Set(),
    system: { health: { value: 5, max: 10 }, essences: { strength: { value: 3, max: 4 }, speed: { value: 2, max: 2 }, smarts: { value: 1, max: 3 }, social: { value: 2, max: 2 } } },
    ...extra,
    async update(data) {
      for (const [key, value] of Object.entries(data)) {
        setPath(this, key, value);
      }
    },
    async createEmbeddedDocuments(type, datas) {
      const made = datas.map(data => ({ ...data, id: `n${nextId++}`, parent: this, flags: data.flags ?? {} }));
      this.items.contents.push(...made);
      return made;
    },
    async updateEmbeddedDocuments(type, updates) {
      for (const { _id, ...rest } of updates) {
        const item = this.items.contents.find(i => i.id == _id);
        for (const [key, value] of Object.entries(rest)) {
          setPath(item, key, value);
        }
      }
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

beforeEach(() => {
  copies.length = 0;
  global.game = {
    combat: null, combats: { get: () => null }, user: { id: 'u', isGM: true, targets: new Set() }, actors: { contents: [] }, settings: { get: () => 1 },
    i18n: { localize: key => key, format: (key, data) => `${key} ${JSON.stringify(data)}` },
  };
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.foundry = { ...(global.foundry ?? {}), utils: { ...(global.foundry?.utils ?? {}), setProperty: setPath, getProperty: (o, k) => k.split('.').reduce((at, key) => at?.[key], o) } };
});

describe('tags: wielding, combat:exists', () => {
  test('wielding[:tag] - an attack of an equipped weapon, narrowed by any tag asked of that attack', () => {
    const rifle = { id: 'w1', type: 'weapon', system: { equipped: true, traits: ['ballistic'] }, flags: {} };
    const shot = { id: 'e1', type: 'weaponEffect', system: { classification: { skill: 'targeting', style: 'ranged' } }, flags: { essence20: { parentId: 'w1' } } };
    const sword = { id: 'w2', type: 'weapon', system: { equipped: false, traits: [] }, flags: {} };
    const slash = { id: 'e2', type: 'weaponEffect', system: { classification: { skill: 'finesse', style: 'melee' } }, flags: { essence20: { parentId: 'w2' } } };
    const punch = { id: 'e3', type: 'weaponEffect', system: { classification: { skill: 'might' } }, flags: {} };
    const hero = makeActor('Hero', [rifle, shot, sword, slash, punch]);
    const ctx = contextFor({ self: hero, other: hero });
    expect(evaluateTag('self:wielding', ctx)).toBe(true);
    expect(evaluateTag('self:wielding:weapon:trait:ballistic', ctx)).toBe(true);
    expect(evaluateTag('self:wielding:item:data:system.classification.skill=targeting', ctx)).toBe(true);
    // The Finesse sword isn't equipped; an unarmed punch doesn't count.
    expect(evaluateTag('self:wielding:item:data:system.classification.skill=finesse', ctx)).toBe(false);
    expect(evaluateTag('target:wielding:item:data:system.classification.skill=might', ctx)).toBe(false);
    expect(evaluateTag('self:wielding', contextFor({ self: makeActor('Bare', [punch]) }))).toBe(false);
  });

  test('combat:exists holds for an unstarted combat; `combat` (bare) needs it started', () => {
    expect(evaluateTag('combat:exists', contextFor({ combat: { started: false } }))).toBe(true);
    expect(evaluateTag('combat', contextFor({ combat: { started: false } }))).toBe(false);
    expect(evaluateTag('combat:exists', contextFor({ combat: null }))).toBe(false);
  });
});

describe('until: combat, marks with counts', () => {
  test('until combat lasts while that combat exists, started or not', () => {
    expect(isValidUntil('combat')).toBe(true);
    const combat = { id: 'c1', started: false };
    const entry = { until: 'combat', stamp: stampFor('combat', combat) };
    global.game.combats = { get: id => (id == 'c1' ? combat : null) };
    expect(isExpired(entry, combat)).toBe(false);
    global.game.combats = { get: () => null };
    expect(isExpired(entry, null)).toBe(true);
    expect(stampFor('combat', null)).toBeNull();
  });

  test('a mark keeps a count (@mark.<key>, @target.mark.<key>); add: true stacks it', async () => {
    const hero = makeActor('Hero');
    const foe = makeActor('Foe');
    const ctx = stepContext({ actor: hero, item: { id: 'i', name: 'Loaded Questions' }, targets: [foe] });
    await runSteps([{ do: 'mark', to: 'target', key: 'q', count: 1, add: true, until: 'scene' }], ctx);
    await runSteps([{ do: 'mark', to: 'target', key: 'q', count: 2, add: true, until: 'scene' }], ctx);
    expect(resolveValue('@mark.q', { actor: foe })).toBe(3);
    expect(resolveValue('@target.mark.q', { actor: hero, other: foe })).toBe(3);
    // Without add, it starts over.
    await runSteps([{ do: 'mark', to: 'target', key: 'q', count: 1 }], ctx);
    expect(resolveValue('@mark.q', { actor: foe })).toBe(1);
    expect(resolveValue('@mark.none', { actor: foe })).toBe(0);
  });
});

describe('Essence and Condition steps', () => {
  test('essenceDamage (named, {choice}, choose) and healEssence (named, most-damaged first)', async () => {
    const hero = makeActor('Hero');
    const ctx = stepContext({ actor: hero, item: { name: 'Tox', flags: { essence20: { rules: { choices: { e: 'speed' } } } } }, targets: [] });
    ctx.askPick = jest.fn(async () => 'social');
    await runSteps([{ do: 'essenceDamage', essence: 'strength', amount: 2 }, { do: 'essenceDamage', essence: '{choice.e}' }, { do: 'essenceDamage', essence: 'choose' }], ctx);
    expect([hero.system.essences.strength.value, hero.system.essences.speed.value, hero.system.essences.social.value]).toEqual([1, 1, 1]);
    // Never below 0.
    await runSteps([{ do: 'essenceDamage', essence: 'smarts', amount: 5 }], ctx);
    expect(hero.system.essences.smarts.value).toBe(0);
    await runSteps([{ do: 'healEssence', essence: 'strength', amount: 9 }], ctx);
    expect(hero.system.essences.strength.value).toBe(4);
    expect(stepErrors([{ do: 'essenceDamage', essence: 'luck' }, { do: 'healEssence' }, { do: 'extendCondition' }])).toHaveLength(2);
  });

  test('extendCondition adds rounds to a timed Condition and leaves an untimed one alone', async () => {
    const timed = { statuses: new Set(['stunned']), duration: { rounds: 1 }, async update(data) {
      setPath(this, 'duration.rounds', data['duration.rounds']);
    } };
    const open = { statuses: new Set(['frightened']), duration: {}, update: jest.fn() };
    const foe = makeActor('Foe', [], { effects: { contents: [timed, open] } });
    const ctx = stepContext({ actor: makeActor('Hero'), item: { name: 'Opportunist' }, targets: [foe] });
    await runSteps([{ do: 'extendCondition', to: 'target', condition: 'stunned', rounds: 2 }, { do: 'extendCondition', to: 'target', condition: 'frightened' }], ctx);
    expect(timed.duration.rounds).toBe(3);
    expect(open.update).not.toHaveBeenCalled();
  });
});

describe('recipient filter, grant options, granted children', () => {
  test('filter keeps only recipients meeting its target: tags', () => {
    const near = makeActor('Enemy', [], { type: 'npc' });
    const ally = makeActor('Ally');
    const ctx = stepContext({ actor: makeActor('Hero'), item: { name: 'Watchful Eyes' }, targets: [near, ally] });
    expect(recipients({ to: 'targets', filter: ['target:type:npc'] }, ctx)).toEqual([near]);
    expect(stepErrors([{ do: 'mark', key: 'x', filter: 'target:type:npc' }])).toHaveLength(1);
  });

  test('grant: name ({choice}), integrated, systemFormulas (formula or tags); its attachments carry grantedBy', async () => {
    const source = { name: 'Rotor Blades', toObject: () => ({ name: 'Rotor Blades', type: 'weapon', system: { traits: ['sharp'], items: { a: { type: 'weaponEffect', name: 'Slash' } } }, flags: {} }) };
    global.fromUuid = async () => source;
    const hero = makeActor('Hero', [], { system: { level: 3, isTransformed: true } });
    const perk = { id: 'p1', name: 'Gear', flags: { essence20: { rules: { choices: { mode: 'Alt' } } } } };
    const ctx = stepContext({ actor: hero, item: perk, targets: [] });
    await runSteps([{ do: 'grant', uuid: 'Compendium.x.Item.y', name: '{choice.mode} Blades', integrated: true, systemFormulas: { 'damageValue': '@level + 1', equipped: ['self:data:system.isTransformed'] } }], ctx);
    const [made] = hero.items.contents;
    expect(made.name).toBe('Alt Blades');
    expect(made.system).toMatchObject({ traits: ['sharp'], classification: { size: 'integrated' }, damageValue: 4, equipped: true });
    expect(made.flags.essence20.grantedBy).toBe('p1');
    const child = hero.items.contents.find(i => i.type == 'weaponEffect');
    expect(child.flags.essence20).toMatchObject({ parentId: made.id, grantedBy: 'p1' });
    expect(ctx.chat.join(' ')).toContain('Alt Blades');
    delete global.fromUuid;
  });

  test('attachGrantedChildren leaves children of an ungranted host alone', async () => {
    const hero = makeActor('Hero');
    const [rifle] = await hero.createEmbeddedDocuments('Item', [{ name: 'Rifle', type: 'weapon', system: { items: { a: { type: 'weaponEffect', name: 'Shot' } } } }]);
    await attachGrantedChildren(hero, [rifle]);
    expect(hero.items.contents.find(i => i.type == 'weaponEffect').flags.essence20.grantedBy).toBeUndefined();
  });
});

describe('Trigger outcomes and toggle legacy', () => {
  test('an outcome list needs every one; plainSuccess is a success that is not a crit or double', async () => {
    const both = { type: 'Trigger', event: 'afterRoll', outcome: ['fumbled', 'allFailed'], steps: [{ do: 'mark', key: 'loss' }] };
    const plain = { type: 'Trigger', event: 'afterRoll', outcome: 'plainSuccess', steps: [{ do: 'mark', key: 'plain' }] };
    expect(validateRule(both)).toEqual([]);
    expect(validateRule({ ...both, outcome: ['fumbled', 'nope'] })).toHaveLength(1);
    const hero = makeActor('Hero', [{ id: 'p', name: 'P', type: 'perk', flags: {}, system: { rules: [both, plain] } }]);
    rebuildIndex(hero);
    // A Fumble that still succeeded on a row: not both.
    await fireTriggers(hero, 'afterRoll', { outcome: 'fumble', facts: { isFumble: true, results: [{ success: true }] }, prompt: async () => true });
    expect(hero.flags.essence20.ruleMarks?.loss).toBeUndefined();
    await fireTriggers(hero, 'afterRoll', { outcome: 'fumble', facts: { isFumble: true, results: [{ success: false }] }, prompt: async () => true });
    expect(hero.flags.essence20.ruleMarks.loss).toBeTruthy();
    await fireTriggers(hero, 'afterRoll', { outcome: 'double', facts: { results: [{ success: true, multiplier: 2 }] } });
    expect(hero.flags.essence20.ruleMarks.plain).toBeUndefined();
    await fireTriggers(hero, 'afterRoll', { outcome: 'success', facts: { results: [{ success: true, multiplier: 1 }] } });
    expect(hero.flags.essence20.ruleMarks.plain).toBeTruthy();
  });

  test('a Toggle rule with `legacy` moves its old flag into rules.toggles, never over a set state', () => {
    const fresh = { id: 'g1', flags: { essence20: { ghostHidden: true } }, system: { rules: [{ type: 'Toggle', key: 'hidden', legacy: 'flags.essence20.ghostHidden' }] } };
    const set = { id: 'g2', flags: { essence20: { ghostHidden: true, rules: { toggles: { hidden: false } } } }, system: { rules: [{ type: 'Toggle', key: 'hidden', legacy: 'flags.essence20.ghostHidden' }] } };
    const actor = { items: [fresh, set] };
    expect(legacyChoiceUpdates(actor)).toEqual([{ _id: 'g1', 'flags.essence20.rules.toggles.hidden': true }]);
  });
});

describe('roll step: snag and open', () => {
  test('snag goes to the roll; an open roll runs `then` with @var.rollTotal and stops when cancelled', async () => {
    const calls = [];
    const hero = makeActor('Hero');
    hero._dice = { rollSkill: jest.fn(async dataset => {
      calls.push(dataset);
      return dataset.skill == 'cancel' ? null : { success: true, total: 14, outcomes: [{ results: [{ success: true, multiplier: 1, total: 14 }] }] };
    }) };
    global.CONFIG = { E20: { skillToEssence: { alertness: 'smarts' } } };
    const ctx = stepContext({ actor: hero, item: { name: 'Picking Up the Trail' }, targets: [] });
    expect(await runSteps([{ do: 'roll', skill: 'alertness', open: true, snag: true, then: [{ do: 'chat', text: 'got {var.rollTotal}' }] }], ctx)).not.toBe(false);
    expect(calls[0]).toMatchObject({ skill: 'alertness', essence: 'smarts', snag: true });
    expect(calls[0].dif).toBeUndefined();
    expect(ctx.chat).toContain('got 14');
    expect(await runSteps([{ do: 'roll', skill: 'cancel', open: true, then: [{ do: 'chat', text: 'no' }] }], ctx)).toBe(false);
    delete global.CONFIG;
  });
});
