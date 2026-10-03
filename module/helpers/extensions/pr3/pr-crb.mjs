import {
  registerDerived, registerPostRoll, registerRollSources, registerUse,
} from "../../extensions.mjs";
import { worldActors } from "../../companion-link.mjs";
import {
  IDS, T, escapeHtml, holding, isItem, isThisRound, itemsOf, parentWeaponOf, personalPower,
  postLine, sizeIndex, spendPower, turnStamp, writeActor,
} from "./common.mjs";

/**
 * Power Rangers Core Rulebook pieces of the pr3 slice. Each rule is quoted above its code.
 */

/* -------------------------------------------- */
/*  Megaform Expeditor                           */
/* -------------------------------------------- */

/**
 * Megaform Expeditor (PR CRB, Grid Tech, p.39): "It takes your Zord 1d4 rounds less time to be
 * ready to take part in the formation of any Combined transformation, minimum 1." Called from
 * helpers/combiner-timer.mjs#rollParticipantTime (see integration/pr3-patch.cjs) with the
 * participant's rolled join time. "Your Zord" is the Zord listed on the Ranger's own sheet.
 * @param {Actor} zord
 * @param {Number} total   The rolled join time.
 * @returns {Promise<Number>}
 */
export async function expediteJoinTime(zord, total) {
  if (!zord?.uuid || !expeditorOwnerOf(zord)) {
    return total;
  }

  const roll = await new Roll('1d4').evaluate();
  return Math.max(1, total - roll.total);
}

export function expeditorOwnerOf(zord) {
  return worldActors().find(actor => !!holding(actor, IDS.megaformExpeditor)
    && Object.values(actor.system?.actors ?? {}).some(entry => entry?.uuid && entry.uuid == zord?.uuid)) ?? null;
}

/* -------------------------------------------- */
/*  Megaform Trait (Zord Feature)                */
/* -------------------------------------------- */

// Megaform Trait (PR CRB, Zord Feature, p.137, prerequisite Combiner): "This feature allows you to
// choose a second Megaform Trait for your Zord to contribute to any Megaform they are a part of."
// A Use button on the Feature picks the trait and puts the real megaformTrait item on the Zord, so
// the Megaform aggregates it like the first one.
registerUse({
  id: 'pr3MegaformTrait',
  matches: item => isItem(item, IDS.megaformTrait),
  canUse: item => !item.flags?.essence20?.pr3Granted,
  run: async (item) => {
    const zord = item.parent;
    const { findItems, grantCopy, pickOne } = await import("../../grants.mjs");
    const uuid = await pickOne(item.name, await findItems({ type: 'megaformTrait' }));
    if (!uuid) {
      return null;
    }

    const created = await grantCopy(zord, uuid, { grantedBy: item });
    if (!created) {
      return null;
    }

    await item.setFlag('essence20', 'pr3Granted', created.id);
    return T('Pr3GrantedItem', { name: escapeHtml(zord.name), item: escapeHtml(created.name), source: escapeHtml(item.name) });
  },
});

/* -------------------------------------------- */
/*  Ninja Power - the 20ft jump                  */
/* -------------------------------------------- */

// Ninja Power (PR CRB, General Perk, p.97): "you may, as a Free action, jump up to 20 feet in any
// direction. This jump does not modify your Movement for the round... Any attacks targeting you
// this turn, after this jump, suffer ↓1." The Use button keeps the Perk's existing on/off switch
// (helpers/ninja-power.mjs) and adds the jump while Ninja Power is active and you're Morphed; the
// token is moved by hand. "This turn" is read as the rest of the round - an attack can only come
// on someone else's turn.
const NINJA_JUMP_FLAG = 'pr3NinjaJump';

registerUse({
  id: 'pr3NinjaPower',
  matches: item => isItem(item, IDS.ninjaPower),
  run: async (item, economy, pay) => {
    const actor = item.parent;
    const { isNinjaPowerActive, toggleNinjaPower } = await import("../../ninja-power.mjs");
    let choice = 'toggle';
    if (isNinjaPowerActive(actor) && actor.system?.isMorphed) {
      const { chooseButtons } = await import("../../grants.mjs");
      choice = await chooseButtons(item.name, T('Pr3NinjaPrompt'), [['jump', T('Pr3NinjaJump')], ['toggle', T('Pr3NinjaOff')]]);
    }

    if (choice == 'jump') {
      if (!(await pay('free'))) {
        return null;
      }

      await actor.setFlag('essence20', NINJA_JUMP_FLAG, turnStamp() ?? { outOfCombat: true });
      return T('Pr3NinjaJumped', { name: escapeHtml(actor.name) });
    }

    if (choice != 'toggle') {
      return null;
    }

    const active = await toggleNinjaPower(actor);
    if (active === null) {
      ui.notifications.warn(game.i18n.localize('E20.PowerOverSpent'));
      return null;
    }

    return T(active ? 'Pr3NinjaOnLine' : 'Pr3NinjaOffLine', { name: escapeHtml(actor.name) });
  },
});

registerRollSources((actor, target, ctx) => {
  if (!target || !ctx?.isAttack || !isThisRound(target.flags?.essence20?.[NINJA_JUMP_FLAG])) {
    return {};
  }

  return { sources: [{ id: 'pr3NinjaJump', label: T('Pr3NinjaJumpSource', { name: target.name }), shiftDown: 1 }] };
});

/* -------------------------------------------- */
/*  Peerless Pilot                               */
/* -------------------------------------------- */

/**
 * Peerless Pilot (PR CRB, General Perk, p.97): "You may always automatically pass the Skill Test to
 * emergency disembark from a vehicle you are piloting." Called from helpers/vehicle-defeat.mjs's
 * emergency disembark (integration/pr3-patch.cjs) for each crew row.
 * @param {Actor} crewMember
 * @param {Object} entry   The vehicle's crew row (vehicleRole 'driver' is the pilot).
 */
export function autoPassesDisembark(crewMember, entry) {
  return entry?.vehicleRole == 'driver' && !!holding(crewMember, IDS.peerlessPilot);
}

/* -------------------------------------------- */
/*  Power Heal - removing a Condition            */
/* -------------------------------------------- */

// Power Heal (PR CRB, Grid Power, p.100): "While Morphed, you can spend Power while touching an
// injured living creature. Each Power spent heals 1 damage or removes one negative condition." The
// Power's one Use button asks which: healing is its activation (power-handler.mjs#powerCost ->
// helpers/power-heal.mjs); removing a Condition is 1 Power, a creature within 5 feet (or yourself),
// one of its negative Conditions.
const NOT_NEGATIVE = new Set(['morphed', 'altMode', 'defending', 'cover', 'totalCover', 'invisible', 'defeated']);

export function negativeStatuses(actor) {
  return [...(actor?.statuses ?? [])].filter(id => !NOT_NEGATIVE.has(id));
}

function statusLabel(id) {
  const effect = (CONFIG.statusEffects ?? []).find(e => e.id == id);
  return game.i18n.localize(effect?.name ?? effect?.label ?? id);
}

registerUse({
  id: 'pr3PowerHealCondition',
  matches: item => isItem(item, IDS.powerHeal),
  canUse: item => !!item.parent?.system?.isMorphed && personalPower(item.parent) >= 1,
  run: async (item) => {
    const actor = item.parent;
    const { chooseButtons } = await import("../../grants.mjs");
    const mode = await chooseButtons(item.name, T('Pr3PowerHealPrompt'), [['heal', T('Pr3PowerHealHeal')], ['condition', T('Pr3PowerHealCondition')]]);
    if (mode == 'heal') {
      const { powerCost } = await import("../../../sheet-handlers/power-handler.mjs");
      await powerCost(actor, item);
      return null;
    }

    if (mode != 'condition') {
      return null;
    }

    const { getNearbyAllyTokens } = await import("../../allies.mjs");
    const { chooseSelect } = await import("../../grants.mjs");
    const candidates = [actor, ...getNearbyAllyTokens(actor, 5).map(token => token.actor).filter(Boolean)]
      .filter(a => negativeStatuses(a).length);
    if (!candidates.length) {
      ui.notifications.info(T('Pr3PowerHealNothing'));
      return null;
    }

    const targetUuid = candidates.length == 1 ? candidates[0].uuid
      : await chooseSelect(item.name, T('Pr3PowerHealWho'), candidates.map(a => ({ value: a.uuid, label: a.name })));
    const target = candidates.find(a => a.uuid == targetUuid);
    if (!target) {
      return null;
    }

    const status = await chooseSelect(item.name, T('Pr3PowerHealWhich'), negativeStatuses(target).map(id => ({ value: id, label: statusLabel(id) })));
    if (!status || !(await spendPower(actor, 1))) {
      return null;
    }

    await writeActor(target, 'toggleStatusEffect', [status, { active: false }]);
    return T('Pr3PowerHealRemoved', { name: escapeHtml(actor.name), target: escapeHtml(target.name), status: escapeHtml(statusLabel(status)) });
  },
});

/* -------------------------------------------- */
/*  Power Ranger Standard Issue                  */
/* -------------------------------------------- */

// Standard Issue (PR CRB, p.103): "You and every Power Ranger receives the same basic equipment: a
// Power Morpher, a Wrist Communicator, a Power Suit, a Blade Blaster, and a second Power Weapon of a
// type defined by your Role." The package item grants the three fixed pieces; the suit style and
// the Role's Power Weapon are choices, asked for once the package lands on the actor.
const STANDARD_ISSUE = 'Power Ranger Standard Issue';
const POWER_SUITS_FOLDER = 'JfpzK64lCwnQH5v2';

export function isStandardIssueLanding(item, changes) {
  return changes?.flags?.essence20?.equipmentPackage?.name == STANDARD_ISSUE && item?.name == 'Power Morpher';
}

export async function issueSuitAndWeapon(actor) {
  const { findItems, grantCopy, pickOne } = await import("../../grants.mjs");
  const tag = { equipmentPackage: { name: STANDARD_ISSUE, packageType: 'standardIssue' } };
  const suits = await findItems({ type: 'armor', matches: entry => entry.folder == POWER_SUITS_FOLDER && entry.name != 'Clothes' });
  const suit = await pickOne(T('Pr3PickPowerSuit'), suits);
  if (suit) {
    await grantCopy(actor, suit, { flags: tag });
  }

  const weapons = await findItems({
    type: 'weapon',
    matches: entry => String(entry.uuid).startsWith('Compendium.essence20.pr_crb.')
      && (entry.system?.traits ?? []).includes('powerWeapon') && !/Blade Blaster|Unique Weapon/.test(entry.name),
  });
  const weapon = await pickOne(T('Pr3PickPowerWeapon'), weapons);
  if (weapon) {
    await grantCopy(actor, weapon, { flags: tag });
  }
}

Hooks.on('updateItem', (item, changes, options, userId) => {
  if (userId == game.user?.id && item.parent instanceof Actor && isStandardIssueLanding(item, changes)) {
    issueSuitAndWeapon(item.parent);
  }
});

/* -------------------------------------------- */
/*  Survivor                                     */
/* -------------------------------------------- */

// Survivor (PR CRB, Influence Perk, p.75): "at any point when your Smarts would be lowered to 0,
// roll a d20. On a result of 10 or above, your Smarts remains at 1." (The Survival Edge is the
// item's Active Effect.)
export function smartsDroppedToZero(changes) {
  const value = changes?.system?.essences?.smarts?.value;
  return value !== undefined && value !== null && Number(value) <= 0;
}

export async function survivorCheck(actor) {
  const roll = await new Roll('1d20').evaluate();
  const saved = roll.total >= 10;
  if (saved) {
    await actor.update({ 'system.essences.smarts.value': 1 });
  }

  await roll.toMessage?.({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: T(saved ? 'Pr3SurvivorSaved' : 'Pr3SurvivorFailed', { name: actor.name }),
  });
  return saved;
}

Hooks.on('updateActor', (actor, changes, options, userId) => {
  if (userId == game.user?.id && smartsDroppedToZero(changes) && holding(actor, IDS.survivor)) {
    survivorCheck(actor);
  }
});

/* -------------------------------------------- */
/*  Unique Weapon (Green Ranger)                 */
/* -------------------------------------------- */

// Unique Weapon (PR CRB, Green Ranger, 1st level, p.44): "you are given a special, unique Power
// Weapon... you may choose from or roll randomly on Table 4-4". The four weapons are compendium
// items (packs/prcrbitems, Pr3UniqWpn*); the Use button picks or rolls one and hands it over.
export const UNIQUE_WEAPONS = [IDS.uwRanged, IDS.uwSmall, IDS.uwVersatile, IDS.uwTwoHanded];

registerUse({
  id: 'pr3UniqueWeapon',
  matches: item => isItem(item, IDS.uniqueWeapon),
  canUse: item => !item.flags?.essence20?.pr3Granted,
  run: async (item) => {
    const actor = item.parent;
    const { chooseButtons, grantCopy } = await import("../../grants.mjs");
    const choice = await chooseButtons(item.name, T('Pr3UniquePrompt'), [
      ['0', T('Pr3UniqueRanged')], ['1', T('Pr3UniqueSmall')], ['2', T('Pr3UniqueVersatile')], ['3', T('Pr3UniqueTwoHanded')],
      ['roll', T('Pr3UniqueRoll')],
    ]);
    if (choice === null || choice === undefined) {
      return null;
    }

    let index = Number(choice);
    if (choice == 'roll') {
      const roll = await new Roll('1d4').evaluate();
      await roll.toMessage?.({ speaker: ChatMessage.getSpeaker({ actor }), flavor: item.name });
      index = roll.total - 1;
    }

    const created = await grantCopy(actor, UNIQUE_WEAPONS[index], { grantedBy: item });
    if (!created) {
      return null;
    }

    await item.setFlag('essence20', 'pr3Granted', created.id);
    return T('Pr3GrantedItem', { name: escapeHtml(actor.name), item: escapeHtml(created.name), source: escapeHtml(item.name) });
  },
});

function equippedUnique(actor, uuid) {
  return itemsOf(actor).find(item => item.type == 'weapon' && isItem(item, uuid) && item.system?.equipped !== false) ?? null;
}

// Ranged (60/100, Targeting): "Stores up to 3 Personal Power for wielder to use." A Use button on
// the weapon stores 1 of your Power in it or draws 1 back out.
const STORED_FLAG = 'pr3StoredPower';
export const storedPower = weapon => Number(weapon?.flags?.essence20?.[STORED_FLAG]) || 0;

registerUse({
  id: 'pr3UniqueStore',
  matches: item => item?.type == 'weapon' && isItem(item, IDS.uwRanged),
  run: async (item) => {
    const actor = item.parent;
    const stored = storedPower(item);
    const choices = [];
    if (stored < 3 && personalPower(actor) >= 1) {
      choices.push(['store', T('Pr3UniqueStore')]);
    }

    if (stored > 0) {
      choices.push(['draw', T('Pr3UniqueDraw')]);
    }

    if (!choices.length) {
      ui.notifications.info(T('Pr3UniqueStoreNothing'));
      return null;
    }

    const { chooseButtons } = await import("../../grants.mjs");
    const choice = choices.length == 1 ? choices[0][0] : await chooseButtons(item.name, T('Pr3UniqueStorePrompt', { stored }), choices);
    if (choice == 'store' && await spendPower(actor, 1)) {
      await item.setFlag('essence20', STORED_FLAG, stored + 1);
    } else if (choice == 'draw') {
      await item.setFlag('essence20', STORED_FLAG, stored - 1);
      await actor.update({ 'system.powers.personal.value': personalPower(actor) + 1 });
    } else {
      return null;
    }

    return T('Pr3UniqueStored', { name: escapeHtml(item.name), stored: storedPower(item) });
  },
});

// Ranged risk: "User loses 1d4 Personal Power upon a roll of natural 1 to hit."
registerPostRoll(async (actor, results, checkContext, { isFumble, rider } = {}) => {
  if (!isFumble || rider?.weaponSource != IDS.uwRanged) {
    return;
  }

  const roll = await new Roll('1d4').evaluate();
  const lost = Math.min(personalPower(actor), roll.total);
  await actor.update({ 'system.powers.personal.value': personalPower(actor) - lost });
  await postLine(actor, T('Pr3UniqueFumble', { name: escapeHtml(actor.name), lost }));
});

/**
 * Small Melee (Finesse): "Calls Zord in half normal time." Called from helpers/zord-summon.mjs's
 * summon timer (integration/pr3-patch.cjs) with the rolled arrival time. (Its risk - a DIF 12
 * Performance Test by someone else to steal the Zord - is the GM's to call.)
 */
export function halveSummonRounds(pilot, rounds) {
  return equippedUnique(pilot, IDS.uwSmall) ? Math.max(1, Math.ceil(rounds / 2)) : rounds;
}

// Versatile Melee (Might or Finesse): "Gains ↑2 shift when attacking targets at least 3 sizes
// larger." (Its risk - it doesn't Morph with you - is narrative.)
registerRollSources((actor, target, ctx) => {
  if (!target || !ctx?.isAttack) {
    return {};
  }

  const weapon = parentWeaponOf(actor, ctx.item);
  if (!isItem(weapon, IDS.uwVersatile)) {
    return {};
  }

  const mine = sizeIndex(actor);
  const theirs = sizeIndex(target);
  return mine >= 0 && theirs - mine >= 3 ? { sources: [{ id: 'pr3UniqueVersatile', label: weapon.name, shiftUp: 2 }] } : {};
});

// Two-Handed Melee (Might): "Inflicts energy damage instead of its normal type" (its weapon effect)
// and "Slows all of wielder's movement types down by 10 ft." while it's equipped.
registerDerived((actor) => {
  if (!equippedUnique(actor, IDS.uwTwoHanded)) {
    return;
  }

  for (const movement of Object.values(actor.system?.movement ?? {})) {
    if (movement && Number(movement.total) > 0) {
      movement.total = Math.max(0, Number(movement.total) - 10);
    }
  }
});

