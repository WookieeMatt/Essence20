import { powerCost } from "./power-handler.mjs";
import RollerSelector from "../apps/roller-selector.mjs";
import DefenseModificationSelector from "../apps/defense-modification.mjs";

const PARENT_ROLLER_KEY = "parentActor";

/**
 * Handle clickable rolls.
 * @param {Event} event The originating click event
 * @param {Actor} actor The Actor making the roll
 * @param {Actor} childRoller Optional attached Actor making the roll
 */
export async function performRoll(event, actor, childRoller=None) {
  event.preventDefault();
  // event.target is whatever was actually clicked - usually the <i> icon inside the rollable
  // <a>, not the <a> itself. Most roll buttons work around this by duplicating data-roll-type
  // (and friends) onto the icon too, but that's easy to miss (see rolePoints/container.hbs,
  // which didn't - its icons silently did nothing since dataset.rollType was undefined on the
  // <i>). Resolving the nearest [data-roll-type] ancestor makes this work regardless of which
  // element inside the button was actually clicked, without relying on every template
  // remembering to duplicate the attributes.
  const element = event.target.closest('[data-roll-type]') || event.target;
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
      await spendRolePoint(actor, item);
    }

    if (item) {
      return item.roll(dataset, childRoller);
    }
  }
}

/**
 * Spends one use of a Role Points item's resource pool (and its Personal Power cost, if it has
 * one). Shared by performRoll()'s "rolePoints" roll type above and the Role Points row's own
 * right-click "Spend a Point" context menu entry (rolePoints/container.hbs, wired up in
 * base-actor-sheet.mjs) - both are "actually use this Role Points ability," just triggered from
 * different UI (the row's fist icon used to trigger this via performRoll; the row is now driven
 * entirely by clicking/right-clicking its name instead, so this needed to be callable directly
 * rather than only reachable through a [data-roll-type] element's dataset).
 * @param {Actor} actor The Actor spending the Role Points use
 * @param {Item} item The RolePoints Item being spent
 */
export async function spendRolePoint(actor, item) {
  if (item.system.resource.max != null && item.system.resource.value < 1 && !actor.system.useUnlimitedResource) {
    ui.notifications.error(game.i18n.localize('E20.RolePointsOverSpent'));
    return;
  }

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

/**
 * Applies the shared Rest/Recharge restorative benefits (Health, Stun, Essence, Role Points,
 * Personal Power, Energon) to the actor, finishing with the given completion notification.
 * Shared by onRest() (all actors) and onRecharge() (Transformers CRB p.172 - the
 * Cybertronian-flavored version of this same action, restoring half of Energon Points).
 * @param {Actor} actor The Actor being rested/recharged
 * @param {String} completeMessageKey The i18n key for the final "done" notification
 */
async function _applyRestBenefits(actor, completeMessageKey) {
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
  if (actor.system.powers?.personal.max) {
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
  const rolePointsList = actor.items.documentsByType.rolePoints;
  for (const rolePoints of rolePointsList) {
    await rolePoints.update({ 'system.resource.value': rolePoints.system.resource.max });
    ui.notifications.info(game.i18n.format('E20.RestRolePointsRestored', { name: rolePoints.name }));
  }

  ui.notifications.info(game.i18n.localize("E20.RestHealthStunReset"));
  ui.notifications.info(game.i18n.localize(completeMessageKey));

  await actor.update({
    "system.health.value": actor.system.health.max,
    "system.powers.personal.value": powerRestore,
    "system.stun.value": 0,
    "system.energon.normal.value": energonRestore,
    "system.energon.dark.value": 0,
    "system.energon.primal.value": 0,
    "system.energon.red.value": 0,
    "system.energon.synthEn.value": 0,
  });
}

/**
 * Handle clicking the rest button.
 * @param {ActorSheet} actorSheet The ActorSheet whose rest button was clicked
 */
export async function onRest(actorSheet) {
  await _applyRestBenefits(actorSheet.actor, "E20.RestComplete");
  actorSheet.render(false);
}

/**
 * Handle clicking the recharge button (Transformers CRB p.172) - shown instead of the rest
 * button for actors that can transform.
 * @param {ActorSheet} actorSheet The ActorSheet whose recharge button was clicked
 */
export async function onRecharge(actorSheet) {
  await _applyRestBenefits(actorSheet.actor, "E20.RechargeComplete");
  actorSheet.render(false);
}

/**
 * Recover 1 point of a caster's lingering Spellcasting downshift (Casting Cost, MLP CRB p.132).
 * The rulebook regains this automatically each round at the start of the caster's turn, but
 * this codebase has no per-round/combat-turn automation for any mechanic yet (Rest/Recharge
 * above are likewise both manually-triggered "restore" actions), so this is exposed as a
 * manual action instead.
 * @param {ActorSheet} actorSheet The ActorSheet whose recover button was clicked
 */
export async function onRecoverSpellcastingDownshift(actorSheet) {
  const actor = actorSheet.actor;
  const currentDownshift = actor.system.skills.spellcasting.shiftDown;
  if (currentDownshift <= 0) {
    return;
  }

  await actor.update({ 'system.skills.spellcasting.shiftDown': currentDownshift - 1 });
  actorSheet.render(false);
}

/**
 * Suffer 1 Health Damage to recover 1 additional point of Spellcasting downshift beyond the
 * normal per-round recovery (Casting Cost, MLP CRB p.132).
 * @param {ActorSheet} actorSheet The ActorSheet whose button was clicked
 */
export async function onSufferForSpellcastingDownshift(actorSheet) {
  const actor = actorSheet.actor;
  const currentDownshift = actor.system.skills.spellcasting.shiftDown;
  if (currentDownshift <= 0) {
    return;
  }

  await actor.update({
    'system.skills.spellcasting.shiftDown': currentDownshift - 1,
    'system.health.value': Math.max(0, actor.system.health.value - 1),
  });
  actorSheet.render(false);
}

/**
 * Handle toggling accordion containers.
 * @param {Event} event The originating click event
 * @param {ActorSheet} actorSheet The ActorSheet whose accordion button was clicked
 */
export async function onToggleAccordion(event, actorSheet) {
  const el = event.target;
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
  const el = event.target;
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

    const title = "E20.ActorSelect";
    new RollerSelector(actor, choices, event, title).render(true);
  } else {
    performRoll(event, actor, null);
  }
}

/**
 * @param {Actor} actor The Actor making the roll
 * @param {String} key the Actor key
 * @param {Event} event The originating click event
 */
export async function handleActorSelector(actor, key, event) {
  let childRoller;
  if (key == PARENT_ROLLER_KEY) {
    childRoller = actor;
  } else {
    const fullActor = actor.system.actors[key];
    childRoller = await fromUuid(fullActor.uuid);
  }

  performRoll(event, actor, childRoller);
}

export async function onEditMorphToughnessBonus(event, actorSheet){
  const actor = actorSheet.actor;
  const choices = {};
  let selected = null;

  for (const [armor, value] of Object.entries(CONFIG.E20.morphedToughness)) {
    if (actor.system.trained.armors[armor]) {
      choices[armor] = {
        key: armor,
        label: CONFIG.E20.armorClassifications[armor],
        value,
      };
    }

    if (actor.system.defenses.toughness.morphed == value) {
      selected = armor;
    }
  }

  const prompt = "E20.DefenseModificationPrompt";
  const title = "E20.DefenseModificationTitle";

  if (Object.keys(choices).length == 0) {
    ui.notifications.warn(game.i18n.localize('E20.NoArmorChoices'));
  } else {
    new DefenseModificationSelector(choices, actor, prompt, title, selected).render(true);
  }

  return;
}
