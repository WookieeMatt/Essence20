import { registerUse } from "../../mechanics/item-hooks.mjs";
import { JTT, post } from "../shared/pay-power-and-actors-in-play.mjs";
import { T } from "../shared/item-lang.mjs";
import { isFrom, sourceOf } from "../shared/item-lookups.mjs";

/**
 * Special Program (A Jump Through Time, Origin Perk, p.26): "You may choose any General Perk for
 * which you meet the prerequisites." Offered when the Origin Perk arrives and from its Use button
 * until a pick is made. Prerequisites are free text in the packs, so each option shows its own
 * for the player to check.
 */
export const SPECIAL_PROGRAM_ID = JTT('wKGrImiofaMrni0m');

async function pickSpecialProgram(item) {
  const actor = item.parent;
  const { findItems, grantCopy } = await import("../../mechanics/resources/grants.mjs");
  const rows = await findItems({ type: 'perk', fields: ['system.prerequisite'], matches: entry => entry.system?.type == 'general' });
  const options = rows
    .map(row => ({ value: row.uuid, label: row.system?.prerequisite ? `${row.name} (${row.system.prerequisite})` : row.name }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const { chooseSelect } = await import("../../mechanics/resources/grants.mjs");
  const uuid = await chooseSelect(item.name, T('O1SpecialProgramPrompt'), options);
  if (!uuid) {
    return null;
  }

  const created = await grantCopy(actor, uuid, { grantedBy: item });
  if (created) {
    await item.setFlag('essence20', 'o1Picked', uuid);
  }

  return created ? T('O1SpecialProgramGranted', { name: actor.name, perk: created.name }) : null;
}

registerUse({
  id: 'o1SpecialProgram',
  matches: isFrom(SPECIAL_PROGRAM_ID),
  canUse: item => !item.flags?.essence20?.o1Picked,
  run: item => pickSpecialProgram(item),
});

Hooks.on('createItem', async (item, options, userId) => {
  if (userId != game.user?.id || sourceOf(item) != SPECIAL_PROGRAM_ID || !item.parent || item.flags?.essence20?.o1Picked) {
    return;
  }

  const line = await pickSpecialProgram(item);
  if (line) {
    await post(item.parent, line);
  }
});
