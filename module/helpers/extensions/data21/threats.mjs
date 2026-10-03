import { registerDefenseAdjust, registerDerived, registerRollSources } from "../../extensions.mjs";
import { D21, findSourced, itemsOf, sourceOf } from "./common.mjs";

/**
 * Finster's Monster-Matic Cookbook's new rules (p.7):
 * - "Larger Than Life: This perk allows the Game Master to treat imposing figures as whichever size
 *   best fits the narrative (usually Common or Large) ... These characters benefit from the Reach of a
 *   Large creature despite the chosen size."
 * - "Non-Mystical: A target is Non-Mystical if they do not possess Magical artifacts, the Mystic
 *   trait, Sorcerous Powers, Supernatural Perks, or by clarification of the GM." Read by the Mystic
 *   perk (Zen-Aku's stat block: "Some of Zen-Aku's Attacks and Powers are Mystical in nature ... ignore any
 *   armor bonuses to Toughness and gain ↑1 dice shift versus Non-Mystical targets") - every attack
 *   of a Mystic holder counts, since the system can't tell which printed attacks were "noted".
 *   The GM's clarification is flags.essence20.d21Mystical (true/false) on the actor.
 * - Sorcerous Tremors (p.274): "Effect: DIF 12 Culture (Arcane) as a Standard action to recreate the
 *   effects of the Power Quake Grid Power." Power Quake (PR CRB p.100): "a tremor out in a 15' radius
 *   ... Every creature or vehicle caught in the area must pass a Athletics or Acrobatics Skill Test
 *   or be knocked Prone. The DIF for this test is equal to 12 plus 3 for each Power spent." The
 *   Sorcery's own 2-point cost replaces the Personal Power, so the caster picks the strength (1-3).
 */

/* -------------------------------------------- */
/*  Larger Than Life                             */
/* -------------------------------------------- */

export function largerThanLifeReach(actor) {
  if (!findSourced(actor, D21.largerThanLife)) {
    return;
  }

  const large = Number(CONFIG.E20?.actorReach?.large) || 5;
  for (const effect of itemsOf(actor)) {
    const system = effect.system;
    if (effect.type != 'weaponEffect' || system?.classification?.style != 'melee' || !Number.isFinite(Number(system?.totalReach))) {
      continue;
    }

    const multiplier = Math.max(1, Number(system.range?.reachMultiplier) || 1);
    system.totalReach = Math.max(Number(system.totalReach), large * multiplier);
  }
}

registerDerived(largerThanLifeReach);

/* -------------------------------------------- */
/*  Mystic / Non-Mystical                        */
/* -------------------------------------------- */

export function isMystical(actor) {
  const override = actor?.flags?.essence20?.d21Mystical;
  if (override === true || override === false) {
    return override;
  }

  return itemsOf(actor).some(item => {
    const source = sourceOf(item);
    return source == D21.mystic || source == D21.sorcery
      || (item.type == 'power' && item.system?.type == 'sorcerous')
      || (Array.isArray(item.system?.traits) && item.system.traits.includes('sorcerous'));
  });
}

export const isNonMystical = actor => !!actor && !isMystical(actor);

export function mysticSources(actor, target, { isAttack } = {}) {
  const mystic = findSourced(actor, D21.mystic);
  if (!mystic || !isAttack || !target || !isNonMystical(target)) {
    return { sources: [] };
  }

  return { sources: [{ id: 'd21Mystic', label: mystic.name, shiftUp: 1 }] };
}

export function mysticDefense(attacker, defender, defenseType) {
  if (defenseType != 'toughness' || !findSourced(attacker, D21.mystic) || defender?.statuses?.has?.('armorStripped')) {
    return 0;
  }

  const defense = defender?.system?.defenses?.toughness;
  const armor = Number(defender?.system?.isMorphed ? defense?.morphed : defense?.armor) || 0;
  return -armor;
}

registerRollSources(mysticSources);
registerDefenseAdjust(mysticDefense);
