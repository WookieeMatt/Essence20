import { RollDialog } from './roll-dialog.mjs';

const PRESENCE_ID = "Compendium.essence20.gi_joe_crb.Item.EdP0LqcYh2tkMygI";

function makeActor(perkIds = []) {
  return { items: perkIds.map(perkId => ({ type: 'perk', flags: { core: { sourceId: perkId } } })) };
}

/* _isUntrainedSnag */
describe("_isUntrainedSnag", () => {
  const rollDialog = new RollDialog();

  test("true for an untrained (d20-shift) skill, no Presence", () => {
    const actor = makeActor();
    expect(rollDialog._isUntrainedSnag({ shift: 'd20' }, actor)).toBe(true);
  });

  test("false for a trained skill (non-d20 shift)", () => {
    const actor = makeActor();
    expect(rollDialog._isUntrainedSnag({ shift: 'd8' }, actor)).toBe(false);
  });

  test("false for an untrained skill when the actor has Presence", () => {
    const actor = makeActor([PRESENCE_ID]);
    expect(rollDialog._isUntrainedSnag({ shift: 'd20' }, actor)).toBe(false);
  });

  test("Presence doesn't matter for an already-trained skill", () => {
    const actor = makeActor([PRESENCE_ID]);
    expect(rollDialog._isUntrainedSnag({ shift: 'd8' }, actor)).toBe(false);
  });
});
