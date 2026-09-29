/**
 * The chat cards the companion, contact, command and team Perks post carry buttons marked
 * data-e20-social="…". One decorator (on the renderChatMessageHTML hook) redraws a Group Skill Test's
 * card from its participants and routes every button to its module.
 */

export function decorateSocialCard(message, element) {
  const test = message?.flags?.essence20?.groupTest;
  const holder = element?.querySelector?.('.e20-group-test');
  if (test && holder) {
    import("./group-tests.mjs").then(({ renderCard }) => {
      const fresh = document.createElement('div');
      fresh.innerHTML = renderCard(test);
      holder.replaceWith(fresh.firstElementChild ?? fresh);
      wire(message, element);
    });
    return;
  }

  wire(message, element);
}

function wire(message, element) {
  for (const button of element?.querySelectorAll?.('[data-e20-social]') ?? []) {
    if (button.dataset.e20Wired) {
      continue;
    }

    button.dataset.e20Wired = '1';
    button.addEventListener('click', event => {
      event.preventDefault();
      onSocialButton(message, button);
    });
  }
}

async function onSocialButton(message, button) {
  switch (button.dataset.e20Social) {
  case 'groupRoll':
  case 'groupPerk': {
    const { onGroupButton } = await import("./group-tests.mjs");
    return onGroupButton(message, button);
  }

  case 'contactPerk': {
    const { onContactPerk } = await import("./contacts.mjs");
    return onContactPerk(button);
  }

  case 'commandBoost': {
    const { onCommandBoost } = await import("./commands.mjs");
    return onCommandBoost(button);
  }

  case 'timeJet': {
    const { onTimeJetContribute } = await import("./summons.mjs");
    return onTimeJetContribute(button);
  }

  case 'teamPlayerTake': {
    const { onTeamPlayerTake } = await import("./team-actions.mjs");
    return onTeamPlayerTake(message);
  }

  case 'tryMeAccept': {
    const { onTryMeAccept } = await import("./team-actions.mjs");
    return onTryMeAccept(button);
  }

  case 'combinedJoin': {
    const { onCombinedJoin } = await import("./team-actions.mjs");
    return onCombinedJoin(button);
  }

  case 'combinedFire': {
    const { onCombinedFire } = await import("./team-actions.mjs");
    return onCombinedFire(button);
  }

  default:
    return null;
  }
}

/**
 * A participant's Group Skill Test result landed on their actor: redraw the open cards on this client.
 * Called from the updateActor hook.
 */
export function onGroupResultChanged(changed) {
  if (!foundry.utils.hasProperty(changed ?? {}, 'flags.essence20.groupTest') && !foundry.utils.hasProperty(changed ?? {}, 'flags.essence20.priorExperience')
    && !foundry.utils.hasProperty(changed ?? {}, 'flags.essence20.communitySpirit')) {
    return;
  }

  for (const message of (game.messages?.contents ?? []).slice(-50)) {
    if (message.flags?.essence20?.groupTest) {
      globalThis.ui?.chat?.updateMessage?.(message);
    }
  }
}
