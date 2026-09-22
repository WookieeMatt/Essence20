import { getDefenseValue } from "./combat.mjs";
import { registerRemotePrompt, requestChoiceFromUser } from "./remote-request.mjs";
import { getGameLine } from "../settings.js";
import { getSceneEpoch } from "./scene-clock.mjs";
import { canSpendForActor, defenseBoostLastsScene, spendForActor } from "./story-points.mjs";

/** Where a scene-long Defense boost (My Little Pony) is recorded on the defender. */
const SCENE_BOOST_FLAG = "storyPointDefenseBoost";

/** What a Story Point adds to a Defense before the dice are rolled, in every line. */
export const DEFENSE_BOOST = 5;

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
 * @returns {Promise<{defenseType: String, storyPointBoost: Boolean}>}   The chosen Defense (one
 *   of CONFIG.E20.defenses' own keys) and whether a Story Point was just spent to raise it by
 *   DEFENSE_BOOST for this attack - "Add +5 to a Defense before dice are rolled" (GI Joe CRB
 *   p.127), which is offered here because this is the one moment the DEFENDER is asked anything
 *   before the attacker's dice fall. The point is spent on the answering client, which is the
 *   one that owns the defender or is the GM.
 */
export async function chooseDefenderDefense(targetActor, { attackerName, suggestedDefenseType }) {
  const payload = {
    actorUuid: targetActor.uuid,
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
      return normalizeAnswer(answer);
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
      return normalizeAnswer(answer);
    }
  }

  // Nobody available to actually make the call (same "an unattended request can't be acted on"
  // limit story-points.mjs's own requestStoryPointSpend already accepts) - the attacking weapon's
  // own suggested Defense is the least-arbitrary fallback available.
  return { defenseType: suggestedDefenseType, storyPointBoost: false };
}

/**
 * The answer as an object, whichever shape it came back in: a remote client that predates the
 * Story Point offer (or a test double) still answers with the bare Defense key.
 * @param {String|Object} answer
 * @returns {{defenseType: String, storyPointBoost: Boolean}}
 */
function normalizeAnswer(answer) {
  return typeof answer === "string" ? { defenseType: answer, storyPointBoost: false } : answer;
}

/**
 * Whether a Defense of this actor's carries a scene-long Story Point boost right now.
 *
 * My Little Pony's version of the spend - "+5 to any single Defense for the scene" (MLP CRB
 * p.118) - outlives the attack it was bought against, so it is recorded on the defender with the
 * scene it was bought in, and read back here for every later attack in that scene.
 * @param {Actor} actor
 * @param {String} defenseType
 * @returns {Boolean}
 */
export function hasSceneDefenseBoost(actor, defenseType) {
  const record = actor?.getFlag?.("essence20", SCENE_BOOST_FLAG);
  return !!record && record.defenseType === defenseType && record.epoch === getSceneEpoch();
}

/**
 * Shows the actual picker - a DialogV2 with one button per Defense, labeled with the target's own
 * current value for it, so whoever's answering (the defender's own player, ideally) can see
 * exactly what they're choosing between, matching RAW's own framing quoted above.
 * @param {Object} payload   See chooseDefenderDefense's own payload shape above.
 * @returns {Promise<String>}
 */
export async function promptDefenseChoice(payload) {
  // The Story Point offer is judged here, on the answering client: it is this client's own
  // ability to spend for the defender that matters, not the attacker's.
  const defender = payload.actorUuid ? await fromUuid(payload.actorUuid) : null;
  const canBoost = !!defender && canSpendForActor(defender);
  const line = getGameLine();

  const buttons = Object.entries(CONFIG.E20.defenses).map(([defenseType, label]) => ({
    label: `${game.i18n.localize(label)} (${payload.defenses[defenseType]})`,
    action: defenseType,
    default: defenseType == payload.suggestedDefenseType,
    callback: (event, button) => ({
      defenseType,
      storyPointBoost: canBoost && !!button.form?.elements?.storyPointBoost?.checked,
    }),
  }));

  const offer = canBoost
    ? `<label class="e20-defense-boost"><input type="checkbox" name="storyPointBoost" /> ${
      game.i18n.format(defenseBoostLastsScene(line) ? 'E20.SptDefenseBoostOfferScene' : 'E20.SptDefenseBoostOffer', {
        bonus: DEFENSE_BOOST,
      })}</label>`
    : "";

  const choice = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.format('E20.ChooseDefenseTitle', { actorName: payload.actorName }) },
    classes: ["window-app", "e20-window"],
    content: `<p>${game.i18n.format('E20.ChooseDefenseContent', {
      actorName: payload.actorName, attackerName: payload.attackerName,
    })}</p>${offer}`,
    modal: true,
    buttons,
  });

  const answer = choice?.defenseType
    ? choice
    : { defenseType: choice || payload.suggestedDefenseType, storyPointBoost: false };

  if (answer.storyPointBoost && defender) {
    await spendForActor(defender, 1, { announce: false });
    // A scene-long boost (My Little Pony) is remembered on the defender for the rest of the
    // scene; anywhere else it belongs to this one attack and is carried in the answer alone.
    if (defenseBoostLastsScene(line)) {
      await defender.setFlag("essence20", SCENE_BOOST_FLAG, { defenseType: answer.defenseType, epoch: getSceneEpoch() });
    }

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: defender }),
      content: game.i18n.format(defenseBoostLastsScene(line) ? 'E20.SptDefenseBoostSpentScene' : 'E20.SptDefenseBoostSpent', {
        name: defender.name,
        bonus: DEFENSE_BOOST,
        defense: game.i18n.localize(CONFIG.E20.defenses[answer.defenseType] ?? answer.defenseType),
      }),
    });
  }

  return answer;
}

registerRemotePrompt('chooseDefense', promptDefenseChoice);
