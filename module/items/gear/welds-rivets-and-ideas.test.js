import { jest } from '@jest/globals';
import { activateWeldsRivetsAndIdeas, rollWeldsRivetsAndIdeas } from './welds-rivets-and-ideas.mjs';

function setGame({ sceneEpoch = 1, packs = [] } = {}) {
  packs.filter = Array.prototype.filter.bind(packs);
  global.game = {
    settings: { get: jest.fn((scope, key) => (key == 'enabledSourcebooks' ? {} : sceneEpoch)) },
    i18n: { localize: (k) => k, format: (k) => k },
    packs,
  };
  global.ui = { notifications: { warn: jest.fn() } };
  global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } }, utils: {} };
}

function makePack({ items = [] } = {}) {
  return {
    documentName: 'Item',
    metadata: { id: 'essence20.a' },
    getIndex: jest.fn(async () => new Map(items.map((item, i) => [`entry${i}`, item]))),
  };
}

describe("Welds, Rivets, and Ideas (Decepticon Directive, Salvaged Origin Benefit, p.38)", () => {
  test("rollWeldsRivetsAndIdeas rolls a flat DIF 12 Technology test flagged for the success dispatch", async () => {
    setGame();
    const actor = { _dice: { rollSkill: jest.fn() } };

    await rollWeldsRivetsAndIdeas(actor);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'technology', dif: '12', isWeldsRivetsAndIdeasAttempt: true }),
      actor,
    );
  });

  test("activateWeldsRivetsAndIdeas warns when nothing emulatable is found", async () => {
    setGame({ packs: [] });

    await activateWeldsRivetsAndIdeas({});

    expect(ui.notifications.warn).toHaveBeenCalled();
  });

  test("activateWeldsRivetsAndIdeas grants the chosen item, flagged with the current scene epoch", async () => {
    const gearEntry = { uuid: 'Compendium.x.gear.Item.g1', name: 'Grappling Hook', type: 'gear', img: null, system: { availability: 'limited' } };
    setGame({ sceneEpoch: 3, packs: [makePack({ items: [gearEntry] })] });
    foundry.applications.api.DialogV2.wait.mockResolvedValue(gearEntry.uuid);

    const sourceItem = { toObject: () => ({ name: 'Grappling Hook', type: 'gear', flags: {} }) };
    global.fromUuid = jest.fn(async () => sourceItem);
    global.Item = { create: jest.fn() };
    const actor = {};

    await activateWeldsRivetsAndIdeas(actor);

    expect(Item.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Grappling Hook',
        flags: { essence20: { weldsRivetsAndIdeasEpoch: 3 } },
      }),
      { parent: actor },
    );
  });
});
