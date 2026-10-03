/**
 * Shared bits for the "other3" extension slice (Item Review 2026-09-28): the compendium uuids this
 * slice keys on and small Foundry wrappers. Imports nothing heavy (helpers/extensions.mjs's
 * import-cycle note) - dice/target-riders/combat are always pulled in lazily by the callers.
 */
import { hasSourced, worldActors } from "../../companion-link.mjs";

const C = pack => `Compendium.essence20.${pack}.Item.`;

export const O3 = {
  // My Little Pony CRB
  betrayal: `${C('mlp_crb')}fhne6x3suULZL040`,
  dabbler: `${C('mlp_crb')}Tnr6LTI2yBHUxC7r`,
  selfImprovement: `${C('mlp_crb')}COOAlcYNeoScFiAE`,
  // Power Rangers
  followMe: `${C('pr_crb')}ALq37Ch25nKvZ454`,
  betterTogether: `${C('through_the_shattered_grid')}tOoyMHVtV6wjvlxd`,
  guardianBlast: `${C('through_the_shattered_grid')}GuardianBlast000`,
  megaDefender: `${C('through_the_shattered_grid')}rZjP9CN55D5qKW0s`,
  metallicArmor: `${C('through_the_shattered_grid')}LotTM0zOcCBLkki4`,
  solarixShard: `${C('through_the_shattered_grid')}jPqr2DuJMSQgiILp`,
  voidTouched: `${C('through_the_shattered_grid')}NHH2nlllyFMBOB38`,
  // G.I. Joe
  holographicSights: `${C('quartermasters_guide_to_gear')}aapIJuPKyMaGjb4U`,
  // Transformers
  scrambleField: `${C('technorganic_secrets')}cIki3qTlr4gZed5f`,
  againAndAgain: `${C('enigma_of_combination')}EmL1IgnaX55NTMve`,
  balanceAndCompensation: `${C('enigma_of_combination')}T0TFdu4HRK8Eh0u0`,
  bumpAndRun: `${C('enigma_of_combination')}4eA2ktw0cfdYV6Fs`,
  emLining: `${C('enigma_of_combination')}SIGEfpjEe1H06dVM`,
  perfectPlacement: `${C('enigma_of_combination')}wueeFv0eN8eh7RbS`,
  preciseChronometrics: `${C('enigma_of_combination')}Q6G07IGoYXAcoRzF`,
  puissance: `${C('enigma_of_combination')}N8nkrj2hSrLv9NFP`,
  hiddenInPlainSight: `${C('tf_crb')}tKpYLu7ml5czsMqq`,
  nowYouDont: `${C('tf_crb')}iW9TjN9X6SsYm2Ql`,
  overchargeEngines: `${C('tf_crb')}BPHwAfGvLPZuJ1m1`,
  multiplication: `${C('tf_crb')}K3FNcAMjjek1UaJk`,
  popOut: `${C('tf_crb')}xAAzOb9sYmEN7qmv`,
  samePrinciple: `${C('tf_crb')}GTUn1LOxb3D4FgHF`,
  telltaleSign: `${C('tf_crb')}LM5pwZWroo1QKrSN`,
  // Welcome to Night Vale
  glutenTolerant: `${C('wtnv_citizens_guide')}dzYRdi2cSlZSHozs`,
  gravityOptional: `${C('wtnv_citizens_guide')}F5mrzupd6TG2kj3x`,
  weird: `${C('wtnv_citizens_guide')}RO0a3eX8MIo5g1Tv`,
};

export const T = (key, data) => (data ? game.i18n.format(`E20.${key}`, data) : game.i18n.localize(`E20.${key}`));

export function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource ?? '';
}

/** The last segment of a compendium uuid (the item _id), matching reprints across packs. */
export function idOf(uuid) {
  return String(uuid ?? '').split('.').pop();
}

export function isItem(item, uuid) {
  const source = sourceOf(item);
  return !!source && !!uuid && source == uuid;
}

export function itemsOf(actor) {
  const items = actor?.items;
  if (!items) {
    return [];
  }

  return Array.isArray(items.contents) ? items.contents : (typeof items[Symbol.iterator] == 'function' ? [...items] : []);
}

export function has(actor, uuid) {
  return !!uuid && !!actor && hasSourced(actor, uuid);
}

export function findItem(actor, uuid) {
  return itemsOf(actor).find(item => isItem(item, uuid)) ?? null;
}

export function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export { worldActors };

/** The weapon a weaponEffect belongs to, if any. */
export function parentWeaponOf(actor, effect) {
  const id = effect?.flags?.essence20?.parentId;
  const parent = id ? (actor?.items?.get?.(id) ?? itemsOf(actor).find(item => item.id == id)) : null;
  return parent?.type == 'weapon' ? parent : null;
}

/** Upgrades attached to a weapon or armor. */
export function attachedUpgrades(actor, parent) {
  return parent ? itemsOf(actor).filter(item => item.type == 'upgrade' && item.flags?.essence20?.parentId == parent.id) : [];
}

export function tokenOf(actor) {
  return actor?.getActiveTokens?.()?.[0] ?? null;
}

export function dispositionOf(actor) {
  return tokenOf(actor)?.document?.disposition ?? actor?.prototypeToken?.disposition ?? null;
}

/** Same side of the fight (token disposition), the reading helpers/allies.mjs uses. */
export function sameSide(a, b) {
  if (!a || !b) {
    return false;
  }

  if (a === b || a.uuid == b.uuid) {
    return true;
  }

  const da = dispositionOf(a);
  return da != null && da == dispositionOf(b);
}

/** The targeted actors on this client. */
export function targetedActors() {
  return [...(game.user?.targets ?? [])].map(token => token?.actor).filter(Boolean);
}

/** "Until the end of your next turn" as a combat stamp; null out of combat. */
export function untilEndOfNextTurn(actor) {
  const combat = game?.combat;
  if (!combat) {
    return null;
  }

  const index = (combat.turns ?? []).findIndex(c => c.actor?.id == actor?.id);
  return { combatId: combat.id, round: combat.round + 1, turn: index < 0 ? combat.turn : index };
}

/** Whether a stamp from untilEndOfNextTurn is still running. A null stamp never expires here. */
export function stampLive(stamp) {
  if (!stamp) {
    return true;
  }

  const combat = game?.combat;
  if (!combat || combat.id != stamp.combatId) {
    return false;
  }

  return combat.round < stamp.round || (combat.round == stamp.round && combat.turn <= stamp.turn);
}

/** This combat's current turn, as a comparable stamp. */
export function turnStamp() {
  const combat = game?.combat;
  return combat ? { combatId: combat.id, round: combat.round, turn: combat.turn } : null;
}

export function sameTurn(a, b) {
  return !!a && !!b && a.combatId == b.combatId && a.round == b.round && a.turn == b.turn;
}

/**
 * Write to an actor this user may not own: directly when allowed, else through the GM relay (which
 * only accepts writes to a targeted token's actor - the callers target first).
 */
export async function writeActor(actor, method, args) {
  const { needsGmRelay, relayToGm } = await import("../../gm-relay.mjs");
  if (needsGmRelay(actor)) {
    return relayToGm(actor, method, args);
  }

  await actor[method](...args);
  return true;
}

export async function say(actor, content) {
  return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content });
}

export function escape(text) {
  return foundry.utils?.escapeHTML ? foundry.utils.escapeHTML(String(text ?? '')) : String(text ?? '');
}

/** The actor the clicking user speaks for: a controlled token, else their assigned character. */
export function myActor() {
  return canvas?.tokens?.controlled?.[0]?.actor ?? game.user?.character ?? null;
}

/**
 * Roll a Skill Test the ordinary way and hand back its total (and success, when a DIF is given).
 * @returns {Promise<{total: Number|null, success: Boolean, crit: Boolean}|null>}
 */
export async function rollSkillTotal(actor, skill, { dif = null, extra = {} } = {}) {
  const essence = CONFIG.E20?.skillToEssence?.[skill] ?? 'smarts';
  const fields = actor?.system?.skills?.[skill] ?? {};
  const result = await actor?._dice?.rollSkill({
    rollType: 'skill', skill, essence: essence == 'any' ? 'smarts' : essence, shift: fields.shift,
    shiftUp: fields.shiftUp ?? 0, shiftDown: fields.shiftDown ?? 0, isSpecialized: fields.isSpecialized,
    ...(dif != null ? { dif: String(dif) } : {}), ...extra,
  }, actor);
  if (!result) {
    return null;
  }

  const outcome = result.outcomes?.[0];
  const total = outcome?.roll?.total ?? outcome?.total ?? null;
  const first = outcome?.results?.[0];
  return { total, success: !!result.success, crit: !!first && first.multiplier >= 2 };
}
