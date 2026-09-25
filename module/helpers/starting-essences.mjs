/**
 * The Essence points a player character spends at creation, before the Origin (+1) and the Role
 * (+3) add theirs. The same in every line's core rulebook: 12 points over the four Essences.
 *
 *   Transformers CRB p.24 - "12 Essence Points ... at least 1 point in each Essence Score ...
 *                            can't increase an Essence Score above 15"
 *   GI Joe CRB p.37, Power Rangers CRB p.19, My Little Pony CRB p.24 - 12 points, no limits
 *                            printed (MLP: "generally ranges between 1-10"); Transformers' are
 *                            used, as the only ones any of these books states
 *   Welcome to Night Vale Citizen's Guide p.10 - every Essence starts at 1 with 9 points to add,
 *                            the same 12 in total, and "no one Essence Score can be greater than 8"
 *
 * Kept as the actor's own `system.essenceBase`, apart from what the Origin, Role and levels add
 * straight onto `system.essences.<e>.max`. That is what lets a player re-spread their points
 * later without disturbing any of those: only the difference in the base is applied.
 */

export const ESSENCES = ['strength', 'speed', 'smarts', 'social'];

/** Points to spend at creation. */
export const STARTING_ESSENCE_POINTS = 12;

/** The least any one Essence can hold. */
export const MIN_ESSENCE = 1;

/** The most any one Essence can hold at creation, in most lines (Transformers CRB p.24). */
export const MAX_ESSENCE = 15;

/** Welcome to Night Vale's own, tighter cap (Citizen's Guide p.10). */
export const MAX_ESSENCE_NIGHT_VALE = 8;

/** What every character had before this existed, and so what an existing one is taken to have spent. */
export const DEFAULT_BASE = Object.freeze({ strength: 3, speed: 3, smarts: 3, social: 3 });

/**
 * The creation cap for this character. The world's Game Line decides it; a world playing every
 * line falls back to the character's own Role, when it has one yet - at this step it usually
 * does not, which is why the Role is only the fallback.
 * @param {String} gameLine   The "gameLine" world setting ("" for all lines).
 * @param {?String} roleVersion   The character's Role's system.version, if any.
 * @returns {Number}
 */
export function maxEssenceFor(gameLine, roleVersion = null) {
  const line = gameLine || roleVersion;
  return line === 'welcomeToNightVale' ? MAX_ESSENCE_NIGHT_VALE : MAX_ESSENCE;
}

/**
 * How a spread stands against the rules.
 * @param {Object<String, Number>} base   Points per Essence.
 * @param {Number} max   From maxEssenceFor().
 * @returns {{spent: Number, remaining: Number, tooLow: String[], tooHigh: String[], isValid: Boolean}}
 */
export function checkStartingEssences(base, max) {
  const spent = ESSENCES.reduce((sum, essence) => sum + (Number(base[essence]) || 0), 0);
  const tooLow = ESSENCES.filter(essence => (Number(base[essence]) || 0) < MIN_ESSENCE);
  const tooHigh = ESSENCES.filter(essence => (Number(base[essence]) || 0) > max);
  return {
    spent,
    remaining: STARTING_ESSENCE_POINTS - spent,
    tooLow,
    tooHigh,
    isValid: spent === STARTING_ESSENCE_POINTS && !tooLow.length && !tooHigh.length,
  };
}

/**
 * The book's suggested spread (Power Rangers CRB p.19: "4, 3, 3, and 2 ... in the order you
 * choose"), with the 4 and the 2 on the Essences the player picks.
 * @param {String} high   The Essence that gets 4.
 * @param {String} low    The Essence that gets 2 (must differ from `high`).
 * @returns {Object<String, Number>}
 */
export function recommendedSpread(high, low) {
  const spread = { strength: 3, speed: 3, smarts: 3, social: 3 };
  if (ESSENCES.includes(high) && ESSENCES.includes(low) && high !== low) {
    spread[high] = 4;
    spread[low] = 2;
  }

  return spread;
}

/**
 * Whether a Role has added anything on top of the starting spread yet. Its increases depend on
 * level and on the player's own picks (MLP/Transformers progressions), so once one is on the
 * character the saved spread is the only reliable record of what was spent at creation.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function hasRole(actor) {
  return !!actor.items?.some?.(item => item.type === 'role');
}

/**
 * The actor's current starting spread.
 *
 * With no Role, nothing but an Origin has added to the Essences - and an Origin records which
 * Essence it raised (system.originEssencesIncrease, background-handler.mjs) - so the spread is
 * read straight off them. That is the truth even for a character whose saved spread says
 * otherwise: one from before this existed is only ASSUMED to have 3 in each, and a character
 * whose Role was dropped and removed may have had points taken away since (the old Role-delete
 * bug), which only reading the Essences themselves shows.
 *
 * With a Role, the saved spread - or the old 3-each default for a character from before this
 * existed.
 * @param {Actor} actor
 * @returns {Object<String, Number>}
 */
export function currentBase(actor) {
  if (!hasRole(actor)) {
    const essences = actor._source?.system?.essences ?? actor.system?.essences ?? {};
    const hasOrigin = actor.items?.some?.(item => item.type === 'origin');
    const originEssence = hasOrigin ? actor.system?.originEssencesIncrease : null;
    return Object.fromEntries(ESSENCES.map(essence => [
      essence,
      (essences[essence]?.max ?? DEFAULT_BASE[essence]) - (essence === originEssence ? 1 : 0),
    ]));
  }

  const saved = actor.system?.essenceBase ?? {};
  return Object.fromEntries(ESSENCES.map(essence => [essence, saved[essence] ?? DEFAULT_BASE[essence]]));
}

/**
 * Whether the sheet should ask for the starting spread: never assigned, or - on a character with
 * no Role yet, whose spread is read off its Essences - not a legal one.
 * @param {Actor} actor
 * @param {Number} max   From maxEssenceFor().
 * @returns {Boolean}
 */
export function needsStartingEssences(actor, max) {
  if (!actor.system?.essencesAssigned) return true;
  return !hasRole(actor) && !checkStartingEssences(currentBase(actor), max).isValid;
}

/**
 * The update that moves a character from its current starting spread to `base`. Each Essence's
 * max and value move by the same difference, so whatever the Origin, Role and levels have added
 * on top stays exactly where it was.
 * @param {Actor} actor
 * @param {Object<String, Number>} base   The new spread.
 * @returns {Object} Flat dotted-key update data.
 */
export function startingEssencesUpdate(actor, base) {
  const previous = currentBase(actor);
  const update = { 'system.essencesAssigned': true };
  for (const essence of ESSENCES) {
    const delta = base[essence] - previous[essence];
    update[`system.essenceBase.${essence}`] = base[essence];
    if (delta) {
      const current = actor.system.essences[essence];
      update[`system.essences.${essence}.max`] = current.max + delta;
      update[`system.essences.${essence}.value`] = current.value + delta;
    }
  }

  return update;
}

/**
 * The Essences whose skills would cost more than the Essence could pay for after this change -
 * each point of an Essence is also a skill point in it (see helpers/skill-picker.mjs).
 * @param {Actor} actor
 * @param {Object<String, Number>} base   The new spread.
 * @param {Object<String, {value: Number}>} skillSpend   From computeEssenceSpend(actor).
 * @returns {String[]}
 */
export function essencesOverspentBy(actor, base, skillSpend) {
  const previous = currentBase(actor);
  return ESSENCES.filter((essence) => {
    const newMax = actor.system.essences[essence].max + (base[essence] - previous[essence]);
    return (skillSpend?.[essence]?.value ?? 0) > newMax;
  });
}
