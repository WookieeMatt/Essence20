import { LINK_HOLDERS, rebuildIndex } from './index.mjs';
import { crewOf, crewedBy, linkedEntries } from './links.mjs';
import { applySkillSubstitution, ruleDamageDealt, ruleDamageTaken, ruleDefenseAdjust, ruleDerived, ruleRollSources } from './adapter.mjs';
import { summarizeRule, validateRule } from './types.mjs';

let nextId = 1;
const actors = new Map();

function makeActor(type, rules = [], extra = {}) {
  const items = rules.length ? [{ id: `i${nextId++}`, name: extra.itemName ?? 'Gear', type: 'upgrade', flags: {}, system: { rules } }] : [];
  const actor = {
    id: `a${nextId++}`, type, name: extra.name ?? type, statuses: new Set(), flags: extra.flags ?? {},
    system: { level: extra.level ?? 1, actors: extra.crew ?? {}, defenses: { toughness: { total: 10, string: '10' } }, skills: { might: { shift: 'd6' }, driving: { shift: 'd4' } } },
  };
  actor.uuid = `Actor.${actor.id}`;
  actor.items = { contents: items, get: id => items.find(item => item.id == id) };
  for (const item of items) {
    item.parent = actor;
  }

  actors.set(actor.uuid, actor);
  return actor;
}

beforeEach(() => {
  actors.clear();
  LINK_HOLDERS.clear();
  global.fromUuidSync = uuid => actors.get(uuid) ?? null;
  global.game = { combat: null, user: { targets: new Set() }, actors: { contents: [] } };
  global.CONFIG = { E20: { skillShiftList: ['d10', 'd8', 'd6', 'd4'], skillToEssence: { driving: 'speed' } } };
});

const world = (...list) => {
  game.actors.contents = list;
  for (const actor of list) {
    rebuildIndex(actor);
  }
};

test('crew lookups', () => {
  const driver = makeActor('playerCharacter');
  const rider = makeActor('playerCharacter');
  const truck = makeActor('vehicle', [], { crew: { a: { uuid: driver.uuid, vehicleRole: 'driver' }, b: { uuid: rider.uuid }, c: { uuid: 'Actor.gone' } } });
  game.actors.contents = [driver, rider, truck];
  expect(crewOf(truck).map(c => [c.actor.id, c.role])).toEqual([[driver.id, 'driver'], [rider.id, 'passenger']]);
  expect(crewOf(driver)).toEqual([]);
  expect(crewedBy(rider)).toEqual({ vehicle: truck, role: 'passenger' });
  expect(crewedBy(makeActor('npc'))).toBeNull();
  expect(crewedBy(null)).toBeNull();
});

test('nothing is scanned while no actor holds a linked rule', () => {
  const lone = makeActor('playerCharacter', [{ type: 'RollModifier', upshift: 1 }]);
  world(lone);
  expect(LINK_HOLDERS.size).toBe(0);
  expect(linkedEntries(lone, 'RollModifier')).toEqual([]);
});

test('crew and pilot rules reach the vehicle\'s crew; formulas read the vehicle', () => {
  const driver = makeActor('playerCharacter', [], { name: 'Driver' });
  const rider = makeActor('playerCharacter', [], { name: 'Rider' });
  const truck = makeActor('vehicle', [
    { type: 'RollModifier', scope: 'crew', label: 'Cabin', when: ['skill:might'], upshift: '@level' },
    { type: 'RollModifier', scope: 'pilot', label: 'Ram', when: ['skill:driving'], edge: true },
    { type: 'Defense', scope: 'crew', label: 'Armored cab', defense: 'toughness', amount: 2 },
  ], { level: 3, crew: { a: { uuid: driver.uuid, vehicleRole: 'driver' }, b: { uuid: rider.uuid } } });
  world(driver, rider, truck);
  expect(LINK_HOLDERS.has(truck.id)).toBe(true);
  expect(ruleRollSources(rider, null, { rolledSkill: 'might' }).sources[0]).toMatchObject({ label: 'Cabin', shiftUp: 3 });
  expect(ruleRollSources(rider, null, { rolledSkill: 'driving' }).sources).toEqual([]);
  expect(ruleRollSources(driver, null, { rolledSkill: 'driving' }).sources[0]).toMatchObject({ label: 'Ram', edge: true });
  ruleDerived(rider);
  expect(rider.system.defenses.toughness).toEqual({ total: 12, string: '10 + 2 (Armored cab)' });
});

test('companion, owner and vehicle rules go the other ways', () => {
  const owner = makeActor('playerCharacter', [
    { type: 'DamageModifier', scope: 'companion', direction: 'taken', amount: -1 },
    { type: 'Defense', scope: 'companion', defense: 'toughness', amount: 1, when: ['attack:melee'] },
  ]);
  const pet = makeActor('companion', [
    { type: 'DamageModifier', scope: 'owner', direction: 'dealt', amount: 1, label: 'Pack tactics' },
    { type: 'SkillSubstitution', scope: 'owner', from: 'might', to: 'driving' },
  ], { flags: { essence20: { companionOf: '' } } });
  pet.flags.essence20.companionOf = owner.uuid;
  owner.system.actors = { p: { uuid: pet.uuid } };
  const pilot = makeActor('playerCharacter', [{ type: 'DerivedStat', scope: 'vehicle', path: 'system.speed', value: 10 }]);
  const zord = makeActor('zord', [], { crew: { a: { uuid: pilot.uuid, vehicleRole: 'driver' } } });
  world(owner, pet, pilot, zord);

  expect(ruleDamageTaken(pet, 3, 'blunt')).toBe(2);
  expect(ruleDamageTaken(owner, 3, 'blunt')).toBe(3);
  const melee = { type: 'weaponEffect', system: { classification: { style: 'melee' } } };
  expect(ruleDefenseAdjust(null, pet, 'toughness', { item: melee })).toBe(1);
  const notes = [];
  ruleDamageDealt(owner, null, { damageValue: 2 }, {}, { damageBonusNote: (result, amount, label) => notes.push([amount, label]) });
  expect(notes).toEqual([[1, 'Pack tactics']]);
  const dataset = { skill: 'might' };
  applySkillSubstitution(owner, dataset, null);
  expect(dataset.skill).toBe('driving');
  ruleDerived(zord);
  expect(zord.system.speed).toBe(10);
});

test('the catalogue allows the new scopes where they make sense, and says so', () => {
  expect(validateRule({ type: 'Defense', scope: 'crew', defense: 'toughness', amount: 1 })).toEqual([]);
  expect(validateRule({ type: 'Use', scope: 'crew', steps: [] })[0]).toMatch(/scope "crew"/);
  expect(summarizeRule({ type: 'RollModifier', scope: 'pilot', edge: true })).toBe('Its driver: Edge');
});
