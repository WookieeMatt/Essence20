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

  return anchor;
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
