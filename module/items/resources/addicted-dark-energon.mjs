import { registerUse } from "../../mechanics/item-hooks.mjs";
import { has, Q1 } from "../shared/qualification-gm-relay.mjs";
import { sourceOf } from "../shared/item-lookups.mjs";
import { TFull as T } from "../shared/item-lang.mjs";
import { onHook } from "../shared/hooks-and-clients.mjs";

/* ============================================ */
/*  Addicted (Dark Energon) (Decepticon Directive p.80) */
/* ============================================ */

// "At the start of each day, the Dark Energon makes an attack against the user's Willpower (at the
// same skill level that caused the Hang-Up). If it fails, the user staves off the hunger for the day;
// on a success, the user needs to consume Dark Energon that day or all standard Energon Point
// expenditures are doubled in cost. A Dark Energon addict that hasn't consumed Dark Energon within 24
// hours after being successfully attacked by the addiction takes 1 Smarts and 1 Social Essence damage
// and continues to take the same damage each subsequent 24 hours until they consume Dark Energon (no
// additional attack needed). ... When a Dark Energon user is reduced to 1 Smarts or Social Essence,
// they begin randomly attacking enemies and allies alike in a berserk rage ... Dark Energon addiction
// can be treated with a successful DIF 20 Science (Medicine) Skill Test that requires a week of
// counseling and treatment."
//
// No calendar exists, so the Hang-Up's Use button carries the day: New Day (the attack, or the
// withdrawal damage), Consumed Dark Energon, and Treatment. While craving, every drop in standard
// Energon is doubled (preUpdateActor below).
const ADDICTION_FLAG = 'q1Addiction';

export function addictionState(actor) {
  return actor?.flags?.essence20?.[ADDICTION_FLAG] ?? { day: 0, craving: false, cravingDay: null, cured: false };
}

export function isCraving(actor) {
  const state = addictionState(actor);
  return has(actor, Q1.addictedDarkEnergon) && !state.cured && !!state.craving;
}

/** Double a drop in standard Energon while craving. */
export function onAddictPreUpdate(actor, changes) {
  if (!isCraving(actor)) {
    return;
  }

  const path = 'system.energon.normal.value';
  const flat = foundry.utils.flattenObject(changes ?? {});
  if (!(path in flat)) {
    return;
  }

  const before = Number(foundry.utils.getProperty(actor, path) ?? 0);
  const after = Number(flat[path]);
  if (!(after < before)) {
    return;
  }

  const doubled = Math.max(0, before - 2 * (before - after));
  foundry.utils.setProperty(changes, path, doubled);
  if (changes[path] !== undefined) {
    changes[path] = doubled;
  }
}

const SHIFTS = ['d2', 'd4', 'd6', 'd8', 'd10', 'd12'];

async function newDay(actor, state) {
  const day = (state.day ?? 0) + 1;
  // Unfed since a successful attack on an earlier day: withdrawal, no new attack.
  if (state.craving && state.cravingDay != null && state.cravingDay < day) {
    const { applyEssenceDamage } = await import("../../mechanics/world/environment-hazards.mjs");
    await applyEssenceDamage(actor, ['smarts', 'social']);
    await actor.setFlag('essence20', ADDICTION_FLAG, { ...state, day });
    const low = ['smarts', 'social'].some(essence => (actor.system?.essences?.[essence]?.value ?? 2) <= 1);
    return T(low ? 'E20.Q1AddictionBerserk' : 'E20.Q1AddictionWithdrawal', { name: actor.name });
  }

  // "At the same skill level that caused the Hang-Up" - recorded when the addiction took hold
  // (resource/energon.mjs, darkEnergonAddictionDie); asked for only when that's unknown, e.g. a
  // Hang-Up added by hand. Past the top of the ladder the attack always succeeds.
  let shift = actor.flags?.essence20?.darkEnergonAddictionDie;
  if (!shift) {
    const { chooseSelect } = await import("../../mechanics/resources/grants.mjs");
    shift = await chooseSelect(actor.name, T('E20.Q1AddictionLevel'), SHIFTS.map(value => ({ value, label: value })));
    if (!shift) {
      return null;
    }
  }

  let hit = true;
  if (shift != 'auto') {
    const roll = await new Roll(`d20 + ${shift}`).evaluate();
    await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: T('E20.Q1AddictionAttack') });
    const willpower = actor.system?.defenses?.willpower?.total ?? 10;
    hit = roll.total >= willpower;
  }

  await actor.setFlag('essence20', ADDICTION_FLAG, { ...state, day, craving: hit, cravingDay: hit ? day : null });
  return T(hit ? 'E20.Q1AddictionHungry' : 'E20.Q1AddictionStaved', { name: actor.name });
}

export const ADDICTION_USE = {
  id: 'q1Addiction',
  matches: item => sourceOf(item) == Q1.addictedDarkEnergon,
  canUse: item => !addictionState(item.parent).cured,
  async run(item) {
    const actor = item.parent;
    const state = addictionState(actor);
    const { chooseButtons, rollTest } = await import("../../mechanics/resources/grants.mjs");
    const which = await chooseButtons(item.name, T('E20.Q1WhichUse'), [
      ['day', T('E20.Q1AddictionNewDay')], ['fed', T('E20.Q1AddictionFed')], ['treat', T('E20.Q1AddictionTreat')],
    ]);
    if (which == 'day') {
      return newDay(actor, state);
    }

    if (which == 'fed') {
      await actor.setFlag('essence20', ADDICTION_FLAG, { ...state, craving: false, cravingDay: null });
      return T('E20.Q1AddictionFedLine', { name: actor.name });
    }

    if (which == 'treat') {
      const { success } = await rollTest(actor, 'science', 20);
      if (success) {
        await actor.setFlag('essence20', ADDICTION_FLAG, { ...state, craving: false, cured: true });
        return T('E20.Q1AddictionCured', { name: actor.name });
      }

      return T('E20.Q1AddictionNotCured', { name: actor.name });
    }

    return null;
  },
};

/** The Hang-Up's Use button and its doubled Energon spend (wired at load by ../gear/qualification-setup.mjs). */
export function registerDarkEnergonAddiction() {
  registerUse(ADDICTION_USE);
  onHook('preUpdateActor', (actor, changes) => {
    onAddictPreUpdate(actor, changes);
  });
}
