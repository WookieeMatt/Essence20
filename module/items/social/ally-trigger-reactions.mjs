import { registerChatDecorator } from "../../mechanics/item-hooks.mjs";
import { actorHasHangUp, findPerk } from "../../mechanics/characters/perks.mjs";
import {
  canAct, cardInfo, claim, claimKey, convertRows, esc, isClaimed, SCOPE, speakerActor,
} from "../../mechanics/combat/reaction-engine.mjs";

/**
 * Reactions to something happening to someone else - a character dropping to 0, a Fumble nearby,
 * gear being destroyed, a Defeat - rather than to a card's button. Every client sees these hooks;
 * each acts only for the actors it is responsible for (core.mjs#isResponsible).
 */

export const TRIG = {
  agencyHangUp: "Compendium.essence20.across_the_stars.Item.QZpWbKjMxMdahpoL",
  agencyPerk: "Compendium.essence20.across_the_stars.Item.bGKG7artYs7uHHz4",
};

const T = (key, data) => (data ? game.i18n.format(`E20.${key}`, data) : game.i18n.localize(`E20.${key}`));

// (All For One is a droppedToZero Trigger on the Perk, its answers button cards - rules/conv10-slD10.test.js. Junker is an
// equipmentBroke Trigger on the Hang-Up, fired by rules/plugins/combat/hazard-terrain-targets.mjs; Not On My Watch a watch droppedToZero Trigger.)

/* -------------------------------------------- */
/*  Someone nearby fails or Fumbles              */
/* -------------------------------------------- */

// (Their Loss, My Gain is a watch afterRoll Trigger on the Perk and on Loss And Gain. Cruel
// Conflagration is two watch afterRoll Triggers on the Perk: a button offering Impaired after a failure
// within 15 ft, and one offering the Psychic damage (with or without Impaired) after a Fumble.)

// (Revengeful's Story Point for a Defeat and Inspirational Leader's ↑1 for the team are rules on their Perks -
// rules/conv10-slE10.test.js.)

/* -------------------------------------------- */
/*  Agency                                       */
/* -------------------------------------------- */

/**
 * Agency (Across the Stars, Hang-Up, p.42): "When you Fumble in your agency's Skill, you do not
 * generate a Story Point as you normally would." The agency's Skill is the Agency Influence Perk's
 * own skill choice. Read by dice.mjs's Fumble grant (scratchpad integration/react-patch.cjs).
 * @param {Actor} actor
 * @param {String} skill
 * @returns {Boolean}
 */
export function suppressesFumbleStoryPoint(actor, skill) {
  if (!skill || !actorHasHangUp(actor, TRIG.agencyHangUp)) {
    return false;
  }

  const choice = findPerk(actor, TRIG.agencyPerk)?.system?.choice;
  return !!choice && choice == skill;
}

/* -------------------------------------------- */
/*  Secret Helper                                */
/* -------------------------------------------- */

// Secret Helper (MLP CRB p.74): "if a friend fails a Skill Test, you can roll your Skill Die (for the
// Skill they were using) and add it to their total." chat.mjs posts the assisted total; this reads
// it against the failed card's Difficulties and, where it now clears one, offers to resolve it as a
// success - with the Attack's damage when it was an Attack.
export function secretHelperSource(message) {
  const list = game.messages?.contents ?? [];
  const index = list.findIndex(m => m.id == message.id);
  for (let i = (index < 0 ? list.length : index) - 1; i >= 0 && i >= index - 25; i--) {
    const candidate = list[i];
    if (candidate?.speaker?.actor == message.speaker?.actor && candidate.flags?.[SCOPE]?.rollFailed === true && candidate.flags[SCOPE].checkResults) {
      return candidate;
    }
  }

  return null;
}

registerChatDecorator((message, element) => {
  if (!message?.flags?.[SCOPE]?.secretHelperAssist || !message.rolls?.length || !element?.querySelector) {
    return;
  }

  const source = secretHelperSource(message);
  const info = source ? cardInfo(source) : null;
  if (!info) {
    return;
  }

  const total = Number(message.rolls[0].total);
  const rows = info.rows.filter(row => !row.success && total >= row.difficulty);
  if (!rows.length || element.querySelector('.e20-react-secret-helper')) {
    return;
  }

  const box = document.createElement('div');
  box.className = 'e20-react-secret-helper e20-chat-action-buttons';
  box.innerHTML = `<p>${T('ReactSecretHelperNow', { total })}</p>`;
  const roller = speakerActor(message);
  if (canAct(roller)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'e20-chat-action-button';
    button.textContent = T('ReactResolveSuccess');
    button.disabled = isClaimed(roller, claimKey(message, null, 'secretHelper'));
    button.addEventListener('click', async () => {
      button.disabled = true;
      await claim(roller, claimKey(message, null, 'secretHelper'));
      await convertRows(info, rows, { crit: false, speaker: roller, reason: T('ReactSecretHelperSuccess', { name: esc(roller.name) }) });
    });
    box.appendChild(button);
  }

  (element.querySelector('.message-content') ?? element).appendChild(box);
});
