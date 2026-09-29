import { registerApplyDialog, registerPostRoll, registerUse } from "../../extensions.mjs";
import { epochFor, getUses } from "../../scene-clock.mjs";
import { worldActors } from "../../companion-link.mjs";
import { T, findSourced, gainPower, isAllyOf, isEnemyOf, itemsOf, jtt, postLine, sourceOf, writeActor } from "./common.mjs";

/**
 * Purple Ranger (A Jump Through Time, p.36-39) - the parts helpers/emotional-mastery.mjs leaves open.
 *
 * Emotional Range: "you note a number of Emotional Mastery options equal to your Emotional Range,
 * shown in the table above... As you gain Levels, you choose additional Emotional Range options to
 * add to your Emotional Mastery." The known options live on the actor (flag zord1KnownEmotions);
 * ensureKnownEmotions tops the list up to the current Emotional Range and the activation picker
 * only offers those (a one-line patch to emotional-mastery.mjs, integration/zord1-patch.cjs).
 *
 * Emotional Strength: "you can regain 1d2 Power Points immediately once you experience a specific
 * trigger attached to whatever Emotional Mastery options you have active at the time. Emotional
 * Strength can only activate once per scene." emotional-mastery.mjs wires Anger (damage); this file
 * wires the other eleven:
 *   Contempt "An enemy achieves a Critical Success." / Joy "An ally achieves a Critical Success." /
 *   Disgust "An ally Fumbles." / Distress "You Fumble a Skill Test." - any roll (post-roll hook).
 *   Shame "You fail a Skill Test that benefitted from a ↑1 or greater bonus." / Shyness "You fail a
 *   Skill Test benefitting from another character's Lend Assistance action." - read at the dialog,
 *   judged after the roll.
 *   Surprise "You roll a result of exactly 2 or of 25+ on any Skill Test." - the posted roll's total.
 *   Fear "You gain the Frightened or Impaired condition." / Sadness "An ally gains any Condition." -
 *   a status effect landing.
 *   Guilt "You are part of a Group Test that fails." - the Group Test card (helpers/group-tests.mjs).
 *   Interest "You discover something hidden." - the GM's call, so the Perk's Use button claims it.
 */

export const EMOTION = {
  mastery: jtt('bWAncoQxwfCLtn2v'),
  range: jtt('lhUy6M5juoCvCVBd'),
  strength: jtt('BODEMNm0GIAsMMm0'),
};

export const OPTIONS = [
  'anger', 'contempt', 'disgust', 'distress', 'fear', 'guilt',
  'interest', 'joy', 'sadness', 'shame', 'shyness', 'surprise',
];

const KNOWN_FLAG = 'zord1KnownEmotions';
// Shared with emotional-mastery.mjs's own Anger trigger, so all twelve share one use.
const STRENGTH_FLAG = 'emotionalStrengthUsedThisEncounter';

/* -------------------------------------------- */
/*  Emotional Range                              */
/* -------------------------------------------- */

/** How many options this Purple Ranger knows (the Emotional Range Role Points value), or null. */
export function emotionalRange(actor) {
  const range = findSourced(actor, EMOTION.range)
    ?? itemsOf(actor).find(item => item.type == 'rolePoints' && /emotional range/i.test(item.name ?? ''));
  const value = Number(range?.system?.bonus?.value);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function knownEmotions(actor) {
  const known = actor?.flags?.essence20?.[KNOWN_FLAG];
  return Array.isArray(known) ? known.filter(key => OPTIONS.includes(key)) : [];
}

/**
 * The options the actor may activate: their known list, topped up (by asking) to their Emotional
 * Range first. null means "no Emotional Range to limit by" - every option is offered.
 * @returns {Promise<String[]|null>}
 */
export async function ensureKnownEmotions(actor) {
  const range = emotionalRange(actor);
  if (!range) {
    return null;
  }

  const known = knownEmotions(actor).slice(0, range);
  if (known.length < range) {
    const { chooseSelect } = await import("../../grants.mjs");
    while (known.length < range) {
      const left = OPTIONS.filter(key => !known.includes(key));
      const picked = await chooseSelect(T('Zord1EmotionalRangeTitle'),
        T('Zord1EmotionalRangePrompt', { n: known.length + 1, range }),
        left.map(value => ({ value, label: game.i18n.localize(`E20.EmotionalMastery${value.capitalize()}`) })));
      if (!picked) {
        break;
      }

      known.push(picked);
    }

    await actor.setFlag('essence20', KNOWN_FLAG, known);
  }

  return known.length ? known : null;
}

/* -------------------------------------------- */
/*  Emotional Strength                           */
/* -------------------------------------------- */

function activeOptions(actor) {
  const own = actor?.flags?.essence20?.activeEmotionalMastery;
  const list = Array.isArray(own) ? [...own] : [];
  // Team Spirit: an ally's option applies to the holder too (emotional-mastery.mjs#isEmotionalMasteryOptionActive).
  const lent = actor?.flags?.essence20?.teamSpiritOption;
  if (lent?.option && globalThis.fromUuidSync) {
    const caster = fromUuidSync(lent.casterUuid);
    const casterActive = caster?.flags?.essence20?.activeEmotionalMastery;
    if (Array.isArray(casterActive) && casterActive.includes(lent.option)) {
      list.push(lent.option);
    }
  }

  return list;
}

export function canTrigger(actor, option) {
  return !!findSourced(actor, EMOTION.strength) && activeOptions(actor).includes(option)
    && getUses(actor, STRENGTH_FLAG, 'encounter') < 1;
}

/** Regain 1d2 Power, once per scene, if this trigger belongs to an active option. */
export async function triggerEmotionalStrength(actor, option) {
  if (!canTrigger(actor, option)) {
    return false;
  }

  const epoch = epochFor('encounter');
  await writeActor(actor, 'setFlag', ['essence20', STRENGTH_FLAG, { epoch, window: 'encounter', count: 1 }]);
  const roll = await new Roll('1d2').evaluate();
  await gainPower(actor, roll.total);
  await postLine(actor, T('Zord1EmotionalStrength', {
    name: actor.name, n: roll.total, option: game.i18n.localize(`E20.EmotionalMastery${option.capitalize()}`),
  }));
  return true;
}

function holders() {
  return worldActors().filter(actor => findSourced(actor, EMOTION.strength) && activeOptions(actor).length);
}

// What each roll had going for it, noted at the dialog (this client) and judged after the roll.
const rollNotes = new Map();

export async function noteDialog(actor, options) {
  if (!actor?.uuid) {
    return;
  }

  const flags = actor.flags?.essence20 ?? {};
  rollNotes.set(actor.uuid, {
    upshift: (Number(options.shiftUp) || 0) - (Number(options.shiftDown) || 0) >= 1,
    assisted: !!(flags.pendingLendAssistanceEdge || flags.pendingLendAssistanceShift),
  });
}

export async function emotionPostRoll(actor, results, checkContext, { isCrit, isFumble } = {}) {
  const note = actor?.uuid ? rollNotes.get(actor.uuid) : null;
  if (actor?.uuid) {
    rollNotes.delete(actor.uuid);
  }

  const failed = Array.isArray(results) && results.length > 0 && results.every(result => result.success === false);
  for (const holder of holders()) {
    const self = holder.uuid == actor?.uuid;
    if (isCrit && !self && isEnemyOf(holder, actor)) {
      await triggerEmotionalStrength(holder, 'contempt');
    }

    if (isCrit && !self && isAllyOf(holder, actor)) {
      await triggerEmotionalStrength(holder, 'joy');
    }

    if (isFumble && !self && isAllyOf(holder, actor)) {
      await triggerEmotionalStrength(holder, 'disgust');
    }

    if (isFumble && self) {
      await triggerEmotionalStrength(holder, 'distress');
    }

    if (failed && self && note?.upshift) {
      await triggerEmotionalStrength(holder, 'shame');
    }

    if (failed && self && note?.assisted) {
      await triggerEmotionalStrength(holder, 'shyness');
    }
  }
}

/** Surprise: "You roll a result of exactly 2 or of 25+ on any Skill Test." */
export async function onRollMessage(message) {
  const roll = message?.rolls?.[0];
  const hasD20 = (roll?.dice ?? []).some(die => die.faces == 20);
  if (!roll || !hasD20 || !(roll.total == 2 || roll.total >= 25)) {
    return;
  }

  const actor = message.speaker?.actor ? game.actors?.get?.(message.speaker.actor) : null;
  if (actor) {
    await triggerEmotionalStrength(actor, 'surprise');
  }
}

const FEAR_STATUSES = ['frightened', 'impaired'];

/** Fear (the holder gains Frightened/Impaired) and Sadness (an ally gains any Condition). */
export async function onStatusGained(actor, statuses) {
  if (!actor || !statuses?.length) {
    return;
  }

  if (statuses.some(status => FEAR_STATUSES.includes(status))) {
    await triggerEmotionalStrength(actor, 'fear');
  }

  const conditions = new Set((CONFIG.statusEffects ?? []).map(effect => effect.id));
  if (!statuses.some(status => conditions.has(status))) {
    return;
  }

  for (const holder of holders()) {
    if (isAllyOf(holder, actor)) {
      await triggerEmotionalStrength(holder, 'sadness');
    }
  }
}

/** Guilt: a Group Test card that has just finished as a failure. */
export async function onGroupTestMessage(message) {
  const test = message?.flags?.essence20?.groupTest;
  if (!test?.participants?.length) {
    return;
  }

  const { tally } = await import("../../group-tests.mjs");
  const outcome = tally(test);
  if (!outcome.done || outcome.success) {
    return;
  }

  for (const id of test.participants) {
    const actor = fromUuidSync(id);
    if (actor) {
      await triggerEmotionalStrength(actor, 'guilt');
    }
  }
}

/** The Perk's Use: claim a trigger the table saw happen (Interest, or anything the hooks missed). */
async function runStrengthUse(item) {
  const actor = item.parent;
  const active = activeOptions(actor);
  if (!active.length) {
    ui.notifications.warn(game.i18n.localize('E20.TeamSpiritNoActiveOption'));
    return null;
  }

  if (getUses(actor, STRENGTH_FLAG, 'encounter') >= 1) {
    ui.notifications.warn(T('Zord1EmotionalStrengthUsed'));
    return null;
  }

  const { chooseSelect } = await import("../../grants.mjs");
  const option = active.length == 1 ? active[0] : await chooseSelect(item.name, T('Zord1EmotionalStrengthPrompt'),
    active.map(value => ({ value, label: game.i18n.localize(`E20.EmotionalMastery${value.capitalize()}`) })));
  if (option) {
    await triggerEmotionalStrength(actor, option);
  }

  return null;
}

/* -------------------------------------------- */
/*  Registration                                 */
/* -------------------------------------------- */

registerApplyDialog(noteDialog);
registerPostRoll(emotionPostRoll);
registerUse({ id: 'zord1EmotionalStrength', matches: item => sourceOf(item) == EMOTION.strength, run: runStrengthUse });

globalThis.Hooks?.on?.('createChatMessage', (message, options, userId) => {
  if (userId == globalThis.game?.user?.id) {
    onRollMessage(message);
  }
});

globalThis.Hooks?.on?.('updateChatMessage', (message, changes, options, userId) => {
  if (userId == globalThis.game?.user?.id && message?.flags?.essence20?.groupTest) {
    onGroupTestMessage(message);
  }
});

globalThis.Hooks?.on?.('createActiveEffect', (effect, options, userId) => {
  const actor = effect?.parent;
  if (userId != globalThis.game?.user?.id || actor?.documentName != 'Actor') {
    return;
  }

  onStatusGained(actor, [...(effect.statuses ?? [])]);
});
