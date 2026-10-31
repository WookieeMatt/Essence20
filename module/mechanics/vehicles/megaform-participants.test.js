import { canBeParticipant, customJoinTypes, isGuestComponent, missingToForm } from './megaform-participants.mjs';

const megazord = (system = {}) => ({ system: { subtype: ['megaformZord'], ...system } });
const combiner = (system = {}) => ({ system: { subtype: ['megaformCombiner'], ...system } });
const actor = (type, system = {}, id = type) => ({ type, system, id, uuid: `Actor.${id}` });

test('the book: a Megazord takes Zords and Cybertronians, a Combiner takes characters, nobody takes Vehicles', () => {
  expect(canBeParticipant(megazord(), actor('zord'))).toBe(true);
  expect(canBeParticipant(megazord(), actor('playerCharacter', { canTransform: true }))).toBe(true);
  expect(canBeParticipant(megazord(), actor('playerCharacter'))).toBe(false);
  expect(canBeParticipant(combiner(), actor('playerCharacter'))).toBe(true);
  expect(canBeParticipant(combiner(), actor('zord'))).toBe(false);
  expect(['vehicle', 'megaform'].map(type => canBeParticipant(megazord(), actor(type)))).toEqual([false, false]);
});

test("a GM's own list replaces the book's, whichever rules the form uses - never another Megaform", () => {
  const lions = megazord({ joinTypes: ['vehicle'] });
  expect(customJoinTypes(lions)).toEqual(['vehicle']);
  expect(customJoinTypes(megazord({ joinTypes: ['nonsense'] }))).toBeNull();
  expect(canBeParticipant(lions, actor('vehicle'))).toBe(true);
  expect(canBeParticipant(lions, actor('zord'))).toBe(false);
  expect(canBeParticipant(combiner({ joinTypes: ['zord', 'npc'] }), actor('zord'))).toBe(true);
  expect(canBeParticipant(combiner({ joinTypes: ['zord', 'npc'] }), actor('playerCharacter'))).toBe(false);
  expect(canBeParticipant(combiner({ joinTypes: ['zord'] }), actor('megaform'))).toBe(false);
});

test('only a Transformer joining a Megazord is a guest; a Vehicle or plain character let in is a full component', () => {
  expect(isGuestComponent(megazord(), actor('playerCharacter', { canTransform: true }))).toBe(true);
  expect(isGuestComponent(megazord(), actor('zord'))).toBe(false);
  expect(isGuestComponent(megazord({ joinTypes: ['vehicle'] }), actor('vehicle'))).toBe(false);
  expect(isGuestComponent(combiner(), actor('playerCharacter', { canTransform: true }))).toBe(false);
});

test('Needed to Form names whoever on the roster is still missing from the scene', () => {
  const form = megazord({
    actors: { a: { uuid: 'Actor.black', name: 'Black Lion' }, b: { uuid: 'Actor.red', name: 'Red Lion' } },
    requiredMembers: ['Actor.black', 'Actor.red', 'Actor.gone'],
  });
  expect(missingToForm(form, [actor('vehicle', {}, 'black')])).toEqual(['Red Lion']);
  expect(missingToForm(form, [actor('vehicle', {}, 'black'), actor('vehicle', {}, 'red')])).toEqual([]);
  expect(missingToForm(megazord(), [])).toEqual([]);
});
