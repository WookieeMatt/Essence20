/**
 * Transformers (Enigma of Combination) - Again and Again and Again's follow-up attacks. (The other attack-side
 * Perks once kept with it: Cover blasts are ./cover-blasts.mjs, Perfect Placement items/defenses/perfect-placement.mjs
 * and the Scramble Field Generator items/gear/scramble-field-generator.mjs. Holographic Sights and Balance and
 * Compensation are item rules - rules/conv10-slC10.test.js.)
 */
import { registerApplyDialog, registerChatButton, registerPostRoll } from "../../mechanics/item-hooks.mjs";
import { O3, parentWeaponOf } from "../shared/mlp-pr-tf-ids-and-skill-total.mjs";
import { T } from "../shared/item-lang.mjs";
import { has } from "../shared/item-lookups.mjs";
import { num } from "../shared/numbers.mjs";
import { sameTurn, turnStamp } from "../shared/turn-stamps.mjs";

// (EM Protective Lining, the Enigma of Combination armor upgrade, is its item's own rules: an incoming ↓6 on
// Electromagnetic attacks against a Computerized wearer, and a per-attack Defense giving back the computerized
// armor's Evasion those attacks ignore - both while its armor is worn, or in Alt Mode when it isn't attached.)

// (Same Principle, the TF CRB Gunner Perk, is its item's own rules: a Use picking the weapon - the old
// o3SameWeapon flag carries over - and a WeaponTrait rule making the picked weapon Ballistic.)

/*
 * Again and Again and Again (Enigma of Combination, Pugilist, 17th level, p.39): "if an attack that
 * benefits from your Puissance Focus Perk successfully hits a target, you may choose to immediately
 * make an additional identical attack against the same target at ↓1. If that attack hits, you may
 * choose to make another additional identical attack against the same target with an additional ↓2
 * (for a total of ↓3). Only two additional such attacks can be taken in a single turn." A Puissance
 * attack is one with no weapon behind it (dice.mjs PUISSANCE_ID's own reading).
 */
const AGAIN_FLAG = 'o3AgainCount';
let pendingAgain = null;

export function againShift(step) {
  return step >= 2 ? 3 : 1;
}

export function againCount(actor) {
  const record = actor?.flags?.essence20?.[AGAIN_FLAG];
  return record && sameTurn(record.stamp, turnStamp()) ? num(record.count) : 0;
}

registerApplyDialog((actor, options, ctx) => {
  const step = num(ctx?.dataset?.o3AgainStep);
  if (step) {
    options.shiftDown = num(options.shiftDown) + againShift(step);
  }
});

registerPostRoll(async (actor, results, checkContext, { hits, rider } = {}) => {
  const step = pendingAgain?.actorId == actor?.id ? pendingAgain.step : 0;
  pendingAgain = null;
  if (!checkContext?.isAttack || !has(actor, O3.againAndAgain) || !has(actor, O3.puissance) || !actor.isOwner) {
    return;
  }

  const item = rider?.itemUuid ? await fromUuid(rider.itemUuid) : null;
  if (item?.type != 'weaponEffect' || parentWeaponOf(actor, item)) {
    return;
  }

  const hit = (hits ?? []).find(h => h.hit);
  if (!hit || step >= 2 || againCount(actor) >= 2) {
    return;
  }

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<button type="button" data-e20-ext="o3Again" data-actor="${actor.uuid}" data-item="${item.uuid}" data-target="${hit.target.uuid}" data-step="${step + 1}">${T('O3AgainButton', { shift: againShift(step + 1) })}</button>`,
  });
});

registerChatButton('o3Again', async (message, button) => {
  const actor = await fromUuid(button.dataset.actor);
  const item = await fromUuid(button.dataset.item);
  const target = await fromUuid(button.dataset.target);
  if (!actor?.isOwner || !item || button.dataset.done) {
    return;
  }

  if (againCount(actor) >= 2) {
    ui.notifications.warn(T('O3AgainMax'));
    return;
  }

  button.dataset.done = '1';
  const token = target?.getActiveTokens?.()?.[0];
  token?.setTarget?.(true, { releaseOthers: true });
  await actor.setFlag('essence20', AGAIN_FLAG, { stamp: turnStamp(), count: againCount(actor) + 1 });
  const step = num(button.dataset.step) || 1;
  pendingAgain = { actorId: actor.id, step };
  await item.roll({ rollType: 'weaponEffect', bypassEconomy: true, o3AgainStep: step });
});

// (Bump & Run - the ↑1, the Stun and the Impaired - is its Perk's own rules: rules/conv10-slC10.test.js.)
