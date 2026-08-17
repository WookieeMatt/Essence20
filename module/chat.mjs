import { applyDamage } from "./helpers/combat.mjs";

// Wires up the check-card.hbs "Apply Damage" button. Called on the renderChatMessageHTML hook.
export const attachCheckCardListeners = function (message, html) {
  const buttons = html.querySelectorAll('[data-action="apply-damage"]');
  if (!buttons.length) {
    return;
  }

  const alreadyApplied = message.getFlag('essence20', 'damageApplied');
  for (const button of buttons) {
    if (alreadyApplied) {
      button.disabled = true;
      continue;
    }

    button.addEventListener('click', () => onApplyDamage(message, button));
  }
};

// Cross-actor Health changes stay GM-gated, since there's no existing precedent anywhere in this
// codebase for a player mutating another actor's document.
async function onApplyDamage(message, button) {
  if (!game.user.isGM) {
    ui.notifications.warn(game.i18n.localize('E20.CheckApplyDamageGmOnly'));
    return;
  }

  const target = await fromUuid(button.dataset.targetUuid);
  if (!target) {
    return;
  }

  const amount = await applyDamage(target, parseInt(button.dataset.damage), button.dataset.damageType);
  button.disabled = true;
  await message.setFlag('essence20', 'damageApplied', true);
  ChatMessage.create({
    content: `${target.name}: ${amount} ${game.i18n.localize('E20.CheckDamageApplied')}`,
    speaker: ChatMessage.getSpeaker({ actor: target }),
  });
}

// Changes the color of the roll total for crits and fumbles
// Called on the renderChatMessageHTML hook
export const highlightCriticalSuccessFailure = function (message, html) {
  if (!message.isRoll || !message.isContentVisible || !message.rolls.length) {
    return;
  }

  const [isCrit, isFumble] = _isCritIsFumble(message.rolls[0].dice, message.flags.essence20?.canCritD2);

  // Set roll total class to alter its color
  const diceTotalElement = html.getElementsByClassName('dice-total')[0];

  if (isCrit && isFumble) {
    diceTotalElement.classList.add('crumble');
  } else if (isCrit) {
    diceTotalElement.classList.add('critical');
  } else if (isFumble) {
    diceTotalElement.classList.add('fumble');
  }
};

// Helper to determine if the roll was a crit and/or fumble
export const _isCritIsFumble = function (dice, canCritD2) {
  let isCrit = false;
  let isFumble = false;

  for (let diePool of dice) {
    // A diePool here is a group of similarly-sided dice, such as d20 or 3d6
    let faces = diePool.faces;

    for (let dieValue of diePool.values) {
      // dieValue is an individual result from the diePool
      if (faces === 20 && dieValue === 1) {
        isFumble = true;
      } else if ((faces > 2 || canCritD2) && faces != 20 && dieValue === faces) {
        isCrit = true;
        break; // Only one die needs to crit
      }
    }

    if (isCrit) {
      break; // Perpetuating inner-for break
    }
  }

  return [isCrit, isFumble];
};
