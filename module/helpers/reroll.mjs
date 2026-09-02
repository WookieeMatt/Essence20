import { E20 } from "./config.mjs";
import { hasStoryPointsAvailable, isGmConnected, requestStoryPointSpend } from "./story-points.mjs";

/**
 * Reroll grant engine - normalizes reroll configs read off Perks/ActiveEffects (schema defined in
 * module/data/reroll-schema.mjs), tracks per-source usage against each grant's reset window,
 * enforces its optional resource cost and precondition, and performs the actual dice reroll.
 *
 * The dice mechanic itself leans on Foundry's own `Die#reroll(modifier, {recursive})` wherever a
 * dice-notation modifier string can express what's needed ("r1", "r<=2", one call per value in an
 * arbitrary set) rather than reimplementing that bookkeeping by hand - only the fully
 * unconditional "reroll this whole die" case (mode "all" with no values, and the "single die of
 * the player's choice" target) has no modifier-string equivalent and is handled directly.
 *
 * See module/chat.mjs for the ChatMessage-facing button/dialog wiring that calls into this file.
 */

function normalizeRerollConfig(config) {
  if (!config) {
    return null;
  }

  const normalized = config.enabled !== undefined ? config : { enabled: true, ...config };
  if (normalized.enabled === false) {
    return null;
  }

  const values = Array.isArray(normalized.values)
    ? normalized.values.filter(value => Number.isFinite(Number(value))).map(value => Number(value))
    : typeof normalized.values === "string"
      ? normalized.values.split(",").map(value => Number(value.trim())).filter(value => Number.isFinite(value))
      : [];

  return {
    enabled: true,
    mode: normalized.mode ?? "all",
    target: normalized.target ?? "allDice",
    reset: normalized.reset ?? "none",
    maxUses: Number.isFinite(Number(normalized.maxUses)) ? Number(normalized.maxUses) : 1,
    values,
    cost: {
      resourcePath: normalized.cost?.resourcePath || "",
      amount: Number.isFinite(Number(normalized.cost?.amount)) ? Number(normalized.cost.amount) : 0,
      worldStoryPoints: Number.isFinite(Number(normalized.cost?.worldStoryPoints))
        ? Number(normalized.cost.worldStoryPoints) : 0,
      rolePointsName: normalized.cost?.rolePointsName || "",
    },
    condition: normalized.condition ?? "none",
    skills: Array.isArray(normalized.skills) ? normalized.skills.filter(Boolean) : [],
    essence: normalized.essence || "any",
    recursive: normalized.recursive !== false,
    minDieFaces: Number.isFinite(Number(normalized.minDieFaces)) ? Number(normalized.minDieFaces) : 0,
    grantsCanCritD2: normalized.grantsCanCritD2 === true,
  };
}

function getRerollResetBucket(reset) {
  if (reset === "scene") {
    return `scene:${game.scenes?.current?.id ?? "default"}`;
  }

  if (reset === "day") {
    return `day:${new Date().toISOString().slice(0, 10)}`;
  }

  if (reset === "combat") {
    // No active Combat encounter (game.combat is then null/undefined) shares one bucket rather
    // than being treated as unlimited - see E20.rerollResets's own doc comment.
    return `combat:${game.combat?.id ?? "none"}`;
  }

  // "mission" has no automatic boundary this codebase can detect (see E20.rerollResets in
  // helpers/config.mjs) - it shares the same manually-cleared bucket as "none" rather than
  // silently behaving like an unlimited-use reroll.
  return "manual";
}

async function trimExpiredRerollUsage(actor) {
  const usage = actor.getFlag("essence20", "rerollUsage") ?? {};
  const nextUsage = {};

  for (const [key, value] of Object.entries(usage)) {
    const separator = key.lastIndexOf("@");
    if (separator < 0) {
      continue;
    }

    const bucket = key.slice(separator + 1);
    const bucketType = bucket.split(":")[0];
    if (bucketType === "scene" && game.scenes?.current?.id && bucket !== `scene:${game.scenes.current.id}`) {
      continue;
    }

    if (bucketType === "day" && bucket !== `day:${new Date().toISOString().slice(0, 10)}`) {
      continue;
    }

    nextUsage[key] = value;
  }

  if (Object.keys(nextUsage).length !== Object.keys(usage).length) {
    await actor.setFlag("essence20", "rerollUsage", nextUsage);
  }
}

/**
 * Collect every reroll grant currently available to an actor, from both Perk items and
 * ActiveEffects using the shared reroll schema, plus the one legacy grant shape that predates that
 * schema: a Perk's own `advances.type === "rerolls"` leveling track (currently only "Power
 * Infusion", Power Rangers CRB p.41).
 * @param {Actor} actor
 * @returns {Array<Object>}
 */
export function getRerollConfigs(actor) {
  if (!actor) {
    return [];
  }

  const configs = [];

  for (const item of actor.items) {
    let config = normalizeRerollConfig(item.system?.reroll);
    if (!config && item.system?.advances?.type === "rerolls") {
      const currentValue = Number(item.system.advances.currentValue ?? item.system.advances.baseValue ?? 1);
      // Power Infusion's advances track ADDS a value at each level rather than replacing it -
      // 1st level is "reroll 1s" ([1]), 18th level is "...and 2s" ([1, 2]) - so this accumulates
      // 1..currentValue instead of taking currentValue as the sole matched value. Reset defaults
      // to "scene" (RAW: "once per scene") since an advances-driven grant has no reset field of
      // its own to read.
      const values = Number.isFinite(currentValue) && currentValue > 0
        ? Array.from({ length: currentValue }, (_, i) => i + 1)
        : [1];
      // An advances-driven Perk has no reroll.enabled toggle of its own (that's what routes it
      // here instead of the branch above), but it can still carry a cost/condition in its own
      // system.reroll block for exactly this purpose - see the Power Infusion source item
      // (packs/prcrbitems/_source/Power_Infusion_*.json) for the one real example.
      config = normalizeRerollConfig({
        enabled: true,
        mode: "all",
        target: "allDice",
        reset: "scene",
        maxUses: 1,
        values,
        cost: item.system.reroll?.cost,
        condition: item.system.reroll?.condition,
      });
    }

    if (config) {
      configs.push({ ...config, source: item.uuid ?? item.name ?? item.type, sourceType: "item" });
    }
  }

  for (const effect of actor.effects) {
    const config = normalizeRerollConfig(effect.system?.reroll);
    if (config) {
      configs.push({ ...config, source: effect.id ?? effect.name ?? "effect", sourceType: "effect" });
    }
  }

  return configs;
}

export async function canUseReroll(actor, config, sourceKey) {
  if (!actor || !config) {
    return false;
  }

  // maxUses of 0 means unlimited (e.g. MLP/PR CRB "Luck", "Adolescent Attitude" - no stated
  // frequency limit at all) - see reroll-schema.mjs's own doc comment on this field.
  if (config.maxUses <= 0) {
    return true;
  }

  await trimExpiredRerollUsage(actor);
  const usage = actor.getFlag("essence20", "rerollUsage") ?? {};
  const key = `${sourceKey}@${getRerollResetBucket(config.reset)}`;
  return Number(usage[key] ?? 0) < config.maxUses;
}

// Callers must have already confirmed canUseReroll() (and, once the reroll actually happens,
// should call this only after applyReroll() succeeds - see chat.mjs#rerollMessage) rather than
// this re-validating the limit itself, so a cancelled die-picker dialog never burns a use.
export async function consumeRerollUsage(actor, config, sourceKey) {
  // Unlimited-use grants have nothing to track - skip the write rather than growing a counter
  // that's never actually checked (canUseReroll short-circuits true for maxUses <= 0).
  if (config.maxUses <= 0) {
    return;
  }

  const usage = actor.getFlag("essence20", "rerollUsage") ?? {};
  const key = `${sourceKey}@${getRerollResetBucket(config.reset)}`;
  usage[key] = Number(usage[key] ?? 0) + 1;
  await actor.setFlag("essence20", "rerollUsage", usage);
}

// Resolves a reroll grant's cost.rolePointsName to the actor's own Item of that exact name - see
// rolePointsName's own doc comment on reroll-schema.mjs for why this is a separate cost path from
// resourcePath. Mirrors documents/actor.mjs#_getBaseRolePoints's own lookup shape (a name match
// over actor.items.documentsByType.rolePoints) rather than reaching for that private helper
// directly, since this needs an arbitrary name, not specifically the actor's "base" one.
function findRolePointsItem(actor, name) {
  return actor.items.documentsByType.rolePoints?.find(item => item.name === name) ?? null;
}

export function hasRerollCost(actor, config) {
  const { resourcePath, amount, worldStoryPoints, rolePointsName } = config.cost ?? {};
  if (worldStoryPoints > 0 && !(isGmConnected() && hasStoryPointsAvailable(worldStoryPoints))) {
    return false;
  }

  if (rolePointsName) {
    const rolePoints = findRolePointsItem(actor, rolePointsName);
    if (!rolePoints) {
      return false;
    }

    if (rolePoints.system.powerCost && actor.system.powers.personal.value < rolePoints.system.powerCost) {
      return false;
    }

    return actor.system.useUnlimitedResource || rolePoints.system.resource.value >= 1;
  }

  if (!resourcePath || amount <= 0) {
    return true;
  }

  const current = Number(foundry.utils.getProperty(actor, resourcePath));
  return Number.isFinite(current) && current >= amount;
}

export async function payRerollCost(actor, config) {
  const { resourcePath, amount, worldStoryPoints, rolePointsName } = config.cost ?? {};
  if (worldStoryPoints > 0) {
    requestStoryPointSpend(actor, worldStoryPoints);
  }

  if (rolePointsName) {
    const rolePoints = findRolePointsItem(actor, rolePointsName);
    if (!rolePoints) {
      return;
    }

    if (rolePoints.system.powerCost) {
      await actor.update({
        "system.powers.personal.value": actor.system.powers.personal.value - rolePoints.system.powerCost,
      });
    }

    if (!actor.system.useUnlimitedResource) {
      await rolePoints.update({ "system.resource.value": rolePoints.system.resource.value - 1 });
    }

    return;
  }

  if (!resourcePath || amount <= 0) {
    return;
  }

  const current = Number(foundry.utils.getProperty(actor, resourcePath)) || 0;
  await actor.update({ [resourcePath]: current - amount });
}

// A small, explicit set of named preconditions a reroll grant can require beyond simple
// usage-counting - matches E20.rerollConditions (helpers/config.mjs) and the "hardcoded
// Perk-specific check" idiom used throughout dice.mjs, rather than a generic expression
// evaluator this system has no other precedent for. Each check receives the acting actor plus
// the triggering roll's own context (see dice.mjs#rollSkill/combat.mjs#buildCheckChatData, which
// stash {skill, essence, snag, isPowerWeaponAttack, rollFailed} onto the chat message's own
// flags.essence20).
const REROLL_CONDITIONS = {
  none: () => true,
  // Power Rangers CRB p.41 "Power Infusion": "...while Morphed..."
  morphed: actor => !!actor.system?.isMorphed,
  // GI Joe/Transformers CRB "Veteran": "...as long as you aren't suffering a Snag."
  notSnagged: (actor, context) => !context?.snag,
  // PR CRB "Weapon Mastery": "...an attack you make with your Power Weapon..."
  powerWeapon: (actor, context) => !!context?.isPowerWeaponAttack,
  // MLP CRB "Cheer": "...to reroll a FAILED Performance Skill Test." rollFailed is only ever set
  // for a roll that was actually compared against a Difficulty (see dice.mjs's own doc comment
  // on the field) - a plain skill roll with nothing to fail against reads as unmet here, not as
  // an automatic pass.
  rollFailed: (actor, context) => !!context?.rollFailed,
};

export function canMeetRerollCondition(actor, config, context = {}) {
  const check = REROLL_CONDITIONS[config.condition] ?? REROLL_CONDITIONS.none;
  return check(actor, context);
}

/**
 * Checks a reroll grant's optional skill/Essence scope against the roll it would apply to (e.g.
 * PR CRB "Expertise" only rerolls one named skill; MLP/PR CRB "Adolescent Attitude" only rerolls
 * Social-Essence skills). A grant with neither set is unscoped and matches any roll, which is
 * also what a plain flat d20/initiative roll with no {skill, essence} context resolves to.
 * @param {Object} config
 * @param {Object} context   {skill, essence, snag} - see canMeetRerollCondition's own doc.
 * @returns {Boolean}
 */
export function canMeetRerollScope(config, context = {}) {
  if (config.skills?.length && !config.skills.includes(context.skill)) {
    return false;
  }

  if (config.essence && config.essence !== "any" && config.essence !== context.essence) {
    return false;
  }

  return true;
}

function getEligibleDice(roll, target) {
  if (target === "skillDice") {
    // E20.skillRollableShifts (helpers/config.mjs) tops out at d12 (plus the "2d8"/"3d6"
    // multi-die Specialization pools) - a skill die is never d20-faced, that face size is
    // reserved for the base roll term (including its Edge/Snag 2d20kh/2d20kl form).
    return roll.dice.filter(die => die.faces >= 2 && die.faces <= 12);
  }

  if (target === "d20") {
    return roll.dice.filter(die => die.faces === 20);
  }

  return roll.dice;
}

// Rerolls every currently-active result on a die unconditionally - the one case Die#reroll's
// modifier-string API can't express ("no filter at all"), and what a player-chosen single die
// target ultimately means regardless of mode.
async function rerollAllActive(die) {
  const initialLength = die.results.length;
  for (let i = 0; i < initialLength; i++) {
    const result = die.results[i];
    if (!result.active) {
      continue;
    }

    result.rerolled = true;
    result.active = false;
    await die.roll({ reroll: true });
  }
}

// Die#reroll's modifier grammar only expresses a single comparison per call, so an arbitrary
// value set (e.g. Power Infusion's accumulated [1, 2] at higher levels) is applied as one
// die.reroll() call per value, reusing Foundry's own tested reroll implementation rather than
// reimplementing its results-array bookkeeping by hand.
async function rerollDieForValues(die, values, { recursive = false } = {}) {
  for (const value of values) {
    await die.reroll(`r${value}`, { recursive });
  }
}

// Which currently-active die results a grant would actually touch, mirroring
// applyRerollToDie's own mode branching but as a plain predicate rather than a Die#reroll
// modifier string - used by hasEligibleRerollTarget to check whether there's anything for a
// reroll button to do before it's even shown, without needing to mutate any dice to find out.
function getRerollMatchPredicate(config) {
  if (config.mode === "ones") {
    return result => Number(result) === 1;
  }

  if (config.mode === "onesAndTwos") {
    return result => Number(result) <= 2;
  }

  if (config.values?.length) {
    const values = new Set(config.values.map(Number));
    return result => values.has(Number(result));
  }

  // mode 'all' with no values, or 'single'/anyDie - unconditional, matches anything.
  return () => true;
}

async function applyRerollToDie(die, config) {
  // Defaults to true (chase a rerolled result that still matches, e.g. Power Infusion's "reroll
  // 1s" rerolling a second natural 1 again) - false for the one-shot grants like PR CRB "Weapon
  // Mastery", which must keep even a still-bad new result. See reroll-schema.mjs's own doc.
  const recursive = config.recursive !== false;

  if (config.mode === "ones") {
    await die.reroll("r1", { recursive });
  } else if (config.mode === "onesAndTwos") {
    await die.reroll("r<=2", { recursive });
  } else if (config.values?.length) {
    await rerollDieForValues(die, config.values, { recursive });
  } else {
    await rerollAllActive(die);
  }
}

async function promptForDie(eligibleDice) {
  if (!eligibleDice.length) {
    return null;
  }

  if (eligibleDice.length === 1) {
    return eligibleDice[0];
  }

  const content = `
    <div class="form-group">
      <label>${game.i18n.localize("E20.RerollSelectDiePrompt")}</label>
      <select name="dieIndex">
        ${eligibleDice.map((die, index) => `<option value="${index}">Die ${index + 1} (d${die.faces})</option>`).join("")}
      </select>
    </div>
  `;

  const chosenValue = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize("E20.RerollSelectDieTitle") },
    classes: ["window-app"],
    content,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize("E20.RerollSelectDieChoose"),
        action: "choose",
        callback: (event, button) => button.form.elements.dieIndex.value,
      },
      { label: game.i18n.localize("E20.DialogCancelButton"), action: "cancel" },
    ],
  });

  if (chosenValue == null || chosenValue === "cancel") {
    return null;
  }

  const index = Number(chosenValue);
  return Number.isInteger(index) ? (eligibleDice[index] ?? null) : null;
}

/**
 * Whether a reroll grant would actually have anything to do against this roll - e.g. a "reroll
 * 1s" grant has nothing eligible on a roll that shows no 1s at all, and a skillDice-target grant
 * has nothing eligible on a roll with no skill dice in it. Read-only - doesn't touch the roll or
 * its dice, so it's safe to call just to decide whether to show a reroll button at all
 * (chat.mjs#addRerollButtons) before the player has committed to anything.
 * @param {Roll} roll   An already-evaluated Roll (e.g. message.rolls[0]).
 * @param {Object} config   A normalized reroll config, as produced by getRerollConfigs().
 * @returns {Boolean}
 */
export function hasEligibleRerollTarget(roll, config) {
  const target = config.target ?? "allDice";
  const minDieFaces = config.minDieFaces || 0;
  const eligibleDice = getEligibleDice(roll, target).filter(die => die.faces >= minDieFaces);
  if (!eligibleDice.length) {
    return false;
  }

  const matches = getRerollMatchPredicate(config);
  return eligibleDice.some(die => die.results.some(result => result.active && matches(result.result)));
}

/**
 * A specialization roll's dice pool (e.g. "{1d2,1d4,1d6,1d8}kh") wraps its dice one layer deeper
 * than a plain die: each pool member is its own little sub-Roll, and the PoolTerm itself caches
 * a snapshot of each member's total in its own `results` array - `PoolTerm#total` sums that
 * snapshot, not the live sub-Rolls, and the "keep highest/lowest" selection was already decided
 * once, during the pool's original evaluation. Rerolling one of those nested dice (which
 * applyReroll's own die-level loop already finds correctly, via Roll#dice flattening into the
 * pool) changes that die's own result, but leaves the sub-Roll's cached total, the pool's cached
 * snapshot, and its keep/drop selection all stale - so the overall roll total silently doesn't
 * move even though a die visibly changed. This recomputes all three, by hand, for every dice
 * pool in the roll.
 *
 * Foundry's own re-evaluation path can't be reused for the "keep" part: PoolTerm#_evaluateModifiers
 * (shared with Die) drains `this.modifiers` the first time it runs, so a second call on an
 * already-evaluated pool (which is what a reconstructed, already-rolled message's Roll always is
 * - see chat.mjs#rerollMessage) has nothing left to re-apply. Instead, this reproduces the
 * *effect* of that first evaluation from what's still observable: how many results were kept
 * before, and whether those kept results were the highest or lowest of the set (inferred by
 * comparing the pre-reroll active results against the pre-reroll inactive ones) - then re-sorts
 * the refreshed values the same way and keeps the same count. This system's own dice-formula
 * builder (dice.mjs#_getFormula) only ever produces plain "kh" (keep the single highest) pools,
 * but the general form here also holds for "kl" or a keep-N count.
 * @param {Roll} roll
 */
// A result that's already been rerolled has been superseded by its own replacement elsewhere in
// the same die's results array - it's no longer a candidate for keep-highest/keep-lowest
// selection, only the replacement is.
function isKeepCandidate(result) {
  return !result.rerolled;
}

// Infers a die/pool's keep-highest-vs-keep-lowest direction and how many results it keeps, from
// which of its results were active before anything was touched - see refreshPoolTerms and
// reapplyDieKeepSelection's own doc comments for why this has to be inferred rather than just
// re-run through Foundry's own modifier evaluator.
function snapshotKeepDirection(results) {
  // Ignores any already-superseded (rerolled-away) results, in case this die was already
  // touched by an earlier, separate reroll grant on the same roll (e.g. Driving Strike's reroll
  // followed by a Power Infusion banked charge) - only currently-live candidates should inform
  // the direction inference. Pool results never carry a `rerolled` flag, so this is a no-op there.
  const candidates = results.filter(isKeepCandidate);
  const activeValues = candidates.filter(result => result.active).map(result => result.result);
  const inactiveValues = candidates.filter(result => !result.active).map(result => result.result);
  return {
    keepCount: activeValues.length || candidates.length,
    keepsHighest: activeValues.length && inactiveValues.length
      ? Math.min(...activeValues) >= Math.max(...inactiveValues)
      : true, // Nothing was dropped to compare against - direction doesn't matter.
  };
}

/**
 * Edge/Snag (e.g. "2d20kh"/"2d20kl") is a single Die term keeping the higher/lower of 2 results,
 * decided once, during the roll's original evaluation, exactly like a specialization pool - see
 * refreshPoolTerms's own doc comment for the full explanation (a die-level reroll of the KEPT
 * result doesn't reconsider it against the DROPPED one, so a Snagged player rerolling a bad kept
 * d20 could end up locked into whatever the reroll shows even if the discarded roll was better,
 * and an Edge'd player rerolling could fail to credit a discarded roll that was actually the
 * higher one). Re-selects which of a die's still-valid results (see isKeepCandidate) count as
 * kept, using the direction/count captured before any reroll touched it.
 * @param {DiceTerm} die
 * @param {Object} snapshot   From snapshotKeepDirection(), captured before this die was rerolled.
 */
function reapplyDieKeepSelection(die, snapshot) {
  const candidates = die.results.filter(isKeepCandidate);
  const sorted = [...candidates].sort((a, b) => snapshot.keepsHighest ? b.result - a.result : a.result - b.result);
  const kept = new Set(sorted.slice(0, snapshot.keepCount));
  for (const result of die.results) {
    result.active = isKeepCandidate(result) && kept.has(result);
  }
}

async function refreshPoolTerms(roll) {
  for (const term of roll.terms ?? []) {
    if (!(term instanceof foundry.dice.terms.PoolTerm)) {
      continue;
    }

    const { keepCount, keepsHighest } = snapshotKeepDirection(term.results);

    for (const subRoll of term.rolls) {
      await refreshPoolTerms(subRoll); // a pool's own sub-Rolls could nest another pool
      subRoll._total = subRoll._evaluateTotal();
    }

    const refreshed = term.rolls.map(subRoll => ({ result: subRoll.total, active: true }));
    const keptCandidates = [...refreshed].sort((a, b) => keepsHighest ? b.result - a.result : a.result - b.result);
    const kept = new Set(keptCandidates.slice(0, keepCount));
    for (const result of refreshed) {
      result.active = kept.has(result);
    }

    term.results = refreshed;
  }
}

/**
 * Apply a reroll grant to a (already-reconstructed, independent - see chat.mjs) evaluated Roll,
 * mutating its dice in place and refreshing its cached total. Returns false without changing
 * anything if a required die-picker dialog was cancelled.
 * @param {Roll} roll
 * @param {Object} config   A normalized reroll config, as produced by getRerollConfigs().
 * @returns {Promise<boolean>}
 */
export async function applyReroll(roll, config) {
  const mode = config.mode ?? "all";
  const target = config.target ?? "allDice";
  const minDieFaces = config.minDieFaces || 0;
  const eligibleDice = getEligibleDice(roll, target).filter(die => die.faces >= minDieFaces);

  // Edge/Snag (2d20kh/2d20kl) keeps the higher/lower of 2 results on a single Die term, decided
  // once at evaluation time - captured here, before any die is touched, so it can be correctly
  // reapplied afterward instead of a reroll just replacing whichever result happened to be kept.
  // See reapplyDieKeepSelection's own doc comment.
  const keepSnapshots = new Map();
  for (const die of roll.dice) {
    if (die.results.length > 1) {
      keepSnapshots.set(die, snapshotKeepDirection(die.results));
    }
  }

  if (mode === "single" || target === "anyDie") {
    const die = await promptForDie(eligibleDice);
    if (!die) {
      return false;
    }

    await rerollAllActive(die);
  } else {
    for (const die of eligibleDice) {
      await applyRerollToDie(die, config);
    }
  }

  for (const [die, snapshot] of keepSnapshots) {
    reapplyDieKeepSelection(die, snapshot);
  }

  // A specialization roll's "{...}kh" dice pool caches its own total/keep-selection separately
  // from its member dice - see refreshPoolTerms's own doc comment for why a plain
  // roll._evaluateTotal() alone isn't enough once one of those nested dice has changed.
  await refreshPoolTerms(roll);
  roll._total = roll._evaluateTotal();
  return true;
}

export const rerollModeLabel = mode => E20.rerollModes[mode] ?? "E20.RerollModeAll";
