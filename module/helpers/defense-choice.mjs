import { getDefenseValue } from "./combat.mjs";
import { registerRemotePrompt, requestChoiceFromUser } from "./remote-request.mjs";

/**
 * Who actually gets to choose which Defense an attack is tested against (Welcome to Night Vale
 * Host Guide's shared Combat Actions chapter, p.33-34, matching every other core rulebook's own
 * identical core-rules text): "Once the Host and Citizen agree on the applicable Defense for the
 * attack, the attacker grabs their appropriate dice..." / "in most cases, the defender chooses
 * the Defense based on how they react to the attack... a character with a higher Toughness may
 * prefer to take a punch to the face, while a character with a higher Evasion will want to dodge
 * out of the way." / "If an attack specifies the Defense it targets, but the target has an
 * ability that dictates the Defense they use, the target's ability takes priority."
 *
 * Previously, dice.mjs's own Roll Options Dialog pre-filled the weapon's own configured
 * defenseType but then let the ATTACKER'S player freely override it via that same dialog's
 * dropdown - backwards from RAW, and a real balance problem (an attacker could always just pick
 * whichever of the target's Defenses happens to be lower). This resolves the choice by actually
 * asking the right person: the target's own connected, non-GM owner if one exists, falling back
 * to a GM (decided locally if the current client already IS one, otherwise a remote request to
 * whichever GM is connected) if not - the same "someone has to actually be able to make this
 * call" limit this project's existing Story Point request flow (story-points.mjs) already
 * accepts for a similarly unattended case.
 */
const TIMEOUT_MS = 60000;

/**
 * @param {Actor} targetActor
 * @param {Object} context
 * @param {String} context.attackerName
 * @param {String} context.suggestedDefenseType   The attacking weapon's own configured Defense -
 *   offered as the pre-highlighted suggestion, never a forced value (matches RAW's own "if an
 *   attack specifies the Defense... the target's ability takes priority" - the target/its player
 *   is always the one with final say, a specified Defense is just the default starting point).
 * @returns {Promise<String>}   One of CONFIG.E20.defenses' own keys.
 */
export async function chooseDefenderDefense(targetActor, { attackerName, suggestedDefenseType }) {
  const payload = {
    actorName: targetActor.name,
    attackerName,
    suggestedDefenseType,
    defenses: Object.fromEntries(
      Object.keys(CONFIG.E20.defenses).map(defenseType => [defenseType, getDefenseValue(targetActor, defenseType)]),
    ),
  };

  // game.users is always real in an actual Foundry client - the optional chaining here is purely
  // for test-environment robustness (many existing test files' own game mocks, predating this
  // function's existence, don't define a users collection at all), not a real production concern.
  const owner = game.users?.find?.(
    user => !user.isGM && user.active && targetActor.testUserPermission?.(user, "OWNER"),
  );

  if (owner) {
    // Already the current client's own user (rolling against your own second PC, or a GM with
    // direct ownership of the "NPC" in question) - decide locally, no socket round-trip needed.
    const answer = owner.id == game.user?.id
      ? await promptDefenseChoice(payload)
      : await requestChoiceFromUser(owner.id, 'chooseDefense', payload, TIMEOUT_MS);

    if (answer) {
      return answer;
    }
    // Timed out/no answer from a remote owner - fall through to the GM-decides path below rather
    // than silently forcing the suggested default on a defender who simply didn't get to weigh in.
  }

  if (game.user?.isGM) {
    return await promptDefenseChoice(payload);
  }

  const connectedGm = game.users?.find?.(user => user.isGM && user.active);
  if (connectedGm) {
    const answer = await requestChoiceFromUser(connectedGm.id, 'chooseDefense', payload, TIMEOUT_MS);
    if (answer) {
      return answer;
    }
  }

  // Nobody available to actually make the call (same "an unattended request can't be acted on"
  // limit story-points.mjs's own requestStoryPointSpend already accepts) - the attacking weapon's
  // own suggested Defense is the least-arbitrary fallback available.
  return suggestedDefenseType;
}

/**
 * Shows the actual picker - a DialogV2 with one button per Defense, labeled with the target's own
 * current value for it, so whoever's answering (the defender's own player, ideally) can see
 * exactly what they're choosing between, matching RAW's own framing quoted above.
 * @param {Object} payload   See chooseDefenderDefense's own payload shape above.
 * @returns {Promise<String>}
 */
export async function promptDefenseChoice(payload) {
  const buttons = Object.entries(CONFIG.E20.defenses).map(([defenseType, label]) => ({
    label: `${game.i18n.localize(label)} (${payload.defenses[defenseType]})`,
    action: defenseType,
    default: defenseType == payload.suggestedDefenseType,
  }));

  const choice = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.format('E20.ChooseDefenseTitle', { actorName: payload.actorName }) },
    classes: ["window-app"],
    content: `<p>${game.i18n.format('E20.ChooseDefenseContent', {
      actorName: payload.actorName, attackerName: payload.attackerName,
    })}</p>`,
    modal: true,
    buttons,
  });

  return choice || payload.suggestedDefenseType;
}

registerRemotePrompt('chooseDefense', promptDefenseChoice);
