import { jest } from '@jest/globals';
import { confirmStopBeingContact, contactHolders, npcUseToggle, offerMakeContact } from './contacts.mjs';

describe('npcUseToggle (NPC sheet header buttons)', () => {
  test('each button flips its own flag, so both on is both', () => {
    expect(npcUseToggle({ isNPC: true, isContact: false }, 'isContact')).toEqual({ 'system.isContact': true });
    expect(npcUseToggle({ isNPC: true, isContact: true }, 'isNPC')).toEqual({ 'system.isNPC': false });
    expect(npcUseToggle({ isNPC: false, isContact: true }, 'isNPC')).toEqual({ 'system.isNPC': true });
  });

  test('the last one on stays on', () => {
    expect(npcUseToggle({ isNPC: true, isContact: false }, 'isNPC')).toBeNull();
    expect(npcUseToggle({ isNPC: false, isContact: true }, 'isContact')).toBeNull();
  });

  test('anything but the two flags is ignored', () => {
    expect(npcUseToggle({ isNPC: true, isContact: true }, 'canMorph')).toBeNull();
    expect(npcUseToggle({ isNPC: true, isContact: true }, undefined)).toBeNull();
  });
});

describe('offerMakeContact (NPC dropped on a character)', () => {
  const npc = ({ isContact = false, isOwner = true } = {}) => ({
    type: 'npc', name: 'Rook', isOwner, system: { isContact }, update: jest.fn(async () => {}),
  });
  let confirm;
  let savedApplications;

  beforeEach(() => {
    confirm = jest.fn();
    savedApplications = global.foundry.applications;
    global.foundry.applications = { api: { DialogV2: { confirm } } };
    global.foundry.utils.escapeHTML = value => value;
    global.game = { i18n: { localize: k => k, format: k => k } };
    global.ui = { notifications: { info: jest.fn(), warn: jest.fn() } };
  });

  afterEach(() => {
    global.foundry.applications = savedApplications;
    delete global.game;
    delete global.ui;
  });

  test('Yes makes it a Contact and lets the drop through', async () => {
    const actor = npc();
    confirm.mockResolvedValue(true);
    expect(await offerMakeContact(actor)).toBe(true);
    expect(actor.update).toHaveBeenCalledWith({ 'system.isContact': true });
  });

  test('No or closing the prompt blocks the drop', async () => {
    const actor = npc();
    confirm.mockResolvedValue(false);
    expect(await offerMakeContact(actor)).toBe(false);
    confirm.mockResolvedValue(null);
    expect(await offerMakeContact(actor)).toBe(false);
    expect(actor.update).not.toHaveBeenCalled();
  });

  test('a Contact already goes straight through; a user who cannot edit the NPC is refused', async () => {
    expect(await offerMakeContact(npc({ isContact: true }))).toBe(true);
    const notMine = npc({ isOwner: false });
    expect(await offerMakeContact(notMine)).toBe(false);
    expect(confirm).not.toHaveBeenCalled();
    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(notMine.update).not.toHaveBeenCalled();
  });
});

describe('confirmStopBeingContact (unticking Contact)', () => {
  const NPC = { uuid: 'Actor.rook', name: 'Rook' };
  const pc = (name, actors, isOwner = true) => ({
    type: 'playerCharacter', name, isOwner, system: { actors }, update: jest.fn(async () => {}),
  });
  let confirm;
  let savedApplications;
  let savedData;

  beforeEach(() => {
    confirm = jest.fn();
    savedApplications = global.foundry.applications;
    savedData = global.foundry.data;
    global.foundry.applications = { api: { DialogV2: { confirm } } };
    global.foundry.data = { operators: { ForcedDeletion: class ForcedDeletion {} } };
    global.foundry.utils.escapeHTML = value => value;
    global.ui = { notifications: { error: jest.fn() } };
  });

  afterEach(() => {
    global.foundry.applications = savedApplications;
    global.foundry.data = savedData;
    delete global.game;
    delete global.ui;
  });

  const world = actors => {
    global.game = { actors, i18n: { localize: k => k, format: k => k } };
  };

  test('finds the characters that list the NPC, and only those', () => {
    const alice = pc('Alice', { k1: { uuid: 'Actor.rook' }, k2: { uuid: 'Actor.other' } });
    const vehicle = { type: 'vehicle', system: { actors: { k: { uuid: 'Actor.rook' } } } };
    world([alice, pc('Bob', {}), vehicle]);
    expect(contactHolders(NPC)).toEqual([{ actor: alice, key: 'k1' }]);
  });

  test('nobody lists it: goes straight through', async () => {
    world([pc('Bob', {})]);
    expect(await confirmStopBeingContact(NPC)).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  test('confirmed: removes it from each character, then lets the untick through', async () => {
    const alice = pc('Alice', { k1: { uuid: 'Actor.rook' } });
    world([alice]);
    confirm.mockResolvedValue(true);
    expect(await confirmStopBeingContact(NPC)).toBe(true);
    expect(alice.update).toHaveBeenCalledWith({ 'system.actors.k1': expect.any(global.foundry.data.operators.ForcedDeletion) });
  });

  test('declined or closed: nothing changes', async () => {
    const alice = pc('Alice', { k1: { uuid: 'Actor.rook' } });
    world([alice]);
    confirm.mockResolvedValue(false);
    expect(await confirmStopBeingContact(NPC)).toBe(false);
    confirm.mockResolvedValue(null);
    expect(await confirmStopBeingContact(NPC)).toBe(false);
    expect(alice.update).not.toHaveBeenCalled();
  });

  test('a character the user cannot edit blocks it', async () => {
    const alice = pc('Alice', { k1: { uuid: 'Actor.rook' } }, false);
    world([alice]);
    expect(await confirmStopBeingContact(NPC)).toBe(false);
    expect(ui.notifications.error).toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
  });
});
