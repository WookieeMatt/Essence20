import { jest } from '@jest/globals';
import { npcUseToggle, offerMakeContact } from './contacts.mjs';

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
