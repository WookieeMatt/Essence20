import {
  registerDerived, registerNamedAction, registerRollSources, registerRoundStart, registerUse,
} from "../../extensions.mjs";
import { activeKits } from "../../kits.mjs";
import { getUses, markUsed } from "../../scene-clock.mjs";
import {
  GIJ, HAWK, T, feetBetween, findSourced, firstTarget, has, isFrom, itemsOf, num, onHook, post, rollDif,
} from "./shared.mjs";

/**
 * Healing: the Core Rules' "restore Health with a Skill Test" as an action anyone can take, and the
 * GI Joe Medic/Hawk's Personnel Files Perks and gear that change it - Peaceable, Hearty Meal,
 * Proper Protection, Stim Dart and the Defibrillator.
 */
export const O2_MED = {
  iveGotYou: GIJ('6wbY17kDGkxeGBPp'),
  properProtection: GIJ('CUV2gVVGb7U7yU5J'),
  stimDart: GIJ('5Gx1CuLTEbjFqV8F'),
  defibrillator: GIJ('IP0hnNhERC4OCc0k'),
  peaceable: HAWK('BHum6Sd6Zz7cra5b'),
  heartyMeal: HAWK('NULhQcWctFcXXdDH'),
};

export const HEAL_ACTION = 'o2Heal';
const HEARTY_MEAL_USE = 'o2HeartyMealHeal';
const STIM_DART_USE = 'o2StimDart';
const DEFIB_FLAG = 'o2Defibrillating';

/** RAW's DIF to restore Health: "5 + (5 per Health you want to restore)" (GI Joe CRB p.210). */
export const restoreDif = amount => 5 + (5 * amount);

/** Every roll this system makes to heal injuries, by the dataset flag that marks it. */
export const HEAL_FLAGS = ['isIveGotYou', 'isMindOverMatter', 'isRegeneration', 'isPatchUp', 'isPreventativeMeasures', 'isToughItOut', 'o2Heal'];

export function isHealingRoll(dataset) {
  return HEAL_FLAGS.some(flag => dataset?.[flag] && dataset[flag] !== 'false');
}

/* -------------------------------------------- */
/*  Peaceable                                    */
/* -------------------------------------------- */

// Peaceable (Hawk's Personnel Files, Influence Perk, p.166): "You gain ↑1 on Skill Tests to heal
// injuries." The Stun-only attack half is in dice.mjs.
registerRollSources((actor, target, ctx) => {
  if (!has(actor, O2_MED.peaceable) || !isHealingRoll(ctx?.dataset)) {
    return { sources: [] };
  }

  return { sources: [{ id: 'o2Peaceable', label: findSourced(actor, O2_MED.peaceable)?.name ?? 'Peaceable', shiftUp: 1 }] };
});

/* -------------------------------------------- */
/*  Proper Protection                            */
/* -------------------------------------------- */

/** "while you have a medicine kit" - a carried Science (Medicine) kit. */
export function hasMedicineKit(actor) {
  return activeKits(actor).some(kit => kit.skill == 'science' && /medic/i.test(kit.spec ?? ''));
}

/**
 * Proper Protection (GI Joe CRB, Medic, 7th level, p.82): "while you have a medicine kit, you are
 * immune to diseases and poisons." The kit gate is why this is derived data rather than the old
 * unconditional Active Effect.
 */
export function properProtectionActive(actor) {
  return has(actor, O2_MED.properProtection) && hasMedicineKit(actor);
}

registerDerived(actor => {
  if (actor?.system?.immunities && properProtectionActive(actor)) {
    actor.system.immunities.poison = true;
    actor.system.immunities.disease = true;
  }
});

// Immune to poison: the Poisoned Condition doesn't land.
onHook('preCreateActiveEffect', (effect) => {
  const actor = effect?.parent;
  const statuses = [...(effect?.statuses ?? effect?._source?.statuses ?? [])];
  if (actor?.documentName == 'Actor' && statuses.includes('poisoned') && properProtectionActive(actor)) {
    ui.notifications?.info?.(T('O2PoisonImmune', { name: actor.name }));
    return false;
  }

  return true;
});

/* -------------------------------------------- */
/*  The Heal action                              */
/* -------------------------------------------- */

/**
 * GI Joe CRB p.210: "as a Standard action, Science Skill Tests can restore Health to living
 * creatures, and Technology Skill Tests can restore Health to machines (including robots) if they
 * are a target within your reach." The skills this actor may heal with right now.
 */
export function healSkills(actor, { inCombat = !!game.combat } = {}) {
  const skills = ['science', 'technology'];
  // Hearty Meal (Hawk's Personnel Files p.174): "once per mission, you can use Culture or
  // Performance in place of Science Skill Tests to heal damage outside of combat."
  if (!inCombat && has(actor, O2_MED.heartyMeal) && getUses(actor, HEARTY_MEAL_USE, 'mission') < 1) {
    skills.push('culture', 'performance');
  }

  return skills;
}

async function healDialog(actor, target) {
  const skillLabel = s => game.i18n.localize(CONFIG.E20?.skills?.[s] ?? s);
  const skills = healSkills(actor);
  const poisoned = !!target.statuses?.has?.('poisoned');
  const content = `
    <p>${T('O2HealWho', { name: target.name })}</p>
    <div class="form-group"><label>${T('O2HealMode')}</label><select name="mode">
      <option value="heal">${T('O2HealModeHealth')}</option>
      ${poisoned ? `<option value="poison">${T('O2HealModePoison')}</option>` : ''}
    </select></div>
    <div class="form-group"><label>${T('O2PickSkill')}</label><select name="skill">
      ${skills.map(s => `<option value="${s}">${skillLabel(s)}</option>`).join('')}
    </select></div>
    <div class="form-group"><label>${game.i18n.localize('E20.IveGotYouPickAmountLabel')}</label>
      <input type="number" name="amount" min="1" max="6" value="1"/></div>
    <div class="form-group"><label>${T('O2PoisonDif')}</label><input type="number" name="dif" min="0" value="15"/></div>`;
  return foundry.applications.api.DialogV2.wait({
    window: { title: T('O2ActionHeal') },
    classes: ["window-app", "e20-window"],
    content,
    buttons: [
      {
        action: 'ok', label: game.i18n.localize('E20.DialogConfirmButton'), default: true,
        callback: (event, button) => ({
          mode: button.form.elements.mode.value,
          skill: button.form.elements.skill.value,
          amount: Math.max(1, Math.min(6, parseInt(button.form.elements.amount.value) || 1)),
          dif: Math.max(0, parseInt(button.form.elements.dif.value) || 0),
        }),
      },
      { action: 'cancel', label: game.i18n.localize('E20.DialogCancelButton') },
    ],
    rejectClose: false,
  }).then(result => (result && result != 'cancel' ? result : null));
}

/** Heal a target by `amount` - I've Got You / Up And At 'Em add their bonuses on a Defeated ally. */
export async function restoreHealth(healer, target, amount) {
  if (has(healer, O2_MED.iveGotYou)) {
    const { applyIveGotYouHeal } = await import("../../i-ve-got-you.mjs");
    return applyIveGotYouHeal(target, amount, healer);
  }

  const { applyHealSkillTestResult } = await import("../../heal-skill-test.mjs");
  return applyHealSkillTestResult(target, amount);
}

export async function healAction(actor) {
  const target = firstTarget() ?? actor;
  const distance = target.id == actor.id ? 0 : feetBetween(actor, target);
  if (distance != null && distance > 5) {
    ui.notifications?.warn?.(T('O2NeedTouch'));
    return { cancelled: true };
  }

  const choice = await healDialog(actor, target);
  if (!choice) {
    return { cancelled: true };
  }

  if (['culture', 'performance'].includes(choice.skill)) {
    await markUsed(actor, HEARTY_MEAL_USE, { window: 'mission' });
  }

  if (choice.mode == 'poison') {
    const { success } = await rollDif(actor, choice.skill, choice.dif, { o2Heal: true });
    if (!success) {
      return { message: T('O2HealFailed', { name: actor.name, target: target.name }) };
    }

    await target.toggleStatusEffect?.('poisoned', { active: false });
    // Proper Protection: "When you help an ally recover from disease or poison, a successful Skill
    // Test upgrades to a critical success."
    const crit = has(actor, O2_MED.properProtection) ? ` ${T('O2ProperProtectionCrit')}` : '';
    return { message: T('O2PoisonCured', { name: actor.name, target: target.name }) + crit };
  }

  const { success } = await rollDif(actor, choice.skill, restoreDif(choice.amount), { o2Heal: true });
  if (!success) {
    return { message: T('O2HealFailed', { name: actor.name, target: target.name }) };
  }

  await restoreHealth(actor, target, choice.amount);
  return { message: T('O2Healed', { name: actor.name, target: target.name, amount: choice.amount }) };
}

registerNamedAction(HEAL_ACTION, healAction);

// The action on the Actions tab (E20.namedActions is what the tab lists).
globalThis.Hooks?.once?.('i18nInit', () => {
  const actions = CONFIG.E20?.namedActions;
  if (actions && !actions[HEAL_ACTION]) {
    actions[HEAL_ACTION] = { label: T('O2ActionHeal'), type: 'standard' };
  }
});

/* -------------------------------------------- */
/*  Stim Dart                                    */
/* -------------------------------------------- */

/**
 * Stim Dart (GI Joe CRB, Medic, 15th level, p.82): "The launcher has a range of 20 feet, and firing
 * it requires a Targeting attack roll if used at range, but no roll if used on an adjacent ally or
 * yourself. When applied to a conscious ally or to yourself, the dart grants 2 Temporary Health.
 * When applied to a Defeated ally or yourself (through Self-Revive), the defeated character
 * regains 2 Health in addition to benefits from I've Got You and Up and At 'Em. You may requisition
 * additional darts as a prototype upgrade to your medicine kit." One dart per mission, plus one for
 * each extra dart Item carried.
 */
export function stimDartsLeft(actor) {
  const extra = itemsOf(actor).filter(item => /stim dart/i.test(item.name ?? '') && item.type != 'perk').length;
  return 1 + extra - getUses(actor, STIM_DART_USE, 'mission');
}

registerUse({
  id: 'o2StimDart',
  matches: isFrom(O2_MED.stimDart),
  canUse: item => stimDartsLeft(item.parent) > 0,
  async run(item, economy, pay) {
    const actor = item.parent;
    const target = firstTarget() ?? actor;
    const distance = target.id == actor.id ? 0 : feetBetween(actor, target);
    if (distance != null && distance > 20) {
      ui.notifications?.warn?.(T('O2OutOfRange', { range: 20 }));
      return null;
    }

    if (!(await pay('standard'))) {
      return null;
    }

    await markUsed(actor, STIM_DART_USE, { window: 'mission' });
    if (distance != null && distance > 5) {
      const { success } = await rollDif(actor, 'targeting', num(target.system?.defenses?.evasion?.total));
      if (!success) {
        return T('O2StimDartMissed', { name: actor.name, target: target.name });
      }
    }

    if (target.statuses?.has?.('defeated')) {
      await restoreHealth(actor, target, 2);
      return T('O2StimDartRevived', { name: actor.name, target: target.name });
    }

    await target.update({ 'system.health.bonus': num(target.system?.health?.bonus) + 2 });
    return T('O2StimDartBoost', { name: actor.name, target: target.name });
  },
});

/* -------------------------------------------- */
/*  Defibrillator                                */
/* -------------------------------------------- */

/**
 * Defibrillator (GI Joe CRB p.162): "A single use resuscitation device, this item can be used by an
 * untrained character to grant 1 Health to a Defeated character. Doing so requires 30 seconds (6
 * combat rounds) of operation." Out of combat it is simply done.
 */
async function useUpDefibrillator(actor, itemId) {
  const item = actor?.items?.get?.(itemId);
  if (!item) {
    return;
  }

  if (num(item.system?.quantity) > 1) {
    await item.update({ 'system.quantity': num(item.system.quantity) - 1 });
  } else {
    await item.delete();
  }
}

async function finishDefibrillator(actor, record) {
  const target = await fromUuid(record.targetUuid);
  if (target?.statuses?.has?.('defeated')) {
    const { applyHealSkillTestResult } = await import("../../heal-skill-test.mjs");
    await applyHealSkillTestResult(target, 1);
    await post(actor, T('O2DefibDone', { name: actor.name, target: target.name }));
  }

  await useUpDefibrillator(actor, record.itemId);
}

registerUse({
  id: 'o2Defibrillator',
  matches: isFrom(O2_MED.defibrillator),
  canUse: item => !item.parent?.flags?.essence20?.[DEFIB_FLAG],
  async run(item, economy, pay) {
    const actor = item.parent;
    const target = firstTarget();
    if (!target?.statuses?.has?.('defeated')) {
      ui.notifications?.warn?.(T('O2NeedDefeatedTarget'));
      return null;
    }

    const combat = game.combat;
    if (!combat) {
      await finishDefibrillator(actor, { targetUuid: target.uuid, itemId: item.id });
      return null;
    }

    if (!(await pay('standard'))) {
      return null;
    }

    await actor.setFlag('essence20', DEFIB_FLAG, { targetUuid: target.uuid, itemId: item.id, combatId: combat.id, readyRound: combat.round + 6 });
    return T('O2DefibStarted', { name: actor.name, target: target.name, round: combat.round + 6 });
  },
});

/** Whose Defibrillator has run its six rounds. */
export function defibrillatorReady(record, combat) {
  return !!record && !!combat && record.combatId == combat.id && combat.round >= record.readyRound;
}

registerRoundStart(async (combat) => {
  for (const combatant of combat?.combatants ?? []) {
    const actor = combatant.actor;
    const record = actor?.flags?.essence20?.[DEFIB_FLAG];
    if (!record) {
      continue;
    }

    if (record.combatId != combat.id) {
      await actor.unsetFlag('essence20', DEFIB_FLAG);
    } else if (defibrillatorReady(record, combat)) {
      await actor.unsetFlag('essence20', DEFIB_FLAG);
      await finishDefibrillator(actor, record);
    }
  }
});
