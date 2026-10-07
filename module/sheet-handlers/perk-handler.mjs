import ChoicesSelector from "../apps/choices-selector.mjs";
import MultiChoiceSelector from "../apps/multi-choice-selector.mjs";
import { E20 } from "../util/config.mjs";
import { ruleChoiceCountBonus } from "../rules/plugins/picks/choice-count.mjs";
import { hasAnyGeneralPerkChoice, hasUniqueChoice } from "../rules/plugins/picks/unique-choice.mjs";
import { createItemCopies, deleteAttachmentsForItem, setEntryAndAddItem } from "./attachment-handler.mjs";
import { getVisibleItemPacks } from "../util/compendium-browser.mjs";
import { performSpectrumShift } from "./role-handler.mjs";
import { isPrincessPerk, removeSpellcastingUpshift } from "../items/magic/princess-perks.mjs";
import { HEARTS_CALLING_ID, pickHeartsCallingOption } from "../items/resources/emotional-mastery.mjs";
import { chosenList, legacyChoiceOf } from "../rules/choice-read.mjs";

// (Sorcery's levelTaken - set when it's added, cleared when it goes - and its Cost of Sorcery Grant are rules on the Perk:
// rules/conv17-split2.test.js.)
const ZORD_PERK_ID = "Compendium.essence20.pr_crb.Item.rCpCrfzMYPupoYNI";
const SPECTRUM_SHIFT_PERK_ID = "Compendium.essence20.pr_crb.Item.HxbEBJ3gXkTQqvxt";

// Quantasaurus Rex (A Jump Through Time, Quantum Ranger Role Perk, 4th level, p.46): the Quantum
// Controller gives command of the Zord, and piloting it means no Snags on Animal Handling or
// Driving. Same canHaveZord grant
// as ZORD_PERK_ID just above (this is textually the Quantum Ranger's own Zord Role Perk, not a
// separate Zord Feature - it grants Zord access outright, no Additional Attack Type/Upgraded Zord
// picker involved). The Snag-immunity half is the Perk's own rule.
const QUANTASAURUS_REX_ID = "Compendium.essence20.jump_through_time.Item.sn5jhTf8sJqRFhKS";

// Phantom Ship (Across the Stars, Phantom Ranger Role Perk, 1st level, p.62) - the Snag-immunity
// half is the Perk's own rule. This half is the same canHaveZord grant ZORD_PERK_ID/QUANTASAURUS_REX_ID just above already establish.
const PHANTOM_SHIP_ID = "Compendium.essence20.across_the_stars.Item.OfsTu9GpONWPV88t";

// Torozord (Through the Shattered Grid, Magna Defender Role Perk, 3rd level, p.24): "you become
// able to summon it to aid you in battle" - the Magna Defender's own equivalent of ZORD_PERK_ID's
// grant just above, never actually wired despite the compendium item existing bare since this
// book was first built.
const TOROZORD_ID = "Compendium.essence20.through_the_shattered_grid.Item.gx0xOFKcKOPyaUto";
// (Torozord Feature's Zord Feature pick is its pack item's own added rule - pickGrant notOwned to: ownZord.)

// (Duty of the Silver's Heavy / Ultra-Heavy Armor training is an added Trigger rule on the Perk - rules/conv17-split3.test.js.)

// (Grid Tap's extra Grid Science / Grid Tech pick is a ChoiceCount rule on it - rules/plugins/picks/choice-count.mjs.)

// (Change Its Stripes grants Blend In with a Grant rule; Blend In's and Silent Running's free upgrades - and Combiner
// Specialization's pick - are 'added' Trigger rules on those Perks: rules/conv14-systems.test.js.)

// Expertise (GI Joe CRB, Commando base, 1st/7th level, p.72): "Choose two skills... You choose
// two more skills at 7th level" - granted 4 separate times across Commando's own progression
// table (system.selectionLimit: 4), each instance its own independent skill pick. Its UniqueChoice
// rule (rules/plugins/picks/unique-choice.mjs) blocks picking the SAME skill across two of those
// instances - see the 'skills' choice case below.

// (Metamorphosis swaps Colony Changeling for Metamorphosed Changeling with its own added Trigger rule - deleteItem
// keepGrants + grantPerk runPicker.)

// (The Heavy / Medium / Ultra-Heavy Armor Shells re-work the Morphed Toughness bonus from their own added / removed
// rules - refreshMorphedToughness.)

// Nobody Like Me (PR CRB, Oddball Origin Benefit, p.25): "choose any General Perk you meet the
// prerequisites for". Its compendium item once listed the Power Rangers CRB's 42 by hand; the
// choice is built from every enabled book instead - see anyGeneralPerkChoices(). Its
// AnyGeneralPerkChoice rule (rules/plugins/picks/unique-choice.mjs) says so.

// (Basal / Intricate / Profound Nano Infusion's nanomite power picks are their pack items' own added rules - pickGrant
// from nanomite Powers of that Availability, notOwned + selectionLimit: rules/conv15-systems.test.js.)

/**
 * Whether this Perk offers any General Perk rather than a fixed list - its AnyGeneralPerkChoice rule, read from the
 * Perk itself (the compendium item or a copy already on an actor).
 * @param {Item} perk
 * @param {String} [_perkUuid]
 * @returns {Boolean}
 */
export function grantsAnyGeneralPerk(perk, _perkUuid = null) {
  return hasAnyGeneralPerkChoice(perk);
}

/**
 * The game line (its compendium folder, e.g. "Power Rangers") a compendium uuid belongs to.
 * @param {String} uuid
 * @returns {?String}
 */
export function gameLineOf(uuid) {
  const packId = String(uuid ?? '').match(/^Compendium\.([^.]+\.[^.]+)\.Item\./)?.[1];
  return (packId && game.packs.get(packId)?.folder?.name) ?? null;
}

/**
 * Every General Perk in every enabled book, as choices keyed by uuid. The same books the
 * Compendium Browser shows - a GM who has switched a line off does not want its Perks offered.
 * Grouped by game line with the book alongside, since the same name is printed in more than one
 * book. Prerequisites are printed prose, so they are left to the player, as the book asks.
 * @param {Actor} actor
 * @returns {Promise<Object>}
 */
export async function anyGeneralPerkChoices(actor) {
  const taken = new Set(actor.items.map(item => item.flags?.core?.sourceId ?? item._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource));
  const choices = {};

  for (const pack of getVisibleItemPacks()) {
    const index = await pack.getIndex({ fields: ["system.type", "system.source.book"] });
    for (const entry of index) {
      if (entry.type != 'perk' || entry.system?.type != 'general') continue;

      const uuid = `Compendium.${pack.metadata.id}.Item.${entry._id}`;
      if (taken.has(uuid)) continue;

      choices[uuid] = {
        chosen: false,
        value: uuid,
        label: entry.name,
        uuid,
        type: 'perks',
        group: pack.folder?.name ?? pack.metadata.label,
        detail: entry.system?.source?.book || pack.metadata.label,
      };
    }
  }

  return choices;
}

/**
 * A UniqueChoice Perk (Expertise - see its comment above) - the skills already chosen by another
 * instance of this same Perk already on the actor, so the 'skills' choice-building case below can
 * exclude them from the picker. Pulled into its own small, directly-testable function (unlike the
 * inline "already taken" filter the 'perks' case above uses in place) since setPerkValues as a
 * whole isn't practically unit-testable end-to-end (it always falls through to onPerkDrop's
 * drag-and-drop-coupled tail). A no-op array for any Perk without a UniqueChoice rule - this only narrows
 * those (Commando's own Expertise), not every 'skills'-choiceType Perk in this system.
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
  const perkSourceId = perk.flags?.core?.sourceId ?? perk._stats?.compendiumSource ?? perk?.flags?.essence20?.rulesSource ?? perk.uuid;
  if (!perkSourceId || !hasUniqueChoice(perk)) {
    return [];
  }

  return actor.items
    .filter(item => (item.flags.core?.sourceId ?? item._stats.compendiumSource ?? item?.flags?.essence20?.rulesSource) == perkSourceId)
    // Each copy's pick (rules/choice-read.mjs); a list pick contributes every Skill in it.
    .flatMap(item => chosenList(item))
    .filter(Boolean);
}

/**
 * Handles a choiceType:'skills' Perk being granted via a single MultiChoiceSelector asking for
 * every skill at once (perk.system.numChoices > 1) - see Expertise's own comment above for
 * why this replaced the earlier "2 separate single-skill grants at the same level" shape.
 *
 * GENERALIZED 2026-09-15 from hardcoded-exactly-2 to any count: I've Done My Research (Beneath
 * the Helmet, Genius Origin Benefit, p.29) picks THREE skills, and the old skills[0]/skills[1]
 * indexing would have silently discarded the third with no error anywhere.
 *
 * Rather than reshape Expertise's own data model (a single item covering 2 skills at once, which
 * would also mean widening getAlreadyChosenExpertiseSkills to look inside a comma/array-shaped
 * system.choice instead of a single value), this keeps the exact same "one Expertise item, one
 * skill" shape every other piece of this Perk's own code already assumes: `perk` (the instance
 * grantItemEntry already created) is configured with the first skill via the ordinary single-
 * skill onPerkDrop path, and a second Expertise Item is created and configured with the second
 * skill the same way. The end state - one "Expertise (Skill)" item per chosen skill - is identical
 * to what the old separate-grants flow produced, just without ever having 2 dialogs open at once.
 * @param {Actor} actor
 * @param {Item} perk        The already-created Perk instance the MultiChoiceSelector was
 *                            configuring (see grantItemEntry's own Item.create, called before
 *                            setPerkValues ever opens the picker).
 * @param {Array<String>} skills   The chosen skill keys, one per numChoices.
 * @param {Function} dropFunc
 * @param {Item} parentPerk
 */
export async function onMultiSkillPerkDrop(actor, perk, skills, dropFunc=null, parentPerk=null) {
  const alreadyChosen = getAlreadyChosenExpertiseSkills(actor, perk);
  const hasDuplicate = new Set(skills).size != skills.length;
  if (hasDuplicate || skills.some(skill => alreadyChosen.includes(skill))) {
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

  // Every skill past the first gets its own freshly-created copy of the same source Perk, so each
  // ends up as an ordinary one-item-one-skill instance (see this function's own doc comment).
  const perkSourceId = perk.flags?.core?.sourceId ?? perk._stats?.compendiumSource ?? perk?.flags?.essence20?.rulesSource ?? perk.uuid;
  const perkSource = await fromUuid(perkSourceId);

  // Each extra copy has to carry the SAME granting link as the instance it is paired with, or it
  // belongs to nothing on the sheet: base-actor-sheet resolves a granted item's level badge
  // through parentId + collectionId, and deleteAttachmentsForItem finds what to remove the
  // same way. Without them the extra Expertise showed no level, sorted to the bottom of the
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

  for (const skill of skills.slice(1)) {
    const extraPerk = await Item.create(perkSource, { parent: actor });
    await extraPerk.setFlag('core', 'sourceId', perkSourceId);
    if (parentId) {
      await extraPerk.setFlag('essence20', 'parentId', parentId);
    }

    if (collectionId) {
      await extraPerk.setFlag('essence20', 'collectionId', collectionId);
    }

    await onPerkDrop(actor, extraPerk, null, skill, 'skills', parentPerk);
  }
}

/**
 * Grants a permanent copy of the given Item, unless the actor already has one of the same type
 * sourced from the same compendium id - the shared logic behind Beatdown/Jackhammer's "always
 * considered armed with an integrated X" weapon grants, and grantPerkEquipmentMap's own entries.
 * @param {Actor} actor
 * @param {String} itemType   The granted Item's own `type` (e.g. "weapon", "armor").
 * @param {String} itemId     A full compendium UUID for an Item of that type.
 */
async function grantIntegratedItem(actor, itemType, itemId) {
  const alreadyHasItem = actor.items.some(item =>
    item.type == itemType
    && (item.flags?.core?.sourceId == itemId || item._stats?.compendiumSource == itemId || item?.flags?.essence20?.rulesSource == itemId));
  if (alreadyHasItem) {
    return;
  }

  const newItem = await fromUuid(itemId);
  const created = await Item.create(newItem, { parent: actor });

  // A weapon's own weaponEffects (and an armor/weapon's upgrades) live as SEPARATE Items on the
  // actor, linked back through the parent's system.items map - Item.create alone copies the
  // parent and nothing else, so before this an integrated weapon granted here arrived with no
  // attack to roll at all. Found 2026-09-15 while granting Screech (Story of the Seasons, p.131);
  // it was never specific to that Perk, and silently affected every weapon this function has ever
  // handed out - Beatdown, Jackhammer, and the whole grantPerkEquipmentMap cluster (Fire Breath,
  // Hammer, Fangs, Dagger, Grappling Hook, Recording Microphone). Same two calls, in the same
  // order, that onEquipmentPackageDrop already makes for an identical grant-by-uuid.
  if (['armor', 'weapon'].includes(created.type)) {
    await createItemCopies(created.system.items, actor, 'upgrade', created);
  }

  if (['shield', 'weapon'].includes(created.type)) {
    await createItemCopies(created.system.items, actor, 'weaponEffect', created);
  }
}

/**
 * Grants a permanent copy of the given weapon Item, unless the actor already has one - the
 * shared logic behind Beatdown/Jackhammer's always-armed-with-an-integrated-weapon grants (even
 * empty-handed or with full hands).
 * @param {Actor} actor
 * @param {String} weaponId   A full compendium UUID for a weapon-type Item.
 */
export async function grantIntegratedWeapon(actor, weaponId) {
  await grantIntegratedItem(actor, 'weapon', weaponId);
}

/**
 * Grants the equipment a Perk's own compendium `system.items` map already declares.
 *
 * Added 2026-09-15 after Hammer Space turned out to have its grant fully authored in data and
 * completely unreachable in code - its authored Hammer grant simply never happened. A sweep for that shape
 * found it was not one item but a whole cluster: 9 Welcome to Night Vale Perks carry an
 * unconditional grant map of weapon/gear entries, and 6 of them have no code reference anywhere.
 * These are all the same RAW idiom - "you have access to the writing utensil contraband", "you
 * also gain access to the Fire Breath weapon" - where the map IS the mechanic.
 *
 * Deliberately generic rather than nine more hardcoded constants: the map already names exactly
 * what to grant and with which type, so reading it is both less code and more faithful than
 * restating it. Any future Perk authored this way now works with no code change at all.
 *
 * Weapon/gear/power/armor entries are always granted (through grantIntegratedItem, which also
 * brings a weapon's or armor's own attachments). Perk-type entries are granted too,
 * UNLESS this Perk is itself one of the two idioms that already resolve their own `perk` map some
 * other way, and would double-grant if this function also swept them:
 *   - `system.hasChoice` Perks (e.g. Mutant Beast, Hunter's Prowess): the map IS the picker's
 *     option pool - choices-selector.mjs's own 'perks' selectionType grants exactly the ONE the
 *     player picked, not "every option".
 *   - `system.isRoleVariant` Faction Perks (e.g. Be A Hero, Be Ruthless, Cybertronian Perk): each
 *     entry is role-keyed (`role: "<Role name>"`) and already granted, one at a time, by
 *     role-handler.mjs's own addFactionPerks() when a matching Role is dropped.
 * Every other `perk` map - like TF CRB Keen Sensors, "you also gain the Acute Sense Perk" - is an
 * unconditional grant with no other path resolving it, exactly like a `weapon`/`gear` entry here.
 * @param {Actor} actor
 * @param {Item} perk   The Perk being granted.
 */
export async function grantPerkEquipmentMap(actor, perk) {
  const skipPerkEntries = perk?.system?.hasChoice || perk?.system?.isRoleVariant;
  for (const entry of Object.values(perk?.system?.items ?? {})) {
    if (!entry?.uuid) {
      continue;
    }

    if (['weapon', 'gear', 'power', 'armor'].includes(entry.type)) {
      await grantIntegratedItem(actor, entry.type, entry.uuid);
    } else if (entry.type == 'perk' && !skipPerkEntries) {
      await grantPerkOutright(actor, entry.uuid);
    }
  }
}

/**
 * Grants a permanent copy of the given Perk Item, unless the actor already has one - the perk
 * entries of grantPerkEquipmentMap below. (Fixed "gain the X Perk" grants are Grant rules on the
 * granting item now - Change Its Stripes, Combat Lifesaver, For The Syndicate...)
 * @param {Actor} actor
 * @param {String} perkId   A full compendium UUID for a perk-type Item.
 */
export async function grantPerkOutright(actor, perkId) {
  const alreadyHasPerk = actor.items.some(item =>
    item.type == 'perk'
    && (item.flags?.core?.sourceId == perkId || item._stats?.compendiumSource == perkId || item?.flags?.essence20?.rulesSource == perkId));
  if (alreadyHasPerk) {
    return;
  }

  const perk = await fromUuid(perkId);
  await Item.create(perk, { parent: actor });
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

  // Commando's own Expertise (see its own comment above and
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
    }
    // A movement / skills pick's bonus (Fast's +10 ft, GI Joe Expertise's up 2 - the Perk's old system.value) is the
    // Perk's own rules now, for copies flagged perkValueRule (stamped with the pick below); nothing is written onto
    // the actor here any more. Copies dropped before 2026-10-07 had it written in - migration.mjs#migratePerkValue.
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
    const itemSourceId = ownerItem.flags.core?.sourceId ?? ownerItem._stats.compendiumSource ?? ownerItem?.flags?.essence20?.rulesSource;
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

  if (['environments', 'senses', 'movement', 'altModeMovement', 'skills', 'fightingStyle', 'field'].includes(selectionType)) {
    // Commando's own Expertise (see its own comment above and
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
      const perkSourceId = newPerk.flags?.core?.sourceId ?? newPerk._stats?.compendiumSource ?? newPerk?.flags?.essence20?.rulesSource;
      if (perkSourceId && getAlreadyChosenExpertiseSkills(actor, newPerk).includes(selection)) {
        ui.notifications.error(game.i18n.localize('E20.ExpertiseDuplicateSkillError'));
        return;
      }
    }

    const localizedSelection = selectionType == 'movement' || selectionType == 'altModeMovement'
      ? game.i18n.localize(E20.movementTypes[selection])
      // Field's choices are a restricted subset of the same skill list 'skills' already uses
      // (see E20.fieldSkills, util/config.mjs), not a distinct label set of their own.
      : selectionType == 'field'
        ? game.i18n.localize(E20.skills[selection])
        : game.i18n.localize(E20[selectionType][selection]);
    const newName = `${newPerk.name} (${localizedSelection})`;
    const updateData = {
      "name": newName,
      "system.choice": selection,
    };

    // A skill-scoped Reroll rule with no Skills of its own covers the pick (rules/adapter.mjs#ruleRerollGrants reads
    // system.choice). The movement / skills bonus rules (Fast, GI Joe Expertise) apply to a copy flagged
    // perkValueRule - one whose drop didn't write the bonus onto the actor (see above).
    if (selectionType == 'movement' || selectionType == 'skills') {
      updateData["flags.essence20.perkValueRule"] = true;
    }

    newPerk.update(updateData);

    // All-Terrain Alt Mode - see the 'altModeMovement' choice-list case above. Enables the ONE
    // bundled disabled Active Effect matching the chosen movement type; the other two stay
    // disabled, matching RAW's "choose one of the following" (a single type, not all three).
    if (selectionType == 'altModeMovement') {
      const changeKey = `system.movement.${selection}.altMode`;
      const matchingEffect = newPerk.effects.find(e => e.changes.some(c => c.key == changeKey));
      if (matchingEffect) {
        await matchingEffect.update({ disabled: false });
      }
    }
  } else if (selectionType == 'perks') {
    // A fixed list keys its choices by the entry they came from; an any-General-Perk choice
    // (anyGeneralPerkChoices) keys them by uuid, with no entry yet. That entry is written onto
    // this actor's own copy now, because it is what links the chosen Perk back to its parent -
    // deleting the Origin removes it (deleteAttachmentsForItem), and a chosen Perk with a choice
    // of its own finds its collectionId there (the parentPerk branch above).
    // A uuid that is already one of the parent's own entries (Nobody Like Me still lists the Power
    // Rangers CRB's General Perks) reuses that entry - adding it a second time is refused as a
    // duplicate, and the Perk was never created.
    if (!(await createSubPerk(actor, newPerk, selection, perk.system.items))) {
      return newPerk;
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
 * One picked sub-Perk (a 'perks' choice - Grid Science, Modified Shell, Nobody Like Me...) made on the actor under its
 * parent: shared by onPerkDrop's 'perks' branch and the rules engine's pickSubPerk step
 * (rules/plugins/picks/pick-sub-perk.mjs). `selection` is one of the parent's own entry keys, or a uuid - an entry with
 * that uuid is reused, else (an any-General-Perk pick) a new entry is written onto the parent first, because it is what
 * links the child back (deleting the parent removes it - deleteAttachmentsForItem - and a child with an old-picker choice
 * of its own finds its collectionId there, onPerkDrop's parentPerk branch). A child with an old-picker choice goes
 * through setPerkValues (not awaited, as before); else it is created with its parentId / collectionId flags.
 * @param {Actor} actor
 * @param {Item} parent       The actor's copy of the parent Perk.
 * @param {String} selection  An entry key of `entries`, or a compendium uuid.
 * @param {Object} [entries]  The entry list the selection is read from (default: the parent's own system.items).
 * @returns {Promise<String|null>}   The child's collection key, or null when the entry couldn't be written (nothing made).
 */
export async function createSubPerk(actor, parent, selection, entries = parent?.system?.items) {
  let collectionKey = entries?.[selection]
    ? selection
    : Object.entries(entries ?? {}).find(([, entry]) => entry.uuid == selection)?.[0];
  const chosenPerk = collectionKey ? entries[collectionKey] : { uuid: selection };

  const itemToCreate = await fromUuid(chosenPerk.uuid);
  if (!itemToCreate) {
    return null;
  }

  if (!collectionKey) {
    collectionKey = await setEntryAndAddItem(itemToCreate, parent);
    if (!collectionKey) return null;
  }

  if (itemToCreate.system.hasChoice) {
    setPerkValues(actor, itemToCreate, parent, null);
  } else {
    const createdPerk = await Item.create(itemToCreate, { parent: actor });
    createdPerk.setFlag('essence20', 'collectionId', collectionKey);
    createdPerk.setFlag('essence20', 'parentId', parent._id);
    createdPerk.update({
      "_stats.compendiumSource": itemToCreate.uuid,
    });
  }

  return collectionKey;
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
 *   below (SPECTRUM_SHIFT_PERK_ID etc.) on its own.
 */
export async function setPerkValues(actor, perk, parentPerk=null, dropFunc=null, sourceUuid=null) {
  const perkUuid = sourceUuid ?? perk.uuid;

  // Equipment a Perk declares in its own compendium grant map - see grantPerkEquipmentMap.
  // Unconditional and idempotent, so it runs alongside (not instead of) the per-ID chain below.
  await grantPerkEquipmentMap(actor, perk);

  if (perkUuid == HEARTS_CALLING_ID) {
    await pickHeartsCallingOption(actor);
  } else if (perkUuid == SPECTRUM_SHIFT_PERK_ID) {
    return await _showSpectrumShiftDialog(actor, perk, dropFunc);
  }
  // (The Morphed Toughness bonus a Faction Perk gives - It's Morphin Time! and the like - is its own `added` /
  // `removed` Trigger rules now, refreshMorphedToughness; hasMorphedToughnessBonus is no longer read.)

  // ChoiceCount rules (Grid Tap's extra Grid Science / Grid Tech bonus): re-clones the Perk with numChoices raised BEFORE
  // its own choice dialog is built below - a real Document#clone (not a plain-object spread) so every downstream read of
  // perk.system/perk.uuid/etc. (the MultiChoiceSelector, onPerkDrop's own embedded-copy creation) still sees a
  // fully-functional Item, just with more picks on offer.
  const extraChoices = ruleChoiceCountBonus(actor, perkUuid);
  if (extraChoices > 0) {
    perk = perk.clone({ 'system.numChoices': perk.system.numChoices + extraChoices });
  }

  if (perk.system.hasChoice) {
    let choices = {};
    let prompt = null;
    let title = game.i18n.localize("E20.PerkSelect");
    // The game line a long, filterable list opens on (see ChoicesSelector) - null shows them all.
    let defaultGroup = null;

    switch (perk.system.choiceType) {
    case 'field':
      // GI Joe CRB p.104 (Technician/Expert Focus, 1st level): "choose a Culture, Science, or
      // Technology Specialization... This is your Field." Only records which skill was chosen -
      // the actual Essence Increase and marking that skill Specialized are both already handled
      // by the generic Essence Increase flow this Perk also grants, same division of labor as
      // Renegade's own Training (Essence Increase generic, the skill-choice itself Perk-specific).
      // Eureka/Expert in Your Field both read this choice back via findPerk(actor,
      // FIELD_ID)?.system.choice (mechanics/characters/perks.mjs), same shape Fighting Style already uses.
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

    case 'altModeMovement':
      // All-Terrain Alt Mode (Transformers CRB, General Perk, p.108): +20ft to one chosen Alt Mode
      // Movement - Ground, Aerial or Aquatic. The compendium item ships all 3 bonuses as its own disabled
      // Active Effects (one per movement type) - same "prompt, then enable the matching bundled
      // Active Effect" idiom as Increase (Essence)'s own Zord Feature picker (see
      // sheet-handlers/zord-feature-handler.mjs#onIncreaseEssenceDrop), applied to a Perk instead.
      // Reuses vehicleType's own unconditional ground/aerial/swim list just below rather than the
      // 'movement' case's actor-already-has-it filter - a Transformer's Alt Mode movement type
      // isn't necessarily one its root Mode already possesses.
      prompt = game.i18n.localize("E20.SelectMovement");
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

      if (grantsAnyGeneralPerk(perk, perkUuid)) {
        prompt = game.i18n.localize("E20.SelectGeneralPerk");
        Object.assign(choices, await anyGeneralPerkChoices(actor));
        defaultGroup = gameLineOf(perkUuid);
        break;
      }

      for (const [key, item] of Object.entries(perk.system.items)) {
        let taken = false;
        for (const attachedItem of actor.items) {
          // Dual-check: a candidate also obtainable through a Role's own items map gets
          // flags.core.sourceId stamped instead of _stats.compendiumSource (see attachment-
          // handler.mjs#grantItemEntry) - checking only the latter would let a player re-pick
          // an already-Role-granted candidate from this choice list.
          const attachedItemSourceId = attachedItem.flags.core?.sourceId ?? attachedItem._stats.compendiumSource ?? attachedItem?.flags?.essence20?.rulesSource;
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

        // choiceEssence, when set, narrows the picker to that one Essence's own skills - see its
        // own comment in data/item/perk.mjs.
        if (perk.system.choiceEssence && E20.skillToEssence[skill] != perk.system.choiceEssence) {
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
      // Adaptable (MLP CRB, Earth Pony Origin Perk, p.33): once a scene, a Skill of one chosen
      // Essence counts as Specialized. Same
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
      // items/forms/power-adaptation.mjs's own doc comment. Same "no numeric field of its own, read
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
      // items/attacks/electromagnetic-disruption.mjs's own doc comment. Same "no numeric field of its
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
      // items/defenses/defensive-flexibility.mjs's own doc comment. Same "no numeric field of its own,
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

    case 'energyConnectionOption':
      // Energy Connection (Decepticon Directive, Elementalist Focus, 10th level, p.53) - see
      // E20.energyConnectionOptions' own doc comment. Same "no numeric field of its own, read
      // directly off system.choice" shape as viciousOrVenom just below.
      prompt = game.i18n.localize("E20.SelectEnergyConnectionOption");
      for (const option of Object.keys(E20.energyConnectionOptions)) {
        const localizedLabel = game.i18n.localize(E20.energyConnectionOptions[option]);
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

    case 'toothAndClaw':
      // Tooth and Claw (Decepticon Directive, Monstrosity Origin Benefit, p.38) - see
      // E20.toothAndClawOptions' own doc comment. Same "no numeric field of its own, read directly
      // off system.choice" shape as viciousOrVenom above - dice.mjs reads this instance's own
      // choice directly at roll time.
      prompt = game.i18n.localize("E20.SelectToothAndClaw");
      for (const option of Object.keys(E20.toothAndClawOptions)) {
        const localizedLabel = game.i18n.localize(E20.toothAndClawOptions[option]);
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
      // Wavelength") - see mechanics/combat/combat.mjs#ENERGY_DAMAGE_TYPES's own doc comment for why this
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

    case 'stoneWarlordDamageType':
      // Finster's Monster-Matic Cookbook, Path of Stone, Stone Warlord, 20th level, p.297 - see
      // read by Numbness's AttackResistance choiceOf rule. Same "no numeric field of its own, read directly
      // off system.choice" shape as elementDamageType just above.
      prompt = game.i18n.localize("E20.SelectStoneWarlordDamageType");
      for (const damageType of Object.keys(E20.stoneWarlordDamageTypes)) {
        const localizedLabel = game.i18n.localize(E20.stoneWarlordDamageTypes[damageType]);
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
      // items/forms/wisdom-of-the-elders.mjs's own doc comment. Same "no numeric field of its own,
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
      // mechanics/resources/banked-buffs.mjs's own PHANTOM_FOCUS_ID comment. Same "no numeric field of its
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

    // Perk lists read alphabetically. Nothing else is reordered: environments, senses and the
    // like are short and already listed in the order the books give them.
    if (perk.system.choiceType == 'perks') {
      choices = Object.fromEntries(Object.entries(choices)
        .sort(([, a], [, b]) => a.label.localeCompare(b.label)));
    }

    // Expertise (GI Joe CRB, Commando base, 1st/7th level, p.72) - see its own
    // comment above. "Choose two skills" is now numChoices:2 on the compendium item itself (a
    // single MultiChoiceSelector asking for both at once), fixing the root cause of the
    // duplicate-skill race the guard above works around: 2 separate single-skill grants at the
    // SAME level used to open 2 concurrent dialogs, neither of which could see the other's
    // not-yet-confirmed pick. One dialog for both skills has no such race.
    if (perk.system.numChoices > 1 && ["perks", "skills"].includes(perk.system.choiceType)) {
      await new MultiChoiceSelector(choices, actor, prompt, title, perk, dropFunc, parentPerk).render(true);
    } else {
      const selector = new ChoicesSelector(choices, actor, prompt, title, perk, null, dropFunc, null, parentPerk, null);
      selector.defaultGroup = defaultGroup;
      await selector.render(true);
    }

  } else {
    return await onPerkDrop(actor, perk, dropFunc, null, null);
  }
}

/**
 * Shows the Role choice dialog for the Spectrum Shift Perk, offering every other Power
 * Rangers Role across every loaded compendium (so future sourcebooks' Roles are included).
 * Per the core rulebook (p.58), Spectrum Shift/the Advanced Ranger Spectrum is specifically a
 * Power Rangers mechanic - the PR CRB's Advanced Spectrum Role (the White Ranger); other game versions (Transformers/My
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
  if (perk.flags.core?.sourceId == ZORD_PERK_ID || perk._stats.compendiumSource == ZORD_PERK_ID || perk?.flags?.essence20?.rulesSource == ZORD_PERK_ID ) {
    await actor.update ({
      "system.canHaveZord": false,
    });
  }

  if (perk.flags.core?.sourceId == QUANTASAURUS_REX_ID || perk._stats.compendiumSource == QUANTASAURUS_REX_ID || perk?.flags?.essence20?.rulesSource == QUANTASAURUS_REX_ID ) {
    await actor.update ({
      "system.canHaveZord": false,
    });
  }

  if (perk.flags.core?.sourceId == TOROZORD_ID || perk._stats.compendiumSource == TOROZORD_ID || perk?.flags?.essence20?.rulesSource == TOROZORD_ID ) {
    await actor.update ({
      "system.canHaveZord": false,
    });
  }

  if (perk.flags.core?.sourceId == PHANTOM_SHIP_ID || perk._stats.compendiumSource == PHANTOM_SHIP_ID || perk?.flags?.essence20?.rulesSource == PHANTOM_SHIP_ID ) {
    await actor.update ({
      "system.canHaveZord": false,
    });
  }

  // (A Faction Perk's Morphed Toughness bonus comes off through its own `removed` Trigger rule now.)

  if (isPrincessPerk(perk)) {
    await removeSpellcastingUpshift(actor);
  }

  let updateString = null;
  let updateValue = null;
  const selectionType = perk.system.choiceType;
  // The pick the old picker baked into the actor (rules/choice-read.mjs#legacyChoiceOf - never a rules choice, which
  // was never written into actor data).
  const baked = legacyChoiceOf(perk);
  if (selectionType == 'environments') {
    updateString = "system.environments";
    updateValue = actor.system.environments;
    const index = updateValue.indexOf(baked);
    updateValue.splice(index, 1);
    actor.update({
      [updateString]: updateValue,
    });
  } else if (selectionType == 'senses') {
    updateString = `system.senses.${baked}.acute`;
    actor.update({
      [updateString]: false,
    });
  } else if (selectionType == 'movement' && !perk.flags?.essence20?.perkValueRule && baked) {
    // Only a copy dropped before 2026-10-07 wrote its value into the actor's bonus; a flagged copy's is
    // its own rule, gone with it. Taken off the stored bonus - the prepared one includes the rules'.
    const choice = baked;
    updateString = `system.movement.${choice}.bonus`;
    const stored = actor._source?.system?.movement?.[choice]?.bonus ?? actor.system.movement[choice].bonus;
    actor.update({
      [updateString]: stored - (Number(perk.system.value) || 0),
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
export async function setRoleVatiantPerks(newPerk, currentRole, actor) {
  for (const [key, perk] of Object.entries(newPerk.system.items)) {
    if (currentRole?.name == perk.role) {
      const itemToCreate = await fromUuid(perk.uuid);
      if (itemToCreate.system.choiceType != 'none') {
        setPerkValues(actor, itemToCreate, perk, null);
      } else {
        const createdPerk = await Item.create(itemToCreate, { parent: actor });
        createdPerk.setFlag('essence20', 'collectionId', key);
        createdPerk.setFlag('essence20', 'parentId', newPerk._id);
        // The variant Perk's OWN uuid, not the container's (newPerk, e.g. Be A Hero) - findPerk()
        // (mechanics/characters/perks.mjs) matches a specific Perk ID against exactly this field, so stamping
        // the container's id here made every ID-keyed hook checking for the variant itself
        // silently never match.
        createdPerk.update({
          "_stats.compendiumSource": itemToCreate.uuid,
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
