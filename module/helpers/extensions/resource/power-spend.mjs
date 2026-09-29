/**
 * The Personal Power choke point: every write to system.powers.personal.value, wherever it comes
 * from (the Power sheet cost, Perk costs, Rest, the sidebar), passes through the actor update
 * hooks, so this is where "whenever you spend / regain Personal Power" rules live.
 *
 * - A decrease is a spend, unless the writer marks it `{essence20Loss: true}` (Power drained by an
 *   enemy, Body of Energy's damage) or `{essence20Refund: true}` (this file's own refunds).
 * - An increase is regaining Power.
 *
 * Void Warrior (Across the Stars, Grid Power, p.73): "...for the remainder of the scene. While this
 * Grid Power is active, you cannot regain Personal Power." - regain is blocked in preUpdateActor,
 * and the Power ends with the scene (helpers/void-warrior.mjs sets the flag and never cleared it).
 *
 * Inner Conservation (Through the Shattered Grid, p.21): "Once per scene, if you would spend
 * Personal Power for any reason, you may choose to spend half that many points of Personal Power,
 * rounded up." - offered after a spend of 2 or more, refunding the difference.
 *
 * Power Efficiency (Through the Shattered Grid, p.26): "Whenever you spend Personal Power, roll
 * 1d4. On a 4, you regain 1 Personal Power. You cannot use this Perk when an enemy Attack or
 * ability causes you to lose Personal Power."
 *
 * Dino Charged (Beneath the Helmet, p.56): "As long as you are Morphed, you can use all of your
 * gear normally. Unfortunately, this takes its toll, and you take 1 Essence damage (you may choose
 * from which) each time you spend a Personal Power." - asked per spend while Morphed; the prompt
 * can be waved off when the Ranger has their Energem/Dino Charger and so isn't drawing on the Perk.
 *
 * Body of Energy (Across the Stars, Phantom Ranger, 8th level, p.61): "While Morphed, your Health
 * and Personal Power points are interchangeable, becoming one pool of Personal Power. When you
 * spend or lose Health or Power for any reason, you reduce your combined pool accordingly. When you
 * exit your Morphed form for any reason other than being Defeated, your Health and Personal Power
 * return to a value equal to half of your remaining combined pool points."
 * Damage past the last point of Health comes out of Power (Health is only emptied with the pool);
 * a Use button moves Health into Power for a spend; leaving Morph splits the pool in half.
 */
import {
  registerDamageModifier, registerSceneAdvanced, registerUse,
} from "../../extensions.mjs";
import { getUses, markUsed } from "../../scene-clock.mjs";
import { IDS, onHook, T, changed, setChanged, has, isActiveGm, isItem, num, say, worldActors } from "./common.mjs";

const POWER = 'system.powers.personal.value';
const VOID_FLAG = 'voidWarriorActive';
const INNER_CONSERVATION_KEY = 'innerConservationScene';

/**
 * Body of Energy's split of a hit between Health and Power.
 * @returns {{health: Number, power: Number}}   The new values.
 */
export function bodyOfEnergySplit(health, power, damage) {
  const total = Math.max(0, health + power - damage);
  if (total <= 0) {
    return { health: 0, power: 0 };
  }

  const newHealth = Math.max(1, health - damage);
  return { health: Math.min(newHealth, total), power: Math.max(0, total - Math.min(newHealth, total)) };
}

/** Health and Power on leaving Morph: each becomes half the pool (rounded down), within max. */
export function bodyOfEnergyUnmorph(health, power, healthMax, powerMax) {
  const half = Math.floor((health + power) / 2);
  return { health: Math.min(half, healthMax), power: Math.min(half, powerMax) };
}

/** Inner Conservation's refund: pay half, rounded up. */
export function innerConservationRefund(spent) {
  return spent - Math.ceil(spent / 2);
}

/* -------------------------------------------- */
/*  Before the write                             */
/* -------------------------------------------- */

onHook('preUpdateActor', (actor, changes, options, userId) => {
  const next = changed(changes, POWER);
  const nextMorph = changed(changes, 'system.isMorphed');
  if (next === undefined && nextMorph === undefined) {
    return;
  }

  options.essence20Prev = {
    power: num(actor.system?.powers?.personal?.value),
    health: num(actor.system?.health?.value),
    morphed: !!actor.system?.isMorphed,
  };

  // Void Warrior: no regaining Personal Power while it's active.
  if (next !== undefined && num(next) > options.essence20Prev.power && actor.flags?.essence20?.[VOID_FLAG]) {
    setChanged(changes, POWER, options.essence20Prev.power);
    if (userId == game.user?.id) {
      ui.notifications?.info(T('ResVoidWarriorNoRegen', { name: actor.name }));
    }
  }
});

/* -------------------------------------------- */
/*  After the write                              */
/* -------------------------------------------- */

async function refund(actor, amount, key) {
  await actor.update({ [POWER]: num(actor.system?.powers?.personal?.value) + amount }, { essence20Refund: true });
  await say(actor, T(key, { name: actor.name, amount }));
}

async function onSpend(actor, spent) {
  const { chooseButtons, chooseSelect } = await import("../../grants.mjs");

  if (has(actor, IDS.innerConservation) && spent >= 2 && getUses(actor, INNER_CONSERVATION_KEY, 'scene') < 1) {
    const back = innerConservationRefund(spent);
    const pick = await chooseButtons(T('ResInnerConservation'), T('ResInnerConservationPrompt', { spent, back }), [
      ['yes', T('ResYes')], ['no', T('ResNo')],
    ]);
    if (pick == 'yes') {
      await markUsed(actor, INNER_CONSERVATION_KEY, { window: 'scene' });
      await refund(actor, back, 'ResInnerConservationLine');
      spent -= back;
    }
  }

  if (has(actor, IDS.powerEfficiency)) {
    const roll = await new Roll('1d4').evaluate();
    await roll.toMessage?.({ speaker: ChatMessage.getSpeaker({ actor }), flavor: T('ResPowerEfficiency') });
    if (roll.total == 4) {
      await refund(actor, 1, 'ResPowerEfficiencyLine');
    }
  }

  if (has(actor, IDS.dinoCharged) && actor.system?.isMorphed && spent > 0) {
    const essences = Object.keys(actor.system?.essences ?? {});
    const options = [
      { value: 'skip', label: T('ResDinoChargedSkip') },
      ...essences.map(e => ({ value: e, label: game.i18n.localize(CONFIG.E20?.originEssences?.[e] ?? CONFIG.E20?.essences?.[e] ?? e) })),
    ];
    const essence = await chooseSelect(T('ResDinoCharged'), T('ResDinoChargedPrompt', { count: spent }), options);
    if (essence && essence != 'skip') {
      const value = num(actor.system.essences[essence]?.value);
      await actor.update({ [`system.essences.${essence}.value`]: Math.max(0, value - spent) });
      await say(actor, T('ResDinoChargedLine', { name: actor.name, count: spent, essence: options.find(o => o.value == essence)?.label ?? essence }));
    }
  }
}

async function onUnmorph(actor, prev) {
  if (!has(actor, IDS.bodyOfEnergy) || prev.health <= 0 || num(actor.system?.health?.value) <= 0) {
    return;
  }

  const split = bodyOfEnergyUnmorph(num(actor.system.health.value), num(actor.system.powers?.personal?.value),
    num(actor.system.health.max), num(actor.system.powers?.personal?.max));
  await actor.update({ 'system.health.value': split.health, [POWER]: split.power }, { essence20Refund: true, essence20Loss: true });
  await say(actor, T('ResBodyOfEnergyUnmorph', { name: actor.name, health: split.health, power: split.power }));
}

onHook('updateActor', (actor, changes, options, userId) => {
  if (userId != game.user?.id || !options?.essence20Prev) {
    return;
  }

  const prev = options.essence20Prev;
  if (prev.morphed && changed(changes, 'system.isMorphed') === false) {
    onUnmorph(actor, prev).catch(error => console.error('Essence20 | Body of Energy', error));
  }

  const next = changed(changes, POWER);
  if (next === undefined || options.essence20Refund || options.essence20Loss) {
    return;
  }

  const spent = prev.power - num(next);
  if (spent > 0) {
    onSpend(actor, spent).catch(error => console.error('Essence20 | Personal Power spend', error));
  }
});

/* -------------------------------------------- */
/*  Body of Energy                               */
/* -------------------------------------------- */

registerDamageModifier(async (actor, amount) => {
  if (!(amount > 0) || !actor?.system?.isMorphed || !has(actor, IDS.bodyOfEnergy)) {
    return amount;
  }

  const health = num(actor.system.health?.value);
  const power = num(actor.system.powers?.personal?.value);
  if (amount < health || power <= 0) {
    return amount;
  }

  const split = bodyOfEnergySplit(health, power, amount);
  await actor.update({ [POWER]: split.power }, { essence20Loss: true });
  return health - split.health;
});

registerUse({
  id: 'resBodyOfEnergy',
  matches: item => isItem(item, IDS.bodyOfEnergy),
  canUse: item => !!item.parent?.system?.isMorphed && num(item.parent.system.health?.value) > 1,
  run: async (item) => {
    const actor = item.parent;
    const health = num(actor.system.health.value);
    const room = num(actor.system.powers?.personal?.max) - num(actor.system.powers?.personal?.value);
    const most = Math.min(health - 1, Math.max(0, room));
    if (most <= 0) {
      ui.notifications.warn(T('ResBodyOfEnergyNothing'));
      return null;
    }

    const { chooseSelect } = await import("../../grants.mjs");
    const pick = await chooseSelect(item.name, T('ResBodyOfEnergyPrompt'),
      Array.from({ length: most }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })));
    const amount = Number(pick);
    if (!amount) {
      return null;
    }

    await actor.update({
      'system.health.value': health - amount,
      [POWER]: num(actor.system.powers.personal.value) + amount,
    }, { essence20Refund: true });
    return T('ResBodyOfEnergyLine', { name: actor.name, amount });
  },
});

/* -------------------------------------------- */
/*  Void Warrior ends with the scene             */
/* -------------------------------------------- */

registerSceneAdvanced(async () => {
  if (!isActiveGm()) {
    return;
  }

  for (const actor of worldActors()) {
    if (actor.flags?.essence20?.[VOID_FLAG]) {
      await actor.unsetFlag('essence20', VOID_FLAG);
    }
  }
});
