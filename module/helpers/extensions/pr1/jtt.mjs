/**
 * A Jump Through Time (Power Rangers) items for the pr1 slice.
 *
 * - Chronicler, Hang-Up (p.18): "After failing any Skill Test about accessing your chronicled
 *   information, you gain the Impaired Condition for the next minute." A roll-dialog checkbox marks
 *   the test as one about the chronicle; failing it applies Impaired for 10 rounds.
 * - Cloud Hatchet (p.80): "Can be used to generate Aerial Movement value of 30ft" - while it's
 *   equipped the wielder's Aerial Movement is at least 30ft.
 * - Mobile Headquarters, Zord Feature (p.83): "+1 to Culture, Science, and Technology Skill Tests
 *   performed by those in the control area" (↑1 for everyone seated in the Zord); "Adds Edge to the
 *   Initiative rolls of all allied vehicles and Zords within the scene"; "Allows a Megaform your Zord
 *   is part of to use the highest Initiative Skill of its component Zords, with Edge."
 * - Overdrive, Zord Feature (p.83-84): "You or any passengers may activate one of the following
 *   abilities by spending 1 Personal Power... up to 3 Personal Power per turn... a different option
 *   for each": +1 to Energy-damage attacks until the end of your turn; +20ft to all Movement until
 *   the end of your turn; Accurate (↑1) on one ranged Attack; ↑2 to Group Skill Tests made by the
 *   Zord's pilot until the beginning of their next turn. Prerequisite: Personal Power Capacity 4+.
 * - Personal Heirloom (p.55) - the "piece of standard equipment" half. helpers/personal-heirloom.mjs
 *   only lets a weapon be designated (the one kind of item a roll can be traced to); an Heirloom
 *   that is equipment is offered as a roll-dialog checkbox (↑1) when no weapon has been designated.
 * - Profiteer, Hang-Up (p.22): "During a scene where anyone asks how or where you acquired your
 *   wealth or a piece of equipment, you suffer ↓1 on all Social-based Skill Tests for one minute."
 *   Ticking the dialog's "questioned" box starts the minute (10 rounds, or the rest of the scene out
 *   of combat); every Social test inside it takes the ↓1 automatically.
 * - Prospector Toolkit (p.68): "a character with a Prospector Toolkit can gain a 1d4 bonus to any
 *   Wealth Test once per week of steady use. This bonus can be increased to 1d8 with a successful DIF
 *   16 Survival Skill Test." A Use button (once per mission - this system's downtime clock) banks
 *   the die, optionally rolling the Survival test first; the next Wealth Test adds it to the roll.
 * - Time Displaced, Hang-Up (p.23): "Anytime you are confronted with a Skill Test in a situation you
 *   should not be familiar with due to your current era, you suffer ↓2. Additionally... the die
 *   rolled for [a Continuum Anomaly] Test is one size higher." A dialog checkbox for the ↓2 and a
 *   Use button rolling the Continuum Anomaly risk die (p.113, Table 4-7) one size larger.
 * - Warhead Magazines, Zord Feature (p.84): "choose three damage types from this list... By spending
 *   a Free action before making a Zord Attack using the Area of Effect trait, you may change the base
 *   damage of that Attack to any of the chosen damage types... can be acquired multiple times,
 *   adding three new damage types." Picked when the Feature lands (or from its Use button); the
 *   dialog offers the switch on the Zord's Area attacks and the hit card gets an Apply button for
 *   the chosen type.
 */
import {
  registerApplyDialog, registerDerived, registerDialogToggles, registerHitRider, registerPostRoll,
  registerPreRoll, registerRollSources, registerUse,
} from "../../extensions.mjs";
import { getSceneEpoch, getUses, markUsed } from "../../scene-clock.mjs";
import {
  PR1, T, allSourced, clearPending, componentsOf, crewOf, driverOf, equipped, findSourced, flagOf, has, isAllyOf,
  isAreaAttack, isItem, isRanged, isThisTurn, isUntilLive, kept, num, payAction, pending,
  postLine, sceneActors, seatsOf, setPending, turnStamp, untilNextTurn, writeDoc,
} from "./common.mjs";

const socialSkill = (skill, essence) => essence == 'social' || globalThis.CONFIG?.E20?.skillToEssence?.[skill] == 'social';

/* -------------------------------------------- */
/*  Chronicler Hang-Up                           */
/* -------------------------------------------- */

registerDialogToggles((actor, { item } = {}) => {
  if (!has(actor, PR1.chronicler) || item?.type == 'weaponEffect') {
    return [];
  }

  return [{ name: 'pr1Chronicler', label: T('Pr1ChroniclerToggle'), type: 'checkbox', value: false }];
});

registerApplyDialog((actor, options) => {
  if (options.ext?.pr1Chronicler) {
    setPending(actor, { chronicler: true });
  }
});

export async function chroniclerPostRoll(actor, results) {
  if (!pending(actor).chronicler || !results?.length || results.some(r => r.success)) {
    return false;
  }

  const { applyTimedCondition } = await import("../../timed-status.mjs");
  // "for the next minute" - ten 6-second rounds.
  await applyTimedCondition(actor, 'impaired', 10);
  await postLine(actor, T('Pr1ChroniclerImpaired', { name: actor.name }));
  return true;
}

registerPostRoll((actor, results) => chroniclerPostRoll(actor, results));

/* -------------------------------------------- */
/*  Cloud Hatchet                                */
/* -------------------------------------------- */

export function cloudHatchetDerived(actor) {
  const aerial = actor?.system?.movement?.aerial;
  if (aerial && equipped(actor, PR1.cloudHatchet)) {
    aerial.total = Math.max(num(aerial.total), 30);
  }
}

/* -------------------------------------------- */
/*  Mobile Headquarters                          */
/* -------------------------------------------- */

const MHQ_SKILLS = ['culture', 'science', 'technology'];

export function mobileHqSources(actor, rolledSkill) {
  if (!MHQ_SKILLS.includes(rolledSkill)) {
    return [];
  }

  const seat = seatsOf(actor).find(({ vehicle }) => has(vehicle, PR1.mobileHeadquarters));
  return seat ? [{ id: 'pr1MobileHq', label: findSourced(seat.vehicle, PR1.mobileHeadquarters).name, shiftUp: 1 }] : [];
}

const SHIFTS = () => globalThis.CONFIG?.E20?.skillShiftList ?? [];

export function mobileHqDerived(actor) {
  const system = actor?.system;
  if (!system?.skills || !['zord', 'vehicle', 'megaform'].includes(actor.type)) {
    return;
  }

  const initSkill = system.initiative?.skill ?? 'initiative';
  const skill = system.skills[initSkill];
  if (!skill) {
    return;
  }

  if (actor.type == 'megaform') {
    const parts = componentsOf(actor);
    if (!parts.some(zord => has(zord, PR1.mobileHeadquarters))) {
      return;
    }

    // "use the highest Initiative Skill of its component Zords, with Edge."
    const list = SHIFTS();
    for (const zord of parts) {
      const theirs = zord.system?.skills?.[zord.system?.initiative?.skill ?? 'initiative']?.shift;
      if (list.includes(theirs) && list.indexOf(theirs) < list.indexOf(skill.shift)) {
        skill.shift = theirs;
      }
    }

    skill.edge = true;
    return;
  }

  // "Adds Edge to the Initiative rolls of all allied vehicles and Zords within the scene." The
  // holder's own Edge is derived data; the rest of the scene is checked when Initiative is rolled
  // (mobileHqInitiative), because reading other tokens' actors while this one is being prepared
  // builds their synthetic actors, which prepare in turn - an unbounded loop on world load.
  if (has(actor, PR1.mobileHeadquarters)) {
    skill.edge = true;
  }
}

/** Mobile Headquarters for the other allied vehicles and Zords in the scene, at Initiative. */
export async function mobileHqInitiative(actor, options) {
  if (!['zord', 'vehicle'].includes(actor?.type) || has(actor, PR1.mobileHeadquarters)) {
    return;
  }

  if (sceneActors().some(other => other?.type == 'zord' && other.id != actor.id && has(other, PR1.mobileHeadquarters) && isAllyOf(other, actor))) {
    options.edge = true;
  }
}

globalThis.Hooks?.once?.('init', async () => {
  const dice = await import("../../../dice.mjs");
  dice.INITIATIVE_EXTENSIONS?.push(mobileHqInitiative);
});

/* -------------------------------------------- */
/*  Overdrive                                    */
/* -------------------------------------------- */

const OVERDRIVE_FLAG = 'pr1Overdrive';
const OVERDRIVE_ACCURATE_FLAG = 'pr1OverdriveAccurate';
const OVERDRIVE_GROUP_FLAG = 'pr1OverdriveGroup';
export const OVERDRIVE_OPTIONS = ['energy', 'move', 'accurate', 'group'];
const ENERGY = new Set(['element', 'acid', 'cold', 'electric', 'emp', 'fire', 'laser', 'sonic']);

/** The options already fed this turn. */
export function overdriveUsed(zord) {
  const record = flagOf(zord, OVERDRIVE_FLAG);
  return record && isThisTurn(record.stamp) ? record.options ?? [] : [];
}

/** Who can feed the Zord: the user's own seated characters (a GM: everyone seated). */
function overdrivePayers(zord) {
  const user = globalThis.game?.user;
  return crewOf(zord).map(entry => entry.actor)
    .filter(actor => user?.isGM || actor.isOwner || actor.testUserPermission?.(user, 'OWNER'))
    .filter(actor => num(actor.system?.powers?.personal?.max) >= 4);
}

async function runOverdrive(item) {
  const zord = item.parent;
  const used = overdriveUsed(zord);
  if (used.length >= 3) {
    ui.notifications.warn(T('Pr1OverdriveSpent'));
    return null;
  }

  const payers = overdrivePayers(zord);
  if (!payers.length) {
    ui.notifications.warn(T('Pr1OverdriveNoPayer'));
    return null;
  }

  const { chooseSelect } = await import("../../grants.mjs");
  const picked = payers.length == 1 ? payers[0].uuid
    : await chooseSelect(item.name, T('Pr1OverdrivePickPayer'), payers.map(a => ({ value: a.uuid, label: a.name })));
  const payer = payers.find(a => a.uuid == picked);
  if (!payer) {
    return null;
  }

  const options = OVERDRIVE_OPTIONS.filter(o => !used.includes(o)).map(value => ({ value, label: T(`Pr1Overdrive.${value}`) }));
  const choice = await chooseSelect(item.name, T('Pr1OverdrivePick'), options);
  if (!choice) {
    return null;
  }

  const power = num(payer.system?.powers?.personal?.value);
  if (power < 1) {
    ui.notifications.warn(T('Pr1NoPower', { name: payer.name }));
    return null;
  }

  await writeDoc(payer, 'update', { 'system.powers.personal.value': power - 1 });
  await writeDoc(zord, 'setFlag', 'essence20', OVERDRIVE_FLAG, { stamp: turnStamp(), options: [...used, choice] });
  if (choice == 'accurate') {
    await writeDoc(zord, 'setFlag', 'essence20', OVERDRIVE_ACCURATE_FLAG, true);
  }

  const pilot = driverOf(zord);
  if (choice == 'group' && pilot) {
    await writeDoc(pilot, 'setFlag', 'essence20', OVERDRIVE_GROUP_FLAG, untilNextTurn(pilot));
  }

  return T('Pr1OverdriveLine', { name: payer.name, zord: zord.name, option: T(`Pr1Overdrive.${choice}`) });
}

registerUse({
  id: 'pr1-overdrive',
  matches: item => isItem(item, PR1.overdrive) && item.parent?.type == 'zord',
  canUse: item => overdriveUsed(item.parent).length < 3,
  run: item => runOverdrive(item),
});

export function overdriveDerived(actor) {
  if (actor?.type != 'zord' || !overdriveUsed(actor).includes('move')) {
    return;
  }

  // "+20ft to all Movement values until the end of your turn"
  for (const movement of Object.values(actor.system?.movement ?? {})) {
    if (movement && num(movement.total) > 0) {
      movement.total = num(movement.total) + 20;
    }
  }
}

export function overdriveSources(actor, { item, isAttack } = {}) {
  if (actor?.type == 'zord' && isAttack && isRanged(item) && flagOf(actor, OVERDRIVE_ACCURATE_FLAG)) {
    return [{ id: 'pr1OverdriveAccurate', label: T('Pr1OverdriveAccurateLabel'), shiftUp: 1 }];
  }

  return [];
}

registerDialogToggles(actor => {
  if (!isUntilLive(flagOf(actor, OVERDRIVE_GROUP_FLAG))) {
    return [];
  }

  return [{ name: 'pr1OverdriveGroup', label: T('Pr1OverdriveGroupToggle'), type: 'checkbox', value: false }];
});

registerHitRider((actor, target, result, rider, tools) => {
  if (actor?.type != 'zord' || !overdriveUsed(actor).includes('energy') || !result?.damageValue) {
    return;
  }

  const effect = rider?.itemUuid ? globalThis.fromUuidSync?.(rider.itemUuid) : null;
  if (ENERGY.has(effect?.system?.damageType)) {
    tools.damageBonusNote(result, 1, findSourced(actor, PR1.overdrive)?.name ?? 'Overdrive');
  }
});

/* -------------------------------------------- */
/*  Personal Heirloom (equipment)                */
/* -------------------------------------------- */

export function heirloomIsEquipment(actor) {
  if (!has(actor, PR1.personalHeirloom)) {
    return false;
  }

  const designated = flagOf(actor, 'personalHeirloomItemId');
  const weapon = designated ? actor.items?.get?.(designated) : null;
  return !weapon || weapon.type != 'weapon';
}

registerDialogToggles((actor, { item } = {}) => {
  if (item?.type == 'weaponEffect' || !heirloomIsEquipment(actor)) {
    return [];
  }

  return [{ name: 'pr1Heirloom', label: T('Pr1HeirloomToggle'), type: 'checkbox', value: false }];
});

/* -------------------------------------------- */
/*  Profiteer Hang-Up                            */
/* -------------------------------------------- */

const PROFITEER_FLAG = 'pr1ProfiteerQuestioned';

export function profiteerLive(actor) {
  const record = flagOf(actor, PROFITEER_FLAG);
  if (!record || record.scene != getSceneEpoch()) {
    return false;
  }

  const combat = globalThis.game?.combat;
  if (record.combatId && combat?.id == record.combatId) {
    return combat.round < record.round + 10;
  }

  return !record.combatId;
}

export function profiteerSources(actor, rolledSkill, rolledEssence) {
  if (has(actor, PR1.profiteerHangUp) && socialSkill(rolledSkill, rolledEssence) && profiteerLive(actor)) {
    return [{ id: 'pr1Profiteer', label: findSourced(actor, PR1.profiteerHangUp).name, shiftDown: 1 }];
  }

  return [];
}

registerDialogToggles((actor, { rolledSkill, rolledEssence } = {}) => {
  if (!has(actor, PR1.profiteerHangUp) || !socialSkill(rolledSkill, rolledEssence) || profiteerLive(actor)) {
    return [];
  }

  return [{ name: 'pr1Profiteer', label: T('Pr1ProfiteerToggle'), type: 'checkbox', value: false }];
});

/* -------------------------------------------- */
/*  Prospector Toolkit                           */
/* -------------------------------------------- */

const PROSPECTOR_FLAG = 'pr1ProspectorDie';
const PROSPECTOR_USED = 'pr1ProspectorWeek';
const MORE_HEADS = 'pendingMoreHeads';

registerUse({
  id: 'pr1-prospector-toolkit',
  matches: item => isItem(item, PR1.prospectorToolkit),
  canUse: item => !getUses(item.parent, PROSPECTOR_USED, 'mission') && !flagOf(item.parent, PROSPECTOR_FLAG),
  run: async (item) => {
    const actor = item.parent;
    const { chooseButtons, rollTest } = await import("../../grants.mjs");
    const how = await chooseButtons(item.name, T('Pr1ProspectorPrompt'), [['plain', T('Pr1ProspectorPlain')], ['survival', T('Pr1ProspectorSurvival')]]);
    if (!how) {
      return null;
    }

    let die = '1d4';
    if (how == 'survival' && (await rollTest(actor, 'survival', 16)).success) {
      die = '1d8';
    }

    await markUsed(actor, PROSPECTOR_USED, { window: 'mission' });
    await actor.setFlag('essence20', PROSPECTOR_FLAG, die);
    return T('Pr1ProspectorLine', { name: actor.name, die });
  },
});

/**
 * The banked die rides the system's own bonus-die bank (the same one More Heads are Better than One
 * uses, read just before the Roll Options Dialog) - but only for a Wealth Test. Any other roll puts
 * it back, so a cancelled Wealth dialog doesn't leak the die onto the next unrelated roll.
 */
export async function prospectorPreRoll(actor, dataset) {
  const heads = flagOf(actor, MORE_HEADS);
  if (dataset?.skill != 'wealth') {
    if (heads?.pr1Prospector) {
      await actor.setFlag('essence20', PROSPECTOR_FLAG, heads.pr1Prospector);
      if (heads.pr1Previous) {
        await actor.setFlag('essence20', MORE_HEADS, heads.pr1Previous);
      } else {
        await actor.unsetFlag('essence20', MORE_HEADS);
      }
    }

    return;
  }

  const die = flagOf(actor, PROSPECTOR_FLAG);
  if (!die || heads?.pr1Prospector) {
    return;
  }

  await actor.setFlag('essence20', MORE_HEADS, {
    bonusDie: heads?.bonusDie ? `${heads.bonusDie} + ${die}` : die,
    combatId: globalThis.game?.combat?.id ?? null,
    round: globalThis.game?.combat?.round ?? null,
    pr1Prospector: die,
    pr1Previous: heads ?? null,
  });
  await actor.unsetFlag('essence20', PROSPECTOR_FLAG);
}

/* -------------------------------------------- */
/*  Time Displaced Hang-Up                       */
/* -------------------------------------------- */

registerDialogToggles(actor => (has(actor, PR1.timeDisplaced)
  ? [{ name: 'pr1TimeDisplaced', label: T('Pr1TimeDisplacedToggle'), type: 'checkbox', value: false }]
  : []));

const LADDER = ['1d2', '1d4', '1d6', '1d8', '1d10', '1d12', '2d8'];
export const largerDie = formula => LADDER[Math.min(LADDER.length - 1, Math.max(0, LADDER.indexOf(formula)) + 1)];

registerUse({
  id: 'pr1-time-displaced',
  matches: item => isItem(item, PR1.timeDisplaced),
  run: async (item) => {
    const { RISK_DICE, anomalyBand } = await import("../resource/story-spend.mjs");
    const { chooseSelect } = await import("../../grants.mjs");
    const risk = await chooseSelect(item.name, T('ResAnomalyPrompt'),
      Object.keys(RISK_DICE).map(key => ({ value: key, label: T(`ResAnomalyRisk.${key}`) })));
    if (!risk) {
      return null;
    }

    const formula = largerDie(RISK_DICE[risk]);
    const roll = await new Roll(formula).evaluate();
    // The GM rolls this in secret (p.113).
    await roll.toMessage?.({
      speaker: ChatMessage.getSpeaker({ actor: item.parent }),
      flavor: T('Pr1TimeDisplacedFlavor', { formula, band: T(`ResAnomalyBand.${anomalyBand(roll.total)}`) }),
    }, { rollMode: 'blindroll' });
    return T('Pr1TimeDisplacedLine', { name: item.parent?.name ?? '' });
  },
});

/* -------------------------------------------- */
/*  Warhead Magazines                            */
/* -------------------------------------------- */

export const WARHEAD_TYPES = ['acid', 'blunt', 'cold', 'electric', 'emp', 'element', 'fire', 'sharp', 'sonic', 'stun'];
const WARHEAD_FLAG = 'pr1WarheadTypes';

export function warheadChoices(zord) {
  return [...new Set(allSourced(zord, PR1.warheadMagazines).flatMap(feature => flagOf(feature, WARHEAD_FLAG) ?? []))];
}

const typeLabel = type => globalThis.game?.i18n?.localize?.(globalThis.CONFIG?.E20?.damageTypes?.[type] ?? type) ?? type;

export async function pickWarheadTypes(feature) {
  const zord = feature.parent;
  const taken = warheadChoices(zord);
  const { chooseSelect } = await import("../../grants.mjs");
  const picks = [];
  for (let i = 0; i < 3; i++) {
    const options = WARHEAD_TYPES.filter(t => !taken.includes(t) && !picks.includes(t)).map(value => ({ value, label: typeLabel(value) }));
    if (!options.length) {
      break;
    }

    const choice = await chooseSelect(feature.name, T('Pr1WarheadPick', { n: i + 1 }), options);
    if (!choice) {
      return null;
    }

    picks.push(choice);
  }

  await feature.setFlag('essence20', WARHEAD_FLAG, picks);
  return T('Pr1WarheadChosen', { name: zord?.name ?? '', types: picks.map(typeLabel).join(', ') });
}

registerUse({
  id: 'pr1-warhead-magazines',
  matches: item => isItem(item, PR1.warheadMagazines),
  canUse: item => !(flagOf(item, WARHEAD_FLAG) ?? []).length,
  run: item => pickWarheadTypes(item),
});

registerDialogToggles((actor, { item } = {}) => {
  const types = actor?.type == 'zord' && isAreaAttack(actor, item) ? warheadChoices(actor) : [];
  if (!types.length) {
    return [];
  }

  return [{
    name: 'pr1Warhead', label: T('Pr1WarheadToggle'), type: 'select',
    options: [{ value: '', label: T('Pr1WarheadBase') }, ...types.map(value => ({ value, label: typeLabel(value) }))],
    value: '',
  }];
});

registerHitRider((actor, target, result, rider, tools) => {
  const type = pending(actor).warhead;
  if (type && result?.damageValue) {
    tools.addRiderOption(result, { key: 'pr1Warhead', label: T('Pr1WarheadApply'), damageValue: result.damageValue, damageType: type });
  }
});

/* -------------------------------------------- */
/*  Shared hooks                                 */
/* -------------------------------------------- */

registerPreRoll(async (actor, dataset) => {
  clearPending(actor);
  await prospectorPreRoll(actor, dataset);
});

registerRollSources((actor, target, ctx = {}) => ({
  sources: [
    ...mobileHqSources(actor, ctx.rolledSkill),
    ...overdriveSources(actor, ctx),
    ...profiteerSources(actor, ctx.rolledSkill, ctx.rolledEssence),
  ],
}));

registerApplyDialog(async (actor, options, ctx = {}) => {
  const ext = options.ext ?? {};
  if (ext.pr1OverdriveGroup) {
    options.shiftUp = num(options.shiftUp) + 2;
  }

  if (ext.pr1Heirloom) {
    options.shiftUp = num(options.shiftUp) + 1;
  }

  if (ext.pr1TimeDisplaced) {
    options.shiftDown = num(options.shiftDown) + 2;
  }

  if (ext.pr1Profiteer) {
    options.shiftDown = num(options.shiftDown) + 1;
    const combat = globalThis.game?.combat;
    await actor.setFlag('essence20', PROFITEER_FLAG, { scene: getSceneEpoch(), combatId: combat?.id ?? null, round: combat?.round ?? 0 });
  }

  // Overdrive's Accurate goes on ONE ranged attack.
  if (actor?.type == 'zord' && flagOf(actor, OVERDRIVE_ACCURATE_FLAG) && isRanged(ctx.item) && kept(options, 'pr1OverdriveAccurate')) {
    await writeDoc(actor, 'unsetFlag', 'essence20', OVERDRIVE_ACCURATE_FLAG);
  }

  if (ext.pr1Warhead && (await payAction(actor, 'free', findSourced(actor, PR1.warheadMagazines)?.name))) {
    setPending(actor, { warhead: ext.pr1Warhead });
  }
});

registerDerived(actor => {
  cloudHatchetDerived(actor);
  mobileHqDerived(actor);
  overdriveDerived(actor);
});

// A Feature that needs a choice asks for it the moment it lands on a Zord, for whoever dropped it.
globalThis.Hooks?.on?.('createItem', async (item, options, userId) => {
  if (userId != globalThis.game?.user?.id || item.parent?.documentName != 'Actor') {
    return;
  }

  if (isItem(item, PR1.warheadMagazines) && !(flagOf(item, WARHEAD_FLAG) ?? []).length) {
    const line = await pickWarheadTypes(item);
    if (line) {
      await postLine(item.parent, line);
    }
  }
});

