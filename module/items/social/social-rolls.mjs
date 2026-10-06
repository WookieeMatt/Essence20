import { companionDefenseBonus, companionRollSources } from "../../mechanics/companions/companions.mjs";
import { commandDefenseBonus, commandSources } from "../../mechanics/actions/commands.mjs";
import { bondDamageBonus, bondDefenseAdjust, bondRollSources, bondSpecializes, synapticEdgeAvailable } from "../../mechanics/companions/bonded-partners.mjs";
import { coolerAvailable, leaveItToMeFailure } from "./best-friends-forever.mjs";
import { rightHandsDefense, rightHandsShieldSnag, rightHandsSources } from "../../mechanics/actions/team-actions.mjs";
import { COMP } from "../../mechanics/companions/companion-uses.mjs";
import { ownerOf } from "../../mechanics/companions/companion-link.mjs";

/**
 * Everything the companion, command, bond, BFF and team Perks add to a roll, gathered in one place so
 * dice.mjs and mechanics/combat/target-riders.mjs each call one function:
 * - socialRollSources   ↑/↓/Edge/Snag sources, listed in the Roll Options Dialog.
 * - socialDefenseAdjust the defender's Defense when attacked.
 * - socialDialogFlags / applySocialDialog   the dialog's own choices (Synaptic Linkage, About
 *   Twenty-Percent Cooler).
 * - socialSpecializes   Bonded Proficiency.
 * - socialDamageBonus   Targetmaster's +1.
 */

const T = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource;
}

function has(actor, id) {
  const items = actor?.items;
  const list = Array.isArray(items?.contents) ? items.contents : (items && typeof items[Symbol.iterator] == 'function' ? [...items] : []);
  return list.some(item => sourceOf(item) == id);
}

/**
 * @param {Actor} actor   The roller.
 * @param {Actor|null} target
 * @param {Object} ctx   {item, rolledSkill, isAttack, isShove, weaponId}
 * @returns {{sources: Array<Object>, consumes: Array<Object>}}
 */
export function socialRollSources(actor, target, ctx = {}) {
  const sources = [];
  const consumes = [];
  const { item, rolledSkill, isAttack, isShove } = ctx;
  const weaponId = item?.flags?.essence20?.parentId ?? null;
  const isRanged = isAttack && item?.system?.classification?.style && item.system.classification.style != 'melee';
  const add = source => sources.push({ ...source, id: `social-${source.id}` });

  for (const source of companionRollSources(actor, target, { rolledSkill, isAttack })) {
    add(source);
    if (source.consume) {
      consumes.push({ actorUuid: actor.uuid, companionKey: source.consume });
    }
  }

  bondRollSources(actor, target, { rolledSkill, isAttack, weaponId }).forEach(add);
  commandSources(actor, { rolledSkill, isAttack, isRanged }).forEach(add);
  rightHandsSources(actor, { rolledSkill, isShove }).forEach(add);

  // Handheld Shield (In The Right Hands): "Impose Snag on first attack targeting wielder each turn."
  if (isAttack && target && rightHandsShieldSnag(target)) {
    add({ id: 'rightHandsShield', label: T('E20.RightHands.shield'), shiftUp: 0, shiftDown: 0, edge: false, snag: true });
    consumes.push({ actorUuid: target.uuid, rightHandsShield: true });
  }

  // Let's Bring 'Em Together!'s combined attack: "an additional ↑2 to hit".
  const bonus = Number(item?.flags?.essence20?.bonusShiftUp) || 0;
  if (bonus) {
    add({ id: 'bonusShift', label: item.name, shiftUp: bonus, shiftDown: 0, edge: false, snag: false });
  }

  // Leave It To Me: a BFF failed this Skill on their turn.
  const failure = rolledSkill ? leaveItToMeFailure(actor, rolledSkill) : null;
  if (failure) {
    add({ id: 'leaveItToMe', label: T('E20.LeaveItToMe'), shiftUp: 0, shiftDown: 0, edge: true, snag: false });
    consumes.push({ actorUuid: actor.uuid, leaveItToMe: failure });
  }

  return { sources, consumes };
}

/**
 * @param {Actor} attacker
 * @param {Actor} defender
 * @param {String} defense
 * @returns {Number}
 */
export function socialDefenseAdjust(attacker, defender, defense) {
  return companionDefenseBonus(defender, defense) + commandDefenseBonus(defender, defense, attacker) + bondDefenseAdjust(defender, defense);
}

/**
 * Defense bonuses that sit on the actor all the time - In The Right Hands' Body Armor Segment - for
 * documents/actor.mjs.
 */
export function socialStandingDefense(actor, defense) {
  return rightHandsDefense(actor, defense);
}

export function socialSpecializes(actor, skill) {
  return bondSpecializes(actor, skill);
}

export function socialDamageBonus(actor, weaponId) {
  return bondDamageBonus(actor, weaponId);
}

/**
 * Acid Sacs (WTNV Animal Perk): "Your pet's attacks deal 1 Acid damage in addition to their main
 * weapon." A second damage option on each hit.
 */
export function acidSacsDamage(actor) {
  const owner = ownerOf(actor);
  return actor?.type == 'companion' && (has(actor, COMP.acidSacs) || (owner && has(owner, COMP.acidSacs) && actor.system?.type == 'pet')) ? 1 : 0;
}

/** The dialog's choices. */
export function socialDialogFlags(actor, rolledSkill) {
  const flags = {};
  if (rolledSkill && synapticEdgeAvailable(actor, rolledSkill) && (actor.flags?.essence20?.synapticEdgeScene == null || actor.flags.essence20.synapticEdgeScene != currentScene())) {
    flags.synapticEdgeAvailable = true;
  }

  if (rolledSkill && coolerAvailable(actor, rolledSkill)) {
    flags.twentyPercentCoolerAvailable = true;
  }

  return flags;
}

function currentScene() {
  try {
    return game.settings.get('essence20', 'sceneClockScene');
  } catch (error) {
    return null;
  }
}

/**
 * What the dialog's choices do, once it closes.
 * @param {Actor} actor
 * @param {Object} options   The dialog's result (mutated).
 */
export async function applySocialDialog(actor, options) {
  if (options.applySynapticEdge) {
    options.edge = !options.snag;
    options.snag = false;
    await actor.setFlag('essence20', 'synapticEdgeScene', currentScene());
  }

  if (options.applyTwentyPercentCooler) {
    options.shiftUp = (options.shiftUp ?? 0) + 1;
    const { spendCooler } = await import("./best-friends-forever.mjs");
    await spendCooler(actor);
  }
}

/**
 * The once-per-something sources a roll used, spent once it goes ahead - from applyRollRiders.
 */
export async function consumeSocial(consume) {
  const holder = consume?.actorUuid ? await fromUuid(consume.actorUuid) : null;
  if (!holder) {
    return;
  }

  if (consume.companionKey) {
    const { consumeCompanionSource } = await import("../../mechanics/companions/companions.mjs");
    await consumeCompanionSource(holder, consume.companionKey);
  }

  if (consume.rightHandsShield) {
    const { markRightHandsShield } = await import("../../mechanics/actions/team-actions.mjs");
    await markRightHandsShield(holder);
  }

  if (consume.leaveItToMe) {
    const { consumeLeaveItToMe } = await import("./best-friends-forever.mjs");
    await consumeLeaveItToMe(holder, consume.leaveItToMe);
  }
}
