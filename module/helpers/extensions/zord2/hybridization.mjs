/**
 * Hybridization (TF CRB, Modemaster, 2nd/7th/12th/14th/18th level, p.73-74): "you gain a
 * Hybridization. Hybridizations marked with a H require a use of Mass Shift, with the normal
 * duration unless stated otherwise." Mass Shift: "You can use Mass Shift two times per day at 1st
 * level... additional uses per day, as outlined on Table 5-10... You regain all of your Mass Shift
 * uses after a six-hour rest."
 *
 * Each copy of the Perk records its one choice (flags.essence20.zord2Hybrid) when it's added, and
 * the H choices get a Use button that spends a daily Mass Shift use:
 * - Change Size H: "Temporarily increase or decrease your Size by one full Size Class."
 * - Evasive Conversion H: "When an enemy attacks you, you can immediately Convert to give the enemy
 *   a Snag on their attack." Readied from the button; the next attack against you takes the Snag.
 * - Extra Shift: "an additional use of Mass Shift per day" (stacks).
 * - Fast Shift: "You use Mass Shift as a Free action instead of a Move action." An ActionCost rule on
 *   the pack item (the H buttons below still pay Free instead of Move with it).
 * - Half Track H: "Gain the Movement of your Alt Mode when in Bot Mode."
 * - Helping Hand: "Ignore your Origin's Limited Articulation drawback." (./snag.mjs)
 * - Hold That Shape: "You gain the benefits of Mass Shift until you use Mass Shift again or until
 *   you rest, instead of until the end of the scene." The H durations here run to the mission's
 *   end instead of the scene's.
 * - Reinforce Shell H: "Gain the benefits of an Armor Upgrade you are trained in and currently do
 *   not have equipped." A temporary copy of the picked upgrade.
 * - Replacement Part H: "Repair 1 Damage."
 * - Steady Hands H: "You do not suffer a Snag on unskilled Skill Tests." (./snag.mjs)
 * - Weaponize H: "Add a weapon which you are trained in to an External Hardpoint." A temporary copy.
 *
 * Mercurial Nature (TF CRB, Modemaster, 20th level, p.76): "you gain a
 * Hybridization, and unlimited uses of Mass Shift per day." Its Hybridization is a Grant rule on the
 * pack item (the granted copy's picker runs below); this file lifts the daily cap.
 *
 * The daily count also counts the Mass Shift Role Perk's own uses (helpers/mass-shift.mjs marks its
 * scene flag; that change is counted here).
 */
import {
  registerConsumer, registerDerived, registerRest, registerRollSources, registerUse,
} from "../../extensions.mjs";
import { activateForWindow, getUses, isActiveForWindow, markUsed } from "../../scene-clock.mjs";
import { chat, holds, itemsOf, sizeIndex, sourceOf, T, writeDoc, ZORD2 } from "./common.mjs";
import { HYBRID_FLAG, hybridsOf, STEADY_HANDS_FLAG } from "./snag.mjs";

export const HYBRIDS = ['changeSize', 'evasiveConversion', 'extraShift', 'fastShift', 'halfTrack', 'helpingHand', 'holdThatShape',
  'reinforceShell', 'replacementPart', 'steadyHands', 'weaponize'];
export const NEEDS_SHIFT = ['changeSize', 'evasiveConversion', 'halfTrack', 'reinforceShell', 'replacementPart', 'steadyHands', 'weaponize'];
const REPEATABLE = ['extraShift'];

export const DAY_FLAG = 'zord2MassShiftDay';
export const SIZE_FLAG = 'zord2HybridSize';
export const SIZE_DIR_FLAG = 'zord2HybridSizeDir';
export const HALF_TRACK_FLAG = 'zord2HalfTrack';
export const EVASIVE_FLAG = 'zord2EvasiveConversion';

/** Table 5-10: Modemaster, Mass Shift uses per day by level. */
const USES_BY_LEVEL = [2, 2, 2, 3, 3, 3, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6, 6, 6, 6, 10];

export function massShiftUsesPerDay(actor) {
  if (holds(actor, ZORD2.mercurialNature)) {
    return Infinity;
  }

  const level = Math.max(1, Math.min(20, Number(actor?.system?.level) || 1));
  return USES_BY_LEVEL[level] + hybridsOf(actor).filter(h => h == 'extraShift').length;
}

export const massShiftUsed = actor => actor?.flags?.essence20?.[DAY_FLAG] ?? 0;
export const massShiftLeft = actor => Math.max(0, massShiftUsesPerDay(actor) - massShiftUsed(actor));

/** How long an H benefit lasts: the scene, or with Hold That Shape the mission. */
const windowFor = actor => (hybridsOf(actor).includes('holdThatShape') ? 'mission' : 'scene');
const activeFor = (actor, flag) => isActiveForWindow(actor, flag, 'scene') || isActiveForWindow(actor, flag, 'mission');

/* -------------------------------------------- */
/*  Derived: Change Size, Half Track             */
/* -------------------------------------------- */

export function hybridDerived(actor) {
  const system = actor?.system;
  if (!system || !hybridsOf(actor).length) return;

  if (activeFor(actor, SIZE_FLAG)) {
    const sizes = Object.keys(CONFIG.E20?.actorSizes ?? {});
    const dir = actor.flags?.essence20?.[SIZE_DIR_FLAG] ?? 1;
    const next = sizes[Math.max(0, Math.min(sizes.length - 1, sizeIndex(system.size) + dir))];
    if (next) system.size = next;
  }

  if (activeFor(actor, HALF_TRACK_FLAG) && !system.isTransformed && system.movement) {
    for (const altMode of itemsOf(actor).filter(i => i.type == 'altMode')) {
      const alt = altMode.system?.altModeMovement ?? {};
      for (const [from, to] of [['ground', 'ground'], ['aerial', 'aerial'], ['aquatic', 'swim']]) {
        if (alt[from] && system.movement[to]) {
          system.movement[to].total = Math.max(system.movement[to].total ?? 0, alt[from]);
        }
      }
    }
  }
}

registerDerived(hybridDerived);

/* -------------------------------------------- */
/*  Evasive Conversion                           */
/* -------------------------------------------- */

export function evasiveSources(attacker, target, ctx) {
  if (!target || !ctx?.isAttack || !activeFor(target, EVASIVE_FLAG)) {
    return { sources: [], consumes: [] };
  }

  return {
    sources: [{ id: 'zord2-evasive', label: T('Zord2Hybrid.evasiveConversion'), snag: true }],
    consumes: [{ ext: 'zord2Evasive', uuid: target.uuid }],
  };
}

registerRollSources(evasiveSources);
registerConsumer('zord2Evasive', async (consume) => {
  const target = await fromUuid(consume.uuid);
  if (target) await writeDoc(target, 'unsetFlag', 'essence20', EVASIVE_FLAG);
});

/* -------------------------------------------- */
/*  Picking and using                            */
/* -------------------------------------------- */

export async function pickHybridization(perk) {
  const actor = perk.parent;
  const held = hybridsOf(actor);
  const { chooseSelect } = await import("../../grants.mjs");
  const options = HYBRIDS.filter(h => REPEATABLE.includes(h) || !held.includes(h)).map(value => ({ value, label: T(`Zord2Hybrid.${value}`) }));
  const choice = await chooseSelect(perk.name, T('Zord2HybridPick'), options);
  if (!choice) return null;
  await perk.update({
    name: `${T('Zord2HybridizationName')} (${T(`Zord2Hybrid.${choice}`)})`,
    [`flags.essence20.${HYBRID_FLAG}`]: choice,
  });
  return T('Zord2HybridChosen', { name: actor.name, choice: T(`Zord2Hybrid.${choice}`) });
}

async function useHybrid(perk, _economy, pay) {
  const actor = perk.parent;
  const choice = perk.flags?.essence20?.[HYBRID_FLAG];
  if (!choice) return pickHybridization(perk);

  if (massShiftLeft(actor) <= 0) {
    ui.notifications.warn(T('Zord2NoMassShiftLeft'));
    return null;
  }

  // Using Mass Shift is a Move action (Free with Fast Shift); Evasive Conversion happens "immediately" when attacked.
  const cost = choice == 'evasiveConversion' ? null : (hybridsOf(actor).includes('fastShift') ? 'free' : 'move');
  if (!(await pay(cost))) return null;

  const window = windowFor(actor);
  const grants = await import("../../grants.mjs");
  let line = null;
  switch (choice) {
  case 'changeSize': {
    const dir = await grants.chooseButtons(perk.name, T('Zord2HybridSizePrompt'), [['1', T('Zord2HybridSizeUp')], ['-1', T('Zord2HybridSizeDown')]]);
    if (!dir) return null;
    await actor.setFlag('essence20', SIZE_DIR_FLAG, Number(dir));
    await activateForWindow(actor, SIZE_FLAG, window);
    line = T('Zord2HybridSizeDone', { name: actor.name });
    break;
  }

  case 'evasiveConversion':
    await activateForWindow(actor, EVASIVE_FLAG, 'scene');
    line = T('Zord2HybridEvasiveDone', { name: actor.name });
    break;
  case 'halfTrack':
    await activateForWindow(actor, HALF_TRACK_FLAG, window);
    line = T('Zord2HybridHalfTrackDone', { name: actor.name });
    break;
  case 'steadyHands':
    await activateForWindow(actor, STEADY_HANDS_FLAG, 'scene');
    line = T('Zord2HybridSteadyDone', { name: actor.name });
    break;
  case 'replacementPart': {
    const health = actor.system?.health ?? {};
    await actor.update({ 'system.health.value': Math.min(health.max ?? Infinity, (health.value ?? 0) + 1) });
    line = T('Zord2HybridRepairDone', { name: actor.name });
    break;
  }

  case 'reinforceShell': {
    const rows = await grants.findItems({ type: 'upgrade', matches: entry => entry.system?.type == 'armor' });
    const uuid = await grants.pickOne(perk.name, rows);
    if (!uuid) return null;
    await grants.grantCopy(actor, uuid, { grantedBy: perk, temporary: grants.temporary('scene') });
    line = T('Zord2HybridGranted', { name: actor.name, item: rows.find(r => r.uuid == uuid)?.name ?? '' });
    break;
  }

  case 'weaponize': {
    const rows = await grants.findItems({ type: 'weapon' });
    const uuid = await grants.pickOne(perk.name, rows);
    if (!uuid) return null;
    await grants.grantCopy(actor, uuid, { grantedBy: perk, temporary: grants.temporary('scene'), system: { 'hardpoint.type': 'external' } });
    line = T('Zord2HybridGranted', { name: actor.name, item: rows.find(r => r.uuid == uuid)?.name ?? '' });
    break;
  }

  default:
    return null;
  }

  await actor.setFlag('essence20', DAY_FLAG, massShiftUsed(actor) + 1);
  return line;
}

registerUse({
  id: 'zord2-hybridization',
  matches: item => sourceOf(item) == ZORD2.hybridization,
  canUse: item => {
    const choice = item.flags?.essence20?.[HYBRID_FLAG];
    return !choice || (NEEDS_SHIFT.includes(choice) && massShiftLeft(item.parent) > 0);
  },
  run: useHybrid,
});

registerRest(async (actor) => {
  if (actor?.flags?.essence20?.[DAY_FLAG]) {
    await actor.unsetFlag('essence20', DAY_FLAG);
  }
});

if (typeof Hooks != 'undefined') {
  Hooks.on('createItem', async (item, options, userId) => {
    if (userId != game.user?.id || !item.parent) return;
    const source = sourceOf(item);
    if (source == ZORD2.hybridization && !item.flags?.essence20?.[HYBRID_FLAG]) {
      const line = await pickHybridization(item);
      if (line) await chat(item.parent, line);
    }
  });

  // The Mass Shift Role Perk's own uses come out of the same daily pool.
  Hooks.on('updateActor', async (actor, changes, options, userId) => {
    if (userId != game.user?.id || changes?.flags?.essence20?.massShiftUsedThisScene === undefined) return;
    if (holds(actor, ZORD2.hybridization) || holds(actor, ZORD2.mercurialNature)) {
      await actor.setFlag('essence20', DAY_FLAG, massShiftUsed(actor) + 1);
    }
  });
}

export { getUses, markUsed };
