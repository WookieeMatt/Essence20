/**
 * Extra Health a participant has only while it is part of a Megaform: Core Body ("double this Zord's Health while in a
 * Megaform", PR CRB p.140; a Gigantic+ Combiner's Core Body, Enigma of Combination p.42), Layered Systems (+3, Across
 * the Stars p.105), Tenacious Bonds (+1 to every Zord, A Jump Through Time p.84) and MegaformHealth rules (Roller Drum).
 *
 * This used to be added to the Megaform's displayed Health only. Damage still landed on each participant's own Health,
 * so a Core Body Zord dropped at half its book Health, and a damaged one showed every point lost twice. Now:
 *  - each prep collects every participant's bonus (addParticipantBonus) and finishParticipantHealth builds the rows and
 *    totals from it: max = own max + bonus, current = own Health + whatever of the bonus is left;
 *  - damage dealt through the Megaform comes off that bonus first (absorbBonusHealth, from applyDamage, after every
 *    reduction), kept as how much of it is used on the Megaform's flags;
 *  - a participant leaving the roster takes nothing with it: its used amount is cleared (pruneBonusHealth).
 */

export const BONUS_TAKEN_FLAG = 'bonusHealthTaken';

const keyOf = actor => String(actor?.uuid || actor?.id || actor?.name || '').replace(/\./g, '_');
const bonuses = megaform => (megaform._e20BonusHealth ??= new Map());

/** Start of the Megaform's prep: no bonuses yet. */
export function resetParticipantBonuses(megaform) {
  megaform._e20BonusHealth = new Map();
}

/** Add `amount` extra Health to one participant for this prep. */
export function addParticipantBonus(megaform, participant, amount) {
  const value = Math.round(Number(amount) || 0);
  if (!megaform || !participant || !value) {
    return;
  }

  const key = keyOf(participant);
  bonuses(megaform).set(key, (bonuses(megaform).get(key) ?? 0) + value);
}

/** The participant's whole bonus this prep. */
export function bonusOf(megaform, participant) {
  return megaform?._e20BonusHealth?.get(keyOf(participant)) ?? 0;
}

/** How much of the bonus damage has used up. */
export function bonusTaken(megaform, participant) {
  return Math.max(0, Number(megaform?.flags?.essence20?.[BONUS_TAKEN_FLAG]?.[keyOf(participant)]) || 0);
}

/** What is left of the participant's bonus. */
export function bonusLeft(megaform, participant) {
  return Math.max(0, bonusOf(megaform, participant) - bonusTaken(megaform, participant));
}

/**
 * End of the Megaform's prep: each row is the participant's own Health plus its bonus, and the totals follow.
 * @param {Actor} megaform
 * @param {Actor[]} participants   In the same order as system.participantHealth
 */
export function finishParticipantHealth(megaform, participants) {
  const system = megaform?.system;
  if (!system || !participants?.length) {
    return;
  }

  let max = 0;
  let value = 0;
  system.participantHealth = participants.map(participant => {
    const own = participant.system?.health ?? {};
    const row = {
      name: participant.name,
      max: (Number(own.max) || 0) + bonusOf(megaform, participant),
      value: Math.max(0, Number(own.value) || 0) + bonusLeft(megaform, participant),
    };
    max += row.max;
    value += row.value;
    return row;
  });

  system.combinedHealthMax = max;
  system.combinedHealthValue = value;
  if (system.health) {
    system.health.max = max + (Number(system.health.bonus) || 0);
    system.health.value = value;
  }
}

/**
 * Damage landing on a participant through its Megaform: the bonus soaks it first. Writes the Megaform's flag.
 * @returns {Promise<Number>}   How much was soaked
 */
export async function absorbBonusHealth(megaform, participant, amount) {
  const soaked = Math.min(bonusLeft(megaform, participant), Math.max(0, Number(amount) || 0));
  if (soaked > 0) {
    const taken = bonusTaken(megaform, participant) + soaked;
    const update = { [`flags.essence20.${BONUS_TAKEN_FLAG}.${keyOf(participant)}`]: taken };
    const { needsGmRelay, relayToGm } = await import("../world/gm-relay.mjs");
    await (needsGmRelay(megaform) ? relayToGm(megaform, 'update', [update]) : megaform.update(update));
  }

  return soaked;
}

/** The roster changed: a participant no longer in it keeps no used bonus. Returns the update, or null. */
export function pruneBonusHealth(megaform, roster) {
  const taken = megaform?.flags?.essence20?.[BONUS_TAKEN_FLAG] ?? {};
  const present = new Set(roster.map(keyOf));
  const gone = Object.keys(taken).filter(key => !present.has(key));
  return gone.length ? Object.fromEntries(gone.map(key => [`flags.essence20.${BONUS_TAKEN_FLAG}.-=${key}`, null])) : null;
}
