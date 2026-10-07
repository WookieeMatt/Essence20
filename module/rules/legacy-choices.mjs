import { rulesOf } from "./index.mjs";
import { legacyChoiceOf } from "./choice-read.mjs";

/**
 * Picks that items stored their own way before they became ChoiceSet rules, moved into the rules'
 * choices (flags.essence20.rules.choices) so a character who already owns one keeps what they picked.
 * Run by the GM's linking pass (rules/inherit.mjs#linkExistingCopies); a choice already made is
 * never overwritten, so running it again does nothing.
 *
 * Two ways in: the hand-written LEGACY readers below (old picks that need reshaping), and `legacy` on
 * a ChoiceSet rule or a `pick` step - the path its old pick was kept at, read as-is: "flags.essence20.
 * pr1DinoGem" on the item, or "actor.flags.essence20.x" on its actor.
 */

const ESSENCE_ORDER = ['strength', 'speed', 'smarts', 'social'];

/** The TF CRB Influence Perks' old pick: system.choice "skill::name". */
function chosenSpecialization(item, withSkill = false) {
  const [skill, spec] = String(legacyChoiceOf(item) ?? '').split('::');
  if (!spec) {
    return null;
  }

  return withSkill ? { skill, spec } : { spec };
}

/** By compendium id: how to read the old pick into {choiceKey: value}. */
const LEGACY = {
  // Mastery Power: flags.essence20.mastery {tier, circle}
  DyIbIDlzOJX5GiO2: (item) => {
    const old = item.flags?.essence20?.mastery;
    return old ? { tier: old.tier, circle: old.circle } : null;
  },
  // Spell Focus: flags.essence20.spellFocus [owned spell id] -> that spell's name
  xNXlgRyE6Jpc4lnm: (item, actor) => {
    const id = item.flags?.essence20?.spellFocus?.[0];
    const spell = id ? actor?.items?.get?.(id) : null;
    return spell ? { spell: spell.name } : null;
  },
  // Traveler: flags.essence20.place
  goE0NFHWUPhxjaq1: (item) => (item.flags?.essence20?.place ? { place: item.flags.essence20.place } : null),
  // Means To An End: flags.essence20.gij3MeansSkills, one Skill per Essence in Essence order
  llLxndbUKCtKIUMW: (item) => {
    const skills = item.flags?.essence20?.gij3MeansSkills;
    return Array.isArray(skills) && skills.length ? Object.fromEntries(ESSENCE_ORDER.map((key, i) => [key, skills[i]]).filter(([, v]) => v)) : null;
  },
  // Cover Job: flags.essence20.gij1Choice {skill, text}
  '3SiGvDR98s0FQtdf': (item) => {
    const old = item.flags?.essence20?.gij1Choice;
    return old ? { skill: old.skill, profession: old.text } : null;
  },
  // Double Life: flags.essence20.gij1Choice {skill, text}
  Bl14FV81J88Um0Ls: (item) => {
    const old = item.flags?.essence20?.gij1Choice;
    return old ? { skill: old.skill, spec: old.text } : null;
  },
  // TF CRB Influence Perks: system.choice "skill::name" - Former Senator also picks the Skill.
  gcqyJw1sXxi2wy8e: (item) => chosenSpecialization(item, true),
  tDge4xSE9urfxwHP: (item) => chosenSpecialization(item),
  '5Z0xtNOeSCD2YoRc': (item) => chosenSpecialization(item),
  KjcoQiDoT7WEVsZX: (item) => chosenSpecialization(item),
  '95RyaWIi0HQOlyJN': (item) => chosenSpecialization(item),
  // Obsessive: flags.essence20.obsession (the Skill)
  eOgtG24LKGR6OE0v: (item) => (item.flags?.essence20?.obsession ? { obsession: item.flags.essence20.obsession } : null),
};

/** The old pick at a `legacy` path ("actor." reads the item's actor), or null. */
export function legacyValue(path, item, actor = item?.parent) {
  if (!path || typeof path != 'string') {
    return null;
  }

  const [doc, rest] = path.startsWith('actor.') ? [actor, path.slice(6)] : [item, path];
  // The old Perk picker's system.choice also reads the 6.1 safety-net flag (rules/choice-read.mjs#legacyChoiceOf).
  const value = doc === item && rest == 'system.choice' ? legacyChoiceOf(item) : rest.split('.').reduce((at, part) => (at === null || at === undefined ? at : at[part]), doc);
  return value === undefined || value === '' ? null : value;
}

/** Every {key: legacy path} an item's rules declare: ChoiceSet rules and pick steps (nested too). */
export function legacyPaths(item) {
  const paths = {};
  const visit = steps => {
    for (const step of Array.isArray(steps) ? steps : []) {
      // pick, and any recording step (pickGrant / pickEntry / pickActorItem with record) - its key is where it keeps the pick.
      if ((step?.do == 'pick' || step?.record === true) && step.key && step.legacy) {
        paths[step.key] ??= step.legacy;
      }

      for (const nested of [step?.steps, step?.onSuccess, step?.onFail, step?.onCrit, ...(Array.isArray(step?.options) ? step.options.map(o => o?.steps) : [])]) {
        visit(nested);
      }
    }
  };

  for (const rule of rulesOf(item)) {
    if (rule?.type == 'ChoiceSet' && rule.key && rule.legacy) {
      paths[rule.key] ??= rule.legacy;
    }

    visit(rule?.steps);
  }

  return paths;
}

/** Every {toggleKey: legacy path} an item's Toggle rules declare. */
export function legacyTogglePaths(item) {
  return Object.fromEntries(rulesOf(item).filter(rule => rule?.type == 'Toggle' && rule.key && rule.legacy).map(rule => [rule.key, rule.legacy]));
}

function sourceId(item) {
  const uuid = item?.flags?.essence20?.rulesSource ?? item?._stats?.compendiumSource ?? item?.flags?.core?.sourceId ?? '';
  return String(uuid).split('.').pop();
}

/**
 * Item updates moving old picks into rule choices, for one actor.
 * @param {Actor} actor
 * @returns {Array<Object>} [{_id, 'flags.essence20.rules.choices.<key>': value}]
 */
export function legacyChoiceUpdates(actor) {
  const updates = [];
  for (const item of actor?.items ?? []) {
    const read = LEGACY[sourceId(item)];
    const picks = { ...(read?.(item, actor) ?? {}) };
    for (const [key, path] of Object.entries(legacyPaths(item))) {
      picks[key] ??= legacyValue(path, item, actor);
    }

    const have = item.flags?.essence20?.rules?.choices ?? {};
    const update = {};
    for (const [key, value] of Object.entries(picks)) {
      if (value !== undefined && value !== null && value !== '' && (have[key] === undefined || have[key] === null || have[key] === '')) {
        update[`flags.essence20.rules.choices.${key}`] = value;
      }
    }

    // Toggle rules' old on/off flags into rules.toggles, never over a state already set.
    const toggles = item.flags?.essence20?.rules?.toggles ?? {};
    for (const [key, path] of Object.entries(legacyTogglePaths(item))) {
      const value = legacyValue(path, item, actor);
      if (value !== null && toggles[key] === undefined) {
        update[`flags.essence20.rules.toggles.${key}`] = !!value;
      }
    }

    if (Object.keys(update).length) {
      updates.push({ _id: item.id, ...update });
    }
  }

  return updates;
}
