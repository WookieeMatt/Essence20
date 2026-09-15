import { checkIsLocked } from "../helpers/actor.mjs";
import ChoicesSelector from "../apps/choices-selector.mjs";
import { _getItemDeleteConfirmDialog } from "./listener-item-handler.mjs";
import { markUsedThisEncounter } from "../helpers/perks.mjs";

// Detachable (Across the Stars, p.104): "the Combiner participant can remove itself... roll its
// Initiative Skill Test for the following Combat round, and become a separate combatant...
// [but] may not reattach in the same scene." The "leave the Megaform" half needs no new code at
// all - it's the exact same removal onSystemActorsDelete already performs for any other reason a
// GM might unlink an actor - so this only needs to flag that removal as a Detach (scoped to
// "removed a Zord holding this trait from a Megaform while a combat is active," since that's the
// only context RAW's "detach" action makes sense in) and, in drop-handler.mjs's own onDropActor,
// refuse to re-add that same Zord to a Megaform while the flag is still set. "Incompatible with
// the Core Body Megaform Trait" is a chargen-time build restriction rather than something with
// runtime combat consequences (worst case a GM builds a Zord RAW wouldn't technically allow, not
// a crash or an exploit) - left as a GM-adjudicated build rule, not enforced in code here.
export const DETACHED_THIS_SCENE_FLAG = 'detachedFromMegaformThisScene';

/**
 * Prepare Actors that are attached to other actors. system.actors is a single, type-agnostic
 * attachment collection reused for several different purposes (Vehicle crew, Zord/Megaform
 * combiners, a Player Character's own Zords and Contacts) - context.actors carries every
 * attached actor for the sheets that only ever have one "attached actors" tab (Vehicle
 * Passengers, Zord Passengers, Megaform Combiners), while context.zordActors/contactActors
 * split that same collection by the attached actor's own type, for the Player Character sheet's
 * separate Zords and Contacts tabs, which previously both showed this same unfiltered list.
 * @param {Actor} actor The actor that has attached actors
 * @param {Object} context The actor data to prepare
*/
export function prepareSystemActors(actor, context) {
  if (Object.keys(actor.system.actors).length > 0) {
    const actors = {};
    const zordActors = {};
    const contactActors = {};

    for (const [ key, embeddedActor] of Object.entries(actor.system.actors)) {
      const fullActor = fromUuidSync(embeddedActor.uuid);
      actors[key] = fullActor;

      if (fullActor?.type == 'zord') {
        zordActors[key] = fullActor;
      } else {
        contactActors[key] = fullActor;
      }
    }

    context.actors = actors;
    context.zordActors = zordActors;
    context.contactActors = contactActors;
  }
}

/**
 * Handle deleting of actors from other actors
 * @param {Event} event The originating click event
 * @param {ActorSheet} actorSheet The ActorSheet whose actor is being deleted
 */
export async function onSystemActorsDelete(event, actorSheet) {
  const actor = actorSheet.document;
  if (checkIsLocked(actor)) {
    return;
  }

  const systemActorsId = event.target.dataset.systemActorsUuid;

  // return if no item is found.
  if (!systemActorsId) {
    return;
  }

  let keyId = null;
  let selectedActor = {};
  for (const [ key , embeddedActor] of Object.entries(actor.system.actors)) {
    if (embeddedActor.uuid == systemActorsId) {
      keyId = key;
      selectedActor = embeddedActor;
      break;
    }
  }

  // Confirmation dialog
  const confirmation = await _getItemDeleteConfirmDialog(selectedActor);
  if (confirmation != 'confirm') {
    return;
  }

  // A plain key (no "-=" prefix - that's the old, now-deprecated deletion syntax, which Foundry
  // v14 logs a compatibility warning for and won't actually apply) paired with ForcedDeletion as
  // the value is what actually deletes it - see item-sheet.mjs's own _onObjectDelete.
  const updateString = `system.actors.${keyId}`;

  // Detachable (Across the Stars, p.104) - see this file's own DETACHED_THIS_SCENE_FLAG comment
  // above. Only meaningful for a Zord leaving a Megaform mid-combat; markUsedThisEncounter()
  // already no-ops outside of combat on its own, so removing a roster mistake between sessions
  // doesn't accidentally lock the Zord out later.
  const removedActor = fromUuidSync(selectedActor.uuid);
  if (
    actor.type == 'megaform' && removedActor?.type == 'zord'
    && removedActor.items.some(item => item.type == 'megaformTrait' && item.system.type == 'detachable')
  ) {
    await markUsedThisEncounter(removedActor, DETACHED_THIS_SCENE_FLAG);
  }

  await actor.update({[updateString]: new foundry.data.operators.ForcedDeletion()});
  li.slideUp(200, () => actorSheet.render(false));
}

export async function onVehicleRoleUpdate(event, actorSheet) {
  const actor = actorSheet.actor;
  if (checkIsLocked(actor)) {
    return;
  }

  const key = event.currentTarget.attributes.key.value;
  const newRole = event.currentTarget.value;
  let numberOfType = 0;
  let updateValue = false;

  for (const [,passenger] of Object.entries(actor.system.actors)) {
    if (passenger.vehicleRole == newRole) {
      numberOfType++;
    }
  }

  if (newRole == 'driver') {
    if (numberOfType < actor.system.crew.numDrivers) {
      updateValue = true;
    }
  } else {
    if (numberOfType < actor.system.crew.numPassengers) {
      updateValue = true;
    }
  }

  if (updateValue) {
    const updateString = `system.actors.${key}.vehicleRole`;

    await actor.update ({
      [updateString]: newRole,
    });
  } else {
    const dialogResult = await foundry.applications.api.DialogV2.wait({
      window: { title: game.i18n.localize("E20.VehicleDialogSwapTitle")},
      classes: [
        "window-app",
      ],
      content: game.i18n.localize('E20.VehicleDialogSwap'),
      modal: true,
      buttons: [
        {
          label: game.i18n.localize('E20.DialogYesButton'),
          action: "yes",
        },
        {
          label: game.i18n.localize('E20.DialogNoButton'),
          action: 'no',
        },
      ],
    });

    if (dialogResult == "no") {
      ui.notifications.error(game.i18n.localize('E20.VehicleRoleError'));
      actor.render();
    } else {
      let choices = {};
      for (const [selectedKey,passenger] of Object.entries(actor.system.actors)) {
        if (selectedKey != key && passenger.vehicleRole == newRole) {
          choices[selectedKey] = {
            chosen: false,
            label: passenger.name,
            uuid: passenger.uuid,
            value: selectedKey,
          };
        }
      }

      const prompt = "E20.SelectDriverSwap";
      const title = "E20.VehicleDialogSwapSelect";

      new ChoicesSelector(choices, actor, prompt, title, null, key, null, newRole, null, null).render(true);
    }
  }
}

export function _flipDriverAndPassenger(actor, key, newRole, selectedKey) {
  let flippedRole = "";
  let updateString = `system.actors.${selectedKey}.vehicleRole`;
  if (newRole == 'driver') {
    flippedRole = 'passenger';
  } else {
    flippedRole = 'driver';
  }

  actor.update ({
    [updateString]: flippedRole,
  });

  updateString = `system.actors.${key}.vehicleRole`;
  actor.update ({
    [updateString]: newRole,
  });
}

export async function onCrewNumberUpdate(event, actorSheet) {
  const target = event.currentTarget.name;
  let targetShortName = "";
  if (target == "system.crew.numDrivers") {
    targetShortName = "driver";
  } else if (target == "system.crew.numPassengers") {
    targetShortName = "passenger";
  }

  const actor = actorSheet.actor;
  const newValue = event.currentTarget.value;

  let numberOfType = 0;

  for (const [,driver] of Object.entries(actor.system.actors)) {
    if (driver.vehicleRole == targetShortName) {
      numberOfType++;
    }
  }

  if (numberOfType > newValue) {
    ui.notifications.error(game.i18n.localize('E20.VehicleRoleErrorTooManyCrew'));
    await actor.update({
      [target]: numberOfType,
    });
    actor.render();
  }
}

/**
 * system-actors.hbs's per-attached-actor Health input (.attached-actor-health) writes to the
 * COMPONENT's own system.health.value, never the parent Vehicle/Zord/Megaform sheet it's shown
 * on - a Megaform in particular has no Health pool of its own (see megaform.mjs's own comment),
 * it's purely a live readout of each linked component's real Health. The input previously had a
 * broken, unresolvable name attribute (a literal "attachedActor.system.health" string, not a real
 * document path), so editing it either no-op'd or silently wrote nowhere - this is the actual
 * handler that input needed all along, resolved via its own data-system-Actors-uuid the same way
 * onSystemActorsDelete already resolves the actor a click came from. No extra refresh logic is
 * needed here: essence20.mjs's own updateActor hook already calls refreshMegaformsLinkedToActor()
 * for any actor update, so every open Megaform sheet linking this component re-renders itself
 * once the write below lands.
 * @param {Event} event
 * @param {ActorSheet} _actorSheet   Unused - kept for the same (event, actorSheet) signature every
 *   other _activateCrewListeners-bound handler uses.
 */
export async function onAttachedActorHealthUpdate(event, _actorSheet) {
  const componentUuid = event.currentTarget.dataset.systemActorsUuid;
  if (!componentUuid) {
    return;
  }

  const component = fromUuidSync(componentUuid);
  if (!component) {
    return;
  }

  const max = component.system.health.max;
  const newValue = Math.min(Math.max(0, Number(event.currentTarget.value)), max);
  await component.update({ 'system.health.value': newValue });
}

/**
 * system-actors.hbs's per-attached-actor Stun input (.attached-actor-stun), same shape as
 * onAttachedActorHealthUpdate above (writes to the COMPONENT's own system.stun.value, not the
 * parent Vehicle/Zord/Megaform sheet it's shown on) - Stun has no max to clamp against (the main
 * sheet's own Stun input has none either; it's compared against current Health, not capped).
 * @param {Event} event
 * @param {ActorSheet} _actorSheet   Unused - kept for the same (event, actorSheet) signature every
 *   other _activateCrewListeners-bound handler uses.
 */
export async function onAttachedActorStunUpdate(event, _actorSheet) {
  const componentUuid = event.currentTarget.dataset.systemActorsUuid;
  if (!componentUuid) {
    return;
  }

  const component = fromUuidSync(componentUuid);
  if (!component) {
    return;
  }

  const newValue = Math.max(0, Number(event.currentTarget.value));
  await component.update({ 'system.stun.value': newValue });
}

/**
 * Double-clicking a system-actors.hbs card (Vehicle/Zord crew, or a Megaform's Combiner
 * Participants) opens that attached actor's own sheet - the card only ever exposes its Health/
 * Stun/vehicle-role and a delete control otherwise, with no way to reach the actor itself short
 * of finding it in the sidebar. Ignores a dblclick that lands on one of those existing controls
 * (an input, select, or the delete icon's .item-controls) so it doesn't fight their own behavior
 * (e.g. double-clicking a Health input to select its text).
 * @param {Event} event
 * @param {ActorSheet} _actorSheet   Unused - kept for the same (event, actorSheet) signature every
 *   other _activateCrewListeners-bound handler uses.
 */
export function onSystemActorOpen(event, _actorSheet) {
  if (event.target.closest('input, select, .item-controls')) {
    return;
  }

  const componentUuid = event.currentTarget.dataset.systemActorsUuid;
  if (!componentUuid) {
    return;
  }

  const component = fromUuidSync(componentUuid);
  component?.sheet.render(true);
}
