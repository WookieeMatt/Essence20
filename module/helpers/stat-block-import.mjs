import { MATCHABLE_SECTIONS, indexKey } from "./stat-block-match.mjs";
import { slugifySpecializationName } from "./utils.mjs";

/**
 * Turns the IR produced by helpers/stat-block-parser.mjs into real Foundry documents. Phase 2 of
 * docs/STAT_BLOCK_IMPORTER_PLAN.md.
 *
 * Split deliberately into a large pure half (every `build*` function below - plain data in, plain
 * creation-data out, fully unit-tested) and a thin impure orchestrator
 * (`createActorFromStatBlock`), which is the only part that touches Actor.create /
 * createEmbeddedDocuments and therefore the only part that cannot be tested under jest.
 *
 * The interesting work is §4 of the plan: this system DERIVES Health and Defenses rather than
 * storing them, so the printed numbers can never be written into them directly. See
 * `computeDefenseBonus` / `buildHealth` below for the two reconciliations that matter.
 */

/** Every Defense starts from a base of 10 before Essence and any bonuses - see makeDefensesFields. */
const DEFENSE_BASE = 10;

/**
 * Damage types that read as "energy-ish" when inferring a ranged attack's weapon style. Only used
 * for `classification.style`, which is a display/filtering concern, never a damage calculation -
 * and the importer UI shows the inference so a GM can override it.
 */
const ENERGY_DAMAGE_TYPES = ['element', 'electric', 'emp', 'fire', 'cold', 'laser', 'sonic', 'psychic', 'void'];

/**
 * Which Essence governs which Defense, mirroring the pairings data/actor/templates/character.mjs
 * hands to `makeDefensesFields(name, essence)`. Needed here because the residual written to
 * `.bonus` is only correct relative to that Defense's own governing Essence.
 */
const DEFENSE_ESSENCES = {
  toughness: 'strength',
  evasion: 'speed',
  willpower: 'smarts',
  cleverness: 'social',
};

/* ------------------------------------------------------------------ *
 * Derived-stat reconciliation                                         *
 * ------------------------------------------------------------------ */

/**
 * The residual that has to go into `system.defenses.<type>.bonus` for the sheet to display the
 * printed Defense, given that Essence20Actor#_prepareDefenses computes
 * `total = 10 + essence.max + bonus + armor + ...`.
 *
 * `.bonus` is explicitly the player/GM's own manual catch-all (see the doc comments on
 * _prepareDefenses and apps/stat-editor.mjs), so an importer writing there is using the field
 * exactly as intended - unlike runtime Perk code, which must never touch it.
 *
 * @param {Number|null} printed   The Defense as printed in the stat block.
 * @param {Number|null} essence   The governing Essence score, as printed.
 * @param {Number} armor          Armor deflection already accounted for in `.armor`.
 * @returns {Number|null}   The residual, or null when the block printed no value ("--").
 */
export function computeDefenseBonus(printed, essence, armor = 0) {
  if (printed === null || printed === undefined) {
    return null;
  }

  return printed - DEFENSE_BASE - (essence ?? 0) - armor;
}

/**
 * Health per Essence20Actor#_prepareHealth: `max = origin + rolePoints + conditioning + bonus`,
 * where `system.health.origin` is the flat "starting Health" field non-PC types use in place of
 * an Origin Item.
 *
 * The printed HEALTH already INCLUDES Conditioning - confirmed against Polluticorn, whose Normal
 * form is TL7/Health 7 with no Conditioning and whose Grown form is TL10/Health 13 with
 * "Conditioning +3" (7 + 3 for the TL increase, + 3 for Conditioning). So Conditioning has to
 * come back out of `origin` or the sheet would show it twice.
 */
export function buildHealth(printed, conditioning = 0) {
  if (printed === null || printed === undefined) {
    return { origin: 0, value: 0 };
  }

  return { origin: printed - conditioning, value: printed };
}

/** Total armour deflection the parsed Equipment section attributes to one Defense. */
export function armorBonusFor(ir, defense) {
  return (ir.equipment ?? [])
    .filter(entry => entry.kind === 'armor' && entry.bonus?.defense === defense)
    .reduce((total, entry) => total + entry.bonus.value, 0);
}

/* ------------------------------------------------------------------ *
 * Netting out Active Effects the printed block already accounts for   *
 * ------------------------------------------------------------------ */

/** `CONST.ACTIVE_EFFECT_MODES.ADD` - the v13 numeric mode still stored in the shipped packs. */
const ADD_MODE = 2;

/**
 * An effect's changes, from wherever this Foundry version keeps them. v14 moved them to
 * `effect.system.changes` with a string `type`; the shipped pack `_source` JSON is still the v13
 * shape (`effect.changes` with a numeric `mode`), and a document may present either depending on
 * whether migration has run on it. Both are read rather than assuming one.
 */
function effectChanges(effect) {
  const changes = effect?.system?.changes ?? effect?.changes;
  return Array.isArray(changes) ? changes : [];
}

/** Only plain additions can be arithmetically cancelled; see collectEffectContributions. */
function isAdditive(change) {
  return change?.type === 'add' || change?.mode === ADD_MODE;
}

const DEFENSE_CONTRIBUTION = /^system\.defenses\.(toughness|evasion|willpower|cleverness)\.(bonus|armor|shield|morphed)$/;
const MOVEMENT_CONTRIBUTION = /^system\.movement\.(ground|aerial|swim|climb)\.(base|bonus|morphed)$/;

/**
 * How much the Active Effects on a set of Items will add to each derived total.
 *
 * **Why this exists.** A printed stat block's Defenses, Health and Movement already include that
 * Threat's own Perks - the book did the arithmetic and printed the result. When the importer
 * matches a Perk to a real compendium Item, that Item's Active Effect then applies its bonus a
 * SECOND time, and the actor comes out stronger than the page. Observed live: a matched "Never
 * Back Down" (`system.health.bonus add 2`) turned a printed Health of 4 into a derived 6.
 *
 * The fix is to subtract these contributions from the residual the builder writes, so the sheet
 * lands on exactly the printed number *with* the automation attached. See buildActorData.
 *
 * Only **additive, numeric, currently-applying** changes can be cancelled this way:
 *  - a non-additive change (override/upgrade/multiply) has no single number to subtract;
 *  - a formula value (`@system.level`) is not known until the actor exists;
 *  - a disabled or non-transferring effect is not applying in the first place;
 *  - a skill `shiftUp` moves a die up a ladder rather than adding to a total, so cancelling it
 *    would mean downshifting the printed die - a different operation, deliberately not attempted.
 *
 * Anything that cannot be cancelled is returned in `unnetted` so the importer can say so plainly
 * rather than quietly producing a wrong number.
 *
 * @param {Object[]} items   Item creation data (post compendium substitution).
 * @returns {{defenses: Object, health: Number, movement: Object, unnetted: Object[]}}
 */
export function collectEffectContributions(items) {
  const contributions = { defenses: {}, health: 0, movement: {}, unnetted: [] };

  for (const item of items ?? []) {
    for (const effect of item?.effects ?? []) {
      if (effect?.disabled || effect?.transfer === false) {
        continue;
      }

      for (const change of effectChanges(effect)) {
        const key = change?.key ?? '';
        const value = Number(change?.value);
        const nettable = isAdditive(change) && Number.isFinite(value);

        const defense = key.match(DEFENSE_CONTRIBUTION);
        const movement = key.match(MOVEMENT_CONTRIBUTION);
        const isHealth = key === 'system.health.bonus' || key === 'system.health.origin'
          // Conditioning feeds health.max too (see _prepareHealth), so it double-counts the same way.
          || key === 'system.conditioning';

        if (!defense && !movement && !isHealth) {
          continue;
        }

        if (!nettable) {
          contributions.unnetted.push({ item: item.name, key, reason: 'notAdditive' });
          continue;
        }

        if (defense) {
          contributions.defenses[defense[1]] = (contributions.defenses[defense[1]] ?? 0) + value;
        } else if (movement) {
          contributions.movement[movement[1]] = (contributions.movement[movement[1]] ?? 0) + value;
        } else {
          contributions.health += value;
        }
      }
    }
  }

  return contributions;
}

/**
 * Effects that change a stat the printed block shows but which cannot be cancelled arithmetically
 * - principally skill shifts. Surfaced to the GM rather than silently mis-applied.
 * @param {Object[]} items
 * @returns {Object[]}
 */
export function collectUncancellableEffects(items) {
  const found = [];

  for (const item of items ?? []) {
    for (const effect of item?.effects ?? []) {
      if (effect?.disabled || effect?.transfer === false) {
        continue;
      }

      for (const change of effectChanges(effect)) {
        const key = change?.key ?? '';
        if (/^system\.skills\.\w+\.(shift|shiftUp|shiftDown)$/.test(key)) {
          found.push({ item: item.name, key, value: change.value });
        }
      }
    }
  }

  return found;
}

/* ------------------------------------------------------------------ *
 * Actor creation data                                                 *
 * ------------------------------------------------------------------ */

function buildSkills(ir) {
  const skills = {};

  for (const parsed of ir.skills ?? []) {
    const entry = skills[parsed.key] ??= { isChosen: true, specializations: {} };

    if (parsed.shift) {
      entry.shift = parsed.shift;
    }

    if (parsed.isSpecialized) {
      entry.isSpecialized = true;
    }

    if (!parsed.specialization) {
      continue;
    }

    const key = slugifySpecializationName(parsed.specialization, entry.specializations);
    entry.specializations[key] = {
      name: parsed.specialization,
      shift: parsed.shift ?? 'd20',
      isSpecialized: parsed.isSpecialized,
      edge: false,
      shiftUp: 0,
      shiftDown: 0,
      snag: false,
      // Marks this as something the stat block granted rather than something a player bought with
      // a skill point - helpers/skill-picker.mjs#computeEssenceSpend only tallies the latter.
      granted: true,
    };
  }

  return skills;
}

/**
 * Vehicles and Zords use data/actor/templates/machine.mjs, whose Essence fields are
 * `{usesDrivers, value}` - there is no `.max` to write. `_prepareDefenses` already falls back to
 * `.value` for exactly this reason, so the Defense arithmetic is unchanged.
 */
export const MACHINE_TYPES = ['vehicle', 'zord'];

/** Zords have no Threat Level at all (see data/actor/zord.mjs) - vehicles and NPCs do. */
export const TYPES_WITHOUT_THREAT_LEVEL = ['zord'];

function buildEssences(ir, isMachine) {
  const essences = {};
  for (const [name, printed] of Object.entries(ir.essences ?? {})) {
    if (printed === null) {
      // A character-shaped actor's Essences default to 3 (makeEssenceFields), and
      // _prepareDefenses adds that default into every Defense total - so leaving an unprinted
      // Essence alone silently inflates the Defenses by 3 each. Some printings omit the Essence
      // line entirely (the PR CRB 1st printing does), so this is a real case, not a malformed
      // paste. Writing an explicit 0 keeps the Defense arithmetic self-consistent with the
      // residual computeDefenseBonus already calculated against 0.
      //
      // Machines are left alone deliberately: `--` there means "uses the driver's" (see
      // templates/machine.mjs's usesDrivers), which a 0 would wrongly override.
      if (!isMachine) {
        essences[name] = { max: 0, value: 0 };
      }

      continue;
    }

    essences[name] = isMachine ? { value: printed } : { max: printed, value: printed };
  }

  return essences;
}

function buildDefenses(ir, contributions) {
  const defenses = {};
  for (const [name, printed] of Object.entries(ir.defenses ?? {})) {
    if (printed === null) {
      continue;
    }

    const armor = armorBonusFor(ir, name);
    // Subtracting the Active Effects' own contribution here is what makes a matched Perk land on
    // the printed number instead of overshooting it - see collectEffectContributions.
    const effectBonus = contributions?.defenses?.[name] ?? 0;
    defenses[name] = {
      armor,
      bonus: computeDefenseBonus(printed, ir.essences?.[DEFENSE_ESSENCES[name]], armor) - effectBonus,
    };
  }

  return defenses;
}

function buildMovement(ir, contributions) {
  const movement = {};
  for (const [type, printed] of Object.entries(ir.movement ?? {})) {
    if (printed === null) {
      continue;
    }

    movement[type] = { base: printed - (contributions?.movement?.[type] ?? 0) };
  }

  return movement;
}

/**
 * The Actor creation data for one parsed stat block.
 *
 * Sets `prototypeToken.width/height` explicitly, which matters more than it looks: the actor
 * document only syncs token dimensions to Size in `_preUpdate` (i.e. when Size CHANGES), never in
 * `_preCreate` - so an actor created at Gigantic would otherwise get a 1x1 token.
 *
 * @param {Object} ir   The parser's IR.
 * @param {Object} [options]
 * @param {String} [options.type]    Actor type to create (npc today; vehicle/zord are Phase 8).
 * @param {String} [options.raw]     The original pasted text, stored for re-parsing later.
 * @param {String} [options.folder]  Folder id to create the actor in.
 * @param {Object} [options.effectContributions]  From collectEffectContributions - subtracted from
 *   the residuals so a matched Perk's Active Effect doesn't double-count what the page already
 *   included.
 * @returns {Object}
 */
export function buildActorData(ir, {
  type = 'npc', raw = null, folder = null, effectContributions = null,
} = {}) {
  const tokenSizes = CONFIG.E20.tokenSizes;
  const tokenSize = tokenSizes[ir.size] ?? tokenSizes.common;
  const contributions = effectContributions;
  const health = buildHealth(ir.health, ir.conditioning);
  // Health is derived as origin + conditioning + bonus, so an effect adding to either bonus or
  // conditioning comes back out of origin.
  health.origin -= contributions?.health ?? 0;
  const isMachine = MACHINE_TYPES.includes(type);

  const system = {
    conditioning: ir.conditioning ?? 0,
    defenses: buildDefenses(ir, contributions),
    essences: buildEssences(ir, isMachine),
    health,
    languages: ir.languages ?? [],
    movement: buildMovement(ir, contributions),
    skills: buildSkills(ir),
  };

  if (ir.size) {
    system.size = ir.size;
  }

  if (ir.threatLevel !== null && ir.threatLevel !== undefined
    && !TYPES_WITHOUT_THREAT_LEVEL.includes(type)) {
    system.threatLevel = ir.threatLevel;
  }

  const data = {
    name: ir.name || game.i18n?.localize?.('E20.StatBlockImportUnnamed') || 'Imported Threat',
    type,
    system,
    prototypeToken: {
      width: tokenSize.width,
      height: tokenSize.height,
    },
    flags: {
      essence20: {
        statBlockSource: {
          raw,
          ir,
          importedAt: Date.now(),
          version: 1,
        },
      },
    },
  };

  if (folder) {
    data.folder = folder;
  }

  return data;
}

/* ------------------------------------------------------------------ *
 * Item creation data                                                  *
 * ------------------------------------------------------------------ */

/**
 * A parsed attack's weapon style. Inference only - shown in the importer preview and overridable,
 * since the printed stat block never states it.
 */
export function inferWeaponStyle(effect) {
  if (effect.isReach) {
    return 'melee';
  }

  if (effect.shape) {
    return 'explosive';
  }

  if (ENERGY_DAMAGE_TYPES.includes(effect.damageType)) {
    return 'energy';
  }

  return 'projectile';
}

/** One `weaponEffect` Item's creation data, shared by a primary attack and its Alternate Effects. */
export function buildWeaponEffectData(effect, { name, skill }) {
  return {
    name,
    type: 'weaponEffect',
    system: {
      classification: {
        skill: skill ?? 'athletics',
        style: inferWeaponStyle(effect),
      },
      damageType: effect.damageType ?? 'blunt',
      damageValue: effect.damageValue ?? 0,
      defenseType: effect.defenseType ?? 'toughness',
      numHands: effect.numHands ?? 1,
      radius: effect.radius ?? 0,
      shape: effect.shape ?? null,
      range: {
        min: effect.range?.min ?? null,
        long: effect.range?.long ?? null,
        reachMultiplier: effect.range?.reachMultiplier ?? null,
        value: effect.range?.value ?? null,
      },
    },
  };
}

/**
 * One attack becomes a `weapon` Item plus one `weaponEffect` per damage clause - the primary one
 * and one for each printed "Alternate Effects:" line.
 * @returns {{weapon: Object, effects: Object[]}}
 */
export function buildWeaponData(attack) {
  const weapon = {
    name: attack.name,
    type: 'weapon',
    system: {
      equipped: true,
      traits: attack.traits ?? [],
      requirements: {
        skill: attack.skill ?? null,
        shift: null,
      },
    },
  };

  const effects = [
    buildWeaponEffectData({ ...attack, numHands: attack.numHands }, {
      name: attack.name,
      skill: attack.skill,
    }),
  ];

  for (const alternate of attack.alternateEffects ?? []) {
    effects.push(buildWeaponEffectData({ ...alternate, numHands: attack.numHands }, {
      name: alternate.name || `${attack.name} (Alternate)`,
      skill: attack.skill,
    }));
  }

  return { weapon, effects };
}

/**
 * Perks, Powers and Hang-Ups - the flat Items with no nesting.
 *
 * Their descriptions are the book text the GM pasted, written into an Item in the GM's OWN WORLD.
 * That is categorically different from the project's standing rule against putting book text into
 * shipped compendium items; `createActorFromStatBlock` refuses to write into a pack at all.
 *
 * Threat Perks are created as `general` because E20.perkTypes has no `threat` key (E20.powerTypes
 * does) - see the plan's §8 risk 3, which is a schema decision, not a parser one.
 */
export function buildSimpleItems(ir) {
  const items = [];

  for (const perk of ir.perks ?? []) {
    items.push({
      name: perk.name,
      type: 'perk',
      system: { description: perk.text, type: 'general' },
    });
  }

  for (const power of ir.powers ?? []) {
    const system = { description: power.text, type: 'threat' };
    if (power.actionType) {
      system.actionType = power.actionType;
    }

    if (power.usesPer !== null && power.usesPer !== undefined) {
      system.usesPer = power.usesPer;
      system.usesInterval = power.usesInterval ?? 'perScene';
    }

    items.push({ name: power.name, type: 'power', system });
  }

  for (const hangUp of ir.hangUps ?? []) {
    items.push({
      name: hangUp.name,
      type: 'hangUp',
      system: { description: hangUp.text },
    });
  }

  return items;
}

/* ------------------------------------------------------------------ *
 * The reverse direction: Actor -> IR                                  *
 * ------------------------------------------------------------------ */

/**
 * Reads a live Actor back into the parser's IR shape - the input half of the Grow generator
 * (docs/STAT_BLOCK_IMPORTER_PLAN.md §6.6), and what a future "export as stat block" would use.
 *
 * Prefers the `statBlockSource` flag an imported actor carries, which is lossless. Falls back to
 * reading the document itself, which also works for an actor a GM built by hand.
 *
 * Reading the document is the exact inverse of buildActorData: `defenses.<d>.total` is already the
 * printed number (base + essence + bonus + armor), and `health.max` is already origin +
 * conditioning, so neither reconciliation has to be undone by hand here.
 *
 * @param {Actor} actor
 * @param {Object} [options]
 * @param {Boolean} [options.preferFlag]   Set false to always re-read the document.
 * @returns {Object}
 */
export function actorToIr(actor, { preferFlag = true } = {}) {
  const flagged = preferFlag ? actor.getFlag?.('essence20', 'statBlockSource')?.ir : null;
  if (flagged) {
    return foundry.utils.deepClone(flagged);
  }

  const system = actor.system;
  const ir = {
    name: actor.name,
    threatLevel: system.threatLevel ?? null,
    size: system.size ?? null,
    health: system.health?.max ?? null,
    conditioning: system.conditioning ?? 0,
    essences: {},
    defenses: {},
    movement: {},
    languages: [...(system.languages ?? [])],
    skills: [],
    perks: [],
    powers: [],
    hangUps: [],
    attacks: [],
    equipment: [],
    diagnostics: [],
  };

  for (const essence of ['strength', 'speed', 'smarts', 'social']) {
    ir.essences[essence] = system.essences?.[essence]?.max ?? null;
  }

  for (const defense of Object.keys(DEFENSE_ESSENCES)) {
    ir.defenses[defense] = system.defenses?.[defense]?.total ?? null;
  }

  for (const type of ['ground', 'aerial', 'swim', 'climb']) {
    const total = system.movement?.[type]?.total ?? 0;
    ir.movement[type] = total || null;
  }

  for (const [key, fields] of Object.entries(system.skills ?? {})) {
    // isChosen is what the NPC sheet itself uses to decide a skill is worth showing, so it is the
    // right filter for "what this stat block would print".
    if (!fields.isChosen) {
      continue;
    }

    const specialization = Object.values(fields.specializations ?? {})[0];
    ir.skills.push({
      key,
      shift: fields.shift ?? null,
      modifier: 0,
      isSpecialized: Boolean(fields.isSpecialized),
      specialization: specialization?.name ?? null,
    });
  }

  for (const item of actor.items ?? []) {
    const entry = { name: item.name, text: item.system?.description ?? '' };
    if (item.type === 'perk') {
      ir.perks.push(entry);
    } else if (item.type === 'power') {
      ir.powers.push({
        ...entry,
        usesPer: item.system?.usesPer ?? null,
        usesInterval: item.system?.usesInterval ?? null,
        actionType: item.system?.actionType ?? null,
      });
    } else if (item.type === 'hangUp') {
      ir.hangUps.push(entry);
    } else if (item.type === 'weapon') {
      ir.attacks.push(weaponToAttack(item, actor));
    }
  }

  return ir;
}

/** One weapon Item plus its child weaponEffects, back in the IR's attack shape. */
function weaponToAttack(weapon, actor) {
  const children = (actor.items ?? [])
    .filter(item => item.type === 'weaponEffect'
      && item.flags?.essence20?.parentId === weapon.id);
  const [primary, ...alternates] = children;

  const toEffect = (effect) => ({
    name: effect?.name ?? weapon.name,
    damageValue: effect?.system?.damageValue ?? null,
    damageType: effect?.system?.damageType ?? null,
    isReach: Boolean(effect?.system?.range?.reachMultiplier) || !effect?.system?.range?.value,
    range: {
      value: effect?.system?.range?.value ?? null,
      long: effect?.system?.range?.long ?? null,
      min: effect?.system?.range?.min ?? null,
      reachMultiplier: effect?.system?.range?.reachMultiplier ?? null,
    },
    radius: effect?.system?.radius ?? 0,
    shape: effect?.system?.shape ?? null,
    defenseType: effect?.system?.defenseType ?? null,
  });

  // The primary effect's own clauses sit directly on the attack (the parser's shape), so its
  // `name` is dropped in favour of the weapon's.
  const primaryClauses = toEffect(primary);
  delete primaryClauses.name;

  return {
    name: weapon.name,
    skill: primary?.system?.classification?.skill ?? weapon.system?.requirements?.skill ?? null,
    shift: null,
    isSpecialized: Boolean(primary?.system?.isSpecialized),
    numHands: primary?.system?.numHands ?? null,
    traits: [...(weapon.system?.traits ?? [])],
    ...primaryClauses,
    alternateEffects: alternates.map(toEffect),
  };
}

/* ------------------------------------------------------------------ *
 * Compendium substitution                                             *
 * ------------------------------------------------------------------ */

/**
 * Flattens the per-section match results into one `type::name` lookup, so a bare item built by
 * `buildSimpleItems` can find its own match without depending on array ordering.
 * @param {Object} matches   As returned by helpers/stat-block-match.mjs#findMatches.
 * @returns {Map<String, Object>}
 */
export function buildMatchLookup(matches) {
  const lookup = new Map();
  for (const [section, type] of Object.entries(MATCHABLE_SECTIONS)) {
    for (const entry of matches?.[section] ?? []) {
      if (entry.match) {
        lookup.set(indexKey(type, entry.name), entry.match);
      }
    }
  }

  return lookup;
}

/**
 * Swaps each bare Item for a real copy of its matched compendium Item.
 *
 * The parsed description is carried across onto the compendium copy when the compendium entry has
 * none of its own - which is the normal case, since the shipped packs deliberately omit item
 * descriptions for copyright reasons (see the README). The result is the best of both: the
 * compendium Item's Active Effects and `_stats.compendiumSource` for automation, plus the GM's
 * own pasted text as the description, in the GM's own world.
 *
 * @param {Object[]} items      Bare creation data from buildSimpleItems.
 * @param {Object} matches      As returned by findMatches; falsy means "no matching, keep bare".
 * @returns {Promise<{items: Object[], substituted: Number}>}
 */
export async function applyCompendiumMatches(items, matches) {
  const lookup = buildMatchLookup(matches);
  if (!lookup.size) {
    return { items, substituted: 0 };
  }

  const resolved = [];
  let substituted = 0;

  for (const item of items) {
    const match = lookup.get(indexKey(item.type, item.name));
    const source = match ? await fromUuid(match.uuid) : null;
    if (!source) {
      // A match that can no longer be resolved (pack disabled or re-ids since the preview) falls
      // back to the bare item rather than dropping the entry.
      resolved.push(item);
      continue;
    }

    const data = game.items.fromCompendium(source);
    if (!data.system?.description && item.system?.description) {
      data.system = { ...data.system, description: item.system.description };
    }

    resolved.push(data);
    substituted += 1;
  }

  return { items: resolved, substituted };
}

/* ------------------------------------------------------------------ *
 * Orchestration (impure)                                              *
 * ------------------------------------------------------------------ */

/**
 * Creates the Actor and everything on it.
 *
 * Attacks are a three-step dance rather than one `items:` array, because a `weaponEffect` has to
 * carry `flags.essence20.parentId` pointing at its weapon's real id and the weapon has to carry a
 * matching `system.items` entry - neither of which exists until after creation. This mirrors
 * sheet-handlers/attachment-handler.mjs#_attachItem exactly, and reuses its own
 * `setEntryAndAddItem` so an imported attack ends up structurally identical to a hand-dropped one.
 *
 * @param {Object} ir   The parser's IR.
 * @param {Object} [options]   Passed through to buildActorData, plus:
 *   `matches` - compendium matches from helpers/stat-block-match.mjs#findMatches; when present,
 *   matched Perks/Powers/Hang-Ups are created as real compendium copies instead of bare Items.
 *   `pack` - refused outright, see below.
 * @returns {Promise<Actor|null>}
 */
export async function createActorFromStatBlock(ir, options = {}) {
  if (options.pack) {
    throw new Error('essence20 | Stat block import writes world documents only, never compendium packs.');
  }

  // Imported lazily rather than at the top of this file on purpose: attachment-handler.mjs pulls
  // in apps/choices-selector.mjs, which reads the `foundry` global at module scope. A static
  // import would mean nothing could load the pure half of this module - buildActorData and
  // friends - outside a live client, which is exactly what the parser/builder split exists to
  // avoid (unit tests, a future "export as stat block" path, a headless script).
  const { setEntryAndAddItem } = await import("../sheet-handlers/attachment-handler.mjs");

  // Items are resolved BEFORE the actor data is built, because the Active Effects they bring
  // decide how much has to come back out of the residuals - see collectEffectContributions.
  const { items } = await applyCompendiumMatches(buildSimpleItems(ir), options.matches);
  const actorData = buildActorData(ir, {
    ...options,
    effectContributions: options.effectContributions ?? collectEffectContributions(items),
  });
  actorData.items = items;

  const actor = await Actor.create(actorData);
  if (!actor) {
    return null;
  }

  for (const attack of ir.attacks ?? []) {
    const { weapon, effects } = buildWeaponData(attack);
    const [weaponItem] = await actor.createEmbeddedDocuments('Item', [weapon]);
    if (!weaponItem) {
      continue;
    }

    for (const effect of effects) {
      const [effectItem] = await actor.createEmbeddedDocuments('Item', [effect]);
      if (!effectItem) {
        continue;
      }

      await effectItem.setFlag('essence20', 'parentId', weaponItem._id);
      const key = await setEntryAndAddItem(effectItem, weaponItem);
      if (key) {
        await effectItem.setFlag('essence20', 'collectionId', key);
      }
    }
  }

  return actor;
}
