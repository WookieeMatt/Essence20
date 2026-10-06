import { postPerkUseChatCard } from "./perks.mjs";
import { rollPowerAttack } from "./attack-powers.mjs";
import { activateZeoCrystalBoost, canUseZeoCrystalBoost, pickZeoCrystalBoostOption } from "../../items/attacks/zeo-crystal-boost.mjs";
import { activateMonsterGrow } from "../../items/forms/monster-grow.mjs";

/**
 * The Power-side equivalent of mechanics/resources/banked-buffs.mjs#canUsePerk - whether the sheet should show
 * a Power's own roll/activation button right now. Unlike canUsePerk (a whole separate "Use"
 * control), a Power has no second icon - the roll-type=power click itself IS the activation
 * (templates/actor/parts/items/power/container.hbs's own roll-button inline) - so this replaces
 * that inline's previous bare `{{#if item.system.canActivate}}` check, folding the static
 * per-item flag in here too rather than needing both checks written out in the template. Most
 * Powers have no further dynamic gate beyond canActivate (this system has no generic once-per-
 * scene enforcement for Powers the way BANKABLE_PERKS' own encounter flags give Perks) - only Zeo
 * Crystal Boost currently needs one, via its own already-existing canUseZeoCrystalBoost. Any future
 * Power needing a dynamic once-per-scene/affordability gate adds its own branch here, the same
 * shape onPowerUse's own dispatch below already establishes.
 * @param {Item} item
 * @returns {Boolean}
 */
export function canUsePower(item) {
  if (item?.type != 'power' || !item.system.canActivate) {
    return false;
  }

  const sourceId = item.flags?.core?.sourceId ?? item._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource;

  if (sourceId == ZEO_CRYSTAL_BOOST_ID) {
    return canUseZeoCrystalBoost(item.parent);
  }

  return true;
}

/**
 * The Power-side equivalent of mechanics/resources/banked-buffs.mjs#onPerkUse - the single dispatch point every
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
export async function onPowerUse(actor, item, amountSpent = 0, { sourceId: sourceIdOverride = null } = {}) {
  if (!actor || !item) {
    return;
  }

  // The Power's own rules: its powerUsed Triggers (rules/plugins/resources/power-used.mjs), @var.spent = amountSpent.
  const { firePowerUsed } = await import("../../rules/plugins/resources/power-used.mjs");
  await firePowerUsed(actor, item, amountSpent);

  // Attack Powers resolve generically, off their own schema, before the per-sourceId chain below -
  // see mechanics/characters/attack-powers.mjs. A Power that both attacks AND needs a bespoke effect would want
  // its own entry below instead; none of the printed ones do.
  if (await rollPowerAttack(actor, item)) {
    return;
  }

  // A Power used straight from a compendium (nanomite equipment - items/gear/nanomite-gear.mjs) has no
  // source flags of its own, so the caller names it.
  const sourceId = sourceIdOverride ?? item.flags?.core?.sourceId ?? item._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource;

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

  // (Chrono-File Access's report is a powerUsed Trigger on the Power - rules/conv17-perm.test.js.)

  if (sourceId == MONSTER_GROW_ID) {
    const result = await activateMonsterGrow(actor);
    if (result != null) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }
}

// The Powers still dispatched here by compendium id (the rest are their items' own powerUsed rules).
const ZEO_CRYSTAL_BOOST_ID = "Compendium.essence20.across_the_stars.Item.NiEaLWcx8N48fvvN";
// (Blazing Strikes is its Power's own powerUsed Trigger, DamageType and sceneStart rules - rules/conv17-split2.test.js.)
const MONSTER_GROW_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.KR4KuZlalNywMvSb";
