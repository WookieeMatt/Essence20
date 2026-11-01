import { canBeParticipant, customJoinTypes, formingSummary, isGuestComponent, missingToForm } from './megaform-participants.mjs';
import { setCustomLines } from '../resources/custom-game-lines.mjs';

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

test('formingSummary: the rules it forms under, who may join, and who it needs - book rules when nothing is ticked', () => {
  const labels = { subtypes: { megaformZord: 'Megazord', megaformCombiner: 'Combiner' }, types: { vehicle: 'Vehicle', zord: 'Zord' }, localize: key => key };
  expect(formingSummary(megazord(), labels)).toEqual({ rules: 'Megazord', custom: false, fromLine: false, joins: [], needed: [] });
  const lions = megazord({
    joinTypes: ['vehicle', 'nonsense'],
    actors: { a: { uuid: 'Actor.red', name: 'Red Lion' }, b: { uuid: 'Actor.blue', name: 'Blue Lion' } },
    requiredMembers: ['Actor.red', 'Actor.gone'],
  });
  expect(formingSummary(lions, labels)).toEqual({ rules: 'Megazord', custom: true, fromLine: false, joins: ['Vehicle'], needed: ['Red Lion'] });
  expect(formingSummary(combiner(), labels).rules).toBe('Combiner');
});

test("a Megaform with no ticks of its own takes its line's who-may-join; its own ticks win", () => {
  setCustomLines([{ label: 'Voltron', family: 'powerRangers', rules: { megaformJoinTypes: ['zord', 'vehicle'] } }]);
  const voltron = { system: { subtype: ['megaformZord'], joinTypes: [], actors: {} }, flags: { essence20: { rulesLine: 'voltron' } }, items: [] };
  expect(customJoinTypes(voltron)).toEqual(['zord', 'vehicle']);
  expect(canBeParticipant(voltron, { type: 'vehicle', system: {} })).toBe(true);
  expect(formingSummary(voltron).fromLine).toBe(true);
  const ticked = { ...voltron, system: { ...voltron.system, joinTypes: ['npc'] } };
  expect(customJoinTypes(ticked)).toEqual(['npc']);
  expect(formingSummary(ticked).fromLine).toBe(false);
  setCustomLines([]);
});
