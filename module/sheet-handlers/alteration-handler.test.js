import { jest } from '@jest/globals';
import { onAlterationDrop } from './alteration-handler.mjs';

// Power Fist's granted attack is a Grant rule on the Alteration now (rules/conv14-other.test.js).
describe("onAlterationDrop - an 'other'-type Alteration", () => {
  function makeActor(items = []) {
    items.some = Array.prototype.some.bind(items);
    return { items, system: { level: 1 } };
  }

  beforeEach(() => {
    global.Item = { create: jest.fn() };
    global.game = { i18n: { localize: key => key } };
    global.ui = { notifications: { warn: jest.fn() } };
  });

  afterEach(() => {
    global.Item = undefined;
    global.game = undefined;
    global.ui = undefined;
  });

  test("stamps its originalId and grants nothing by hand, Power Fist included", async () => {
    const newAlteration = { update: jest.fn() };
    const dropFunc = jest.fn(async () => [newAlteration]);
    const alteration = { uuid: "Compendium.essence20.quartermasters_guide_to_gear.Item.7gT8dddccGA6gbGa", system: { type: "other" } };

    await onAlterationDrop(makeActor([]), alteration, dropFunc);

    expect(global.Item.create).not.toHaveBeenCalled();
    expect(newAlteration.update).toHaveBeenCalledWith({ "system.originalId": "7gT8dddccGA6gbGa" });
  });

  test("refuses an Alteration the actor already took", async () => {
    const actor = makeActor([{ type: "alteration", system: { originalId: "7gT8dddccGA6gbGa" } }]);
    const dropFunc = jest.fn();
    const alteration = { uuid: "Compendium.essence20.quartermasters_guide_to_gear.Item.7gT8dddccGA6gbGa", system: { type: "other" } };

    await onAlterationDrop(actor, alteration, dropFunc);

    expect(dropFunc).not.toHaveBeenCalled();
    expect(global.ui.notifications.warn).toHaveBeenCalledWith("E20.AlterationAlreadyTaken");
  });
});
