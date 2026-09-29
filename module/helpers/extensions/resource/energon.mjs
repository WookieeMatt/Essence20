/**
 * Energon: the spend choke point, scene-start regain, an over-maximum bonus point, and the
 * alternate Energon strains (Decepticon Directive p.80-82).
 *
 * Every write to system.energon.normal.value passes the actor update hooks; a decrease is a
 * spend unless the writer passes `{essence20Loss: true}` or `{essence20Refund: true}`.
 *
 * Fuel Efficient (Transformers CRB, General Perk, p.109): "When you spend an Energon Point, roll a
 * d4. On a 4, regain the spent Energon Point." - one d4 per point spent, on any spend. (dice.mjs's
 * own copy on the Converting cost is removed by the integration patch so it isn't rolled twice.)
 *
 * Spark of the Ancients (Enigma of Combination, p.41): "Your maximum Energon Pool is increased by
 * 2, and you regain a single Energon Point at the beginning of any scene." (+2 is the pack AE.)
 *
 * Repair Progress, 10 minutes or less (Cobra/Con Fusion, Table 1-1, p.10): "All PCs, including
 * G.I. Joes, gain 1 bonus Energon Point. This can exceed their normal Energon point maximum, but
 * once spent, can't be regained." Kept as a Perk (the adventure's rewards are). Adding the Perk
 * gives the point; the point is the one above the maximum, so it is spent the moment Energon
 * drops from over the maximum, after which the Perk marks itself spent. A Rest (which caps Energon
 * at the maximum) leaves an unspent bonus point in place.
 */
import {
  registerApplyDialog, registerDerived, registerDialogToggles, registerRollSources,
  registerSceneAdvanced, registerUse,
} from "../../extensions.mjs";
import { activateForWindow, isActiveForWindow } from "../../scene-clock.mjs";
import { ENERGON_CAP_EXTRAS } from "./temp-resources.mjs";
import {
  IDS, T, onHook, changed, setChanged, findItem, has, isActiveGm, isItem, num, say, worldActors,
} from "./common.mjs";

const ENERGON = 'system.energon.normal.value';
const BONUS_SPENT_FLAG = 'repairBonusSpent';

/* -------------------------------------------- */
/*  Repair Progress bonus point                  */
/* -------------------------------------------- */

export function repairBonusHeld(actor) {
  const perk = findItem(actor, IDS.repairProgressEnergon);
  return perk && !perk.flags?.essence20?.[BONUS_SPENT_FLAG] ? 1 : 0;
}

ENERGON_CAP_EXTRAS.push(repairBonusHeld);

/**
 * Whether an update is the sheet's Rest/Recharge (it resets every alternate strain at once).
 */
export function isRestUpdate(changes) {
  return changed(changes, 'system.energon.dark.value') !== undefined
    && changed(changes, 'system.energon.red.value') !== undefined
    && changed(changes, ENERGON) !== undefined;
}

onHook('createItem', async (item, options, userId) => {
  if (userId != game.user?.id || !isItem(item, IDS.repairProgressEnergon) || !item.parent) {
    return;
  }

  const actor = item.parent;
  await actor.update({ [ENERGON]: num(actor.system?.energon?.normal?.value) + 1 }, { essence20Refund: true });
  await say(actor, T('ResRepairBonusGained', { name: actor.name }));
});

/* -------------------------------------------- */
/*  Before / after an Energon write              */
/* -------------------------------------------- */

onHook('preUpdateActor', (actor, changes, options) => {
  const next = changed(changes, ENERGON);
  if (next === undefined) {
    return;
  }

  const prev = num(actor.system?.energon?.normal?.value);
  const max = num(actor.system?.energon?.normal?.max);
  options.essence20PrevEnergon = prev;

  // Rest caps Energon at the maximum; an unspent bonus point rides on top of it.
  if (isRestUpdate(changes) && repairBonusHeld(actor) && num(next) <= max) {
    setChanged(changes, ENERGON, num(next) + 1);
  }
});

async function onEnergonSpend(actor, prev, spent) {
  const max = num(actor.system?.energon?.normal?.max);
  const perk = findItem(actor, IDS.repairProgressEnergon);
  if (perk && !perk.flags?.essence20?.[BONUS_SPENT_FLAG] && prev > max) {
    await perk.setFlag('essence20', BONUS_SPENT_FLAG, true);
  }

  if (has(actor, IDS.fuelEfficient)) {
    let regained = 0;
    for (let i = 0; i < spent; i++) {
      if ((await new Roll('1d4').evaluate()).total == 4) {
        regained++;
      }
    }

    if (regained) {
      await actor.update({ [ENERGON]: num(actor.system.energon.normal.value) + regained }, { essence20Refund: true });
      await say(actor, T('ResFuelEfficientLine', { name: actor.name, count: regained }));
    }
  }
}

onHook('updateActor', (actor, changes, options, userId) => {
  const next = changed(changes, ENERGON);
  if (userId != game.user?.id || next === undefined || options?.essence20Refund || options?.essence20Loss
    || options?.essence20PrevEnergon === undefined || isRestUpdate(changes)) {
    return;
  }

  const spent = options.essence20PrevEnergon - num(next);
  if (spent > 0) {
    onEnergonSpend(actor, options.essence20PrevEnergon, spent).catch(error => console.error('Essence20 | Energon spend', error));
  }
});

/* -------------------------------------------- */
/*  Spark of the Ancients                        */
/* -------------------------------------------- */

registerSceneAdvanced(async () => {
  if (!isActiveGm()) {
    return;
  }

  for (const actor of worldActors().filter(a => has(a, IDS.sparkOfTheAncients))) {
    const energon = actor.system?.energon?.normal;
    if (energon && num(energon.value) < num(energon.max)) {
      await actor.update({ [ENERGON]: num(energon.value) + 1 }, { essence20Refund: true });
      await say(actor, T('ResSparkOfTheAncients', { name: actor.name }));
    }
  }
});

/* -------------------------------------------- */
/*  Alternate Energon strains                    */
/* -------------------------------------------- */

// "Having at least one Dark Energon Point grants a user a +1 temporary bonus to Toughness and
// Evasion Defenses, and ↑1 on all Strength and Speed skills."
export function applyDarkEnergonDefenses(system) {
  if (num(system?.energon?.dark?.value) < 1) {
    return;
  }

  for (const key of ['toughness', 'evasion']) {
    const defense = system.defenses?.[key];
    if (defense && Number.isFinite(Number(defense.total))) {
      defense.total = Number(defense.total) + 1;
      if (typeof defense.string == 'string' && defense.string) {
        defense.string += ' + 1 (Dark Energon)';
      }
    }
  }
}

registerDerived(actor => applyDarkEnergonDefenses(actor.system));

const PRIMAL_FLAG = 'primalEnergonScene';
const RED_TURN_FLAG = 'redEnergonTurn';
const PRIMAL_UP = ['alertness', 'animalHandling', 'survival'];

/** The ↑/↓ the strains give a roll. */
export function strainSources(actor, { rolledSkill, rolledEssence }, { primalActive, redActive }) {
  const sources = [];
  const physical = ['strength', 'speed'].includes(rolledEssence);
  if (physical && num(actor.system?.energon?.dark?.value) >= 1) {
    sources.push({ id: 'darkEnergon', label: T('ResDarkEnergonSource'), shiftUp: 1 });
  }

  if (physical && redActive) {
    sources.push({ id: 'redEnergon', label: T('ResRedEnergonSource'), shiftUp: 1 });
  }

  // Primal Energon: "↑1 to all Strength-based skills, Alertness, Animal Handling, and Survival for
  // one scene. However, while these bonuses are in effect, the user also suffers ↓1 to all other
  // Smarts- and Social- based skills."
  if (primalActive) {
    if (rolledEssence == 'strength' || PRIMAL_UP.includes(rolledSkill)) {
      sources.push({ id: 'primalEnergon', label: T('ResPrimalEnergonSource'), shiftUp: 1 });
    } else if (['smarts', 'social'].includes(rolledEssence)) {
      sources.push({ id: 'primalEnergonDown', label: T('ResPrimalEnergonSource'), shiftDown: 1 });
    }
  }

  return sources;
}

function redActive(actor) {
  const stamp = actor?.flags?.essence20?.[RED_TURN_FLAG];
  const combat = game.combat;
  return !!stamp && !!combat && stamp.combatId == combat.id && stamp.round == combat.round && stamp.turn == combat.turn;
}

registerRollSources((actor, target, ctx) => ({
  sources: strainSources(actor, ctx ?? {}, { primalActive: isActiveForWindow(actor, PRIMAL_FLAG, 'scene'), redActive: redActive(actor) }),
}));

function synthStable(actor) {
  return !!actor?.flags?.essence20?.synthEnStable;
}

// Spend-for-Edge on a Strength or Speed test: Dark ("spend 1 Dark Energon Point to gain Edge on a
// Strength- or Speed-based Skill Test"), Red ("or gain Edge on a single Strength- or Speed-based
// Skill Test"), and unstable Synth-En ("functions exactly like Red Energon"). Stable Synth-En
// spends "in the same way as normal Energon Points" - a ↑1 like the dialog's own Energon spend -
// with its d6 surcharge.
registerDialogToggles((actor, { rolledEssence }) => {
  const toggles = [];
  const energon = actor.system?.energon ?? {};
  const physical = ['strength', 'speed'].includes(rolledEssence);
  if (physical && num(energon.dark?.value) > 0) {
    toggles.push({ name: 'resDarkEdge', label: T('ResDarkEnergonEdge'), type: 'checkbox' });
  }

  if (physical && num(energon.red?.value) > 0) {
    toggles.push({ name: 'resRedEdge', label: T('ResRedEnergonEdge'), type: 'checkbox' });
  }

  if (num(energon.synthEn?.value) > 0) {
    if (!synthStable(actor) && physical) {
      toggles.push({ name: 'resSynthEdge', label: T('ResSynthEnEdge'), type: 'checkbox' });
    } else if (synthStable(actor)) {
      toggles.push({ name: 'resSynthShift', label: T('ResSynthEnShift'), type: 'checkbox' });
    }
  }

  return toggles;
});

/**
 * Stable Synth-En's surcharge: "roll 1d6. If the result is equal to or higher than the character's
 * remaining standard Energon Points, the character must spend a standard Energon Point
 * immediately to achieve the effect desired."
 * @returns {'synth'|'normal'|'fail'}   Which point pays for it.
 */
export function synthEnPayer(d6, normalLeft) {
  if (d6 < normalLeft) {
    return 'synth';
  }

  return normalLeft > 0 ? 'normal' : 'fail';
}

registerApplyDialog(async (actor, options) => {
  const ext = options.ext ?? {};
  const energon = actor.system?.energon ?? {};
  const update = {};
  const spent = [];
  if (ext.resDarkEdge && num(energon.dark?.value) > 0) {
    options.edge = true;
    update['system.energon.dark.value'] = num(energon.dark.value) - 1;
    spent.push('dark');
  }

  if (ext.resRedEdge && num(energon.red?.value) > 0) {
    options.edge = true;
    update['system.energon.red.value'] = num(energon.red.value) - 1;
  }

  if (ext.resSynthEdge && num(energon.synthEn?.value) > 0) {
    options.edge = true;
    update['system.energon.synthEn.value'] = num(energon.synthEn.value) - 1;
  }

  if (ext.resSynthShift && num(energon.synthEn?.value) > 0) {
    const d6 = (await new Roll('1d6').evaluate()).total;
    const payer = synthEnPayer(d6, num(energon.normal?.value));
    if (payer == 'synth') {
      update['system.energon.synthEn.value'] = num(energon.synthEn.value) - 1;
      options.shiftUp = num(options.shiftUp) + 1;
    } else if (payer == 'normal') {
      update[ENERGON] = num(energon.normal.value) - 1;
      options.shiftUp = num(options.shiftUp) + 1;
    }

    await say(actor, T(`ResSynthEnPay.${payer}`, { name: actor.name, d6 }));
  }

  if (Object.keys(update).length) {
    await actor.update(update);
  }

  if (spent.includes('dark')) {
    await darkEnergonAddiction(actor);
  }
});

/* -------------------------------------------- */
/*  Dark Energon addiction                       */
/* -------------------------------------------- */

const ADDICTION_LADDER = ['d6', 'd8', 'd10', 'd12', '2d8', '3d6'];
const ADDICTION_FLAG = 'darkEnergonUses';

/** The addiction attack's skill die after this many earlier uses, or 'auto' past the top. */
export function addictionDie(previousUses) {
  return ADDICTION_LADDER[previousUses] ?? 'auto';
}

// "Dark Energon is highly addictive, making an attack against the Willpower of anyone who uses it,
// starting with a base skill level of +d6 and gaining ↑1 for each time used until it automatically
// succeeds. When the attack succeeds, the subject gains the Addicted (Dark Energon) Hang-Up."
export async function darkEnergonAddiction(actor) {
  if (has(actor, IDS.addictedDarkEnergon)) {
    return;
  }

  const uses = num(actor.flags?.essence20?.[ADDICTION_FLAG]);
  await actor.setFlag('essence20', ADDICTION_FLAG, uses + 1);
  const die = addictionDie(uses);
  const willpower = num(actor.system?.defenses?.willpower?.total);
  let hit = true;
  let total = '-';
  if (die != 'auto') {
    // Word of Unicron (Decepticon Directive p.67): "Dark Energon addiction 'attacks' ... against you suffer Snag."
    const snag = has(actor, 'Compendium.essence20.decepticon_directive.Item.liMchvrumE1wB8Rc');
    const roll = await new Roll(`${snag ? '2d20kl' : '1d20'} + ${die.startsWith('d') ? `1${die}` : die}`).evaluate();
    total = roll.total;
    hit = roll.total >= willpower;
  }

  await say(actor, T(hit ? 'ResDarkAddictionHit' : 'ResDarkAddictionMiss', { name: actor.name, die, total, willpower }));
  if (hit) {
    const { grantCopy } = await import("../../grants.mjs");
    await grantCopy(actor, IDS.addictedDarkEnergon);
  }
}

/* -------------------------------------------- */
/*  The strain items' Use buttons                */
/* -------------------------------------------- */

const STRAINS = {
  [IDS.darkEnergon]: 'dark',
  [IDS.primalEnergon]: 'primal',
  [IDS.redEnergon]: 'red',
  [IDS.synthEn]: 'synthEn',
};

export function strainOf(item) {
  for (const [uuid, key] of Object.entries(STRAINS)) {
    if (isItem(item, uuid)) {
      return key;
    }
  }

  return null;
}

/** Points a dose gives: "The amount of Primal Energon Points gained ... is double". */
export function pointsPerDose(strain) {
  return strain == 'primal' ? 2 : 1;
}

async function consume(actor, item, strain) {
  const quantity = num(item.system?.quantity);
  if (quantity < 1) {
    ui.notifications.warn(T('ResStrainNoneLeft', { name: item.name }));
    return null;
  }

  const gained = pointsPerDose(strain);
  await item.update({ 'system.quantity': quantity - 1 });
  await actor.update({ [`system.energon.${strain}.value`]: num(actor.system.energon?.[strain]?.value) + gained });
  if (strain == 'dark') {
    await darkEnergonAddiction(actor);
  }

  return T('ResStrainConsumed', { name: actor.name, item: item.name, count: gained });
}

async function runStrain(item) {
  const actor = item.parent;
  const strain = strainOf(item);
  const { chooseButtons, rollTest } = await import("../../grants.mjs");
  const pool = num(actor.system.energon?.[strain]?.value);
  const choices = [['consume', T('ResStrainConsume')]];
  if (strain == 'primal' && pool > 0) {
    choices.push(['primal', T('ResPrimalEnergonAwaken')]);
  }

  if ((strain == 'red' || (strain == 'synthEn' && !synthStable(actor))) && pool > 0 && game.combat) {
    choices.push(['red', T('ResRedEnergonTurn')]);
  }

  if (strain == 'synthEn' && !synthStable(actor)) {
    choices.push(['stabilize', T('ResSynthEnStabilize')]);
  }

  const pick = await chooseButtons(item.name, T('ResStrainPrompt', { pool }), choices);
  if (pick == 'consume') {
    return consume(actor, item, strain);
  }

  if (pick == 'primal') {
    await actor.update({ 'system.energon.primal.value': pool - 1 });
    await activateForWindow(actor, PRIMAL_FLAG, 'scene');
    return T('ResPrimalEnergonLine', { name: actor.name });
  }

  if (pick == 'red') {
    await actor.update({ [`system.energon.${strain}.value`]: pool - 1 });
    const combat = game.combat;
    await actor.setFlag('essence20', RED_TURN_FLAG, { combatId: combat.id, round: combat.round, turn: combat.turn });
    return T('ResRedEnergonLine', { name: actor.name });
  }

  if (pick == 'stabilize') {
    // "A character who succeeds at a DIF 16 Science (Chemistry or Physics) Skill Test can
    // stabilize Synth-En into its blue-green state."
    const { success } = await rollTest(actor, 'science', 16);
    if (success) {
      await actor.setFlag('essence20', 'synthEnStable', true);
    }

    return T(success ? 'ResSynthEnStable' : 'ResSynthEnUnstable', { name: actor.name });
  }

  return null;
}

registerUse({
  id: 'resEnergonStrain',
  matches: item => !!strainOf(item),
  run: runStrain,
});
