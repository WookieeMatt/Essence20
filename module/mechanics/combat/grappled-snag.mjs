import { registerApplyDialog, registerDialogToggles } from "../item-hooks.mjs";
import { getSceneEpoch } from "../resources/scene-clock.mjs";

/**
 * The Grappled condition's own penalty. Every core rulebook gives a Grappled target a Snag on all
 * Skill Tests except its attempts to escape (GI JOE CRB, Power Rangers CRB, Transformers CRB, My Little
 * Pony CRB, Night Vale Host Guide: "Suffers a Snag on all other Skill Tests"). Only the player knows
 * whether a roll is an escape attempt, so it's a Roll Options Dialog switch that starts on and is turned
 * off for one.
 */

// Which Skills can escape differs by book - used by Perks that help an escape attempt (Experiment).
const ACROBATICS_LINE = ['acrobatics', 'athletics', 'brawn', 'finesse'];
const MIGHT_LINE = ['athletics', 'might', 'finesse'];

export const GRAPPLE_ESCAPE_SKILLS = {
  giJoe: MIGHT_LINE,
  welcomeToNightVale: MIGHT_LINE,
  powerRangers: ['athletics', 'brawn', 'finesse'],
  transformers: ACROBATICS_LINE,
  myLittlePony: ACROBATICS_LINE,
};

// No game line to go on (a mixed world and no Role): any Skill some book lets you escape with.
const ANY_ESCAPE_SKILL = [...new Set(Object.values(GRAPPLE_ESCAPE_SKILLS).flat())];

function gameLineOf(actor) {
  let setting = '';
  try {
    setting = globalThis.game?.settings?.get('essence20', 'gameLine') ?? '';
  } catch {
    setting = '';
  }

  const items = actor?.items?.contents ?? [...(actor?.items ?? [])];
  return setting || items.find(item => item.type == 'role')?.system?.version || '';
}

/** The Skills this actor can escape a grapple with: the world's game line, then the character's Role. */
export function grappleEscapeSkills(actor) {
  return GRAPPLE_ESCAPE_SKILLS[gameLineOf(actor)] ?? ANY_ESCAPE_SKILL;
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
// Grapple hit marks the target for the scene (extensions/data22/weapons.mjs).
export function clawGrappled(actor) {
  const mark = actor?.flags?.essence20?.d22AssaultClawGrapple;
  let epoch = null;
  try {
    epoch = getSceneEpoch();
  } catch {
    epoch = null;
  }

  return !!mark && mark.scene == epoch;
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
