import { jest } from '@jest/globals';

const worldList = [];
let nextRoll = 1;

let ext;
let crb;

beforeAll(async () => {
  global.Hooks = { on: jest.fn(), once: jest.fn() };
  global.game = {
    i18n: { localize: k => k, format: k => k },
    user: { id: 'u1', isGM: true, targets: new Set() },
    actors: { contents: worldList },
    users: { activeGM: null },
    settings: { get: () => 1 },
    combat: null,
  };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } };
  global.CONFIG = {
    E20: { actorSizes: { small: 's', common: 'c', large: 'l', huge: 'h', gigantic: 'g', towering: 't' }, skillShiftList: ['d12', 'd10', 'd8', 'd6', 'd4', 'd2', 'd20'] },
    statusEffects: [{ id: 'prone', name: 'Prone' }],
  };
  global.foundry = { utils: { deepClone: v => JSON.parse(JSON.stringify(v ?? null)) }, applications: { api: {} } };
  global.Roll = class {
    constructor(formula) {
      this.formula = formula;
    }

    async evaluate() {
      this.total = nextRoll;
      return this;
    }
  };
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.Actor = class {};
  global.fromUuid = async uuid => worldList.find(a => a.uuid == uuid) ?? null;
  global.fromUuidSync = uuid => worldList.find(a => a.uuid == uuid) ?? null;

  ext = await import('../../mechanics/item-hooks.mjs');
  crb = {
    ...(await import('../gear/power-ranger-standard-issue.mjs')),
  };
});

beforeEach(() => {
  worldList.length = 0;
  global.game.combat = null;
  nextRoll = 1;
});

describe('registration', () => {
  test('Use buttons and hooks are registered', () => {
    const ids = ext.registrySnapshot().uses.map(u => u.id);
    // Ninja Power's jump / switch off are the Perk's own rules (module/rules/conv18-convC.test.js).
    expect(ids).not.toContain('pr3NinjaPower');
    // Power Heal's Use (heal, or remove a Condition) is the Power's own Use rule (module/rules/conv17-split2.test.js).
    expect(ids).not.toContain('pr3PowerHealCondition');
    // Elemental Fury is the Zord Feature's own rules (rules/conv15-items2.test.js).
    expect(ids).not.toContain('pr3ElementalFury');
    // Emissary's Gift is the Perk's own Use rule now (module/rules/conv10-slA10.test.js).
    expect(ids).not.toContain('pr3EmissarysGift');
    // Protector of Safehaven's gift, its mission-long marks and Roll Options switches are the Perk's own rules now.
    expect(ids).not.toContain('pr3Safehaven');
    // Morphin Navigator's Grid Power Bloom is the item's own Use rule now.
    expect(ids).not.toContain('pr3Navigator');
    // Zord Mount's rider pick and follow-up note are the Feature's own rules now.
    expect(ids).not.toContain('pr3ZordMount');
    // Unique Weapon's pick and the Ranged weapon's store / draw are their items' own Use rules now.
    expect(ids).not.toContain('pr3UniqueWeapon');
    expect(ids).not.toContain('pr3UniqueStore');
    expect(global.Hooks.on).toHaveBeenCalledWith('updateItem', expect.any(Function));
  });
});

describe('Standard Issue', () => {
  test('notices the package landing on the Power Morpher', () => {
    const changes = { flags: { essence20: { equipmentPackage: { name: 'Power Ranger Standard Issue' } } } };
    expect(crb.isStandardIssueLanding({ name: 'Power Morpher' }, changes)).toBe(true);
    expect(crb.isStandardIssueLanding({ name: 'Blade Blaster' }, changes)).toBe(false);
    expect(crb.isStandardIssueLanding({ name: 'Power Morpher' }, {})).toBe(false);
  });
});
