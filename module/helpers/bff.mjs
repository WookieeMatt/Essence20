import { worldActors } from "./companion-link.mjs";
import { getSceneEpoch } from "./scene-clock.mjs";

/**
 * Best Friends Forever (MLP CRB, Spirit of Loyalty, p.90-91).
 *
 * BFF (3rd level): "designate a number of ponies equal to your Social Essence Score as your Best
 * Friend Forever ... You can Lend Assistance to a BFF as a Free action once per round. If you aren't
 * qualified to Lend Assistance ... you can spend a Friendship Point to Lend Assistance anyway."
 *
 * - The BFF Perk's Use button picks the BFFs (flags.essence20.bffs on the pony).
 * - The Free-action assist is a cost rule in helpers/action-perks.mjs; the Friendship Point to assist
 *   unqualified is offered by helpers/lend-assistance.mjs.
 * - About Twenty-Percent Cooler, Leave It To Me and That's What Best Friends Are For read the list.
 */

const uuid = id => `Compendium.essence20.mlp_crb.Item.${id}`;
export const BFF = {
  bff: uuid('b7qT0W4L9Ito2EB2'),
  twentyPercentCooler: uuid('IeOmY0keh5oD2n3l'),
  leaveItToMe: uuid('DzxvaaVz47CVyKhF'),
  bestFriendsAreFor: uuid('WVcMWLcsMX4u9pY3'),
};

const LIST_FLAG = 'bffs';
const FAIL_FLAG = 'failedOnTurn';
const COOLER_FLAG = 'twentyPercentCoolerUses';
const T = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource;
}

function has(actor, id) {
  const items = actor?.items;
  const list = Array.isArray(items?.contents) ? items.contents : (items && typeof items[Symbol.iterator] == 'function' ? [...items] : []);
  return list.some(item => sourceOf(item) == id);
}

export function isBffUse(item) {
  return sourceOf(item) == BFF.bff;
}

export function bffsOf(actor) {
  const list = actor?.flags?.essence20?.[LIST_FLAG];
  return Array.isArray(list) ? list : [];
}

export function isBff(actor, other) {
  return !!other && has(actor, BFF.bff) && bffsOf(actor).includes(other.uuid);
}

/**
 * The BFF Perk's Use button: pick up to Social Essence ponies.
 */
export async function chooseBffs(actor) {
  const max = Number(actor.system?.essences?.social?.max ?? actor.system?.essences?.social?.value) || 1;
  const candidates = worldActors().filter(a => a.type == 'playerCharacter' && a.uuid != actor.uuid);
  const chosen = bffsOf(actor);
  const rows = candidates.map(a => `<label class="flexrow"><input type="checkbox" name="bff" value="${a.uuid}" ${chosen.includes(a.uuid) ? 'checked' : ''}/> ${foundry.utils.escapeHTML(a.name)}</label>`).join('');
  const picked = await foundry.applications.api.DialogV2.wait({
    window: { title: T('E20.BffTitle') },
    classes: ["window-app", "e20-window"],
    content: `<p>${T('E20.BffPrompt', { max })}</p>${rows}`,
    buttons: [
      { action: 'ok', label: T('E20.DialogConfirmButton'), default: true,
        callback: (event, button) => [...button.form.querySelectorAll('input[name="bff"]:checked')].map(input => input.value) },
      { action: 'cancel', label: T('E20.DialogCancelButton') },
    ],
    rejectClose: false,
  });
  if (!Array.isArray(picked)) {
    return null;
  }

  const list = picked.slice(0, max);
  await actor.setFlag('essence20', LIST_FLAG, list);
  const names = list.map(id => globalThis.fromUuidSync?.(id)?.name).filter(Boolean).join(', ');
  return T('E20.BffChosen', { name: actor.name, names: names || T('E20.None') });
}

/* -------------------------------------------- */
/*  About Twenty-Percent Cooler                  */
/* -------------------------------------------- */

/**
 * About Twenty-Percent Cooler (7th): "Three times per day, you can take a free upshift ↑1 to any Skill
 * one of your BFFs has at d4 or higher (whether they are present or not)." Offered in the Roll
 * Options Dialog; a Rest gives the three back.
 */
export function coolerAvailable(actor, skill) {
  if (!has(actor, BFF.twentyPercentCooler) || (Number(actor.flags?.essence20?.[COOLER_FLAG]) || 0) >= 3) {
    return false;
  }

  const list = CONFIG.E20?.skillShiftList ?? [];
  return bffsOf(actor).some(id => {
    const shift = globalThis.fromUuidSync?.(id)?.system?.skills?.[skill]?.shift;
    return shift && list.indexOf(shift) <= list.indexOf('d4');
  });
}

export async function spendCooler(actor) {
  await actor.setFlag('essence20', COOLER_FLAG, (Number(actor.flags?.essence20?.[COOLER_FLAG]) || 0) + 1);
}

export async function restBff(actor) {
  if (actor?.flags?.essence20?.[COOLER_FLAG]) {
    await actor.unsetFlag('essence20', COOLER_FLAG);
  }
}

/* -------------------------------------------- */
/*  Leave It To Me                               */
/* -------------------------------------------- */

function roundStamp() {
  const combat = game?.combat;
  return combat ? { combatId: combat.id, round: combat.round } : { scene: getSceneEpoch() };
}

/**
 * Note a failed Skill Test made on the roller's own turn - Leave It To Me reads it.
 * @param {Actor} actor
 * @param {String} skill
 */
export async function noteFailure(actor, skill) {
  if (!actor || !skill) {
    return;
  }

  const ownTurn = !game?.combat || game.combat.combatant?.actor?.id == actor.id;
  if (ownTurn) {
    await actor.setFlag('essence20', FAIL_FLAG, { skill, ...roundStamp(), id: foundry.utils.randomID() });
  }
}

function recent(record) {
  const combat = game?.combat;
  if (!record) {
    return false;
  }

  if (combat) {
    return record.combatId == combat.id && combat.round - record.round <= 1;
  }

  return record.scene == getSceneEpoch();
}

/**
 * Leave It To Me (13th): "if one of your BFFs fails a Skill Test on their turn, you get Edge on a
 * Skill Test to try the same action on your turn." The same Skill, this round or the last.
 * @returns {Object|null}   The failure it answers, to consume.
 */
export function leaveItToMeFailure(actor, skill) {
  if (!has(actor, BFF.leaveItToMe)) {
    return null;
  }

  const used = actor.flags?.essence20?.leaveItToMeUsed ?? [];
  for (const id of bffsOf(actor)) {
    const record = globalThis.fromUuidSync?.(id)?.flags?.essence20?.[FAIL_FLAG];
    if (record && record.skill == skill && recent(record) && !used.includes(record.id)) {
      return record;
    }
  }

  return null;
}

export async function consumeLeaveItToMe(actor, record) {
  await actor.setFlag('essence20', 'leaveItToMeUsed', [...(actor.flags?.essence20?.leaveItToMeUsed ?? []).slice(-10), record.id]);
}

/* -------------------------------------------- */
/*  That's What Best Friends Are For             */
/* -------------------------------------------- */

/**
 * That's What Best Friends Are For (11th): "if you Lend Assistance to a BFF as a Standard action, you
 * gain a Friendship Point." Not for the Free-action assist BFF gives.
 * @param {Actor} actor
 * @param {Actor} ally
 * @param {Boolean} wasFree
 */
export async function onAssistedBff(actor, ally, wasFree) {
  if (!wasFree && isBff(actor, ally) && has(actor, BFF.bestFriendsAreFor)) {
    const { requestStoryPointGrant } = await import("./story-points.mjs");
    await requestStoryPointGrant(actor);
  }
}
