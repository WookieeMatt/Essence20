import { bankPendingBonus, hasUsedThisEncounter, markUsedThisEncounter, postPerkUseChatCard } from "./perks.mjs";
import { PENDING_DIG_DEEP_FLAG_KEY } from "./combat.mjs";

/**
 * Dig Deep (PR CRB, General Perk, p.94): "Once per scene, you can ignore 1 damage, but you suffer
 * a Snag on all Skill Tests until the end of your next turn. Once per scene, you can heal 1d2
 * damage by forfeiting your entire turn." Textually identical to WTNV/TF CRB/GI Joe CRB/MLP CRB's
 * own already-built reprints of this same General Perk (see banked-buffs.mjs's own shared
 * DIG_DEEP_ID/DIG_DEEP_TF_ID/DIG_DEEP_GIJ_ID/DIG_DEEP_MLP_ID dispatch) - but PR CRB's own copy
 * needed its own file rather than joining that shared dispatch, because it's the only one of the
 * 5 printings that already had ITS OWN separate build (the heal-by-forfeiting-turn half, via
 * IMMEDIATE_ALLY_PERKS) sitting alongside the still-unbuilt damage-ignore+Snag half. Since this
 * codebase's sheet UI gives one Perk item exactly one "Use" button, merging both RAW clauses -
 * each independently "once per scene" - onto that single button needed the same multi-benefit
 * picker shape Expanded Mysticism's own 3-option Use button already established, rather than
 * either duplicating the shared dispatch (losing the heal half) or leaving the damage half
 * permanently unreachable behind the existing heal-only IMMEDIATE_ALLY_PERKS registration.
 *
 * The damage-ignore+Snag half reuses the exact same already-built, already-tested mechanism the
 * shared dispatch established (combat.mjs's own PENDING_DIG_DEEP_FLAG_KEY + dice.mjs's own
 * unscoped 'pendingDigDeepSnag' consumption) - no new mechanism, just a second entry point onto
 * proven code. The heal half is a straight port of the item's own former IMMEDIATE_ALLY_PERKS
 * config (rollsHeal:'1d2', selfTarget:true).
 */
export const DIG_DEEP_PR_CRB_ID = "Compendium.essence20.pr_crb.Item.eC0iByyLbSHQKY2G";
const DIG_DEEP_PR_CRB_DAMAGE_FLAG = 'digDeepPrCrbDamageUsedThisEncounter';
const DIG_DEEP_PR_CRB_HEAL_FLAG = 'digDeepPrCrbUsedThisEncounter';

/**
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function canUseDigDeepPrCrb(actor) {
  return !hasUsedThisEncounter(actor, DIG_DEEP_PR_CRB_DAMAGE_FLAG) || !hasUsedThisEncounter(actor, DIG_DEEP_PR_CRB_HEAL_FLAG);
}

/**
 * Prompts for which of the 2 benefits to use, listing only the ones still usable this scene -
 * same dynamic-option-list idiom Expanded Mysticism's own benefit picker already established.
 * @param {Actor} actor
 * @returns {Promise<String|null>}
 */
async function pickDigDeepPrCrbBenefit(actor) {
  const options = [];
  if (!hasUsedThisEncounter(actor, DIG_DEEP_PR_CRB_DAMAGE_FLAG)) {
    options.push(['damage', game.i18n.localize('E20.DigDeepBenefitDamage')]);
  }

  if (!hasUsedThisEncounter(actor, DIG_DEEP_PR_CRB_HEAL_FLAG)) {
    options.push(['heal', game.i18n.localize('E20.DigDeepBenefitHeal')]);
  }

  if (options.length == 1) {
    return options[0][0];
  }

  const benefitOptions = options.map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.DigDeepPickBenefitTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.DigDeepPickBenefitLabel')
    }</label><select name="benefit">${benefitOptions}</select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.benefit.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

/**
 * Dispatches to whichever benefit the player picks - see pickDigDeepPrCrbBenefit above.
 * @param {Actor} actor
 * @param {Item} item
 */
export async function activateDigDeepPrCrb(actor, item) {
  const benefit = await pickDigDeepPrCrbBenefit(actor);
  if (benefit == 'damage') {
    await bankPendingBonus(actor, PENDING_DIG_DEEP_FLAG_KEY, { amount: 1 });
    await bankPendingBonus(actor, 'pendingDigDeepSnag', { snag: true });
    await markUsedThisEncounter(actor, DIG_DEEP_PR_CRB_DAMAGE_FLAG);
    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
  } else if (benefit == 'heal') {
    const healAmount = (await new Roll('1d2', actor.getRollData()).evaluate()).total;
    await actor.update({
      'system.health.value': Math.min(actor.system.health.max, actor.system.health.value + healAmount),
    });
    await markUsedThisEncounter(actor, DIG_DEEP_PR_CRB_HEAL_FLAG);
    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
  }
}
