import {
  registerApplyDialog, registerConsumer, registerDerived, registerDialogToggles, registerRollSources, registerUse,
} from "../../extensions.mjs";
import { hasSourced } from "../../companion-link.mjs";
import { getUses, markUsed } from "../../scene-clock.mjs";
import { getNearbyAllyTokens } from "../../allies.mjs";
import {
  G1, T, actorFromUuid, firstTarget, isFrom, isStampActive, itemsOf, turnStamp, wornUpgrade,
} from "./shared.mjs";

/**
 * Cobra Codex gear: the Battledress upgrades Anonymous, Ceremonial and Uniform (Table 3-5,
 * p.100-101) and the Recoil Brace weapon upgrade (p.97). Adjustable Faceplate is item rules now
 * (rules/conversions-uses.test.js). The armors that come pre-fitted with Anonymous/Ceremonial
 * (Ballistic/Tactical Armor (Anonymous), Momentum/Tactical Armor (Ceremonial)) carry the upgrade as an embedded entry, so they work through these too.
 */

/* -------------------------------------------- */
/*  Anonymous                                    */
/* -------------------------------------------- */

// Anonymous (p.100): "You are resistant to abilities that have a different effect when used
// multiple times against the same target, such as the Inundation Perk from the Officer
// Battlefield Psychology Focus." Resistance is a Snag on the roll. Covers the two such abilities
// this system tracks per target: Inundation (GI Joe CRB p.86, the Edge on a repeat Outwit - the
// dice.mjs outwittedTargets flag) and Informed Accuracy (TF CRB p.59, ↑ per earlier Analyze
// Target - the analyzeTargetCounts flag; its first use is not a repeat, so from the second on).
const flagKey = target => String(target?.uuid ?? '').replace(/\./g, '-');

export function anonymousSnag(actor, target, ctx = {}) {
  if (!target?.uuid || !actor) {
    return null;
  }

  const upgrade = wornUpgrade(target, G1.anonymous);
  if (!upgrade) {
    return null;
  }

  const key = flagKey(target);
  const repeatOutwit = ['deception', 'intimidation'].includes(ctx.rolledSkill) && hasSourced(actor, G1.inundation)
    && !!actor.getFlag?.('essence20', 'outwittedTargets')?.[key];
  const repeatAnalyze = !!ctx.isAttack && hasSourced(actor, G1.informedAccuracy)
    && (Number(actor.getFlag?.('essence20', 'analyzeTargetCounts')?.[key]) || 0) >= 2;
  return repeatOutwit || repeatAnalyze ? { id: 'gij1Anonymous', label: T('G1AnonymousLabel', { name: upgrade.name }), snag: true } : null;
}

registerRollSources((actor, target, ctx) => {
  const source = anonymousSnag(actor, target, ctx);
  return { sources: source ? [source] : [], consumes: [] };
});

/* -------------------------------------------- */
/*  Ceremonial                                   */
/* -------------------------------------------- */

// Ceremonial (p.101): "As a Free action, you gain ↑1 on Persuasion Skill Tests until the end of
// your turn." The Use button pays the Free action and stamps the turn; the ↑1 is then a listed
// source on Persuasion rolls that turn. Out of combat there are no turns, so it holds for the next
// Persuasion test (which uses it up) this scene.
export const CEREMONIAL_FLAG = 'gij1Ceremonial';

registerUse({
  id: 'gij1Ceremonial',
  matches: item => isFrom(G1.ceremonial)(item),
  canUse: item => !!item.parent && !!wornUpgrade(item.parent, G1.ceremonial) && !isStampActive(item.parent.getFlag?.('essence20', CEREMONIAL_FLAG)),
  run: async (item, economy, pay) => {
    const actor = item.parent;
    if (!await pay('free')) {
      return null;
    }

    await actor.setFlag('essence20', CEREMONIAL_FLAG, turnStamp());
    return T('G1CeremonialUsed', { name: actor.name, item: item.name });
  },
});

export function ceremonialSource(actor, ctx = {}) {
  if (ctx.rolledSkill != 'persuasion' || !isStampActive(actor?.getFlag?.('essence20', CEREMONIAL_FLAG))) {
    return null;
  }

  return { id: 'gij1Ceremonial', label: wornUpgrade(actor, G1.ceremonial)?.name ?? 'Ceremonial', shiftUp: 1 };
}

registerRollSources((actor, target, ctx) => {
  const source = ceremonialSource(actor, ctx);
  if (!source) {
    return { sources: [], consumes: [] };
  }

  return { sources: [source], consumes: game.combat ? [] : [{ ext: 'gij1Ceremonial', actorUuid: actor.uuid }] };
});

registerConsumer('gij1Ceremonial', async consume => {
  const actor = await actorFromUuid(consume.actorUuid);
  await actor?.unsetFlag?.('essence20', CEREMONIAL_FLAG);
});

/* -------------------------------------------- */
/*  Uniform                                      */
/* -------------------------------------------- */

// Uniform (p.100): "Skill tests to identify you individually suffer ↓1, and an additional ↓1 per
// ally within line of sight who also has the Uniform Battledress Upgrade." Whether a test is one
// to identify someone is the table's call, so it is an off-by-default toggle whenever the targeted
// creature wears a Uniform. Line of sight is read as "on the scene" (the ally tokens the system can
// see), the same approximation the other team-wide checks make.
export function uniformPenalty(target) {
  if (!wornUpgrade(target, G1.uniform)) {
    return 0;
  }

  let allies = 0;
  try {
    allies = getNearbyAllyTokens(target, Infinity).filter(token => token.actor && token.actor.id != target.id
      && wornUpgrade(token.actor, G1.uniform)).length;
  } catch (error) {
    allies = 0;
  }

  return 1 + allies;
}

registerDialogToggles(() => {
  const target = firstTarget();
  const penalty = target ? uniformPenalty(target) : 0;
  return penalty ? [{ name: 'gij1Uniform', type: 'checkbox', label: T('G1UniformToggle', { name: target.name, n: penalty }) }] : [];
});

registerApplyDialog((actor, options) => {
  if (!options.ext?.gij1Uniform) {
    return;
  }

  const target = firstTarget();
  const penalty = target ? uniformPenalty(target) : 0;
  options.shiftDown = (options.shiftDown ?? 0) + penalty;
});

/* -------------------------------------------- */
/*  Recoil Brace / one-handed for a turn         */
/* -------------------------------------------- */

// Recoil Brace (p.97, prerequisite a two-handed weapon): "Once per scene, use this weapon as a
// one-handed weapon until the end of your turn." The weapon is stamped (flags.essence20.
// gij1OneHanded) and counts as one hand while the stamp holds - derivedHands, which Disarm, Snatch
// and the other hand-count checks read. Let It Rip (perks.mjs) uses the same stamp.
export const ONE_HANDED_FLAG = 'gij1OneHanded';

export function isOneHandedNow(weapon) {
  return isStampActive(weapon?.flags?.essence20?.[ONE_HANDED_FLAG]);
}

registerDerived(actor => {
  for (const weapon of itemsOf(actor)) {
    if (weapon.type == 'weapon' && weapon.system && isOneHandedNow(weapon)) {
      weapon.system.derivedHands = Math.min(1, Number(weapon.system.derivedHands ?? 1));
    }
  }
});

const braceKey = item => `gij1RecoilBrace-${item.id}`;

function bracedWeapon(item) {
  const parentId = item?.flags?.essence20?.parentId;
  return parentId ? item.parent?.items?.get?.(parentId) ?? null : null;
}

registerUse({
  id: 'gij1RecoilBrace',
  matches: isFrom(G1.recoilBrace),
  canUse: item => !!bracedWeapon(item) && getUses(item.parent, braceKey(item), 'scene') < 1,
  run: async (item) => {
    const actor = item.parent;
    const weapon = bracedWeapon(item);
    if (!weapon) {
      return null;
    }

    await markUsed(actor, braceKey(item), { window: 'scene' });
    await weapon.setFlag('essence20', ONE_HANDED_FLAG, turnStamp());
    return T('G1OneHanded', { name: actor.name, weapon: weapon.name, source: item.name });
  },
});
