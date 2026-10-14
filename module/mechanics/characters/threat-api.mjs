import { getGameLine } from "../../settings.js";
import {
  applyQuickPerks, appropriateThreatLevel, auditThreat, buildThreatIr, defaultRulesetFor, defenseSpread, essenceBudget,
  ESSENCES, isModeConversion, maxDamagePerks, MOVEMENT_TYPES, perkBudget, QUICK_PERKS, RANKED_SHIFTS, ROLE_PRESETS, RULESETS, SHIFT_COST,
  SIZE_LADDER, SKILLS_BY_ESSENCE, skillGuideFor, skillSpend, threatDefenses, threatFromActor, threatGroundMovement,
  threatHealth, threatLevelForRole,
} from "./threat-rules.mjs";
import { actorToIr, createActorFromStatBlock } from "../../importers/stat-block-import.mjs";
import { computeGrownStatBlock } from "../../importers/monster-grow-generator.mjs";
import { getLinkedForm, linkGrownForm } from "./monster-grow-swap.mjs";

/**
 * game.essence20.threats - building Threats from code, for other modules and macros (the campaign tools' Monster of the
 * Week generator): the same steps the Threat Builder and the Monster Grow dialog take, under stable names rather than
 * the system's file paths. Bump THREAT_API_VERSION when a call changes shape.
 *
 *   const threats = game.essence20.threats;
 *   const state = threats.newState({ name: 'Spikeball', role: 'leader', ruleset: 'finster' });
 *   const monster = await threats.create({ ...state, essences, skills, attacks });
 *   const grown = await threats.grow(monster, { tlIncrease: 3, newSize: 'gigantic' });
 *   threats.audit(monster);   // the Threat Builder's audit findings
 */
export const THREAT_API_VERSION = 1;

const T = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

/**
 * The primary Party's levels. A world always has a Party (documents/actors.mjs), so an empty one just means nobody has
 * been added to it yet - the presets then assume level 1.
 * @param {Actor} [party]
 * @returns {{name: String, levels: Number[], average: Number, count: Number, appropriate: Number|null}}
 */
export function partyLevels(party = globalThis.game?.actors?.party) {
  const levels = (party?.members ?? []).map(actor => Number(actor.system?.level) || 1);
  const average = levels.length ? Math.round(levels.reduce((a, b) => a + b, 0) / levels.length) : 1;
  return { name: party?.name ?? '', levels, average, count: levels.length, appropriate: levels.length ? appropriateThreatLevel(levels) : null };
}

/**
 * A fresh Threat Builder state: the world's Game Line's rule set, pitched at the party for its role (a Rival by
 * default). Anything in `overrides` replaces the default - `role` also sets the Threat Level, unless `tl` is given.
 * @param {Object} [overrides]
 * @param {Object} [context]   {gameLine, partyLevel} - default: the world's.
 * @returns {Object}
 */
export function newThreatState(overrides = {}, { gameLine = getGameLine(), partyLevel = partyLevels().average } = {}) {
  const role = overrides.role ?? 'leader';
  return {
    ruleset: defaultRulesetFor(gameLine),
    name: '',
    concept: '',
    type: 'typical',
    animal: false,
    vehicleAi: false,
    tl: threatLevelForRole(role, partyLevel),
    healthOverride: null,
    size: 'common',
    groundOverride: null,
    movementTypes: Object.fromEntries(MOVEMENT_TYPES.map(type => [type, false])),
    social: false,
    advanced: 0,
    essences: { strength: 2, speed: 2, smarts: 1, social: 1 },
    skills: {},
    conditioning: 0,
    quickPerks: [],
    customPerks: [],
    customPowers: [],
    customHangUps: [],
    attacks: [],
    dropped: [],
    grow: false,
    ...overrides,
    role,
  };
}

/**
 * Create the Threat a builder state describes: an NPC (a vehicle for the vehicle rule set) through the stat block
 * importer, its build remembered for a later audit, its concept as its biography, and each `dropped` compendium item
 * ({uuid, name}) added through the sheet's own drop handling - a weapon arrives with its effects, a Perk with its
 * choices, exactly as if dragged on.
 * @param {Object} state       A newThreatState(), filled in.
 * @param {Object} [options]
 * @param {String} [options.folder]   An Actor folder id.
 * @returns {Promise<Actor|null>}
 */
export async function createThreat(state, { folder = null } = {}) {
  const s = newThreatState(state, { gameLine: getGameLine(), partyLevel: 1 });
  if (!s.name?.trim()) {
    throw new Error('essence20 | game.essence20.threats.create: the Threat needs a name.');
  }

  const labels = { quickPerk: Object.fromEntries(QUICK_PERKS.map(key => [key, T(`E20.ThreatQuickPerk.${key}`)])) };
  // buildThreatIr adds each quick "+Health" Perk itself; the base is the rule set's (or the override).
  const health = s.healthOverride ?? threatHealth(Math.max(0, Number(s.tl) || 0), s.type);
  const ir = buildThreatIr({ ...s, health, ground: s.groundOverride ?? undefined }, labels);
  const actor = await createActorFromStatBlock(ir, { type: s.ruleset == 'vehicle' ? 'vehicle' : 'npc', folder });
  if (!actor) {
    return null;
  }

  // healthPerks lets a later audit expect the Health those quick Perks added.
  const update = {
    'flags.essence20.threatBuild': {
      ruleset: s.ruleset, type: s.type, social: s.social, advanced: s.advanced, animal: s.animal, vehicleAi: s.vehicleAi,
      healthPerks: (s.quickPerks ?? []).filter(perk => perk.key == 'health').length,
    },
  };
  if (s.concept?.trim()) {
    update['system.biography.bio'] = `<p>${foundry.utils.escapeHTML(s.concept.trim())}</p>`;
  }

  await actor.update(update);

  // v14's sheet drop handler takes the resolved Item document, not the drag data.
  for (const item of s.dropped ?? []) {
    try {
      const document = await fromUuid(item.uuid);
      if (document) {
        await actor.sheet._onDropItem(new DragEvent('drop'), document);
      }
    } catch (error) {
      console.warn(`essence20 | Threat Builder could not add ${item.name}`, error);
    }
  }

  return actor;
}

/**
 * A Threat's other form (its Grown form, or the normal one of a Grown form), when that actor still exists.
 * @param {Actor} actor
 * @returns {Actor|null}
 */
export function linkedForm(actor) {
  const link = getLinkedForm(actor);
  return (link && globalThis.game?.actors?.get(link.id)) ?? null;
}

/**
 * Make a Threat's Grown form (Finster's "Does it Grow?", p.16-17: computeGrownStatBlock) as its own Actor, in the same
 * folder, and link the pair so the token swap and Monster... Grow! find it. Refused (null) for an actor that already
 * has a Grown form, or is one.
 * @param {Actor} actor
 * @param {Object} [options]   computeGrownStatBlock's: tlIncrease (default 3), newSize (default 'gigantic'), ...
 * @returns {Promise<Actor|null>}
 */
export async function growThreat(actor, options = {}) {
  if (!actor || linkedForm(actor)) {
    return null;
  }

  const { ir } = computeGrownStatBlock(actorToIr(actor), { tlIncrease: 3, newSize: 'gigantic', ...options });
  const grown = await createActorFromStatBlock(ir, { type: actor.type, folder: actor.folder?.id ?? null });
  if (!grown) {
    return null;
  }

  await linkGrownForm(actor, grown);
  return grown;
}

/**
 * The Threat Builder's audit of an existing actor: [{key, level, data}], `key` an E20.ThreatAudit.* message.
 * @param {Actor} actor
 * @param {Object} [options]   {ruleset} - default: what the actor was built with, else the Game Line's.
 * @returns {Object[]}
 */
export function auditActor(actor, { ruleset = null } = {}) {
  return auditThreat(threatFromActor(actor, { ruleset, gameLine: getGameLine() }));
}

/**
 * The object behind game.essence20.threats. `open` is passed in (the Threat Builder app), so this file stays free of
 * the UI.
 * @param {Function} open   actor => the Threat Builder, for that actor's audit or (no actor) a new Threat.
 * @returns {Object}
 */
export function threatApi(open) {
  return Object.freeze({
    version: THREAT_API_VERSION,
    partyLevels,
    newState: newThreatState,
    create: createThreat,
    grow: growThreat,
    audit: auditActor,
    linkedForm,
    open,
    // The pure Threat rules, for a generator's own maths.
    rules: Object.freeze({
      RULESETS, ROLE_PRESETS, QUICK_PERKS, ESSENCES, SKILLS_BY_ESSENCE, SHIFT_COST, RANKED_SHIFTS, SIZE_LADDER,
      threatLevelForRole, appropriateThreatLevel, threatHealth, threatGroundMovement, essenceBudget, perkBudget,
      threatDefenses, defenseSpread, skillGuideFor, skillSpend, maxDamagePerks, applyQuickPerks, isModeConversion,
      // The Threat Builder's audit, on auditThreat's own shape (a generator can check a state before creating it).
      auditThreat,
    }),
  });
}
