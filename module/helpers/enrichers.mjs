import { E20 } from "./config.mjs";

/**
 * Turns a Specialization's slug key (e.g. "investigation", "underTheRadar" - the same camelCase
 * shape helpers/utils.mjs#slugifySpecializationName produces from a display name) back into a
 * readable Title Case label for display. This is a best-effort reversal, not a real actor lookup:
 * an @Check[...] link is static authored text with no specific actor attached at render time, so
 * there's no live system.skills.<skill>.specializations table to pull the "real" display name
 * from - the author is expected to pass the same slug the target Specialization would actually
 * have (matching how `skill=` values are already slugs, e.g. "alertness" not "Alertness").
 * @param {String} spec
 * @returns {String}
 */
function specializationDisplayName(spec) {
  return spec
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, c => c.toUpperCase());
}

/**
 * Finds the given actor's own Specialization matching the enricher's `spec` hint, if they
 * actually have one - `spec` is authored text with no actor attached at render time (see
 * specializationDisplayName's own doc comment), so whether it corresponds to a real
 * Specialization can only be resolved once a specific actor is about to roll (onCheckLinkClick
 * below), not at render time. Tries an exact key match first (the common case, when the
 * Specialization's own name slugifies to exactly this hint - see
 * helpers/utils.mjs#slugifySpecializationName), then falls back to a normalized name comparison
 * (lowercased, spaces stripped) in case the actor's real key differs from the naive slug (e.g. a
 * second same-named Specialization got a numeric suffix).
 * @param {Actor} actor
 * @param {String} skill
 * @param {String} specHint   The raw `spec` param value from the @Check[...] link.
 * @returns {{key: String, data: Object}|null}
 */
function findMatchingSpecialization(actor, skill, specHint) {
  const specializations = actor.system.skills?.[skill]?.specializations;
  if (!specializations || !specHint) {
    return null;
  }

  if (specializations[specHint]) {
    return { key: specHint, data: specializations[specHint] };
  }

  const normalizedHint = specHint.toLowerCase().replace(/\s+/g, '');
  const match = Object.entries(specializations)
    .find(([, data]) => data?.name?.toLowerCase().replace(/\s+/g, '') == normalizedHint);
  return match ? { key: match[0], data: match[1] } : null;
}

/**
 * Renders @Check[skill=... dif=15], @Check[skill=... defense=toughness], or
 * @Check[skill=... spec=investigation ...] as a clickable "<Skill> Skill Test" (or
 * "<Skill> (<Specialization>) Skill Test") link (p.88-89's "DIF 15 Sleight of Hand or Technology"
 * phrasing), registered onto CONFIG.TextEditor.enrichers in essence20.mjs's init hook. An optional
 * {Custom Label} suffix overrides the generated label text.
 *
 * `spec` names which Specialization the roll SHOULD be made as if the rolling actor actually has
 * it (e.g. "Investigation" under Alertness) - resolved per-actor at click time
 * (onCheckLinkClick's own findMatchingSpecialization call), not baked into the rendered link
 * itself: this same static text can be clicked by different actors, and forcing the Specialized
 * dice-pool mechanic (roll dice up to your shift, keep highest - a real mechanical advantage) on
 * an actor who doesn't actually have that Specialization would hand them a bonus they haven't
 * earned. An actor who DOES have it gets the exact same treatment a real specialization-name link
 * on the character sheet already provides (data-specialization-key/data-specialization-name/
 * data-is-specialized, see templates/actor/parts/misc/essence-skills.hbs) - their own Specialization's
 * shift/Edge/Snag bonuses apply too. An actor who doesn't have it just rolls the plain skill,
 * unspecialized. Not GM-only like `dif` - which Specialization a check calls for isn't secret
 * information the way a target Difficulty number is.
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
  let skillLabel = game.i18n.localize(E20.skills[params.skill] ?? params.skill ?? '');
  if (params.spec) {
    skillLabel += ` (${specializationDisplayName(params.spec)})`;
  }

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

  if (params.spec) {
    // Not data-is-specialized here - see onCheckLinkClick's own findMatchingSpecialization call
    // for why that's resolved per-actor, at click time, instead.
    anchor.dataset.specializationHint = params.spec;
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

  if (params.spec) {
    sendToChat.dataset.spec = params.spec;
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
  // Resolved against THIS actor specifically, not baked into the link's own static dataset - see
  // enrichCheck's own doc comment on `spec` for why forcing isSpecialized regardless of whether
  // the actor actually has a matching Specialization would be wrong.
  const matched = link.dataset.specializationHint
    ? findMatchingSpecialization(actor, skill, link.dataset.specializationHint)
    : null;

  const dataset = {
    skill,
    shiftUp: 0,
    shiftDown: 0,
    defenseType: link.dataset.defense,
    dif: link.dataset.dif,
    specializationKey: matched?.key,
    specializationName: matched?.data.name,
    isSpecialized: !!matched,
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

  if (button.dataset.spec) {
    params.push(`spec=${button.dataset.spec}`);
  }

  if (button.dataset.dif) {
    params.push(`dif=${button.dataset.dif}`);
  }

  await ChatMessage.create({
    content: `@Check[${params.join(' ')}]`,
    speaker: ChatMessage.getSpeaker(),
  });
}
