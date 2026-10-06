/**
 * Transformers (TF CRB, Enigma of Combination, Technorganic Secrets): attack-side Perks, zones, generated weapon
 * alternates and the Scramble Field. (Holographic Sights and Balance and Compensation are item rules -
 * rules/conv10-slC10.test.js.)
 */
import {
  registerApplyDialog, registerChatButton, registerConsumer, registerDefenseAdjust,
  registerPostRoll, registerRollSources, registerUse,
} from "../../mechanics/item-hooks.mjs";
import { hasUsedThisRound, markUsedThisRound } from "../../mechanics/characters/perks.mjs";
import { getSceneEpoch } from "../../mechanics/resources/scene-clock.mjs";
import {
  O3, T, escape, findItem, has, isItem, num, parentWeaponOf, rollSkillTotal,
  sameSide, sameTurn, targetedActors, tokenOf, turnStamp, worldActors, writeActor,
} from "../shared/turn-stamps-and-sides.mjs";

// (EM Protective Lining, the Enigma of Combination armor upgrade, is its item's own rules: an incoming ↓6 on
// Electromagnetic attacks against a Computerized wearer, and a per-attack Defense giving back the computerized
// armor's Evasion those attacks ignore - both while its armor is worn, or in Alt Mode when it isn't attached.)

// (Same Principle, the TF CRB Gunner Perk, is its item's own rules: a Use picking the weapon - the old
// o3SameWeapon flag carries over - and a WeaponTrait rule making the picked weapon Ballistic.)

/* -------------------------------------------- */
/*  Again and Again and Again                    */
/* -------------------------------------------- */

/*
 * Again and Again and Again (Enigma of Combination, Pugilist, 17th level, p.39): "if an attack that
 * benefits from your Puissance Focus Perk successfully hits a target, you may choose to immediately
 * make an additional identical attack against the same target at ↓1. If that attack hits, you may
 * choose to make another additional identical attack against the same target with an additional ↓2
 * (for a total of ↓3). Only two additional such attacks can be taken in a single turn." A Puissance
 * attack is one with no weapon behind it (dice.mjs PUISSANCE_ID's own reading).
 */
const AGAIN_FLAG = 'o3AgainCount';
let pendingAgain = null;

export function againShift(step) {
  return step >= 2 ? 3 : 1;
}

export function againCount(actor) {
  const record = actor?.flags?.essence20?.[AGAIN_FLAG];
  return record && sameTurn(record.stamp, turnStamp()) ? num(record.count) : 0;
}

registerApplyDialog((actor, options, ctx) => {
  const step = num(ctx?.dataset?.o3AgainStep);
  if (step) {
    options.shiftDown = num(options.shiftDown) + againShift(step);
  }
});

registerPostRoll(async (actor, results, checkContext, { hits, rider } = {}) => {
  const step = pendingAgain?.actorId == actor?.id ? pendingAgain.step : 0;
  pendingAgain = null;
  if (!checkContext?.isAttack || !has(actor, O3.againAndAgain) || !has(actor, O3.puissance) || !actor.isOwner) {
    return;
  }

  const item = rider?.itemUuid ? await fromUuid(rider.itemUuid) : null;
  if (item?.type != 'weaponEffect' || parentWeaponOf(actor, item)) {
    return;
  }

  const hit = (hits ?? []).find(h => h.hit);
  if (!hit || step >= 2 || againCount(actor) >= 2) {
    return;
  }

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<button type="button" data-e20-ext="o3Again" data-actor="${actor.uuid}" data-item="${item.uuid}" data-target="${hit.target.uuid}" data-step="${step + 1}">${T('O3AgainButton', { shift: againShift(step + 1) })}</button>`,
  });
});

registerChatButton('o3Again', async (message, button) => {
  const actor = await fromUuid(button.dataset.actor);
  const item = await fromUuid(button.dataset.item);
  const target = await fromUuid(button.dataset.target);
  if (!actor?.isOwner || !item || button.dataset.done) {
    return;
  }

  if (againCount(actor) >= 2) {
    ui.notifications.warn(T('O3AgainMax'));
    return;
  }

  button.dataset.done = '1';
  const token = target?.getActiveTokens?.()?.[0];
  token?.setTarget?.(true, { releaseOthers: true });
  await actor.setFlag('essence20', AGAIN_FLAG, { stamp: turnStamp(), count: againCount(actor) + 1 });
  const step = num(button.dataset.step) || 1;
  pendingAgain = { actorId: actor.id, step };
  await item.roll({ rollType: 'weaponEffect', bypassEconomy: true, o3AgainStep: step });
});

// (Bump & Run - the ↑1, the Stun and the Impaired - is its Perk's own rules: rules/conv10-slC10.test.js.)

/* -------------------------------------------- */
/*  Cover blasts                                 */
/* -------------------------------------------- */

/*
 * Cover Grenade (TF CRB p.124) and every "Cover" effect: "Cover: A nonlethal blast that fills an
 * area with a smoke or other effect that blocks the senses, granting creatures behind the blast area
 * [Cover] for the listed number of turns." Throwing one posts a card; its button gives the Cover
 * Condition, for that many rounds, to the tokens the clicking user has targeted (or selected).
 */
registerApplyDialog(async (actor, options, ctx) => {
  const item = ctx?.item;
  if (item?.type != 'weaponEffect' || item.system?.damageType != 'cover') {
    return;
  }

  const rounds = Math.max(1, num(item.system.damageValue));
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<p>${T('O3CoverBlast', { name: escape(item.name), rounds })}</p>`
      + `<button type="button" data-e20-ext="o3CoverBlast" data-rounds="${rounds}">${T('O3CoverBlastApply')}</button>`,
  });
});

registerChatButton('o3CoverBlast', async (message, button) => {
  const rounds = Math.max(1, num(button.dataset.rounds));
  const tokens = game.user?.targets?.size ? [...game.user.targets] : (canvas?.tokens?.controlled ?? []);
  const { applyTimedCondition } = await import("../../mechanics/combat/timed-status.mjs");
  for (const token of tokens) {
    const target = token?.actor;
    if (!target) {
      continue;
    }

    if (target.isOwner) {
      await applyTimedCondition(target, 'cover', rounds);
    } else {
      await writeActor(target, 'toggleStatusEffect', ['cover', { active: true }]);
    }
  }
});

// (Overcharge Engines, the TF CRB Scientist Perk, is its own rules: two Use rules (twice a turn with
// Multiplication), an open Technology roll marking the feet, Movement rules adding them, a
// MovementAction ignoring Rough Terrain and a turnEnd Trigger clearing the mark.)

/* -------------------------------------------- */
/*  Perfect Placement                            */
/* -------------------------------------------- */

/*
 * Perfect Placement (Enigma of Combination, Surveyor, 20th level, p.37): "You can dictate a 25-foot ×
 * 25-foot area of the scene that is a perfectly tactical location. While wholly within this location,
 * you always have Cover, ignore other targets' Cover in that area, gain +2 to your Evasion Defense,
 * and gain ↑1 on the first Skill Test you make each round." The Use button places the square (a click
 * on the canvas) for the scene.
 */
const ZONE_FLAG = 'o3PerfectPlacement';
const ZONE_FEET = 25;

export function zoneOf(actor) {
  const zone = findItem(actor, O3.perfectPlacement)?.flags?.essence20?.[ZONE_FLAG];
  return zone && zone.epoch == getSceneEpoch() && zone.sceneId == canvas?.scene?.id ? zone : null;
}

/** Whether a token's footprint lies wholly inside a square zone centred on (x, y). */
export function whollyInside(bounds, zone, pxPerFoot) {
  if (!bounds || !zone) {
    return false;
  }

  const half = (ZONE_FEET * pxPerFoot) / 2;
  return bounds.x >= zone.x - half && bounds.y >= zone.y - half
    && bounds.x + bounds.width <= zone.x + half && bounds.y + bounds.height <= zone.y + half;
}

function pxPerFoot() {
  const d = canvas?.dimensions;
  return d?.size && d?.distance ? d.size / d.distance : 0;
}

function tokenBounds(token) {
  const doc = token?.document;
  const size = canvas?.dimensions?.size ?? 0;
  if (!doc) {
    return null;
  }

  return { x: doc.x, y: doc.y, width: num(doc.width) * size, height: num(doc.height) * size };
}

export function inPerfectPlacement(holder, actor = holder) {
  const zone = zoneOf(holder);
  return !!zone && whollyInside(tokenBounds(tokenOf(actor)), zone, pxPerFoot());
}

registerUse({
  id: 'o3PerfectPlacement',
  matches: item => isItem(item, O3.perfectPlacement),
  run: async (item) => {
    const { pickCanvasPoint } = await import("../../mechanics/combat/forced-movement.mjs");
    const point = await pickCanvasPoint(T('O3PerfectPlacementPick'));
    if (!point) {
      return null;
    }

    await item.setFlag('essence20', ZONE_FLAG, { sceneId: canvas.scene.id, x: point.x, y: point.y, epoch: getSceneEpoch() });
    return T('O3PerfectPlacementSet', { name: escape(item.parent.name) });
  },
});

registerRollSources((actor, target, ctx) => {
  const sources = [];
  const consumes = [];
  if (has(actor, O3.perfectPlacement) && inPerfectPlacement(actor)) {
    if (game.combat && !hasUsedThisRound(actor, ZONE_FLAG)) {
      sources.push({ id: 'o3PerfectPlacementFirst', label: 'Perfect Placement', shiftUp: 1 });
      consumes.push({ ext: 'o3PerfectPlacement', actorUuid: actor.uuid });
    }

    // Ignore the Cover of a target standing in the same square.
    if (target && ctx?.isAttack && !ctx.isMelee && target.statuses?.has?.('cover') && inPerfectPlacement(actor, target)) {
      sources.push({ id: 'o3PerfectPlacementIgnoreCover', label: 'Perfect Placement', shiftUp: 2 });
    }
  }

  // "You always have Cover" - the ↓2 a ranged attack against Cover takes (dice.mjs), when the
  // holder doesn't already have the Condition.
  if (target && ctx?.isAttack && !ctx.isMelee && has(target, O3.perfectPlacement) && inPerfectPlacement(target)
    && !target.statuses?.has?.('cover') && !target.statuses?.has?.('totalCover')) {
    sources.push({ id: 'o3PerfectPlacementCover', label: `${game.i18n.localize('E20.DamageCover')} (Perfect Placement)`, shiftDown: 2 });
  }

  return { sources, consumes };
});

registerConsumer('o3PerfectPlacement', async (consume) => {
  const actor = await fromUuid(consume.actorUuid);
  if (actor?.isOwner) {
    await markUsedThisRound(actor, ZONE_FLAG);
  }
});

registerDefenseAdjust((attacker, defender, defenseType) => (defenseType == 'evasion' && has(defender, O3.perfectPlacement)
  && inPerfectPlacement(defender) ? 2 : 0));

/* -------------------------------------------- */
/*  Scramble Field Generator                     */
/* -------------------------------------------- */

/*
 * Scramble Field Generator (Technorganic Secrets, p.49): "Must be adhered to target with a Finesse,
 * Infiltration, or Might Skill Test against their Evasion to affect sensors. Effects: Reduces
 * Target's Alertness by ↓2. Alternate Effects: With a successful DIF 16 Technology Test on
 * activation, the user and allies in the same faction become invisible to the target until the
 * Scramble Field Generator is removed as a Free action. The user may instead attempt a DIF 20
 * Technology Test to override the target's sensors and show them an illusion that lasts until the
 * Scramble Field Generator is removed as a Free action. Traits: Consumable, Computerized."
 *
 * The Use button makes the adhering attack against the targeted creature and the activation test;
 * the field lives on the target (flags.essence20.o3Scramble, for the scene). While it holds, the
 * target's Alertness is ↓2; if invisible, its attacks on the user's side are Snagged and that side's
 * attacks on it gain Edge (the Invisible Condition's own two halves). The illusion is the GM's to
 * narrate. Using it again against the scrambled target removes it (a Free action), which uses the
 * Consumable device up - as does an adhering attack that misses.
 */
const SCRAMBLE_FLAG = 'o3Scramble';

export function scrambleOn(actor) {
  const record = actor?.flags?.essence20?.[SCRAMBLE_FLAG];
  return record && record.epoch == getSceneEpoch() ? record : null;
}

function actorByUuid(uuid) {
  return worldActors().find(a => a.uuid == uuid) ?? null;
}

registerRollSources((actor, target, ctx) => {
  const sources = [];
  const mine = scrambleOn(actor);
  if (mine && ctx?.rolledSkill == 'alertness') {
    sources.push({ id: 'o3ScrambleAlertness', label: 'Scramble Field Generator', shiftDown: 2 });
  }

  if (ctx?.isAttack && target) {
    if (mine?.mode == 'invisible' && sameSide(target, actorByUuid(mine.by))) {
      sources.push({ id: 'o3ScrambleBlind', label: 'Scramble Field Generator', snag: true });
    }

    const theirs = scrambleOn(target);
    if (theirs?.mode == 'invisible' && sameSide(actor, actorByUuid(theirs.by))) {
      sources.push({ id: 'o3ScrambleUnseen', label: 'Scramble Field Generator', edge: true });
    }
  }

  return { sources };
});

registerUse({
  id: 'o3Scramble',
  matches: item => isItem(item, O3.scrambleField),
  run: async (item, economy, pay) => {
    const actor = item.parent;
    const target = targetedActors()[0];
    if (!target) {
      ui.notifications.warn(T('O3NeedTarget'));
      return null;
    }

    const { chooseButtons } = await import("../../mechanics/resources/grants.mjs");
    if (scrambleOn(target)?.by == actor.uuid) {
      if (!(await pay('free'))) {
        return null;
      }

      await writeActor(target, 'unsetFlag', ['essence20', SCRAMBLE_FLAG]);
      await consume(item);
      return T('O3ScrambleRemoved', { target: escape(target.name) });
    }

    const skill = await chooseButtons(item.name, T('O3ScrambleSkill'), ['finesse', 'infiltration', 'might']
      .map(s => [s, game.i18n.localize(CONFIG.E20.skills?.[s] ?? s)]));
    if (!skill || !(await pay('standard'))) {
      return null;
    }

    const adhere = await rollSkillTotal(actor, skill, { dif: num(target.system?.defenses?.evasion?.total) });
    if (!adhere?.success) {
      await consume(item);
      return T('O3ScrambleMissed', { name: escape(actor.name), target: escape(target.name) });
    }

    const mode = await chooseButtons(item.name, T('O3ScrambleMode'), [
      ['alertness', T('O3ScrambleModeSensors')], ['invisible', T('O3ScrambleModeInvisible')], ['illusion', T('O3ScrambleModeIllusion')],
    ]);
    let applied = 'alertness';
    if (mode == 'invisible' || mode == 'illusion') {
      const test = await rollSkillTotal(actor, 'technology', { dif: mode == 'invisible' ? 16 : 20 });
      applied = test?.success ? mode : 'alertness';
    }

    await writeActor(target, 'setFlag', ['essence20', SCRAMBLE_FLAG, { by: actor.uuid, mode: applied, epoch: getSceneEpoch() }]);
    return T(`O3ScrambleApplied_${applied}`, { name: escape(actor.name), target: escape(target.name) });
  },
});

async function consume(item) {
  const quantity = num(item.system?.quantity ?? 1);
  if (quantity > 1) {
    await item.update({ 'system.quantity': quantity - 1 });
  } else {
    await item.delete();
  }
}
