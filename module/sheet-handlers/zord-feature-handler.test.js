import { jest } from '@jest/globals';
import { onZordFeatureDrop } from './zord-feature-handler.mjs';

const RESTRAINING_CHAINS_ID = "Compendium.essence20.through_the_shattered_grid.Item.AVXOwNhDWQJewKAl";
// Their choices are `added` Triggers on the Features now (rules/plugins/zords/drop-configure.mjs; rules/conv15-other.test.js).
const RULE_CONFIGURED = {
  multiLimbAttack: "Compendium.essence20.through_the_shattered_grid.Item.cRtPjBG1OoXwKJ0b",
  increaseEssence: "Compendium.essence20.pr_crb.Item.oKGzWCOUCuefWuqD",
  lightChassis: "Compendium.essence20.pr_crb.Item.rVW7mvnV4MbGuxoq",
  movementBooster: "Compendium.essence20.pr_crb.Item.9YQmZGdNCmtXLAd4",
  enhanceAttack: "Compendium.essence20.pr_crb.Item.OibmwLDNcXE6eJIO",
  blastAttack: "Compendium.essence20.pr_crb.Item.Wb8UARwQKKyiwy77",
  zordMegaWeaponSystem: "Compendium.essence20.pr_crb.Item.Wc1FJ5YDeTQS6XoE",
};

function makeSourceItem(sourceId) {
  return { flags: { core: { sourceId } }, uuid: sourceId };
}

test.each(Object.entries(RULE_CONFIGURED))("%s drops straight through - its rules make the choice once it's on the Zord", async (key, id) => {
  global.foundry = { ...(global.foundry ?? {}), applications: { api: { DialogV2: { wait: jest.fn() } } } };
  const dropFunc = jest.fn(async () => ['ok']);
  expect(await onZordFeatureDrop({ items: [] }, makeSourceItem(id), dropFunc)).toEqual(['ok']);
  expect(global.foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
});

describe("Restraining Chains (Through the Shattered Grid, Zord Feature, p.35)", () => {
  // Its attack is an `added` Trigger on the Feature now (rules/conv14-other.test.js) - the drop is plain.
  test("drops straight through, making nothing by hand", async () => {
    const actor = { items: Object.assign([], { get: () => null }), createEmbeddedDocuments: jest.fn() };
    const dropFunc = jest.fn(async () => []);

    await onZordFeatureDrop(actor, makeSourceItem(RESTRAINING_CHAINS_ID), dropFunc);

    expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
    expect(dropFunc).toHaveBeenCalled();
  });
});

describe("onZordFeatureDrop default case", () => {
  test("falls through to dropFunc for any other Feature", async () => {
    const dropFunc = jest.fn(async () => ['ok']);
    const result = await onZordFeatureDrop({ items: [] }, makeSourceItem('some-other-id'), dropFunc);

    expect(result).toEqual(['ok']);
    expect(dropFunc).toHaveBeenCalled();
  });
});
