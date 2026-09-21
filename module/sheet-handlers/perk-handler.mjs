import ChoicesSelector from "../apps/choices-selector.mjs";
import MultiChoiceSelector from "../apps/multi-choice-selector.mjs";
import { E20 } from "../helpers/config.mjs";
import { deleteAttachmentsForItem } from "./attachment-handler.mjs";
import { performSpectrumShift } from "./role-handler.mjs";
import { isPrincessPerk, removeSpellcastingUpshift } from "../helpers/princess-perks.mjs";
import { grantBlendInUpgrades } from "../helpers/blend-in.mjs";
import { grantSpeakYourTruthEssence, SPEAK_YOUR_TRUTH_ID } from "../helpers/speak-your-truth.mjs";

const SORCERY_PERK_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.xUBOE1s5pgVyUrwj";
const ZORD_PERK_ID = "Compendium.essence20.pr_crb.Item.rCpCrfzMYPupoYNI";
const SPECTRUM_SHIFT_PERK_ID = "Compendium.essence20.pr_crb.Item.HxbEBJ3gXkTQqvxt";

// Duty of the Silver (Across the Stars, Silver Ranger, 7th level, p.57): "you gain training in
// Heavy Armor automatically, or Ultra-Heavy Armor if you already have Heavy." Only this half is
// built - the "teleport to the nearest concentration of Power Rangers" clause has no target data
// to resolve against, pure GM narration. Applied once, on drop, same shape as ZORD_PERK_ID's own
// grant just above - pulled into its own small function (unlike ZORD_PERK_ID's inline update) so
// it can be unit tested directly, since setPerkValues as a whole always falls through to
// onPerkDrop's own much larger, drag-and-drop-UI-coupled tail and isn't practical to unit test
// end-to-end.
const DUTY_OF_THE_SILVER_ID = "Compendium.essence20.across_the_stars.Item.KhV5GeGIMJNWlWhr";

// Beatdown (Cobra Codex, Vanguard Warthog Focus, 3rd level, p.69): "You are always considered
// armed with an integrated close combat heavy bludgeon, even if you're unarmed or your hands are
// full." "Integrated weapon" has no dedicated concept anywhere in this schema - the closest real
// equivalent is simply always HAVING the weapon Item on the sheet, so it's never actually
// "unarmed" in the sense every other unarmed-attack proxy in this project checks (no parent
// weapon Item at all). See grantBeatdownWeapon() below.
const BEATDOWN_ID = "Compendium.essence20.cobra_codex.Item.38zFS75lhzBWiurT";
const CLOSE_COMBAT_HEAVY_BLUDGEONING_ID = "Compendium.essence20.gi_joe_crb.Item.xthnRWfhbfXvpmZN";

// Jackhammer (Cobra Codex, Vanguard Warthog Focus, 20th level, p.69): "you are considered armed
// with an integrated power tool, even if you're unarmed or your hands are full. This works in all
// other ways like Beatdown." Identical mechanic to Beatdown, just a different granted weapon - see
// grantIntegratedWeapon() below, the generalized form of grantBeatdownWeapon's own logic.
const JACKHAMMER_ID = "Compendium.essence20.cobra_codex.Item.sBoZ2KrzmKlWIlYu";
const POWER_TOOL_ID = "Compendium.essence20.gi_joe_crb.Item.Jnjio1DtAx0QgE85";

// Ferocious Fighters (Factions in Action Vol 1) - 3 Faction Perks that should each grant a fixed
// General Perk outright but ship with an empty items map (a real wiring gap the categorization
// pass found, not a missing mechanism - the SAME grant-a-Perk-outright pattern this file already
// uses for Duty of the Silver's training grant/Beatdown's weapon grant, just targeting another
// Perk item this time). None of the 3 need a player CHOICE (each grants exactly one fixed thing),
// so a dedicated function (matching Beatdown's own shape) is used instead of the hasChoice picker
// mechanism, which would otherwise force an unnecessary "choose 1 of 1" confirmation dialog.
const CHANGE_ITS_STRIPES_ID = "Compendium.essence20.ferocious_fighters.Item.8tz9aZSqmUntS20H";
const BLEND_IN_ID = "Compendium.essence20.ferocious_fighters.Item.mnze6jJ6eSYbS8Pr";
const COMBAT_LIFESAVER_ID = "Compendium.essence20.ferocious_fighters.Item.e48e4SaTGt7rOOUj";
const EMT_CRASH_COURSE_ID = "Compendium.essence20.gi_joe_crb.Item.jDAu1zaZpv1IylJ8";
const LIFE_FINDS_A_WAY_ID = "Compendium.essence20.ferocious_fighters.Item.j6KOCP9HsyzO3UHa";
const DODGY_ID = "Compendium.essence20.gi_joe_crb.Item.GQwhr14X9yXkAuWH";

// For The Syndicate (Factions in Action Vol. 2, International Syndicate Faction Perk, p.102):
// "You gain Mentor (see The G.I. JOE Roleplaying Game Core Rulebook pg. 132) as a bonus General
// Perk." Same grant-a-Perk-outright pattern as Change Its Stripes/Combat Lifesaver/Life Finds A
// Way just above.
const FOR_THE_SYNDICATE_ID = "Compendium.essence20.intercontinental_adventures.Item.opygNwRWgeIyU1mE";
const MENTOR_ID = "Compendium.essence20.gi_joe_crb.Item.jUZrNJbPzSd1zVLa";

// Expertise (GI Joe CRB, Commando base, 1st/7th level, p.72): "Choose two skills... You choose
// two more skills at 7th level" - granted 4 separate times across Commando's own progression
// table (system.selectionLimit: 4), each instance its own independent skill pick. See the
// 'skills' choice case below for why picking the SAME skill across two of those instances is
// now blocked specifically for this Perk.
const EXPERTISE_GIJ_ID = "Compendium.essence20.gi_joe_crb.Item.F9kOLys1Iu4UOg22";

/**
 * Expertise (see EXPERTISE_GIJ_ID's own comment above) - the skills already chosen by another
 * instance of this same Perk already on the actor, so the 'skills' choice-building case below can
 * exclude them from the picker. Pulled into its own small, directly-testable function (unlike the
 * inline "already taken" filter the 'perks' case above uses in place) since setPerkValues as a
 * whole isn't practically unit-testable end-to-end (see grantDutyOfTheSilverArmorTraining's own
 * comment for why). A no-op array for any Perk other than Expertise itself - this only narrows
 * Commando's own Expertise, not every 'skills'-choiceType Perk in this system.
 * @param {Actor} actor
 * @param {Item} perk   The Expertise instance currently being configured.
 * @returns {Array<String>}
 */
export function getAlreadyChosenExpertiseSkills(actor, perk) {
  // Falls back to perk.uuid (always populated immediately on a real Foundry Item document, no
  // Item.create()/setFlag() timing dependency) alongside the flags/_stats sourceId lookup - see
  // onPerkDrop's own duplicate-skill guard, which calls this at the exact moment
  // grantItemEntry() has created the Item but hasn't yet called setFlag('core', 'sourceId', ...)
  // on it, so flags.core.sourceId can genuinely still be unset at that point.
  const perkSourceId = perk.flags?.core?.sourceId ?? perk._stats?.compendiumSource ?? perk.uuid;
  if (perkSourceId != EXPERTISE_GIJ_ID) {
    return [];
  }

  return actor.items
    .filter(item => (item.flags.core?.sourceId ?? item._stats.compendiumSource) == EXPERTISE_GIJ_ID)
    .map(item => item.system.choice)
    .filter(Boolean);
}

/**
 * Handles Commando's own Expertise being granted via a single MultiChoiceSelector asking for
 * both skills at once (perk.system.numChoices: 2) - see EXPERTISE_GIJ_ID's own comment above for
 * why this replaced the earlier "2 separate single-skill grants at the same level" shape.
 *
 * Rather than reshape Expertise's own data model (a single item covering 2 skills at once, which
 * would also mean widening getAlreadyChosenExpertiseSkills to look inside a comma/array-shaped
 * system.choice instead of a single value), this keeps the exact same "one Expertise item, one
 * skill" shape every other piece of this Perk's own code already assumes: `perk` (the instance
 * grantItemEntry already created) is configured with the first skill via the ordinary single-
 * skill onPerkDrop path, and a second Expertise Item is created and configured with the second
 * skill the same way. The end state - 2 separate "Expertise (Skill)" items - is identical to
 * what the old 2-separate-grants flow produced, just without ever having 2 dialogs open at once.
 * @param {Actor} actor
 * @param {Item} perk        The already-created Expertise instance the MultiChoiceSelector was
 *                            configuring (see grantItemEntry's own Item.create, called before
 *                            setPerkValues ever opens the picker).
 * @param {Array<String>} skills   The 2 chosen skill keys.
 * @param {Function} dropFunc
 * @param {Item} parentPerk
 */
export async function onMultiSkillPerkDrop(actor, perk, skills, dropFunc=null, parentPerk=null) {
  const alreadyChosen = getAlreadyChosenExpertiseSkills(actor, perk);
  if (skills[0] == skills[1] || skills.some(skill => alreadyChosen.includes(skill))) {
    ui.notifications.warn(game.i18n.localize('E20.ExpertiseDuplicateSkillError'));
    // Re-open the SAME picker on this same Perk instance instead of deleting it and leaving the
    // actor without a grant Commando's own progression table says they're owed at this level -
    // this instance was already created (grantItemEntry's own Item.create, before this dialog
    // ever opened) and deleting it here would silently drop it with no automatic way to get it
    // back. By the time this guard fires, whichever OTHER dialog caused the race (2 Expertise
    // grants due at different levels, both opened in the same character-creation batch before
    // either was confirmed - see this function's own doc comment) has already had its own pick
    // persisted, so the freshly-rebuilt picker correctly excludes it this time.
    return setPerkValues(actor, perk, parentPerk, dropFunc);
  }

  await onPerkDrop(actor, perk, dropFunc, skills[0], 'skills', parentPerk);

  const perkSourceId = perk.flags?.core?.sourceId ?? perk._stats?.compendiumSource ?? perk.uuid;
  const expertiseSource = await fromUuid(perkSourceId);
  const secondPerk = await Item.create(expertiseSource, { parent: actor });
  await secondPerk.setFlag('core', 'sourceId', perkSourceId);

  // The twin has to carry the SAME granting link as the instance it is paired with, or it
  // belongs to nothing on the sheet: base-actor-sheet resolves a granted item's level badge
  // through parentId + collectionId, and deleteAttachmentsForItem finds what to remove the
  // same way. Without them the second Expertise showed no level, sorted to the bottom of the
  // Perks list with the ungranted ones, and survived a level reduction that removed its twin.
  //
  // parentPerk is only set when another PERK granted this one. When a ROLE did - which is the
  // usual case, Commando granting Expertise at 1st and again at 7th (GI Joe CRB p.72) - it is
  // null, and the link is instead the parentId flag grantItemEntry already wrote onto `perk`.
  // Reading it back off `perk` covers both, and is safe by this point: the picker this runs
  // from is non-blocking, so grantItemEntry finished stamping its flags long before the
  // player confirmed a skill.
  const parentId = parentPerk?._id ?? perk.getFlag('essence20', 'parentId');
  const collectionId = perk.getFlag('essence20', 'collectionId');
  if (parentId) {
    await secondPerk.setFlag('essence20', 'parentId', parentId);
  }

  if (collectionId) {
    await secondPerk.setFlag('essence20', 'collectionId', collectionId);
  }

  await onPerkDrop(actor, secondPerk, null, skills[1], 'skills', parentPerk);
}

export async function grantDutyOfTheSilverArmorTraining(actor) {
  await actor.update({
    [actor.system.trained.armors.heavy ? "system.trained.armors.ultraHeavy" : "system.trained.armors.heavy"]: true,
  });
}

/**
 * Grants a permanent copy of the given weapon Item, unless the actor already has one - the
 * shared logic behind Beatdown/Jackhammer's "always considered armed with an integrated X, even
 * if unarmed or your hands are full" grants.
 * @param {Actor} actor
 * @param {String} weaponId   A full compendium UUID for a weapon-type Item.
 */
async function grantIntegratedWeapon(actor, weaponId) {
  const alreadyHasWeapon = actor.items.some(item =>
    item.type == 'weapon'
    && (item.flags?.core?.sourceId == weaponId || item._stats?.compendiumSource == weaponId));
  if (alreadyHasWeapon) {
    return;
  }

  const weapon = await fromUuid(weaponId);
  await Item.create(weapon, { parent: actor });
}

/**
 * Beatdown - see BEATDOWN_ID's own comment above. Grants a permanent copy of Close Combat Heavy
 * Bludgeoning, the same base GI Joe CRB weapon Signature Weapon can also grant - a no-op if the
 * actor somehow already has one (e.g. from Signature Weapon, or re-triggering this same grant).
 * @param {Actor} actor
 */
export async function grantBeatdownWeapon(actor) {
  await grantIntegratedWeapon(actor, CLOSE_COMBAT_HEAVY_BLUDGEONING_ID);
}

/**
 * Jackhammer - see JACKHAMMER_ID's own comment above.
 * @param {Actor} actor
 */
export async function grantJackhammerWeapon(actor) {
  await grantIntegratedWeapon(actor, POWER_TOOL_ID);
}

/**
 * Grants a permanent copy of the given Perk Item, unless the actor already has one - the shared
 * logic behind Change Its Stripes/Combat Lifesaver/Life Finds A Way's own "gain the X General
 * Perk" grants (see CHANGE_ITS_STRIPES_ID's own comment above).
 * @param {Actor} actor
 * @param {String} perkId   A full compendium UUID for a perk-type Item.
 */
async function grantPerkOutright(actor, perkId) {
  const alreadyHasPerk = actor.items.some(item =>
    item.type == 'perk'
    && (item.flags?.core?.sourceId == perkId || item._stats?.compendiumSource == perkId));
  if (alreadyHasPerk) {
    return;
  }

  const perk = await fromUuid(perkId);
  await Item.create(perk, { parent: actor });
}

/**
 * Change Its Stripes - see CHANGE_ITS_STRIPES_ID's own comment above.
 * @param {Actor} actor
 */
export async function grantBlendIn(actor) {
  await grantPerkOutright(actor, BLEND_IN_ID);
  await grantBlendInUpgrades(actor);
}

/**
 * Combat Lifesaver - see CHANGE_ITS_STRIPES_ID's own comment above.
 * @param {Actor} actor
 */
export async function grantEmtCrashCourse(actor) {
  await grantPerkOutright(actor, EMT_CRASH_COURSE_ID);
}

/**
 * Life Finds A Way - see CHANGE_ITS_STRIPES_ID's own comment above.
 * @param {Actor} actor
 */
export async function grantDodgy(actor) {
  await grantPerkOutright(actor, DODGY_ID);
}

/**
 * For The Syndicate - see FOR_THE_SYNDICATE_ID's own comment above.
 * @param {Actor} actor
 */
export async function grantForTheSyndicateMentor(actor) {
  await grantPerkOutright(actor, MENTOR_ID);
}

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

  // Commando's own Expertise (see EXPERTISE_GIJ_ID's own comment above and
  // getAlreadyChosenExpertiseSkills's own doc comment): the 'skills' choice-BUILDING case already
  // excludes an already-chosen skill from the dropdown, but that filter is computed when each
  // dialog is first OPENED - and every Choices Selector dialog in this codebase is non-blocking
  // (render(true) only waits for it to paint, not for the player's pick, per
  // promptRolePerkChoice's own doc comment in attachment-handler.mjs), so when two Expertise
  // instances are granted at the same level (Commando grants 2 at 1st, 2 more at 7th), BOTH
  // dialogs open before either is answered - each one's own dropdown was built seeing zero
  // choices made yet, so neither excludes the skill the other is about to pick. Re-checking HERE,
  // at actual confirm time (when the user has just clicked one specific option in one specific
  // dialog) and before ANY of this function's own side effects run (the shiftUp bonus applied
  // just below included), catches it correctly: by the time a second dialog is confirmed, the
  // first one's own choice has already been persisted.
  if (selectionType == 'skills' && getAlreadyChosenExpertiseSkills(actor, perk).includes(selection)) {
    ui.notifications.warn(game.i18n.localize('E20.ExpertiseDuplicateSkillError'));
    // This specific Perk instance was already created (see grantItemEntry's own Item.create,
    // called before setPerkValues ever opens the picker) - left as-is, it would sit on the sheet
    // forever as a dead, unnamed "Expertise" with no skill and no bonus. Re-opening the SAME
    // picker on it (rather than deleting it, which used to leave the actor without a grant
    // they're automatically owed at this level, with no way to get it back short of manually
    // re-dragging a replacement) lets the player just pick again, now correctly excluding
    // whichever skill the race's other side already locked in.
    return setPerkValues(actor, perk, parentPerk, dropFunc);
  }

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

    // Dual-check: a copy granted through a Role's own items map gets flags.core.sourceId
    // stamped instead of _stats.compendiumSource (see attachment-handler.mjs#grantItemEntry) -
    // counting only the latter would undercount timesTaken for a Perk obtainable both ways.
    const ownerItem = actor.items.get(actorItem._id);
    const itemSourceId = ownerItem.flags.core?.sourceId ?? ownerItem._stats.compendiumSource;
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
    // Commando's own Expertise (see EXPERTISE_GIJ_ID's own comment above and
    // getAlreadyChosenExpertiseSkills's own doc comment): the 'skills' choice-BUILDING case
    // already excludes an already-chosen skill from the dropdown, but that filter is computed
    // when each dialog is first OPENED - and every Choices Selector dialog in this codebase is
    // non-blocking (render(true) only waits for it to paint, not for the player's pick, per
    // promptRolePerkChoice's own doc comment in attachment-handler.mjs), so when two Expertise
    // instances are granted at the same level (Commando grants 2 at 1st, 2 more at 7th), BOTH
    // dialogs open before either is answered - each one's own dropdown was built seeing zero
    // choices made yet, so neither excludes the skill the other is about to pick. Re-checking
    // HERE, at actual confirm time (when the user has just clicked one specific option in one
    // specific dialog), catches it correctly: by the time a second dialog is confirmed, the
    // first one's own choice has already been persisted via the update() below.
    if (selectionType == 'skills') {
      const perkSourceId = newPerk.flags?.core?.sourceId ?? newPerk._stats?.compendiumSource;
      if (perkSourceId == EXPERTISE_GIJ_ID && getAlreadyChosenExpertiseSkills(actor, newPerk).includes(selection)) {
        ui.notifications.error(game.i18n.localize('E20.ExpertiseDuplicateSkillError'));
        return;
      }
    }

    const localizedSelection = selectionType == 'movement'
      ? game.i18n.localize(E20.movementTypes[selection])
      // Field's choices are a restricted subset of the same skill list 'skills' already uses
      // (see E20.fieldSkills, helpers/config.mjs), not a distinct label set of their own.
      : selectionType == 'field'
        ? game.i18n.localize(E20.skills[selection])
        : game.i18n.localize(E20[selectionType][selection]);
    const newName = `${newPerk.name} (${localizedSelection})`;
    const updateData = {
      "name": newName,
      "system.choice": selection,
    };

    // Unlike environments/senses/movement (which write to a shared actor-level field), a
    // skill-scoped reroll grant's scope lives on the granted Perk instance itself - see
    // helpers/reroll.mjs#canMeetRerollScope, which reads system.reroll.skills off each Perk.
    if (selectionType == 'skills') {
      updateData["system.reroll.skills"] = [selection];
    }

    newPerk.update(updateData);
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
  } else if (perkUuid == DUTY_OF_THE_SILVER_ID) {
    await grantDutyOfTheSilverArmorTraining(actor);
  } else if (perkUuid == BEATDOWN_ID) {
    await grantBeatdownWeapon(actor);
  } else if (perkUuid == JACKHAMMER_ID) {
    await grantJackhammerWeapon(actor);
  } else if (perkUuid == CHANGE_ITS_STRIPES_ID) {
    await grantBlendIn(actor);
  } else if (perkUuid == BLEND_IN_ID) {
    await grantBlendInUpgrades(actor);
  } else if (perkUuid == COMBAT_LIFESAVER_ID) {
    await grantEmtCrashCourse(actor);
  } else if (perkUuid == LIFE_FINDS_A_WAY_ID) {
    await grantDodgy(actor);
  } else if (perkUuid == FOR_THE_SYNDICATE_ID) {
    await grantForTheSyndicateMentor(actor);
  } else if (perkUuid == SPEAK_YOUR_TRUTH_ID) {
    await grantSpeakYourTruthEssence(perk);
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

    case 'vehicleType':
      // Petrolhead (Quartermaster's Guide to Gear, Racer Origin Benefit, p.20): "choose one type
      // of vehicle (land, sea, or air)." Unlike the 'movement' case just above (which only offers
      // a movement type the ACTOR already possesses), this picks a VEHICLE category unconditionally
      // - every actor can pick any of the 3, regardless of their own movement. Reuses
      // E20.movementTypes' own aerial/ground/swim keys (skipping 'climb', which isn't a vehicle
      // category RAW offers here) rather than a new dedicated config table, matching this same
      // land/sea/air vocabulary Skyward/Seafarer/Vehicle Qualification already use elsewhere.
      prompt = game.i18n.localize("E20.SelectVehicleType");
      for (const movement of ['aerial', 'ground', 'swim']) {
        const localizedLabel = game.i18n.localize(E20.movementTypes[movement]);
        choices[movement] = {
          chosen: false,
          value: movement,
          label: localizedLabel,
          type: perk.system.choiceType,
        };
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
          // Dual-check: a candidate also obtainable through a Role's own items map gets
          // flags.core.sourceId stamped instead of _stats.compendiumSource (see attachment-
          // handler.mjs#grantItemEntry) - checking only the latter would let a player re-pick
          // an already-Role-granted candidate from this choice list.
          const attachedItemSourceId = attachedItem.flags.core?.sourceId ?? attachedItem._stats.compendiumSource;
          if (item.uuid == attachedItemSourceId) {
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

    case 'skills': {
      // e.g. Expertise (GI Joe CRB p.72). Every skill is offered every time this Perk is granted
      // (unlike senses/movement above, a skill already boosted by an earlier grant of the SAME
      // Perk - or by anything else - has no single reliable "already chosen" marker to filter on
      // for every 'skills'-choiceType Perk in general), so the player is trusted to pick a
      // different skill each time, same as they already are for which skill to specialize in
      // elsewhere in this system - EXCEPT Commando's own Expertise, where the user asked
      // specifically to block re-picking a skill already chosen by one of its own earlier grants
      // (see getAlreadyChosenExpertiseSkills's own comment above).
      prompt = game.i18n.localize("E20.SelectSkill");
      const alreadyChosenSkills = getAlreadyChosenExpertiseSkills(actor, perk);

      for (const skill of Object.keys(CONFIG.E20.skills)) {
        if (alreadyChosenSkills.includes(skill)) {
          continue;
        }

        const localizedLabel = game.i18n.localize(E20.skills[skill]);
        choices[skill] = {
          chosen: false,
          value: skill,
          label: localizedLabel,
          type: perk.system.choiceType,
        };
      }

      break;
    }

    case 'essence':
      // Adaptable (MLP CRB, Earth Pony Origin Perk, p.33): "Pick one of your Essence Scores...
      // once per scene, when using a Skill from that Essence, [treat it as Specialized]." Same
      // shape as the 'skills' case above, just over the 4 real Essences instead - "any" is
      // excluded, it isn't a real Essence a Skill actually belongs to.
      prompt = game.i18n.localize("E20.SelectEssence");
      for (const essence of Object.keys(CONFIG.E20.essences)) {
        if (essence == 'any') {
          continue;
        }

        const localizedLabel = game.i18n.localize(E20.essences[essence]);
        choices[essence] = {
          chosen: false,
          value: essence,
          label: localizedLabel,
          type: perk.system.choiceType,
        };
      }

      break;

    case 'airBornMovement':
      // Air Born (MLP Pegasus Origin Perk, p.37) - see dice.mjs's own AIR_BORN_ID comment. Same
      // "no numeric field of its own, read directly off system.choice" shape as fightingStyle
      // just below - the actual ground/aerial numbers are read in documents/actor.mjs's own
      // _prepareMovement.
      prompt = game.i18n.localize("E20.SelectMovement");
      for (const option of Object.keys(CONFIG.E20.airBornMovement)) {
        const localizedLabel = game.i18n.localize(E20.airBornMovement[option]);
        choices[option] = {
          chosen: false,
          value: option,
          label: localizedLabel,
          type: perk.system.choiceType,
        };
      }

      break;

    case 'alwaysReadyFunction':
      // General Hawk's Personnel Files, Coast Guard Origin Perk, p.172 - see
      // dice.mjs's own ALWAYS_READY_FUNCTION_SKILLS comment for how the chosen function maps to
      // its own pair of skills. Same "no numeric field of its own, read directly off
      // system.choice" shape as powerAdaptation/wisdomOfTheElders below.
      prompt = game.i18n.localize("E20.SelectAlwaysReadyFunction");
      for (const option of Object.keys(E20.alwaysReadyOptions)) {
        const localizedLabel = game.i18n.localize(E20.alwaysReadyOptions[option]);
        choices[option] = {
          chosen: false,
          value: option,
          label: localizedLabel,
          type: perk.system.choiceType,
        };
      }

      break;

    case 'powerAdaptation':
      // Across the Stars, Silver Ranger, 9th/18th level, p.57 - see
      // helpers/power-adaptation.mjs's own doc comment. Same "no numeric field of its own, read
      // directly off system.choice" shape as fightingStyle just below - the actor's own "Use"
      // button (banked-buffs.mjs) reads this Perk's system.choice to know which option to
      // activate/deactivate, rather than any consumption branch happening here at drop time.
      prompt = game.i18n.localize("E20.SelectPowerAdaptation");
      for (const option of Object.keys(E20.powerAdaptationOptions)) {
        const localizedLabel = game.i18n.localize(E20.powerAdaptationOptions[option]);
        choices[option] = {
          chosen: false,
          value: option,
          label: localizedLabel,
          type: perk.system.choiceType,
        };
      }

      break;

    case 'electromagneticDisruption':
      // Technorganic Secrets, Technorganic Influence Perks, p.47 - see
      // helpers/electromagnetic-disruption.mjs's own doc comment. Same "no numeric field of its
      // own, read directly off system.choice" shape as viciousOrVenom below.
      prompt = game.i18n.localize("E20.SelectElectromagneticDisruption");
      for (const option of Object.keys(E20.electromagneticDisruptionOptions)) {
        const localizedLabel = game.i18n.localize(E20.electromagneticDisruptionOptions[option]);
        choices[option] = {
          chosen: false,
          value: option,
          label: localizedLabel,
          type: perk.system.choiceType,
        };
      }

      break;

    case 'defensiveFlexibility':
      // A Jump Through Time, Blue Spectrum Modification, replaces Grid Tech, p.45 - see
      // helpers/defensive-flexibility.mjs's own doc comment. Same "no numeric field of its own,
      // read directly off system.choice" shape as powerAdaptation above - a single flat option
      // list combining both of RAW's own choice categories.
      prompt = game.i18n.localize("E20.SelectDefensiveFlexibility");
      for (const option of Object.keys(E20.defensiveFlexibilityOptions)) {
        const localizedLabel = game.i18n.localize(E20.defensiveFlexibilityOptions[option]);
        choices[option] = {
          chosen: false,
          value: option,
          label: localizedLabel,
          type: perk.system.choiceType,
        };
      }

      break;

    case 'viciousOrVenom':
      // Vicious or Venom (Technorganic Secrets, Saurian Origin Benefit, p.43) - see
      // E20.viciousOrVenomOptions' own comment. Same "no numeric field of its own, read directly
      // off system.choice" shape as elementDamageType just below - dice.mjs's own damage-bonus
      // computation reads this instance's own choice directly at roll time.
      prompt = game.i18n.localize("E20.SelectViciousOrVenom");
      for (const option of Object.keys(E20.viciousOrVenomOptions)) {
        const localizedLabel = game.i18n.localize(E20.viciousOrVenomOptions[option]);
        choices[option] = {
          chosen: false,
          value: option,
          label: localizedLabel,
          type: perk.system.choiceType,
        };
      }

      break;

    case 'overTheCandlestick':
      // Over the Candlestick (Technorganic Secrets, Climber/Nimble Origin Benefit, p.38) - see
      // E20.overTheCandlestickOptions' own comment. Same "no numeric field of its own, read
      // directly off system.choice" shape as viciousOrVenom above.
      prompt = game.i18n.localize("E20.SelectOverTheCandlestick");
      for (const option of Object.keys(E20.overTheCandlestickOptions)) {
        const localizedLabel = game.i18n.localize(E20.overTheCandlestickOptions[option]);
        choices[option] = {
          chosen: false,
          value: option,
          label: localizedLabel,
          type: perk.system.choiceType,
        };
      }

      break;

    case 'sparedNoExpenseSkill':
      // Ferocious Fighters, Dino-Hunters Faction Perk, p.73 - see E20.sparedNoExpenseSkills' own
      // doc comment. Same "no numeric field of its own, read directly off system.choice" shape as
      // elementDamageType/powerAdaptation above - dice.mjs reads this Perk's own choice directly.
      prompt = game.i18n.localize("E20.SelectSparedNoExpenseSkill");
      for (const skill of Object.keys(E20.sparedNoExpenseSkills)) {
        const localizedLabel = game.i18n.localize(E20.sparedNoExpenseSkills[skill]);
        choices[skill] = {
          chosen: false,
          value: skill,
          label: localizedLabel,
          type: perk.system.choiceType,
        };
      }

      break;

    case 'communityHelperSkill':
      // PR CRB, Influence Perk, p.68 - see E20.communityHelperSkills' own doc comment. Same
      // "no numeric field of its own, read directly off system.choice" shape as
      // sparedNoExpenseSkill/roamingTheLand above.
      prompt = game.i18n.localize("E20.SelectCommunityHelperSkill");
      for (const skill of Object.keys(E20.communityHelperSkills)) {
        const localizedLabel = game.i18n.localize(E20.communityHelperSkills[skill]);
        choices[skill] = {
          chosen: false,
          value: skill,
          label: localizedLabel,
          type: perk.system.choiceType,
        };
      }

      break;

    case 'roamingTheLand':
      // Ferocious Fighters, Mega Monsters Faction Perk, p.75 - see E20.roamingTheLandOptions' own
      // doc comment. Same "no numeric field of its own, read directly off system.choice" shape as
      // sparedNoExpenseSkill/elementDamageType above.
      prompt = game.i18n.localize("E20.SelectRoamingTheLand");
      for (const option of Object.keys(E20.roamingTheLandOptions)) {
        const localizedLabel = game.i18n.localize(E20.roamingTheLandOptions[option]);
        choices[option] = {
          chosen: false,
          value: option,
          label: localizedLabel,
          type: perk.system.choiceType,
        };
      }

      break;

    case 'twoHandedAssault':
      // Factions in Action Vol. 2, Silent Weapons Expert Focus, 3rd level, p.12 - see
      // E20.twoHandedAssaultOptions' own doc comment. Same "no numeric field of its own, read
      // directly off system.choice" shape as roamingTheLand/sparedNoExpenseSkill above.
      prompt = game.i18n.localize("E20.SelectTwoHandedAssault");
      for (const option of Object.keys(E20.twoHandedAssaultOptions)) {
        const localizedLabel = game.i18n.localize(E20.twoHandedAssaultOptions[option]);
        choices[option] = {
          chosen: false,
          value: option,
          label: localizedLabel,
          type: perk.system.choiceType,
        };
      }

      break;

    case 'elementDamageType':
      // A Jump Through Time, Orange Ranger, Modified Shell III option, p.33 ("Adapted
      // Wavelength") - see helpers/combat.mjs#ENERGY_DAMAGE_TYPES's own doc comment for why this
      // is scoped to the 7 concrete Element sub-types rather than every damage type. Same "no
      // numeric field of its own, read directly off system.choice" shape as powerAdaptation/
      // phantomFocus above - applyDamage() reads every matching instance's own choice directly,
      // rather than anything happening here at drop time.
      prompt = game.i18n.localize("E20.SelectElementDamageType");
      for (const damageType of Object.keys(E20.elementDamageTypes)) {
        const localizedLabel = game.i18n.localize(E20.elementDamageTypes[damageType]);
        choices[damageType] = {
          chosen: false,
          value: damageType,
          label: localizedLabel,
          type: perk.system.choiceType,
        };
      }

      break;

    case 'wisdomOfTheElders':
      // Through the Shattered Grid, Guardian of Eltar, 9th/18th level, p.72 - see
      // helpers/wisdom-of-the-elders.mjs's own doc comment. Same "no numeric field of its own,
      // read directly off system.choice" shape as powerAdaptation/phantomFocus above.
      prompt = game.i18n.localize("E20.SelectWisdomOfTheElders");
      for (const option of Object.keys(E20.wisdomOfTheEldersOptions)) {
        const localizedLabel = game.i18n.localize(E20.wisdomOfTheEldersOptions[option]);
        choices[option] = {
          chosen: false,
          value: option,
          label: localizedLabel,
          type: perk.system.choiceType,
        };
      }

      break;

    case 'phantomFocus':
      // Across the Stars, Phantom Ranger, 10th/15th level, p.62 - see
      // helpers/banked-buffs.mjs's own PHANTOM_FOCUS_ID comment. Same "no numeric field of its
      // own, read directly off system.choice" shape as powerAdaptation/fightingStyle.
      prompt = game.i18n.localize("E20.SelectPhantomFocus");
      for (const option of Object.keys(E20.phantomFocusOptions)) {
        const localizedLabel = game.i18n.localize(E20.phantomFocusOptions[option]);
        choices[option] = {
          chosen: false,
          value: option,
          label: localizedLabel,
          type: perk.system.choiceType,
        };
      }

      break;

    case 'experiment':
      // Transformers CRB, Influence Perk, p.32 - see E20.experimentOptions' own doc comment. Same
      // "no numeric field of its own, read directly off system.choice" shape as powerAdaptation/
      // fightingStyle above - shove/technology are read directly by dice.mjs, no consumption
      // branch needed here beyond the generic system.choice write every case in this switch gets.
      prompt = game.i18n.localize("E20.SelectExperiment");
      for (const option of Object.keys(E20.experimentOptions)) {
        const localizedLabel = game.i18n.localize(E20.experimentOptions[option]);
        choices[option] = {
          chosen: false,
          value: option,
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

    // Expertise (GI Joe CRB, Commando base, 1st/7th level, p.72) - see EXPERTISE_GIJ_ID's own
    // comment above. "Choose two skills" is now numChoices:2 on the compendium item itself (a
    // single MultiChoiceSelector asking for both at once), fixing the root cause of the
    // duplicate-skill race the guard above works around: 2 separate single-skill grants at the
    // SAME level used to open 2 concurrent dialogs, neither of which could see the other's
    // not-yet-confirmed pick. One dialog for both skills has no such race.
    if (perk.system.numChoices > 1 && ["perks", "skills"].includes(perk.system.choiceType)) {
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

  if (isPrincessPerk(perk)) {
    await removeSpellcastingUpshift(actor);
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
