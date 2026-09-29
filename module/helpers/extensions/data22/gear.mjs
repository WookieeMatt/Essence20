import { registerDefenseAdjust, registerDerived, registerTurnEnd, registerTurnStart } from "../../extensions.mjs";
import { companionsOf } from "../../companion-link.mjs";
import { findSourced, has } from "./shared.mjs";

/**
 * Data-Link (Quartermaster's Guide to Gear, drone upgrade) and Transmetal (Technorganic Secrets,
 * Influence Perk).
 */

export const GEAR22 = {
  dataLink: 'Compendium.essence20.quartermasters_guide_to_gear.Item.nRL1FJLtAEIbXozX',
  transmetal: 'Compendium.essence20.technorganic_secrets.Item.MoXpVD8zILQ5h7T8',
};

const DATA_LINK_FLAG = 'd22DataLink';
// helpers/companions.mjs#commandPet stamps the commanded pet with this flag.
const PET_COMMAND_FLAG = 'petCommand';

/* -------------------------------------------- */
/*  Data-Link                                    */
/* -------------------------------------------- */

/** The owner's drones carrying a Data-Link (on the drone, or bought on the owner's own sheet). */
export function dataLinkDrones(owner) {
  const ownerHas = has(owner, GEAR22.dataLink);
  return companionsOf(owner, { type: 'drone' }).filter(drone => ownerHas || has(drone, GEAR22.dataLink));
}

function commandedThisRound(drone, combat) {
  const command = drone?.flags?.essence20?.[PET_COMMAND_FLAG];
  return !!command && command.combatId == combat?.id && command.round == combat?.round;
}

/**
 * Data-Link (QGTG p.21): "If you do not Command your drone to take any actions during a turn in
 * combat, it alerts you about incoming attacks, granting you +1 Evasion until the beginning of your
 * next turn." Checked as the owner's turn ends; cleared when their next one starts.
 */
export async function dataLinkTurnEnd(actor, combat) {
  if (!combat) {
    return;
  }

  const drones = dataLinkDrones(actor);
  if (drones.length && drones.some(drone => !commandedThisRound(drone, combat))) {
    await actor.setFlag('essence20', DATA_LINK_FLAG, { combatId: combat.id, round: combat.round });
  }
}

export async function dataLinkTurnStart(actor) {
  if (actor?.flags?.essence20?.[DATA_LINK_FLAG]) {
    await actor.unsetFlag('essence20', DATA_LINK_FLAG);
  }
}

export function dataLinkEvasion(defender, defense) {
  const flag = defender?.flags?.essence20?.[DATA_LINK_FLAG];
  return defense == 'evasion' && flag && flag.combatId == game.combat?.id ? 1 : 0;
}

registerTurnEnd((actor, combat) => dataLinkTurnEnd(actor, combat));
registerTurnStart(actor => dataLinkTurnStart(actor));
registerDefenseAdjust((attacker, defender, defense) => dataLinkEvasion(defender, defense));

/* -------------------------------------------- */
/*  Transmetal                                   */
/* -------------------------------------------- */

/**
 * Transmetal (Technorganic Secrets, Influence Perk, p.31): "Choose a Ground, Aerial, or Aquatic Speed
 * for your Alt Mode with a Movement of 40 feet. If your Alt Mode already has multiple Movement types,
 * you may choose one and add 20 feet to it. ... Additionally, add +1 to your Toughness." The choice
 * is the Perk's own altModeMovement pick (system.choice); the Toughness is its Active Effect. While
 * in Alt Mode the chosen type is raised to 40 feet - or, when the Alt Mode already moves more than
 * one way and the chosen type is one of them, raised by 20.
 */
export function transmetalMovement(actor) {
  const perk = findSourced(actor, GEAR22.transmetal);
  const chosen = perk?.system?.choice;
  const movement = actor?.system?.movement;
  if (!chosen || !movement?.[chosen] || !actor.system.isTransformed) {
    return 0;
  }

  const innate = Number(movement[chosen].altMode) || 0;
  const types = Object.values(movement).filter(m => (Number(m?.altMode) || 0) > 0).length;
  const delta = types >= 2 && innate > 0 ? 20 : Math.max(0, 40 - innate);
  movement[chosen].total = (Number(movement[chosen].total) || 0) + delta;
  return delta;
}

registerDerived(actor => {
  transmetalMovement(actor);
});

