import { registerRollSources } from "../../extensions.mjs";

/**
 * The Grappled condition's own penalty. Every core rulebook gives a Grappled target a Snag on all
 * Skill Tests except its attempts to escape (GI JOE CRB, Power Rangers CRB, Transformers CRB, My Little
 * Pony CRB, Night Vale Host Guide: "Suffers a Snag on all other Skill Tests"). The books differ only in
 * which Skills can escape, so that list follows the world's game line, then the character's Role.
 * An escape attempt is a non-attack test with one of those Skills.
 */

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

/** The Skills this actor can escape a grapple with. */
export function grappleEscapeSkills(actor) {
  return GRAPPLE_ESCAPE_SKILLS[gameLineOf(actor)] ?? ANY_ESCAPE_SKILL;
}

export function grappledSources(actor, target, { rolledSkill, isAttack } = {}) {
  const none = { sources: [], consumes: [] };
  if (!rolledSkill || !actor?.statuses?.has?.('grappled')) {
    return none;
  }

  if (!isAttack && grappleEscapeSkills(actor).includes(rolledSkill)) {
    return none;
  }

  const label = globalThis.game?.i18n?.localize?.('E20.GrappledSnag') ?? 'Grappled';
  return { sources: [{ id: 'grappled', label, snag: true }], consumes: [] };
}

registerRollSources(grappledSources);
