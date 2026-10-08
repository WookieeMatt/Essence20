import { jest } from '@jest/globals';

/**
 * Round 18, convC engine pieces (docs/rules-batches/slConvC18.md): SneakAttackGrant `bypass` (+ `reason`), pick source
 * `seatmates` and step `swapSeats`.
 */

global.Hooks = { on: () => {}, once: () => {}, callAll: () => {} };
jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn() }));

await import('./plugins/index.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { validateRule } = await import('./types.mjs');
const { pickOptions, runSteps, stepContext, stepErrors } = await import('./steps.mjs');
const { bypassGrant, sneakAttackWeaponGrants } = await import('./plugins/combat/sneak-attack-grant.mjs');
const { seatOf, seatmateOptions } = await import('./plugins/picks/seat-swap.mjs');

let nextId = 1;

function makeActor(rules = [], { type = 'playerCharacter', flags = {} } = {}) {
  const actor = { id: `a${nextId++}`, name: 'Actor', type, flags: { essence20: { ...flags } }, system: {} };
  actor.uuid = `Actor.${actor.id}`;
  const items = rules.length ? [{ id: `i${nextId++}`, name: 'Perk', type: 'perk', parent: actor, flags: {}, system: { rules } }] : [];
  actor.items = items;
  actor.update = jest.fn(async changes => {
    for (const [path, value] of Object.entries(changes)) {
      const keys = path.split('.');
      const last = keys.pop();
      keys.reduce((at, key) => (at[key] ??= {}), actor)[last] = value;
    }
  });
  rebuildIndex(actor);
  return actor;
}

const effect = { id: 'e', type: 'weaponEffect', flags: {}, system: {} };

beforeEach(() => {
  global.game = { combat: null, user: { targets: new Set() }, actors: { contents: [] }, i18n: { localize: key => key } };
});

describe('SneakAttackGrant bypass', () => {
  test('validates with a reason; the first bypass whose when holds answers, and it never widens the weapon / range', () => {
    const rule = { type: 'SneakAttackGrant', bypass: true, reason: 'E20.X', when: ['self:data:flags.essence20.on'] };
    expect(validateRule(rule)).toEqual([]);
    const actor = makeActor([rule]);
    expect(bypassGrant(actor, effect)).toBeNull();
    actor.flags.essence20.on = true;
    expect(bypassGrant(actor, effect)?.rule.reason).toBe('E20.X');
    expect(sneakAttackWeaponGrants(actor, effect)).toEqual({ qualifies: false, range: undefined });
  });

  test('items narrows it like the other grants', () => {
    const actor = makeActor([{ type: 'SneakAttackGrant', bypass: true, items: ['item:type:spell'] }]);
    expect(bypassGrant(actor, effect)).toBeNull();
  });
});

describe('seatmates / swapSeats', () => {
  function aboard() {
    const rider = makeActor();
    const other = makeActor();
    const truck = makeActor([], { type: 'vehicle' });
    truck.system.actors = {
      a: { uuid: rider.uuid, name: 'Rider', vehicleRole: 'driver' },
      b: { uuid: other.uuid, name: 'Other', vehicleRole: 'passenger' },
      c: { uuid: 'Actor.x', name: 'Gunner', vehicleRole: 'gunner' },
      d: { name: 'Empty', vehicleRole: 'passenger' },
    };
    global.game.actors = { contents: [rider, other, truck] };
    return { rider, truck };
  }

  test('the seat and the other seated drivers / passengers; nothing when not aboard', () => {
    const { rider, truck } = aboard();
    expect(seatOf(rider)).toMatchObject({ vehicle: truck, key: 'a' });
    const ctx = stepContext({ actor: rider, item: null, rule: {}, targets: [] });
    expect(seatmateOptions({}, ctx)).toEqual([{ value: 'b', label: 'Other (passenger)' }]);
    expect(pickOptions({ from: 'seatmates' }, ctx)).toEqual([{ value: 'b', label: 'Other (passenger)' }]);
    expect(seatmateOptions({}, stepContext({ actor: makeActor(), item: null, rule: {}, targets: [] }))).toEqual([]);
  });

  test('swaps the two roles (a stored pick, else the last pick); a bad seat stops the run', async () => {
    const { rider, truck } = aboard();
    const item = { flags: { essence20: { rules: { choices: { seat: 'b' } } } } };
    const ctx = stepContext({ actor: rider, item, rule: {}, targets: [] });
    expect(await runSteps([{ do: 'swapSeats', seat: 'seat' }], ctx)).toBe(true);
    expect(truck.update).toHaveBeenCalledWith({ 'system.actors.a.vehicleRole': 'passenger', 'system.actors.b.vehicleRole': 'driver' });
    expect(ctx.vars.other).toBe('Other');

    const again = stepContext({ actor: rider, item: null, rule: {}, targets: [] });
    again.vars.picked = 'zz';
    expect(await runSteps([{ do: 'swapSeats' }], again)).toBe(false);
    again.vars.picked = 'a';
    expect(await runSteps([{ do: 'swapSeats' }], again)).toBe(false);
  });

  test('validator: seat is a pick key', () => {
    expect(stepErrors([{ do: 'swapSeats', seat: 'x' }])).toEqual([]);
    expect(stepErrors([{ do: 'swapSeats', seat: 3 }]).length).toBe(1);
  });
});
