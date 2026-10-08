/**
 * Power Shield (PR CRB p.100): spending 1 Power summons a shield around one hand, giving "the wielder" a +2 armor bonus
 * to Toughness. It is a physical object that can be transferred to others, and lasts until the summoner returns to their
 * normal form.
 *
 * The shield is an Active Effect on whoever holds it, stamped with its summoner (flags.essence20.powerShield):
 *  - using the Power puts it on the summoner (onPowerUse), replacing any shield of theirs still out;
 *  - the chat card's button hands it to the targeted character (or one picked from the scene), taking it off the holder;
 *  - the summoner un-Morphing ends it, whoever has it.
 * The +2 goes to both the armor and the Morphed Toughness field: a Morphed character's Toughness reads only the Morphed
 * one, anyone else's only the armor, so the wielder gets +2 either way, once.
 */
import { registerChatButton } from "../../mechanics/item-hooks.mjs";

export const POWER_SHIELD_ID = "Compendium.essence20.pr_crb.Item.F7QPCcXW9822L5Xs";
export const SHIELD_FLAG = 'powerShield';
const BUTTON = 'powerShieldGive';

const T = (key, data) => (data ? game.i18n.format(`E20.${key}`, data) : game.i18n.localize(`E20.${key}`));

/** The shield's Active Effect data, for a summoner. Exported for tests. */
export function shieldEffectData(summoner, img = 'icons/svg/shield.svg') {
  return {
    name: T('PowerShieldName'),
    img,
    type: 'base',
    disabled: false,
    transfer: false,
    changes: [
      { key: 'system.defenses.toughness.armor', mode: 2, value: '2', priority: null },
      { key: 'system.defenses.toughness.morphed', mode: 2, value: '2', priority: null },
    ],
    flags: { essence20: { [SHIELD_FLAG]: { summoner: summoner.uuid, summonerName: summoner.name } } },
  };
}

/** Every actor that can hold a shield right now: world actors and the scene's unlinked tokens. */
function candidates() {
  const actors = [...(game.actors ?? [])];
  for (const token of canvas?.scene?.tokens ?? []) {
    if (!token.actorLink && token.actor) {
      actors.push(token.actor);
    }
  }

  return actors;
}

/** The shield effects this summoner has out: [{actor, effect}]. */
export function shieldsOf(summonerUuid, actors = candidates()) {
  const out = [];
  for (const actor of actors) {
    for (const effect of actor?.effects ?? []) {
      if (effect.flags?.essence20?.[SHIELD_FLAG]?.summoner == summonerUuid) {
        out.push({ actor, effect });
      }
    }
  }

  return out;
}

/** A GM writes for a player who doesn't own the actor. */
async function write(actor, method, ...args) {
  if (actor.isOwner) {
    return actor[method](...args);
  }

  const { relayToGm } = await import("../../mechanics/world/gm-relay.mjs");
  return relayToGm(actor, method, args);
}

/** Take every shield this summoner has out away. */
export async function dismissShields(summonerUuid) {
  for (const { actor, effect } of shieldsOf(summonerUuid)) {
    await write(actor, 'deleteEmbeddedDocuments', 'ActiveEffect', [effect.id]);
  }
}

/** Using the Power: the shield appears on the summoner (one at a time - an earlier one goes). */
export async function summonShield(summoner, item = null) {
  await dismissShields(summoner.uuid);
  await summoner.createEmbeddedDocuments('ActiveEffect', [shieldEffectData(summoner, item?.img)]);
  await postCard(summoner, summoner, 'PowerShieldSummoned');
}

async function postCard(holder, summoner, key) {
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: holder }),
    content: `<p>${T(key, { name: summoner.name, holder: holder.name })}</p>`
      + `<button type="button" data-e20-ext="${BUTTON}" data-summoner="${summoner.uuid}"><i class="fas fa-shield-halved"></i> ${T('PowerShieldGive')}</button>`,
  });
}

/** Who gets it: the one character targeted, else one picked from the scene. */
async function pickRecipient(holder) {
  const targeted = [...(game.user?.targets ?? [])].map(token => token.actor).filter(actor => actor && actor !== holder);
  if (targeted.length == 1) {
    return targeted[0];
  }

  const tokens = (canvas?.scene?.tokens ?? []).filter(token => token.actor && token.actor !== holder
    && ['playerCharacter', 'npc', 'companion'].includes(token.actor.type));
  const { chooseSelect } = await import("../../mechanics/resources/grants.mjs");
  const picked = await chooseSelect(T('PowerShieldName'), T('PowerShieldPick'), tokens.map(token => ({ value: token.uuid, label: token.name })));
  return picked ? tokens.find(token => token.uuid == picked)?.actor ?? null : null;
}

/**
 * Hand the shield on: off its current holder, onto the recipient.
 * @returns {Promise<Boolean>}
 */
export async function giveShield(summonerUuid, recipient = null) {
  const [held] = shieldsOf(summonerUuid);
  if (!held) {
    ui.notifications.warn(T('PowerShieldGone'));
    return false;
  }

  if (!held.actor.isOwner && !game.user?.isGM) {
    ui.notifications.warn(T('PowerShieldNotYours', { holder: held.actor.name }));
    return false;
  }

  const to = recipient ?? await pickRecipient(held.actor);
  if (!to || to === held.actor) {
    return false;
  }

  // Onto the recipient first, then off the holder - so the relay can still see who is passing it on.
  const data = held.effect.toObject();
  delete data._id;
  await write(to, 'createEmbeddedDocuments', 'ActiveEffect', [data]);
  await write(held.actor, 'deleteEmbeddedDocuments', 'ActiveEffect', [held.effect.id]);
  const summoner = await fromUuid(summonerUuid);
  await postCard(to, summoner ?? held.actor, 'PowerShieldGiven');
  return true;
}

registerChatButton(BUTTON, async (message, button) => {
  await giveShield(button.dataset.summoner);
});

// The summoner returns to their normal form: the shield is gone, whoever holds it. The active GM removes it (it may sit
// on actors the summoner's player doesn't own).
if (typeof Hooks != 'undefined') {
  Hooks.on('updateActor', (actor, changes) => {
    if (game.users?.activeGM?.isSelf && changes?.system?.isMorphed === false && shieldsOf(actor.uuid).length) {
      dismissShields(actor.uuid).then(() => ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }), content: `<p>${T('PowerShieldEnds', { name: actor.name })}</p>`,
      }));
    }
  });
}
