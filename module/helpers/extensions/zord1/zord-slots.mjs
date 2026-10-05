import {
  registerApplyDialog, registerChatButton, registerDefenseAdjust, registerDerived, registerDialogToggles,
  registerHitRider, registerPostRoll, registerPreRoll, registerRollSources, registerTurnStart, registerUse,
} from "../../extensions.mjs";
import { getSceneEpoch } from "../../scene-clock.mjs";
import { worldActors } from "../../companion-link.mjs";
import { hasUsedThisTurn, markUsedThisTurn } from "../../perks.mjs";
import { T, ats, bth, findSourced, flagOf, itemsOf, jtt, postLine, prcrb, sourceOf, spendPower, writeActor } from "./common.mjs";

/**
 * Zord-side Perks and Zord Features:
 * - Rex Feature (A Jump Through Time, Quantum Ranger, p.47): "Upon reaching 6th Level, then again at
 *   10th, 14th, and 17th Levels... they may choose from the list of available Zord Features to apply to
 *   their incarnation of Quantasaurus Rex." - picked onto the Ranger's own Zord the moment it lands.
 * - Additional Zord (JTT General Perk, p.53): "For each instance you choose this Perk, you may add one
 *   new Zord to those you can call... You may replace your Automatic Zord Features with two Zord
 *   Features of your choice. The Spectrum-based Zord Feature for this Zord is always Auxiliary Zord.
 *   Additionally, you may only ever have one of your Zords active in a given scene."
 * - Terrorzord Nature (Beneath the Helmet, Dark Ranger, p.40).
 * - Megafauna (Across the Stars, Zord Feature, p.103) - the Zord's beast form.
 * - Anti-Armor (Attack) (Across the Stars, Zord Feature, p.103).
 * - Phantom Focus: Ship Integration (Across the Stars, Phantom Ranger, p.62).
 */

export const ZS = {
  rexFeature: jtt('tOugALzdjmKHD8Ck'),
  additionalZord: jtt('FubfmphdFHTJR1s5'),
  terrorzordNature: bth('ijVB6KM95RagxKQp'),
  terror: bth('yBBB0Mi6fr84YcSd'),
  megafauna: ats('c6plguiUVmJzGNsw'),
  antiArmor: ats('TUilm2lgtUvWyW65'),
  phantomFocus: ats('aXGMEoVsYSttOSHn'),
  phantomSuite: ats('fQgxo5c7tNOD2Q5K'),
  unseenStrike: ats('EYdpn9PL4iNrQPkh'),
  auxiliaryZord: prcrb('QO0kY1y359tSnPTS'),
};

/* -------------------------------------------- */
/*  Whose Zord is whose                          */
/* -------------------------------------------- */

export function ownedZords(pilot) {
  return Object.values(pilot?.system?.actors ?? {})
    .filter(entry => entry?.type == 'zord')
    .map(entry => globalThis.fromUuidSync?.(entry.uuid))
    .filter(Boolean);
}

/** The Ranger who holds this Zord on their sheet. */
export function zordOwner(zord) {
  if (!zord?.uuid) {
    return null;
  }

  return worldActors().find(actor => Object.values(actor?.system?.actors ?? {})
    .some(entry => entry?.type == 'zord' && entry.uuid == zord.uuid)) ?? null;
}

/** The Zord's current driver/pilot. */
export function driverOf(vehicle) {
  const entry = Object.values(vehicle?.system?.actors ?? {}).find(crew => crew?.vehicleRole == 'driver');
  return entry ? globalThis.fromUuidSync?.(entry.uuid) ?? null : null;
}

/** The Zord this pilot is sitting in the driver's seat of, if any. */
export function pilotedZord(pilot) {
  if (!pilot?.uuid) {
    return null;
  }

  return worldActors().find(actor => actor?.type == 'zord'
    && Object.values(actor.system?.actors ?? {}).some(crew => crew?.vehicleRole == 'driver' && crew.uuid == pilot.uuid)) ?? null;
}

async function pickZord(pilot, title) {
  const zords = ownedZords(pilot);
  if (!zords.length) {
    ui.notifications.warn(T('Zord1NoZord', { name: pilot?.name ?? '' }));
    return null;
  }

  if (zords.length == 1) {
    return zords[0];
  }

  const { chooseSelect } = await import("../../grants.mjs");
  const uuid = await chooseSelect(title, T('Zord1PickZord'), zords.map(zord => ({ value: zord.uuid, label: zord.name })));
  return zords.find(zord => zord.uuid == uuid) ?? null;
}

/** Pick one Zord Feature (any sourcebook) this Zord doesn't have yet and put it on the Zord. */
export async function grantZordFeature(zord, grantor, title) {
  const held = new Set(itemsOf(zord).map(sourceOf).filter(Boolean));
  const { pickAndGrant } = await import("../../grants.mjs");
  return pickAndGrant(zord, grantor, title, { type: 'feature', matches: entry => !held.has(entry.uuid) });
}

/* -------------------------------------------- */
/*  Rex Feature / Additional Zord                */
/* -------------------------------------------- */

export async function onRexFeature(pilot, perk) {
  const zord = await pickZord(pilot, perk.name);
  if (!zord) {
    return null;
  }

  const created = await grantZordFeature(zord, perk, T('Zord1ZordFeatureTitle', { name: zord.name }));
  return created ? T('Zord1ZordFeatureGained', { zord: zord.name, feature: created.name }) : null;
}

/** Additional Zord's set-up: Auxiliary Zord plus two Zord Features of your choice on the new Zord. */
export async function setUpAdditionalZord(pilot, perk) {
  const zord = await pickZord(pilot, perk.name);
  if (!zord) {
    return null;
  }

  const { grantCopy } = await import("../../grants.mjs");
  const gained = [];
  if (!findSourced(zord, ZS.auxiliaryZord)) {
    const aux = await grantCopy(zord, ZS.auxiliaryZord, { grantedBy: perk });
    if (aux) {
      gained.push(aux.name);
    }
  }

  for (let i = 0; i < 2; i++) {
    const created = await grantZordFeature(zord, perk, T('Zord1AdditionalZordPick', { n: i + 1, name: zord.name }));
    if (!created) {
      break;
    }

    gained.push(created.name);
  }

  await perk.setFlag('essence20', 'zord1AdditionalZord', zord.uuid);
  return gained.length ? T('Zord1ZordFeatureGained', { zord: zord.name, feature: gained.join(', ') }) : null;
}

/**
 * "You may only ever have one of your Zords active in a given scene." Checked as a Zord is summoned
 * (helpers/zord-summon.mjs writes zordSummonReadyRound): a second Zord of the same owner in the same
 * scene is refused.
 * @returns {Boolean} false to cancel the summon.
 */
export function checkOneZordPerScene(zord, changes) {
  const ready = changes?.flags?.essence20?.zordSummonReadyRound;
  if (zord?.type != 'zord' || ready === undefined || ready === null) {
    return true;
  }

  const owner = zordOwner(zord);
  if (!owner || !findSourced(owner, ZS.additionalZord)) {
    return true;
  }

  const epoch = getSceneEpoch();
  const active = flagOf(owner, 'zord1ActiveZord');
  if (active?.epoch == epoch && active.uuid && active.uuid != zord.uuid) {
    ui.notifications.warn(T('Zord1OneZordPerScene', { name: owner.name, zord: globalThis.fromUuidSync?.(active.uuid)?.name ?? '' }));
    return false;
  }

  writeActor(owner, 'setFlag', ['essence20', 'zord1ActiveZord', { epoch, uuid: zord.uuid }]);
  return true;
}

/* -------------------------------------------- */
/*  Terrorzord Nature                            */
/* -------------------------------------------- */

/** The Dark Ranger whose Terrorzord this is, or null. */
export function terrorzordPilot(zord) {
  if (zord?.type != 'zord') {
    return null;
  }

  const owner = zordOwner(zord);
  return owner && findSourced(owner, ZS.terrorzordNature) ? owner : null;
}

function terrorOf(pilot) {
  if (!findSourced(pilot, ZS.terror)) {
    return 0;
  }

  return Number(pilot._getBaseRolePoints?.()?.system?.resource?.value) || 0;
}

/** Who pays for a Terrorzord roll: the Zord's pilot, whether the Zord or the pilot is rolling. */
function terrorContext(actor, rolledSkill) {
  const pilot = terrorzordPilot(actor);
  if (pilot) {
    return { pilot, zord: actor };
  }

  const zord = pilotedZord(actor);
  if (zord && rolledSkill == 'driving' && terrorzordPilot(zord)?.uuid == actor?.uuid) {
    return { pilot: actor, zord };
  }

  return null;
}

/** "You can spend your accrued Terror to boost your Terrorzord, granting it ↑1 on a Skill Test for each Terror you spend." */
export function terrorToggles(actor, { rolledSkill } = {}) {
  const context = terrorContext(actor, rolledSkill);
  const terror = context ? terrorOf(context.pilot) : 0;
  return terror > 0 ? [{ name: 'zord1Terror', type: 'number', label: T('Zord1ToggleTerror', { n: terror }), max: terror, value: 0 }] : [];
}

export async function terrorApplyDialog(actor, options, { rolledSkill } = {}) {
  const spend = Math.max(0, Math.floor(Number(options.ext?.zord1Terror) || 0));
  const context = spend ? terrorContext(actor, rolledSkill) : null;
  if (!context) {
    return;
  }

  const amount = Math.min(spend, terrorOf(context.pilot));
  if (amount > 0) {
    const { spendTerror } = await import("../../terror.mjs");
    await spendTerror(context.pilot, amount);
    options.shiftUp = (Number(options.shiftUp) || 0) + amount;
  }
}

/** "You lose 1 Personal Power whenever you roll a natural 1 while driving your Terrorzord." */
export async function terrorPostRoll(actor, results, checkContext, { isFumble } = {}) {
  if (!isFumble) {
    return;
  }

  const pilot = terrorzordPilot(actor) ?? (terrorzordPilot(pilotedZord(actor))?.uuid == actor?.uuid ? actor : null);
  const driving = pilot && (actor?.type == 'zord' ? driverOf(actor)?.uuid == pilot.uuid : true);
  const power = Number(pilot?.system?.powers?.personal?.value) || 0;
  if (driving && power > 0) {
    await writeActor(pilot, 'update', [{ 'system.powers.personal.value': power - 1 }]);
    await postLine(pilot, T('Zord1TerrorzordFumble', { name: pilot.name }));
  }
}

/**
 * "It uses its movement as it wants to at the start of your turn unless you succeed on a DIF 10
 * Driving Skill Test." Asked on the Dark Ranger's turn, with a button to roll it.
 */
export async function terrorzordTurnStart(actor) {
  if (!findSourced(actor, ZS.terrorzordNature)) {
    return;
  }

  const zord = ownedZords(actor).find(z => (z.getActiveTokens?.() ?? []).length);
  if (!zord) {
    return;
  }

  await postLine(actor, `${T('Zord1TerrorzordControl', { name: actor.name, zord: zord.name })}
    <button type="button" data-e20-ext="zord1TerrorControl" data-actor="${actor.uuid}" data-zord="${zord.uuid}">${T('Zord1TerrorzordRoll')}</button>`);
}

async function onTerrorControlButton(message, button) {
  const pilot = await fromUuid(button.dataset.actor);
  const zord = await fromUuid(button.dataset.zord);
  if (!pilot?.isOwner) {
    return;
  }

  const { rollTest } = await import("../../grants.mjs");
  const { success } = await rollTest(pilot, 'driving', 10);
  await postLine(pilot, T(success ? 'Zord1TerrorzordHeld' : 'Zord1TerrorzordLoose', { zord: zord?.name ?? '' }));
}

/* -------------------------------------------- */
/*  Megafauna                                    */
/* -------------------------------------------- */

const MEGAFAUNA_FLAG = 'zord1Megafauna';
export const inMegafaunaForm = zord => !!findSourced(zord, ZS.megafauna) && !!flagOf(zord, MEGAFAUNA_FLAG);

/** "When the Zord answers its Call to Action, it arrives in its Megafauna Form". */
function megafaunaOnSummon(zord, changes) {
  const ready = changes?.flags?.essence20?.zordSummonReadyRound;
  if (zord?.type == 'zord' && ready != null && findSourced(zord, ZS.megafauna) && !flagOf(zord, MEGAFAUNA_FLAG)) {
    foundry.utils.setProperty(changes, `flags.essence20.${MEGAFAUNA_FLAG}`, true);
  }
}

/**
 * Pilot: "uses Animal Handling in place of Driving to operate the Megafauna Form."
 */
export function megafaunaPreRoll(actor, dataset) {
  if (dataset?.skill != 'driving') {
    return;
  }

  const zord = pilotedZord(actor);
  if (zord && inMegafaunaForm(zord)) {
    dataset.skill = 'animalHandling';
    dataset.essence = CONFIG.E20?.skillToEssence?.animalHandling ?? 'social';
  }
}

/* -------------------------------------------- */
/*  Anti-Armor (Attack)                          */
/* -------------------------------------------- */

const SHRED_FLAG = 'zord1ArmorShred';

/** "One of the Zord's attacks gains the Anti-Tank and Wrecker weapon traits" - pick the weapon. */
export async function pickAntiArmorWeapon(feature) {
  const zord = feature.parent;
  const weapons = itemsOf(zord).filter(item => item.type == 'weapon');
  if (!weapons.length) {
    ui.notifications.warn(T('Zord1NoZordWeapon', { name: zord?.name ?? '' }));
    return null;
  }

  const { chooseSelect } = await import("../../grants.mjs");
  const id = weapons.length == 1 ? weapons[0].id : await chooseSelect(feature.name, T('Zord1AntiArmorPrompt'), weapons.map(w => ({ value: w.id, label: w.name })));
  const weapon = weapons.find(w => w.id == id);
  if (!weapon) {
    return null;
  }

  const traits = [...new Set([...(weapon.system?.traits ?? []), 'antiTank', 'wrecker'])];
  await weapon.update({ 'system.traits': traits });
  await feature.setFlag('essence20', 'zord1AntiArmorWeapon', weapon.id);
  return T('Zord1AntiArmorSet', { weapon: weapon.name });
}

/** "Critical Effect: Reduces Target's Armor by 2 for the remainder of the scene." */
export async function antiArmorHitRider(actor, target, result, rider, tools) {
  if (!tools?.isCrit || !target || !rider?.weaponId) {
    return;
  }

  const feature = itemsOf(actor).find(item => sourceOf(item) == ZS.antiArmor && flagOf(item, 'zord1AntiArmorWeapon') == rider.weaponId);
  if (!feature) {
    return;
  }

  const epoch = getSceneEpoch();
  const current = flagOf(target, SHRED_FLAG);
  const amount = (current?.epoch == epoch ? Number(current.amount) || 0 : 0) + 2;
  await writeActor(target, 'setFlag', ['essence20', SHRED_FLAG, { epoch, amount }]);
  result.riderNote = [result.riderNote, T('Zord1AntiArmorNote', { name: target.name, n: amount })].filter(Boolean).join(' ');
}

function armorComponent(actor) {
  const toughness = actor.system?.defenses?.toughness;
  if (!toughness) {
    return 0;
  }

  if (actor.system?.isMorphed) {
    return Number(toughness.morphed) || 0;
  }

  const worn = itemsOf(actor).filter(item => item.type == 'armor' && item.system?.equipped)
    .reduce((sum, item) => sum + (parseInt(item.system?.totalBonusToughness) || 0), 0);
  return (Number(toughness.armor) || 0) + worn;
}

/* -------------------------------------------- */
/*  Phantom Focus: Ship Integration              */
/* -------------------------------------------- */

const SHIP_FLAG = 'zord1ShipIntegration';

/**
 * "While piloting your Phantom Ship, you connect your Phantom Key or Focus make the vessel part of
 * your Phantom Suite. While integrated, you may spend 1 Personal Power to allow your Phantom Ship
 * (while you are piloting it) to use your Phantom Suite and Unseen Strike Role Perks."
 * @returns {Actor|null} the integrated pilot, if the integration still holds.
 */
export function integratedPilot(ship) {
  const state = flagOf(ship, SHIP_FLAG);
  if (!state?.pilotUuid || state.epoch != getSceneEpoch()) {
    return null;
  }

  const pilot = driverOf(ship);
  return pilot?.uuid == state.pilotUuid ? pilot : null;
}

const phantomSuiteOn = pilot => !!pilot?.flags?.essence20?.phantomSuiteActive;

function phantomSuiteBonus(pilot) {
  return Number(findSourced(pilot, ZS.phantomSuite)?.system?.advances?.currentValue) || 0;
}

async function runShipIntegration(item) {
  const pilot = item.parent;
  const ship = pilotedZord(pilot) ?? worldActors().find(actor => actor?.type == 'vehicle' && driverOf(actor)?.uuid == pilot.uuid);
  if (!ship) {
    ui.notifications.warn(T('Zord1ShipNotPiloting'));
    return null;
  }

  if (integratedPilot(ship)?.uuid == pilot.uuid) {
    await writeActor(ship, 'unsetFlag', ['essence20', SHIP_FLAG]);
    return T('Zord1ShipIntegrationEnded', { name: pilot.name, ship: ship.name });
  }

  if (!(await spendPower(pilot, 1))) {
    return null;
  }

  await writeActor(ship, 'setFlag', ['essence20', SHIP_FLAG, { pilotUuid: pilot.uuid, epoch: getSceneEpoch() }]);
  return T('Zord1ShipIntegrated', { name: pilot.name, ship: ship.name });
}

/* -------------------------------------------- */
/*  Hooks into rolls and data                    */
/* -------------------------------------------- */

export function zordRollSources(actor, target, { rolledSkill } = {}) {
  const sources = [];
  // Megafauna's melee ↑1 is a rule on its pack item.

  // Ship Integration: the ship uses the pilot's Phantom Suite - "↑1 and Edge to all Infiltration
  // (Stealth) Skill Tests".
  const pilot = integratedPilot(actor);
  if (pilot && phantomSuiteOn(pilot) && rolledSkill == 'infiltration') {
    sources.push({ id: 'zord1ShipSuite', label: findSourced(pilot, ZS.phantomSuite)?.name ?? 'Phantom Suite', shiftUp: 1, edge: true });
  }

  return { sources, consumes: [] };
}

export function zordDefenseAdjust(attacker, defender, defenseType) {
  let total = 0;
  // Ship Integration: the Phantom Suite's Evasion bonus on the ship.
  const shipPilot = integratedPilot(defender);
  if (defenseType == 'evasion' && shipPilot && phantomSuiteOn(shipPilot)) {
    total += phantomSuiteBonus(shipPilot);
  }

  // Ship Integration + Unseen Strike: "On your first Attack Skill Test each turn while your Phantom
  // Suite is active, the target's Evasion Defense is halved (round up) against that Attack."
  const attackPilot = integratedPilot(attacker);
  if (defenseType == 'evasion' && attackPilot && phantomSuiteOn(attackPilot) && findSourced(attackPilot, ZS.unseenStrike)
    && !hasUsedThisTurn(attacker, 'zord1ShipUnseenStrike')) {
    const evasion = Number(defender?.system?.defenses?.evasion?.total) || 0;
    total += Math.ceil(evasion / 2) - evasion;
  }

  return total;
}

export async function zordPostRoll(actor, results, checkContext, extra) {
  if (checkContext?.isAttack && integratedPilot(actor) && findSourced(integratedPilot(actor), ZS.unseenStrike)) {
    await markUsedThisTurn(actor, 'zord1ShipUnseenStrike');
  }

  await terrorPostRoll(actor, results, checkContext, extra);
}

export function zordDerived(actor) {
  const system = actor?.system;
  if (!system) {
    return;
  }

  // Terrorzord Nature: "Your Terrorzord has a Smarts Score of 5 and a Social Score of 4."
  if (actor.type == 'zord' && system.essences && terrorzordPilot(actor)) {
    if (system.essences.smarts) {
      system.essences.smarts.value = 5;
    }

    if (system.essences.social) {
      system.essences.social.value = 4;
    }
  }

  // Megafauna: "The Zord has Smarts and Social Essence Scores of 3" - after Terrorzord Nature's 5 and 4.
  // Its Evasion +3 is a rule on its pack item.
  if (actor.type == 'zord' && inMegafaunaForm(actor)) {
    if (system.essences?.smarts) {
      system.essences.smarts.value = 3;
    }

    if (system.essences?.social) {
      system.essences.social.value = 3;
    }
  }

  // Anti-Armor's Critical Effect, on whoever it landed on.
  const shred = flagOf(actor, SHRED_FLAG);
  const toughness = system.defenses?.toughness;
  if (shred?.amount && toughness && shred.epoch == getSceneEpoch()) {
    const cut = Math.min(Number(shred.amount) || 0, armorComponent(actor));
    if (cut > 0) {
      toughness.total = (Number(toughness.total) || 0) - cut;
      toughness.string = `${toughness.string ?? ''} - ${cut} (${T('Zord1AntiArmorLabel')})`;
    }
  }
}

/* -------------------------------------------- */
/*  Use buttons and registration                 */
/* -------------------------------------------- */

const USES = [
  { id: 'zord1RexFeature', matches: item => sourceOf(item) == ZS.rexFeature, run: item => onRexFeature(item.parent, item) },
  { id: 'zord1AdditionalZord', matches: item => sourceOf(item) == ZS.additionalZord, run: item => setUpAdditionalZord(item.parent, item) },
  {
    id: 'zord1Megafauna',
    matches: item => sourceOf(item) == ZS.megafauna && item.parent?.type == 'zord',
    async run(item, economy, pay) {
      // "The Zord's pilot can take a Standard action using the conversion key to convert to Zord Form."
      const zord = item.parent;
      const toBeast = !flagOf(zord, MEGAFAUNA_FLAG);
      if (!(await pay('standard'))) {
        return null;
      }

      await zord.setFlag('essence20', MEGAFAUNA_FLAG, toBeast);
      return T(toBeast ? 'Zord1MegafaunaOn' : 'Zord1MegafaunaOff', { name: zord.name });
    },
  },
  { id: 'zord1AntiArmor', matches: item => sourceOf(item) == ZS.antiArmor && item.parent?.type == 'zord', run: item => pickAntiArmorWeapon(item) },
  {
    id: 'zord1ShipIntegration',
    matches: item => sourceOf(item) == ZS.phantomFocus && item.system?.choice == 'shipIntegration',
    run: runShipIntegration,
  },
];

registerRollSources(zordRollSources);
registerDefenseAdjust(zordDefenseAdjust);
registerDialogToggles(terrorToggles);
registerApplyDialog(terrorApplyDialog);
registerPostRoll(zordPostRoll);
registerDerived(zordDerived);
registerPreRoll(megafaunaPreRoll);
registerHitRider(antiArmorHitRider);
registerTurnStart(terrorzordTurnStart);
registerChatButton('zord1TerrorControl', onTerrorControlButton);
USES.forEach(registerUse);

globalThis.Hooks?.on?.('preUpdateActor', (actor, changes) => {
  if (actor?.type != 'zord') {
    return true;
  }

  if (!checkOneZordPerScene(actor, changes)) {
    return false;
  }

  megafaunaOnSummon(actor, changes);
  return true;
});

globalThis.Hooks?.on?.('createItem', (item, options, userId) => {
  if (userId != globalThis.game?.user?.id || !item.parent) {
    return;
  }

  const source = sourceOf(item);
  if (source == ZS.rexFeature && item.parent.type != 'zord') {
    onRexFeature(item.parent, item).then(line => line && postLine(item.parent, line));
  } else if (source == ZS.antiArmor && item.parent.type == 'zord') {
    pickAntiArmorWeapon(item);
  } else if (source == ZS.megafauna && item.parent.type == 'zord') {
    item.parent.setFlag('essence20', MEGAFAUNA_FLAG, true);
  }
});

// "The Zord cannot access its Combiner Zord Feature in Megafauna Form."
globalThis.Hooks?.on?.('updateActor', (actor, changes, options, userId) => {
  if (userId != globalThis.game?.user?.id || actor?.type != 'megaform' || changes?.system?.actors === undefined) {
    return;
  }

  const beasts = Object.values(actor.system?.actors ?? {}).map(entry => globalThis.fromUuidSync?.(entry.uuid)).filter(zord => zord && inMegafaunaForm(zord));
  if (beasts.length) {
    ui.notifications.warn(T('Zord1MegafaunaNoCombine', { names: beasts.map(z => z.name).join(', ') }));
  }
});
