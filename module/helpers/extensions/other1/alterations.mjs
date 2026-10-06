import {
  registerDerived, registerRollSources, registerSceneAdvanced, registerTurnEnd, registerTurnStart, registerUse,
} from "../../extensions.mjs";
import { hasSourced } from "../../companion-link.mjs";
import { getSceneEpoch } from "../../scene-clock.mjs";
import {
  CC, T, actorsInPlay, addToDefense, isFrom, itemsOf, post, safeSetFlag,
} from "./shared.mjs";

/**
 * Cobra Codex Alterations used in ways the drop handler (sheet-handlers/alteration-handler.mjs)
 * never covered: costs that are waived (Altered, Additional Alteration), Alterations lent to or
 * forced on someone else for a while (the ledger Overload, Genetic Support and the Advanced Alteration Emulator's item
 * rules lend through - rules/ext/d/alteration.mjs).
 * (Thick Hide's always-equipped riot shield, raised for one Evasion per Alteration, is item rules.)
 *
 * An Essence Alteration's drop writes its benefit and cost straight into the actor's stored
 * Essence and skill shifts. Nothing here touches those stored values - a waived cost or a lent
 * benefit is an adjustment on top, in derived data (Essence, the Defense that Essence feeds,
 * Movement) and as a ↑/↓ on the affected skill's rolls. So deleting an Alteration (whose handler
 * undoes exactly what the drop did) and a lend running out both stay correct with no clean-up.
 */
export const O1_ALT = {
  altered: CC('0wge61eXEfqDB0c1'),
  additionalAlteration: CC('nO9aJONDslWpuCuC'),
  cyberneticPart: CC('wCL3rJOEDZVHVg6g'),
  engraftedMutation: CC('zuR9YJ2Wy956VGGy'),
  enhancedPart: CC('eT4g9EfrFtvjMqWu'),
  evolvingMutation: CC('7cL4aUwJwqvbhYCz'),
  optimizedPart: CC('zGsTAngJ2HRdKPkz'),
  outrightMutation: CC('RcGUjeMpsNDFjwmL'),
};

const LENDS = 'o1Lends';
const WAIVED = 'o1CostWaived';

/* -------------------------------------------- */
/*  Benefit / cost shapes                        */
/* -------------------------------------------- */

const firstOf = value => (Array.isArray(value) ? value[0] : value) || null;

function blank() {
  return { essences: {}, skills: {}, movement: {} };
}

function add(bucket, key, amount) {
  if (key && amount) {
    bucket[key] = (bucket[key] ?? 0) + amount;
  }
}

/** What an Alteration as it sits on an actor gives (its drop picked the skill already). */
export function benefitOf(alteration) {
  const s = alteration?.system ?? {};
  const out = blank();
  if (s.type == 'essence') {
    add(out.essences, firstOf(s.essenceBonus), 1);
    add(out.skills, s.bonus, 1);
  } else if (s.type == 'movement') {
    add(out.movement, s.bonusMovementType, Number(s.bonusMovement) || 0);
    // Movement traded in at the drop moved into the bonus type - see
    // alteration-handler.mjs#_processAlterationMovementCost.
    for (const entry of Object.values(s.movementCost ?? {})) {
      add(out.movement, s.bonusMovementType, (Number(entry?.value) || 0) * 5);
    }
  }

  return out;
}

/** What an Alteration as it sits on an actor costs. `withEssence` false leaves the Essence out. */
export function costOf(alteration, { withEssence = true } = {}) {
  const s = alteration?.system ?? {};
  const out = blank();
  if (s.type == 'essence') {
    if (withEssence) {
      add(out.essences, s.selectedEssence || firstOf(s.essenceCost), -1);
    }

    add(out.skills, s.cost, -1);
  } else if (s.type == 'movement') {
    // The movement traded in at the drop is the player's exchange, not the Alteration's cost.
    add(out.movement, s.costMovementType, -(Number(s.costMovement) || 0));
  }

  return out;
}

function negate(shape) {
  const out = blank();
  for (const kind of ['essences', 'skills', 'movement']) {
    for (const [key, value] of Object.entries(shape[kind] ?? {})) {
      out[kind][key] = -value;
    }
  }

  return out;
}

function merge(into, shape, label, labels) {
  for (const kind of ['essences', 'skills', 'movement']) {
    for (const [key, value] of Object.entries(shape?.[kind] ?? {})) {
      if (!value) {
        continue;
      }

      into[kind][key] = (into[kind][key] ?? 0) + value;
      labels.push({ kind, key, value, label });
    }
  }
}

/* -------------------------------------------- */
/*  Lends and their expiry                       */
/* -------------------------------------------- */

export function isLendExpired(lend, { combat = game?.combat, sceneEpoch = getSceneEpoch() } = {}) {
  const expire = lend?.expire ?? {};
  if (expire.scene != null && expire.scene != sceneEpoch) {
    return true;
  }

  if (expire.kind == 'rounds') {
    if (!expire.combatId) {
      return false;
    }

    if (!combat || combat.id != expire.combatId) {
      return true;
    }

    return combat.round >= expire.round + (expire.rounds ?? 10);
  }

  return false;
}

export function activeLends(actor) {
  const list = actor?.flags?.essence20?.[LENDS];
  return Array.isArray(list) ? list.filter(lend => !isLendExpired(lend)) : [];
}

export async function addLend(target, lend) {
  const list = Array.isArray(target.flags?.essence20?.[LENDS]) ? target.flags.essence20[LENDS] : [];
  await safeSetFlag(target, LENDS, [...list.filter(entry => !isLendExpired(entry)), { id: foundry.utils.randomID(), ...lend }]);
}

async function pruneLends(actor, drop) {
  const list = actor?.flags?.essence20?.[LENDS];
  if (!Array.isArray(list) || !list.length) {
    return;
  }

  const kept = list.filter(lend => !isLendExpired(lend) && !drop(lend));
  if (kept.length != list.length) {
    await safeSetFlag(actor, LENDS, kept);
  }
}

export function sceneStamp() {
  return { scene: getSceneEpoch() };
}

/** "Until the beginning of your next turn" - the lender's. */
export const untilLenderTurn = lender => ({ kind: 'startOfTurnOf', by: lender.uuid, ...sceneStamp() });
/** "Until the end of their next turn" - the target's. */
export const untilTheirNextTurnEnds = () => ({ kind: 'endOfNextTurn', armed: false, ...sceneStamp() });
/** "For 1 minute" - ten rounds in combat, else the scene. */
export const forAMinute = () => ({ kind: 'rounds', rounds: 10, combatId: game.combat?.id ?? null, round: game.combat?.round ?? 0, ...sceneStamp() });

registerTurnStart(async (actor) => {
  for (const other of await actorsInPlay()) {
    await pruneLends(other, lend => lend.expire?.kind == 'startOfTurnOf' && lend.expire.by == actor.uuid);
  }

  // A cost forced on this creature starts counting down on its next turn.
  const list = actor.flags?.essence20?.[LENDS];
  if (Array.isArray(list) && list.some(lend => lend.expire?.kind == 'endOfNextTurn' && !lend.expire.armed)) {
    await safeSetFlag(actor, LENDS, list.map(lend => (lend.expire?.kind == 'endOfNextTurn'
      ? { ...lend, expire: { ...lend.expire, armed: true } } : lend)));
  }
});

registerTurnEnd(async (actor) => {
  await pruneLends(actor, lend => lend.expire?.kind == 'endOfNextTurn' && lend.expire.armed);
});

registerSceneAdvanced(async () => {
  if (!game.user?.isGM) {
    return;
  }

  for (const actor of await actorsInPlay()) {
    await pruneLends(actor, () => false);
  }
});

/* -------------------------------------------- */
/*  Everything that adjusts an actor             */
/* -------------------------------------------- */

/**
 * The actor's Alteration adjustments: waived costs on its own Alterations plus every lend.
 * @returns {{essences, skills, movement, labels: Array}}
 */
export function adjustmentsOf(actor) {
  const out = { ...blank(), labels: [] };
  for (const alteration of itemsOf(actor)) {
    const waived = alteration.type == 'alteration' ? alteration.flags?.essence20?.[WAIVED] : null;
    if (waived) {
      // Undo the cost the drop wrote in - all of it for Altered, all but the Essence for
      // Additional Alteration.
      merge(out, negate(costOf(alteration, { withEssence: waived == 'full' })), `${alteration.name} (${T('O1CostWaivedLabel')})`, out.labels);
    }
  }

  for (const lend of activeLends(actor)) {
    merge(out, lend, lend.label, out.labels);
  }

  return out;
}

registerDerived((actor) => {
  const system = actor?.system;
  if (!system) {
    return;
  }

  const adjust = adjustmentsOf(actor);
  for (const [essence, amount] of Object.entries(adjust.essences)) {
    const entry = system.essences?.[essence];
    if (!entry) {
      continue;
    }

    if (Number.isFinite(entry.max)) {
      entry.max += amount;
    }

    for (const defense of Object.values(system.defenses ?? {})) {
      if (defense?.essence == essence) {
        addToDefense(defense, amount, T('O1AlterationAdjust'));
      }
    }
  }

  for (const [type, amount] of Object.entries(adjust.movement)) {
    const entry = system.movement?.[type];
    if (entry && Number.isFinite(entry.total)) {
      entry.total = Math.max(0, entry.total + amount);
    }
  }
});

registerRollSources((actor, target, ctx) => {
  const skill = ctx?.rolledSkill;
  if (!skill) {
    return null;
  }

  const sources = [];
  for (const { kind, key, value, label } of adjustmentsOf(actor).labels) {
    if (kind == 'skills' && key == skill) {
      sources.push({ id: `o1Alt${sources.length}`, label, ...(value > 0 ? { shiftUp: value } : { shiftDown: -value }) });
    }
  }

  return { sources };
});

/* -------------------------------------------- */
/*  Altered / Additional Alteration              */
/* -------------------------------------------- */

// Altered (Cobra Codex, Hydro-Viper variant Focus, p.53): "You gain a Standard Alteration that
// increases an Essence Score at 1st level, and a Standard or Limited Alteration that increases an
// Essence Score at 10th level... You ignore the costs of these Alterations."
// Additional Alteration (p.53): "At 7th level, you gain Cybernetic Part or Engrafted Mutation... At
// 15th level, you gain Enhanced Part or Evolving Mutation... At 18th level, you gain Optimized Part
// or Outright Mutation... as a free General Perk... You also ignore the costs of these Alterations,
// except for Essence Score costs."
const levelOf = actor => Number(actor?.system?.level) || 1;

export function alteredBudget(actor) {
  return hasSourced(actor, O1_ALT.altered) ? (levelOf(actor) >= 10 ? 2 : 1) : 0;
}

export function additionalBudget(actor) {
  if (!hasSourced(actor, O1_ALT.additionalAlteration)) {
    return 0;
  }

  const level = levelOf(actor);
  return level >= 18 ? 3 : level >= 15 ? 2 : level >= 7 ? 1 : 0;
}

function waivedCount(actor, kind) {
  return itemsOf(actor).filter(item => item.type == 'alteration' && item.flags?.essence20?.[WAIVED] == kind).length;
}

/** Which waivers this Alteration could still take: 'full' (Altered), 'partial' (Additional). */
export function waiverOptions(actor, alteration) {
  const s = alteration?.system ?? {};
  if (!['essence', 'movement'].includes(s.type) || alteration.flags?.essence20?.[WAIVED]) {
    return [];
  }

  const options = [];
  const alteredOk = s.type == 'essence' && (s.availability == 'standard' || (s.availability == 'limited' && levelOf(actor) >= 10));
  if (alteredOk && waivedCount(actor, 'full') < alteredBudget(actor)) {
    options.push('full');
  }

  if (waivedCount(actor, 'partial') < additionalBudget(actor)) {
    options.push('partial');
  }

  return options;
}

async function offerWaiver(actor, alteration) {
  const options = waiverOptions(actor, alteration);
  if (!options.length) {
    return null;
  }

  const { chooseButtons } = await import("../../grants.mjs");
  const choice = await chooseButtons(alteration.name, T('O1WaiverPrompt', { name: alteration.name }), [
    ...options.map(key => [key, T(key == 'full' ? 'O1WaiverFull' : 'O1WaiverPartial')]),
    ['no', T('O1WaiverNo')],
  ]);
  if (!options.includes(choice)) {
    return null;
  }

  await alteration.setFlag('essence20', WAIVED, choice);
  return T('O1WaiverDone', { name: actor.name, alteration: alteration.name });
}

// The drop handler's last write on every Essence/Movement Alteration stamps system.originalId.
Hooks.on('updateItem', async (item, changes, options, userId) => {
  if (userId != game.user?.id || item.type != 'alteration' || !item.parent
    || foundry.utils.getProperty(changes, 'system.originalId') === undefined) {
    return;
  }

  const line = await offerWaiver(item.parent, item);
  if (line) {
    await post(item.parent, line);
  }
});

const TIERS = [
  { level: 15, perks: ['enhancedPart', 'evolvingMutation'] },
  { level: 18, perks: ['optimizedPart', 'outrightMutation'] },
];

export function openTiers(actor) {
  return TIERS.filter(tier => levelOf(actor) >= tier.level && !tier.perks.some(key => hasSourced(actor, O1_ALT[key])));
}

function waivableAlterations(actor) {
  return itemsOf(actor).filter(item => item.type == 'alteration' && waiverOptions(actor, item).length);
}

for (const [id, perkUuid] of [['o1Altered', O1_ALT.altered], ['o1AdditionalAlteration', O1_ALT.additionalAlteration]]) {
  registerUse({
    id,
    matches: isFrom(perkUuid),
    canUse: item => waivableAlterations(item.parent).length > 0 || (perkUuid == O1_ALT.additionalAlteration && openTiers(item.parent).length > 0),
    run: async (item) => {
      const actor = item.parent;
      const { chooseSelect, grantCopy } = await import("../../grants.mjs");
      const options = [];
      if (perkUuid == O1_ALT.additionalAlteration) {
        for (const tier of openTiers(actor)) {
          for (const key of tier.perks) {
            const source = await fromUuid(O1_ALT[key]);
            options.push({ value: `perk:${key}`, label: T('O1TierPerk', { level: tier.level, name: source?.name ?? key }) });
          }
        }
      }

      for (const alteration of waivableAlterations(actor)) {
        options.push({ value: `waive:${alteration.id}`, label: T('O1WaiveOption', { name: alteration.name }) });
      }

      const choice = await chooseSelect(item.name, T('O1AlterationUsePrompt'), options);
      if (!choice) {
        return null;
      }

      const [kind, key] = choice.split(':');
      if (kind == 'perk') {
        const created = await grantCopy(actor, O1_ALT[key], { grantedBy: item });
        return created ? T('O1TierGranted', { name: actor.name, perk: created.name }) : null;
      }

      return offerWaiver(actor, actor.items.get(key));
    },
  });
}

/* -------------------------------------------- */
/*  Lending, for the rules engine                */
/* -------------------------------------------- */

// Overload, Genetic Support and the Advanced Alteration Emulator lend Alterations from their item rules (the
// pickAlteration / lendAlteration steps, rules/ext/d/alteration.mjs) through addLend and the helpers below.

/** An Alteration's benefit or cost text, without its markup. */
export function describeText(alteration, field) {
  return String(alteration?.system?.[field] ?? '').replace(/<[^>]+>/g, '').trim();
}

/* -------------------------------------------- */
/*  A compendium Alteration, as it would land    */
/* -------------------------------------------- */

async function pickSkillOf(title, essence) {
  const { chooseSelect } = await import("../../grants.mjs");
  const skills = Object.entries(CONFIG.E20.skillToEssence ?? {}).filter(([, e]) => e == essence).map(([skill]) => skill);
  return chooseSelect(title, T('O1PickSkillOf', { essence: game.i18n.localize(CONFIG.E20.essences?.[essence] ?? essence) }),
    skills.map(skill => ({ value: skill, label: game.i18n.localize(CONFIG.E20.skills?.[skill] ?? skill) })));
}

/**
 * The benefit+cost of a compendium Alteration, asking for the same choices its drop would (which
 * skill rises, which Essence and skill pay).
 */
export async function shapeFromCompendium(uuid, { withCost = true } = {}) {
  const source = await fromUuid(uuid);
  if (!source) {
    return null;
  }

  const s = source.system ?? {};
  const shape = blank();
  if (s.type == 'essence') {
    const essence = firstOf(s.essenceBonus);
    const bonusSkill = await pickSkillOf(source.name, essence);
    if (!bonusSkill) {
      return null;
    }

    add(shape.essences, essence, 1);
    add(shape.skills, bonusSkill, 1);
    if (withCost) {
      const costs = Array.isArray(s.essenceCost) ? s.essenceCost : [s.essenceCost];
      let costEssence = costs[0];
      if (costs.length > 1) {
        const { chooseSelect } = await import("../../grants.mjs");
        costEssence = await chooseSelect(source.name, T('O1PickCostEssence'),
          costs.map(e => ({ value: e, label: game.i18n.localize(CONFIG.E20.essences?.[e] ?? e) })));
      }

      const costSkill = costEssence ? await pickSkillOf(source.name, costEssence) : null;
      add(shape.essences, costEssence, -1);
      add(shape.skills, costSkill, -1);
    }
  } else if (s.type == 'movement') {
    add(shape.movement, s.bonusMovementType, Number(s.bonusMovement) || 0);
    if (withCost) {
      add(shape.movement, s.costMovementType, -(Number(s.costMovement) || 0));
    }
  }

  return { source, shape };
}

export async function pickCompendiumAlteration(title, availabilities) {
  const { findItems, pickOne } = await import("../../grants.mjs");
  const rows = await findItems({ type: 'alteration', availabilities, fields: ['system.availability'] });
  return pickOne(title, rows);
}
