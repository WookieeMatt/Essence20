/**
 * Who rolls a Megazord's test. The Megazord "acts as one character... The team chooses which actions the Megazord takes
 * each turn and can either roll the Megazord's Skill Die or the team can make a group Driving Skill Test to operate its
 * attacks" (Repulsive Developments, Player Handout: The Megazord, p.20); every Megazord attack also reads "+dX or
 * pilot's Driving" (PR CRB p.150, Repulsive Developments p.20), and the Crew "retain their own skills" (PR CRB p.140).
 *
 * So a Megazord's Roll Options Dialog offers three ways (registerDialogToggles below):
 *  - its own Skill die, as ever;
 *  - one pilot's Driving: the roll's die becomes that crew member's Driving die (the shift difference, the same way a
 *    "roll <Skill> instead" switch works - rules/adapter.mjs), and the card names who rolled;
 *  - a group Driving Test: the Crew each roll Driving on a Group Skill Test card (mechanics/rolls/group-tests.mjs), and
 *    the attack goes ahead once they have. Renegade staff on their Discord (Nov 2026): the DIF is the target's Defense,
 *    half or more must succeed, and if it succeeds with at least one Critical Success among the successes, the whole
 *    attack is a Critical Success. dice.mjs#rollSkill waits for the crew here, then rolls the attack's card with their
 *    outcome standing in for its dice (groupRowOutcome).
 *
 * The rolling player's client waits for the crew: it settles once everyone has rolled (the updateActor hook -
 * items/social/social-cards.mjs#onGroupResultChanged), or when that player presses Resolve on the card. A reload in
 * between loses the wait; the crew's rolls stay on the card, and the attack is rolled again.
 *
 * Not built: a pilot's own Perks on their Driving (Peerless Pilot's ↑...) - the roll is still the Megazord's, so only
 * the Megazord's own modifiers apply to it.
 */
import { registerApplyDialog, registerDialogToggles } from "../item-hooks.mjs";
import { getMegaformCrew, getMegaformParticipants } from "./megaform-participants.mjs";

export const ROLLER = 'mzRoller';
export const GROUP = 'group';
const PILOT = 'pilot:';

const T = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
const isUp = actor => !(Number(actor?.system?.health?.max) > 0 && Number(actor?.system?.health?.value) <= 0);

/** A Power Rangers Megazord - not a Transformers Combiner, whose members are the characters themselves. */
export function isMegazord(actor) {
  return actor?.type == 'megaform' && !actor.system?.subtype?.includes?.('megaformCombiner');
}

/**
 * Who can roll for the Megazord: the Crew riding its working Zords, and a Cybertronian taking part as itself (Field
 * Guide p.134). A Zord at 0 Health no longer contributes in any way (PR CRB p.140), so its pilot doesn't either.
 * @param {Actor} megaform
 * @returns {Actor[]}
 */
export function megazordCrew(megaform) {
  if (!isMegazord(megaform)) {
    return [];
  }

  const participants = getMegaformParticipants(megaform, 'megazord').filter(isUp);
  const crew = new Set(getMegaformCrew(megaform, participants));
  for (const participant of participants) {
    if (participant.type != 'zord') {
      crew.add(participant);
    }
  }

  return [...crew];
}

/** The dialog's choices for this roll, or none. */
export function rollerChoices(actor) {
  if (!isMegazord(actor)) {
    return [];
  }

  const crew = megazordCrew(actor);
  if (!crew.length) {
    return [];
  }

  return [{
    name: ROLLER, label: T('E20.MegazordRoller'), type: 'select', value: 'self',
    options: [
      { value: 'self', label: T('E20.MegazordRollerSelf') },
      ...crew.map(pilot => ({ value: `${PILOT}${pilot.uuid}`, label: T('E20.MegazordRollerPilot', { name: pilot.name }) })),
      { value: GROUP, label: T('E20.MegazordRollerGroup') },
    ],
  }];
}

/**
 * How many shifts take the roll from `fromShift` to `toShift` (E20.skillShiftList runs best-first).
 * @returns {{shiftUp: Number, shiftDown: Number}}
 */
export function shiftsBetween(fromShift, toShift, list = globalThis.CONFIG?.E20?.skillShiftList ?? []) {
  const from = list.indexOf(fromShift);
  const to = list.indexOf(toShift);
  if (from < 0 || to < 0 || from == to) {
    return { shiftUp: 0, shiftDown: 0 };
  }

  return from > to ? { shiftUp: from - to, shiftDown: 0 } : { shiftUp: 0, shiftDown: to - from };
}

/**
 * The dialog closed: a pilot's Driving becomes the roll's die; a group test is flagged for dice.mjs to run.
 * @param {Actor} actor
 * @param {Object} options   The dialog's options (mutated)
 * @param {Object} ctx       {baseShift, dataset...}
 */
export function applyRollerChoice(actor, options, ctx = {}) {
  const pick = options?.ext?.[ROLLER];
  if (!pick || pick == 'self' || !isMegazord(actor)) {
    return;
  }

  if (pick == GROUP) {
    options.megazordGroup = true;
    return;
  }

  const pilot = pick.startsWith(PILOT) ? globalThis.fromUuidSync?.(pick.slice(PILOT.length)) : null;
  const pilotShift = pilot?.system?.skills?.driving?.shift;
  if (!pilot || !pilotShift) {
    return;
  }

  const { shiftUp, shiftDown } = shiftsBetween(ctx.baseShift ?? actor.system?.skills?.[ctx.rolledSkill]?.shift, pilotShift);
  options.shiftUp = (Number(options.shiftUp) || 0) + shiftUp;
  options.shiftDown = (Number(options.shiftDown) || 0) + shiftDown;
  options.rollerNote = T('E20.MegazordRolledByPilot', { name: pilot.name });
}

registerDialogToggles(actor => rollerChoices(actor));
registerApplyDialog((actor, options, ctx) => applyRollerChoice(actor, options, ctx));

/* -------------------------------------------- */
/*  The group Driving Test                       */
/* -------------------------------------------- */

const pending = new Map();

/**
 * The crew's results, as the attack reads them.
 * @param {Object} test   The Group Skill Test (flags.essence20.groupTest)
 * @param {Object} tallied   group-tests.mjs#tally(test)
 * @param {Function} recordOf   id => that participant's stored result
 * @returns {{dif: Number, rolls: Array<{total: Number, crit: Boolean, success: Boolean}>, best: Number, successes: Number, rolled: Number}}
 */
export function outcomeOf(test, tallied, recordOf) {
  const rolls = tallied.rows.filter(row => row.rolled && !row.chaos).map(row => {
    const record = recordOf(row.id) ?? {};
    return { total: Number(record.total) || 0, crit: !!record.crit, success: !!row.success };
  });
  const passing = rolls.filter(roll => roll.success);
  const best = Math.max(0, ...(passing.length ? passing : rolls).map(roll => roll.total));
  return { dif: test.dif, rolls, best, successes: passing.length, rolled: rolls.length };
}

/**
 * One target's row of the attack, from the crew's rolls: half or more of those who rolled succeed against that target's
 * Defense, and a Critical Success among the successes makes it a Critical Success. The test's own DIF was the first
 * target's - its successes are the card's (Prior Experience can turn one); another target compares the totals.
 * @param {Object} outcome   outcomeOf()
 * @param {Object} entry     The target's checkContext entry ({difficulty})
 * @returns {{success: Boolean, crit: Boolean, multiplier: Number}}
 */
export function groupRowOutcome(outcome, entry) {
  const passes = roll => (entry?.difficulty == outcome.dif ? roll.success : roll.total >= (Number(entry?.difficulty) || 0));
  const passing = outcome.rolls.filter(passes);
  const success = outcome.rolls.length > 0 && passing.length * 2 >= outcome.rolls.length;
  const crit = success && passing.some(roll => roll.crit);
  return { success, crit, multiplier: success ? 1 : 0 };
}

/**
 * Post the crew's group Driving Test. With targets (or a flat DIF) the returned promise settles with outcomeOf() once
 * they have rolled - dice.mjs then rolls the attack's card from it. A Skill Test with nothing to compare against asks
 * for the DIF, and its card is the whole result (null).
 * @param {Actor} megaform
 * @param {{entries: Array<Object>|null}} context
 * @returns {Promise<Object|null>}
 */
export async function runMegazordGroupTest(megaform, { entries = null } = {}) {
  const crew = megazordCrew(megaform);
  if (!crew.length) {
    ui.notifications.warn(T('E20.MegazordGroupNoCrew', { name: megaform.name }));
    return null;
  }

  let dif = Number(entries?.[0]?.difficulty);
  if (!entries?.length) {
    dif = await askDif();
    if (dif === null) {
      return null;
    }
  }

  const { renderCard } = await import("../rolls/group-tests.mjs");
  const test = {
    id: foundry.utils.randomID(), skill: 'driving', dif, leader: crew[0].uuid, participants: crew.map(pilot => pilot.uuid),
    // attack: a roll waits on it (Resolve); vsDefense: its DIF is a target's Defense rather than a flat DIF.
    megazord: {
      uuid: megaform.uuid, name: megaform.name, attack: !!entries?.length, vsDefense: !!entries?.some(entry => entry.targetUuid),
      by: game.user?.id ?? null,
    },
  };
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: megaform }),
    content: renderCard(test),
    flags: { essence20: { groupTest: test } },
  });

  if (!entries?.length) {
    return null;
  }

  return new Promise(resolve => pending.set(test.id, { test, resolve }));
}

async function askDif() {
  const answer = await foundry.applications.api.DialogV2.wait({
    window: { title: T('E20.MegazordRollerGroup') },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><label>${T('E20.GroupTestDif')}</label><input type="number" name="dif" value="12" min="0" /></div>`,
    buttons: [
      { action: 'ok', label: T('E20.DialogConfirmButton'), default: true, callback: (event, button) => Number(button.form.elements.dif.value) || 0 },
      { action: 'cancel', label: T('E20.DialogCancelButton') },
    ],
    rejectClose: false,
  });
  return typeof answer == 'number' ? answer : null;
}

/** The card stops offering Resolve and rerolls once its attack has gone ahead. */
async function markResolved(test, renderCard) {
  const message = game.messages?.contents?.findLast?.(entry => entry.flags?.essence20?.groupTest?.id == test.id);
  if (!message?.isOwner) {
    return;
  }

  const stored = message.flags.essence20.groupTest;
  const resolved = { ...stored, megazord: { ...stored.megazord, resolved: true } };
  await message.update({ content: renderCard(resolved), 'flags.essence20.groupTest': resolved });
}

/** Whether this client is waiting on the test. */
export const isWaitingOn = id => pending.has(id);

/**
 * Settle every test this client is waiting on that everyone has rolled - or `force`, the one whose Resolve was pressed.
 * @param {String|null} force
 */
export async function settleMegazordGroupTests(force = null) {
  if (!pending.size) {
    return;
  }

  const { megazordAwaitsResolve, renderCard, tally, resultOf } = await import("../rolls/group-tests.mjs");
  for (const [id, waiting] of [...pending]) {
    const tallied = tally(waiting.test);
    // Megazord Link or Prior Experience can still change a result after everyone has rolled: those wait for Resolve.
    if (id != force && (!tallied.done || megazordAwaitsResolve(waiting.test))) {
      continue;
    }

    pending.delete(id);
    await markResolved(waiting.test, renderCard);
    const outcome = outcomeOf(waiting.test, tallied, uuid => resultOf(globalThis.fromUuidSync?.(uuid), waiting.test));
    outcome.note = T('E20.MegazordGroupNote', { successes: outcome.successes, total: outcome.rolled });
    waiting.resolve(outcome);
  }
}
