import { registerUse } from "../../mechanics/item-hooks.mjs";
import { Q1 } from "../shared/qualification-gm-relay.mjs";
import { sourceOf } from "../shared/item-lookups.mjs";
import { TFull as T } from "../shared/item-lang.mjs";
import { updateRelayed } from "../shared/relayed-writes.mjs";

/**
 * Nu, Pogodi! (Intercontinental Adventures): the Perk's Use button - swapping seats in a vehicle, and its own
 * once-per-mission Condition removal (../healing/nu-pogodi.mjs). Wired at load by ../gear/qualification-setup.mjs.
 */

/* -------------------------------------------- */
/*  Nu, Pogodi! - swapping seats                  */
/* -------------------------------------------- */

function vehicleWith(actor) {
  for (const candidate of game.actors ?? []) {
    if (!['vehicle', 'zord'].includes(candidate.type)) {
      continue;
    }

    const entry = Object.entries(candidate.system?.actors ?? {}).find(([, crew]) => crew?.uuid == actor.uuid);
    if (entry) {
      return { vehicle: candidate, key: entry[0], entry: entry[1] };
    }
  }

  return null;
}

/**
 * Nu, Pogodi!: "if you're riding in a vehicle, you can swap positions with someone else riding in
 * the same vehicle as a Free action with a DIF 10 Driving Skill Test. This Skill Test automatically
 * fails if the other driver is unwilling to swap positions with you."
 */
export async function swapSeats(perk, pay) {
  const actor = perk.parent;
  const seat = vehicleWith(actor);
  if (!seat) {
    ui.notifications.warn(T('E20.Q1SwapNoVehicle'));
    return null;
  }

  const others = Object.entries(seat.vehicle.system.actors ?? {})
    .filter(([key, crew]) => key != seat.key && crew?.uuid && ['driver', 'passenger'].includes(crew.vehicleRole));
  const { chooseSelect, rollTest } = await import("../../mechanics/resources/grants.mjs");
  const otherKey = await chooseSelect(perk.name, T('E20.Q1SwapPrompt'),
    others.map(([key, crew]) => ({ value: key, label: `${crew.name ?? key} (${crew.vehicleRole})` })));
  if (!otherKey || !(await pay('free'))) {
    return null;
  }

  const { success } = await rollTest(actor, 'driving', 10);
  if (!success) {
    return T('E20.Q1SwapFailed', { name: actor.name });
  }

  const other = seat.vehicle.system.actors[otherKey];
  const update = {
    [`system.actors.${seat.key}.vehicleRole`]: other.vehicleRole,
    [`system.actors.${otherKey}.vehicleRole`]: seat.entry.vehicleRole,
  };
  await updateRelayed(seat.vehicle, update);

  return T('E20.Q1Swapped', { name: actor.name, other: other.name ?? '' });
}

/* -------------------------------------------- */
/*  Use buttons                                  */
/* -------------------------------------------- */

// Nu, Pogodi!'s weapon pick is an item rule (its own Use); the seat swap and Condition removal stay here.
const USE_PERKS = [Q1.nuPogodi];

export const NU_POGODI_USE = {
  id: 'q1Qualify',
  matches: item => item?.type == 'perk' && USE_PERKS.includes(sourceOf(item)),
  canUse: () => true,
  async run(item, economy, pay) {
    if (sourceOf(item) == Q1.nuPogodi) {
      // Nu, Pogodi!'s own once-per-mission Condition removal (items/healing/nu-pogodi.mjs) shares the Use
      // button, so it's offered here alongside the seat swap.
      const { canUseNuPogodiCondition, applyNuPogodiCondition } = await import("../healing/nu-pogodi.mjs");
      const { chooseButtons } = await import("../../mechanics/resources/grants.mjs");
      const choices = [['swap', T('E20.Q1SwapSeats')]];
      if (canUseNuPogodiCondition(item.parent)) {
        choices.unshift(['condition', T('E20.Q1RemoveCondition')]);
      }

      const which = await chooseButtons(item.name, T('E20.Q1WhichUse'), choices);
      if (which == 'condition') {
        const removed = await applyNuPogodiCondition(item.parent);
        return removed ? T('E20.PerkUsedNotification', { perk: item.name, actor: item.parent.name }) : null;
      }

      return which == 'swap' ? swapSeats(item, pay) : null;
    }

    return null;
  },
};

/** Wired at load by ../gear/qualification-setup.mjs. */
export function registerNuPogodiSeatSwap() {
  registerUse(NU_POGODI_USE);
}
