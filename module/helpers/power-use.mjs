import { postPerkUseChatCard } from "./perks.mjs";
import { applySpeedBoost } from "./speed-boost.mjs";
import { applyPowerShield } from "./power-shield.mjs";
import { activateFasterRegeneration } from "./faster-regeneration.mjs";
import { activateBoostInitiative } from "./boost-initiative.mjs";
import { activateAugmentPowerWeapon } from "./augment-power-weapon.mjs";
import { activatePenetratingStrikes } from "./penetrating-strikes.mjs";
import { activateRepairZord } from "./repair-zord.mjs";
import { activatePowerHeal } from "./power-heal.mjs";
import { activateGridPowerStrike } from "./grid-power-strike.mjs";
import { activatePowerBlast } from "./power-blast.mjs";
import { activateZeoCrystalBoost, canUseZeoCrystalBoost, pickZeoCrystalBoostOption } from "./zeo-crystal-boost.mjs";
import { revealTargetChronoFile } from "./chrono-file-access.mjs";
import { activateWillfulStrength } from "./willful-strength.mjs";
import { activateBlazingStrikes } from "./blazing-strikes.mjs";
import { activateVoidWarrior } from "./void-warrior.mjs";
import { activateRevYourEngines } from "./rev-your-engines.mjs";
import { activateMorphblast } from "./morphblast.mjs";
import { activateMegazordLink } from "./megazord-link.mjs";
import { activateFutureVision } from "./future-vision.mjs";
import { activateMobileMode, pickMobileModeType } from "./mobile-mode.mjs";
import { activateMetallicArmor } from "./metallic-armor.mjs";
import { activateGridEmpowered } from "./grid-empowered.mjs";
import { applyShatteredMemoriesOption, pickShatteredMemoriesOption } from "./shattered-memories.mjs";
import { toggleProtectionBoost } from "./protection.mjs";
import { toggleAugmentedCombat } from "./augmented-combat.mjs";
import { pickSwiftnessMovementType, toggleSwiftness } from "./swiftness.mjs";
import { activateRepairMachine } from "./repair-machine.mjs";
import { activateElectricDischarge } from "./electric-discharge.mjs";
import { activateDisintegrate } from "./disintegrate.mjs";
import { activateRegeneration } from "./regeneration.mjs";
import { activateBolsterDefense } from "./bolster-defense.mjs";
import { activateMonsterGrow } from "./monster-grow.mjs";
import { activateLuckyCharm } from "./lucky-charm.mjs";
import { activateIllusoryDisguiseRoll } from "./illusory-disguise.mjs";

/**
 * The Power-side equivalent of helpers/banked-buffs.mjs#onPerkUse - the single dispatch point every
 * Power's own bespoke mechanic hangs off of, keyed by compendium sourceId exactly like onPerkUse's
 * own if/else chain. Nothing analogous to this existed before (confirmed via project-wide grep,
 * see the essence20 Automation Ledger's "Powers & Spells" pass) - clicking a Power's own activation
 * icon only ever spent its resource cost (sheet-handlers/power-handler.mjs#powerCost) with no hook
 * for anything to actually happen afterward. This file is that hook.
 *
 * Called from power-handler.mjs#powerCost (the fixed-cost and free-to-activate paths) and
 * #_powerCountUpdate (the variable-cost path, reached via apps/power-cost-selector.mjs's own form
 * submit) - in every case AFTER the generic cost-spend has already completed (or confirmed there
 * was nothing to spend), matching onPerkUse's own "the click already resolved affordability, this
 * function only ever runs the actual effect" contract. A Power with no registered handler here
 * silently no-ops, the same as onPerkUse falling through when a Perk's own sourceId isn't in
 * BANKABLE_PERKS/IMMEDIATE_ALLY_PERKS - most of the 49 Grid/Sorcerous Power items the Ledger
 * catalogued "Buildable now" still need their own entry added here, this is the plumbing they all
 * share, not a claim that they're all wired up yet.
 * @param {Actor} actor          The actor activating the Power.
 * @param {Item} item            The Power item itself.
 * @param {Number} [amountSpent] How much Power was actually spent on this activation - the fixed-
 *   cost amount for a fixed-cost Power, 0 for a free one, or whatever the player confirmed in
 *   PowerCostSelector for a variable-cost one. Added 2026-09-10 so variable-cost Powers (Boost
 *   Initiative, Repair Zord) can scale their own effect by the actual spend - both call sites in
 *   power-handler.mjs now pass it through.
 */
export async function onPowerUse(actor, item, amountSpent = 0) {
  if (!actor || !item) {
    return;
  }

  const sourceId = item.flags?.core?.sourceId ?? item._stats?.compendiumSource;

  if (sourceId == SPEED_BOOST_ID) {
    const changed = await applySpeedBoost(item);
    if (changed) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (sourceId == POWER_SHIELD_ID) {
    const changed = await applyPowerShield(item);
    if (changed) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (sourceId == FASTER_REGENERATION_ID) {
    const healAmount = await activateFasterRegeneration(actor);
    if (healAmount != null) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PowerHealNotification', { perk: item.name, actor: actor.name, amount: healAmount }));
    }

    return;
  }

  if (sourceId == BOOST_INITIATIVE_ID) {
    await activateBoostInitiative(actor, amountSpent);
    return;
  }

  if (sourceId == AUGMENT_POWER_WEAPON_ID) {
    const changed = await activateAugmentPowerWeapon(actor);
    if (changed) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (sourceId == PENETRATING_STRIKES_ID) {
    const changed = await activatePenetratingStrikes(actor);
    if (changed) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (sourceId == REPAIR_ZORD_ID) {
    const healAmount = await activateRepairZord(actor, amountSpent);
    if (healAmount > 0) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PowerHealNotification', { perk: item.name, actor: actor.name, amount: healAmount }));
    }

    return;
  }

  if (sourceId == POWER_HEAL_ID) {
    const result = await activatePowerHeal(actor, amountSpent, item.name);
    if (result) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PowerHealNotification', { perk: item.name, actor: result.targetActor.name, amount: result.healAmount }));
    }

    return;
  }

  if (sourceId == GRID_POWER_STRIKE_ID) {
    await activateGridPowerStrike(actor, amountSpent);
    return;
  }

  if (sourceId == POWER_BLAST_ID) {
    await activatePowerBlast(actor, amountSpent);
    return;
  }

  if (sourceId == ZEO_CRYSTAL_BOOST_ID) {
    if (!canUseZeoCrystalBoost(actor)) {
      return;
    }

    const option = await pickZeoCrystalBoostOption();
    if (option) {
      await activateZeoCrystalBoost(actor, option);
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  // Mnemonic Recall (p.100) and Power Transfer (p.101) - both spend Power for a purely narrative
  // effect (recalling a memory; donating Power to another creature/object "an equitable amount,
  // GM's discretion") with nothing further to compute or write - the Power spend itself is already
  // handled generically before this dispatch runs, so these just confirm the activation happened,
  // the same minimal "spend the cost, narrate the rest" idiom already established for e.g. Duty of
  // the Silver's own teleport-destination half.
  if (sourceId == CHRONO_FILE_ACCESS_ID) {
    const content = revealTargetChronoFile(actor);
    if (content) {
      postPerkUseChatCard(actor, content);
    }

    return;
  }

  if (sourceId == WILLFUL_STRENGTH_ID) {
    await activateWillfulStrength(actor);
    return;
  }

  if (sourceId == BLAZING_STRIKES_ID) {
    const changed = await activateBlazingStrikes(actor);
    if (changed) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (sourceId == VOID_WARRIOR_ID) {
    const changed = await activateVoidWarrior(actor);
    if (changed) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (sourceId == REV_YOUR_ENGINES_ID) {
    await activateRevYourEngines(actor, amountSpent);
    return;
  }

  if (sourceId == MORPHBLAST_ID) {
    await activateMorphblast(actor);
    return;
  }

  if (sourceId == MEGAZORD_LINK_ID) {
    await activateMegazordLink(actor);
    return;
  }

  if (sourceId == FUTURE_VISION_ID) {
    await activateFutureVision(item, amountSpent);
    return;
  }

  if (sourceId == MOBILE_MODE_ID) {
    const movementType = await pickMobileModeType();
    if (movementType) {
      await activateMobileMode(actor, movementType);
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (sourceId == METALLIC_ARMOR_ID) {
    const changed = await activateMetallicArmor(actor);
    if (changed) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (sourceId == GRID_EMPOWERED_ID) {
    const applied = await activateGridEmpowered(actor);
    if (applied) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (sourceId == SHATTERED_MEMORIES_ID) {
    const option = await pickShatteredMemoriesOption();
    if (option) {
      const applied = await applyShatteredMemoriesOption(actor, option);
      if (applied) {
        postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
      }
    }

    return;
  }

  if (sourceId == PROTECTION_ID) {
    await toggleProtectionBoost(actor);
    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == AUGMENTED_COMBAT_ID || sourceId == CODENAME_JOLT_ID) {
    await toggleAugmentedCombat(actor);
    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == SWIFTNESS_ID) {
    const movementType = await pickSwiftnessMovementType();
    if (movementType) {
      await toggleSwiftness(actor, movementType);
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (sourceId == REPAIR_MACHINE_ID) {
    await activateRepairMachine(actor);
    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == ELECTRIC_DISCHARGE_ID) {
    await activateElectricDischarge(actor);
    return;
  }

  if (sourceId == DISINTEGRATE_ID) {
    await activateDisintegrate(actor);
    return;
  }

  if (sourceId == REGENERATION_ID) {
    await activateRegeneration(actor);
    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == BOLSTER_DEFENSE_ID) {
    await activateBolsterDefense(actor);
    return;
  }

  if (sourceId == MONSTER_GROW_ID) {
    const result = await activateMonsterGrow(actor);
    if (result != null) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (sourceId == LUCKY_CHARM_ID) {
    await activateLuckyCharm(actor, item);
    return;
  }

  if (sourceId == ILLUSORY_DISGUISE_ID) {
    await activateIllusoryDisguiseRoll(actor);
    return;
  }

  // Longevity (Beneath the Helmet, Grid Power, p.57) - "By spending 1 Personal Power, you can
  // recall facts or rely on a relationship from the past... that would be useful to remember
  // today." Same purely narrative "spend the cost, narrate the rest" shape as Mnemonic Recall/
  // Power Transfer just below.
  if (sourceId == MNEMONIC_RECALL_ID || sourceId == POWER_TRANSFER_ID || sourceId == LONGEVITY_ID) {
    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }
}

// Speed Boost (Power Rangers Core Rulebook, Grid Power, p.101): "As a Free action, spend 1 Power
// to gain +10 Ground Movement and Edge on Initiative Skill Tests for the rest of the scene." The
// compendium item already carries both effects fully and correctly shaped (system.movement.ground.
// morphed +10, system.skills.initiative.edge) - see helpers/speed-boost.mjs's own doc comment for
// why this is a one-way activation (enable the item's own disabled effects) rather than a Power-
// Boost-style toggle: the generic click flow above already spends the cost unconditionally on
// every click (there's no "this click means turn it back off" concept anywhere in that flow, unlike
// a Perk's own onPerkUse which has full control before anything is spent), so modeling this as an
// on/off toggle would double-spend Power on a second click instead of switching off for free. RAW
// itself never describes an explicit "spend to deactivate" step either, so this matches the same
// "approximate duration, no hard enforcement" idiom already accepted project-wide (e.g. Dig In,
// Got To Get Tough) - a GM manually disables the two effects on the item's own sheet once the scene
// ends.
const SPEED_BOOST_ID = "Compendium.essence20.pr_crb.Item.CDbaCheOK2rUsqli";

// The rest of the PR CRB's own Grid Power catalog (p.99-101) - see each helper file's own doc
// comment for RAW text and mechanic shape. Wired 2026-09-10 alongside this file's own amountSpent
// widening above.
const POWER_SHIELD_ID = "Compendium.essence20.pr_crb.Item.F7QPCcXW9822L5Xs";
const FASTER_REGENERATION_ID = "Compendium.essence20.pr_crb.Item.UsZ8twgjWJO5B3R4";
const BOOST_INITIATIVE_ID = "Compendium.essence20.pr_crb.Item.IuQ0tsM2G99fQlSz";
const AUGMENT_POWER_WEAPON_ID = "Compendium.essence20.pr_crb.Item.n7kXeiPmmdg55K1X";
const PENETRATING_STRIKES_ID = "Compendium.essence20.pr_crb.Item.fgufss1xeV96LDcu";
const REPAIR_ZORD_ID = "Compendium.essence20.pr_crb.Item.9S0fkRqxjfiOJ8ip";
const MNEMONIC_RECALL_ID = "Compendium.essence20.pr_crb.Item.jOYqRnHMYz6nETD0";
const POWER_TRANSFER_ID = "Compendium.essence20.pr_crb.Item.QYluNF8M04MmP40d";
const POWER_HEAL_ID = "Compendium.essence20.pr_crb.Item.eiTUR08GXw03M21m";
const GRID_POWER_STRIKE_ID = "Compendium.essence20.pr_crb.Item.DT0TOaHfuJzkgUeO";
const POWER_BLAST_ID = "Compendium.essence20.pr_crb.Item.EeNQjO1VHh1SiNzy";
const ZEO_CRYSTAL_BOOST_ID = "Compendium.essence20.across_the_stars.Item.NiEaLWcx8N48fvvN";
const LONGEVITY_ID = "Compendium.essence20.beneath_the_helmet.Item.2PWhz49B168yOdU6";
const CHRONO_FILE_ACCESS_ID = "Compendium.essence20.jump_through_time.Item.PDOUlIOgO7YoPVvm";
const WILLFUL_STRENGTH_ID = "Compendium.essence20.jump_through_time.Item.8a7YRcCUxcx6KgQl";
const BLAZING_STRIKES_ID = "Compendium.essence20.across_the_stars.Item.hr0SY24JAM7I91qA";
const VOID_WARRIOR_ID = "Compendium.essence20.across_the_stars.Item.gyDCPmqswCQJYN6e";
const REV_YOUR_ENGINES_ID = "Compendium.essence20.jump_through_time.Item.Eu8CsCA470XBEer0";
const MORPHBLAST_ID = "Compendium.essence20.jump_through_time.Item.jPTF96WV19T37AqG";
const MEGAZORD_LINK_ID = "Compendium.essence20.jump_through_time.Item.c7e7enVe96wOikd9";
const FUTURE_VISION_ID = "Compendium.essence20.jump_through_time.Item.z9ZMxCd5DZDHlDYL";
const MOBILE_MODE_ID = "Compendium.essence20.through_the_shattered_grid.Item.TO3TazEeI35FUOOU";
const METALLIC_ARMOR_ID = "Compendium.essence20.through_the_shattered_grid.Item.LotTM0zOcCBLkki4";
const GRID_EMPOWERED_ID = "Compendium.essence20.through_the_shattered_grid.Item.17iN2ZzSaTvqX0PL";
const SHATTERED_MEMORIES_ID = "Compendium.essence20.through_the_shattered_grid.Item.faME3nQl9NjbafOG";
const PROTECTION_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.IF9v9C3tCJSQYRjd";
const AUGMENTED_COMBAT_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.6Ku40JiKZCMbGMtM";
// Codename Jolt: Augmented Combat Nanomite Infusion (Operation Snakebit, p.24) - textually the
// same "↑1 on all attacks" toggle as Augmented Combat above, just Cobra's own nanomite-flavored
// reprint (1 Power, once/scene per its own compendium fields - not separately enforced, same
// "repeat click just toggles state" idiom Augmented Combat itself already accepts).
const CODENAME_JOLT_ID = "Compendium.essence20.operation_snakebit.Item.Q7p4Mn6NN4BL7ARl";
const SWIFTNESS_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.GBsBp9umblOcz7lu";
const REPAIR_MACHINE_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.HOM0e2W0aBYnZ8Z3";
const ELECTRIC_DISCHARGE_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.KeDQbX62owtITKDo";
const DISINTEGRATE_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.mVwWAgFyNUDfoUJQ";
const REGENERATION_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.312ubjCA7mCBDoea";
const BOLSTER_DEFENSE_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.HVOFIDBiXNckFaAP";
const MONSTER_GROW_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.KR4KuZlalNywMvSb";
const LUCKY_CHARM_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.Rv3Bhyeo4XBxHLpX";
const ILLUSORY_DISGUISE_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.7r9RSyoSvZxNx7El";
