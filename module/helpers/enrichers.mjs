import { E20 } from "./config.mjs";

/**
 * Renders @Check[skill=... dif=15] or @Check[skill=... defense=toughness] as a clickable
 * "<Skill> Skill Test" link (p.88-89's "DIF 15 Sleight of Hand or Technology" phrasing),
 * registered onto CONFIG.TextEditor.enrichers in essence20.mjs's init hook. An optional
 * {Custom Label} suffix overrides the generated label text.
 *
 * TextEditor.enrichHTML() re-runs independently on every client against the same raw source
 * text, so the GM-only visibility of a flat `dif` value is enforced here via game.user.isGM:
 * for a non-GM viewer, the number is left out of both the rendered label AND the anchor's
 * dataset entirely (not just styled hidden), so a player's rendered DOM never contains it. This
 * is a "display-only" concealment, not true secrecy - a player could still find the raw value by
 * inspecting the item/journal's stored description text in the console, since Foundry replicates
 * full document text to every client with read permission regardless of what any client renders
 * from it. A `defense` reference isn't secret the same way (Feature 2's target-Defense checks
 * already reveal the target's Defense value to everyone once rolled), so it's always included.
 * @param {RegExpMatchArray} match
 * @returns {Promise<HTMLElement>}
 */
export async function enrichCheck(match) {
  const params = {};
  for (const pair of match[1].trim().split(/\s+/)) {
    const [key, value] = pair.split('=');
    if (key && value) {
      params[key] = value;
    }
  }

  const isGM = game.user.isGM;
  const skillLabel = game.i18n.localize(E20.skills[params.skill] ?? params.skill ?? '');

  let label = match[2];
  if (!label) {
    label = game.i18n.format('E20.CheckLinkSkillTest', { skill: skillLabel });
    if (isGM && params.dif) {
      label += ` (${game.i18n.localize('E20.CheckDifficultyAbbr')} ${params.dif})`;
    } else if (params.defense) {
      label += ` (${game.i18n.localize(E20.defenses[params.defense] ?? params.defense)})`;
    }
  }

  const anchor = document.createElement('a');
  anchor.classList.add('content-link', 'e20-check-link');
  anchor.draggable = false;
  anchor.dataset.skill = params.skill ?? '';
  if (params.defense) {
    anchor.dataset.defense = params.defense;
  }
  if (isGM && params.dif) {
    anchor.dataset.dif = params.dif;
  }
  anchor.innerHTML = `<i class="fas fa-dice-d20"></i> ${label}`;

  if (!isGM) {
    return anchor;
  }

  // GM-only "post to chat" trigger, so a check that only exists in a journal/item/actor
  // description a player can't see (or wouldn't think to open) can still be handed to them as
  // a clickable prompt. It's a sibling of the anchor, not nested inside it (nested interactive
  // elements are invalid HTML and click-through would be unreliable), and carries the full
  // params - including the flat `dif`, which the anchor above deliberately omits for a non-GM
  // viewer - so onCheckSendToChat can reconstruct the original @Check[...] source text. That
  // raw text (not pre-rendered HTML) is what actually gets posted, so every chat viewer's own
  // client re-enriches it through this same function and gets the same GM-only DIF handling.
  const wrapper = document.createElement('span');
  wrapper.classList.add('e20-check-wrapper');
  wrapper.append(anchor);

  const sendToChat = document.createElement('a');
  sendToChat.classList.add('e20-check-send-to-chat');
  sendToChat.dataset.action = 'send-to-chat';
  sendToChat.dataset.skill = params.skill ?? '';
  if (params.defense) {
    sendToChat.dataset.defense = params.defense;
  }
  if (params.dif) {
    sendToChat.dataset.dif = params.dif;
  }
  sendToChat.dataset.tooltip = game.i18n.localize('E20.CheckSendToChat');
  sendToChat.innerHTML = '<i class="fas fa-comment-dots"></i>';
  wrapper.append(sendToChat);

  return wrapper;
}

/**
 * Handles clicking a rendered @Check link (see enrichCheck above), delegated from a
 * document-level click listener in essence20.mjs since these links can appear in item/actor
 * descriptions and journal entries, not just chat. Rolls the clicked skill for the user's
 * assigned character (or a single controlled token, if no character is assigned) through the
 * normal Dice.rollSkill() pipeline, which already knows how to compare the result against a
 * dataset.defenseType (a target's Defense) or a dataset.dif (a flat Difficulty) via
 * dice.mjs's checkContext handling.
 * @param {PointerEvent} event
 * @param {HTMLElement} link
 */
export async function onCheckLinkClick(event, link) {
  event.preventDefault();

  const actor = game.user.character ?? canvas.tokens?.controlled[0]?.actor;
  if (!actor) {
    ui.notifications.warn(game.i18n.localize('E20.CheckNoActorWarning'));
    return;
  }

  const skill = link.dataset.skill;
  const dataset = {
    skill,
    shiftUp: 0,
    shiftDown: 0,
    defenseType: link.dataset.defense,
    dif: link.dataset.dif,
  };

  actor._dice.rollSkill(dataset, actor);
}

/**
 * Handles clicking the GM-only "post to chat" trigger next to a rendered @Check link (see
 * enrichCheck above), delegated the same way as onCheckLinkClick. Posts the check's raw
 * @Check[...] source (not pre-rendered HTML) as a chat message, so every player's own client
 * re-enriches it independently through enrichCheck when the message renders in their chat log -
 * this is what keeps a flat `dif` value GM-only in the chat card too, exactly as it already is
 * wherever the check link originally appeared.
 * @param {PointerEvent} event
 * @param {HTMLElement} button
 */
export async function onCheckSendToChat(event, button) {
  event.preventDefault();

  const params = [`skill=${button.dataset.skill}`];
  if (button.dataset.defense) {
    params.push(`defense=${button.dataset.defense}`);
  }

  if (button.dataset.dif) {
    params.push(`dif=${button.dataset.dif}`);
  }

  await ChatMessage.create({
    content: `@Check[${params.join(' ')}]`,
    speaker: ChatMessage.getSpeaker(),
  });
}
