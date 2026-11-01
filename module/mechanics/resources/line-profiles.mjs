/**
 * Line profiles: what each book line's rules switch on, in one table, so code asks "does this line have a GM Story
 * Point pool?" instead of "is this My Little Pony?". A homebrew line (custom-game-lines.mjs) takes its book line's
 * profile and may override single switches in its own `rules`; custom-game-lines.mjs#lineRule does the lookup.
 *
 * Only the switches a line could plausibly change live here. How a book Role is shaped (MLP and Transformers Essence
 * ranks, Spectrum Shift between Power Rangers Roles) stays a check on the Role's own `version`.
 *
 * Import-free (custom-game-lines.mjs reads it, and jest loads it without Foundry).
 */

// Which Skills can escape a grapple differs by book - used by Perks that help an escape attempt (Experiment).
const ACROBATICS_LINE = Object.freeze(['acrobatics', 'athletics', 'brawn', 'finesse']);
const MIGHT_LINE = Object.freeze(['athletics', 'might', 'finesse']);

/**
 * Each switch, its kind and its value when no line is set (an all-lines world): the core rules.
 *  - canMorph: the line's characters Morph (Power Rangers; a homebrew line like He-Man or Jem).
 *  - canTransform: its Roles make a character able to transform from the start - the Alt Modes tab and Transform
 *    button before any Alt Mode is taken (GoBots, Centurions). Off in every book: a Transformer's Origin brings its
 *    Alt Mode, and any character holding one transforms.
 *  - vehicleAltModes: its Vehicles and Zords can have Alt Modes (mechanics/vehicles/vehicle-alt-modes.mjs).
 *  - canSpellcast: its characters can learn Spells (My Little Pony).
 *  - canQualify: its characters take Qualifications (G.I. Joe).
 *  - gridPower: its Roles grant Grid Powers and a team can spend for a Grid Power bloom (PR CRB p.91).
 *  - gmStoryPool: the GM has Story Points of their own (not My Little Pony).
 *  - defenseBoostAfterRoll: a Story Point buys +1 to a Defense after the roll (G.I. Joe p.127, Transformers p.105).
 *  - defenseBoostLastsScene: the +5 Defense spend lasts the scene (MLP CRB p.118).
 *  - requisition: the Party sheet's Requisition tab (the MLP book has no Requisition).
 *  - megaformSubtype: what a new Megaform starts as - a Megazord or a Combiner.
 *  - megaformJoinTypes: who may join its Megaforms (Voltron's Lions are Zords and Vehicles); empty keeps the book's
 *    rules. A Megaform's own Forming Rules win (mechanics/vehicles/megaform-participants.mjs).
 *  - threatRuleset: the Threat Builder's starting rule set.
 *  - startingEssenceMax: the most one Essence holds at creation (Transformers CRB p.24; Night Vale Citizen's Guide p.10).
 *  - grappleEscapeSkills: the Skills an escape attempt can use; empty means any some book allows.
 */
export const LINE_RULES = Object.freeze({
  canMorph: { type: 'boolean', default: false },
  canTransform: { type: 'boolean', default: false },
  vehicleAltModes: { type: 'boolean', default: false },
  canSpellcast: { type: 'boolean', default: false },
  canQualify: { type: 'boolean', default: false },
  gridPower: { type: 'boolean', default: false },
  gmStoryPool: { type: 'boolean', default: true },
  defenseBoostAfterRoll: { type: 'boolean', default: true },
  defenseBoostLastsScene: { type: 'boolean', default: false },
  requisition: { type: 'boolean', default: true },
  megaformSubtype: { type: 'choice', choices: ['megaformZord', 'megaformCombiner'], default: 'megaformCombiner' },
  megaformJoinTypes: { type: 'list', choices: ['zord', 'vehicle', 'playerCharacter', 'npc'], default: Object.freeze([]) },
  threatRuleset: { type: 'choice', choices: ['fieldGuide', 'finster', 'canterlot', 'vehicle'], default: 'fieldGuide' },
  startingEssenceMax: { type: 'number', min: 1, default: 15 },
  grappleEscapeSkills: { type: 'list', default: Object.freeze([]) },
});

/** The book lines' profiles, by their game line keys (E20.gameVersions): only what differs from the defaults. */
export const BOOK_PROFILES = Object.freeze({
  giJoe: Object.freeze({
    canQualify: true,
    grappleEscapeSkills: MIGHT_LINE,
  }),
  powerRangers: Object.freeze({
    canMorph: true,
    gridPower: true,
    defenseBoostAfterRoll: false,
    megaformSubtype: 'megaformZord',
    grappleEscapeSkills: Object.freeze(['athletics', 'brawn', 'finesse']),
  }),
  transformers: Object.freeze({
    grappleEscapeSkills: ACROBATICS_LINE,
  }),
  myLittlePony: Object.freeze({
    canSpellcast: true,
    gmStoryPool: false,
    defenseBoostAfterRoll: false,
    defenseBoostLastsScene: true,
    requisition: false,
    threatRuleset: 'canterlot',
    grappleEscapeSkills: ACROBATICS_LINE,
  }),
  welcomeToNightVale: Object.freeze({
    startingEssenceMax: 8,
    grappleEscapeSkills: MIGHT_LINE,
  }),
});

/**
 * One switch's value tidied, or undefined when it isn't a usable value for that switch (so it's left unset).
 * @param {String} key   A LINE_RULES key.
 * @param {*} value
 * @returns {*}
 */
function cleanRule(key, value) {
  const spec = LINE_RULES[key];
  switch (spec?.type) {
  case 'boolean':
    return typeof value == 'boolean' ? value : undefined;
  case 'choice':
    return spec.choices.includes(value) ? value : undefined;
  case 'number': {
    const number = Math.floor(Number(value));
    return value !== '' && value !== null && Number.isFinite(number) && number >= spec.min ? number : undefined;
  }

  case 'list': {
    const list = (Array.isArray(value) ? value : String(value ?? '').split(','))
      .map(entry => String(entry ?? '').trim()).filter(entry => entry && (!spec.choices || spec.choices.includes(entry)));
    return list.length ? [...new Set(list)] : undefined;
  }

  default:
    return undefined;
  }
}

/**
 * A homebrew line's own switches as stored, tidied: only known keys with usable values (anything left out follows its
 * book line).
 * @param {Object} raw
 * @returns {Object}
 */
export function normalizeLineRules(raw) {
  const out = {};
  for (const [key, value] of Object.entries(raw && typeof raw == 'object' ? raw : {})) {
    const clean = cleanRule(key, value);
    if (clean !== undefined) {
      out[key] = clean;
    }
  }

  return out;
}

/**
 * One switch for a book line, with a homebrew line's overrides on top: the overrides, then the book line's profile,
 * then the core-rules default.
 * @param {String} family   A book line key, or '' for none.
 * @param {String} key   A LINE_RULES key.
 * @param {Object} [overrides]   A homebrew line's rules (normalizeLineRules).
 * @returns {*}   undefined for an unknown key.
 */
export function profileRule(family, key, overrides = {}) {
  if (!LINE_RULES[key]) {
    return undefined;
  }

  if (overrides?.[key] !== undefined) {
    return overrides[key];
  }

  const book = BOOK_PROFILES[family]?.[key];
  return book !== undefined ? book : LINE_RULES[key].default;
}
