import { jest } from '@jest/globals';

/** House rules (rules/house-rules.mjs): registered by modules, switched on per world, held by every actor. */

await import('./plugins/index.mjs');
const { collectRules, rebuildIndex, rulesOfType } = await import('./index.mjs');
const { houseRule, houseRuleEnabled, houseRuleEntries, houseRuleHolder, houseRules, refreshHouseRuleActors, registerHouseRule, syncWorldHouseRules, unregisterHouseRule, worldHouseRules } = await import('./house-rules.mjs');

const initiativeEdge = { type: 'RollModifier', label: 'Heroic Initiative', edge: true, when: ['skill:initiative'] };

function makeActor(name = 'Hero') {
  const items = [];
  return {
    id: name, uuid: `Actor.${name}`, name, type: 'playerCharacter', flags: {}, system: {},
    items: { contents: items, get: () => null, [Symbol.iterator]: () => items[Symbol.iterator]() },
  };
}

let chosen;
let worldList;
beforeEach(() => {
  chosen = {};
  worldList = [];
  global.game = { ready: false, settings: { get: (scope, key) => (key == 'houseRules' ? chosen : key == 'worldHouseRules' ? worldList : undefined) } };
});

afterEach(() => {
  delete global.game;
});

describe('registering', () => {
  test('stores a definition; a bad id, a missing label or non-array rules throw', () => {
    const stored = registerHouseRule({ id: 'test-initiative', label: 'Heroic Initiative', hint: 'Everyone acts boldly.', module: 'essence20-homebrew', rules: [initiativeEdge] });
    expect(stored).toMatchObject({ id: 'test-initiative', module: 'essence20-homebrew', default: false, rules: [initiativeEdge] });
    expect(houseRules().map(rule => rule.id)).toContain('test-initiative');
    expect(() => registerHouseRule({ id: 'has space', label: 'x' })).toThrow(/letters/);
    expect(() => registerHouseRule({ id: 'no-label' })).toThrow(/label/);
    expect(() => registerHouseRule({ id: 'bad-rules', label: 'x', rules: {} })).toThrow(/array/);
  });

  test("on by the world's choice, else by its default; an unknown id is off", () => {
    registerHouseRule({ id: 'test-default-on', label: 'On', default: true });
    expect(houseRuleEnabled('test-default-on')).toBe(true);
    chosen['test-default-on'] = false;
    expect(houseRuleEnabled('test-default-on')).toBe(false);
    expect(houseRuleEnabled('test-initiative')).toBe(false);
    chosen['test-initiative'] = true;
    expect(houseRuleEnabled('test-initiative')).toBe(true);
    expect(houseRuleEnabled('nobody')).toBe(false);
  });

  test('registered once the world is running: actors are refreshed', () => {
    const actor = { reset: jest.fn(), sheet: { rendered: true, render: jest.fn() } };
    global.game.ready = true;
    global.game.actors = [actor];
    global.game.scenes = [];
    registerHouseRule({ id: 'test-late', label: 'Late' });
    expect(actor.reset).toHaveBeenCalled();
    expect(actor.sheet.render).toHaveBeenCalled();
  });
});

describe('every actor holds the enabled ones', () => {
  test("an enabled house rule's rules join the actor's index on a stand-in item named after it", () => {
    registerHouseRule({ id: 'test-initiative', label: 'Heroic Initiative', module: 'essence20-homebrew', rules: [initiativeEdge] });
    const actor = makeActor();
    expect(collectRules(actor).RollModifier ?? []).toEqual([]);

    chosen['test-initiative'] = true;
    rebuildIndex(actor);
    const [entry] = rulesOfType(actor, 'RollModifier');
    expect(entry.rule).toBe(initiativeEdge);
    expect(entry.item).toMatchObject({ name: 'Heroic Initiative', type: 'houseRule', isHouseRule: true, parent: actor });
  });

  test('the stand-in item is kept per actor, keeps its flags in memory, and follows a re-registration', async () => {
    const definition = registerHouseRule({ id: 'test-holder', label: 'Old', rules: [initiativeEdge] });
    const actor = makeActor();
    const holder = houseRuleHolder(actor, definition);
    expect(houseRuleHolder(actor, definition)).toBe(holder);
    expect(houseRuleHolder(makeActor('Other'), definition)).not.toBe(holder);
    await holder.setFlag('essence20', 'rules.toggles.a', true);
    expect(holder.getFlag('essence20', 'rules.toggles.a')).toBe(true);
    await holder.unsetFlag('essence20', 'rules.toggles.a');
    expect(holder.getFlag('essence20', 'rules.toggles.a')).toBeUndefined();

    const renamed = registerHouseRule({ id: 'test-holder', label: 'New', rules: [] });
    expect(houseRuleHolder(actor, renamed)).toBe(holder);
    expect(holder.name).toBe('New');
  });

  test('a switch-only house rule (no rules) and a disabled one add nothing; an unknown rule type is skipped', () => {
    registerHouseRule({ id: 'test-switch', label: 'Code only' });
    registerHouseRule({ id: 'test-odd', label: 'Odd', rules: [{ type: 'NotARuleType' }] });
    chosen['test-switch'] = true;
    chosen['test-odd'] = true;
    chosen['test-initiative'] = false;
    const actor = makeActor();
    expect(houseRuleEntries(actor).map(entry => entry.item.name)).toContain('Odd');
    expect(Object.values(collectRules(actor)).flat().some(entry => entry.item?.isHouseRule)).toBe(false);
    expect(houseRuleEntries(null)).toEqual([]);
  });

  test('switching refreshes world actors and unlinked tokens, once each', () => {
    const world = { reset: jest.fn(), sheet: { rendered: false } };
    const token = { reset: jest.fn() };
    global.game.actors = [world];
    global.game.scenes = [{ tokens: [{ actorLink: false, actor: token }, { actorLink: true, actor: world }] }];
    refreshHouseRuleActors();
    expect(world.reset).toHaveBeenCalledTimes(1);
    expect(token.reset).toHaveBeenCalledTimes(1);
  });
});

describe("the world's own house rules", () => {
  test('loaded from the setting, marked world and grouped as the world; deleted ones go; a bad one is skipped', () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    worldList = [
      { id: 'world-abc', label: 'Tough Crowd', hint: 'Everyone gets +1 Toughness.', rules: [{ type: 'DefenseModifier', defense: 'toughness', amount: 1 }] },
      { id: 'bad id', label: 'Broken' },
    ];
    expect(worldHouseRules()).toHaveLength(2);
    syncWorldHouseRules();
    expect(houseRule('world-abc')).toMatchObject({ world: true, module: '', label: 'Tough Crowd' });
    expect(houseRule('bad id')).toBeNull();
    expect(error).toHaveBeenCalled();
    error.mockRestore();

    chosen['world-abc'] = true;
    expect(houseRuleEntries(makeActor()).map(entry => entry.item.name)).toContain('Tough Crowd');

    syncWorldHouseRules([]);
    expect(houseRule('world-abc')).toBeNull();
    // A module's house rule isn't touched by the world's list.
    expect(houseRule('test-initiative')).not.toBeNull();
  });

  test('unregister removes one; a missing setting reads as none', () => {
    registerHouseRule({ id: 'test-gone', label: 'Gone' });
    expect(unregisterHouseRule('test-gone')).toBe(true);
    expect(unregisterHouseRule('test-gone')).toBe(false);
    global.game.settings.get = () => {
      throw new Error('not registered');
    };

    expect(worldHouseRules()).toEqual([]);
  });
});
