import { jest } from '@jest/globals';
import { onAlterationDrop } from './alteration-handler.mjs';

const POWER_FIST_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.7gT8dddccGA6gbGa";
const CLOSE_COMBAT_HEAVY_BLUDGEONING_ID = "Compendium.essence20.gi_joe_crb.Item.xthnRWfhbfXvpmZN";

// perk-handler.mjs's grantIntegratedWeapon is run for REAL rather than module-mocked - see
// create-weapon.test.js's own identical note on why unstable_mockModule isn't used in this
// project.
describe("onAlterationDrop - Power Fist (Quartermaster's Guide to Gear, p.93)", () => {
  function makeActor(items = []) {
    items.some = Array.prototype.some.bind(items);
    return { items, system: { level: 1 } };
  }

  function makeAlteration(uuid, type = 'other') {
    return { uuid, system: { type } };
  }

  beforeEach(() => {
    global.fromUuid = jest.fn(async uuid => ({ uuid, type: 'weapon', system: { items: {} } }));
    global.Item = { create: jest.fn(async data => ({ ...data, type: 'weapon', system: { items: {} } })) };
    global.game = { i18n: { localize: key => key } };
    global.ui = { notifications: { warn: jest.fn() } };
  });

  afterEach(() => {
    global.fromUuid = undefined;
    global.Item = undefined;
    global.game = undefined;
    global.ui = undefined;
  });

  test("grants Close Combat Heavy Bludgeoning alongside the ordinary alteration drop", async () => {
    const actor = makeActor([]);
    const newAlteration = { update: jest.fn() };
    const dropFunc = jest.fn(async () => [newAlteration]);
    const alteration = makeAlteration(POWER_FIST_ID);

    await onAlterationDrop(actor, alteration, dropFunc);

    expect(global.fromUuid).toHaveBeenCalledWith(CLOSE_COMBAT_HEAVY_BLUDGEONING_ID);
    expect(global.Item.create).toHaveBeenCalledWith(
      { uuid: CLOSE_COMBAT_HEAVY_BLUDGEONING_ID, type: 'weapon', system: { items: {} } },
      { parent: actor },
    );
    expect(newAlteration.update).toHaveBeenCalledWith({ "system.originalId": "7gT8dddccGA6gbGa" });
  });

  test("does not grant a weapon for an unrelated 'other'-type alteration", async () => {
    const actor = makeActor([]);
    const newAlteration = { update: jest.fn() };
    const dropFunc = jest.fn(async () => [newAlteration]);
    const alteration = makeAlteration("Compendium.essence20.cobra_codex.Item.someOtherAlteration");

    await onAlterationDrop(actor, alteration, dropFunc);

    expect(global.Item.create).not.toHaveBeenCalled();
  });

  test("does not grant a second copy if the actor already has one", async () => {
    const actor = makeActor([
      { type: 'weapon', flags: { core: { sourceId: CLOSE_COMBAT_HEAVY_BLUDGEONING_ID } } },
    ]);
    const newAlteration = { update: jest.fn() };
    const dropFunc = jest.fn(async () => [newAlteration]);
    const alteration = makeAlteration(POWER_FIST_ID);

    await onAlterationDrop(actor, alteration, dropFunc);

    expect(global.Item.create).not.toHaveBeenCalled();
  });
});
