import { npcUseToggle } from './contacts.mjs';

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
