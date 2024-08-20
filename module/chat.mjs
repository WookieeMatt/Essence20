// Changes the color of the roll total for crits and fumbles
// Called on the renderChatMessage hook
export const highlightCriticalSuccessFailure = function (message, html, data) {
  if (!message.isRoll || !message.isContentVisible || !message.rolls.length) {
    return;
  }

  const [isCrit, isFumble] = _isCritIsFumble(message.rolls[0].dice, message.flags.canCritD2);

  // Set roll total class to alter its color
  if (isCrit && isFumble) {
    html.find(".dice-total").addClass("crumble");
  } else if (isCrit) {
    html.find(".dice-total").addClass("critical");
  } else if (isFumble) {
    html.find(".dice-total").addClass("fumble");
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
