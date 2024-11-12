import { getItemsOfType } from "../helpers/utils.mjs";
import { powerCost } from "./power-handler.mjs";
import { rememberSelect } from "../helpers/dialog.mjs";

const PARENT_ROLLER_KEY = "parentActor";

/**
 * Handle clickable rolls.
 * @param {Actor} actor The Actor making the roll
 * @param {Event} event The originating click event
 * @param {Actor} childRoller If chosen the attached actor that is making the roll
 */
export async function performRoll(event, actor, childRoller=None) {
  event.preventDefault();
  const element = event.currentTarget;
  const dataset = element.dataset;
  const rollType = dataset.rollType;

  if (!rollType) {
    return;
  }

  // Handle type-specific rolls.
  if (rollType == 'skill') {
    if (childRoller) {
      dataset.canCritD2 = childRoller.system.skills[dataset.skill].canCritD2;
      dataset.shift = childRoller.system.skills[dataset.skill].shift;
      dataset.shiftDown = childRoller.system.skills[dataset.skill].shiftDown;
      dataset.shiftUp = childRoller.system.skills[dataset.skill].shiftUp;
      dataset.isSpecialized = childRoller.system.skills[dataset.skill].isSpecialized;
    }

    actor.rollSkill(dataset, actor);
  } else if (rollType == 'initiative') {
    actor.rollInitiative({createCombatants: true});
  } else { // Handle items
    let item = null;

    const childKey = element.closest('.item').dataset.itemKey || null;
    if (childKey) {
      const childUuid = element.closest('.item').dataset.itemUuid;
      item = await fromUuid(childUuid);
    } else {
      const itemId = element.closest('.item').dataset.itemId;
      item = actor.items.get(itemId);
    }

    if (rollType == 'power') {
      return await powerCost(actor, item);
    } else if (rollType == 'rolePoints') {
      if (item.system.resource.max != null && item.system.resource.value < 1 && !actor.system.useUnlimitedResource) {
        ui.notifications.error(game.i18n.localize('E20.RolePointsOverSpent'));
        return;
      } else {
        const spentStrings = [];

        // Ensure we have enough Personal Power, if needed
        if (item.system.powerCost) {
          if (actor.system.powers.personal.value < item.system.powerCost) {
            ui.notifications.error(game.i18n.localize('E20.PowerOverSpent'));
            return;
          } else {
            await actor.update({
              ['system.powers.personal.value']:
                actor.system.powers.personal.value - item.system.powerCost,
            });

            spentStrings.push(`${item.system.powerCost} Power`);
          }
        }

        // If Role Points are being used and not unlimited, decrement uses
        if (!actor.system.useUnlimitedResource) {
          await item.update({ 'system.resource.value': item.system.resource.value - 1 });
          spentStrings.push('1 point');
        }

        if (spentStrings.length) {
          const spentString = spentStrings.join(', ');
          ui.notifications.info(game.i18n.format('E20.RolePointsSpent', { spentString, name: item.name }));
        }
      }
    }

    if (item) {
      return item.roll(dataset, actor, childRoller);
    }
  }
}

/**
 * Handle clicking the rest button.
 * @param {ActorSheet} actorSheet The ActorSheet whose rest button was clicked
 */
export async function onRest(actorSheet) {
  const actor = actorSheet.actor;
  const normalEnergon = actor.system.energon.normal;
  const maxEnergonRestore = Math.ceil(normalEnergon.max / 2);
  const energonRestore = Math.min(normalEnergon.max, normalEnergon.value + maxEnergonRestore);

  // Notifications for resetting Energon types
  if (actor.system.canTransform) {
    let energonsReset = [];

    const actorEnergons = actor.system.energon;
    for (const actorEnergon of Object.keys(actorEnergons)) {
      if (actorEnergons[actorEnergon].value) {
        energonsReset.push(game.i18n.localize(CONFIG.E20.energonTypes[actorEnergon]));
      }
    }

    if (energonsReset.length) {
      ui.notifications.info(
        game.i18n.format(
          'E20.RestEnergonReset',
          {energon: energonsReset.join(", ")},
        ),
      );
    }

    ui.notifications.info(game.i18n.format('E20.RestEnergonRestored', { energonRestore: energonRestore }));
  }

  // Reseting Personal Power
  let powerRestore = 0;
  if (actor.system.powers.personal.max > 0) {
    powerRestore = Math.min(
      actor.system.powers.personal.max,
      (actor.system.powers.personal.value + actor.system.powers.personal.regeneration),
    );

    if (powerRestore) {
      ui.notifications.info(game.i18n.localize("E20.RestPersonalPowerRegen"));
    }
  }

  // Recovering Essence damage
  for (const essence of Object.keys(actor.system.essences)) {
    if (actor.system.essences[essence].value < actor.system.essences[essence].max) {
      const essenceString = `system.essences.${essence}.value`;
      const essenceRestore = actor.system.essences[essence].value + 1;
      await actor.update({
        [essenceString]: essenceRestore,
      });

      ui.notifications.info(game.i18n.format('E20.RestEssenceRestored', { essenceRestore: essenceRestore, essence: CONFIG.E20.essences[essence] }));
    }
  }

  // Resetting Role Points
  const rolePointsList = getItemsOfType('rolePoints', actor.items);
  if (rolePointsList.length) {
    const rolePoints = rolePointsList[0];
    rolePoints.update({ 'system.resource.value': rolePoints.system.resource.max });
    ui.notifications.info(game.i18n.format('E20.RestRolePointsRestored', { name: rolePoints.name }));
  }

  ui.notifications.info(game.i18n.localize("E20.RestHealthStunReset"));
  ui.notifications.info(game.i18n.localize("E20.RestComplete"));

  await actor.update({
    "system.health.value": actor.system.health.max,
    "system.powers.personal.value": powerRestore,
    "system.stun.value": 0,
    "system.energon.normal.value": energonRestore,
    "system.energon.dark.value": 0,
    "system.energon.primal.value": 0,
    "system.energon.red.value": 0,
    "system.energon.synthEn.value": 0,
  }).then(actorSheet.render(false));
}

/**
 * Handle toggling accordion containers.
 * @param {Event} event The originating click event
 * @param {ActorSheet} actorSheet The ActorSheet whose accordion button was clicked
 */
export async function onToggleAccordion(event, actorSheet) {
  const el = event.currentTarget;
  const parent = $(el).closest('.accordion-wrapper');

  // Avoid collapsing NPC skills container on rerender
  if (parent.hasClass('skills-container')) {
    const isOpen = actorSheet.accordionStates.skills;
    actorSheet.accordionStates.skills = isOpen ? '' : 'open';
    actorSheet.render();
  } else {
    parent.toggleClass('open');

    // Check if the container header toggle should be flipped
    let oneClosed = false;

    // Look for a closed Item
    const accordionLabels = el.closest('.collapsible-item-container').querySelectorAll('.accordion-wrapper');
    for (const accordionLabel of accordionLabels) {
      oneClosed = !$(accordionLabel).hasClass('open');
      if (oneClosed) break;
    }

    // Set header state to open if all Items are open; closed otherwise
    const container = el.closest('.collapsible-item-container').querySelector('.header-accordion-wrapper');
    if (oneClosed) {
      $(container).removeClass('open');
    } else {
      $(container).addClass('open');
    }
  }
}

/**
 * Handle toggling accordion container headers.
 * @param {Event} event The originating click event
 * @param {ActorSheet} actorSheet The ActorSheet whose accordion button was clicked
 */
export async function onToggleHeaderAccordion(event) {
  const el = event.currentTarget;
  const isOpening = !$(el.closest('.header-accordion-wrapper')).hasClass('open');
  $(el.closest('.header-accordion-wrapper')).toggleClass('open');

  const accordionLabels = el.closest('.collapsible-item-container').querySelectorAll('.accordion-wrapper');
  for (const accordionLabel of accordionLabels) {
    isOpening ? $(accordionLabel).addClass('open') : $(accordionLabel).removeClass('open');
  }
}

/**
 * @param {Event} event The originating click event
 * @param {Actor} actor The Actor making the roll
 */
export async function onRoll(event, actor) {
  if (actor.type == 'vehicle' || actor.type == 'zord') {
    const choices = {};
    choices[PARENT_ROLLER_KEY] = {
      chosen: true,
      key: PARENT_ROLLER_KEY,
      label: actor.name,
    };
    for (const [key, passenger] of Object.entries(actor.system.actors)) {
      choices[key] = {
        chosen: false,
        key: key,
        label: passenger.name,
      };
    }

    new Dialog(
      {
        title: game.i18n.localize('E20.ActorSelect'),
        content: await renderTemplate("systems/essence20/templates/dialog/select-dialog.hbs", {
          choices,
        }),
        buttons: {
          save: {
            label: game.i18n.localize('E20.AcceptButton'),
            callback: html => handleActorSelector(actor, rememberSelect(html), event),
          },
        },
      },
    ).render(true);
  } else {
    performRoll(event, actor, null);
  }
}

/**
 *
 * @param {Actor} actor The Actor making the roll
 * @param {Object} options The actor selected in the dialog
 * @param {Event} event The originating click event
 */
async function handleActorSelector(actor, options, event) {
  let childRoller;
  if (options['actor'] == PARENT_ROLLER_KEY) {
    childRoller = actor;
  } else {
    const fullActor = actor.system.actors[options['actor']];
    childRoller = await fromUuid(fullActor.uuid);
  }

  performRoll(event, actor, childRoller);
}
