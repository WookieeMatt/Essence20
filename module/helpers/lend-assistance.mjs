import { E20 } from "./config.mjs";
import { bankPendingBonus } from "./perks.mjs";
import { getNearbyAllyTokens } from "./allies.mjs";
import { getSkillRanks } from "./combat.mjs";

/**
 * The Lend Assistance action (GI Joe CRB p.197).
 *
 * > "A character may take the Lend Assistance Standard action to help another character in a
 * > specific Skill Test, including hitting an enemy target in combat. In a Combat scene, you can
 * > Lend Assistance to an ally for a specific target within 50 ft. Until the beginning of your next
 * > turn, the first attack against the specific target gains an Edge. Alternatively, if a character
 * > has at least as many levels in a given skill as their ally, they may Lend Assistance to that
 * > ally to give them an automatic up-1 shift to their use of that given skill."
 *
 * Two different grants, so two flags rather than one with a mode field - an ally could plausibly be
 * assisted both ways in a round, and a single flag would have the second quietly overwrite the
 * first. Both are banked on the ALLY and consumed by their own roll, the shape
 * helpers/shoulder-to-shoulder.mjs already established.
 *
 * What is enforced, and what is not:
 *
 * - The **50 ft** is measured from the assisting character to the target, and refused past it.
 *   "an ally for a specific target within 50 ft" could also be read as the ALLY being the thing
 *   within 50 ft; the target reading is taken because the target is what the sentence goes on to
 *   talk about, and because the ally is the one person in the exchange the assister is already
 *   choosing deliberately. The ally list is not distance-filtered as a result.
 * - The **skill-levels prerequisite** is enforced: getSkillRanks counts shifts above untrained plus
 *   a Specialization, and the assister needs at least as many as the ally. This is the one clause
 *   in the action with a hard numeric test, so leaving it to the table would be a waste of it.
 * - **"Until the beginning of your next turn"** is not enforced, matching every other banked bonus
 *   in this system - see perks.mjs#bankPendingBonus, which stamps a combat id so a bonus never
 *   survives into a new encounter but deliberately does not expire on a turn boundary. The Edge is
 *   consumed by the first attack against that target either way, which is the clause that decides
 *   it in practice.
 */

/** The Edge on the first attack against one specific target. */
export const LEND_ASSISTANCE_EDGE_FLAG = 'pendingLendAssistanceEdge';

/** The up-1 shift on one specific skill. */
export const LEND_ASSISTANCE_SHIFT_FLAG = 'pendingLendAssistanceShift';

/** "a specific target within 50 ft" (GI Joe CRB p.197). */
export const LEND_ASSISTANCE_RANGE_FEET = 50;

/**
 * How far the assisting character is from a token, in feet.
 *
 * Returns null when there is nothing to measure against - no scene, or neither of them placed on
 * it - which the caller treats as "cannot check" rather than "out of range". Refusing the action
 * because a GM is running theatre-of-the-mind would be the wrong way to fail.
 *
 * @param {Actor} actor
 * @param {Token} token
 * @returns {Number|null}
 */
function distanceFeet(actor, token) {
  const actorToken = actor?.getActiveTokens?.()?.[0];
  if (!actorToken || !token || !canvas?.grid) {
    return null;
  }

  return canvas.grid.measurePath([token.center, actorToken.center]).distance;
}

/**
 * Asks who is being helped, and how.
 *
 * One dialog rather than a chain of them: the ally is needed either way, and the mode decides only
 * whether the skill dropdown matters. The skill select is always present and ignored in attack
 * mode, which keeps this to a single DialogV2 - the same single-form shape every other picker in
 * this file tree uses, just with three fields.
 *
 * @param {Array<Actor>} allies      Who can be helped.
 * @param {String|null} targetName   The currently targeted enemy, or null if there is none.
 * @returns {Promise<Object|null>}   {allyId, mode, skill}, or null if cancelled.
 */
async function pickAssistance(allies, targetName) {
  const allyOptions = allies
    .map(a => `<option value="${a.id}">${foundry.utils.escapeHTML(a.name)}</option>`).join('');
  const skillOptions = Object.keys(E20.skills)
    .map(key => `<option value="${key}">${game.i18n.localize(E20.skills[key])}</option>`).join('');

  /* Attack mode needs a target, so it is only offered when there is one - and when there is, it is
     listed first, since targeting an enemy and then taking this action is the combat case. */
  const modeOptions = [
    targetName
      ? `<option value="attack">${game.i18n.format('E20.LendAssistanceModeAttack', { target: targetName })}</option>`
      : '',
    `<option value="skill">${game.i18n.localize('E20.LendAssistanceModeSkill')}</option>`,
  ].join('');

  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.LendAssistanceTitle') },
    classes: ["window-app", "e20-window"],
    content: `
      <div class="form-group">
        <label>${game.i18n.localize('E20.LendAssistanceAllyLabel')}</label>
        <select name="allyId">${allyOptions}</select>
      </div>
      <div class="form-group">
        <label>${game.i18n.localize('E20.LendAssistanceModeLabel')}</label>
        <select name="mode">${modeOptions}</select>
      </div>
      <div class="form-group">
        <label>${game.i18n.localize('E20.LendAssistanceSkillLabel')}</label>
        <select name="skill">${skillOptions}</select>
      </div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => ({
          allyId: button.form.elements.allyId.value,
          mode: button.form.elements.mode.value,
          skill: button.form.elements.skill.value,
        }),
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return result && result != 'cancel' ? result : null;
}

/**
 * Take the Lend Assistance action.
 *
 * Returns {message} on success for the chat notice, or {cancelled: true} when nothing was banked -
 * which the caller uses to hand the Standard action back, since an action that helped nobody was
 * never taken.
 *
 * @param {Actor} actor
 * @returns {Promise<Object>}
 */
export async function activateLendAssistance(actor) {
  const allies = getNearbyAllyTokens(actor, Infinity).map(token => token.actor).filter(Boolean);
  if (!allies.length) {
    ui.notifications.warn(game.i18n.localize('E20.LendAssistanceNoAllies'));
    return { cancelled: true };
  }

  const targetToken = game.user.targets.first();
  const distance = targetToken ? distanceFeet(actor, targetToken) : null;
  /* Out of range is reported before the dialog rather than inside it: the player picked that
     target, and telling them afterwards that the mode they chose was never available is worse than
     telling them now. A distance that cannot be measured at all is not a refusal - see
     distanceFeet. */
  const targetInRange = !!targetToken
    && (distance === null || distance <= LEND_ASSISTANCE_RANGE_FEET);
  if (targetToken && !targetInRange) {
    ui.notifications.warn(game.i18n.format('E20.LendAssistanceOutOfRange', {
      target: targetToken.name,
      range: LEND_ASSISTANCE_RANGE_FEET,
      distance: Math.round(distance),
    }));
  }

  const choice = await pickAssistance(allies, targetInRange ? targetToken.name : null);
  if (!choice) {
    return { cancelled: true };
  }

  const ally = allies.find(a => a.id == choice.allyId);
  if (!ally) {
    return { cancelled: true };
  }

  if (choice.mode == 'attack') {
    /* The attack option is only offered when a target is in range, but the dialog is a form and
       nothing stops the player untargeting while it is open. Treated as nothing chosen rather
       than banked against a null target, which would be an Edge no attack could ever match. */
    if (!targetInRange) {
      ui.notifications.warn(game.i18n.localize('E20.LendAssistanceNoTarget'));
      return { cancelled: true };
    }

    await bankPendingBonus(ally, LEND_ASSISTANCE_EDGE_FLAG, {
      targetId: targetToken.actor?.id ?? null,
      edge: true,
    });

    return {
      message: game.i18n.format('E20.LendAssistanceAttackActivated', {
        name: actor.name,
        ally: ally.name,
        target: targetToken.name,
      }),
    };
  }

  /* "if a character has at least as many levels in a given skill as their ally" - the one hard
     numeric prerequisite in the action. Refused rather than warned-and-allowed, because unlike the
     duration and range clauses this one decides whether the grant exists at all. */
  if (getSkillRanks(actor, choice.skill) < getSkillRanks(ally, choice.skill)) {
    ui.notifications.warn(game.i18n.format('E20.LendAssistanceUnskilled', {
      name: actor.name,
      ally: ally.name,
      skill: game.i18n.localize(E20.skills[choice.skill] ?? choice.skill),
    }));

    return { cancelled: true };
  }

  await bankPendingBonus(ally, LEND_ASSISTANCE_SHIFT_FLAG, { skill: choice.skill, shiftUp: 1 });

  return {
    message: game.i18n.format('E20.LendAssistanceSkillActivated', {
      name: actor.name,
      ally: ally.name,
      skill: game.i18n.localize(E20.skills[choice.skill] ?? choice.skill),
    }),
  };
}
