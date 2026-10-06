/**
 * The tf2 slice's roll hooks: ↑/↓/Edge/Snag sources and Roll Options Dialog switches.
 *
 * - All Out Attack (p.107) / Evasive Fighting (p.109) are StanceSwitch rules on their items (they feed the same
 *   target-riders.mjs stance flag the G.I. JOE printings run on - rules/conv10-slD10.test.js).
 * - Broad Understanding and Applied Science (Scientist, p.79) are rules on their pack items.
 * - Cage and Diversion are rules on their items (rules/conv10-slC10.test.js).
 * - Duke It Out (p.91) is rules on its pack item (a Use and the Edge against the creature that refused).
 * - Deconstruct (p.81): "Weapon: The attacker suffers a Snag using this weapon unless it's subject to
 *   a DIF 10 Technology Skill Test to repair it."
 * - Bestial Articulation (Monstrosity Alt Mode, Decepticon Directive p.37, Technorganic Secrets p.41):
 *   "You must use body parts not designed for articulation or precision, such as mouths, claws, or
 *   hooves, to perform certain tasks. Whenever this applies, you suffer a penalty of ↓ 1." Which tasks
 *   is a table call, so it's a switch while converted into a Monstrosity Alt Mode.
 * - Arrogant (Enigma of Combination, Hang-Up) is a BeforeRoll rule on its item (rules/conv10-slC10.test.js).
 */
import { registerRollSources } from "../../mechanics/item-hooks.mjs";
import { T, parentWeaponOf } from "../shared/weapon-target-lookups.mjs";

export const DECONSTRUCTED = 'tf2Deconstructed';
/* -------------------------------------------- */
/*  Roll sources                                 */
/* -------------------------------------------- */

/**
 * @returns {{sources: Array, consumes: Array}}
 */
export function tf2RollSources(actor, target, ctx = {}) {
  const { item, isAttack } = ctx;
  const sources = [];
  const consumes = [];

  // Deconstruct: a sabotaged weapon attacks with Snag until repaired.
  const weapon = parentWeaponOf(actor, item);
  if (isAttack && weapon?.flags?.essence20?.[DECONSTRUCTED]) {
    sources.push({ id: 'tf2Deconstructed', label: T('Tf2Deconstructed', { name: weapon.name }), snag: true });
  }

  return { sources, consumes };
}

// (Bestial Articulation is the Monstrosity Alt Modes' own DialogSwitch rule - rule:altMode.)

/* -------------------------------------------- */
/*  Registration                                 */
/* -------------------------------------------- */

registerRollSources(tf2RollSources);

