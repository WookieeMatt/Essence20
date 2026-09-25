import ChoicesSelector from "../apps/choices-selector.mjs";
import MultiChoiceSelector from "../apps/multi-choice-selector.mjs";
import { E20 } from "../helpers/config.mjs";
import { actorHasPower } from "../helpers/powers.mjs";
import { createItemCopies, deleteAttachmentsForItem, setEntryAndAddItem } from "./attachment-handler.mjs";
import { getVisibleItemPacks } from "../helpers/compendium-browser.mjs";
import { performSpectrumShift } from "./role-handler.mjs";
import { isPrincessPerk, removeSpellcastingUpshift } from "../helpers/princess-perks.mjs";
import { grantBlendInUpgrades } from "../helpers/blend-in.mjs";
import { grantSilentRunningUpgrades } from "../helpers/silent-running.mjs";
import { grantSpeakYourTruthEssence, SPEAK_YOUR_TRUTH_ID } from "../helpers/speak-your-truth.mjs";
import { grantTorozordFeature } from "../helpers/torozord-feature.mjs";
import { HEARTS_CALLING_ID, pickHeartsCallingOption } from "../helpers/emotional-mastery.mjs";
import {
  applyEnhanceStrike, ENHANCE_STRIKE_ID, grantUniqueStrike, UNIQUE_STRIKE_MELEE_ID, UNIQUE_STRIKE_RANGED_ID,
} from "../helpers/unique-strike.mjs";
import { applyZordAlteration, ZORD_ALTERATION_ID } from "../helpers/zord-alteration.mjs";
import { grantWindWhispersEvasion, WIND_WHISPERS_ID } from "../helpers/wind-whispers.mjs";
import { grantSurvivalTrainingHealth, SURVIVAL_TRAINING_ID } from "../helpers/survival-training.mjs";
import { grantPrimalMovement, PRIMAL_MOVEMENT_ID } from "../helpers/primal-movement.mjs";
import { grantPrimalTools, PRIMAL_TOOLS_ID } from "../helpers/primal-tools.mjs";
import { AQUA_ELEMENTAL_ADAPTATION_ID, grantAquaElementalAdaptation } from "../helpers/aqua-elemental-adaptation.mjs";
import { grantChosenSpecialization } from "../helpers/chosen-specialization.mjs";
import { activateWhyDoIKnowThat, WHY_DO_I_KNOW_THAT_ID } from "../helpers/why-do-i-know-that.mjs";

// TF CRB Influence Perks (p.33-38) - see helpers/chosen-specialization.mjs's own doc comment.
// "Choose a [Skill] Specialization, whether or not you invested in that Specialization. You gain
// an Edge on Skill Tests when that Specialization comes into play."
const FORMER_SENATOR_ID = "Compendium.essence20.tf_crb.Item.gcqyJw1sXxi2wy8e";
const GLADIATOR_ID = "Compendium.essence20.tf_crb.Item.tDge4xSE9urfxwHP";
const HUNTER_ID = "Compendium.essence20.tf_crb.Item.5Z0xtNOeSCD2YoRc";
const RACER_ID = "Compendium.essence20.tf_crb.Item.KjcoQiDoT7WEVsZX";
const SCAVENGER_ID = "Compendium.essence20.tf_crb.Item.95RyaWIi0HQOlyJN";

// Combiner Specialization (Enigma of Combination, Component Ace Focus, 1st level, p.34): "You gain
// the Gestalt Combiner or Matched Combiner General Perk. If you already have either of these
// Perks, you gain 1 additional Health instead." The picker itself is the generic 'perks' choiceType
// switch case below, which already filters out whichever of the two the actor already holds - "you
// already have either" therefore surfaces as BOTH being filtered out (an empty choices object),
// which the generic hasChoice flow just below treats as an error (E20.NoChoicesError) rather than
// this Perk's own documented fallback. Intercepted here, before that switch runs, so the +1 Health
// grant replaces the error instead of the picker ever opening on nothing.
const COMBINER_SPECIALIZATION_ID = "Compendium.essence20.enigma_of_combination.Item.mWyO6mHSMG4TVw3J";
const GESTALT_COMBINER_ID = "Compendium.essence20.enigma_of_combination.Item.a4BfJxhUC7hAhgdZ";
const MATCHED_COMBINER_ID = "Compendium.essence20.enigma_of_combination.Item.ZIJnA0z3Mrp8pfbd";

const SORCERY_PERK_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.xUBOE1s5pgVyUrwj";
// Cost of Sorcery (Finster's Monster-Matic Cookbook, p.271): "You gain the following Hang-Up when
// you take the Sorcery Perk" - a mandatory companion grant, the same "auto-add a specific
// compendium Item alongside this Perk" shape grantMetamorphosedChangeling above already
// establishes for its own Origin Benefit, applied here to Sorcery instead. The Fumble effect
// itself lives in dice.mjs (see COST_OF_SORCERY_ID's own doc comment there).
const COST_OF_SORCERY_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.BRpf0FNey5oDEvq3";
const ZORD_PERK_ID = "Compendium.essence20.pr_crb.Item.rCpCrfzMYPupoYNI";
const SPECTRUM_SHIFT_PERK_ID = "Compendium.essence20.pr_crb.Item.HxbEBJ3gXkTQqvxt";

// Quantasaurus Rex (A Jump Through Time, Quantum Ranger Role Perk, 4th level, p.46): "your Quantum
// Controller grants you control of the ancient Zord-beast... When actively piloting Quantasaurus
// Rex, you cannot suffer Snags on Animal Handling or Driving Skill Tests." Same canHaveZord grant
// as ZORD_PERK_ID just above (this is textually the Quantum Ranger's own Zord Role Perk, not a
// separate Zord Feature - it grants Zord access outright, no Additional Attack Type/Upgraded Zord
// picker involved). The Snag-immunity half lives in roll-dialog.mjs's own _isUntrainedSnag.
const QUANTASAURUS_REX_ID = "Compendium.essence20.jump_through_time.Item.sn5jhTf8sJqRFhKS";

// Phantom Ship (Across the Stars, Phantom Ranger Role Perk, 1st level, p.62) - see
// roll-dialog.mjs's own PHANTOM_SHIP_ID comment for the Snag-immunity half. This half is the
// same canHaveZord grant ZORD_PERK_ID/QUANTASAURUS_REX_ID just above already establish.
const PHANTOM_SHIP_ID = "Compendium.essence20.across_the_stars.Item.OfsTu9GpONWPV88t";

// Torozord (Through the Shattered Grid, Magna Defender Role Perk, 3rd level, p.24): "you become
// able to summon it to aid you in battle" - the Magna Defender's own equivalent of ZORD_PERK_ID's
// grant just above, never actually wired despite the compendium item existing bare since this
// book was first built.
const TOROZORD_ID = "Compendium.essence20.through_the_shattered_grid.Item.gx0xOFKcKOPyaUto";
// Torozord Feature (Through the Shattered Grid, Magna Defender Role Perk, 6th/10th/14th/17th
// level, p.25) - see helpers/torozord-feature.mjs's own doc comment for the full mechanic. Also
// never wired despite the compendium item existing; The_Magna_Defender's own system.items grant
// map was additionally missing all 4 of this Perk's own level entries entirely (a genuine
// authoring gap, corrected alongside this).
const TOROZORD_FEATURE_ID = "Compendium.essence20.through_the_shattered_grid.Item.xvd1sVIqu0sNEI1c";

// Duty of the Silver (Across the Stars, Silver Ranger, 7th level, p.57): "you gain training in
// Heavy Armor automatically, or Ultra-Heavy Armor if you already have Heavy." Only this half is
// built - the "teleport to the nearest concentration of Power Rangers" clause has no target data
// to resolve against, pure GM narration. Applied once, on drop, same shape as ZORD_PERK_ID's own
// grant just above - pulled into its own small function (unlike ZORD_PERK_ID's inline update) so
// it can be unit tested directly, since setPerkValues as a whole always falls through to
// onPerkDrop's own much larger, drag-and-drop-UI-coupled tail and isn't practical to unit test
// end-to-end.
const DUTY_OF_THE_SILVER_ID = "Compendium.essence20.across_the_stars.Item.KhV5GeGIMJNWlWhr";

// Natural Science (Cobra Codex, Ranger Firestarter Focus, 1st level, p.58) - see dice.mjs's own
// NATURAL_SCIENCE_ID comment for the Science/Survival substitution half. "You are Qualified with
// Element Jets and Trained in weapons with the Element trait" is a fixed, unconditional grant (no
// player choice), the same shape _trainingUpdate() already writes for a whole Role's weapon list
// (sheet-handlers/role-handler.mjs) - just a single weaponType key ('element') written directly
// on Perk drop instead. "You must choose Fire as the type of element your Element weapons use"
// and "one of your weapons without an Element trait gains Blazing or Broiler as a free Weapon
// Upgrade" both need a picker over the actor's OWN already-owned items (not a compendium choices
// map ChoicesSelector already handles) - a different, unbuilt mechanism, left for a dedicated
// pass.
const NATURAL_SCIENCE_ID = "Compendium.essence20.cobra_codex.Item.AXmmcHK2tSzRZLqB";

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

// Shadow Morph [Form] (Across the Stars, General Perk, p.70): "When Morphed, you gain... you may
// summon a Shadow Saber as a Free action." The Toughness/Evasion/Infiltration-Edge half is already
// a plain, already whileMorphed-gated compendium Active Effect. "Summon as a Free action" has no
// dismiss/re-summon concept to model any differently from Beatdown/Jackhammer's own identically-
// worded "always considered armed with" grants just above - same grantIntegratedWeapon() shape,
// granted once when the Perk is taken rather than gated behind an actual per-use toggle.
const SHADOW_MORPH_ID = "Compendium.essence20.across_the_stars.Item.UNgNYpUADVTaNrWt";
const SHADOW_SABER_ID = "Compendium.essence20.across_the_stars.Item.PQ2msfDzjTGz8aXN";

// Grid Tap (Beneath the Helmet, Grid Power, p.57) - see its own check next to the `hasChoice`
// switch above. The 8 known Grid Science/Grid Tech pickers (PR CRB's own Blue Ranger Grid Tech
// I-IV, Beneath the Helmet's Aqua Ranger Grid Science I-IV) - a fixed id list rather than a name
// match, the same "match by compendium id, not display name" idiom every other Perk-identification
// check in this file already uses.
const GRID_TAP_ID = "Compendium.essence20.beneath_the_helmet.Item.JKwabam49PLMVN28";
const GRID_SCIENCE_TECH_IDS = new Set([
  "Compendium.essence20.pr_crb.Item.R7HF3aSR3ZPURh1W", // Grid Tech I
  "Compendium.essence20.pr_crb.Item.PIwAwPxbzH4hQ0WB", // Grid Tech II
  "Compendium.essence20.pr_crb.Item.qZVu4bfVFOvcgzgo", // Grid Tech III
  "Compendium.essence20.pr_crb.Item.dWfuzsqz30rZmX1G", // Grid Tech IV
  "Compendium.essence20.beneath_the_helmet.Item.C81ZIdSjyz5mSTkI", // Grid Science I
  "Compendium.essence20.beneath_the_helmet.Item.jNOwd35gE6Qrybdb", // Grid Science II
  "Compendium.essence20.beneath_the_helmet.Item.6wD6guZWDrVbsMHZ", // Grid Science III
  "Compendium.essence20.beneath_the_helmet.Item.sZacBgzLZjYd6ypy", // Grid Science IV
]);

// Battlizer Access (Specific Battlizer) (Across the Stars, General Perk, p.68 / Beneath the
// Helmet, General Perk, p.52 - RE-CATEGORIZED 2026-09-15, the first item pulled off the
// "Item-grant / equipment-mutation mechanism" gap's own blocked list): "When you choose this
// Perk, select a Battlizer from the section beginning on page 85/87. While Morphed, you may spend
// the chosen Battlizer's Power Cost to summon and use it." The actual grant half needed no new
// infrastructure at all - grantIntegratedWeapon() below already generalizes cleanly to any Item
// type (renamed grantIntegratedItem), so this just supplies 'armor' + the real Battlizer's own
// compendium id. Only one real Battlizer item exists in each book right now (S.P.D. Battlizer /
// Triassic Battlizer), so there's no real "choice" to offer yet - "select a Battlizer" collapses
// to granting the sole option, the same way it would for any single-candidate pick elsewhere in
// this project; a real choice dialog can be added if/when a second Battlizer is ever added to
// either book. "GM Approval" is the same unenforceable narrative gate already accepted everywhere
// else in this project. The "spend the Battlizer's own Power Cost to summon and use it while
// Morphed" activation clause is a separate, still-unbuilt toggle/resource mechanic layered on top
// of actually owning the item - flagged, not attempted this pass.
const BATTLIZER_ACCESS_ATS_ID = "Compendium.essence20.across_the_stars.Item.JGAOozVnu9Nou5Xj";

const SPD_BATTLIZER_ID = "Compendium.essence20.across_the_stars.Item.qc82QDtZN3qVWqxV";
const BATTLIZER_ACCESS_BTH_ID = "Compendium.essence20.beneath_the_helmet.Item.oJAdvdKs1XLmsH0z";
const TRIASSIC_BATTLIZER_ID = "Compendium.essence20.beneath_the_helmet.Item.sVYZLXhPZqdVhNax";

// Ferocious Fighters (Factions in Action Vol 1) - 3 Faction Perks that should each grant a fixed
// General Perk outright but ship with an empty items map (a real wiring gap the categorization
// pass found, not a missing mechanism - the SAME grant-a-Perk-outright pattern this file already
// uses for Duty of the Silver's training grant/Beatdown's weapon grant, just targeting another
// Perk item this time). None of the 3 need a player CHOICE (each grants exactly one fixed thing),
// so a dedicated function (matching Beatdown's own shape) is used instead of the hasChoice picker
// mechanism, which would otherwise force an unnecessary "choose 1 of 1" confirmation dialog.
const CHANGE_ITS_STRIPES_ID = "Compendium.essence20.ferocious_fighters.Item.8tz9aZSqmUntS20H";
const BLEND_IN_ID = "Compendium.essence20.ferocious_fighters.Item.mnze6jJ6eSYbS8Pr";

// Silent Running - see helpers/silent-running.mjs's own doc comment.
const SILENT_RUNNING_ID = "Compendium.essence20.ferocious_fighters.Item.58OZMB7WbAgqgpkX";
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

// Young But Experienced (General Hawk's Personnel Files, Old Hand Advanced Role Perk): "You gain
// the Veteran General Perk, even if you do not meet the prerequisites." Same grant-a-Perk-outright
// pattern as Change Its Stripes/For The Syndicate above.
const YOUNG_BUT_EXPERIENCED_ID = "Compendium.essence20.general_hawk_s_personel_files.Item.o5O65BE6dtdlxsfM";
const VETERAN_ID = "Compendium.essence20.gi_joe_crb.Item.3ahVUG1yKCGNyscK";

// Into the Void (Factions in Action Vol 2, Arashikage Faction Perk): "You gain the Dig Deep
// General Perk." Same grant-a-Perk-outright pattern as Into the Void's sibling Faction Perks
// above (For The Syndicate's Mentor grant, Change Its Stripes' Blend In grant).
const INTO_THE_VOID_ID = "Compendium.essence20.intercontinental_adventures.Item.OuLsQGETgtRNJ0RQ";
const DIG_DEEP_GIJ_ID = "Compendium.essence20.gi_joe_crb.Item.QJkcVXT7K4yNWFoT";

// Synchronization (Quartermaster's Guide to Gear, Tech Officer Focus, p.22): "You gain the Stay
// in Formation General Perk (page 31), even if you do not meet its prerequisites." A grant-a-
// Perk-outright ship-time gap (the Perk item exists bare, with an empty items map) - same pattern
// as Change Its Stripes/For The Syndicate/Into the Void above.
const SYNCHRONIZATION_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.Ee3GRqk0H7ph0vEs";
const STAY_IN_FORMATION_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.pU3dKGNWYAhgRY6B";

// Nanoflage (Quartermaster's Guide to Gear, Chameleonite Focus, p.22): "you gain the Mimic
// Nanomite Power." (The same paragraph's "not limited to two uses per day, instead regenerating
// one use per scene" has nothing to override yet - Powers have no generic per-day usage cap in
// this codebase at all, see helpers/power-use.mjs's own doc comment, so there's no cap left to
// widen.) Same fixed-grant gap as Synchronization above, just granting a Power instead of a Perk -
// grantIntegratedItem already generalizes to any Item type.
const NANOFLAGE_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.22p3l2vFsFZqfOET";
const MIMIC_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.WI0QTzlWkEusSQqY";

// Pet Companion (Cobra Codex, Wildlife Division Perk, p.78): "You gain the Animal Pet General
// Perk. Unlike most General Perks gained from other options, you must meet the prerequisite to
// gain the benefits of Animal Pet. You do not gain an Animal Pet until you reach Animal Handling
// +d4." The grant itself is unconditional (same fixed-grant gap as Synchronization above) - the
// prerequisite clause gates the Animal Pet Perk's OWN benefit, which is the same unenforced
// narrative prerequisite text every other Perk in this project already carries (Animal Pet's own
// system.prerequisite is untouched), not something this grant needs to check itself.
const PET_COMPANION_ID = "Compendium.essence20.cobra_codex.Item.05bNThwoKYW67fZB";
const ANIMAL_PET_GIJ_ID = "Compendium.essence20.gi_joe_crb.Item.6oF71x58kaB302bH";

// Metamorphosis (Dark Skies Over Equestria, General Perk, p.20; prerequisite: Colony Changeling):
// "You lose the Colony Changeling benefits of Natural Shape and can choose two Metamorphosed
// Changeling benefits." Colony Changeling and Metamorphosed Changeling are the two mutually
// exclusive sub-choices Natural Shape's own hasChoice picker offers at character creation (see
// Natural_Shape's own items map) - this Perk is the one way to swap from one to the other after
// the fact. The swap-out half (deleting Colony Changeling) has no other precedent in this project;
// the swap-in half reuses Metamorphosed Changeling's own already-built hasChoice picker (2 of its
// 6 named benefits) by feeding the freshly created copy back through setPerkValues, the same way
// a nested 'perks' choice resolves at line ~694 above - so the player still gets prompted to pick
// their two benefits, exactly as if they had chosen Metamorphosed Changeling from Natural Shape
// directly. See grantMetamorphosis() below.
const METAMORPHOSIS_ID = "Compendium.essence20.dark_skies_over_equestria.Item.bLtGPdoCPr9Ezgb8";
const COLONY_CHANGELING_ID = "Compendium.essence20.dark_skies_over_equestria.Item.FRUWPAePJzm7Mlf0";
const METAMORPHOSED_CHANGELING_ID = "Compendium.essence20.dark_skies_over_equestria.Item.aD130X44xDxZ6o2U";

// Colony Changeling (Dark Skies Over Equestria, Natural Shape choice, p.17): "Colony Changelings
// get Infatuated as a mandatory Influence." Infatuated is an Influence, not a Perk, so this can't
// reuse grantPerkOutright below (hardcoded to type 'perk') - see grantColonyChangelingInfatuated's
// own comment.
const INFATUATED_ID = "Compendium.essence20.dark_skies_over_equestria.Item.2Kw4msw0l4j6fTOm";

// Heavy/Medium/Ultra-Heavy Armor Shell (PR CRB, General Perks, p.95/97/98): each raises the
// holder's own Armor Training (system.trained.armors.*) via a plain compendium Active Effect, not
// through a Role/Morphin Time drop - so unlike every OTHER path that changes Armor Training
// (Role drop, Morphin Time itself), nothing here used to re-run setMorphedToughnessBonus, leaving
// system.defenses.toughness.morphed stale at whatever it was computed as before this Perk was
// added or removed. These don't set hasMorphedToughnessBonus (that flag means "IS a Morphin
// Time-style Perk," not "changes Armor Training"), so they need their own explicit check here,
// same hardcoded-ID idiom as this function's many other perkUuid branches.
const HEAVY_ARMOR_SHELL_ID = "Compendium.essence20.pr_crb.Item.XVrOmc94bK9G9F5P";
const MEDIUM_ARMOR_SHELL_ID = "Compendium.essence20.pr_crb.Item.d4AKhKlDbkQqGwOu";
const ULTRA_HEAVY_ARMOR_SHELL_ID = "Compendium.essence20.pr_crb.Item.xBeEe7X1MBoo4cYW";

// Nobody Like Me (PR CRB, Oddball Origin Benefit, p.25): "choose any General Perk you meet the
// prerequisites for". Its compendium item once listed the Power Rangers CRB's 42 by hand; the
// choice is built from every enabled book instead - see anyGeneralPerkChoices().
const NOBODY_LIKE_ME_ID = "Compendium.essence20.pr_crb.Item.9nvRKN0A8N0EEXUl";
const ANY_GENERAL_PERK_IDS = new Set([NOBODY_LIKE_ME_ID]);

/**
 * Whether this Perk offers any General Perk rather than a fixed list. Checked by source as well
 * as by uuid, so a copy already on an actor (Actor.x.Item.y) is recognised too.
 * @param {Item} perk
 * @param {String} perkUuid
 * @returns {Boolean}
 */
export function grantsAnyGeneralPerk(perk, perkUuid) {
  return [perkUuid, perk.flags?.core?.sourceId, perk._stats?.compendiumSource]
    .some(id => ANY_GENERAL_PERK_IDS.has(id));
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
  const taken = new Set(actor.items.map(item => item.flags?.core?.sourceId ?? item._stats?.compendiumSource));
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
 * Handles a choiceType:'skills' Perk being granted via a single MultiChoiceSelector asking for
 * every skill at once (perk.system.numChoices > 1) - see EXPERTISE_GIJ_ID's own comment above for
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
  const perkSourceId = perk.flags?.core?.sourceId ?? perk._stats?.compendiumSource ?? perk.uuid;
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

export async function grantDutyOfTheSilverArmorTraining(actor) {
  await actor.update({
    [actor.system.trained.armors.heavy ? "system.trained.armors.ultraHeavy" : "system.trained.armors.heavy"]: true,
  });
}

/**
 * Grants a permanent copy of the given Item, unless the actor already has one of the same type
 * sourced from the same compendium id - the shared logic behind Beatdown/Jackhammer's "always
 * considered armed with an integrated X" weapon grants, and Battlizer Access's own armor grant.
 * @param {Actor} actor
 * @param {String} itemType   The granted Item's own `type` (e.g. "weapon", "armor").
 * @param {String} itemId     A full compendium UUID for an Item of that type.
 */
async function grantIntegratedItem(actor, itemType, itemId) {
  const alreadyHasItem = actor.items.some(item =>
    item.type == itemType
    && (item.flags?.core?.sourceId == itemId || item._stats?.compendiumSource == itemId));
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
 * shared logic behind Beatdown/Jackhammer's "always considered armed with an integrated X, even
 * if unarmed or your hands are full" grants.
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
 * Weapon/gear/power/armor entries are always granted (power/armor both reuse grantIntegratedItem
 * the same way Nanoflage's Mimic grant and Battlizer Access's own armor grant do - see
 * grantNanoflageMimic's/grantBattlizerAccess's own comments). Perk-type entries are granted too,
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
 * Battlizer Access - see BATTLIZER_ACCESS_ATS_ID's own comment above. Grants a permanent copy of
 * the chosen Battlizer (an ordinary armor-type Item), unless the actor already has one.
 * @param {Actor} actor
 * @param {String} battlizerId   A full compendium UUID for the granted Battlizer armor Item.
 */
export async function grantBattlizerAccess(actor, battlizerId) {
  await grantIntegratedItem(actor, 'armor', battlizerId);
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
 * Shadow Morph [Form] - see SHADOW_MORPH_ID's own comment above.
 * @param {Actor} actor
 */
export async function grantShadowSaber(actor) {
  await grantIntegratedWeapon(actor, SHADOW_SABER_ID);
}

/**
 * Grants a permanent copy of the given Perk Item, unless the actor already has one - the shared
 * logic behind Change Its Stripes/Combat Lifesaver/Life Finds A Way's own "gain the X General
 * Perk" grants (see CHANGE_ITS_STRIPES_ID's own comment above).
 * @param {Actor} actor
 * @param {String} perkId   A full compendium UUID for a perk-type Item.
 */
export async function grantPerkOutright(actor, perkId) {
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
 * Young But Experienced - see YOUNG_BUT_EXPERIENCED_ID's own comment above.
 * @param {Actor} actor
 */
export async function grantYoungButExperiencedVeteran(actor) {
  await grantPerkOutright(actor, VETERAN_ID);
}

/**
 * Into the Void - see INTO_THE_VOID_ID's own comment above.
 * @param {Actor} actor
 */
export async function grantIntoTheVoidDigDeep(actor) {
  await grantPerkOutright(actor, DIG_DEEP_GIJ_ID);
}

/**
 * Synchronization - see SYNCHRONIZATION_ID's own comment above.
 * @param {Actor} actor
 */
export async function grantSynchronizationStayInFormation(actor) {
  await grantPerkOutright(actor, STAY_IN_FORMATION_ID);
}

/**
 * Nanoflage - see NANOFLAGE_ID's own comment above. Mimic is a Power, not a Perk, so this reuses
 * grantIntegratedItem (already generic across Item types) rather than grantPerkOutright.
 * @param {Actor} actor
 */
export async function grantNanoflageMimic(actor) {
  await grantIntegratedItem(actor, 'power', MIMIC_ID);
}

/**
 * Pet Companion - see PET_COMPANION_ID's own comment above.
 * @param {Actor} actor
 */
export async function grantPetCompanionAnimalPet(actor) {
  await grantPerkOutright(actor, ANIMAL_PET_GIJ_ID);
}

/**
 * Metamorphosis - see METAMORPHOSIS_ID's own comment above. Deletes the actor's Colony Changeling
 * (if they have one - taking this Perk without it would already be blocked by its unenforced
 * narrative prerequisite, but this stays a no-op rather than erroring if that's ever bypassed),
 * then grants Metamorphosed Changeling and immediately routes it back through setPerkValues so its
 * own hasChoice picker (2 of 6 named benefits) opens for the player, exactly as it would if they'd
 * chosen it from Natural Shape directly.
 * @param {Actor} actor
 */
export async function grantMetamorphosis(actor) {
  const colonyChangeling = actor.items.find(item =>
    item.type == 'perk'
    && (item.flags?.core?.sourceId == COLONY_CHANGELING_ID || item._stats?.compendiumSource == COLONY_CHANGELING_ID));
  if (colonyChangeling) {
    await colonyChangeling.delete();
  }

  const alreadyMetamorphosed = actor.items.some(item =>
    item.type == 'perk'
    && (item.flags?.core?.sourceId == METAMORPHOSED_CHANGELING_ID
      || item._stats?.compendiumSource == METAMORPHOSED_CHANGELING_ID));
  if (alreadyMetamorphosed) {
    return;
  }

  const metamorphosedChangeling = await fromUuid(METAMORPHOSED_CHANGELING_ID);
  const created = await Item.create(metamorphosedChangeling, { parent: actor });
  await setPerkValues(actor, created, null, null, METAMORPHOSED_CHANGELING_ID);
}

/**
 * Colony Changeling - see COLONY_CHANGELING_ID's own comment above. Grants a permanent copy of the
 * Infatuated Influence, unless the actor already has one - the same "grant unless already held"
 * shape grantPerkOutright uses, just checking type 'influence' instead of 'perk' (grantPerkOutright
 * itself is hardcoded to 'perk', so this doesn't reuse it directly).
 * @param {Actor} actor
 */
export async function grantColonyChangelingInfatuated(actor) {
  const alreadyInfatuated = actor.items.some(item =>
    item.type == 'influence'
    && (item.flags?.core?.sourceId == INFATUATED_ID || item._stats?.compendiumSource == INFATUATED_ID));
  if (alreadyInfatuated) {
    return;
  }

  const infatuated = await fromUuid(INFATUATED_ID);
  await Item.create(infatuated, { parent: actor });
}

/**
 * Natural Science - see NATURAL_SCIENCE_ID's own comment above. Grants Element Jet weapon
 * qualification/training directly, the same fields _trainingUpdate() writes for a Role's own
 * weapon list.
 * @param {Actor} actor
 */
export async function grantNaturalScienceQualification(actor) {
  await actor.update({
    "system.qualified.weapons.element": true,
    "system.trained.weapons.element": true,
  });
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

  if (['environments', 'senses', 'movement', 'altModeMovement', 'skills', 'fightingStyle', 'field'].includes(selectionType)) {
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

    const localizedSelection = selectionType == 'movement' || selectionType == 'altModeMovement'
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
    let collectionKey = perk.system.items[selection]
      ? selection
      : Object.entries(perk.system.items ?? {}).find(([, entry]) => entry.uuid == selection)?.[0];
    const chosenPerk = collectionKey ? perk.system.items[collectionKey] : { uuid: selection };

    const itemToCreate = await fromUuid(chosenPerk.uuid);
    if (!collectionKey) {
      collectionKey = await setEntryAndAddItem(itemToCreate, newPerk);
      if (!collectionKey) return newPerk;
    }

    if (itemToCreate.system.hasChoice) {
      setPerkValues(actor, itemToCreate, newPerk, null);
    } else {
      const createdPerk = await Item.create(itemToCreate, { parent: actor });
      createdPerk.setFlag('essence20', 'collectionId', collectionKey);
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

  // Combiner Specialization - see COMBINER_SPECIALIZATION_ID's own comment above. Checked (and
  // returned out of) before the generic hasChoice picker below ever runs, since an empty choice
  // list there is this Perk's own documented fallback, not an error.
  if (perkUuid == COMBINER_SPECIALIZATION_ID) {
    const alreadyHasEither = actor.items.some(item => {
      const sourceId = item.flags.core?.sourceId ?? item._stats?.compendiumSource;
      return sourceId == GESTALT_COMBINER_ID || sourceId == MATCHED_COMBINER_ID;
    });

    if (alreadyHasEither) {
      await actor.update({ 'system.health.bonus': (actor.system.health.bonus ?? 0) + 1 });
      return;
    }
  }

  // Why Do I Know That? - see helpers/why-do-i-know-that.mjs's own doc comment. Prompts for any
  // General Perk and grants it, the same drop-time resolution Change Its Stripes uses for its own
  // fixed grant - the only difference being that the choice is open rather than predetermined.
  if (perkUuid == WHY_DO_I_KNOW_THAT_ID) {
    await activateWhyDoIKnowThat(actor);
  }

  // Equipment a Perk declares in its own compendium grant map - see grantPerkEquipmentMap.
  // Unconditional and idempotent, so it runs alongside (not instead of) the per-ID chain below.
  await grantPerkEquipmentMap(actor, perk);

  if (perkUuid == SORCERY_PERK_ID) {
    await actor.update ({
      "system.powers.sorcerous.levelTaken": actor.system.level,
    });

    const alreadyHasCostOfSorcery = actor.items.some(item => {
      const sourceId = item.flags?.core?.sourceId ?? item._stats?.compendiumSource;
      return sourceId == COST_OF_SORCERY_ID;
    });
    if (!alreadyHasCostOfSorcery) {
      const costOfSorcery = await fromUuid(COST_OF_SORCERY_ID);
      await Item.create(costOfSorcery, { parent: actor });
    }
  } else if (perkUuid == ZORD_PERK_ID) {
    await actor.update ({
      "system.canHaveZord": true,
    });
  } else if (perkUuid == QUANTASAURUS_REX_ID) {
    await actor.update ({
      "system.canHaveZord": true,
    });
  } else if (perkUuid == TOROZORD_ID) {
    await actor.update ({
      "system.canHaveZord": true,
    });
  } else if (perkUuid == PHANTOM_SHIP_ID) {
    await actor.update ({
      "system.canHaveZord": true,
    });
  } else if (perkUuid == TOROZORD_FEATURE_ID) {
    await grantTorozordFeature(actor, perk);
  } else if (perkUuid == ZORD_ALTERATION_ID) {
    await applyZordAlteration(actor);
  } else if (perkUuid == WIND_WHISPERS_ID) {
    await grantWindWhispersEvasion(actor);
  } else if (perkUuid == SURVIVAL_TRAINING_ID) {
    await grantSurvivalTrainingHealth(actor);
  } else if (perkUuid == AQUA_ELEMENTAL_ADAPTATION_ID) {
    await grantAquaElementalAdaptation(actor);
  } else if (perkUuid == FORMER_SENATOR_ID) {
    await grantChosenSpecialization(perk, ['deception', 'persuasion']);
  } else if (perkUuid == GLADIATOR_ID) {
    await grantChosenSpecialization(perk, ['intimidation']);
  } else if (perkUuid == HUNTER_ID) {
    await grantChosenSpecialization(perk, ['survival']);
  } else if (perkUuid == RACER_ID) {
    await grantChosenSpecialization(perk, ['driving']);
  } else if (perkUuid == SCAVENGER_ID) {
    await grantChosenSpecialization(perk, ['streetwise']);
  } else if (perkUuid == DUTY_OF_THE_SILVER_ID) {
    await grantDutyOfTheSilverArmorTraining(actor);
  } else if (perkUuid == BEATDOWN_ID) {
    await grantBeatdownWeapon(actor);
  } else if (perkUuid == JACKHAMMER_ID) {
    await grantJackhammerWeapon(actor);
  } else if (perkUuid == SHADOW_MORPH_ID) {
    await grantShadowSaber(actor);
  } else if (perkUuid == BATTLIZER_ACCESS_ATS_ID) {
    await grantBattlizerAccess(actor, SPD_BATTLIZER_ID);
  } else if (perkUuid == BATTLIZER_ACCESS_BTH_ID) {
    await grantBattlizerAccess(actor, TRIASSIC_BATTLIZER_ID);
  } else if (perkUuid == CHANGE_ITS_STRIPES_ID) {
    await grantBlendIn(actor);
  } else if (perkUuid == BLEND_IN_ID) {
    await grantBlendInUpgrades(actor);
  } else if (perkUuid == SILENT_RUNNING_ID) {
    await grantSilentRunningUpgrades(actor);
  } else if (perkUuid == COMBAT_LIFESAVER_ID) {
    await grantEmtCrashCourse(actor);
  } else if (perkUuid == LIFE_FINDS_A_WAY_ID) {
    await grantDodgy(actor);
  } else if (perkUuid == FOR_THE_SYNDICATE_ID) {
    await grantForTheSyndicateMentor(actor);
  } else if (perkUuid == YOUNG_BUT_EXPERIENCED_ID) {
    await grantYoungButExperiencedVeteran(actor);
  } else if (perkUuid == INTO_THE_VOID_ID) {
    await grantIntoTheVoidDigDeep(actor);
  } else if (perkUuid == SYNCHRONIZATION_ID) {
    await grantSynchronizationStayInFormation(actor);
  } else if (perkUuid == NANOFLAGE_ID) {
    await grantNanoflageMimic(actor);
  } else if (perkUuid == PET_COMPANION_ID) {
    await grantPetCompanionAnimalPet(actor);
  } else if (perkUuid == METAMORPHOSIS_ID) {
    await grantMetamorphosis(actor);
  } else if (perkUuid == COLONY_CHANGELING_ID) {
    await grantColonyChangelingInfatuated(actor);
  } else if (perkUuid == NATURAL_SCIENCE_ID) {
    await grantNaturalScienceQualification(actor);
  } else if (perkUuid == SPEAK_YOUR_TRUTH_ID) {
    await grantSpeakYourTruthEssence(perk);
  } else if (perkUuid == PRIMAL_MOVEMENT_ID) {
    await grantPrimalMovement(actor);
  } else if (perkUuid == PRIMAL_TOOLS_ID) {
    await grantPrimalTools(actor);
  } else if (perkUuid == HEARTS_CALLING_ID) {
    await pickHeartsCallingOption(actor);
  } else if (perkUuid == UNIQUE_STRIKE_MELEE_ID) {
    await grantUniqueStrike(actor, false);
  } else if (perkUuid == UNIQUE_STRIKE_RANGED_ID) {
    await grantUniqueStrike(actor, true);
  } else if (perkUuid == ENHANCE_STRIKE_ID) {
    await applyEnhanceStrike(actor);
  } else if (perkUuid == SPECTRUM_SHIFT_PERK_ID) {
    return await _showSpectrumShiftDialog(actor, perk, dropFunc);
  } else if (
    perkUuid == HEAVY_ARMOR_SHELL_ID || perkUuid == MEDIUM_ARMOR_SHELL_ID || perkUuid == ULTRA_HEAVY_ARMOR_SHELL_ID
  ) {
    setMorphedToughnessBonus(actor);
  } else if (perk.system.hasMorphedToughnessBonus) {
    setMorphedToughnessBonus(actor);
  }

  // Grid Tap (Beneath the Helmet, Grid Power, p.57): "Whenever you gain a Grid Science or Grid
  // Tech Role Perk, you may choose an extra Grid Science or Grid Tech bonus." Re-clones the
  // just-granted Grid Science/Tech picker with numChoices bumped by 1 BEFORE its own choice
  // dialog is built below - a real Document#clone (not a plain-object spread) so every downstream
  // read of perk.system/perk.uuid/etc. (the MultiChoiceSelector, onPerkDrop's own embedded-copy
  // creation) still sees a fully-functional Item, just with one more pick on offer.
  if (GRID_SCIENCE_TECH_IDS.has(perkUuid) && actorHasPower(actor, GRID_TAP_ID)) {
    perk = perk.clone({ 'system.numChoices': perk.system.numChoices + 1 });
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

    case 'altModeMovement':
      // All-Terrain Alt Mode (Transformers CRB, General Perk, p.108): "Choose one of the
      // following: Ground, Aerial, or Aquatic. Your Alt Mode movement of the chosen type
      // increases by 20 feet." The compendium item ships all 3 bonuses as its own disabled
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

    case 'stoneWarlordDamageType':
      // Finster's Monster-Matic Cookbook, Path of Stone, Stone Warlord, 20th level, p.297 - see
      // helpers/numbness.mjs's own doc comment. Same "no numeric field of its own, read directly
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

    // Perk lists read alphabetically. Nothing else is reordered: environments, senses and the
    // like are short and already listed in the order the books give them.
    if (perk.system.choiceType == 'perks') {
      choices = Object.fromEntries(Object.entries(choices)
        .sort(([, a], [, b]) => a.label.localeCompare(b.label)));
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

    const costOfSorcery = actor.items.find(item => {
      const sourceId = item.flags?.core?.sourceId ?? item._stats?.compendiumSource;
      return sourceId == COST_OF_SORCERY_ID;
    });
    if (costOfSorcery) {
      await costOfSorcery.delete();
    }
  }

  if (perk.flags.core?.sourceId == ZORD_PERK_ID || perk._stats.compendiumSource == ZORD_PERK_ID ) {
    await actor.update ({
      "system.canHaveZord": false,
    });
  }

  if (perk.flags.core?.sourceId == QUANTASAURUS_REX_ID || perk._stats.compendiumSource == QUANTASAURUS_REX_ID ) {
    await actor.update ({
      "system.canHaveZord": false,
    });
  }

  if (perk.flags.core?.sourceId == TOROZORD_ID || perk._stats.compendiumSource == TOROZORD_ID ) {
    await actor.update ({
      "system.canHaveZord": false,
    });
  }

  if (perk.flags.core?.sourceId == PHANTOM_SHIP_ID || perk._stats.compendiumSource == PHANTOM_SHIP_ID ) {
    await actor.update ({
      "system.canHaveZord": false,
    });
  }

  if (
    perk.flags.core?.sourceId == HEAVY_ARMOR_SHELL_ID || perk._stats.compendiumSource == HEAVY_ARMOR_SHELL_ID
    || perk.flags.core?.sourceId == MEDIUM_ARMOR_SHELL_ID || perk._stats.compendiumSource == MEDIUM_ARMOR_SHELL_ID
    || perk.flags.core?.sourceId == ULTRA_HEAVY_ARMOR_SHELL_ID || perk._stats.compendiumSource == ULTRA_HEAVY_ARMOR_SHELL_ID
  ) {
    // Re-derive from whatever Armor Training remains (e.g. dropping down from Heavy to the
    // Role's own base Medium Training) rather than the hasMorphedToughnessBonus branch's own flat
    // reset to 0 just below - that branch is for losing Morphin Time itself (no Armor Training
    // concept applies at all anymore), not for losing one of several Armor Shells.
    await setMorphedToughnessBonus(actor);
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
        // (helpers/perks.mjs) matches a specific Perk ID against exactly this field, so stamping
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
