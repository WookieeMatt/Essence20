import { postPerkUseChatCard } from "./perks.mjs";
import { isAttackPower, rollPowerAttack } from "./attack-powers.mjs";
import { powerGateOpen } from "../../rules/plugins/resources/power-gate.mjs";
import { activateMonsterGrow } from "../../items/forms/monster-grow.mjs";

/**
 * The Power-side equivalent of mechanics/resources/banked-buffs.mjs#canUsePerk - whether the sheet should show
 * a Power's own roll/activation button right now. Unlike canUsePerk (a whole separate "Use"
 * control), a Power has no second icon - the roll-type=power click itself IS the activation
 * (templates/actor/parts/items/power/container.hbs's own roll-button inline) - so this replaces
 * that inline's previous bare `{{#if item.system.canActivate}}` check, folding the static
 * per-item flag in here too rather than needing both checks written out in the template. Most
 * Powers have no further dynamic gate beyond canActivate; one that does carries a PowerGate rule
 * (rules/plugins/resources/power-gate.mjs - Zeo Crystal Boost's once per scene).
 * @param {Item} item
 * @returns {Boolean}
 */
export function canUsePower(item) {
  if (item?.type != 'power' || !item.system.canActivate) {
    return false;
  }

  return powerGateOpen(item);
}

const escape = text => String(text ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

/**
 * The "Power used" chat card: who used which Power. Its flags are what animation modules read:
 * - `powerUsed`: the card is a Power's use (Essence20 FX hands the Power to Automated Animations itself, so it has
 *   Automated Animations skip these cards rather than play them twice - essence20-fx's aa-bridge.mjs);
 * - `itemUuid` + `tokenUuid`: the Power and the user's token - what Automated Animations' handling for a system it
 *   has no support of its own for looks up to play the Power's animation (its own AA settings, or its name in Automatic
 *   Recognition). An attack Power's card leaves the Power off: its attack roll card carries it, and the animation
 *   belongs to the attack (else it plays twice).
 * @param {Actor} actor
 * @param {Item} item       The Power.
 * @param {Object} [options]
 * @param {Object} [options.speaker]   ChatMessage.getSpeaker's result.
 * @param {String} [options.tokenUuid] The user's token on the scene, if any.
 * @returns {Object}  ChatMessage data
 */
export function powerUsedCardData(actor, item, { speaker = {}, tokenUuid = null } = {}) {
  const text = game.i18n.format('E20.PowerUsedCard', { actor: escape(actor?.name), power: escape(item?.name) });
  return {
    speaker,
    content: `<p class="e20-power-used">${text}</p>`,
    flags: {
      essence20: {
        powerUsed: true,
        ...(isAttackPower(item) || !item?.uuid ? {} : { itemUuid: item.uuid }),
        ...(tokenUuid ? { tokenUuid } : {}),
      },
    },
  };
}

/** The actor's token on the scene: an unlinked token's own, else the first of its active tokens. */
function tokenUuidOf(actor) {
  return actor?.token?.uuid ?? actor?.getActiveTokens?.()?.[0]?.document?.uuid ?? null;
}

/** Post the Power used card (powerUsedCardData). A card that can't be posted never stops the Power. */
async function postPowerUsedCard(actor, item) {
  try {
    const speaker = globalThis.ChatMessage?.getSpeaker?.({ actor }) ?? {};
    await globalThis.ChatMessage?.create?.(powerUsedCardData(actor, item, { speaker, tokenUuid: tokenUuidOf(actor) }));
  } catch (error) {
    console.warn('Essence20 | Power used card', error);
  }
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
 * was nothing to spend), matching onPerkUse's own contract: the click has already settled
 * affordability, and this function only runs the effect. A Power with no registered handler here
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

  // Said in chat first, so the card sits above whatever the Power does (and animation modules can see it).
  await postPowerUsedCard(actor, item);

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

  // (Zeo Crystal Boost is its Power's own PowerGate, powerUsed Trigger and bonus rules - rules/conv18-convB.test.js.)

  // (Chrono-File Access's report is a powerUsed Trigger on the Power - rules/conv17-perm.test.js.)

  // Power Shield (PR CRB p.100): the shield appears on the summoner, ready to hand on - items/defenses/power-shield.mjs.
  if (sourceId == POWER_SHIELD_ID) {
    const { summonShield } = await import("../../items/defenses/power-shield.mjs");
    await summonShield(actor, item);
    return;
  }

  if (sourceId == MONSTER_GROW_ID) {
    const result = await activateMonsterGrow(actor);
    if (result != null) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }
}

// The Powers still dispatched here by compendium id (the rest are their items' own powerUsed rules).
// (Blazing Strikes is its Power's own powerUsed Trigger, DamageType and sceneStart rules - rules/conv17-split2.test.js.)
const MONSTER_GROW_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.KR4KuZlalNywMvSb";
const POWER_SHIELD_ID = "Compendium.essence20.pr_crb.Item.F7QPCcXW9822L5Xs";
