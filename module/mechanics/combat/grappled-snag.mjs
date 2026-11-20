import { registerApplyDialog, registerDialogToggles } from "../item-hooks.mjs";
import { markOf } from "../../rules/predicate.mjs";
import { LINE_FAMILIES, actorRule } from "../resources/custom-game-lines.mjs";
import { BOOK_PROFILES } from "../resources/line-profiles.mjs";

/**
 * The Grappled condition's own penalty. Every core rulebook gives a Grappled target a Snag on all
 * Skill Tests except its attempts to escape (GI JOE CRB, Power Rangers CRB, Transformers CRB, My Little
 * Pony CRB, Night Vale Host Guide: "Suffers a Snag on all other Skill Tests"). Only the player knows
 * whether a roll is an escape attempt, so it's a Roll Options Dialog switch that starts on and is turned
 * off for one.
 */

// Which Skills can escape differs by book (each line's grappleEscapeSkills switch, line-profiles.mjs) - used by Perks
// that help an escape attempt (Experiment).
export const GRAPPLE_ESCAPE_SKILLS = Object.fromEntries(LINE_FAMILIES.map(line => [line, BOOK_PROFILES[line].grappleEscapeSkills]));

// No game line to go on (a mixed world and no Role): any Skill some book lets you escape with.
const ANY_ESCAPE_SKILL = [...new Set(Object.values(GRAPPLE_ESCAPE_SKILLS).flat())];

/** The Skills this actor can escape a grapple with: the world's game line, then its own (custom-game-lines.mjs#actorRulesLine). */
export function grappleEscapeSkills(actor) {
  const skills = actorRule(actor, 'grappleEscapeSkills');
  return skills?.length ? skills : ANY_ESCAPE_SKILL;
}

const T = key => globalThis.game?.i18n?.localize?.(key) ?? key;
const isGrappled = actor => !!actor?.statuses?.has?.('grappled');

export function grappledToggles(actor, { rolledSkill } = {}) {
  if (!rolledSkill || !isGrappled(actor)) {
    return [];
  }

  const label = T(clawGrappled(actor) ? 'E20.GrappledClawSnagToggle' : 'E20.GrappledSnagToggle');
  return [{ name: 'grappledSnag', type: 'checkbox', label, value: true }];
}

// Assault Claw (Enigma of Combination p.49): "Targets Grappled by this weapon suffer Snag to escape" -
// so its grapple is a Snag on every roll, escape attempts included; the switch says so. The Claw's
// Grapple hit marks the target for the scene (a hit Trigger rule on the weapon: mark assaultClawGrapple).
export function clawGrappled(actor) {
  return markOf(actor, 'assaultClawGrapple');
}

export function grappledApplyDialog(actor, options) {
  if (options.ext?.grappledSnag) {
    if (options.edge) {
      options.edge = false;
    } else {
      options.snag = true;
    }
  }
}

registerDialogToggles(grappledToggles);
registerApplyDialog(grappledApplyDialog);
