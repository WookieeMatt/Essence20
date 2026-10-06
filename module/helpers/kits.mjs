import { companionsOf } from "./companion-link.mjs";
import { getSceneEpoch } from "./scene-clock.mjs";
import { ruleBrawnBonus } from "../rules/ext/c/brawn.mjs";

/**
 * Kits (GI Joe CRB p.159-160, TF CRB p.133, Quartermaster's Guide p.42-47, Cobra Codex p.90-92,
 * WTNV Citizen's Guide p.70-71).
 *
 * "STANDARD KIT (CONSUMABLE) Prerequisites: d4 in the Specialization's parent Skill. You can attempt
 * Skill Tests that call for this specialization's Standard kit without a Snag. You can attempt Skill
 * Tests that call for this Specialization's Limited kit with ↓1 instead of a Snag, and Skill Tests
 * that call for this Specialization's Restricted kit with ↓3 instead of a Snag. You can take 10
 * minutes and consume this kit to gain temporary Specialization in this kit's Specialization for 1
 * minute, or gain ↑1 for 1 minute ... if you are already specialized." Limited (d6): no Snag up to
 * Limited, ↓2 for Restricted, consumed for 1 hour of Specialization or Edge. Restricted (d8): no Snag,
 * and "temporary Specialization in this kit's Specialization for the duration of this Mission, or an
 * Edge" - it isn't used up.
 *
 * - A kit's tier, Skill and Specialization come from its flags.essence20.kit when set (a generic
 *   kit, or a re-specialized one), otherwise from its name ("Limited Infiltration (Burglary) Kit").
 * - A roll that calls for a kit says so in the Roll Options Dialog ("Kit required"); the best kit
 *   the roller carries decides the Snag or ↓ (kitRequirement, applied by target-riders.mjs).
 * - Using one up leaves it spent (flags.essence20.kitSpent) rather than deleting it, because
 *   "By scrounging, you can replenish a kit" (Quartermaster's Guide p.21): "A Standard Kit requires a
 *   base DIF of 5 to replenish. A Limited Kit requires a base DIF of 10".
 * - What using one up gives is kept on the actor as a boost (flags.essence20.kitBoosts), read when
 *   they roll that Skill.
 */

const uuid = (pack, id) => `Compendium.essence20.${pack}.Item.${id}`;
export const KIT = {
  falseFace: uuid('quartermasters_guide_to_gear', 'OGIfZabiFlcjwCaz'),
  handyScrounger: uuid('quartermasters_guide_to_gear', 'uXV4DoOaLhrZmIkz'),
  reinforcedBasics: uuid('quartermasters_guide_to_gear', '4HD4ibkT5hTdwlAW'),
  stretchingResources: uuid('quartermasters_guide_to_gear', 'CJTtjWkUl7BhiaN4'),
  bomber: uuid('cobra_codex', 'WW5PNoq6d3CBU3FC'),
  medicineCabinet: uuid('cobra_codex', 'd5xmwJqcoXyhVIVK'),
  crashSurvivor: uuid('cobra_codex', '5SKezm0w5KQbdSJ4'),
  hearty: uuid('cobra_codex', '3Jh0J7IxLr6eF1uA'),
  takeTheWheel: uuid('cobra_codex', 'EQK0bAGpmYkGPcRi'),
  kittedOut: uuid('cobra_codex', 'f0GAXS72eKNLB6x1'),
  efficacyAdjustment: uuid('cobra_codex', '8pao5WMYv8zZNiw6'),
  utilityAdjustment: uuid('cobra_codex', 'sVFK8wa26RXzq8rC'),
  forageFamiliarity: uuid('ferocious_fighters', '2MvQyj4AUcr4QOtU'),
  weaponForage: uuid('ferocious_fighters', 'OWVl8HRXBI7mwJ0j'),
  medKit: uuid('pr_crb', 'UgggFXZqiyKxwMuA'),
  wristCommunicator: uuid('pr_crb', 'W7nXP8pOQaDJmZbT'),
  growthBoost: uuid('jump_through_time', 'BVrwQKqvOdyNW0KR'),
  competitiveStrength: uuid('jump_through_time', 'J0ljd1QnU9AgoWj6'),
  loader: uuid('tf_crb', 'OVTDUJRI81VCrFZg'),
  kittedPurpose: uuid('tf_crb', 'YO5STToLRPYVnWBT'),
  personnelMunitionsPack: uuid('enigma_of_combination', 'CXenUI5l8c3WZNSw'),
  protomatterInjectionLayer: uuid('enigma_of_combination', 'LjibCLhbxNxaQnrU'),
  automatedRepairKit: uuid('transformers_adventures', '2P2i605rHgNhm2FJ'),
  takeMine: uuid('mlp_crb', '7CrDN77ITR9IV2nB'),
  imaginaryCorn: uuid('wtnv_citizens_guide', '2i8jWYZH14Cu30LO'),
  wtnvMedicineKit: uuid('wtnv_citizens_guide', '3mgHGQRzVaKtwnWb'),
  wtnvScienceKit: uuid('wtnv_citizens_guide', 'alcXH1wbroHciYlS'),
  wtnvTravelReporterKit: uuid('wtnv_citizens_guide', 'gG1nTctk40oLyJJH'),
};

// Kitbasher (GI Joe CRB, Ranger Exposure, p.91): "You can forage for and use a kit, even if you do
// not meet its prerequisite."
const KITBASHER = uuid('gi_joe_crb', 'az09yEPydnE1tBTj');
// Gear with "Kit" or "Pack" in its name that isn't a Specialization kit.
const NOT_KITS = new Set([KIT.medKit, KIT.automatedRepairKit, KIT.personnelMunitionsPack, KIT.wristCommunicator]);

export const TIERS = ['standard', 'limited', 'restricted'];
// Prototype and Theoretical Kits (Quartermaster's Guide p.41) sit above Restricted: "Prerequisites:
// d10 [d12] in the Specialization's parent Skill ... temporary Specialization in this kit's
// Specialization for the duration of this mission, or Edge" - a Restricted kit's benefit, one or two
// tiers up.
const TIER_RANK = [...TIERS, 'prototype', 'theoretical'];
const ESSENCE_KITS = { strength: 'strength', speed: 'speed', smarts: 'smarts', social: 'social' };
// Prerequisites: Standard d4, Limited d6, Restricted d8, Prototype d10, Theoretical d12 in the parent
// Skill; an Essence Kit d2.
const PREREQUISITE = { standard: 'd4', limited: 'd6', restricted: 'd8', prototype: 'd10', theoretical: 'd12', essence: 'd2' };

// Skill Kits (Quartermaster's Guide p.41): "Choose a Skill when you requisition this kit. You do not
// suffer Snag for having no Ranks in this Skill". Basic: "No Ranks in [its] Skill", Standard;
// Advanced: "No more than d2 Ranks", Limited, and can be used up for ↑1 for 1 minute.
const BASIC_SKILL_KIT = uuid('quartermasters_guide_to_gear', 'gRxcVy1mS18jyWtx');
const ADVANCED_SKILL_KIT = uuid('quartermasters_guide_to_gear', 'hSUVWDrRgUHcr5mm');
const SKILL_KITS = {
  [BASIC_SKILL_KIT]: { tier: 'standard', maxRank: 'd20' },
  [ADVANCED_SKILL_KIT]: { tier: 'limited', maxRank: 'd2' },
};

// Kits tied to more than one Skill. Restricted Wild Animal Survival Kit (Operation Cold Iron p.39):
// "Prerequisites: +d8 in Animal Handling or Survival", and it covers "a Restricted Kit related to
// Animal Handling and Survival specialties".
const WILD_ANIMAL_SURVIVAL_KIT = uuid('operation_cold_iron', 'EI7uvXnVEv0eK1C7');
const MULTI_SKILL_KITS = {
  [WILD_ANIMAL_SURVIVAL_KIT]: { tier: 'restricted', skills: ['animalHandling', 'survival'] },
};

// My Little Pony kits (MLP CRB, Kits optional rule): "If you have the right kit for what you want
// to do, you are fine ... if you don't have the right kit you suffer Snag". No tiers, no
// prerequisite, and nothing to use up - each only names its Skill.
const MLP_KITS = Object.fromEntries(Object.entries({
  RX3EOYSX1c9H1xcA: ['performance'], // Art
  rwtVdKzYShQvE6AG: ['culture'], // Baking
  WEpSxlVg5PNOER7T: ['infiltration'], // Burglary
  l69ECABViS1WaFDQ: ['technology'], // Carpentry
  tlhoSei7ErftyWwj: ['athletics'], // Climbing
  weYxWOfqpYA29AMB: ['technology'], // Computer/Electronics
  '90PF2Uvlv32sjgrZ': ['science', 'alertness'], // Forensic: "Science/Investigation"
  aabFcrpJOkYpzr23: ['technology'], // Mechanic
  eOOmCAxpwwDo6RzD: ['science'], // Medical ("Medicine" is a Science Specialization)
  '1b2GkHHyiX4eJkMM': ['spellcasting'], // Potion
  vJsHbLr4SydalsYf: ['science'], // Scientific Research
  f2cklPXjsbiWx5TG: ['culture'], // Tailoring/Repair
}).map(([id, skills]) => [uuid('mlp_crb', id), skills]));

/** Every Skill a kit counts for. */
export function kitSkills(kit) {
  return kit?.skills?.length ? kit.skills : (kit?.skill ? [kit.skill] : []);
}

const BOOSTS_FLAG = 'kitBoosts';
const T = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource;
}

function itemsOf(actor) {
  const items = actor?.items;
  if (!items) {
    return [];
  }

  if (Array.isArray(items.contents)) {
    return items.contents;
  }

  return typeof items[Symbol.iterator] == 'function' ? [...items] : [];
}

function has(actor, id) {
  return itemsOf(actor).some(item => sourceOf(item) == id);
}

/** Specializations the kit names map back to their Skill (GI Joe CRB Specialization lists). */
const SPEC_SKILL = {
  medicine: 'science', burglary: 'infiltration', 'lock picking': 'infiltration', climbing: 'athletics', swimming: 'athletics',
  repair: 'technology', engineering: 'technology', explosives: 'technology', computers: 'technology', communications: 'technology',
  drones: 'technology', investigation: 'alertness', perception: 'alertness', 'situational awareness': 'alertness',
  disguise: 'deception', diplomacy: 'persuasion', chef: 'culture', 'heavyweight carry': 'brawn', 'chemical engineering': 'science',
  arctic: 'survival', desert: 'survival', jungle: 'survival',
};

function skillKey(name) {
  const clean = String(name ?? '').trim().toLowerCase();
  const skills = CONFIG.E20?.skills ?? {};
  return Object.keys(skills).find(key => key.toLowerCase() == clean.replace(/\s+/g, '')
    || game.i18n.localize(skills[key]).toLowerCase() == clean) ?? null;
}

/**
 * A kit's tier, Skill and Specialization.
 * @param {Item} item
 * @returns {{tier: String, skill: ?String, spec: ?String, essence: ?String}|null}
 */
export function kitInfo(item) {
  if (!item || item.type != 'gear') {
    return null;
  }

  const stored = item.flags?.essence20?.kit;
  const name = String(item.name ?? '').trim();
  const isKit = item.system?.gearType == 'kits' || /\bkit\b/i.test(name) || !!stored;
  if (!isKit || NOT_KITS.has(sourceOf(item))) {
    return null;
  }

  const match = /^(standard|limited|restricted|prototype|theoretical)\s+(.*?)\s*kit$/i.exec(name);
  const tier = stored?.tier ?? (match ? match[1].toLowerCase() : 'limited');
  const body = match ? match[2] : name.replace(/\s*kit$/i, '');
  let skill = null;
  let spec = null;
  // "Essence Kit (Smarts)" (Quartermaster's Guide p.42).
  const essenceParen = /^essence\s*kit\s*\((\w+)\)$/i.exec(name);
  const essence = ESSENCE_KITS[(essenceParen?.[1] ?? body).trim().toLowerCase()] ?? null;
  const paren = /^(.*?)\s*\((.*)\)$/.exec(body.trim());
  if (essence) {
    // Nothing more to read.
  } else if (paren) {
    spec = /,|\bor\b/i.test(paren[2]) ? null : paren[2].trim();
    // "Limited Artisan (Chef) Kit" - Artisan isn't a Skill, so the Specialization names it.
    skill = skillKey(paren[1]) ?? SPEC_SKILL[spec?.toLowerCase()] ?? null;
  } else {
    skill = skillKey(body);
    if (!skill) {
      spec = body.trim() || null;
      skill = SPEC_SKILL[spec?.toLowerCase()] ?? null;
    }
  }

  // Night Vale's named kits (Citizen's Guide p.70-71).
  if (sourceOf(item) == KIT.wtnvMedicineKit) {
    [skill, spec] = ['science', 'Medicine'];
  } else if (sourceOf(item) == KIT.wtnvScienceKit) {
    [skill, spec] = ['science', null];
  } else if (sourceOf(item) == KIT.wtnvTravelReporterKit) {
    [skill, spec] = ['streetwise', null];
  }

  const source = sourceOf(item);
  const skillKit = SKILL_KITS[source]
    ?? (/^(basic|advanced)\s+skill\s+kit$/i.test(name) ? SKILL_KITS[/^basic/i.test(name) ? BASIC_SKILL_KIT : ADVANCED_SKILL_KIT] : null);
  if (skillKit) {
    // The Skill is chosen on the Use button; there's no Specialization.
    return {
      tier: skillKit.tier, skill: stored?.skill ?? null, spec: null, essence: null, skillKit: true, maxRank: skillKit.maxRank,
      ignorePrerequisite: !!item.flags?.essence20?.ignorePrerequisite,
    };
  }

  const multi = MULTI_SKILL_KITS[source];
  const mlp = MLP_KITS[source];
  const skills = stored?.skill ? null : (multi?.skills ?? mlp ?? null);
  return {
    tier: stored?.tier ?? multi?.tier ?? (essence ? 'limited' : tier),
    skill: stored?.skill ?? skills?.[0] ?? skill,
    ...(skills ? { skills } : {}),
    spec: stored?.spec ?? (skills ? null : spec),
    essence: stored?.essence ?? essence,
    ...(mlp ? { simple: true } : {}),
    ignorePrerequisite: !!item.flags?.essence20?.ignorePrerequisite,
  };
}

function rankIndex(shift) {
  return (CONFIG.E20?.skillShiftList ?? []).indexOf(shift);
}

/** "Prerequisites: d6 in Infiltration" and the like. */
export function meetsKitPrerequisite(actor, info) {
  if (info.simple || info.ignorePrerequisite || !info.skill || has(actor, KITBASHER)) {
    return true;
  }

  // A Skill Kit is for the untrained: "No Ranks" / "No more than d2 Ranks" in its Skill.
  if (info.skillKit) {
    const own = actor?.system?.skills?.[info.skill]?.shift;
    return !own || rankIndex(own) < 0 || rankIndex(own) >= rankIndex(info.maxRank);
  }

  // Good To Go: "treat the Prerequisites as one Rank lower" (helpers/extensions/qualify1).
  const needOut = { need: PREREQUISITE[info.essence ? 'essence' : info.tier] ?? 'd4' };
  globalThis.Hooks?.call?.('essence20.kitPrerequisite', actor, info, needOut);
  const need = needOut.need;
  const list = CONFIG.E20?.skillShiftList ?? [];
  // Any one of a multi-Skill kit's Skills will do ("d8 in Animal Handling or Survival").
  return kitSkills(info).some(skill => {
    const own = actor?.system?.skills?.[skill]?.shift;
    // skillShiftList runs from the biggest die down, so a smaller index is a better die.
    return !own || !list.length || rankIndex(own) <= rankIndex(need);
  });
}

/**
 * The kits that count for this actor right now: carried, not spent, prerequisites met - plus the
 * Alterations and Mini-Con bond that give a kit's benefits without one.
 * @param {Actor} actor
 * @returns {Array<Object>}   {item, tier, skill, spec, essence}
 */
export function activeKits(actor) {
  const kits = [];
  for (const item of itemsOf(actor)) {
    const info = kitInfo(item);
    if (info && !item.flags?.essence20?.kitSpent && meetsKitPrerequisite(actor, info)) {
      kits.push({ item, ...info });
    }

    // Utility Adjustment / Efficacy Adjustment (Cobra Codex p.85-86): "Gain the benefits of a
    // Standard [Limited] Kit." Kitted Purpose (TF CRB p.74): "when your Mini-Con is docked to you, you
    // gain the benefits of a Limited Kit of a Specialty associated with their purpose."
    const virtual = item.flags?.essence20?.virtualKit;
    if (virtual && !virtual.spent && (sourceOf(item) != KIT.kittedPurpose || kittedPurposeDocked(actor, virtual))) {
      kits.push({ item, tier: virtual.tier, skill: virtual.skill, spec: virtual.spec, essence: null });
    }
  }

  return kits;
}

/**
 * Kitted Purpose: "when your Mini-Con is docked to you" - the real Mini-Con's dock when there is one
 * (helpers/companions.mjs), the Use toggle otherwise.
 */
function kittedPurposeDocked(actor, virtual) {
  const miniCons = companionsOf(actor, { type: 'miniCon' });
  if (!miniCons.length) {
    return !!virtual.docked;
  }

  return miniCons.some(m => m.flags?.essence20?.miniCon?.docked !== false);
}

/**
 * A Skill Kit: "You do not suffer Snag for having no Ranks in this Skill when making Skill Tests."
 * Read by roll-dialog.mjs#_isUntrainedSnag.
 * @param {Actor} actor
 * @param {String} skill
 * @returns {Boolean}
 */
export function skillKitNoUntrainedSnag(actor, skill) {
  return !!skill && activeKits(actor).some(kit => kit.skillKit && kit.skill == skill);
}

/**
 * Restricted Wild Animal Survival Kit (Operation Cold Iron p.39): its holder may "use Animal
 * Handling or Survival to make Persuasion Skill Tests against animals". Offered by dice.mjs as a
 * Roll Options Dialog choice on a Persuasion roll whose target reads as an animal (or with no
 * target, where the player says who they're persuading).
 * @param {Actor} actor
 * @param {String} skill   The Skill being rolled.
 * @returns {?{kit: Item, skills: Array<String>}}   The carried kit and the Skills it may swap in.
 */
export function wildAnimalPersuasion(actor, skill) {
  if (skill != 'persuasion') {
    return null;
  }

  const kit = activeKits(actor).find(k => sourceOf(k.item) == WILD_ANIMAL_SURVIVAL_KIT);
  return kit ? { kit: kit.item, skills: ['animalHandling', 'survival'] } : null;
}

/**
 * What a roll that calls for a kit costs this actor, with their best kit.
 * @param {Actor} actor
 * @param {String} skill   The Skill being rolled.
 * @param {?String} spec   The Specialization being rolled, if any.
 * @param {String} needed   'standard', 'limited', 'restricted' or 'essence'.
 * @param {Object} [options]
 * @param {Number} [options.bump]   Tiers added to every kit (Handy Scrounger).
 * @returns {{snag: Boolean, shiftDown: Number, kit: ?Object}}
 */
export function kitRequirement(actor, skill, spec, needed, { bump = 0 } = {}) {
  if (!needed || needed == 'none') {
    return { snag: false, shiftDown: 0, kit: null };
  }

  const essence = CONFIG.E20?.skillToEssence?.[skill];
  const want = TIER_RANK.indexOf(needed);
  let best = { snag: true, shiftDown: 0, kit: null };
  const better = (option) => {
    if (best.snag || (!option.snag && option.shiftDown < best.shiftDown)) {
      best = option;
    }
  };

  for (const kit of activeKits(actor)) {
    // An Essence Kit (Quartermaster's Guide p.42): "You can attempt Skill Tests that call for an
    // Essence Kit without Snag. If a Skill Test calls for a kit with the Specialization tied to the
    // Essence of this kit ..., you can attempt that Skill Test with ↓2 and Skill Tests that call for
    // this Specialization's Limited Kit with ↓4."
    if (kit.essence) {
      if (needed == 'essence') {
        better({ snag: false, shiftDown: 0, kit });
      } else if (kit.essence == essence && want <= 1) {
        better({ snag: false, shiftDown: want == 0 ? 2 : 4, kit });
      }

      continue;
    }

    // A generic kit waits for its Specialization to be chosen; a Skill Kit is never "the kit" a test
    // calls for.
    if (kit.skillKit || needed == 'essence' || !kitSkills(kit).includes(skill)
      || (spec && kit.spec && kit.spec.toLowerCase() != String(spec).toLowerCase())) {
      continue;
    }

    // A My Little Pony kit is simply the right kit or not.
    if (kit.simple) {
      better({ snag: false, shiftDown: 0, kit });
      continue;
    }

    const have = Math.min(TIER_RANK.length - 1, TIER_RANK.indexOf(kit.tier) + bump);
    if (have >= want) {
      better({ snag: false, shiftDown: 0, kit });
    } else if (want == 1 && have == 0) {
      better({ snag: false, shiftDown: 1, kit });
    } else if (want == 2) {
      better({ snag: false, shiftDown: have == 1 ? 2 : 3, kit });
    }
  }

  return best;
}

/* -------------------------------------------- */
/*  Boosts from a used-up kit                    */
/* -------------------------------------------- */

function turnStamp() {
  const combat = game?.combat;
  return combat ? { combatId: combat.id, round: combat.round, turn: combat.turn } : {};
}

function isBoostLive(boost) {
  if (boost.scene != null && boost.kind == 'scene' && boost.scene != getSceneEpoch()) {
    return false;
  }

  const combat = game?.combat;
  if (boost.kind == 'rounds') {
    if (!combat || combat.id != boost.combatId) {
      return !boost.combatId && boost.scene == getSceneEpoch();
    }

    return combat.round < (boost.round ?? 0) + (boost.rounds ?? 10);
  }

  return true;
}

export function kitBoostsOf(actor) {
  const boosts = actor?.flags?.essence20?.[BOOSTS_FLAG];
  return Array.isArray(boosts) ? boosts.filter(isBoostLive) : [];
}

async function addBoost(actor, boost) {
  await actor.setFlag('essence20', BOOSTS_FLAG, [...kitBoostsOf(actor), { ...boost, ...turnStamp(), scene: getSceneEpoch(), id: foundry.utils.randomID?.() ?? String(Math.random()) }]);
}

export async function removeBoost(actor, id) {
  const boosts = kitBoostsOf(actor);
  const kept = boosts.filter(b => b.id != id);
  if (kept.length != boosts.length) {
    await actor.setFlag('essence20', BOOSTS_FLAG, kept);
  }
}

/**
 * Shifts, Edge and Specialization from kits for a roll of this Skill: boosts from kits used up,
 * and a carried Restricted kit ("temporary Specialization ... for the duration of this Mission, or an
 * Edge ... if you are already specialized"). Imaginary Corn's Strength ↑1 rides here too.
 * @param {Actor} actor
 * @param {String} skill
 * @param {?String} spec
 * @param {Boolean} specialized   Whether the roll is already Specialized.
 *
 * Prototype and Theoretical Kits (Quartermaster's Guide p.41) add: "If you gain Snag from another
 * source on this test that would negate its Edge, ignore the Snag" (ignoreSnagOnEdge, only when
 * the kit is giving its Edge), and the Theoretical Kit's "any negative dice shifts are reduced to
 * only one step" (maxShiftDown 1, whenever the kit is in use). dice.mjs applies both right before
 * the shifts resolve.
 * @returns {{sources: Array<Object>, specialize: Boolean, consumes: Array<String>,
 *   ignoreSnagOnEdge: Boolean, maxShiftDown: ?Number}}
 */
export function kitSources(actor, skill, spec, specialized) {
  const sources = [];
  const consumes = [];
  let specialize = false;
  let ignoreSnagOnEdge = false;
  let maxShiftDown = null;
  const essence = CONFIG.E20?.skillToEssence?.[skill];
  const matches = b => (b.skill ? b.skill == skill : (b.essence ? b.essence == essence : false))
    && (!spec || !b.spec || String(b.spec).toLowerCase() == String(spec).toLowerCase());
  for (const boost of kitBoostsOf(actor).filter(matches)) {
    if (boost.mode == 'specialize' && !specialized) {
      specialize = true;
    } else if (boost.mode == 'shiftUp' || (boost.mode == 'specialize' && specialized && boost.fallback == 'shiftUp')) {
      sources.push({ id: `kit-${boost.id}`, label: boost.label, shiftUp: boost.times ?? 1, shiftDown: 0, edge: false, snag: false });
    } else if (boost.mode == 'edge' || (boost.mode == 'specialize' && specialized && boost.fallback == 'edge')) {
      sources.push({ id: `kit-${boost.id}`, label: boost.label, shiftUp: 0, shiftDown: 0, edge: true, snag: false });
    }

    if (boost.oneTest) {
      consumes.push(boost.id);
    }
  }

  for (const kit of activeKits(actor)) {
    if (TIER_RANK.indexOf(kit.tier) >= 2 && !kit.essence && !kit.simple && kitSkills(kit).includes(skill)
      && (!spec || !kit.spec || kit.spec.toLowerCase() == String(spec).toLowerCase())) {
      const aboveRestricted = TIER_RANK.indexOf(kit.tier) >= 3;
      if (specialized) {
        sources.push({ id: `kit-restricted-${kit.item.id}`, label: kit.item.name, shiftUp: 0, shiftDown: 0, edge: true, snag: false });
        ignoreSnagOnEdge ||= aboveRestricted;
      } else {
        specialize = true;
      }

      if (kit.tier == 'theoretical') {
        maxShiftDown = 1;
      }
    }
  }

  return { sources, specialize, consumes, ignoreSnagOnEdge, maxShiftDown };
}

/* -------------------------------------------- */
/*  Use buttons                                  */
/* -------------------------------------------- */

async function choose(title, prompt, buttons) {
  return foundry.applications.api.DialogV2.wait({
    window: { title },
    classes: ["window-app", "e20-window"],
    content: `<p>${prompt}</p>`,
    buttons: buttons.map(([action, label]) => ({ action, label })),
    rejectClose: false,
  });
}

async function chooseSelect(title, prompt, options) {
  if (!options.length) {
    return null;
  }

  return foundry.applications.api.DialogV2.wait({
    window: { title },
    classes: ["window-app", "e20-window"],
    content: `<p>${prompt}</p><div class="form-group"><select name="choice">${
      options.map(o => `<option value="${o.value}">${foundry.utils.escapeHTML(o.label)}</option>`).join('')
    }</select></div>`,
    buttons: [
      { action: 'ok', label: T('E20.DialogConfirmButton'), default: true, callback: (event, button) => button.form.elements.choice.value },
      { action: 'cancel', label: T('E20.DialogCancelButton') },
    ],
    rejectClose: false,
  }).then(result => (result && result != 'cancel' ? result : null));
}

async function rollTest(actor, skill, dif, extra = {}) {
  const essence = CONFIG.E20.skillToEssence?.[skill] ?? 'smarts';
  const result = await actor._dice?.rollSkill({ skill, essence, shiftUp: 0, shiftDown: 0, dif: String(dif), ...extra }, actor);
  const first = result?.outcomes?.[0]?.results?.[0];
  return { success: !!result?.success, crit: !!first && first.multiplier >= 2 };
}

/** "Scrounging": Standard DIF 5, Limited DIF 10; Handy Scrounger takes 5 off. */
export function scroungeDif(actor, tier) {
  const base = tier == 'standard' ? 5 : 10;
  return Math.max(0, base - (has(actor, KIT.handyScrounger) ? 5 : 0));
}

async function pickSkill(title) {
  const skills = CONFIG.E20.skills ?? {};
  const skill = await chooseSelect(title, T('E20.KitPickSkill'), Object.entries(skills).map(([value, label]) => ({ value, label: T(label) })));
  return skill ? { skill, spec: null } : null;
}

async function pickSpecialization(title, skillHint = null) {
  const skills = CONFIG.E20.skills ?? {};
  const skill = skillHint ?? await chooseSelect(title, T('E20.KitPickSkill'), Object.entries(skills).map(([value, label]) => ({ value, label: T(label) })));
  if (!skill) {
    return null;
  }

  const lists = Object.values(CONFIG.E20.standardSpecializations ?? {}).map(line => line?.[skill] ?? []).flat();
  const specs = [...new Set(lists)].sort();
  const spec = specs.length ? await chooseSelect(title, T('E20.KitPickSpecialization'), [{ value: '', label: T('E20.KitAnySpecialization') }, ...specs.map(s => ({ value: s, label: s }))]) : '';
  return spec === null ? null : { skill, spec: spec || null };
}

/**
 * Use up a kit (or a kit's worth of benefit): 10 minutes, or a Standard action for the Alterations.
 * @param {Actor} actor
 * @param {Item} item
 * @param {Object} info   From kitInfo, or a virtual kit.
 * @param {Function} pay
 * @returns {Promise<String|null>}
 */
async function consumeKit(actor, item, info, pay, { virtual = false } = {}) {
  let tier = info.tier;
  // Handy Scrounger (Quartermaster's Guide, p.30): "Whenever you use a Kit, attempt a Skill Test with the
  // same DIF as if you were scrounging refills for it ... On a success, treat the Kit as if it were one
  // degree better."
  if (!info.essence && !info.skillKit && TIER_RANK.indexOf(tier) < 2 && has(actor, KIT.handyScrounger)
    && (await rollTest(actor, info.skill ?? 'survival', scroungeDif(actor, tier))).success) {
    tier = TIERS[Math.min(2, TIERS.indexOf(tier) + 1)];
  }

  if (virtual && !(await pay('standard'))) {
    return null;
  }

  const label = item.name;
  const target = { skill: info.skill, spec: info.spec, essence: info.essence };
  if (info.skillKit) {
    // Advanced Skill Kit: "consume this kit to gain ↑1 for 1 minute on Skill Tests of this kit's Skill."
    await addBoost(actor, { ...target, spec: null, mode: 'shiftUp', kind: 'rounds', rounds: 10, label });
  } else if (info.essence) {
    // Essence Kit: "gain temporary Specialization in one Specialization associated with this kit's
    // Essence for 1 Skill Test, or gain ↑1 for 1 Skill Test if you are already Specialized".
    await addBoost(actor, { ...target, skill: null, mode: 'specialize', fallback: 'shiftUp', oneTest: true, kind: 'untilUsed', label });
  } else if (tier == 'standard') {
    await addBoost(actor, { ...target, mode: 'specialize', fallback: 'shiftUp', kind: 'rounds', rounds: 10, label });
  } else if (tier == 'limited') {
    await addBoost(actor, { ...target, mode: 'specialize', fallback: 'edge', kind: 'scene', label });
  } else {
    await addBoost(actor, { ...target, mode: 'specialize', fallback: 'edge', kind: 'scene', label });
  }

  // The Alterations' kit: "then you lose the ongoing benefits of the kit until you sleep for 6 hours."
  if (virtual) {
    await item.setFlag('essence20', 'virtualKit', { ...item.flags.essence20.virtualKit, spent: true });
    return T('E20.KitUsed', { name: actor.name, kit: label });
  }

  // Stretching Resources (Quartermaster's Guide, p.31): "Whenever you would consume a Kit ..., attempt a
  // second Skill Test with the same DIF as if you were scrounging refills for it. On a success, the Kit
  // is not consumed."
  if (has(actor, KIT.stretchingResources) && (await rollTest(actor, info.skill ?? 'survival', scroungeDif(actor, info.tier))).success) {
    return T('E20.KitUsedKept', { name: actor.name, kit: label });
  }

  // Reinforced Basics (Quartermaster's Guide, p.17): "you get three uses out of Standard Kits instead of
  // one."
  const uses = (item.flags?.essence20?.kitUses ?? 0) + 1;
  const allowed = info.tier == 'standard' && has(actor, KIT.reinforcedBasics) ? 3 : 1;
  await item.setFlag('essence20', 'kitUses', uses);
  if (uses >= allowed) {
    await item.setFlag('essence20', 'kitSpent', true);
  }

  return T('E20.KitUsed', { name: actor.name, kit: label });
}

/**
 * A kit's own Use button: use it up, scrounge it back, or choose what it's for.
 */
export async function useKit(actor, item, pay) {
  const info = kitInfo(item);
  if (!info) {
    return null;
  }

  const spent = !!item.flags?.essence20?.kitSpent;
  const choices = [];
  // Restricted and better kits aren't used up; of the Skill Kits only the Advanced one is, once its
  // Skill is chosen.
  if (!spent && TIER_RANK.indexOf(info.tier) < 2 && (!info.skillKit || (info.tier == 'limited' && info.skill))) {
    choices.push(['consume', T('E20.KitConsume')]);
  }

  if (spent) {
    choices.push(['scrounge', T('E20.KitScrounge')]);
  }

  if (!info.essence) {
    choices.push(['specialize', T('E20.KitSetSpecialization')]);
  }

  const heal = HEAL_CONSUMABLES[sourceOf(item)];
  if (heal && !spent) {
    choices.unshift(['heal', T('E20.KitHeal', { amount: heal.amount })]);
  }

  const what = choices.length == 1 ? choices[0][0] : await choose(item.name, T('E20.KitPrompt'), choices);
  if (what == 'consume') {
    return consumeKit(actor, item, info, pay);
  }

  if (what == 'heal') {
    return healWith(actor, item, heal, pay);
  }

  if (what == 'scrounge') {
    const { success } = await rollTest(actor, info.skill ?? 'survival', scroungeDif(actor, info.tier));
    if (!success) {
      return T('E20.KitScroungeFailed', { name: actor.name, kit: item.name });
    }

    await item.update({ 'flags.essence20.kitSpent': false, 'flags.essence20.kitUses': 0 });
    return T('E20.KitScrounged', { name: actor.name, kit: item.name });
  }

  if (what == 'specialize') {
    // Kitted Out (Cobra Codex p.51): "you can spend 1 minute customizing one of your kits, changing the
    // Specialization of the kit to another specialization of the same skill." The same choice sets up
    // a generic kit.
    const picked = info.skillKit ? await pickSkill(item.name) : await pickSpecialization(item.name, info.skill);
    if (!picked) {
      return null;
    }

    await item.setFlag('essence20', 'kit', { tier: info.tier, skill: picked.skill, spec: picked.spec, essence: null });
    return T('E20.KitSpecialized', { name: actor.name, kit: item.name, spec: picked.spec ?? T(CONFIG.E20.skills?.[picked.skill] ?? picked.skill) });
  }

  return null;
}

/* -------------------------------------------- */
/*  Consumables that heal or boost               */
/* -------------------------------------------- */

const HEAL_CONSUMABLES = {
  // WTNV Medicine Kit (p.70): "You can consume this kit as a Standard action in combat to immediately
  // heal 2 Health to yourself or an ally with no Skill Test."
  [KIT.wtnvMedicineKit]: { amount: 2, cost: 'standard', spend: 'kit' },
};

/**
 * Take Mine (MLP CRB, Spirit of Generosity, 13th level, p.75): "when a friend uses one of your
 * consumable items, the item's effect doubles if they use it this round." An item handed over by
 * someone holding Take Mine is marked (onItemGiven); its effect doubles for the rest of that round.
 */
export function takeMineMultiplier(actor, item) {
  const given = item?.flags?.essence20?.givenBy;
  if (!given || given.actorUuid == actor?.uuid) {
    return 1;
  }

  const combat = game?.combat;
  const sameRound = combat ? given.combatId == combat.id && given.round == combat.round : given.scene == getSceneEpoch();
  return sameRound ? 2 : 1;
}

/**
 * A consumable created on an actor from someone else's inventory - note who gave it, when the giver
 * has Take Mine. Called from the createItem hook with the item's source actor.
 */
export async function onItemGiven(item, fromActor) {
  if (!fromActor || !item?.parent || fromActor.uuid == item.parent.uuid || !has(fromActor, KIT.takeMine)) {
    return;
  }

  await item.setFlag('essence20', 'givenBy', { actorUuid: fromActor.uuid, ...turnStamp(), scene: getSceneEpoch() });
}

async function healWith(actor, item, heal, pay) {
  const ally = game.user?.targets?.first?.()?.actor ?? actor;
  if (heal.cost && !(await pay(heal.cost))) {
    return null;
  }

  const amount = heal.amount * takeMineMultiplier(actor, item);
  const health = ally.system?.health;
  if (health) {
    await ally.update({ 'system.health.value': Math.min(health.max ?? health.value + amount, (health.value ?? 0) + amount) });
  }

  if (heal.spend == 'kit') {
    await item.setFlag('essence20', 'kitSpent', true);
  } else if (heal.spend == 'uses') {
    const left = (item.flags?.essence20?.usesLeft ?? heal.uses) - 1;
    await item.setFlag('essence20', 'usesLeft', left);
    if (left <= 0) {
      await item.setFlag('essence20', 'kitSpent', true);
    }
  } else {
    await useUp(item);
  }

  return T('E20.KitHealed', { name: actor.name, ally: ally.name, amount, kit: item.name });
}

async function useUp(item) {
  const left = (item.system?.quantity ?? 1) - 1;
  if (left > 0) {
    await item.update({ 'system.quantity': left });
  } else {
    await item.delete();
  }
}

/* -------------------------------------------- */
/*  Perks and gear with a Use button             */
/* -------------------------------------------- */

const FREE_DRIVING_KIT = { crashSurvivor: 'Air', hearty: 'Sea', takeTheWheel: 'Land' };

export const KIT_HANDLERS = {
  async kit(actor, item, pay) {
    return useKit(actor, item, pay);
  },

  // Crash Survivor / Hearty / Take the Wheel (Cobra Codex p.70-77): "at the beginning of every mission,
  // you gain a free Limited Driving (Air [Sea, Land]) Kit that you can use even if you don't meet the
  // prerequisites." A fresh one replaces last mission's.
  async crashSurvivor(actor, item) {
    return freeDrivingKit(actor, item, FREE_DRIVING_KIT.crashSurvivor);
  },
  async hearty(actor, item) {
    return freeDrivingKit(actor, item, FREE_DRIVING_KIT.hearty);
  },
  async takeTheWheel(actor, item) {
    return freeDrivingKit(actor, item, FREE_DRIVING_KIT.takeTheWheel);
  },

  // False Face (Quartermaster's Guide, Spy, p.19): "you gain a free Standard Disguise Kit, which you
  // can only use for yourself. Every odd-numbered level, you gain an additional Standard Disguise Kit
  // ... At 3rd level, you can substitute a Limited Disguise Kit for two Standard Disguise Kits. At 6th
  // level, you can substitute a Restricted Disguise Kit for two Limited Disguise Kits."
  async falseFace(actor, item) {
    const level = Number(actor.system?.level) || 1;
    let points = Math.ceil(level / 2);
    const old = itemsOf(actor).filter(i => i.flags?.essence20?.grantedBy == item.id);
    if (old.length) {
      await actor.deleteEmbeddedDocuments('Item', old.map(i => i.id));
    }

    const made = [];
    while (points > 0) {
      const options = [['standard', T('E20.KitStandard')]];
      if (level >= 3 && points >= 2) options.push(['limited', T('E20.KitLimited')]);
      if (level >= 6 && points >= 4) options.push(['restricted', T('E20.KitRestricted')]);
      const tier = options.length == 1 ? 'standard' : await choose(item.name, T('E20.FalseFacePrompt', { points }), options);
      if (!tier) {
        break;
      }

      points -= { standard: 1, limited: 2, restricted: 4 }[tier];
      made.push(await makeKit(actor, item, tier, 'deception', 'Disguise'));
    }

    return made.length ? T('E20.KitsGranted', { name: actor.name, count: made.length, item: item.name }) : null;
  },

  // Kitted Out (Cobra Codex, Saboteur, 17th level, p.51): "You gain a restricted Technology kit as
  // Qualified gear. The kit is of a Technology Specialization of your choice when you gain it."
  async kittedOut(actor, item) {
    if (itemsOf(actor).some(i => i.flags?.essence20?.grantedBy == item.id)) {
      ui.notifications.info(T('E20.KitAlreadyGranted'));
      return null;
    }

    const picked = await pickSpecialization(item.name, 'technology');
    if (!picked) {
      return null;
    }

    const kit = await makeKit(actor, item, 'restricted', 'technology', picked.spec);
    return kit ? T('E20.KitsGranted', { name: actor.name, count: 1, item: item.name }) : null;
  },

  // Utility / Efficacy Adjustment and Kitted Purpose: choose the kit, and (for the Alterations) spend it.
  async utilityAdjustment(actor, item, pay) {
    return virtualKit(actor, item, 'standard', pay);
  },
  async efficacyAdjustment(actor, item, pay) {
    return virtualKit(actor, item, 'limited', pay);
  },
  async kittedPurpose(actor, item) {
    const current = item.flags?.essence20?.virtualKit;
    if (!current) {
      const picked = await pickSpecialization(item.name);
      if (!picked) {
        return null;
      }

      await item.setFlag('essence20', 'virtualKit', { tier: 'limited', skill: picked.skill, spec: picked.spec, docked: true });
      return T('E20.KittedPurposeSet', { name: actor.name, spec: picked.spec ?? T(CONFIG.E20.skills?.[picked.skill] ?? picked.skill) });
    }

    await item.setFlag('essence20', 'virtualKit', { ...current, docked: !current.docked });
    return T(current.docked ? 'E20.KittedPurposeUndocked' : 'E20.KittedPurposeDocked', { name: actor.name });
  },

  // Med Kit (PR CRB p.120): "The kit has ten uses before its supplies must be replenished. As an action,
  // you may expend one use of the kit heal 1 Damage, without needing to make a Science (Medicine)
  // check. Users with Science (Medicine) may use the kit to heal 2 Damage."
  async medKit(actor, item, pay) {
    const medic = !!Object.values(actor.system?.skills?.science?.specializations ?? {}).some(s => /medicine/i.test(s?.name ?? ''));
    if (item.flags?.essence20?.kitSpent) {
      await item.update({ 'flags.essence20.kitSpent': false, 'flags.essence20.usesLeft': 10 });
      return T('E20.MedKitRestocked', { name: actor.name });
    }

    return healWith(actor, item, { amount: medic ? 2 : 1, cost: 'standard', spend: 'uses', uses: 10 }, pay);
  },

  // Automated Repair Kit (Beacon of Hope / Danger at Dinobot Island): "As a Standard Action, a
  // Cybertronian can open the Automated Repair Kit, and the machinery inside immediately heals 2 Health
  // without a Skill Test." It's consumed.
  async automatedRepairKit(actor, item, pay) {
    return healWith(actor, item, { amount: 2, cost: 'standard', spend: 'quantity' }, pay);
  },

  // Imaginary Corn (WTNV Citizen's Guide p.72): "↑1 on all Strength-based Skill Tests for one hour after
  // being consumed."
  async imaginaryCorn(actor, item) {
    await addBoost(actor, { essence: 'strength', skill: null, mode: 'shiftUp', kind: 'scene', label: item.name, times: takeMineMultiplier(actor, item) });
    await useUp(item);
    return T('E20.ImaginaryCornEaten', { name: actor.name });
  },

  // Wrist Communicator (PR CRB p.120): three teleport charges, recharged over eight hours (a rest).
  async wristCommunicator(actor, item) {
    const used = item.flags?.essence20?.chargesUsed ?? 0;
    if (used >= 3) {
      ui.notifications.warn(T('E20.WristCommunicatorEmpty'));
      return null;
    }

    const { pickCanvasPoint, placeActorAt } = await import("./forced-movement.mjs");
    const point = await pickCanvasPoint(T('E20.WristCommunicatorPick'));
    if (!point) {
      return null;
    }

    const token = actor.getActiveTokens?.()?.[0];
    if (token) {
      await token.document.update({ x: Math.round(point.x - token.w / 2), y: Math.round(point.y - token.h / 2) }, { animate: false });
    } else {
      await placeActorAt(actor, point);
    }

    await item.setFlag('essence20', 'chargesUsed', used + 1);
    return T('E20.WristCommunicatorUsed', { name: actor.name, left: 2 - used });
  },

  // Personnel Munitions Pack (Enigma of Combination p.56): "all friendly characters within their Reach
  // of its location may reload a weapon as a Free action. Roll 1d20 each time this kit is used; on a 1,
  // this kit is consumed."
  async personnelMunitionsPack(actor, item, pay) {
    const ally = game.user?.targets?.first?.()?.actor ?? actor;
    const { clearWeaponReload, weaponNeedsReload } = await import("./reload.mjs");
    const weapons = itemsOf(ally).filter(i => i.type == 'weapon' && weaponNeedsReload(i));
    const weaponId = await chooseSelect(item.name, T('E20.MunitionsPackPick', { name: ally.name }), weapons.map(w => ({ value: w.id, label: w.name })));
    const weapon = ally.items.get(weaponId);
    if (!weapon || !(await pay('free'))) {
      return null;
    }

    const { needsGmRelay, relayToGm } = await import("./gm-relay.mjs");
    if (needsGmRelay(weapon)) {
      await relayToGm(weapon, 'unsetFlag', ['essence20', 'needsReload']);
    } else {
      await clearWeaponReload(weapon);
    }

    const roll = await new Roll('1d20').evaluate();
    if (roll.total == 1) {
      await useUp(item);
      return T('E20.MunitionsPackEmptied', { name: ally.name, weapon: weapon.name });
    }

    return T('E20.MunitionsPackReloaded', { name: ally.name, weapon: weapon.name, roll: roll.total });
  },

  // Protomatter Injection Layer (Enigma of Combination p.55): "This upgrade can be replenished with an
  // hour of repairs, a successful DIF 12 Technology Skill Test, and the expenditure of 2 Energon Points."
  async protomatterInjectionLayer(actor, item) {
    const energon = Number(actor.system?.energon?.normal?.value) || 0;
    if (energon < 2) {
      ui.notifications.warn(T('E20.ProtomatterNoEnergon'));
      return null;
    }

    const { success } = await rollTest(actor, 'technology', 12);
    if (!success) {
      return T('E20.ProtomatterFailed', { name: actor.name });
    }

    await actor.update({ 'system.energon.normal.value': energon - 2 });
    await item.setFlag('essence20', 'protomatterUsed', 0);
    return T('E20.ProtomatterRefilled', { name: actor.name });
  },

  // Loader (TF CRB p.134): "Bot Mode: When you convert, you can choose to benefit from the same bonus you
  // have in Alt Mode, or you can choose to use the loader as a shield which adds +1 Deflection to
  // Toughness." Switches between the two.
  async loader(actor, item) {
    const shield = !item.flags?.essence20?.loaderShield;
    await item.setFlag('essence20', 'loaderShield', shield);
    return T(shield ? 'E20.LoaderShield' : 'E20.LoaderCarry', { name: actor.name });
  },
};

const USE_BY_SOURCE = Object.fromEntries(Object.keys(KIT_HANDLERS).filter(kind => KIT[kind]).map(kind => [KIT[kind], kind]));

/** Which of KIT_HANDLERS this item's Use button runs - its own, or 'kit' for any kit. */
export function kitUseKind(item) {
  return USE_BY_SOURCE[sourceOf(item)] ?? (kitInfo(item) ? 'kit' : null);
}

export function canUseKit(item) {
  const kind = kitUseKind(item);
  if (!kind || !item?.parent) {
    return false;
  }

  if (kind == 'wristCommunicator') {
    return (item.flags?.essence20?.chargesUsed ?? 0) < 3;
  }

  if (kind == 'kittedOut') {
    return !itemsOf(item.parent).some(i => i.flags?.essence20?.grantedBy == item.id);
  }

  // A My Little Pony kit has nothing to use up or set.
  if (kind == 'kit' && kitInfo(item)?.simple) {
    return false;
  }

  return true;
}

/**
 * The Use button.
 * @param {Item} item
 * @param {Object} economy   helpers/action-economy.mjs.
 * @returns {Promise<String|null>}   The chat line.
 */
export async function runKitUse(item, economy) {
  const kind = kitUseKind(item);
  const actor = item?.parent;
  if (!kind || !actor) {
    return null;
  }

  const { kitsBlockedFor } = await import("./extensions/gij2/reckless.mjs");
  if (kitsBlockedFor(actor)) {
    return null;
  }

  const pay = async (cost) => {
    if (!cost || !game.combat || !economy) {
      return true;
    }

    const paid = await economy.spend(actor, cost, { source: item.name });
    return !paid.blocked;
  };

  return KIT_HANDLERS[kind](actor, item, pay);
}

/* -------------------------------------------- */
/*  Roll Options Dialog                          */
/* -------------------------------------------- */

/** Whether the dialog asks what kit the test calls for: anyone carrying one, or with a kit's benefit. */
export function kitDialogFlags(actor) {
  return activeKits(actor).length ? { kitRequiredAvailable: true } : {};
}

/**
 * The "Kit required" choice, once the dialog closes: the best carried kit's Snag or ↓, and the
 * boosts this roll used up.
 * @param {Actor} actor
 * @param {Object} options   The dialog's result (mutated).
 * @param {Object} ctx   {skill, spec, consumes}
 */
export async function applyDialogKits(actor, options, { skill, spec = null, consumes = [] } = {}) {
  for (const id of consumes) {
    await removeBoost(actor, id);
  }

  const needed = options.kitRequired;
  if (!needed || needed == 'none') {
    return;
  }

  const result = kitRequirement(actor, skill, spec, needed);
  options.shiftDown = (options.shiftDown ?? 0) + result.shiftDown;
  if (result.snag) {
    // "Without the right kit, the Skill Test has a Snag" - an Edge and a Snag cancel out.
    if (options.edge) {
      options.edge = false;
    } else {
      options.snag = true;
    }
  }
}

/* -------------------------------------------- */
/*  Items arriving                               */
/* -------------------------------------------- */

/**
 * A consumable created on an actor: who handed it over. (What comes inside a kit - Night Vale's
 * Science Kit and Travel Reporter Kit - is the kit's own Grant rule.)
 * @param {Item} item
 */
export async function onKitCreated(item) {
  const actor = item?.parent;
  if (!actor || item.flags?.essence20?.grantedBy) {
    return;
  }

  // Take Mine - handed over from another actor's inventory.
  const from = item._stats?.duplicateSource;
  const giverUuid = typeof from == 'string' && from.startsWith('Actor.') ? from.split('.Item.')[0] : null;
  if (giverUuid) {
    await onItemGiven(item, fromUuidSync(giverUuid));
  }
}

async function freeDrivingKit(actor, item, medium) {
  const old = itemsOf(actor).filter(i => i.flags?.essence20?.grantedBy == item.id);
  if (old.length) {
    await actor.deleteEmbeddedDocuments('Item', old.map(i => i.id));
  }

  const kit = await makeKit(actor, item, 'limited', 'driving', medium, { ignorePrerequisite: true });
  return kit ? T('E20.KitsGranted', { name: actor.name, count: 1, item: item.name }) : null;
}

async function virtualKit(actor, item, tier, pay) {
  const current = item.flags?.essence20?.virtualKit;
  if (!current) {
    const picked = await pickSpecialization(item.name);
    if (!picked) {
      return null;
    }

    await item.setFlag('essence20', 'virtualKit', { tier, skill: picked.skill, spec: picked.spec });
    return T('E20.VirtualKitSet', { name: actor.name, item: item.name, spec: picked.spec ?? T(CONFIG.E20.skills?.[picked.skill] ?? picked.skill) });
  }

  if (current.spent) {
    ui.notifications.info(T('E20.VirtualKitSpent'));
    return null;
  }

  return consumeKit(actor, item, current, pay, { virtual: true });
}

/**
 * Make a kit item on the actor.
 */
export async function makeKit(actor, grantor, tier, skill, spec, flags = {}) {
  const label = T(CONFIG.E20.skills?.[skill] ?? skill);
  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
  const [kit] = await actor.createEmbeddedDocuments('Item', [{
    name: `${tierLabel} ${label}${spec ? ` (${spec})` : ''} Kit`, type: 'gear',
    system: { gearType: 'kits', quantity: 1 },
    flags: { essence20: { grantedBy: grantor?.id ?? null, kit: { tier, skill, spec: spec ?? null, essence: null }, ...flags } },
  }]);
  return kit ?? null;
}

/**
 * A rest brings back what "until you sleep for 6 hours" and "8h recharge" took.
 */
export async function restKits(actor) {
  for (const item of itemsOf(actor)) {
    const virtual = item.flags?.essence20?.virtualKit;
    if (virtual?.spent) {
      await item.setFlag('essence20', 'virtualKit', { ...virtual, spent: false });
    }

    if (item.flags?.essence20?.chargesUsed) {
      await item.setFlag('essence20', 'chargesUsed', 0);
    }
  }
}

/**
 * Protomatter Injection Layer: "The first three times ... you suffer 2 or more damage from a single
 * source, the damage is reduced by 1." Called by helpers/combat.mjs#applyDamage.
 * @param {Actor} actor
 * @param {Number} amount
 * @returns {Promise<Number>}
 */
export async function protomatterReduce(actor, amount) {
  if (amount < 2) {
    return amount;
  }

  const layer = itemsOf(actor).find(i => sourceOf(i) == KIT.protomatterInjectionLayer
    && (!i.flags?.essence20?.parentId || actor.items?.get?.(i.flags.essence20.parentId)?.system?.equipped !== false)
    && (i.flags?.essence20?.protomatterUsed ?? 0) < 3);
  if (!layer) {
    return amount;
  }

  await layer.setFlag('essence20', 'protomatterUsed', (layer.flags?.essence20?.protomatterUsed ?? 0) + 1);
  return amount - 1;
}

/**
 * Carrying capacity as a share of body weight (PR CRB Table 6-1: "Unskilled 10% ... D2 25% ... D4 50%
 * ... D6 75% ... D8 Equal to Body Weight ... D10 Half-Again (150%) ... D12 Double Body Weight").
 * Competitive Strength (A Jump Through Time, p.54): "Your Brawn is considered to be 2 Skill Ranks
 * higher for determining how much you can carry." Loader (TF CRB p.134, Alt Mode): "Your Brawn counts
 * as ↑2 when calculating your Carrying Capacity". Growth Boost (A Jump Through Time, p.33): "You
 * double the weight you can commonly carry" while Morphed.
 * @param {Actor} actor
 * @returns {Number}   A percentage of body weight.
 */
export function carryPercent(actor) {
  const ladder = ['d20', 'd2', 'd4', 'd6', 'd8', 'd10', 'd12'];
  const percent = [10, 25, 50, 75, 100, 150, 200];
  let rank = Math.max(0, ladder.indexOf(actor?.system?.skills?.brawn?.shift ?? 'd20'));
  if (has(actor, KIT.competitiveStrength)) {
    rank += 2;
  }

  // BrawnRequirement rules with carrying: true (Pack Mule - rules/ext/c/brawn.mjs).
  rank += ruleBrawnBonus(actor, 'carrying');

  const loader = itemsOf(actor).find(i => sourceOf(i) == KIT.loader);
  if (loader && (actor?.system?.isTransformed || !loader.flags?.essence20?.loaderShield)) {
    rank += 2;
  }

  let value = percent[Math.min(rank, percent.length - 1)] + Math.max(0, rank - (percent.length - 1)) * 50;
  if (has(actor, KIT.growthBoost) && actor?.system?.isMorphed) {
    value *= 2;
  }

  return value;
}

/**
 * Bomber (Cobra Codex, Saboteur, 6th level, p.51): "you can carry up to 6 explosives on you. This is
 * in addition to the normal limit of 6 hands of equipment." Medicine Cabinet (Poisoner, 6th level,
 * p.49): the same for "6 doses of poison". The hands those take that don't count.
 * @param {Actor} actor
 * @param {Array<{item: Item, hands: Number}>} carried
 * @returns {Number}
 */
export function extraCarriedHands(actor, carried) {
  let freed = 0;
  const effectStyle = weapon => itemsOf(actor).find(e => e.type == 'weaponEffect' && e.flags?.essence20?.parentId == weapon.id)?.system?.classification?.style;
  if (has(actor, KIT.bomber)) {
    freed += Math.min(6, carried.filter(c => effectStyle(c.item) == 'explosive' && !c.item.system?.isPoison)
      .reduce((sum, c) => sum + c.hands * Math.max(1, c.item.system?.quantity ?? 1), 0));
  }

  if (has(actor, KIT.medicineCabinet)) {
    freed += Math.min(6, carried.filter(c => c.item.system?.isPoison)
      .reduce((sum, c) => sum + c.hands * Math.max(1, c.item.system?.quantity ?? 1), 0));
  }

  return freed;
}

/**
 * Loader's Might ↑2 "to shove objects and creatures", and Competitive Strength's Brawn critical on the
 * d2, for dice.mjs.
 */
export function loaderShoveBonus(actor) {
  const loader = itemsOf(actor).find(i => sourceOf(i) == KIT.loader);
  return loader && (actor?.system?.isTransformed || !loader.flags?.essence20?.loaderShield) ? 2 : 0;
}

/** Loader used as a shield in Bot Mode: "+1 Deflection to Toughness". */
export function loaderShieldToughness(actor) {
  const loader = itemsOf(actor).find(i => sourceOf(i) == KIT.loader);
  return loader && !actor?.system?.isTransformed && loader.flags?.essence20?.loaderShield ? 1 : 0;
}
