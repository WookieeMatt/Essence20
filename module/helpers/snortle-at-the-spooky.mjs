import { findRolePointsItem } from "./reroll.mjs";

/**
 * MLP CRB "Snortle at the Spooky" (Spirit of Laughter Role, p.86, 6th level): "...when a friend
 * is targeted by an on-going mind-affecting condition, like Frightened, you can end the effect as
 * a Standard action by spending a Cheer Point." RAW gives one named example rather than an
 * exhaustive list - this system's own status vocabulary (helpers/config.mjs's E20.statusEffects)
 * has two conditions that read as "mind-affecting" in the same sense: Frightened itself, and
 * Mesmerized. Everything else in that list (Blinded, Prone, Restrained, etc.) is a physical
 * condition, not a mental one, so isn't offered here.
 */
export const MIND_AFFECTING_STATUSES = ["frightened", "mesmerized"];

const CHEER_POINTS_NAME = "Cheer Points";

// MLP CRB "Play to the Crowd" (18th level, p.86): "...when you use an ability that usually
// targets one creature, you can instead target extra creatures equal to the number of Cheer
// points you spend." Applies to Snortle at the Spooky (and Laughtracting, which has no code path
// of its own to extend - see packs/mlpcrbitems/_source/Laughtracting_*.json's own doc trail).
const PLAY_TO_THE_CROWD_PERK_ID = "Compendium.essence20.mlp_crb.Item.2LZ9H8bmrMECGHjA";

// Perks granted through a Role's own level-up items map (attachment-handler.mjs#grantItemEntry -
// how a character normally gets Play to the Crowd) get flags.core.sourceId stamped, not
// _stats.compendiumSource (that's only set by the choice-picker/manual-drop paths in perk-
// handler.mjs) - checking both is the established idiom (see perk-handler.mjs's own
// SORCERY_PERK_ID/ZORD_PERK_ID checks) for "does this actor have compendium Perk X," regardless
// of which path granted it.
function actorHasPlayToTheCrowd(actor) {
  return actor.items.some(item =>
    item.type == "perk"
    && (item.flags.core?.sourceId == PLAY_TO_THE_CROWD_PERK_ID || item._stats?.compendiumSource == PLAY_TO_THE_CROWD_PERK_ID));
}

// Every currently-Foundry-targeted token whose actor actually has something Snortle at the
// Spooky could cure - shared by the eligibility check and the real activation so they agree on
// what "a valid target" means.
function getSnortleableTargets() {
  return Array.from(game.user.targets)
    .map(token => token.actor)
    .filter(target => target && MIND_AFFECTING_STATUSES.some(status => target.statuses.has(status)));
}

/**
 * Whether the actor's current Foundry target selection has at least one cure-able friend, purely
 * for gating the sheet button - doesn't check the Cheer Points cost itself (mirrors this
 * codebase's other Activate-button Perks, e.g. Power Infusion, which likewise only gate on "is
 * there something to do," letting the actual spend fail loudly if unaffordable).
 * @returns {Boolean}
 */
export function hasSnortleableTarget() {
  return getSnortleableTargets().length > 0;
}

/**
 * Spends Cheer Points to end a mind-affecting condition (see MIND_AFFECTING_STATUSES) on every
 * currently-targeted friend who has one - 1 Cheer Point each, but only more than one target at
 * once if the actor has Play to the Crowd (otherwise only the first eligible target is cured,
 * for 1 Cheer, regardless of how many tokens happen to be targeted). No-ops with a notification
 * if there's no eligible target or the actor can't afford the total cost.
 * @param {Actor} actor   The actor using Snortle at the Spooky.
 * @returns {Promise<Boolean>}   Whether at least one condition was actually cured.
 */
export async function snortleAtTheSpooky(actor) {
  let targets = getSnortleableTargets();
  if (!targets.length) {
    const hasAnyTarget = Array.from(game.user.targets).length > 0;
    ui.notifications.error(game.i18n.localize(hasAnyTarget ? "E20.SnortleNothingToCure" : "E20.SnortleNoTarget"));
    return false;
  }

  if (targets.length > 1 && !actorHasPlayToTheCrowd(actor)) {
    targets = targets.slice(0, 1);
  }

  const cost = targets.length;
  const rolePoints = findRolePointsItem(actor, CHEER_POINTS_NAME);
  if (!rolePoints || (rolePoints.system.resource.value < cost && !actor.system.useUnlimitedResource)) {
    ui.notifications.error(game.i18n.localize("E20.RolePointsOverSpent"));
    return false;
  }

  if (!actor.system.useUnlimitedResource) {
    await rolePoints.update({ "system.resource.value": rolePoints.system.resource.value - cost });
  }

  const curedStatusNames = [];
  for (const target of targets) {
    const statusToCure = MIND_AFFECTING_STATUSES.find(status => target.statuses.has(status));
    await target.toggleStatusEffect(statusToCure, { active: false });
    curedStatusNames.push(game.i18n.localize(CONFIG.statusEffects.find(effect => effect.id == statusToCure)?.name ?? statusToCure));
  }

  ui.notifications.info(game.i18n.format("E20.SnortleCured", {
    actorName: actor.name,
    targetName: targets.map(target => target.name).join(", "),
    status: curedStatusNames.join(", "),
  }));

  return true;
}

/**
 * Sheet-button event wrapper for snortleAtTheSpooky() - mirrors sheet-handlers/power-ranger-
 * handler.mjs#onActivatePowerInfusion's own shape (resolve the clicked Perk's owning actor from
 * its uuid, then call the actual mechanic).
 * @param {Event} event
 */
export async function onActivateSnortleAtTheSpooky(event) {
  const item = await fromUuid(event.target.dataset.uuid);
  if (!item?.parent) {
    return;
  }

  await snortleAtTheSpooky(item.parent);
}
