import { jest } from '@jest/globals';

/**
 * Round 17, perm (docs/rules-batches/slPerm17.md): the engine pieces this part added, on their own. The items that use
 * them are in rules/conv17-perm.test.js.
 */

global.Hooks = { on: () => {}, once: () => {}, callAll: () => {} };

jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn() }));
jest.unstable_mockModule('./mechanics/combat/combat.mjs', () => ({ getDefenseValue: (actor, key) => Number(actor.system?.defenses?.[key]?.total) || 0 }));

await import('./plugins/index.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { runSteps, stepContext } = await import('./steps.mjs');
const { validateRule } = await import('./types.mjs');
const { ruleCritD2, ruleDieSubstitution } = await import('./adapter.mjs');
const { runPreRoll } = await import('../mechanics/item-hooks.mjs');
const { rollSeen } = await import('./plugins/tags/world-watch.mjs');

function setPath(object, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const node = keys.reduce((at, key) => (at[key] ??= {}), object);
  if (last.startsWith('-=')) {
    delete node[last.slice(2)];
  } else {
    node[last] = value;
  }
}

let nextId = 1;
/** An actor whose items carry `rules` (one item per list). */
function actor(name, ruleLists = [], { system = {}, items = [] } = {}) {
  const made = {
    id: `a${nextId++}`, name, type: 'playerCharacter', flags: { essence20: {} }, statuses: new Set(),
    system: {
      skills: { technology: { shift: 'd4' }, culture: { shift: 'd10' } },
      defenses: { toughness: { total: 10 }, evasion: { total: 14 }, willpower: { total: 14 }, cleverness: { total: 9 } }, ...system,
    },
    async update(data) {
      for (const [key, value] of Object.entries(data)) {
        setPath(this, key, value);
      }
    },
    getRollData() {
      return { skills: this.system.skills };
    },
  };
  made.uuid = `Actor.${made.id}`;
  const list = [
    ...ruleLists.map(rules => ({ name: `${name}'s item`, type: 'perk', flags: {}, system: { rules } })),
    ...items,
  ].map(data => ({ id: `i${nextId++}`, parent: made, ...data }));
  list.forEach(item => {
    item.uuid = `${made.uuid}.Item.${item.id}`;
  });
  made.items = { contents: list, get: id => list.find(item => item.id == id), [Symbol.iterator]: () => list[Symbol.iterator]() };
  rebuildIndex(made);
  return made;
}

function world(...actors) {
  const docs = new Map(actors.map(one => [one.uuid, one]));
  global.fromUuidSync = uuid => docs.get(uuid) ?? null;
  global.fromUuid = async uuid => docs.get(uuid) ?? null;
  global.game.actors = { contents: actors, get: id => actors.find(one => one.id == id) ?? null, [Symbol.iterator]: () => actors[Symbol.iterator]() };
}

beforeEach(() => {
  global.game = {
    combat: null, user: { targets: new Set() }, settings: { get: () => 1 },
    i18n: { localize: key => `L:${key}`, format: (key, data) => `F:${key}:${JSON.stringify(data)}`, has: () => true },
  };
  global.CONFIG = { ...(global.CONFIG ?? {}), E20: { ...(global.CONFIG?.E20 ?? {}), skillShiftList: ['3d6', '2d6', 'd12', 'd10', 'd8', 'd6', 'd4', 'd2', 'd20'] } };
  global.foundry = { ...global.foundry, utils: { ...(global.foundry?.utils ?? {}), getProperty: (o, p) => p.split('.').reduce((at, k) => at?.[k], o), setProperty: setPath } };
  global.ChatMessage = { create: jest.fn(async data => data), getSpeaker: () => ({}) };
});

describe('DieSubstitution / CritOnD2 carried by a mark', () => {
  test('validation: scope marked needs a mark, a mark needs scope marked, dieOf is self | holder', () => {
    expect(validateRule({ type: 'CritOnD2', scope: 'marked', mark: 'm' })).toEqual([]);
    expect(validateRule({ type: 'CritOnD2', scope: 'marked' })).toEqual(['scope marked needs mark (the mark\'s key)']);
    expect(validateRule({ type: 'CritOnD2', mark: 'm' })).toEqual(['mark only goes with scope marked']);
    expect(validateRule({ type: 'DieSubstitution', mode: 'best', skills: ['technology'], dieOf: 'holder', scope: 'marked', mark: 'm' })).toEqual([]);
    expect(validateRule({ type: 'DieSubstitution', mode: 'best', skills: ['technology'], dieOf: 'them' }).length).toBe(1);
  });

  test('the setter\'s rules reach whoever carries its mark, the dice read off the setter with dieOf: holder', async () => {
    const setter = actor('Setter', [[
      { type: 'DieSubstitution', mode: 'best', skills: ['culture'], dieOf: 'holder', scope: 'marked', mark: 'm' },
      { type: 'CritOnD2', scope: 'marked', mark: 'm', when: ['skill:culture'] },
    ]], { system: { skills: { culture: { shift: 'd12' } } } });
    const carrier = actor('Carrier');
    world(setter, carrier);
    const roll = { rolledSkill: 'culture', dataset: {} };
    expect(ruleDieSubstitution(carrier, null, roll, 'd10').shift).toBe('d10');
    expect(ruleCritD2(carrier, null, roll)).toBe(false);
    carrier.flags.essence20.ruleMarks = { m: { by: setter.uuid, until: null } };
    expect(ruleDieSubstitution(carrier, null, roll, 'd10').shift).toBe('d12');
    expect(ruleCritD2(carrier, null, roll)).toBe(true);
    expect(ruleCritD2(carrier, null, { ...roll, rolledSkill: 'technology' })).toBe(false);
    // The setter's own rolls don't get its marked rules.
    expect(ruleCritD2(setter, null, roll)).toBe(false);
  });

  test('dieOf: holder on the actor\'s own rule is its own dice', () => {
    const self = actor('Self', [[{ type: 'DieSubstitution', mode: 'best', skills: ['culture'], dieOf: 'holder' }]]);
    world(self);
    expect(ruleDieSubstitution(self, null, { rolledSkill: 'technology', dataset: {} }, 'd4').shift).toBe('d10');
  });
});

describe('mark {by: holder} and beforeRoll Triggers carried by a mark', () => {
  test('a mark set by a carried Trigger names the holder as its setter; without by, the actor running it', async () => {
    const holder = actor('Holder', [[{ type: 'Trigger', event: 'beforeRoll', scope: 'marked', mark: 'pending', when: ['skill:culture'],
      steps: [{ do: 'mark', key: 'started', to: 'self', by: 'holder' }, { do: 'mark', key: 'plain', to: 'self' }] }]]);
    const carrier = actor('Carrier');
    world(holder, carrier);
    await runPreRoll(carrier, { skill: 'culture' }, null);
    expect(carrier.flags.essence20.ruleMarks).toBeUndefined();
    carrier.flags.essence20.ruleMarks = { pending: { by: holder.uuid, until: null } };
    await runPreRoll(carrier, { skill: 'technology' }, null);
    expect(carrier.flags.essence20.ruleMarks.started).toBeUndefined();
    await runPreRoll(carrier, { skill: 'culture' }, null);
    expect(carrier.flags.essence20.ruleMarks.started.by).toBe(holder.uuid);
    expect(carrier.flags.essence20.ruleMarks.plain.by).toBe(carrier.uuid);
  });
});

describe('attackFacts, {lang.<Key>}, defenseFacts name and value', () => {
  const weapon = (name, damageValue) => ({ name, type: 'weaponEffect', flags: {}, system: { damageValue } });

  test('attackFacts: the most damaging attack (the first on a tie), none known, no target stops', async () => {
    const me = actor('Me');
    const foe = actor('Foe', [], { items: [weapon('Jab', 1), weapon('Blast', 4), weapon('Beam', 4)] });
    const bare = actor('Bare');
    world(me, foe, bare);
    let ctx = stepContext({ actor: me, item: me.items.contents[0], targets: [foe] });
    await runSteps([{ do: 'attackFacts' }], ctx);
    expect(ctx.vars).toEqual(expect.objectContaining({ attackName: 'Blast', attackDamage: 4 }));
    ctx = stepContext({ actor: me, targets: [bare] });
    await runSteps([{ do: 'attackFacts' }], ctx);
    expect(ctx.vars).toEqual(expect.objectContaining({ attackName: 'L:E20.ChronoFileAccessNoAttacks', attackDamage: 0 }));
    ctx = stepContext({ actor: foe, targets: [] });
    expect(await runSteps([{ do: 'attackFacts' }, { do: 'chat', text: 'after' }], ctx)).toBe(false);
    expect(ctx.chat.join(' ')).not.toContain('after');
    ctx = stepContext({ actor: foe, targets: [] });
    await runSteps([{ do: 'attackFacts', of: 'self' }], ctx);
    expect(ctx.vars.attackName).toBe('Blast');
  });

  test('defenseFacts keeps the highest Defense\'s name and value; {lang.X} formats with the vars, {name} and {target}', async () => {
    const me = actor('Me');
    const foe = actor('Foe');
    world(me, foe);
    const ctx = stepContext({ actor: me, targets: [foe] });
    await runSteps([{ do: 'defenseFacts' }, { do: 'chat', text: '{lang.Report} / {lang.bad key}' }], ctx);
    expect(ctx.vars).toEqual(expect.objectContaining({ highestDefense: 'evasion', highestDefenseName: 'Evasion', highestDefenseValue: 14 }));
    expect(ctx.chat[0]).toContain('F:E20.Report:');
    expect(ctx.chat[0]).toContain('&quot;highestDefenseName&quot;:&quot;Evasion&quot;');
    expect(ctx.chat[0]).toContain('&quot;name&quot;:&quot;Me&quot;');
    expect(ctx.chat[0]).toContain('&quot;target&quot;:&quot;Foe&quot;');
    expect(ctx.chat[0]).toContain('{lang.bad key}');
  });
});

describe('rollSeen @var.firstFailed', () => {
  test('1 when the first row failed, whatever the others did', async () => {
    const seen = [];
    const watcher = actor('Watcher', [[{ type: 'Trigger', event: 'rollSeen', steps: [{ do: 'setVar', key: 'x', value: 1 }, { do: 'chat', text: '{var.firstFailed}/{var.failed}' }] }]]);
    const roller = actor('Roller');
    world(watcher, roller);
    ChatMessage.create = jest.fn(async data => seen.push(data.content));
    await rollSeen(roller, [{ success: false }, { success: true }], {}, {});
    await rollSeen(roller, [{ success: true }, { success: false }], {}, {});
    await rollSeen(roller, [], {}, {});
    expect(seen.map(content => content.split('<br>')[1])).toEqual(['1/0', '0/0', '0/0']);
  });
});
