import {
  registerApplyDialog, registerChatButton, registerDefenseAdjust, registerDerived, registerDialogToggles, registerHitRider,
  registerPostRoll, registerPreRoll, registerRollSources, registerTurnEnd, registerTurnStart, registerUse,
} from "../../extensions.mjs";
import { getNearbyAllyTokens } from "../../allies.mjs";
import { getNearbyEnemyTokens } from "../../enemies.mjs";
import { getSceneEpoch, getUses, markUsed } from "../../scene-clock.mjs";
import {
  TF1, T, applyCondition, chooseSelect, combatStamp, damageButton, favoriteWeaponOf, firstTarget, has, isDefeated,
  itemOf, itemsOf, nameOf, onDamageButton, rollAgainst, safe, say, sourceOf, spendEnergon, tokenOf, tokensNear,
  weaponOfEffect,
} from "./common.mjs";

/**
 * Decepticon Directive combat Perks and gear: Brutal Display, Make An Example, Fearsome Voice, Comms
 * Assault, Focused Blast, Steady Firepower, Target-Rich Environment, My Allies Are My Shield,
 * Fearsome Additions, the Show Respect Hang-Up and Easy In, Easy Out's longer Disappear.
 */

// Rounds a "full minute" lasts (a round is about 6 seconds).
const MINUTE_ROUNDS = 10;

/* -------------------------------------------- */
/*  Roll sources                                 */
/* -------------------------------------------- */

const isRamLike = item => item?.type == 'weaponEffect'
  && (!!item.system?.isRam || !!item.system?.isFlyby || /\b(ram|slam|flyby)\b/i.test(item.name ?? ''));

export function tf1CombatSources(actor, target, { item, rolledSkill } = {}) {
  const sources = [];
  // Fearsome Additions (Decepticon Directive p.76): "Alt Mode: Spikes, blades, and flame-belching
  // vents grant ↑1 to your Flyby, Ram, or Slam attack. Bot Mode: You gain a ↑1 on Intimidation
  // Skill Tests."
  const additions = itemOf(actor, TF1.fearsomeAdditions);
  if (additions) {
    const transformed = !!actor.system?.isTransformed;
    if ((transformed && isRamLike(item)) || (!transformed && rolledSkill == 'intimidation')) {
      sources.push({ id: 'fearsomeAdditions', label: additions.name, shiftUp: 1 });
    }
  }

  return { sources, consumes: [] };
}

/* -------------------------------------------- */
/*  Focused Blast                                */
/* -------------------------------------------- */

// Focused Blast (Decepticon Directive, Thunderblast, 3rd level, p.46): "you can choose to forgo a
// weapon's blast area of effect to gain a ↑1 to the attack or to deal +1 damage with that weapon."
const isArea = item => !!(item?.system?.shape || Number(item?.system?.radius) > 0);
const focusedDamage = new Map();

export function tf1CombatToggles(actor, { item } = {}) {
  if (item?.type != 'weaponEffect' || !isArea(item) || !has(actor, TF1.focusedBlast)) {
    return [];
  }

  return [{
    name: 'tf1FocusedBlast', type: 'select', label: nameOf(actor, TF1.focusedBlast, 'Focused Blast'),
    options: [
      { value: '', label: T('Tf1FocusedBlastNone') },
      { value: 'up', label: T('Tf1FocusedBlastUp') },
      { value: 'damage', label: T('Tf1FocusedBlastDamage') },
    ],
  }];
}

export async function tf1CombatApplyDialog(actor, options) {
  const choice = options.ext?.tf1FocusedBlast;
  focusedDamage.delete(actor?.id);
  if (choice == 'up') {
    options.shiftUp = (options.shiftUp ?? 0) + 1;
  } else if (choice == 'damage') {
    focusedDamage.set(actor.id, true);
  }
}

/* -------------------------------------------- */
/*  Steady Firepower / Defenses                  */
/* -------------------------------------------- */

const STEADY_FLAG = 'tf1SteadyFire';

/**
 * Steady Firepower (Decepticon Directive, Quake, 6th level, p.47): "your attacks with your favorite
 * weapon treat your targets' Defenses as cumulatively 1 lower for each subsequent attack made against
 * the same target." My Allies Are My Shield (Field Commander, 20th level, p.43): "you gain +1 to your
 * Defenses for every ally within 30 feet", less whatever was traded for Movement this turn.
 */
export function tf1DefenseAdjust(attacker, defender, defenseType, { item } = {}) {
  let adjust = 0;
  const steady = attacker?.flags?.essence20?.[STEADY_FLAG];
  const favorite = favoriteWeaponOf(attacker);
  if (steady && favorite && defender?.uuid && steady.target == defender.uuid && steady.scene == safe(getSceneEpoch)
    && has(attacker, TF1.steadyFirepower) && weaponOfEffect(attacker, item)?.id == favorite.id) {
    adjust -= Number(steady.count) || 0;
  }

  if (has(defender, TF1.myAlliesAreMyShield)) {
    const allies = safe(() => getNearbyAllyTokens(defender, 30).length, 0);
    adjust += Math.max(0, allies - shieldTraded(defender));
  }

  return adjust;
}

const SHIELD_FLAG = 'tf1ShieldTrade';

export function shieldTraded(actor) {
  const trade = actor?.flags?.essence20?.[SHIELD_FLAG];
  return trade && trade.combatId == game?.combat?.id ? Number(trade.n) || 0 : 0;
}

// My Allies Are My Shield: "As a Free action, you can reduce this bonus by 1 to grant yourself an
// extra 10 feet of Movement." Lasts until the start of the holder's next turn.
export function tf1Derived(actor) {
  const n = shieldTraded(actor);
  if (!n) {
    return;
  }

  for (const mode of ['ground', 'aerial', 'swim', 'climb']) {
    const movement = actor.system?.movement?.[mode];
    if (movement && Number(movement.total) > 0) {
      movement.total += 10 * n;
    }
  }
}

/* -------------------------------------------- */
/*  After the roll                               */
/* -------------------------------------------- */

const isCritResult = (result, isCrit) => (Number(result?.multiplier) || 0) >= 2 || (!!isCrit && !!result?.success);

export async function tf1CombatPostRoll(actor, results, checkContext, { hits = [], isCrit = false, rider = {} } = {}) {
  focusedDamage.delete(actor?.id);
  const kind = rider.spec?.kind;
  const landed = hits.filter(h => h.hit);

  // Brutal Display (Decepticon Directive, Beast Warrior, 20th level, p.58): "On a success, the target
  // is Frightened until the end of their next turn; a Critical Success extends the condition to last a
  // full minute."
  if (kind == 'tf1Brutal') {
    for (const { result, target } of landed) {
      await applyCondition(target, 'frightened', isCritResult(result, isCrit) ? MINUTE_ROUNDS : 1);
    }
  }

  // Make An Example (Tyrant, 6th level, p.44) uses Fearsome Voice: "(Stun 1); Critical Effect: Target
  // is Frightened until the end of their next turn."
  if (kind == 'tf1Voice' && landed.length) {
    const buttons = [];
    for (const { result, target } of landed) {
      buttons.push(damageButton(target, 1, 'stun'));
      if (isCritResult(result, isCrit)) {
        await applyCondition(target, 'frightened', 1);
      }
    }

    await say(actor, `${T('Tf1VoiceHits', { name: actor.name })}<br>${buttons.join('<br>')}`);
  }

  // Comms Assault (Infiltrator Analyst, 17th level, p.40): "This attack inflicts 1 Electromagnetic
  // damage and imposes the Stunned Condition on the target until the end of their next turn."
  if (kind == 'tf1Comms' && landed.length) {
    const buttons = [];
    for (const { target } of landed) {
      buttons.push(damageButton(target, 1, 'emp'));
      await applyCondition(target, 'stunned', 1);
    }

    await say(actor, `${T('Tf1CommsHits', { name: actor.name })}<br>${buttons.join('<br>')}`);
  }

  // Steady Firepower: count consecutive attacks with the favorite weapon at the same target.
  if (has(actor, TF1.steadyFirepower) && checkContext?.isAttack !== false && rider.weaponId) {
    const favorite = favoriteWeaponOf(actor);
    const targets = [...new Set(hits.map(h => h.target?.uuid).filter(Boolean))];
    const before = actor.flags?.essence20?.[STEADY_FLAG];
    const scene = safe(getSceneEpoch);
    let next = null;
    if (favorite && rider.weaponId == favorite.id && targets.length == 1) {
      const same = before?.target == targets[0] && before?.scene == scene;
      next = { target: targets[0], count: same ? (Number(before.count) || 0) + 1 : 1, scene };
    }

    if (next) {
      await actor.setFlag('essence20', STEADY_FLAG, next);
    } else if (before) {
      await actor.unsetFlag('essence20', STEADY_FLAG);
    }
  }

  // Show Respect (Decepticon Directive, Hang-Up, p.31): "Whenever a foe rolls a Critical Success on an
  // Attack Skill Test, you must salute and not attack that foe on your following turn unless they are
  // the only foe present."
  if (isCrit && hits.length && rider.style && game?.combat) {
    await noteRespect(actor);
  }
}

// Focused Blast's +1 damage lands on each hit.
export async function tf1CombatHitRider(actor, target, result, rider, tools) {
  if (focusedDamage.get(actor?.id) && result?.damageValue) {
    tools.damageBonusNote(result, 1, nameOf(actor, TF1.focusedBlast, 'Focused Blast'));
  }

  // Fearsome Voice's own attack: "Critical Effect: Target is Frightened until the end of their next
  // turn."
  const effect = rider?.itemUuid ? safe(() => fromUuidSync(rider.itemUuid)) : null;
  if (effect?.flags?.essence20?.tf1FearsomeVoice && isCritResult(result, tools?.isCrit)) {
    await applyCondition(target, 'frightened', 1);
  }
}

/* -------------------------------------------- */
/*  Show Respect                                 */
/* -------------------------------------------- */

const RESPECT_FLAG = 'tf1Respect';

async function noteRespect(attacker) {
  const attackerToken = tokenOf(attacker);
  for (const combatant of game.combat.combatants ?? []) {
    const holder = combatant.actor;
    if (!holder || holder.id == attacker.id || !has(holder, TF1.showRespect)) {
      continue;
    }

    const holderToken = combatant.token?.object ?? tokenOf(holder);
    if (attackerToken && holderToken && attackerToken.document?.disposition == holderToken.document?.disposition) {
      continue;
    }

    const record = holder.flags?.essence20?.[RESPECT_FLAG] ?? {};
    const pending = [...new Set([...(record.pending ?? []), attacker.uuid])];
    const { needsGmRelay, relayToGm } = await import("../../gm-relay.mjs");
    const value = { ...record, pending };
    if (needsGmRelay(holder)) {
      await relayToGm(holder, 'setFlag', ['essence20', RESPECT_FLAG, value]);
    } else {
      await holder.setFlag('essence20', RESPECT_FLAG, value);
    }

    await say(holder, T('Tf1ShowRespect', { name: holder.name, foe: attacker.name, hangUp: nameOf(holder, TF1.showRespect, 'Show Respect') }));
  }
}

export async function respectTurnStart(actor) {
  const record = actor?.flags?.essence20?.[RESPECT_FLAG];
  if (record?.pending?.length || record?.active?.length) {
    await actor.setFlag('essence20', RESPECT_FLAG, { pending: [], active: record.pending ?? [] });
  }
}

export async function respectTurnEnd(actor) {
  const record = actor?.flags?.essence20?.[RESPECT_FLAG];
  if (record?.active?.length) {
    await actor.setFlag('essence20', RESPECT_FLAG, { pending: record.pending ?? [], active: [] });
  }
}

/** Show Respect: a reminder when the holder attacks a foe they must salute this turn. */
export function respectWarning(actor, item) {
  const active = actor?.flags?.essence20?.[RESPECT_FLAG]?.active ?? [];
  if (!active.length || item?.type != 'weaponEffect') {
    return null;
  }

  const foes = safe(() => getNearbyEnemyTokens(actor, Infinity).length, 0);
  const target = firstTarget()?.actor;
  return target && active.includes(target.uuid) && foes > 1 ? target : null;
}

/* -------------------------------------------- */
/*  Easy In, Easy Out                            */
/* -------------------------------------------- */

// Easy In, Easy Out (Demolitionist, 17th level, p.54): "when you spend an Energon Point to turn
// invisible using your Cybertronian Perk, you remain invisible until the beginning of your next
// turn." Disappear (TF CRB p.85) itself has no automatic end in this system; for this Perk's holder
// the invisibility is stamped when it starts and taken off at the start of their next turn.
const EASY_FLAG = 'tf1EasyInvisible';

export async function easyOnEffect(effect, userId) {
  const actor = effect?.parent;
  if (userId != game.user?.id || !effect?.statuses?.has?.('invisible') || !actor?.setFlag
    || !has(actor, TF1.easyInEasyOut) || !has(actor, TF1.disappear) || !game.combat) {
    return;
  }

  await actor.setFlag('essence20', EASY_FLAG, combatStamp());
}

export async function easyTurnStart(actor, combat) {
  const stamp = actor?.flags?.essence20?.[EASY_FLAG];
  if (!stamp) {
    return;
  }

  const sameTurn = stamp.combatId == combat?.id && stamp.round == combat?.round && stamp.turn == combat?.turn;
  if (sameTurn) {
    return;
  }

  await actor.unsetFlag('essence20', EASY_FLAG);
  if (actor.statuses?.has?.('invisible')) {
    await actor.toggleStatusEffect('invisible', { active: false });
    await say(actor, T('Tf1EasyInEnds', { name: actor.name, perk: nameOf(actor, TF1.easyInEasyOut, 'Easy In, Easy Out') }));
  }
}

/* -------------------------------------------- */
/*  Use buttons                                  */
/* -------------------------------------------- */

function defeatedTarget() {
  const token = firstTarget();
  if (!token?.actor || !isDefeated(token.actor)) {
    ui.notifications.warn(T('Tf1TargetDefeated'));
    return null;
  }

  return token;
}

export const COMBAT_USES = [
  {
    // Fearsome Voice (Tyrant, 1st level, p.44): "Fearsome Voice (Intimidation vs. Willpower): Range
    // 20ft/60ft (Stun 1); Critical Effect: Target is Frightened until the end of their next turn."
    id: 'tf1FearsomeVoice', matches: item => sourceOf(item) == TF1.fearsomeVoice,
    canUse: item => !itemsOf(item.parent).some(i => i.flags?.essence20?.grantedBy == item.id),
    async run(item) {
      const id = foundry.utils.randomID();
      await item.parent.createEmbeddedDocuments('Item', [
        { _id: id, name: item.name, type: 'weapon', system: { classification: { size: 'sidearm' }, availability: 'standard', equipped: true, hardpoint: { type: 'none' } }, flags: { essence20: { grantedBy: item.id, natural: true } } },
        {
          name: item.name, type: 'weaponEffect',
          system: { classification: { skill: 'intimidation', style: 'energy' }, damageType: 'stun', damageValue: 1, defenseType: 'willpower', numTargets: 1, numHands: 0, range: { value: 20, long: 60 } },
          flags: { essence20: { parentId: id, tf1FearsomeVoice: true } },
        },
      ], { keepId: true });
      return T('Tf1Granted', { name: item.parent.name, item: item.name });
    },
  },
  {
    // Make An Example (Tyrant, 6th level, p.44): "after Defeating a creature, you can spend a Free
    // action to immediately perform a special version of your Fearsome Voice attack that targets all
    // foes within 30 feet of the Defeated creature with a single Skill Test."
    id: 'tf1MakeAnExample', matches: item => sourceOf(item) == TF1.makeAnExample,
    async run(item, economy, pay) {
      const actor = item.parent;
      const fallen = defeatedTarget();
      if (!fallen) {
        return null;
      }

      const own = tokenOf(actor);
      const foes = tokensNear(fallen, 30, t => t !== own && (!own || t.document?.disposition != own.document?.disposition) && !isDefeated(t.actor));
      if (!foes.length) {
        ui.notifications.warn(T('Tf1NoFoes'));
        return null;
      }

      if (!(await pay('free'))) {
        return null;
      }

      await rollAgainst(actor, foes, { skill: 'intimidation', defenseType: 'willpower', kind: 'tf1Voice' });
      return T('Tf1MadeExample', { name: actor.name, fallen: fallen.name, count: foes.length });
    },
  },
  {
    // Brutal Display (Beast Warrior, 20th level, p.58): "when you Defeat a foe with an unarmed combat
    // attack, you can spend an Energon Point to tear off one of the foe's limbs ... attempt an
    // Intimidation Skill Test, comparing the result to the Willpower Defense of every one of the foe's
    // allies within 100 feet who can see you."
    id: 'tf1BrutalDisplay', matches: item => sourceOf(item) == TF1.brutalDisplay,
    async run(item) {
      const actor = item.parent;
      const fallen = defeatedTarget();
      if (!fallen) {
        return null;
      }

      const own = tokenOf(actor);
      const allies = tokensNear(own ?? fallen, 100, t => t !== fallen && t.document?.disposition == fallen.document?.disposition && !isDefeated(t.actor));
      if (!allies.length) {
        ui.notifications.warn(T('Tf1NoFoes'));
        return null;
      }

      if (!(await spendEnergon(actor, 1))) {
        return null;
      }

      await rollAgainst(actor, allies, { skill: 'intimidation', defenseType: 'willpower', kind: 'tf1Brutal' });
      return T('Tf1BrutalDone', { name: actor.name, fallen: fallen.name, count: allies.length });
    },
  },
  {
    // Comms Assault (Infiltrator Analyst, 17th level, p.40): "By spending an Energon Point and a Standard
    // action, you can blast all non-allied communications receivers within 100 feet with a
    // Technology-based attack versus either a DIF 14 or the target's Toughness Defense (ignoring
    // bonuses provided by armor)."
    id: 'tf1CommsAssault', matches: item => sourceOf(item) == TF1.commsAssault,
    async run(item, economy, pay) {
      const actor = item.parent;
      const foes = safe(() => getNearbyEnemyTokens(actor, 100), []).filter(t => !isDefeated(t.actor));
      if (!foes.length) {
        ui.notifications.warn(T('Tf1NoFoes'));
        return null;
      }

      if ((Number(actor.system?.energon?.normal?.value) || 0) < 1) {
        ui.notifications.warn(T('Tf1NoEnergon', { name: actor.name }));
        return null;
      }

      if (!(await pay('standard')) || !(await spendEnergon(actor, 1))) {
        return null;
      }

      ignoringArmor.add(actor.id);
      try {
        await rollAgainst(actor, foes, { skill: 'technology', defenseType: 'toughness', kind: 'tf1Comms' });
      } finally {
        ignoringArmor.delete(actor.id);
      }

      return T('Tf1CommsDone', { name: actor.name, count: foes.length });
    },
  },
  {
    // Target-Rich Environment (Quake, 20th level, p.47): "once per scene, you can spend a Story Point
    // to make a single attack with your favorite weapon against every enemy within normal range. This
    // requires ... an entire turn's worth of actions."
    id: 'tf1TargetRich', matches: item => sourceOf(item) == TF1.targetRichEnvironment,
    canUse: item => !!favoriteWeaponOf(item.parent) && getUses(item.parent, 'tf1TargetRich', 'scene') < 1,
    async run(item, economy, pay) {
      const actor = item.parent;
      const weapon = favoriteWeaponOf(actor);
      const effects = itemsOf(actor).filter(i => i.type == 'weaponEffect' && i.flags?.essence20?.parentId == weapon?.id);
      if (!weapon || !effects.length) {
        ui.notifications.warn(T('Tf1NoFavorite'));
        return null;
      }

      const effectId = effects.length > 1
        ? await chooseSelect(item.name, T('Tf1PickAttack'), effects.map(e => ({ value: e.id, label: e.name })))
        : effects[0].id;
      const effect = effects.find(e => e.id == effectId);
      if (!effect) {
        return null;
      }

      const range = Number(effect.system?.range?.value) || 5 * Math.max(1, Number(effect.system?.range?.reachMultiplier) || 1);
      const foes = safe(() => getNearbyEnemyTokens(actor, range), []).filter(t => !isDefeated(t.actor));
      if (!foes.length) {
        ui.notifications.warn(T('Tf1NoFoes'));
        return null;
      }

      const { canSpendForActor, spendForActor } = await import("../../story-points.mjs");
      if (!canSpendForActor(actor, 1)) {
        ui.notifications.warn(T('Tf1NoStoryPoint'));
        return null;
      }

      if (!(await pay('wholeTurn'))) {
        return null;
      }

      await spendForActor(actor, 1);
      await markUsed(actor, 'tf1TargetRich', { window: 'scene' });
      canvas?.tokens?.setTargets?.(foes.map(t => t.id));
      await effect.roll({ bypassEconomy: true });
      return T('Tf1TargetRichDone', { name: actor.name, count: foes.length, weapon: weapon.name });
    },
  },
  {
    // My Allies Are My Shield: trade 1 of the Defense bonus for 10 more feet of Movement (Free).
    id: 'tf1ShieldTrade', matches: item => sourceOf(item) == TF1.myAlliesAreMyShield,
    canUse: () => !!game?.combat,
    async run(item, economy, pay) {
      const actor = item.parent;
      const allies = safe(() => getNearbyAllyTokens(actor, 30).length, 0);
      const traded = shieldTraded(actor);
      if (traded >= allies) {
        ui.notifications.warn(T('Tf1ShieldNoBonus'));
        return null;
      }

      if (!(await pay('free'))) {
        return null;
      }

      await actor.setFlag('essence20', SHIELD_FLAG, { combatId: game.combat.id, n: traded + 1 });
      return T('Tf1ShieldTraded', { name: actor.name, n: traded + 1, feet: 10 * (traded + 1) });
    },
  },
];

// Comms Assault's "ignoring bonuses provided by armor": while its roll is being made, the targets'
// Toughness is read without their armor.
const ignoringArmor = new Set();

export function armorOf(defender) {
  const base = Number(defender?.system?.defenses?.toughness?.armor) || 0;
  const worn = itemsOf(defender).filter(i => i.type == 'armor' && i.system?.equipped)
    .reduce((sum, armor) => sum + (parseInt(armor.system?.totalBonusToughness) || 0), 0);
  return base + worn;
}

export function commsArmorAdjust(attacker, defender, defenseType) {
  return defenseType == 'toughness' && ignoringArmor.has(attacker?.id) ? -armorOf(defender) : 0;
}

/* -------------------------------------------- */
/*  Registration                                 */
/* -------------------------------------------- */

registerRollSources(tf1CombatSources);
registerDialogToggles(tf1CombatToggles);
registerApplyDialog(tf1CombatApplyDialog);
registerDefenseAdjust(tf1DefenseAdjust);
registerDefenseAdjust(commsArmorAdjust);
registerDerived(tf1Derived);
registerPostRoll(tf1CombatPostRoll);
registerHitRider(tf1CombatHitRider);
registerChatButton('tf1Damage', onDamageButton);
COMBAT_USES.forEach(registerUse);

registerPreRoll((actor, dataset, item) => {
  const foe = respectWarning(actor, item);
  if (foe) {
    ui.notifications.warn(T('Tf1RespectWarn', { name: actor.name, foe: foe.name }));
  }
});

registerTurnStart(async (actor, combat) => {
  await respectTurnStart(actor);
  await easyTurnStart(actor, combat);
  // My Allies Are My Shield's trade lasts until the start of the holder's next turn.
  if (actor?.flags?.essence20?.[SHIELD_FLAG]) {
    await actor.unsetFlag('essence20', SHIELD_FLAG);
  }
});
registerTurnEnd(respectTurnEnd);

if (globalThis.Hooks?.on) {
  Hooks.on('createActiveEffect', (effect, options, userId) => {
    easyOnEffect(effect, userId).catch(error => console.error('Essence20 | Easy In, Easy Out', error));
  });
}
