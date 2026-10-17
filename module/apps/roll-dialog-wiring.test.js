import fs from "fs";

// The Roll Options Dialog is wired in three places that nothing ties together: dice.mjs sets
// `updatedShiftDataset.<x>Available`, mechanics/rolls/roll-dialog.mjs copies it into the template context,
// templates/dialog/roll-dialog.hbs renders the control, and apps/roll-options-dialog.mjs reads the
// control back into skillRollOptions. A control missing from either copy step renders nothing or
// silently does nothing when ticked - about 20 Perk toggles were found in that state.
const template = fs.readFileSync("templates/dialog/roll-dialog.hbs", "utf8");
const rollDialog = fs.readFileSync("module/mechanics/rolls/roll-dialog.mjs", "utf8");
const rollOptionsDialog = fs.readFileSync("module/apps/roll-options-dialog.mjs", "utf8");

// Block-local helpers inside {{#each}} loops, not context fields.
const LOOP_LOCALS = new Set(["summaries"]);

describe("Roll Options Dialog wiring", () => {
  test("every form control in the template is read back by the dialog", () => {
    const names = new Set([...template.matchAll(/name="(\w+)"/g)].map((match) => match[1]));
    const unread = [...names].filter((name) => !rollOptionsDialog.includes(name));
    expect(unread).toEqual([]);
  });

  test("every top-level {{#if}} flag in the template is passed into the template context", () => {
    const flags = new Set([...template.matchAll(/\{\{#(?:if|unless) (\w+)/g)].map((match) => match[1]));
    const missing = [...flags].filter((flag) => !LOOP_LOCALS.has(flag) && !rollDialog.includes(flag));
    expect(missing).toEqual([]);
  });
});
