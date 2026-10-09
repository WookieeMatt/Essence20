import { jest } from '@jest/globals';
import {
  getMythicForms,
  isInactiveMythicForm,
  isMythicallyModular,
  switchMythicForm,
} from './mythically-modular.mjs';

global.foundry = { data: { operators: { ForcedDeletion: globalThis.foundry?.data?.operators?.ForcedDeletion ?? class ForcedDeletion {} } }, utils: { randomID: jest.fn(() => 'spend1') } };

function makeWeapon(id, { equipped = true, traits = ['mythicallyModular'] } = {}) {
  return { id, name: `Form ${id}`, type: 'weapon', system: { equipped, traits, upgradeTraits: [] } };
}

function makeActor(items) {
  return { name: 'Ranger', items, updateEmbeddedDocuments: jest.fn() };
}

function setGame({ mode = 'track' } = {}) {
  global.game = {
    user: { isGM: false },
    i18n: { localize: jest.fn(key => key), format: jest.fn(key => key) },
    settings: { get: jest.fn((scope, key) => (key == 'actionEconomyMode' ? mode : undefined)) },
    combat: null,
  };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
}

beforeEach(() => setGame());

describe('isMythicallyModular', () => {
  test('own, upgrade-granted, or derived trait', () => {
    expect(isMythicallyModular(makeWeapon('a'))).toBe(true);
    expect(isMythicallyModular({ type: 'weapon', system: { traits: [], upgradeTraits: ['mythicallyModular'] } })).toBe(true);
    expect(isMythicallyModular({ type: 'weapon', system: { itemAndUpgradeTraits: ['mythicallyModular'] } })).toBe(true);
    expect(isMythicallyModular(makeWeapon('b', { traits: [] }))).toBe(false);
    expect(isMythicallyModular({ type: 'armor', system: { traits: ['mythicallyModular'] } })).toBe(false);
  });
});

describe('getMythicForms / isInactiveMythicForm', () => {
  test('the other Mythically Modular weapons on the actor', () => {
    const axe = makeWeapon('axe');
    const shield = makeWeapon('shield', { equipped: false });
    const plain = makeWeapon('plain', { traits: [] });
    const actor = makeActor([axe, shield, plain]);

    expect(getMythicForms(actor, axe)).toEqual([shield]);
    expect(isInactiveMythicForm(actor, shield)).toBe(true);
    expect(isInactiveMythicForm(actor, axe)).toBe(false);
  });

  test('a lone Mythically Modular weapon is never blocked', () => {
    const lone = makeWeapon('lone', { equipped: false });
    expect(isInactiveMythicForm(makeActor([lone]), lone)).toBe(false);
    expect(getMythicForms(null, lone)).toEqual([]);
    expect(isInactiveMythicForm(makeActor([lone]), null)).toBe(false);
  });
});

describe('switchMythicForm', () => {
  test('equips this form and unequips the others', async () => {
    const axe = makeWeapon('axe');
    const shield = makeWeapon('shield', { equipped: false });
    const actor = makeActor([axe, shield]);

    expect(await switchMythicForm(actor, shield)).toBe(true);
    expect(actor.updateEmbeddedDocuments).toHaveBeenCalledWith('Item', [
      { _id: 'shield', 'system.equipped': true },
      { _id: 'axe', 'system.equipped': false },
    ]);
  });

  test('no-op when already the only form in use', async () => {
    const axe = makeWeapon('axe');
    const actor = makeActor([axe, makeWeapon('shield', { equipped: false })]);
    expect(await switchMythicForm(actor, axe)).toBe(false);
    expect(actor.updateEmbeddedDocuments).not.toHaveBeenCalled();
  });

  test('warns when there is nothing to switch with', async () => {
    const lone = makeWeapon('lone');
    const actor = makeActor([lone]);
    expect(await switchMythicForm(actor, lone)).toBe(false);
    expect(ui.notifications.warn).toHaveBeenCalled();
  });

  test('a blocked Free action spend stops the switch', async () => {
    const combatant = { tokenId: 't1', getFlag: () => ({ free: 5 }), setFlag: jest.fn() };
    setGame({ mode: 'strict' });
    game.combat = { getCombatantsByActor: () => [combatant] };
    const axe = makeWeapon('axe');
    const shield = makeWeapon('shield', { equipped: false });
    const actor = { ...makeActor([axe, shield]), system: { actions: { enabled: true, free: { max: 0 } } } };

    expect(await switchMythicForm(actor, shield)).toBe(false);
    expect(actor.updateEmbeddedDocuments).not.toHaveBeenCalled();
  });
});
