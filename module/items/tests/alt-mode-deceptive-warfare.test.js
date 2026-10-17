import { jest } from '@jest/globals';
import { registrySnapshot } from '../../mechanics/item-hooks.mjs';
// (Deceptive Warfare's Initiative reset - the tf3 slice's last Use - is its Perk's own Use rule: rules/conv17-split2.test.js.)
const USES = registrySnapshot().uses;
// (Unexpected Alternative and Third Dimension are their Perks' own rules - rules/conv15-items2.test.js.)

beforeEach(() => {
  global.game = {
    i18n: { localize: k => k, format: k => k }, user: { id: 'u1', targets: new Set() }, actors: [], combat: null,
    users: { contents: [], activeGM: { id: 'u1' } },
  };
  global.CONFIG = {
    E20: {
      skillShiftList: ['criticalSuccess', 'autoSuccess', '3d6', '2d8', 'd12', 'd10', 'd8', 'd6', 'd4', 'd2', 'd20', 'autoFail', 'fumble'],
      actorReach: { common: 5 }, skillToEssence: {}, defenses: {},
    },
  };
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.fromUuid = jest.fn(async uuid => game.actors.find(a => a.uuid == uuid) ?? null);
  global.foundry = { data: { operators: { ForcedDeletion: globalThis.foundry?.data?.operators?.ForcedDeletion ?? class ForcedDeletion {} } }, utils: { escapeHTML: s => s } };
});

// Ladder's extend / stow Use and its allies' ↑2 switch are rules on the gear (rules/conv12-slI12.test.js).

describe('defenses and derived data', () => {
  // Stoic, Ladder's Bot Mode Reach, Rotor Blades' Aerial and the one-hardpoint Water Cannon are rules now.
});

// Martyr, Last Stand, Roll With It and Intensive are rules on their Perks (rules/conv10-slB10.test.js).

describe('Use buttons', () => {
  test('Holographic Doubles, The Right Of All Sentient Beings and the gear weapons are rules now', () => {
    const ids = USES.map(use => use.id);
    for (const id of ['tf3HoloDoubles', 'tf3RightOfAll', 'tf3GearWeapon']) {
      expect(ids).not.toContain(id);
    }
  });

  test('Stoic and Ladder are rules now', async () => {
    expect(USES.map(use => use.id)).not.toContain('tf3Stoic');
    expect(USES.map(use => use.id)).not.toContain('tf3Ladder');
    expect(USES.map(use => use.id)).not.toContain('tf3DeceptiveWarfare');
  });
});
