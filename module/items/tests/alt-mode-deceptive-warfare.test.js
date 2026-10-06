import { jest } from '@jest/globals';
import { TF3 } from '../shared/bot-alt-mode-readers.mjs';
import {
  tf3RollSources, UNEXPECTED_FLAG,
} from '../rolls/unexpected-alternative.mjs';
import { USES } from '../rolls/deceptive-warfare.mjs';
import {
  onMovementUsed, thirdDimensionUsed, unexpectedUpdates,
} from '../forms/converting-third-dimension.mjs';

function flagged(obj) {
  obj.flags ??= {};
  obj.flags.essence20 ??= {};
  obj.getFlag = (scope, key) => obj.flags?.[scope]?.[key];
  obj.setFlag = jest.fn(async (scope, key, value) => {
    obj.flags[scope] ??= {};
    obj.flags[scope][key] = value;
  });
  obj.unsetFlag = jest.fn(async (scope, key) => {
    delete obj.flags?.[scope]?.[key];
  });
  obj.update = jest.fn(async (changes) => {
    for (const [key, value] of Object.entries(changes)) {
      const parts = key.split('.');
      let target = obj;
      for (const part of parts.slice(0, -1)) {
        target[part] ??= {};
        target = target[part];
      }

      target[parts.at(-1)] = value;
    }
  });
  return obj;
}

const item = (uuid, extra = {}) => flagged({
  id: extra.id ?? uuid.slice(-6), name: extra.name ?? 'Item', type: extra.type ?? 'perk', system: extra.system ?? {},
  flags: { core: { sourceId: uuid }, essence20: extra.flags ?? {} },
});
const actor = (items = [], extra = {}) => {
  const a = flagged({
    id: extra.id ?? 'a', uuid: extra.uuid ?? `Actor.${extra.id ?? 'a'}`, name: extra.name ?? 'A', type: extra.type ?? 'playerCharacter',
    system: extra.system ?? {}, flags: { essence20: extra.flags ?? {} }, items: { contents: items }, isOwner: true,
  });
  items.forEach(i => (i.parent = a));
  return a;
};

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
  global.foundry = { utils: { escapeHTML: s => s } };
});

describe('roll sources', () => {
  test('Unexpected Alternative: Edge on the surprised enemy only', () => {
    const holder = actor([item(TF3.unexpectedAlternative)], { flags: { [UNEXPECTED_FLAG]: { targets: ['Actor.e'], stamp: { scene: 1 } } } });
    expect(tf3RollSources(holder, { uuid: 'Actor.e' }, {}).sources[0].edge).toBe(true);
    expect(tf3RollSources(holder, { uuid: 'Actor.f' }, {}).sources).toEqual([]);
  });
});

// Ladder's extend / stow Use and its allies' ↑2 switch are rules on the gear (rules/conv12-slI12.test.js).

describe('defenses and derived data', () => {
  // Stoic, Ladder's Bot Mode Reach, Rotor Blades' Aerial and the one-hardpoint Water Cannon are rules now.
});

describe('requisition and movement', () => {
  test('Third Dimension counts only the distance since the last change of movement type', () => {
    const movement = {
      history: { recorded: { waypoints: [{ action: 'walk', cost: 0 }, { action: 'walk', cost: 20 }] } },
      passed: { waypoints: [{ action: 'fly', cost: 15 }] }, pending: { waypoints: [] },
    };
    expect(thirdDimensionUsed(movement)).toBe(15);
    const out = { used: 35 };
    onMovementUsed(actor([item(TF3.thirdDimension)]), movement, out);
    expect(out.used).toBe(15);
    const plain = { used: 35 };
    onMovementUsed(actor(), movement, plain);
    expect(plain.used).toBe(35);
  });
});

describe('reactions', () => {
  test('Unexpected Alternative: an enemy who saw only the other Alt Mode', () => {
    const holder = actor([item(TF3.unexpectedAlternative)], { flags: { tf3SeenModes: { 'Actor-e': ['car'], 'Actor-f': ['jet'] } } });
    const updates = unexpectedUpdates(holder, 'jet', [{ uuid: 'Actor.e' }, { uuid: 'Actor.f' }, { uuid: 'Actor.g' }]);
    expect(updates['flags.essence20.tf3UnexpectedEdge'].targets).toEqual(['Actor.e']);
    expect(updates['flags.essence20.tf3SeenModes']).toMatchObject({ 'Actor-e': ['car', 'jet'], 'Actor-g': ['jet'] });
  });

  // Martyr, Last Stand, Roll With It and Intensive are rules on their Perks (rules/conv10-slB10.test.js).

});

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
  });
});
