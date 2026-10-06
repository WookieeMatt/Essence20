import { companionsOf } from "../companions/companion-link.mjs";
import { getSceneEpoch } from "./scene-clock.mjs";
import { ruleBrawnBonus } from "../../rules/plugins/effects/brawn-requirement.mjs";
import { ruleWaivesAllKitPrerequisites } from "../../rules/plugins/resources/kit-prerequisite.mjs";
import { ruleCarryExemption, ruleKitModifier, ruleScroungeOffset } from "../../rules/plugins/resources/kit-rules.mjs";
import { ruleKitOptions, ruleKitSkill, runKitOption } from "../../rules/plugins/resources/kit-options.mjs";
import { ruleKitUses } from "../../rules/plugins/resources/kit-uses.mjs";
import { ruleCarryMultiplier } from "../../rules/plugins/combat/subsystem-readers.mjs";

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
  efficacyAdjustment: uuid('cobra_codex', '8pao5WMYv8zZNiw6'),
  utilityAdjustment: uuid('cobra_codex', 'sVFK8wa26RXzq8rC'),
  medKit: uuid('pr_crb', 'UgggFXZqiyKxwMuA'),
  wristCommunicator: uuid('pr_crb', 'W7nXP8pOQaDJmZbT'),
  kittedPurpose: uuid('tf_crb', 'YO5STToLRPYVnWBT'),
  personnelMunitionsPack: uuid('enigma_of_combination', 'CXenUI5l8c3WZNSw'),
  automatedRepairKit: uuid('transformers_adventures', '2P2i605rHgNhm2FJ'),
  takeMine: uuid('mlp_crb', '7CrDN77ITR9IV2nB'),
};

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

  // A KitSkill rule names the kit's Skill and Specialization (Night Vale's Medicine, Science and Travel Reporter kits,
  // Citizen's Guide p.70-71 - rules/plugins/resources/kit-options.mjs).
  const named = ruleKitSkill(item);
  if (named) {
    [skill, spec] = [named.skill, named.spec];
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
  // Kitbasher's KitPrerequisite {mode: waive, all: true} rule waives every prerequisite, a Skill Kit's too.
  if (info.simple || info.ignorePrerequisite || !info.skill || ruleWaivesAllKitPrerequisites(actor, info)) {
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
 * (mechanics/companions/companions.mjs), the Use toggle otherwise.
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

/** A used-up kit's lasting bonus on the actor - also the rules' kitBoost step (rules/plugins/resources/uses-kit-pieces.mjs). */
export async function addKitBoost(actor, boost) {
  return addBoost(actor, boost);
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
  // '' is a real choice ("Any Specialization"), not a cancel: only a closed / cancelled dialog answers null.
  }).then(result => (result === null || result === undefined || result == 'cancel' ? null : result));
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
  // KitModifier rules (Handy Scrounger's -5 - rules/plugins/resources/kit-rules.mjs).
  return Math.max(0, base + ruleScroungeOffset(actor));
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
  if (!info.essence && !info.skillKit && TIER_RANK.indexOf(tier) < 2 && ruleKitModifier(actor, 'upgradeRoll')
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
  if (ruleKitModifier(actor, 'keepRoll') && (await rollTest(actor, info.skill ?? 'survival', scroungeDif(actor, info.tier))).success) {
    return T('E20.KitUsedKept', { name: actor.name, kit: label });
  }

  // KitUses rules: more uses before the kit is spent (Reinforced Basics: Standard Kits three - rules/plugins/resources/kit-uses.mjs).
  const uses = (item.flags?.essence20?.kitUses ?? 0) + 1;
  const allowed = ruleKitUses(actor, info.tier);
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

  // Setting a kit's Specialization: a generic kit (no Specialization yet, or a Skill Kit with no Skill) is set up
  // this way by anyone; changing one that's already set is Kitted Out's (Cobra Codex p.51), for its holder only.
  const needsSetup = info.skillKit ? !info.skill : !info.spec;
  if (!info.essence && (needsSetup || ruleKitModifier(actor, 'respecialize'))) {
    choices.push(['specialize', T('E20.KitSetSpecialization')]);
  }

  // The kit's own KitOption rules (WTNV Medicine Kit's heal - rules/plugins/resources/kit-options.mjs), offered first.
  const options = ruleKitOptions(actor, item);
  choices.unshift(...options.map(option => [option.key, option.label]));

  if (!choices.length) {
    return null;
  }

  const what = choices.length == 1 ? choices[0][0] : await choose(item.name, T('E20.KitPrompt'), choices);
  if (what == 'consume') {
    return consumeKit(actor, item, info, pay);
  }

  const option = options.find(entry => entry.key == what);
  if (option) {
    return runKitOption(actor, item, option.rule, pay);
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

/* -------------------------------------------- */
/*  Perks and gear with a Use button             */
/* -------------------------------------------- */

export const KIT_HANDLERS = {
  async kit(actor, item, pay) {
    return useKit(actor, item, pay);
  },

  // (Crash Survivor and Hearty are Use rules on their Perks; so is Take the Wheel's free Limited Driving (Land) Kit.)

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

  // (Wrist Communicator is a Use rule on the item - pickPoint + moveTo, its chargesUsed count; restKits resets it.)

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

  // A My Little Pony kit has nothing to use up or set.
  if (kind == 'kit' && kitInfo(item)?.simple) {
    return false;
  }

  return true;
}

/**
 * The Use button.
 * @param {Item} item
 * @param {Object} economy   mechanics/actions/action-economy.mjs.
 * @returns {Promise<String|null>}   The chat line.
 */
export async function runKitUse(item, economy) {
  const kind = kitUseKind(item);
  const actor = item?.parent;
  if (!kind || !actor) {
    return null;
  }

  // Veto {on: kitUse} rules (rules/plugins/effects/veto.mjs) - Reckless Abandon's "no kits".
  const { kitUseVetoed } = await import("../../rules/plugins/effects/veto.mjs");
  if (kitUseVetoed(actor, item)) {
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
 * Carrying capacity as a share of body weight (PR CRB Table 6-1: "Unskilled 10% ... D2 25% ... D4 50%
 * ... D6 75% ... D8 Equal to Body Weight ... D10 Half-Again (150%) ... D12 Double Body Weight").
 * (Competitive Strength's +2 Ranks and Loader's Alt Mode ↑2 are BrawnRequirement carryingOnly rules; Growth Boost's doubling
 * while Morphed is a CarryCapacity rule.)
 * @param {Actor} actor
 * @returns {Number}   A percentage of body weight.
 */
export function carryPercent(actor) {
  const ladder = ['d20', 'd2', 'd4', 'd6', 'd8', 'd10', 'd12'];
  const percent = [10, 25, 50, 75, 100, 150, 200];
  let rank = Math.max(0, ladder.indexOf(actor?.system?.skills?.brawn?.shift ?? 'd20'));
  // BrawnRequirement rules with carrying / carryingOnly (Pack Mule, Loader, Competitive Strength - rules/plugins/effects/brawn-requirement.mjs).
  rank += ruleBrawnBonus(actor, 'carrying');

  let value = percent[Math.min(rank, percent.length - 1)] + Math.max(0, rank - (percent.length - 1)) * 50;
  // CarryCapacity rules multiply it (Growth Boost x2 while Morphed - rules/plugins/combat/subsystem-readers.mjs).
  return value * ruleCarryMultiplier(actor);
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
  // CarryExemption rules (Bomber, Medicine Cabinet - rules/plugins/resources/kit-rules.mjs).
  return ruleCarryExemption(actor, carried);
}
