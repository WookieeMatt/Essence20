import { registerDerived, registerHitRider, registerRollSources } from "../../extensions.mjs";
import { ruleBrawnBonus } from "../../../rules/ext/c/brawn.mjs";

/**
 * Armor and armor-upgrade rules for the data1 slice of the Item Review:
 * - Brawn requirements on battledress (Tanker Armor, Marauder Armor).
 * - Reinforced Shell's Alt Mode / Bot Mode split (Technorganic Secrets p.49).
 */

export const REINFORCED_SHELL = "Compendium.essence20.technorganic_secrets.Item.GQt4IlyXGHCbLxNP";

const T = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource ?? null;
}

function itemsOf(actor) {
  const items = actor?.items;
  if (!items) {
    return [];
  }

  return Array.isArray(items) ? items : (items.contents ?? [...items]);
}

/* -------------------------------------------- */
/*  Brawn requirement                            */
/* -------------------------------------------- */

// Ordered lowest to highest - the same ladder as CONFIG.E20.weaponRequirementShiftLadder, with an
// untrained d20 (and anything worse) sitting below d2.
const BRAWN_LADDER = ["none", "d2", "d4", "d6", "d8", "d10", "d12", "2d8", "3d6"];

function ladderIndex(shift) {
  if (['autoSuccess', 'criticalSuccess'].includes(shift)) {
    return BRAWN_LADDER.length - 1;
  }

  const index = BRAWN_LADDER.indexOf(shift);
  return index < 0 ? 0 : index;
}

/**
 * Die sizes the actor's Brawn counts as higher for an armor requirement - Infinity to ignore it. The Perks that
 * bend it (Over Brawn, The Heavy, Pack Mule) carry BrawnRequirement rules (rules/ext/c/brawn.mjs).
 */
export function brawnRequirementBonus(actor) {
  return ruleBrawnBonus(actor, 'requirement');
}

/**
 * How many die sizes of Brawn the actor lacks for this armor's printed Brawn requirement - GI Joe
 * CRB, Brawn (p.117): "If you don't meet the equipment's Brawn requirement, you suffer a ↓1 shift
 * when using it for each die size you don't possess." Tanker Armor (Brawn d2) and Marauder Armor
 * (Brawn d4) print theirs in Table 8-5 (p.154-155); armor has no requirements field, so the pack
 * carries it as flags.essence20.brawnRequirement.
 * @param {Actor} actor
 * @param {Item} armor
 * @returns {Number}
 */
export function brawnShortfall(actor, armor) {
  const required = armor?.flags?.essence20?.brawnRequirement;
  if (!required || required == 'none') {
    return 0;
  }

  const has = actor?.system?.skills?.brawn?.shift ?? 'd20';
  return Math.max(0, ladderIndex(required) - ladderIndex(has) - brawnRequirementBonus(actor));
}

/**
 * Worn battledress the actor is too weak for. "When using it" for armor is read as the physical
 * actions it encumbers: Strength- and Speed-based Skill Tests and every attack. Each armor is its
 * own dialog line, so a GM who reads it more narrowly can untick it.
 */
export function brawnRequirementSources(actor, ctx = {}) {
  const physical = ctx.isAttack || ['strength', 'speed'].includes(ctx.rolledEssence);
  if (!physical) {
    return [];
  }

  return itemsOf(actor)
    .filter(item => item.type == 'armor' && item.system?.equipped && !item.system?.isPowerArmor)
    .map(armor => ({ armor, shortfall: brawnShortfall(actor, armor) }))
    .filter(entry => entry.shortfall > 0)
    .map(({ armor, shortfall }) => ({
      id: `d1BrawnReq-${armor.id}`,
      label: T('E20.D1BrawnRequirement', { name: armor.name, req: armor.flags.essence20.brawnRequirement }),
      shiftDown: shortfall,
    }));
}

registerRollSources((actor, target, ctx) => ({ sources: brawnRequirementSources(actor, ctx) }));

/* -------------------------------------------- */
/*  Reinforced Shell                             */
/* -------------------------------------------- */

/**
 * Reinforced Shell (Technorganic Secrets, Armor Upgrades, p.49): "Alt Mode: Your shell acts as a
 * shield, providing +2 deflection bonus to Toughness. Bot Mode: Your shell enhances your close
 * combat capabilities. Increase your Unarmed Combat attack's Stun effect by 1."
 *
 * The pack carries the +2 as the upgrade's own armorBonus, which documents/actor.mjs#_prepareDefenses
 * counts in either mode (a loose alt-mode upgrade, or one attached to worn armor). This takes it back
 * out while the actor isn't transformed.
 * @returns {Item|null}   The counted shell, if any.
 */
export function countedShell(actor) {
  return itemsOf(actor).find(item => {
    if (item.type != 'upgrade' || sourceOf(item) != REINFORCED_SHELL) {
      return false;
    }

    const parentId = item.flags?.essence20?.parentId;
    if (parentId) {
      const parent = actor.items?.get?.(parentId);
      return parent?.type == 'armor' && !!parent.system?.equipped;
    }

    return !!(actor.system?.canTransform || item.flags?.essence20?.alterationWorn);
  }) ?? null;
}

export function applyShellMode(actor) {
  const system = actor?.system;
  const toughness = system?.defenses?.toughness;
  if (!toughness || system.isTransformed || system.isMorphed) {
    return;
  }

  const shell = countedShell(actor);
  if (!shell) {
    return;
  }

  const value = Number(shell.system?.armorBonus?.value) || 0;
  if (!value) {
    return;
  }

  toughness.total -= value;
  if (typeof toughness.string == 'string') {
    toughness.string += ` - ${value} (${T('E20.D1ShellBotMode', { name: shell.name })})`;
  }
}

registerDerived(applyShellMode);

/** Bot Mode: +1 to an Unarmed attack's Stun. */
export function shellStunBonus(actor, rider) {
  if (!rider?.isUnarmed || rider.damageType != 'stun' || actor?.system?.isTransformed) {
    return null;
  }

  const shell = itemsOf(actor).find(item => item.type == 'upgrade' && sourceOf(item) == REINFORCED_SHELL);
  return shell ?? null;
}

registerHitRider((actor, target, result, rider, tools) => {
  const shell = shellStunBonus(actor, rider);
  if (shell) {
    tools.damageBonusNote(result, 1, shell.name);
  }
});
