import { registerRollSources } from "../../extensions.mjs";
import { angrySnagSkill } from "../../angry.mjs";
import { packAttackGrant } from "../../pack-attack.mjs";
import { findHangUp } from "../../perks.mjs";

/**
 * Fix pass 3, GI JOE group: book-accuracy fixes that plug in through the extension points rather
 * than dice.mjs.
 * - Angry (Cobra Codex, Influence Hang-Up, p.26): the Snag on the chosen Skill for the rest of the
 *   scene (the record itself is written by helpers/angry.mjs).
 * - Pack Attack (Cobra Codex, Warthog, p.69): the allies' ↑1 on every attack against the Growled
 *   target until the start of the user's next turn (record written by helpers/pack-attack.mjs).
 *
 * Mega Training Regimen, Surgical Operators and One With Your Weapon are item rules now
 * (rules/conversions.test.js).
 */

const ID = {
  angryHangUp: 'Compendium.essence20.cobra_codex.Item.wGMyGbySdNSgPs8B',
};

/* -------------------------------------------- */
/*  Angry                                        */
/* -------------------------------------------- */

export function angrySources(actor, ctx = {}) {
  const hangUp = findHangUp(actor, ID.angryHangUp);
  if (!hangUp || !ctx.rolledSkill || angrySnagSkill(actor) != ctx.rolledSkill) {
    return [];
  }

  return [{ id: 'fix3Angry', label: hangUp.name ?? 'Angry', snag: true }];
}

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
      ...angrySources(actor, ctx),
      ...packAttackSources(actor, target, ctx),
    ],
    consumes: [],
  };
}

registerRollSources(gijFixSources);
