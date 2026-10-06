import {
  registerChatButton, registerPreRoll, registerRollSources, registerUse,
} from "../../mechanics/item-hooks.mjs";
import {
  csfSource, inoperableWarning, onCsfRepairButton, onRebootButton, SOME_ASSEMBLY_REQUIRED_ID, TECHNICAL_GLITCH_ID,
  useSomeAssemblyRequired, useTechnicalGlitch,
} from "./equipment-disruption.mjs";
import { sourceOfOrUndefined as sourceOf } from "../shared/item-lookups.mjs";

/**
 * Equipment disruption (./equipment-disruption.mjs) wired into the roll and the sheet - G.I. Joe's Complete System
 * Failure penalty, the Inoperable warning, the Reboot / Repair chat buttons, and the Use buttons of the Technical
 * Glitch Hang-Up and the Some Assembly Required Alteration.
 *
 * (Junker and Targeting Eye are item rules (rules/conv7-slC7.test.js); so are Pillage and Dreadnok Recruit
 * (rules/conv9-slC9.test.js), Early Adopter, Field Trials and Peak Performance (rules/conv10-slE10.test.js), Subtle
 * Snake's select and Second Skin's asked substitution (rules/conv10-slC10.test.js), and The Sound of Angels - an
 * afterRoll Trigger on its Perk (rules/conv10-slD10.test.js).)
 */

export const G3 = {
  technicalGlitch: TECHNICAL_GLITCH_ID,
  someAssemblyRequired: SOME_ASSEMBLY_REQUIRED_ID,
};

/* -------------------------------------------- */
/*  Automatic roll sources                       */
/* -------------------------------------------- */

export function gij3RollSources(actor, target, ctx = {}) {
  const sources = [];
  const consumes = [];

  // Complete System Failure - equipment-disruption.mjs.
  const csf = csfSource(actor, ctx);
  if (csf) {
    sources.push(csf);
  }

  return { sources, consumes };
}

/* -------------------------------------------- */
/*  Before the roll                              */
/* -------------------------------------------- */

export async function gij3PreRoll(actor, dataset, item) {
  inoperableWarning(actor, dataset, item);
}

/* -------------------------------------------- */
/*  Use buttons                                  */
/* -------------------------------------------- */

export const USES = [
  {
    id: 'gij3TechnicalGlitch',
    matches: item => sourceOf(item) == G3.technicalGlitch,
    run: (item, economy, pay) => useTechnicalGlitch(item, pay),
  },
  {
    id: 'gij3SomeAssemblyRequired',
    matches: item => sourceOf(item) == G3.someAssemblyRequired,
    canUse: () => !game.combat,
    run: item => useSomeAssemblyRequired(item),
  },
];

/* -------------------------------------------- */
/*  Registration                                 */
/* -------------------------------------------- */

registerRollSources(gij3RollSources);
registerPreRoll(gij3PreRoll);
registerChatButton('gij3Reboot', onRebootButton);
registerChatButton('gij3CsfRepair', onCsfRepairButton);
USES.forEach(use => registerUse(use));
