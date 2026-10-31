import {
  altModeHolds, bondHolds, morphedHolds, bondOnCreate, bondOnEquip, crewSlotEquipped, powerGearHolds, rebondAllUpdates, slotClashes, slotEquipped, slotOf,
} from './power-gear.mjs';

const actorWith = (id, items = [], system = {}) => {
  const actor = { id, system, items: [] };
  for (const item of items) {
    item.parent = actor;
    actor.items.push(item);
  }

  return actor;
};

const gear = (id, powerGear = {}, extra = {}) => ({ id, type: 'gear', system: { equipped: true, powerGear: { bonded: false, bondedTo: '', slot: '', altModeOnly: false, ...powerGear } }, ...extra });

test('a bond holds for its holder, or before anyone holds it; not for someone else', () => {
  const mask = gear('m', { bonded: true, bondedTo: 'matt' });
  actorWith('matt', [mask]);
  expect(bondHolds(mask)).toBe(true);
  expect(bondHolds(mask, { id: 'miles' })).toBe(false);
  expect(bondHolds(gear('x', { bonded: true }), { id: 'anyone' })).toBe(true);
  expect(bondHolds(gear('x', { bondedTo: 'other' }), { id: 'anyone' })).toBe(true);
  expect(bondHolds({ type: 'perk', system: {} }, { id: 'a' })).toBe(true);
});

test('Alt Mode only: works while its holder is transformed', () => {
  const pod = gear('p', { altModeOnly: true });
  const car = actorWith('car', [pod], { isTransformed: false });
  expect(altModeHolds(pod)).toBe(false);
  car.system.isTransformed = true;
  expect(powerGearHolds(pod)).toBe(true);
});

test('equipping an unbonded item bonds it to its holder, in the same update', () => {
  const mask = gear('m', { bonded: true }, { system: { equipped: false, powerGear: { bonded: true, bondedTo: '' } } });
  actorWith('matt', [mask]);
  const changes = { system: { equipped: true } };
  expect(bondOnEquip(mask, changes)).toBe(true);
  expect(changes.system.powerGear.bondedTo).toBe('matt');
  expect(bondOnEquip(mask, { 'system.name': 'x' })).toBe(false);
  // Ticking Bonded on something already worn bonds it.
  const worn = gear('w');
  actorWith('miles', [worn]);
  const flat = { 'system.powerGear.bonded': true };
  expect(bondOnEquip(worn, flat)).toBe(true);
  expect(flat.system.powerGear.bondedTo).toBe('miles');
  expect(bondOnEquip(gear('loose', { bonded: true }), { system: { equipped: true } })).toBe(false);
});

test('made on an actor already equipped, it bonds; a copy of the actor takes over its bonds', () => {
  const mask = gear('m', { bonded: true });
  actorWith('matt', [mask]);
  expect(bondOnCreate(mask)).toBe('matt');
  const copy = actorWith('copy', [gear('m1', { bonded: true, bondedTo: 'matt' }), gear('m2', { bonded: true, bondedTo: 'copy' }), gear('m3')]);
  expect(rebondAllUpdates(copy)).toEqual([{ _id: 'm1', 'system.powerGear.bondedTo': 'copy' }]);
});

test('slots: one on at a time, and who is wearing what - themselves or aboard a vehicle', () => {
  const spectrum = gear('s', { slot: 'Mask', bonded: true, bondedTo: 'matt' });
  const gator = gear('g', { slot: 'mask' });
  const hat = gear('h', { slot: 'hat' }, { system: { equipped: false, powerGear: { slot: 'hat' } } });
  const matt = actorWith('matt', [spectrum, gator, hat]);
  expect(slotOf(spectrum)).toBe('mask');
  expect(slotClashes(spectrum).map(item => item.id)).toEqual(['g']);
  expect(slotClashes(gear('n'))).toEqual([]);
  expect(slotEquipped(matt, 'mask')).toBe(true);
  expect(slotEquipped(matt, 'hat')).toBe(false);
  expect(slotEquipped(matt)).toBe(true);
  // Someone else's mask doesn't count for them.
  const miles = actorWith('miles', [gear('x', { slot: 'mask', bonded: true, bondedTo: 'matt' })]);
  expect(slotEquipped(miles, 'mask')).toBe(false);
  const thunderhawk = { id: 'th', system: { actors: { a: { uuid: 'Actor.matt' }, b: { uuid: 'Actor.miles' } } } };
  const resolve = uuid => ({ 'Actor.matt': matt, 'Actor.miles': miles })[uuid];
  expect(crewSlotEquipped(thunderhawk, 'mask', resolve)).toBe(true);
  expect(crewSlotEquipped(thunderhawk, 'ring', resolve)).toBe(false);
  expect(crewSlotEquipped({ system: {} }, '', resolve)).toBe(false);
});

test('a slot tag can name the item too: someone aboard wearing Spectrum, not just any mask', () => {
  const matt = actorWith('matt', [gear('s', { slot: 'mask' }, { name: 'Spectrum' }), gear('u', { slot: 'mask' }, { name: 'New Spectrum', system: { equipped: false, powerGear: { slot: 'mask' } } })]);
  expect(slotEquipped(matt, 'mask:spectrum')).toBe(true);
  expect(slotEquipped(matt, 'mask:New Spectrum')).toBe(false);
  expect(slotEquipped(matt, 'ring:Spectrum')).toBe(false);
  const hawk = { id: 'th', system: { actors: { a: { uuid: 'Actor.matt' } } } };
  expect(crewSlotEquipped(hawk, 'mask:Spectrum', () => matt)).toBe(true);
});

test('Morphed only: works while its holder is Morphed, and only then counts in its slot', () => {
  const armor = gear('a', { morphedOnly: true, slot: 'armor' });
  const quicksilver = actorWith('q', [armor], { isMorphed: false });
  expect(morphedHolds(armor)).toBe(false);
  expect(powerGearHolds(armor)).toBe(false);
  expect(slotEquipped(quicksilver, 'armor')).toBe(false);
  quicksilver.system.isMorphed = true;
  expect(powerGearHolds(armor)).toBe(true);
  expect(slotEquipped(quicksilver, 'armor')).toBe(true);
  expect(morphedHolds(gear('x'), { system: {} })).toBe(true);
});
