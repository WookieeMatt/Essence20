import { jest } from '@jest/globals';
import { onShieldActivationToggle, onShieldEquipToggle, setShieldOptions } from './listener-item-handler.mjs';

// Regression coverage for the real bug these three functions shared with onPerkUseClick (see its
// own doc comment): onShieldActivationToggle/onShieldEquipToggle used to read
// event.currentTarget.dataset.id, but Foundry's ApplicationV2 action dispatcher never reassigns
// event.currentTarget to the specific clicked [data-action] element - it stays the sheet's own
// root, which has no data-id of its own. That always left `currentShield` null, and unlike
// onPerkUseClick's silent no-op, this one crashed outright the instant it touched
// `currentShield.system`. It went unnoticed because - on top of the same "verification calls the
// helper directly" gap - the shield-activate control in
// collapsible-item-container-label-buttons.hbs never carried a `data-action` attribute at all
// until this same pass, so a real click couldn't even reach this code to crash. Both are fixed
// together here: the click wiring (this file's own history) and the template's missing
// data-action/its separately-broken `system.active` icon check (a bare `system` reference in a
// partial that's only ever passed `item`, so it always resolved to undefined - see the .hbs file).

function makeBallisticShield(overrides = {}) {
  return {
    _id: 'shield1',
    update: jest.fn(),
    system: {
      equipped: true,
      active: false,
      activeEffect: { type: 'defenseBonus', option1: { defense: 'toughness', value: 2 }, option2: { defense: 'toughness', value: 0 } },
      passiveEffect: { type: 'defenseBonus', option1: { defense: 'toughness', value: 1 }, option2: { defense: 'toughness', value: 0 } },
      ...overrides,
    },
  };
}

function makeActorSheet(shields) {
  const actor = {
    update: jest.fn(),
    items: { documentsByType: { shield: shields } },
  };
  return { actorSheet: { actor }, actor };
}

describe('onShieldActivationToggle', () => {
  test('errors and does nothing if the target id resolves to an unequipped shield', async () => {
    const shield = makeBallisticShield({ equipped: false });
    const { actorSheet, actor } = makeActorSheet([shield]);
    global.ui.notifications.error.mockClear();

    await onShieldActivationToggle({ dataset: { id: 'shield1' } }, actorSheet);

    expect(global.ui.notifications.error).toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
    expect(shield.update).not.toHaveBeenCalled();
  });

  test('resolves the shield via the clicked target\'s own data-id, not any other shield the actor holds', async () => {
    const decoy = makeBallisticShield({ equipped: false });
    decoy._id = 'decoy';
    const real = makeBallisticShield();
    const { actorSheet } = makeActorSheet([decoy, real]);

    await onShieldActivationToggle({ dataset: { id: 'shield1' } }, actorSheet);

    // The decoy (unequipped, wrong id) must never have been the one evaluated - if the lookup
    // fell back to the old broken event.currentTarget read, currentShield would stay null and
    // this would throw before either shield's own update() is ever touched.
    expect(real.update).toHaveBeenCalledWith({ 'system.active': true });
  });

  test('switching from passive to active clears every Defense shield bonus first, then applies the activeEffect value and flips active on', async () => {
    const shield = makeBallisticShield(); // active: false
    const { actorSheet, actor } = makeActorSheet([shield]);

    await onShieldActivationToggle({ dataset: { id: 'shield1' } }, actorSheet);

    expect(actor.update).toHaveBeenCalledWith({ 'system.defenses.toughness.shield': 0 });
    expect(actor.update).toHaveBeenCalledWith({ 'system.defenses.evasion.shield': 0 });
    expect(actor.update).toHaveBeenCalledWith({ 'system.defenses.willpower.shield': 0 });
    expect(actor.update).toHaveBeenCalledWith({ 'system.defenses.cleverness.shield': 0 });
    expect(actor.update).toHaveBeenCalledWith({ 'system.defenses.toughness.shield': 2 });
    expect(shield.update).toHaveBeenCalledWith({ 'system.active': true });
  });

  test('switching from active back to passive applies the passiveEffect value and flips active off', async () => {
    const shield = makeBallisticShield({ active: true });
    const { actorSheet, actor } = makeActorSheet([shield]);

    await onShieldActivationToggle({ dataset: { id: 'shield1' } }, actorSheet);

    expect(actor.update).toHaveBeenCalledWith({ 'system.defenses.toughness.shield': 1 });
    expect(shield.update).toHaveBeenCalledWith({ 'system.active': false });
  });
});

describe('onShieldEquipToggle', () => {
  test('checking the box applies the passiveEffect state (same shape as switching to passive)', async () => {
    const shield = makeBallisticShield();
    const { actorSheet, actor } = makeActorSheet([shield]);

    await onShieldEquipToggle({ dataset: { id: 'shield1' }, checked: true }, actorSheet);

    expect(actor.update).toHaveBeenCalledWith({ 'system.defenses.toughness.shield': 1 });
    expect(shield.update).toHaveBeenCalledWith({ 'system.active': false });
  });

  test('unchecking the box clears every Defense shield bonus and deactivates the shield', async () => {
    const shield = makeBallisticShield({ active: true });
    const { actorSheet, actor } = makeActorSheet([shield]);

    await onShieldEquipToggle({ dataset: { id: 'shield1' }, checked: false }, actorSheet);

    expect(actor.update).toHaveBeenCalledWith({ 'system.defenses.toughness.shield': 0 });
    expect(actor.update).toHaveBeenCalledWith({ 'system.defenses.evasion.shield': 0 });
    expect(actor.update).toHaveBeenCalledWith({ 'system.defenses.willpower.shield': 0 });
    expect(actor.update).toHaveBeenCalledWith({ 'system.defenses.cleverness.shield': 0 });
    expect(shield.update).toHaveBeenCalledWith({ 'system.active': false });
  });
});

describe('setShieldOptions (the defenseBonusOption/defenseBonusMixed ChoicesSelector callback)', () => {
  test('activeEffect choice sets the chosen Defense bonus and flips the shield active', async () => {
    const actor = { update: jest.fn() };
    const shield = { update: jest.fn() };

    await setShieldOptions(actor, shield, 'activeEffect', 3, 'evasion');

    expect(actor.update).toHaveBeenCalledWith({ 'system.defenses.evasion.shield': 3 });
    expect(shield.update).toHaveBeenCalledWith({ 'system.active': true });
  });

  test('passiveEffect choice flips the shield inactive', async () => {
    const actor = { update: jest.fn() };
    const shield = { update: jest.fn() };

    await setShieldOptions(actor, shield, 'passiveEffect', 1, 'toughness');

    expect(shield.update).toHaveBeenCalledWith({ 'system.active': false });
  });
});
