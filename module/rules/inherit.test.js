import { jest } from '@jest/globals';
import { inheritedRules, linkExistingCopies, linkUpdates, rulesAreInherited, rulesSnapshotToStrip, uniqueRuleItems } from './inherit.mjs';
import { registerRuleHelper, ruleHelper, ruleHelperNames } from './code.mjs';
import { rebuildIndex } from './index.mjs';
import { applyRuleSwitches, rememberedSwitch, ruleDamageDealt, ruleDamageTaken, ruleDefenseAdjust, ruleDerived, ruleDialogSwitches, ruleRollSources } from './adapter.mjs';
import { validateRule } from './types.mjs';
import { rulesContext } from './sheet.mjs';

const RULE = { type: 'RollModifier', upshift: 1 };
const ORIGINALS = { 'Compendium.e.p.Item.a': { system: { rules: [RULE] } }, 'Compendium.e.p.Item.empty': { system: { rules: [] } } };
const lookup = uuid => ORIGINALS[uuid] ?? null;

let nextId = 1;

function makeActor(items, extra = {}) {
  const actor = { id: `a${nextId++}`, type: 'playerCharacter', statuses: new Set(), system: { level: 1, defenses: { toughness: { total: 10 } } }, flags: {}, ...extra };
  actor.items = { contents: items, get: id => items.find(item => item.id == id), [Symbol.iterator]: () => items[Symbol.iterator]() };
  for (const item of items) {
    item.parent = actor;
  }

  return actor;
}

describe('inheritance', () => {
  test('own rules win; otherwise the compendium original; otherwise none', () => {
    expect(inheritedRules({ _source: { system: { rules: [{ type: 'Toggle', key: 'k' }] } }, _stats: { compendiumSource: 'Compendium.e.p.Item.a' } }, lookup)).toEqual([{ type: 'Toggle', key: 'k' }]);
    expect(inheritedRules({ _source: { system: { rules: [] } }, _stats: { compendiumSource: 'Compendium.e.p.Item.a' } }, lookup)).toEqual([RULE]);
    expect(inheritedRules({ _source: { system: { rules: [] } }, flags: { core: { sourceId: 'Compendium.e.p.Item.a' } } }, lookup)).toEqual([RULE]);
    expect(inheritedRules({ _source: { system: { rules: [] } }, flags: { essence20: { rulesSource: 'Compendium.e.p.Item.a' } } }, lookup)).toEqual([RULE]);
    expect(inheritedRules({ _source: { system: { rules: [] } }, _stats: { compendiumSource: 'Compendium.e.p.Item.empty' } }, lookup)).toEqual([]);
    expect(inheritedRules({ _source: { system: { rules: [] } }, _stats: { compendiumSource: 'Item.world' } }, lookup)).toEqual([]);
    expect(inheritedRules({ pack: 'x', _source: { system: {} }, _stats: { compendiumSource: 'Compendium.e.p.Item.a' } }, lookup)).toEqual([]);
    expect(inheritedRules({ _source: { system: { rules: [] } }, _stats: { compendiumSource: 'Compendium.e.p.Item.a' } }, () => {
      throw new Error('boom');
    })).toEqual([]);
    expect(inheritedRules(null)).toEqual([]);
  });

  test('a drop from a compendium sheds its snapshot; the sheet says the rules are inherited', () => {
    expect(rulesSnapshotToStrip({ _stats: { compendiumSource: 'Compendium.x' }, _source: { system: { rules: [RULE] } } })).toBe(true);
    expect(rulesSnapshotToStrip({ _stats: {}, _source: { system: { rules: [RULE] } } })).toBe(false);
    expect(rulesSnapshotToStrip({ _stats: { compendiumSource: 'Compendium.x' }, _source: { system: { rules: [] } } })).toBe(false);
    global.fromUuidSync = lookup;
    expect(rulesAreInherited({ _source: { system: { rules: [] } }, _stats: { compendiumSource: 'Compendium.e.p.Item.a' } })).toBe(true);
    expect(rulesAreInherited({ _source: { system: { rules: [RULE] } }, _stats: { compendiumSource: 'Compendium.e.p.Item.a' } })).toBe(false);
    delete global.fromUuidSync;
  });
});

describe('linking existing copies', () => {
  test('unique names only, per type', () => {
    const map = uniqueRuleItems([
      { uuid: 'U1', name: 'Lifelike', type: 'perk', rules: [RULE] },
      { uuid: 'U2', name: 'Lifelike', type: 'perk', rules: [RULE] },
      { uuid: 'U3', name: 'Whimsical', type: 'hangUp', rules: [RULE] },
      { uuid: 'U3', name: 'Whimsical', type: 'hangUp', rules: [RULE] },
      { uuid: 'U4', name: 'Plain', type: 'perk', rules: [] },
    ]);
    expect([...map]).toEqual([['hangUp|whimsical', 'U3']]);
  });

  test('links items with no rules to a same-named compendium item', () => {
    const byName = new Map([['hangUp|whimsical', 'Compendium.e.p.Item.w']]);
    const items = [
      { id: 'i1', name: ' Whimsical ', type: 'hangUp', _source: { system: { rules: [] } }, flags: {} },
      { id: 'i2', name: 'Whimsical', type: 'perk', _source: { system: { rules: [] } }, flags: {} },
      { id: 'i3', name: 'Whimsical', type: 'hangUp', _source: { system: { rules: [RULE] } }, flags: {} },
      { id: 'i4', name: 'Whimsical', type: 'hangUp', _source: { system: { rules: [] } }, flags: { essence20: { rulesSource: 'Compendium.e.p.Item.w' } } },
    ];
    expect(linkUpdates(items, byName, () => null)).toEqual([{ _id: 'i1', 'flags.essence20.rulesSource': 'Compendium.e.p.Item.w' }]);
    expect(linkUpdates(null, byName)).toEqual([]);

    // A copy of a different printing that still exists keeps its own source.
    const printing = { id: 'i5', name: 'Whimsical', type: 'hangUp', _source: { system: { rules: [] } }, flags: {}, _stats: { compendiumSource: 'Compendium.e.p.Item.other' } };
    expect(linkUpdates([printing], byName, uuid => (uuid == 'Compendium.e.p.Item.other' ? { system: { rules: [] } } : null))).toEqual([]);
    expect(linkUpdates([printing], byName, () => null)).toEqual([{ _id: 'i5', 'flags.essence20.rulesSource': 'Compendium.e.p.Item.w' }]);
  });

  test('the migration runs once per system version, GM only', async () => {
    const copy = { id: 'c1', name: 'Whimsical', type: 'hangUp', _source: { system: { rules: [] } }, flags: {} };
    const actor = { items: [copy], updateEmbeddedDocuments: jest.fn() };
    const settings = { value: '' };
    const pack = { documentName: 'Item', collection: 'essence20.tfcrbitems', getIndex: jest.fn(async () => [{ _id: 'w', name: 'Whimsical', type: 'hangUp', system: { rules: [RULE] } }]) };
    global.game = {
      ...(global.game ?? {}),
      user: { isGM: true },
      system: { version: '6.1.0' },
      packs: [pack, { documentName: 'Actor' }],
      actors: [actor],
      items: [],
      settings: { get: () => settings.value, set: jest.fn(async (scope, key, value) => {
        settings.value = value;
      }) },
    };
    await linkExistingCopies();
    expect(actor.updateEmbeddedDocuments).toHaveBeenCalledWith('Item', [{ _id: 'c1', 'flags.essence20.rulesSource': 'Compendium.essence20.tfcrbitems.Item.w' }]);
    expect(settings.value).toBe('6.1.0|1');

    await linkExistingCopies();
    expect(pack.getIndex).toHaveBeenCalledTimes(1);

    game.user.isGM = false;
    settings.value = '';
    await linkExistingCopies();
    expect(pack.getIndex).toHaveBeenCalledTimes(1);
  });
});

describe('Code rules', () => {
  test('any registered helper can be named, and each hook is called with the rule and item', () => {
    const hooks = {
      rollSources: jest.fn((actor, target, ctx, { item }) => ({ sources: [{ id: 'h', label: item.name, shiftUp: 1 }] })),
      derived: jest.fn(actor => {
        actor.system.defenses.toughness.total += 1;
      }),
      defenseAdjust: jest.fn(() => 2),
      damageTaken: jest.fn(() => 99),
      hitRider: jest.fn(),
    };
    registerRuleHelper('table.custom', hooks);
    registerRuleHelper('table.broken', { rollSources: () => {
      throw new Error('nope');
    } });
    expect(ruleHelper('table.custom')).toBe(hooks);
    expect(ruleHelperNames()).toEqual(expect.arrayContaining(['table.broken', 'table.custom']));
    expect(() => registerRuleHelper('', {})).toThrow();

    const item = { id: 'h1', name: 'House Rule', type: 'perk', flags: {}, system: { rules: [
      { type: 'Code', helper: 'table.custom', bonus: 3 },
      { type: 'Code', helper: 'table.broken' },
      { type: 'Code', helper: 'table.missing' },
      { type: 'Code', helper: 'table.custom', when: ['self:morphed'] },
    ] } };
    const actor = makeActor([item]);
    rebuildIndex(actor);
    jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(ruleRollSources(actor, null, {}).sources).toEqual([{ id: 'h', label: 'House Rule', shiftUp: 1 }]);
    expect(hooks.rollSources.mock.calls[0][3].rule).toMatchObject({ bonus: 3 });
    ruleDerived(actor);
    expect(actor.system.defenses.toughness.total).toBe(11);
    expect(ruleDefenseAdjust(null, actor, 'toughness', {})).toBe(2);
    expect(ruleDamageTaken(actor, 3, 'blunt')).toBe(99);
    ruleDamageDealt(actor, null, {}, {}, {});
    expect(hooks.hitRider).toHaveBeenCalledTimes(1);
    console.error.mockRestore();
  });

  test('a Code rule may carry its own settings; the sheet flags a helper nobody registered', () => {
    expect(validateRule({ type: 'Code', helper: 'x', anything: 1 })).toEqual([]);
    const item = { id: 'h2', name: 'X', type: 'perk', flags: {}, isOwner: true, system: { rules: [{ type: 'Code', helper: 'nobody.home' }] } };
    expect(rulesContext(item).rules[0].errors).toEqual(['no helper named "nobody.home" is registered']);
  });
});

describe('remembered switches', () => {
  test('a switch starts where this actor last left it, and changes are remembered', async () => {
    const item = { id: 's1', name: 'Situational', type: 'perk', flags: {}, system: { rules: [
      { type: 'DialogSwitch', label: 'A', upshift: 1, default: true },
      { type: 'RollModifier', label: 'B', when: ['ask:x'], snag: true },
    ] } };
    const actor = makeActor([item], { isOwner: true, update: jest.fn() });
    rebuildIndex(actor);
    global.game = { ...(global.game ?? {}), combat: null, user: { targets: new Set() } };
    expect(ruleDialogSwitches(actor, {}).map(s => s.value)).toEqual([true, false]);

    const options = { ext: { 'rule-s1-0': false, 'rule-s1-1': true } };
    await applyRuleSwitches(actor, options, {});
    expect(options).toMatchObject({ snag: true });
    expect(actor.update).toHaveBeenCalledWith({ 'flags.essence20.ruleSwitches.rule-s1-0': false, 'flags.essence20.ruleSwitches.rule-s1-1': true });

    actor.flags = { essence20: { ruleSwitches: { 'rule-s1-0': false, 'rule-s1-1': true } } };
    expect(rememberedSwitch(actor, 'rule-s1-0')).toBe(false);
    expect(ruleDialogSwitches(actor, {}).map(s => s.value)).toEqual([false, true]);
    actor.update.mockClear();
    await applyRuleSwitches(actor, { ext: { 'rule-s1-1': true } }, {});
    expect(actor.update).not.toHaveBeenCalled();
  });
});
