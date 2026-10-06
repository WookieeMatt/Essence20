import { registerUse } from "../../mechanics/item-hooks.mjs";
import {
  sourceOf, T, TF3,
} from "../shared/bot-alt-mode-readers.mjs";

/**
 * Use buttons for the tf3 slice (Transformers CRB / Transformers One Sourcebook). Holographic Doubles,
 * The Right Of All Sentient Beings, the Alt Mode Gear weapons (Rotor Blades, Tow Cable & Hook, Water
 * Cannon) and One Bot Over Another (its weapon picks and their Qualification) are rules on their pack items, and so are
 * Irrefutable Order, Target Breakdown and Whisper Campaign (rules/conv10-slD10.test.js) and Ladder's extend / stow
 * (rules/conv12-slI12.test.js).
 */

async function grantsApi() {
  return import("../../mechanics/resources/grants.mjs");
}

function combatantOf(actor) {
  const combat = game.combat;
  return combat?.combatants?.find?.(c => c.actor?.id == actor?.id) ?? null;
}

/* -------------------------------------------- */
/*  Deceptive Warfare                            */
/* -------------------------------------------- */

/**
 * Deceptive Warfare (Transformers One Sourcebook, High Guard, p.16): "When you reset your initiative
 * ..., you can do so at the cost of two Free actions instead of a Move action". Resetting Your
 * Initiative (TF CRB p.142): "after the first round, you can use a Move action to reset your
 * Initiative. Roll a new Initiative Skill Test ... If the result is higher than your current place in
 * the Initiative order, it becomes your new place ... Otherwise, you keep their place". The
 * Deception/Infiltration substitute is already on the Initiative roll's own dialog (dice.mjs).
 */
export async function useDeceptiveWarfare(item, economy, pay) {
  const actor = item.parent;
  const combat = game.combat;
  const combatant = combatantOf(actor);
  if (!combat || !combatant) {
    ui.notifications.warn(T('Tf3CombatOnly'));
    return null;
  }

  if ((combat.round ?? 0) < 2) {
    ui.notifications.warn(T('Tf3ResetFirstRound'));
    return null;
  }

  const { chooseButtons } = await grantsApi();
  const cost = await chooseButtons(item.name, T('Tf3ResetPrompt'), [['twoFree', T('Tf3ResetTwoFree')], ['move', T('Tf3ResetMove')]]);
  if (!cost || !(await pay(cost))) {
    return null;
  }

  const before = Number(combatant.initiative);
  await combat.rollInitiative([combatant.id]);
  const after = Number(combat.combatants?.get?.(combatant.id)?.initiative ?? combatant.initiative);
  if (Number.isFinite(before) && !(after > before)) {
    await combatant.update({ initiative: before });
    return T('Tf3ResetKept', { name: actor.name, before, after });
  }

  return T('Tf3ResetMoved', { name: actor.name, after });
}

/* -------------------------------------------- */
/*  Registration                                 */
/* -------------------------------------------- */

const bySource = uuid => item => sourceOf(item) == uuid;

export const USES = [
  { id: 'tf3DeceptiveWarfare', matches: bySource(TF3.deceptiveWarfare), canUse: () => !!game.combat, run: useDeceptiveWarfare },
];

USES.forEach(registerUse);

