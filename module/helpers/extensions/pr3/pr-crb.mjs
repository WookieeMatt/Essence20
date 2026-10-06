import {
  registerRollSources, registerUse,
} from "../../extensions.mjs";
import {
  IDS, T, escapeHtml, isItem, isThisRound, personalPower,
  spendPower, turnStamp, writeActor,
} from "./common.mjs";

/**
 * Power Rangers Core Rulebook pieces of the pr3 slice. Each rule is quoted above its code.
 */

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
/*  Unique Weapon (Green Ranger)                 */
/* -------------------------------------------- */

// Survivor's d20 at Smarts 0 is the Perk's own essenceChanged Trigger. Unique Weapon's pick-or-roll Use is the Perk's
// own Use rule (choose + a 1d4 table); the Ranged weapon's store / draw Uses and its natural-1 risk, the Small Melee's
// halved summon time (SummonTime) and the Two-Handed Melee's -10 ft (Movement at the derivedHook stage) are the weapons'
// own rules. Megaform Expeditor (JoinTime) and Peerless Pilot (AutoDisembark, its Edges) are their Perks' own rules.

