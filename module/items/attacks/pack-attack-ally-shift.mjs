import { registerRollSources } from "../../mechanics/item-hooks.mjs";
import { packAttackGrant } from "./pack-attack.mjs";

/**
 * Fix pass 3, GI JOE group: book-accuracy fixes that plug in through the extension points rather
 * than dice.mjs.
 * - Pack Attack (Cobra Codex, Warthog, p.69): the allies' ↑1 on every attack against the Growled
 *   target until the start of the user's next turn (record written by items/attacks/pack-attack.mjs).
 *
 * Mega Training Regimen, Surgical Operators and One With Your Weapon are item rules now
 * (rules/conversions.test.js), and so is the Angry Hang-Up's Snag (check:angrySnag - rules/conv10-slC10.test.js).
 */

/* -------------------------------------------- */
/*  Pack Attack                                  */
/* -------------------------------------------- */

export function packAttackSources(actor, target, ctx = {}) {
  const grant = ctx.isAttack ? packAttackGrant(actor, target) : null;
  return grant ? [{ id: 'fix3PackAttack', label: grant.label ?? 'Pack Attack', shiftUp: 1 }] : [];
}

/* -------------------------------------------- */
/*  All roll sources                             */
/* -------------------------------------------- */

export function gijFixSources(actor, target, ctx = {}) {
  return {
    sources: [
      ...packAttackSources(actor, target, ctx),
    ],
    consumes: [],
  };
}

registerRollSources(gijFixSources);
