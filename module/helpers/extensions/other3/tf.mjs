/**
 * Transformers (TF CRB, Enigma of Combination, Technorganic Secrets) and the Quartermaster's Guide's
 * Holographic Sights: attack-side Perks, zones, generated weapon alternates and the Scramble Field.
 */
import {
  registerApplyDialog, registerChatButton, registerConsumer, registerDefenseAdjust, registerDerived,
  registerPostRoll, registerRollSources, registerTurnEnd, registerUse,
} from "../../extensions.mjs";
import { hasUsedThisRound, markUsedThisRound } from "../../perks.mjs";
import { getSceneEpoch } from "../../scene-clock.mjs";
import {
  O3, T, attachedUpgrades, escape, findItem, has, idOf, isItem, itemsOf, num, parentWeaponOf, rollSkillTotal,
  sameSide, sameTurn, say, sourceOf, targetedActors, tokenOf, turnStamp, worldActors, writeActor,
} from "./shared.mjs";

/* -------------------------------------------- */
/*  Holographic Sights                           */
/* -------------------------------------------- */

/*
 * Holographic Sights (Quartermaster's Guide to Gear, weapon upgrade, p.34) - prerequisite "Any
 * targeting weapon", benefit "Ignore penalties for attacking multiple targets." A Multiple Targets
 * effect carries its penalty as its own printed ↓ (Machine Gun's 2-target alternate: ↓1); the sights
 * hand that ↓ back as a matching ↑ on any multi-target Targeting effect of the upgraded weapon.
 */
export function holographicShift(actor, effect) {
  if (effect?.type != 'weaponEffect' || num(effect.system?.numTargets) <= 1 || effect.system?.classification?.skill != 'targeting') {
    return 0;
  }

  const weapon = parentWeaponOf(actor, effect);
  const fitted = attachedUpgrades(actor, weapon).some(upgrade => idOf(sourceOf(upgrade)) == idOf(O3.holographicSights));
  return fitted ? Math.max(0, num(effect.system?.shiftDown)) : 0;
}

registerRollSources((actor, target, ctx) => {
  const shift = holographicShift(actor, ctx?.item);
  return shift ? { sources: [{ id: 'o3HolographicSights', label: 'Holographic Sights', shiftUp: shift }] } : {};
});

/* -------------------------------------------- */
/*  EM Protective Lining                         */
/* -------------------------------------------- */

/*
 * EM Protective Lining (Enigma of Combination, armor upgrade, p.54): "Weapons dealing Electromagnetic
 * damage gain no special benefits against you for being computerized or mechanical." Against a
 * Computerized target dice.mjs gives an Electromagnetic attack ↑3 and ignores computerized armor's
 * Evasion; against a lined one it is treated as any other target (TF CRB p.125: "↓3 against all
 * other targets") - so the ↑3 becomes ↓3 and the armor's Evasion counts again.
 */
export function isLined(actor) {
  return itemsOf(actor).some(item => item.type == 'upgrade' && idOf(sourceOf(item)) == idOf(O3.emLining) && (() => {
    const parentId = item.flags?.essence20?.parentId;
    if (!parentId) {
      return !!actor.system?.canTransform;
    }

    return !!itemsOf(actor).find(parent => parent.id == parentId)?.system?.equipped;
  })());
}

export function isElectromagnetic(actor, item) {
  if (item?.system?.damageType == 'emp') {
    return true;
  }

  return !!parentWeaponOf(actor, item)?.system?.traits?.includes?.('electromagnetic');
}

registerRollSources((actor, target, ctx) => {
  if (!target || !ctx?.isAttack || !target.system?.traits?.computerized || !isLined(target) || !isElectromagnetic(actor, ctx.item)) {
    return {};
  }

  return { sources: [{ id: 'o3EmLining', label: 'EM Protective Lining', shiftDown: 6 }] };
});

registerDefenseAdjust((attacker, defender, defenseType, ctx) => {
  if (defenseType != 'evasion' || !isLined(defender) || !isElectromagnetic(attacker, ctx?.item)) {
    return 0;
  }

  return itemsOf(defender).filter(item => item.type == 'armor' && item.system?.equipped && (item.system?.traits ?? []).includes('computerized'))
    .reduce((sum, armor) => sum + num(armor.system.totalBonusEvasion), 0);
});

/* -------------------------------------------- */
/*  Balance and Compensation                     */
/* -------------------------------------------- */

/*
 * Balance and Compensation (Enigma of Combination, Cannoneer, 1st level, p.31): "It is easier for
 * you to wield a ranged weapon in your External Hardpoints. Any Skill-based requirements for such
 * weapons are reduced by two die sizes (to a minimum of d2)." Weapon requirements are shown, not
 * enforced (documents/item.mjs#_prepareHardpointDerived), so this lowers the requirement the Gear
 * tab shows. Size-based requirements have no field.
 */
export function lowerRequirement(req, steps = 2) {
  const ladder = CONFIG.E20?.weaponRequirementShiftLadder ?? ['none', 'd2', 'd4', 'd6', 'd8', 'd10', 'd12'];
  const index = ladder.indexOf(req);
  if (index <= 1) {
    return req;
  }

  return ladder[Math.max(1, index - steps)];
}

function isRangedWeapon(actor, weapon) {
  return itemsOf(actor).some(item => item.type == 'weaponEffect' && item.flags?.essence20?.parentId == weapon.id
    && item.system?.classification?.style && item.system.classification.style != 'melee');
}

registerDerived((actor) => {
  if (!has(actor, O3.balanceAndCompensation)) {
    return;
  }

  for (const weapon of itemsOf(actor)) {
    if (weapon.type == 'weapon' && weapon.system?.hardpoint?.type == 'external' && isRangedWeapon(actor, weapon)) {
      weapon.system.effectiveBrawnReq = lowerRequirement(weapon.system.effectiveBrawnReq ?? weapon.system.requirements?.shift);
    }
  }
});

/* -------------------------------------------- */
/*  Same Principle                               */
/* -------------------------------------------- */

/*
 * Same Principle (TF CRB, Gunner, 10th level, p.70): "choose a weapon you are trained to use. All of
 * your Gunner and Gunslinger perks that specify ballistic weapons also apply to this weapon." Picked
 * with the Perk's Use button; the weapon then reads as Ballistic in derived data (the item sheet
 * keeps editing its own stored traits - system.upgradeTouched). Read broadly: every ballistic check
 * sees it, not only the Gunner/Gunslinger ones.
 */
const SAME_FLAG = 'o3SameWeapon';

registerUse({
  id: 'o3SamePrinciple',
  matches: item => isItem(item, O3.samePrinciple),
  run: async (item) => {
    const weapons = itemsOf(item.parent).filter(w => w.type == 'weapon' && !(w.system?.traits ?? []).includes('ballistic'));
    const { chooseSelect } = await import("../../grants.mjs");
    const id = await chooseSelect(item.name, T('O3SamePrinciplePick'), weapons.map(w => ({ value: w.id, label: w.name })));
    if (!id) {
      return null;
    }

    await item.setFlag('essence20', SAME_FLAG, id);
    return T('O3SamePrincipleChosen', { name: escape(item.parent.name), weapon: escape(weapons.find(w => w.id == id)?.name) });
  },
});

registerDerived((actor) => {
  const id = findItem(actor, O3.samePrinciple)?.flags?.essence20?.[SAME_FLAG];
  const weapon = id ? itemsOf(actor).find(item => item.id == id && item.type == 'weapon') : null;
  if (!weapon?.system || (weapon.system.traits ?? []).includes('ballistic')) {
    return;
  }

  weapon.system.traits = [...(weapon.system.traits ?? []), 'ballistic'];
  if (Array.isArray(weapon.system.itemAndUpgradeTraits)) {
    weapon.system.itemAndUpgradeTraits = [...weapon.system.itemAndUpgradeTraits, 'ballistic'];
  }

  weapon.system.upgradeTouched = [...new Set([...(weapon.system.upgradeTouched ?? []), 'traits'])];
});

/* -------------------------------------------- */
/*  Pistol Whip / Specialty Flexibility          */
/* -------------------------------------------- */

/*
 * Pistol Whip (TF CRB, Gunner, 1st level, p.68): "When you have a Ballistic weapon in an External
 * Hardpoint, it also counts as a Close Combat Bludgeon. You do not add any benefits you normally gain
 * from attacks with a Ballistic weapon when you use it as a Close Combat Bludgeon." Close Combat
 * Bludgeon (p.121): Finesse or Might sidearm melee, Reach, 1 Stun; alternates 1 Blunt (↓1), Maneuver.
 *
 * Specialty Flexibility (TF CRB, Sharpshooter, 10th level, p.70): "within the normal range of your
 * Long Range Rifle, it gains Stun 2, Intimidating and Maneuver as alternate effects."
 *
 * Both become real alternate weaponEffects on the weapon, made and removed as the Perk, the weapon or
 * its Hardpoint change - the same approach as helpers/weapon-upgrades.mjs#syncGeneratedEffects, under
 * this slice's own flag (o3GeneratedKey) so neither sync deletes the other's.
 */
const GEN_FLAG = 'o3GeneratedKey';
const NO_SECONDARY = { 'secondaryDamage.type': null, 'secondaryDamage.value': 0 };
const BLUDGEON = {
  'classification.skill': 'finesse', 'classification.style': 'melee', 'range.value': null, 'range.long': null,
  'range.min': null, 'range.reachMultiplier': 1, radius: 0, shape: null, numTargets: 1, numHands: '1',
  defenseType: 'toughness', accurateShiftUp: 0, ...NO_SECONDARY,
};

function isLongRangeRifle(weapon) {
  return idOf(sourceOf(weapon)) == idOf(O3.longRangeRifle) || /long range rifle/i.test(weapon?.name ?? '');
}

function printedEffects(actor, weapon) {
  return itemsOf(actor).filter(item => item.type == 'weaponEffect' && item.flags?.essence20?.parentId == weapon.id
    && !item.flags?.essence20?.generatedKey && !item.flags?.essence20?.[GEN_FLAG]);
}

function primaryOf(actor, weapon) {
  const effects = printedEffects(actor, weapon);
  return effects.find(effect => num(effect._source?.system?.damageValue ?? effect.system?.damageValue) > 0) ?? effects[0] ?? null;
}

export function desiredO3Effects(actor) {
  const wanted = [];
  const i18n = key => game.i18n.localize(key);
  for (const weapon of itemsOf(actor).filter(item => item.type == 'weapon')) {
    const add = (key, label, changes) => wanted.push({ weapon, key: `${weapon.id}:${key}`, name: `${label} (${weapon.name})`, changes });
    const traits = weapon.system?.traits ?? [];
    if (has(actor, O3.pistolWhip) && traits.includes('ballistic') && (weapon.system?.hardpoint?.type ?? 'external') == 'external') {
      const label = `Pistol Whip - ${i18n('E20.DamageStun')}`;
      add('pistolWhipStun', label, { ...BLUDGEON, damageType: 'stun', damageValue: 1, shiftDown: 0 });
      add('pistolWhipBlunt', `Pistol Whip - ${i18n('E20.DamageBlunt')}`, { ...BLUDGEON, damageType: 'blunt', damageValue: 1, shiftDown: 1 });
      add('pistolWhipManeuver', `Pistol Whip - ${i18n('E20.DamageManeuver')}`, { ...BLUDGEON, damageType: 'maneuver', damageValue: null, shiftDown: 0 });
    }

    if (has(actor, O3.specialtyFlexibility) && isLongRangeRifle(weapon)) {
      const normalRange = { 'range.long': null, ...NO_SECONDARY, shiftDown: 0 };
      add('sfStun', `${i18n('E20.DamageStun')} 2`, { ...normalRange, damageType: 'stun', damageValue: 2 });
      add('sfIntimidate', i18n('E20.DamageIntimidate'), { ...normalRange, damageType: 'intimidate', damageValue: null });
      add('sfManeuver', i18n('E20.DamageManeuver'), { ...normalRange, damageType: 'maneuver', damageValue: null });
    }
  }

  return wanted;
}

const syncing = new Map();

export function syncO3Effects(actor) {
  if (!actor?.items) {
    return Promise.resolve();
  }

  const previous = syncing.get(actor.uuid) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(() => doSync(actor));
  syncing.set(actor.uuid, next);
  return next;
}

async function doSync(actor) {
  const existing = itemsOf(actor).filter(item => item.type == 'weaponEffect' && item.flags?.essence20?.[GEN_FLAG]);
  const wanted = desiredO3Effects(actor);
  const keep = new Set(wanted.map(w => w.key));

  const stale = existing.filter(item => !keep.has(item.flags.essence20[GEN_FLAG]));
  for (const effect of stale) {
    const weapon = itemsOf(actor).find(w => w.id == effect.flags.essence20.parentId);
    const key = effect.flags.essence20.collectionId;
    if (weapon && key && weapon.system?.items?.[key]) {
      await weapon.update({ [`system.items.-=${key}`]: null });
    }
  }

  if (stale.length) {
    await actor.deleteEmbeddedDocuments('Item', stale.map(item => item.id));
  }

  const toCreate = [];
  for (const want of wanted) {
    if (existing.some(item => item.flags.essence20[GEN_FLAG] == want.key)) {
      continue;
    }

    const primary = primaryOf(actor, want.weapon);
    if (!primary) {
      continue;
    }

    const data = primary.toObject();
    delete data._id;
    data.name = want.name;
    for (const [path, value] of Object.entries(want.changes)) {
      foundry.utils.setProperty(data.system, path, value);
    }

    foundry.utils.setProperty(data, `flags.essence20.${GEN_FLAG}`, want.key);
    foundry.utils.setProperty(data, 'flags.essence20.parentId', want.weapon.id);
    toCreate.push({ weapon: want.weapon, data });
  }

  if (!toCreate.length) {
    return;
  }

  const created = await actor.createEmbeddedDocuments('Item', toCreate.map(entry => entry.data));
  const { setEntryAndAddItem } = await import("../../../sheet-handlers/attachment-handler.mjs");
  for (const [index, effect] of created.entries()) {
    const key = await setEntryAndAddItem(effect, toCreate[index].weapon);
    if (key) {
      await effect.setFlag('essence20', 'collectionId', key);
    }
  }
}

function affectsO3Effects(item, changes) {
  if (item?.flags?.essence20?.[GEN_FLAG]) {
    return false;
  }

  if (item?.type == 'perk') {
    return isItem(item, O3.pistolWhip) || isItem(item, O3.specialtyFlexibility);
  }

  if (item?.type == 'weapon') {
    const keys = Object.keys(changes?.system ?? {});
    return !changes || keys.includes('traits') || keys.includes('hardpoint');
  }

  return false;
}

for (const hook of ['createItem', 'updateItem', 'deleteItem']) {
  Hooks.on?.(hook, (item, a, b, c) => {
    const changes = hook == 'updateItem' ? a : null;
    const userId = hook == 'updateItem' ? c : b;
    const actor = item?.parent;
    if (userId != game.user?.id || actor?.documentName != 'Actor' || !affectsO3Effects(item, changes)) {
      return;
    }

    syncO3Effects(actor).catch(error => console.error('Essence20 | other3 generated effects', error));
  });
}

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

/* -------------------------------------------- */
/*  Bump & Run                                   */
/* -------------------------------------------- */

/*
 * Bump & Run (Enigma of Combination, Pugilist, 6th level, p.38) - the ↑1 and the Stun are dice.mjs.
 * The rest: "You must move at least 10 feet after making this attack, but if you cannot, you are
 * Impaired until the end of your next turn." The token's spot is noted at the attack; when the turn
 * ends (GM client) a token still within 10ft of it is Impaired.
 */
const BUMP_FLAG = 'o3BumpRun';

registerPostRoll(async (actor, results, checkContext) => {
  if (!checkContext?.bumpAndRunAttempt || !actor?.isOwner || !game.combat) {
    return;
  }

  const token = tokenOf(actor);
  await actor.setFlag('essence20', BUMP_FLAG, { stamp: turnStamp(), x: token?.center?.x ?? null, y: token?.center?.y ?? null });
});

export function movedFeet(from, to) {
  if (from?.x == null || !to) {
    return Infinity;
  }

  return canvas?.grid?.measurePath ? canvas.grid.measurePath([from, to]).distance : Math.hypot(to.x - from.x, to.y - from.y);
}

registerTurnEnd(async (actor) => {
  const record = actor?.flags?.essence20?.[BUMP_FLAG];
  if (!record) {
    return;
  }

  await actor.unsetFlag('essence20', BUMP_FLAG);
  const combat = game.combat;
  if (!combat || record.stamp?.combatId != combat.id || record.stamp?.round != combat.round) {
    return;
  }

  const token = tokenOf(actor);
  if (movedFeet(record, token?.center) < 10) {
    const { applyTimedCondition } = await import("../../timed-status.mjs");
    await applyTimedCondition(actor, 'impaired', 1);
    await say(actor, T('O3BumpRunImpaired', { name: escape(actor.name) }));
  }
});

/* -------------------------------------------- */
/*  What Cover? / Cover blasts                   */
/* -------------------------------------------- */

/*
 * What Cover? (Enigma of Combination, Cannoneer, 6th level, p.32) - the ↓1 reduction is dice.mjs.
 * "Additionally, when you successfully hit a target benefitting from Cover, the Cover is destroyed
 * (if possible) after the attack results are calculated." The target's Cover Condition is removed.
 */
registerPostRoll(async (actor, results, checkContext, { hits } = {}) => {
  if (!checkContext?.isAttack || checkContext.isMelee || !has(actor, O3.whatCover)) {
    return;
  }

  for (const { target, hit } of hits ?? []) {
    if (hit && target?.statuses?.has?.('cover')) {
      await writeActor(target, 'toggleStatusEffect', ['cover', { active: false }]);
      await say(actor, T('O3WhatCoverDestroyed', { target: escape(target.name) }));
    }
  }
});

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
  const { applyTimedCondition } = await import("../../timed-status.mjs");
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

/* -------------------------------------------- */
/*  Overcharge Engines                           */
/* -------------------------------------------- */

/*
 * Overcharge Engines (TF CRB, Scientist, 13th level, p.79): "Once per turn, make a Technology Skill
 * Test as a Free action. Until the end of your turn, increase your Movements a number of feet equal to
 * your Skill Test results, rounded up to the nearest 5. This movement ignores Rough Terrain
 * penalties." Multiplication (p.80) doubles that to twice per turn; each use adds its own feet.
 */
const OVERCHARGE_FLAG = 'o3Overcharge';

export function overchargeUsesLeft(actor) {
  const record = actor?.flags?.essence20?.[OVERCHARGE_FLAG];
  const used = record && sameTurn(record.stamp, turnStamp()) ? num(record.uses ?? 1) : 0;
  return (has(actor, O3.multiplication) ? 2 : 1) - used;
}

export function overchargeFeet(total) {
  return Math.ceil(Math.max(0, num(total)) / 5) * 5;
}

export function overchargeBonus(actor) {
  const record = actor?.flags?.essence20?.[OVERCHARGE_FLAG];
  return record && sameTurn(record.stamp, turnStamp()) ? num(record.feet) : 0;
}

registerUse({
  id: 'o3Overcharge',
  matches: item => isItem(item, O3.overchargeEngines),
  canUse: item => !!game.combat && overchargeUsesLeft(item.parent) > 0,
  run: async (item, economy, pay) => {
    const actor = item.parent;
    if (!(await pay('free'))) {
      return null;
    }

    const roll = await rollSkillTotal(actor, 'technology');
    if (roll?.total == null) {
      return null;
    }

    const feet = overchargeFeet(roll.total);
    const earlier = overchargeBonus(actor);
    const record = actor.flags?.essence20?.[OVERCHARGE_FLAG];
    const uses = earlier && sameTurn(record?.stamp, turnStamp()) ? num(record.uses ?? 1) + 1 : 1;
    await actor.setFlag('essence20', OVERCHARGE_FLAG, { stamp: turnStamp(), feet: earlier + feet, uses });
    return T('O3OverchargeLine', { name: escape(actor.name), feet });
  },
});

registerDerived((actor) => {
  const feet = overchargeBonus(actor);
  if (!feet) {
    return;
  }

  for (const move of Object.values(actor.system?.movement ?? {})) {
    if (move && typeof move == 'object' && num(move.total) > 0) {
      move.total = num(move.total) + feet;
    }
  }
});

registerTurnEnd(async (actor) => {
  if (actor?.flags?.essence20?.[OVERCHARGE_FLAG]) {
    await actor.unsetFlag('essence20', OVERCHARGE_FLAG);
  }
});

Hooks.once?.('ready', async () => {
  const rough = await import("../../rough-terrain.mjs");
  rough.ROUGH_TERRAIN_IGNORERS?.push({ checkFn: actor => overchargeBonus(actor) > 0 });
});

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
    const { pickCanvasPoint } = await import("../../forced-movement.mjs");
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
/*  Precise Chronometrics                        */
/* -------------------------------------------- */

/*
 * Precise Chronometrics (Enigma of Combination, Combiner role, 10th level, p.29): "you can grant
 * bonuses to your own and your allies' Initiative Skill Test results that total no more than your
 * Smarts Essence. You can choose these bonuses after everyone has rolled." Once per combat, from the
 * Use button; the GM's client writes other players' Initiative (a card button when a player uses it).
 */
const CHRONO_KEY = 'o3Chronometrics';

export function chronoValid(bonuses, cap) {
  const total = Object.values(bonuses).reduce((sum, value) => sum + Math.max(0, num(value)), 0);
  return total > 0 && total <= cap;
}

async function applyChrono(combat, bonuses) {
  for (const [id, bonus] of Object.entries(bonuses)) {
    const combatant = combat?.combatants?.get?.(id);
    if (combatant && combatant.initiative != null && num(bonus) > 0) {
      await combatant.update({ initiative: num(combatant.initiative) + num(bonus) });
    }
  }
}

registerUse({
  id: 'o3Chronometrics',
  matches: item => isItem(item, O3.preciseChronometrics),
  canUse: item => !!game.combat && item.parent?.flags?.essence20?.[CHRONO_KEY] != game.combat.id,
  run: async (item) => {
    const actor = item.parent;
    const combat = game.combat;
    const cap = num(actor.system?.essences?.smarts?.max ?? actor.system?.essences?.smarts?.value);
    const rows = (combat.combatants?.contents ?? [...combat.combatants]).filter(c => c.actor && c.initiative != null && sameSide(c.actor, actor));
    const bonuses = await foundry.applications.api.DialogV2.wait({
      window: { title: item.name },
      classes: ["window-app", "e20-window"],
      content: `<p>${T('O3ChronoPrompt', { cap })}</p>${rows.map(c => `<div class="form-group"><label>${escape(c.name)} (${c.initiative})</label><input type="number" name="${c.id}" value="0" min="0" max="${cap}" /></div>`).join('')}`,
      buttons: [
        { action: 'ok', label: game.i18n.localize('E20.DialogConfirmButton'), default: true,
          callback: (event, button) => Object.fromEntries(rows.map(c => [c.id, num(button.form.elements[c.id]?.value)])) },
        { action: 'cancel', label: game.i18n.localize('E20.DialogCancelButton') },
      ],
      rejectClose: false,
    });
    if (!bonuses || typeof bonuses != 'object') {
      return null;
    }

    if (!chronoValid(bonuses, cap)) {
      ui.notifications.warn(T('O3ChronoTooMuch', { cap }));
      return null;
    }

    await actor.setFlag('essence20', CHRONO_KEY, combat.id);
    const list = rows.filter(c => num(bonuses[c.id]) > 0).map(c => `${escape(c.name)} +${num(bonuses[c.id])}`).join(', ');
    if (game.user.isGM || rows.every(c => c.isOwner || !num(bonuses[c.id]))) {
      await applyChrono(combat, bonuses);
      return T('O3ChronoApplied', { name: escape(actor.name), list });
    }

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<p>${T('O3ChronoApplied', { name: escape(actor.name), list })}</p><button type="button" data-e20-ext="o3Chrono" data-combat="${combat.id}" data-bonuses='${JSON.stringify(bonuses)}'>${T('O3ChronoGmApply')}</button>`,
    });
    return null;
  },
});

registerChatButton('o3Chrono', async (message, button) => {
  if (!game.user?.isGM || button.dataset.done) {
    ui.notifications.warn(T('O3GmOnly'));
    return;
  }

  button.dataset.done = '1';
  let bonuses = {};
  try {
    bonuses = JSON.parse(button.dataset.bonuses ?? '{}');
  } catch (error) {
    return;
  }

  await applyChrono(game.combats?.get?.(button.dataset.combat) ?? game.combat, bonuses);
});

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

    const { chooseButtons } = await import("../../grants.mjs");
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
