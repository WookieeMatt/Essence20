import { jest } from '@jest/globals';

/** Weapon Bays (Transformers One Sourcebook p.17) - weapon-bays.mjs. */

jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn() }));

const { runSteps, stepContext } = await import('../../steps.mjs');
const { bayCandidates, bayRoom, checkPicks, weaponBayHelpers } = await import('./weapon-bays.mjs');

function setPath(object, key, value) {
  const keys = key.split('.');
  const last = keys.pop();
  const at = keys.reduce((node, k) => (node[k] ??= {}), object);
  if (last.startsWith('-=')) {
    delete at[last.slice(2)];
  } else {
    at[last] = value;
  }
}

function makeItem(data) {
  return {
    flags: { essence20: {} }, ...data,
    async update(changes) {
      for (const [key, value] of Object.entries(changes)) {
        setPath(this, key, value);
      }
    },
  };
}

function makeActor(items) {
  const actor = {
    name: 'Bulkhead', items: { contents: items, [Symbol.iterator]: () => items[Symbol.iterator]() }, system: {},
    async updateEmbeddedDocuments(type, updates) {
      for (const { _id, ...changes } of updates) {
        await items.find(item => item.id == _id).update(changes);
      }
    },
  };
  items.forEach(item => (item.parent = actor));
  return actor;
}

const weapon = (id, name, size, extra = {}) => makeItem({ id, name, type: 'weapon', system: { classification: { size }, hardpoint: { type: 'external', reinforced: false } }, ...extra });

let picks;
let prereqs;
beforeEach(() => {
  picks = null;
  prereqs = {};
  weaponBayHelpers.pick = jest.fn(async () => picks);
  weaponBayHelpers.choose = jest.fn(async (title, prompt, options) => options[0].value);
  weaponBayHelpers.prerequisites = async (actor, item) => prereqs[item.id] ?? { met: true, unmet: [], asks: [] };
  global.foundry = { ...(global.foundry ?? {}), utils: { ...(global.foundry?.utils ?? {}), setProperty: setPath } };
  global.ui = { notifications: { warn: jest.fn() } };
  global.game = { ...(global.game ?? {}), i18n: { localize: key => key, format: key => key } };
});

describe('Weapon Bays', () => {
  test('the room a weapon takes: Sidearm 1, Medium 2, Long / Heavy 3, one more Reinforced', () => {
    expect(bayRoom(weapon('a', 'Pistol', 'sidearm'))).toBe(1);
    expect(bayRoom(weapon('b', 'Rifle', 'medium'))).toBe(2);
    expect(bayRoom(weapon('c', 'Cannon', 'long'))).toBe(3);
    expect(bayRoom(weapon('d', 'Launcher', 'heavy'), true)).toBe(4);
  });

  test("candidates: not already in a bay; a weapon the character doesn't qualify for is blocked, one the GM decides is marked", async () => {
    const actor = makeActor([weapon('a', 'Pistol', 'sidearm'), weapon('b', 'Rifle', 'medium'), weapon('c', 'Cannon', 'long', { flags: { essence20: { weaponBay: 'p1' } } })]);
    prereqs.b = { met: false, unmet: ['Targeting d4'], asks: [] };
    prereqs.a = { met: true, unmet: [], asks: ['GM'] };
    // An Alt Mode's Ram / Flyby takes no Hardpoint: never offered.
    const flyby = weapon('f', 'Flyby', 'integrated');
    actor.items.contents.push(flyby);
    actor._isAltModeAttack = item => item.id == 'f';
    expect(await bayCandidates(actor)).toEqual([
      { id: 'a', name: 'Pistol', room: 1, reinforcedRoom: 2, blocked: false, asks: true },
      { id: 'b', name: 'Rifle', room: 2, reinforcedRoom: 3, blocked: true, asks: false },
    ]);
  });

  test('picks must fit the room and not be blocked', () => {
    const rows = [{ id: 'a', room: 1, reinforcedRoom: 2, blocked: false }, { id: 'b', room: 2, reinforcedRoom: 3, blocked: true }, { id: 'c', room: 3, reinforcedRoom: 4 }];
    expect(checkPicks(rows, [{ id: 'a', reinforced: true }, { id: 'c' }], 5)).toEqual({ picks: [{ id: 'a', reinforced: true }, { id: 'c', reinforced: false }], used: 5 });
    expect(checkPicks(rows, [{ id: 'a', reinforced: true }, { id: 'c' }], 4)).toBeNull();
    expect(checkPicks(rows, [{ id: 'b' }], 9)).toBeNull();
    expect(checkPicks(rows, [], 9)).toBeNull();
  });

  test('filling the bays: Crew and Firepoints traded, weapons Integrated (Reinforced where picked), the count kept; removing it puts all back', async () => {
    const van = makeItem({ id: 'alt1', name: 'Van', type: 'altMode', system: { altModeCrew: 4, altModeFirepoints: 2 } });
    const pistol = weapon('a', 'Pistol', 'sidearm');
    const rifle = weapon('b', 'Rifle', 'medium');
    const perk = makeItem({ id: 'p1', name: 'Weapon Bays', type: 'perk', system: {} });
    const actor = makeActor([van, pistol, rifle, perk]);
    picks = [{ id: 'a', reinforced: true }, { id: 'b' }];
    const ctx = stepContext({ actor, item: perk });
    await runSteps([{ do: 'weaponBays' }], ctx);
    expect(weaponBayHelpers.pick).toHaveBeenCalledWith('Weapon Bays', expect.any(Array), 4);
    expect(van.system).toMatchObject({ altModeCrew: 0, altModeFirepoints: 0 });
    expect(pistol.system.hardpoint).toEqual({ type: 'integrated', reinforced: true });
    expect(rifle.system.hardpoint).toEqual({ type: 'integrated', reinforced: false });
    expect(pistol.flags.essence20.weaponBay).toBe('p1');
    expect(perk.flags.essence20.rules.choices).toMatchObject({ weaponBayCount: 2, weaponBay: { altModeId: 'alt1', room: 4, firepoints: 2 } });

    await runSteps([{ do: 'weaponBaysUndo' }], stepContext({ actor, item: perk }));
    expect(van.system).toMatchObject({ altModeCrew: 4, altModeFirepoints: 2 });
    expect(pistol.system.hardpoint).toEqual({ type: 'external', reinforced: false });
    expect(pistol.flags.essence20.weaponBay).toBeUndefined();
  });

  test('no Alt Mode with Crew room: a warning and nothing done; a closed dialog does nothing', async () => {
    const perk = makeItem({ id: 'p1', name: 'Weapon Bays', type: 'perk', system: {} });
    const bike = makeItem({ id: 'alt1', name: 'Bike', type: 'altMode', system: { altModeCrew: 0 } });
    await runSteps([{ do: 'weaponBays' }], stepContext({ actor: makeActor([bike, perk]), item: perk }));
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.WeaponBaysNoCrew');

    const van = makeItem({ id: 'alt2', name: 'Van', type: 'altMode', system: { altModeCrew: 2, altModeFirepoints: 2 } });
    picks = null;
    await runSteps([{ do: 'weaponBays' }], stepContext({ actor: makeActor([van, weapon('a', 'Pistol', 'sidearm'), perk]), item: perk }));
    expect(van.system.altModeCrew).toBe(2);
    expect(perk.flags.essence20.rules).toBeUndefined();
  });

  test('two Alt Modes with Crew: asks which', async () => {
    const perk = makeItem({ id: 'p1', name: 'Weapon Bays', type: 'perk', system: {} });
    const van = makeItem({ id: 'alt1', name: 'Van', type: 'altMode', system: { altModeCrew: 2 } });
    const jet = makeItem({ id: 'alt2', name: 'Jet', type: 'altMode', system: { altModeCrew: 1 } });
    weaponBayHelpers.choose = jest.fn(async () => 'alt2');
    picks = [{ id: 'a' }];
    await runSteps([{ do: 'weaponBays' }], stepContext({ actor: makeActor([van, jet, weapon('a', 'Pistol', 'sidearm'), perk]), item: perk }));
    expect(weaponBayHelpers.choose.mock.calls[0][2]).toEqual([{ value: 'alt1', label: 'Van (2)' }, { value: 'alt2', label: 'Jet (1)' }]);
    expect(jet.system.altModeCrew).toBe(0);
    expect(van.system.altModeCrew).toBe(2);
  });
});
