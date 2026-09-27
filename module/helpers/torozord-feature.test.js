import { jest } from '@jest/globals';
import { grantTorozordFeature, buildTorozordFeatureChoices } from './torozord-feature.mjs';
import ChoicesSelector from '../apps/choices-selector.mjs';

// This project runs native ESM under Jest (no Babel transform), so the auto-hoisted
// jest.mock('./path') form isn't available here (see attachment-handler.test.js's own doc
// comment for the full explanation) - ChoicesSelector.render() is stubbed directly on the
// prototype instead, the same idiom that suite already established.

function makeZord(existingSourceIds = []) {
  return {
    name: 'Torozord',
    items: existingSourceIds.map(sourceId => ({ flags: { core: { sourceId } } })),
  };
}

describe("buildTorozordFeatureChoices", () => {
  beforeEach(() => {
    global.game.packs = [];
  });

  test("collects every feature-type index entry across all Item packs", async () => {
    global.game.packs = [
      {
        documentName: 'Item',
        getIndex: jest.fn().mockResolvedValue([
          { uuid: 'Compendium.essence20.pr_crb.Item.aaaa', name: 'Martial Zord', type: 'feature' },
          { uuid: 'Compendium.essence20.pr_crb.Item.bbbb', name: 'Zero-G', type: 'feature' },
          { uuid: 'Compendium.essence20.pr_crb.Item.cccc', name: 'Zord', type: 'perk' },
        ]),
      },
      {
        documentName: 'Item',
        getIndex: jest.fn().mockResolvedValue([
          { uuid: 'Compendium.essence20.across_the_stars.Item.dddd', name: 'Sentience', type: 'feature' },
        ]),
      },
    ];

    const choices = await buildTorozordFeatureChoices(makeZord());

    expect(Object.keys(choices)).toEqual([
      'Compendium.essence20.pr_crb.Item.aaaa',
      'Compendium.essence20.pr_crb.Item.bbbb',
      'Compendium.essence20.across_the_stars.Item.dddd',
    ]);
    expect(choices['Compendium.essence20.pr_crb.Item.aaaa']).toMatchObject({
      label: 'Martial Zord',
      value: 'Compendium.essence20.pr_crb.Item.aaaa',
      entry: { uuid: 'Compendium.essence20.pr_crb.Item.aaaa', name: 'Martial Zord', type: 'feature' },
    });
  });

  test("excludes a feature the Zord already holds (by flags.core.sourceId)", async () => {
    global.game.packs = [
      {
        documentName: 'Item',
        getIndex: jest.fn().mockResolvedValue([
          { uuid: 'Compendium.essence20.pr_crb.Item.aaaa', name: 'Martial Zord', type: 'feature' },
          { uuid: 'Compendium.essence20.pr_crb.Item.bbbb', name: 'Zero-G', type: 'feature' },
        ]),
      },
    ];

    const choices = await buildTorozordFeatureChoices(makeZord(['Compendium.essence20.pr_crb.Item.aaaa']));

    expect(Object.keys(choices)).toEqual(['Compendium.essence20.pr_crb.Item.bbbb']);
  });

  test("ignores non-Item packs", async () => {
    global.game.packs = [
      { documentName: 'Actor', getIndex: jest.fn().mockResolvedValue([{ uuid: 'x', type: 'feature' }]) },
    ];

    expect(await buildTorozordFeatureChoices(makeZord())).toEqual({});
  });
});

describe("grantTorozordFeature", () => {
  let capturedDialog = null;

  beforeEach(() => {
    capturedDialog = null;
    global.game.packs = [];
    ChoicesSelector.prototype.render = jest.fn(function () {
      capturedDialog = this;
      return this;
    });
    global.fromUuidSync = jest.fn();
    global.ui.notifications.warn.mockClear();
    global.ui.notifications.error.mockClear();
  });

  test("warns and does nothing when the actor has no owned Zord", async () => {
    const actor = { system: { actors: {} } };
    await grantTorozordFeature(actor, { name: 'Torozord Feature' });

    expect(global.ui.notifications.warn).toHaveBeenCalledWith('E20.TorozordFeatureNoZord');
    expect(ChoicesSelector.prototype.render).not.toHaveBeenCalled();
  });

  test("errors and does nothing when no eligible Zord Features are found", async () => {
    const zord = makeZord();
    global.fromUuidSync.mockReturnValue(zord);
    const actor = { system: { actors: { a: { uuid: 'Actor.torozord', type: 'zord' } } } };
    global.game.packs = [{ documentName: 'Item', getIndex: jest.fn().mockResolvedValue([]) }];

    await grantTorozordFeature(actor, { name: 'Torozord Feature' });

    expect(global.ui.notifications.error).toHaveBeenCalledWith('E20.NoChoicesError');
    expect(ChoicesSelector.prototype.render).not.toHaveBeenCalled();
  });

  test("opens a ChoicesSelector targeting the Zord (not the pilot) with the real candidates", async () => {
    const zord = makeZord();
    global.fromUuidSync.mockReturnValue(zord);
    const actor = { system: { actors: { a: { uuid: 'Actor.torozord', type: 'zord' } } } };
    global.game.packs = [
      {
        documentName: 'Item',
        getIndex: jest.fn().mockResolvedValue([
          { uuid: 'Compendium.essence20.pr_crb.Item.aaaa', name: 'Martial Zord', type: 'feature' },
        ]),
      },
    ];
    const perk = { name: 'Torozord Feature' };

    await grantTorozordFeature(actor, perk);

    expect(ChoicesSelector.prototype.render).toHaveBeenCalledWith(true);
    expect(capturedDialog._actor).toBe(zord);
    expect(capturedDialog._item).toBe(perk);
    expect(capturedDialog._actionType).toBe('rolePerk');
    expect(Object.keys(capturedDialog._choices)).toEqual(['Compendium.essence20.pr_crb.Item.aaaa']);
  });
});
