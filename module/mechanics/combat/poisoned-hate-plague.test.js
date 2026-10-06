import { jest } from '@jest/globals';
import {
  blocksCondition, HATE_PLAGUE, hatePlagueDerived, hatePlagueHit, hatePlagueRollSources, holdPoisonedHealth, poisonOnDamage, poisonOnRest,
} from './poisoned-hate-plague.mjs';

const makeActor = (statuses = [], system = {}) => ({
  name: 'Victim', uuid: 'Actor.v', statuses: new Set(statuses), system, toggleStatusEffect: jest.fn(),
});

beforeEach(() => {
  global.game = { i18n: { localize: k => k, format: k => k } };
  global.CONFIG = { E20: { skillToEssence: { persuasion: 'social', might: 'strength' } } };
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
});

test('poison damage makes the target Poisoned', async () => {
  const actor = makeActor();
  await poisonOnDamage(actor, 1, 'poison');
  expect(actor.toggleStatusEffect).toHaveBeenCalledWith('poisoned', { active: true });
  const other = makeActor();
  await poisonOnDamage(other, 2, 'sharp');
  await poisonOnDamage(other, 0, 'poison');
  await poisonOnDamage(makeActor(['poisoned']), 1, 'poison');
  expect(other.toggleStatusEffect).not.toHaveBeenCalled();
});

test('a Poisoned character recovers no Health', () => {
  const actor = makeActor(['poisoned'], { health: { value: 2 } });
  const flat = { 'system.health.value': 5 };
  expect(holdPoisonedHealth(actor, flat)).toBe(true);
  expect(flat['system.health.value']).toBe(2);

  const nested = { system: { health: { value: 4 } } };
  expect(holdPoisonedHealth(actor, nested)).toBe(true);
  expect(nested.system.health.value).toBe(2);

  const damage = { 'system.health.value': 1 };
  expect(holdPoisonedHealth(actor, damage)).toBe(false);
  expect(damage['system.health.value']).toBe(1);

  expect(holdPoisonedHealth(actor, { 'system.health.value': 5 }, { d22PoisonBypass: true })).toBe(false);
  expect(holdPoisonedHealth(makeActor([], { health: { value: 2 } }), { 'system.health.value': 5 })).toBe(false);
});

test('resting while Poisoned only posts for a poisoned actor', async () => {
  await poisonOnRest(makeActor());
  expect(ChatMessage.create).not.toHaveBeenCalled();
});

test('Hate Plague: Social Snag, ↑2 Might, psychic Resistance, Frightened immunity', () => {
  const victim = makeActor([HATE_PLAGUE], { resistances: { psychic: false } });
  expect(hatePlagueRollSources(victim, null, { rolledSkill: 'persuasion' }).sources[0]).toMatchObject({ snag: true });
  expect(hatePlagueRollSources(victim, null, { rolledSkill: 'might' }).sources[0]).toMatchObject({ shiftUp: 2 });
  expect(hatePlagueRollSources(victim, null, { rolledSkill: 'alertness' }).sources).toEqual([]);
  expect(hatePlagueRollSources(makeActor(), null, { rolledSkill: 'might' }).sources).toEqual([]);

  hatePlagueDerived(victim);
  expect(victim.system.resistances.psychic).toBe(true);
  expect(blocksCondition(victim, ['frightened'])).toBe(true);
  expect(blocksCondition(victim, ['prone'])).toBe(false);
  expect(blocksCondition(makeActor(), ['frightened'])).toBe(false);
});

test('Hate Plague spreads through unarmed hits', async () => {
  const victim = makeActor([HATE_PLAGUE]);
  const target = makeActor();
  await hatePlagueHit(victim, target, { success: true }, { isUnarmed: false });
  expect(ChatMessage.create).not.toHaveBeenCalled();
  await hatePlagueHit(victim, target, { success: true }, { isUnarmed: true });
  expect(ChatMessage.create.mock.calls[0][0].content).toContain('d22HatePlagueInfect');
});
