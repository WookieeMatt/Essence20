import { jest } from '@jest/globals';

jest.unstable_mockModule('./helpers/grants.mjs', () => ({ chooseButtons: jest.fn(async (title, prompt, options) => options.at(-1)[0]) }));
const { fitGrantedWeapon, specialAttackUpdates } = await import('./weapon-fit.mjs');

beforeAll(() => {
  global.game = { ...(global.game ?? {}), i18n: { localize: key => key, format: key => key } };
});

describe('weapon-fit', () => {
  const attack = () => ({ id: 'e1', type: 'weaponEffect', flags: { essence20: { parentId: 'w1' } }, system: { damageType: 'blunt', damageValue: 1, classification: { skill: 'might' } } });

  test('specialAttackUpdates sets the Blunt hit\'s damage only', () => {
    const effects = [attack()];
    expect(specialAttackUpdates({ system: {} }, effects, { damage: 2 }).effectUpdates).toEqual([{ _id: 'e1', 'system.damageValue': 2 }]);
  });

  test('fitGrantedWeapon asks the offered choices and updates the attack and the weapon', async () => {
    const effect = attack();
    const actor = { items: [effect], updateEmbeddedDocuments: jest.fn() };
    const weapon = { id: 'w1', name: 'Natural Weapon', system: { traits: ['blunt'], items: {} }, update: jest.fn() };
    await fitGrantedWeapon(actor, weapon, { title: 'Beast', types: ['blunt', 'sharp'], skills: ['finesse', 'might'] });
    // The mocked picker takes the last option offered: Sharp, then Might (no change).
    expect(actor.updateEmbeddedDocuments).toHaveBeenCalledWith('Item', [{ _id: 'e1', 'system.damageType': 'sharp' }]);
    expect(weapon.update).toHaveBeenCalledWith({ 'system.traits': ['sharp'] });
  });

  test('nothing to ask and nothing to change: no updates', async () => {
    const actor = { items: [attack()], updateEmbeddedDocuments: jest.fn() };
    const weapon = { id: 'w1', name: 'Ram', system: { traits: [], items: {} }, update: jest.fn() };
    await fitGrantedWeapon(actor, weapon, { title: 'Car' });
    expect(actor.updateEmbeddedDocuments).not.toHaveBeenCalled();
    expect(weapon.update).not.toHaveBeenCalled();
  });
});
