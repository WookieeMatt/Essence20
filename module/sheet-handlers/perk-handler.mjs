import ChoicesSelector from "../apps/choices-selector.mjs";
import MultiChoiceSelector from "../apps/multi-choice-selector.mjs";
import { E20 } from "../helpers/config.mjs";
import { deleteAttachmentsForItem } from "./attachment-handler.mjs";
import { performSpectrumShift } from "./role-handler.mjs";

const SORCERY_PERK_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.xUBOE1s5pgVyUrwj";
const ZORD_PERK_ID = "Compendium.essence20.pr_crb.Item.rCpCrfzMYPupoYNI";
const SPECTRUM_SHIFT_PERK_ID = "Compendium.essence20.pr_crb.Item.HxbEBJ3gXkTQqvxt";

/**
 * Handle the dropping of a Perk onto an Actor
 * @param {Actor} actor The Actor receiving the Perk
 * @param {Perk} perk The Perk being dropped
 * @param {Function} dropFunc The function to call to complete the Power drop
 * @param {String} selection The selection from the Choices Selector App
 * @param {String} selectionType The type of selection that was made in the Choices Selector App
 * @param {Perk} parentPerk The Perk that the current Perk was attached to
 */
export async function onPerkDrop(actor, perk, dropFunc=null, selection=null, selectionType=null, parentPerk=null) {
  if (selectionType == 'role') {
    // Spectrum Shift: create the Perk itself as normal, then perform the actual respec.
    const perkDrop = await dropFunc();
    const newSpectrumShiftPerk = perkDrop[0];
    const newRole = await fromUuid(selection);
    await performSpectrumShift(actor, newRole);

    return newSpectrumShiftPerk;
  }

  let updateString = null;
  let updateValue = null;
  let newPerk = null;
  let currentRole = null;

  if (perk.system.hasChoice) {
    if (selectionType == 'environments') {
      updateString = "system.environments";
      updateValue = actor.system.environments;
      updateValue.push(selection);
      actor.update({
        [updateString]: updateValue,
      });
    } else if (selectionType == 'senses') {
      updateString = `system.senses.${selection}.acute`;
      actor.update({
        [updateString]: true,
      });
    } else if (selectionType == 'movement') {
      updateString = `system.movement.${selection}.bonus`;
      const updateValue = actor.system.movement[selection].bonus + perk.system.value;
      actor.update({
        [updateString]: updateValue,
      });
    } else if (selectionType == 'skills') {
      // e.g. Expertise (GI Joe CRB p.72): "Choose two skills. You're an expert in each, gaining
      // [2 upshifts] when using them." Corrected from an earlier version of this branch that
      // wrote perk.system.value into the skill's flat .modifier instead - the PDF's own up-shift
      // glyph is lost by plain-text extraction (renders as blank space before the "2"), and it
      // got misread as a "+2" numeric bonus; the user, checking their own actor sheet against the
      // book, caught both that and the single-choice bug below. system.skills.<skill>.shiftUp is
      // the field templates/actor/parts/misc/essence-skills.hbs's own roll link already reads
      // into dataset.shiftUp for every skill roll, so writing here needs no dice.mjs changes.
      // Each skill choice is its own independent Perk grant (see Expertise's compendium entry,
      // granted 4 times across Commando's own progression table: twice at 1st level for the
      // initial 2 skills, twice more at 7th for "2 more skills"), so this only ever needs to
      // apply the bonus to the one skill chosen this time.
      updateString = `system.skills.${selection}.shiftUp`;
      const updateValue = actor.system.skills[selection].shiftUp + perk.system.value;
      actor.update({
        [updateString]: updateValue,
      });
    }
  }

  let timesTaken = 0;

  for (let actorItem of actor.items) {
    if (actorItem.type == "role"){
      currentRole = actorItem;
    }

    const itemSourceId = await actor.items.get(actorItem._id)._stats.compendiumSource;
    if (actorItem.type == 'perk' && itemSourceId == perk.uuid) {
      timesTaken++;
      const numberOfAdvances = actorItem.system.advances.currentValue/actorItem.system.advances.increaseValue;
      if (perk.system.selectionLimit == timesTaken || (perk.system.selectionLimit == numberOfAdvances)) {
        ui.notifications.error(game.i18n.localize('E20.PerkAlreadyTaken'));
        return;
      }

      if (perk.system.advances.canAdvance) {
        const newValue = actorItem.system.advances.currentValue + actorItem.system.advances.increaseValue;
        await actorItem.update({
          "system.advances.currentValue": newValue,
        });
        setPerkAdvancesName (actorItem, perk.name);
        return;
      }
    }
  }

  if (parentPerk) {
    newPerk = await Item.create(perk, { parent: actor });
    for (const [key, attachment] of Object.entries(parentPerk.system.items)) {
      if (perk.uuid == attachment.uuid){
        newPerk.setFlag('essence20', 'collectionId', key);
      }
    }

    newPerk.setFlag('essence20', 'parentId', parentPerk._id);
    newPerk.update({
      "_stats.compendiumSource": perk.uuid,
    });
  } else if (!dropFunc) {
    newPerk = perk;
  } else {
    const perkDrop = await dropFunc();
    newPerk = perkDrop[0];
  }

  if (['environments', 'senses', 'movement', 'skills', 'fightingStyle', 'field'].includes(selectionType)) {
    const localizedSelection = selectionType == 'movement'
      ? game.i18n.localize(E20.movementTypes[selection])
      // Field's choices are a restricted subset of the same skill list 'skills' already uses
      // (see E20.fieldSkills, helpers/config.mjs), not a distinct label set of their own.
      : selectionType == 'field'
        ? game.i18n.localize(E20.skills[selection])
        : game.i18n.localize(E20[selectionType][selection]);
    const newName = `${newPerk.name} (${localizedSelection})`;
    newPerk.update({
      "name": newName,
      "system.choice": selection,
    });
  } else if (selectionType == 'perks') {
    const chosenPerk = perk.system.items[selection];
    const itemToCreate = await fromUuid(chosenPerk.uuid);

    if (itemToCreate.system.hasChoice) {
      setPerkValues(actor, itemToCreate, newPerk, null);
    } else {
      const createdPerk = await Item.create(itemToCreate, { parent: actor });
      createdPerk.setFlag('essence20', 'collectionId', selection);
      createdPerk.setFlag('essence20', 'parentId', newPerk._id);
      createdPerk.update({
        "_stats.compendiumSource": itemToCreate.uuid,
      });
    }
  }

  if (newPerk?.system.isRoleVariant) {
    setRoleVatiantPerks(newPerk, currentRole, actor);
  }

  if (newPerk.system.advances.canAdvance) {
    await newPerk.update({
      "system.advances.currentValue": newPerk.system.advances.baseValue,
    });
    const originalName = newPerk.name;
    setPerkAdvancesName(newPerk, originalName);
  }

  return newPerk;
}

/**
 * Handles setting values for specific Perks and and displays a ChoicesSelector if needed
 * @param {Actor} actor The Actor receiving the Perk
 * @param {Perk} perk The Perk being dropped
 * @param {Perk} parentPerk The Perk this perk is attached to
 * @param {Function} dropFunc The function to call to complete the Perk drop
 * @param {String} sourceUuid (Optional) The Perk's original compendium UUID. Needed when
 *   `perk` is already an Actor-embedded copy (e.g. granted via createItemCopies() during a
 *   Role/level-up grant) rather than the compendium document itself, since an embedded Item's
 *   own `.uuid` is an Actor-relative path and will never match the hardcoded compendium IDs
 *   below (SORCERY_PERK_ID etc.) on its own.
 */
export async function setPerkValues(actor, perk, parentPerk=null, dropFunc=null, sourceUuid=null) {
  const perkUuid = sourceUuid ?? perk.uuid;

  if (perkUuid == SORCERY_PERK_ID) {
    await actor.update ({
      "system.powers.sorcerous.levelTaken": actor.system.level,
    });
  } else if (perkUuid == ZORD_PERK_ID) {
    await actor.update ({
      "system.canHaveZord": true,
    });
  } else if (perkUuid == SPECTRUM_SHIFT_PERK_ID) {
    return await _showSpectrumShiftDialog(actor, perk, dropFunc);
  } else if (perk.system.hasMorphedToughnessBonus) {
    setMorphedToughnessBonus(actor);
  }

  if (perk.system.hasChoice) {
    let choices = {};
    let prompt = null;
    let title = game.i18n.localize("E20.PerkSelect");

    switch (perk.system.choiceType) {
    case 'field':
      // GI Joe CRB p.104 (Technician/Expert Focus, 1st level): "choose a Culture, Science, or
      // Technology Specialization... This is your Field." Only records which skill was chosen -
      // the actual Essence Increase and marking that skill Specialized are both already handled
      // by the generic Essence Increase flow this Perk also grants, same division of labor as
      // Renegade's own Training (Essence Increase generic, the skill-choice itself Perk-specific).
      // Eureka/Expert in Your Field both read this choice back via findPerk(actor,
      // FIELD_ID)?.system.choice (helpers/perks.mjs), same shape Fighting Style already uses.
      prompt = game.i18n.localize("E20.SelectField");
      for (const skill of E20.fieldSkills) {
        const localizedLabel = game.i18n.localize(E20.skills[skill]);
        choices[skill] = {
          chosen: false,
          value: skill,
          label: localizedLabel,
          type: perk.system.choiceType,
        };
      }

      break;

    case 'environments':
      prompt = game.i18n.localize("E20.SelectEnvironment");
      for (const environment of Object.keys(CONFIG.E20.environments)) {
        if (!actor.system.environments.includes(environment)) {
          const localizedLabel = game.i18n.localize(E20.environments[environment]);
          choices[environment] = {
            chosen: false,
            value: environment,
            label: localizedLabel,
            type: perk.system.choiceType,
          };
        }
      }

      break;

    case 'movement':
      prompt = game.i18n.localize("E20.SelectMovement");
      for (const movement of Object.keys(actor.system.movement)) {
        if (actor.system.movement[movement].base > 0) {
          const localizedLabel = game.i18n.localize(E20.movementTypes[movement]);
          choices[movement] = {
            chosen: false,
            value: movement,
            label: localizedLabel,
            type: perk.system.choiceType,
          };
        }
      }

      break;

    case 'perks':
      if (perk.system.numChoices > 1) {
        prompt = game.i18n.format(
          'E20.SelectMultiplePerks',
          {
            numChoices: perk.system.numChoices,
          },
        );
      } else {
        prompt = game.i18n.localize("E20.SelectPerk");
      }

      for (const [key, item] of Object.entries(perk.system.items)) {
        let taken = false;
        for (const attachedItem of actor.items) {
          if (item.uuid == attachedItem._stats.compendiumSource) {
            taken = true;
            break;
          }
        }

        if (!taken) {
          choices[key] = {
            chosen: false,
            value: key,
            label: item.name,
            uuid: item.uuid,
            type: perk.system.choiceType,
          };
        }
      }

      break;

    case 'senses':
      prompt = game.i18n.localize("E20.SelectSense");
      for (const sense of Object.keys(CONFIG.E20.senses)) {
        if (!actor.system.senses[sense].acute) {
          const localizedLabel = game.i18n.localize(E20.senses[sense]);
          choices[sense] = {
            chosen: false,
            value: sense,
            label: localizedLabel,
            type: perk.system.choiceType,
          };
        }
      }

      break;

    case 'skills':
      // e.g. Expertise (GI Joe CRB p.72). Every skill is offered every time this Perk is granted
      // (unlike senses/movement above, a skill already boosted by an earlier Expertise grant - or
      // by anything else - has no single reliable "already chosen" marker to filter on), so the
      // player is trusted to pick a different skill each time, same as they already are for which
      // skill to specialize in elsewhere in this system.
      prompt = game.i18n.localize("E20.SelectSkill");
      for (const skill of Object.keys(CONFIG.E20.skills)) {
        const localizedLabel = game.i18n.localize(E20.skills[skill]);
        choices[skill] = {
          chosen: false,
          value: skill,
          label: localizedLabel,
          type: perk.system.choiceType,
        };
      }

      break;

    case 'fightingStyle':
      // GI Joe CRB p.79/108 - shared by Infantry and Vanguard's identical "Fighting Style"
      // Perk. Unlike senses/movement/skills above, none of the 6 options has a single dedicated
      // numeric field to add into - each one is read directly off this Perk's own system.choice
      // at the point it actually matters (e.g. Careful/Defense in documents/actor.mjs's
      // _prepareDefenses), so no extra onPerkDrop consumption branch is needed beyond the
      // generic rename + system.choice write every choiceType in this switch already gets below.
      prompt = game.i18n.localize("E20.SelectFightingStyle");
      for (const style of Object.keys(E20.fightingStyle)) {
        const localizedLabel = game.i18n.localize(E20.fightingStyle[style]);
        choices[style] = {
          chosen: false,
          value: style,
          label: localizedLabel,
          type: perk.system.choiceType,
        };
      }

      break;
    }

    if (!Object.entries(choices).length){
      ui.notifications.error(game.i18n.localize('E20.NoChoicesError'));
      return false;
    }

    if (perk.system.numChoices > 1 && perk.system.choiceType == "perks") {
      await new MultiChoiceSelector(choices, actor, prompt, title, perk, dropFunc, parentPerk).render(true);
    } else {
      await new ChoicesSelector(choices, actor, prompt, title, perk, null, dropFunc, null, parentPerk, null).render(true);
    }

  } else {
    return await onPerkDrop(actor, perk, dropFunc, null, null);
  }
}

/**
 * Shows the Role choice dialog for the Spectrum Shift Perk, offering every other Power
 * Rangers Role across every loaded compendium (so future sourcebooks' Roles are included).
 * Per the core rulebook (p.58), Spectrum Shift/the Advanced Ranger Spectrum is specifically a
 * Power Rangers mechanic - "this core rulebook details the rules for the Advanced Spectrum
 * Role of the White Ranger" for the Power Rangers line; other game versions (Transformers/My
 * Little Pony/G.I. Joe) don't have an equivalent, so this only applies when the Actor's
 * current Role is itself a Power Rangers one.
 * @param {Actor} actor The Actor taking the Spectrum Shift Perk
 * @param {Perk} perk The Spectrum Shift Perk being dropped
 * @param {Function} dropFunc The function to call to complete the Perk drop
 */
async function _showSpectrumShiftDialog(actor, perk, dropFunc) {
  // .find() rather than [0]: an Actor may also have a separate additive Role (e.g. Old Hand)
  // alongside their base Role - Spectrum Shift only ever operates on the base one.
  const currentRole = actor.items.documentsByType.role.find(r => !r.system.isAdditive);
  if (!currentRole) {
    ui.notifications.error(game.i18n.localize('E20.SpectrumShiftNoRoleError'));
    return false;
  }

  if (currentRole.system.version != 'powerRangers') {
    ui.notifications.error(game.i18n.localize('E20.SpectrumShiftNotPowerRangersError'));
    return false;
  }

  const choices = {};
  for (const pack of game.packs.filter(p => p.documentName == 'Item')) {
    const index = await pack.getIndex({ fields: ['type', 'system.version', 'system.isAdditive'] });
    for (const entry of index) {
      const isOtherPowerRangersRole = entry.type == 'role'
        && entry.system?.version == 'powerRangers'
        && !entry.system?.isAdditive
        && entry.uuid != currentRole._stats.compendiumSource;

      if (isOtherPowerRangersRole) {
        choices[entry.uuid] = {
          chosen: false,
          value: entry.uuid,
          label: entry.name,
          type: 'role',
        };
      }
    }
  }

  if (!Object.entries(choices).length) {
    ui.notifications.error(game.i18n.localize('E20.NoChoicesError'));
    return false;
  }

  const prompt = game.i18n.localize("E20.SelectSpectrumShiftRole");
  const title = game.i18n.localize("E20.PerkSelect");

  await new ChoicesSelector(choices, actor, prompt, title, perk, null, dropFunc, null, null, null).render(true);
}

/**
 * Handle the deleting of a Perk on an Actor
 * @param {Actor} actor The Actor receiving the Perk
 * @param {Perk} perk The perk
 */
export async function onPerkDelete(actor, perk) {
  if (perk.flags.core?.sourceId == SORCERY_PERK_ID || perk._stats.compendiumSource == SORCERY_PERK_ID ) {
    await actor.update ({
      "system.powers.sorcerous.levelTaken": 0,
    });
  }

  if (perk.flags.core?.sourceId == ZORD_PERK_ID || perk._stats.compendiumSource == ZORD_PERK_ID ) {
    await actor.update ({
      "system.canHaveZord": false,
    });
  }

  if (perk.system.hasMorphedToughnessBonus ) {
    await actor.update ({
      "system.canSetToughnessBonus": false,
      "system.defenses.toughness.morphed": 0,
    });
  }

  let updateString = null;
  let updateValue = null;
  const selectionType = perk.system.choiceType;
  if (selectionType == 'environments') {
    updateString = "system.environments";
    updateValue = actor.system.environments;
    const index = updateValue.indexOf(perk.system.choice);
    updateValue.splice(index, 1);
    actor.update({
      [updateString]: updateValue,
    });
  } else if (selectionType == 'senses') {
    updateString = `system.senses.${perk.system.choice}.acute`;
    actor.update({
      [updateString]: false,
    });
  } else if (selectionType == 'movement') {
    updateString = `system.movement.${perk.system.choice}.bonus`;
    const updateValue = actor.system.movement[perk.system.choice].bonus - perk.system.value;
    actor.update({
      [updateString]: updateValue,
    });
  }

  deleteAttachmentsForItem(perk, actor);
}

/**
 * Handles the changing of the Defense Toughness Morphed bonus.
 * @param {Actor} actor The Actor whose bonus is changing
 */
export async function setMorphedToughnessBonus(actor) {
  let morphedBonus = 0;
  if (actor.system.trained.armors.ultraHeavy) {
    morphedBonus = CONFIG.E20.morphedToughness.ultraHeavy;
  } else if (actor.system.trained.armors.heavy) {
    morphedBonus = CONFIG.E20.morphedToughness.heavy;
  } else if (actor.system.trained.armors.medium) {
    morphedBonus = CONFIG.E20.morphedToughness.medium;
  } else if (actor.system.trained.armors.light) {
    morphedBonus = CONFIG.E20.morphedToughness.light;
  }

  await actor.update ({
    "system.canSetToughnessBonus": true,
    "system.defenses.toughness.morphed": morphedBonus,
  });
}

/**
 * Handles adding subperks that have an associated role
 * @param {Perk} newPerk The new perk that is being added to the actor from the faction.
 * @param {Role} currentRole The current role assigned to the actor.
 * @param {Actor} actor The actor that the faction is being dropped on.
 */
async function setRoleVatiantPerks(newPerk, currentRole, actor) {
  for (const [key, perk] of Object.entries(newPerk.system.items)) {
    if (currentRole?.name == perk.role) {
      const itemToCreate = await fromUuid(perk.uuid);
      if (itemToCreate.system.choiceType != 'none') {
        setPerkValues(actor, itemToCreate, perk, null);
      } else {
        const createdPerk = await Item.create(itemToCreate, { parent: actor });
        createdPerk.setFlag('essence20', 'collectionId', key);
        createdPerk.setFlag('essence20', 'parentId', newPerk._id);
        createdPerk.update({
          "_stats.compendiumSource": newPerk.uuid,
        });
      }
    }
  }
}

/**
 * Handles updating the perk name with the advancement data.
 * @param {Perk} perk The perk whose name is getting updated.
 * @param {String} originalName The name from the perk being added.
 */
export function setPerkAdvancesName(perk, originalName) {
  let localizedString = null;
  switch (perk.system.advances.type) {
  case 'area':
    localizedString = perk.system.advances.currentValue + "' x " + perk.system.advances.currentValue + "'";
    break;
  case 'damage':
    localizedString = "+" + perk.system.advances.currentValue + " Damage";
    break;
  case 'die':
    localizedString = '1d' + perk.system.advances.currentValue;
    break;
  case 'number':
    localizedString = perk.system.advances.currentValue;
    break;
  case 'rerolls':
    localizedString = "Reroll " + perk.system.advances.currentValue + "s";
    break;
  case 'upshift':
    localizedString = '\u2191' + perk.system.advances.currentValue;
    break;
  }

  const newName = `${originalName} (${localizedString})`;

  perk.update({
    "name": newName,
  });
}
