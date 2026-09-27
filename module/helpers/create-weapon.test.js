import { jest } from '@jest/globals';
import { activateCreateWeapon, CREATE_WEAPON_FORMS, pickCreateWeaponForm } from './create-weapon.mjs';

const CLOSE_COMBAT_BLADE_ID = "Compendium.essence20.gi_joe_crb.Item.8lNIijY5XompKHH7";
const CLOSE_COMBAT_BLUDGEONING_ID = "Compendium.essence20.gi_joe_crb.Item.ZNokHTRBa5aindap";

// perk-handler.mjs's grantIntegratedWeapon is run for REAL rather than module-mocked - see
// attachment-handler.test.js's own note on why unstable_mockModule isn't used in this project.
// Everything it touches (fromUuid, Item.create, and the weaponEffect copy pass) is reachable
// through globals, which makes this an end-to-end check of the grant rather than of a mock.
describe("Create Weapon (Quartermaster's Guide to Gear, Grid Power)", () => {
  const wait = jest.fn();

  function makeActor(items = []) {
    items.some = Array.prototype.some.bind(items);
    return { id: 'ranger1', items, system: { level: 1 } };
  }

  beforeEach(() => {
    wait.mockReset();
    global.foundry = {
      applications: { api: { DialogV2: { wait } } },
      data: { operators: { ForcedDeletion: class {} } },
    };
    global.game = { i18n: { localize: key => key } };
    global.fromUuid = jest.fn(async uuid => ({ uuid, type: 'weapon', system: { items: {} } }));
    global.Item = { create: jest.fn(async data => ({ ...data, type: 'weapon', system: { items: {} } })) };
  });

  afterEach(() => {
    global.foundry = undefined;
    global.game = undefined;
    global.fromUuid = undefined;
    global.Item = undefined;
  });

  // RAW's two forms, mapped onto weapons already in the packs rather than anything newly authored.
  test("the form table points at the real Close Combat weapons", () => {
    expect(CREATE_WEAPON_FORMS).toEqual({
      blade: CLOSE_COMBAT_BLADE_ID,
      bludgeon: CLOSE_COMBAT_BLUDGEONING_ID,
    });
  });

  test("grows a blade when that form is chosen", async () => {
    wait.mockResolvedValue('blade');
    const actor = makeActor();

    expect(await activateCreateWeapon(actor)).toBe('blade');
    expect(global.Item.create).toHaveBeenCalledWith(
      expect.objectContaining({ uuid: CLOSE_COMBAT_BLADE_ID }), { parent: actor },
    );
  });

  test("grows a bludgeon when that form is chosen", async () => {
    wait.mockResolvedValue('bludgeon');
    const actor = makeActor();

    expect(await activateCreateWeapon(actor)).toBe('bludgeon');
    expect(global.Item.create).toHaveBeenCalledWith(
      expect.objectContaining({ uuid: CLOSE_COMBAT_BLUDGEONING_ID }), { parent: actor },
    );
  });

  // A cancelled pick must not grow anything - the Power's own cost is spent before this runs, so
  // the grant is the only thing left to protect.
  test("grants nothing when the picker is cancelled", async () => {
    wait.mockResolvedValue('cancel');

    expect(await activateCreateWeapon(makeActor())).toBe(null);
    expect(global.Item.create).not.toHaveBeenCalled();
  });

  test("grants nothing when the dialog is dismissed outright", async () => {
    wait.mockResolvedValue(null);

    expect(await activateCreateWeapon(makeActor())).toBe(null);
    expect(global.Item.create).not.toHaveBeenCalled();
  });

  // "Lasts for 1 scene" isn't enforced, so re-activating the same form has to be harmless.
  test("re-growing the same form grants nothing twice", async () => {
    wait.mockResolvedValue('blade');
    const actor = makeActor([{ type: 'weapon', flags: { core: { sourceId: CLOSE_COMBAT_BLADE_ID } } }]);

    expect(await activateCreateWeapon(actor)).toBe('blade');
    expect(global.Item.create).not.toHaveBeenCalled();
  });

  test("pickCreateWeaponForm returns null on cancel and the key on confirm", async () => {
    wait.mockResolvedValue('cancel');
    expect(await pickCreateWeaponForm()).toBe(null);

    wait.mockResolvedValue('bludgeon');
    expect(await pickCreateWeaponForm()).toBe('bludgeon');
  });
});
