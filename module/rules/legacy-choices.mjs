/**
 * Picks that items stored their own way before they became ChoiceSet rules, moved into the rules'
 * choices (flags.essence20.rules.choices) so a character who already owns one keeps what they picked.
 * Run by the GM's linking pass (rules/inherit.mjs#linkExistingCopies); a choice already made is
 * never overwritten, so running it again does nothing.
 */

const ESSENCE_ORDER = ['strength', 'speed', 'smarts', 'social'];

/** The TF CRB Influence Perks' old pick: system.choice "skill::name". */
function chosenSpecialization(item, withSkill = false) {
  const [skill, spec] = String(item.system?.choice ?? '').split('::');
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
    const picks = read?.(item, actor);
    if (!picks) {
      continue;
    }

    const have = item.flags?.essence20?.rules?.choices ?? {};
    const update = {};
    for (const [key, value] of Object.entries(picks)) {
      if (value !== undefined && value !== null && value !== '' && (have[key] === undefined || have[key] === null || have[key] === '')) {
        update[`flags.essence20.rules.choices.${key}`] = value;
      }
    }

    if (Object.keys(update).length) {
      updates.push({ _id: item.id, ...update });
    }
  }

  return updates;
}
