import { currentEssence, currentEssenceUpdate, essenceDamageIn, essenceScore, tracksEssenceDamage } from './essence-current.mjs';
import { jest } from '@jest/globals';
import { essenceDamageOf, healEssenceDamage } from './essence-damage.mjs';

/**
 * Zords, Vehicles and Megaforms take Essence damage temporarily (user ruling 2026-10-07): kept apart from the score as
 * `damage`, repaired, never moving the base - mechanics/combat/essence-current.mjs.
 */

const zord = (essences, type = 'zord') => ({ type, system: { essences }, update: jest.fn() });

test('only machines keep the damage apart', () => {
  expect(['zord', 'vehicle', 'megaform'].map(type => tracksEssenceDamage({ type }))).toEqual([true, true, true]);
  expect(['playerCharacter', 'npc', 'companion'].map(type => tracksEssenceDamage({ type }))).toEqual([false, false, false]);
});

describe('a machine', () => {
  const actor = zord({ strength: { base: 6, value: 7, damage: 2 }, smarts: { base: null, value: null, damage: 0 } });

  test('its score is the worked-out value; the current amount is that less the damage', () => {
    expect(essenceScore(actor, 'strength')).toBe(7);
    expect(currentEssence(actor, 'strength')).toBe(5);
    expect(essenceDamageIn(actor, 'strength')).toBe(2);
  });

  test("a blank Essence (the driver's) has none", () => {
    expect(essenceScore(actor, 'smarts')).toBeNull();
    expect(currentEssence(actor, 'smarts')).toBeNull();
    expect(essenceDamageIn(actor, 'smarts')).toBe(0);
  });

  test('a new current amount is written as damage, never to the value or base', () => {
    expect(currentEssenceUpdate(actor, 'strength', 4)).toEqual({ 'system.essences.strength.damage': 3 });
    expect(currentEssenceUpdate(actor, 'strength', 99)).toEqual({ 'system.essences.strength.damage': 0 });
    expect(currentEssenceUpdate(actor, 'strength', -3)).toEqual({ 'system.essences.strength.damage': 7 });
  });

  test('damage past the score leaves nothing, not a negative', () => {
    expect(currentEssence(zord({ speed: { base: 2, value: 2, damage: 5 } }), 'speed')).toBe(0);
  });

  test('Essence damage totals and heals through the damage field', async () => {
    const hurt = zord({ strength: { base: 6, value: 6, damage: 2 }, speed: { base: 4, value: 4, damage: 1 } });
    expect(essenceDamageOf(hurt)).toBe(3);
    expect(await healEssenceDamage(hurt, 2)).toBe(2);
    expect(hurt.update).toHaveBeenCalledWith({ 'system.essences.strength.damage': 0 });
  });
});

describe('a character keeps value under max', () => {
  const npc = { type: 'npc', system: { essences: { strength: { base: 4, max: 4, value: 3 } } } };

  test('current is the value, score the max, writes go to the value', () => {
    expect(currentEssence(npc, 'strength')).toBe(3);
    expect(essenceScore(npc, 'strength')).toBe(4);
    expect(currentEssenceUpdate(npc, 'strength', 2)).toEqual({ 'system.essences.strength.value': 2 });
  });
});
