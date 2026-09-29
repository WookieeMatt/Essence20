import {
  registerDerived, registerRollSources, registerSceneAdvanced, registerTurnEnd, registerTurnStart, registerUse,
} from "../../extensions.mjs";
import { hasSourced } from "../../companion-link.mjs";
import { getSceneEpoch } from "../../scene-clock.mjs";
import {
  CC, T, actorsInPlay, addToDefense, findSourced, firstTarget, isFrom, itemsOf, post, safeSetFlag, sourceOf,
} from "./shared.mjs";

/**
 * Cobra Codex Alterations used in ways the drop handler (sheet-handlers/alteration-handler.mjs)
 * never covered: costs that are waived (Altered, Additional Alteration), Alterations lent to or
 * forced on someone else for a while (Overload, Genetic Support, Advanced Alteration Emulator),
 * and Thick Hide's riot shield that scales with how many Alterations you have.
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
  overload: CC('DCgAR3QpfjUspsGU'),
  geneticSupport: CC('qOQprOVxN5tTwas0'),
  emulator: CC('OVwVXnhWH4QVeVFN'),
  thickHide: CC('yFlxX1ErTOlXXjz7'),
  riotShield: CC('MQuoZeuRPWEyUxFc'),
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

async function addLend(target, lend) {
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

function sceneStamp() {
  return { scene: getSceneEpoch() };
}

/** "Until the beginning of your next turn" - the lender's. */
const untilLenderTurn = lender => ({ kind: 'startOfTurnOf', by: lender.uuid, ...sceneStamp() });
/** "Until the end of their next turn" - the target's. */
const untilTheirNextTurnEnds = () => ({ kind: 'endOfNextTurn', armed: false, ...sceneStamp() });
/** "For 1 minute" - ten rounds in combat, else the scene. */
const forAMinute = () => ({ kind: 'rounds', rounds: 10, combatId: game.combat?.id ?? null, round: game.combat?.round ?? 0, ...sceneStamp() });

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

  // Thick Hide - see its own block below.
  const hide = thickHideDelta(actor);
  if (hide && system.defenses?.evasion) {
    addToDefense(system.defenses.evasion, hide, findSourced(actor, O1_ALT.thickHide)?.name ?? 'Thick Hide');
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
/*  Overload                                     */
/* -------------------------------------------- */

// Overload (Cobra Codex, Hydro-Viper, 10th level, p.53-54): "as a Free Action, you can grant a
// creature within Reach the normal benefit of one of your Alterations until the beginning of your
// next turn. As a Move Action, you can try to force a creature within Reach to suffer the normal
// cost of one of your Alterations until the end of their next turn. You must succeed at a Might,
// Finesse, or Science Skill Test against the target's Evasion."
function describeText(alteration, field) {
  return String(alteration?.system?.[field] ?? '').replace(/<[^>]+>/g, '').trim();
}

registerUse({
  id: 'o1Overload',
  matches: isFrom(O1_ALT.overload),
  canUse: item => itemsOf(item.parent).some(other => other.type == 'alteration'),
  run: async (item, economy, pay) => {
    const actor = item.parent;
    const target = firstTarget();
    if (!target) {
      ui.notifications.warn(T('O1NeedTarget'));
      return null;
    }

    const { chooseButtons, chooseSelect, rollTest } = await import("../../grants.mjs");
    const mode = await chooseButtons(item.name, T('O1OverloadPrompt', { target: target.name }), [
      ['benefit', T('O1OverloadBenefit')], ['cost', T('O1OverloadCost')],
    ]);
    if (!['benefit', 'cost'].includes(mode)) {
      return null;
    }

    const alterations = itemsOf(actor).filter(other => other.type == 'alteration');
    const alterationId = await chooseSelect(item.name, T('O1PickAlteration'), alterations.map(a => ({ value: a.id, label: a.name })));
    const alteration = alterations.find(a => a.id == alterationId);
    if (!alteration) {
      return null;
    }

    if (mode == 'benefit') {
      if (!(await pay('free'))) {
        return null;
      }

      await addLend(target, { label: `${item.name}: ${alteration.name}`, ...benefitOf(alteration), expire: untilLenderTurn(actor) });
      const text = describeText(alteration, 'benefit');
      return T('O1OverloadLent', { name: actor.name, target: target.name, alteration: alteration.name }) + (text ? ` ${text}` : '');
    }

    const skill = await chooseSelect(item.name, T('O1OverloadSkill'), ['might', 'finesse', 'science']
      .filter(key => actor.system?.skills?.[key])
      .map(key => ({ value: key, label: game.i18n.localize(CONFIG.E20.skills?.[key] ?? key) })));
    if (!skill || !(await pay('move'))) {
      return null;
    }

    const evasion = Number(target.system?.defenses?.evasion?.total) || 10;
    const { success } = await rollTest(actor, skill, evasion);
    if (!success) {
      return T('O1OverloadResisted', { name: actor.name, target: target.name });
    }

    await addLend(target, { label: `${item.name}: ${alteration.name}`, ...costOf(alteration), expire: untilTheirNextTurnEnds() });
    const text = describeText(alteration, 'cost');
    return T('O1OverloadForced', { name: actor.name, target: target.name, alteration: alteration.name }) + (text ? ` ${text}` : '');
  },
});

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
async function shapeFromCompendium(uuid, { withCost = true } = {}) {
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

async function pickCompendiumAlteration(title, availabilities) {
  const { findItems, pickOne } = await import("../../grants.mjs");
  const rows = await findItems({ type: 'alteration', availabilities, fields: ['system.availability'] });
  return pickOne(title, rows);
}

/* -------------------------------------------- */
/*  Genetic Support                              */
/* -------------------------------------------- */

// Genetic Support (Cobra Codex, Biotechnician, 3rd level, p.64): "When you use Support, instead of
// an Upgrade, you can temporarily grant an ally the Cybernetic Part or Engrafted Mutation General
// Perk... At 10th level, when you use Tech Support... Enhanced Part or Evolving Mutation... These
// benefits last until the start of your next turn. At 14th level... Outright Mutation or Optimized
// Part... and you can use Extended Support to increase the duration until the end of the scene."
// Those Perks each give "a permanent Standard/Limited/Restricted Alteration" - so the ally takes a
// chosen Alteration of that tier, benefit and cost, for the duration. Run it with the Support
// action it replaces (the Use button spends that Standard action).
export function geneticTiers(level) {
  return [
    { key: 'standard', min: 3, label: 'O1GeneticStandard' },
    { key: 'limited', min: 10, label: 'O1GeneticLimited' },
    { key: 'restricted', min: 14, label: 'O1GeneticRestricted' },
  ].filter(tier => level >= tier.min);
}

registerUse({
  id: 'o1GeneticSupport',
  matches: isFrom(O1_ALT.geneticSupport),
  canUse: item => levelOf(item.parent) >= 3,
  run: async (item, economy, pay) => {
    const actor = item.parent;
    const ally = firstTarget() ?? actor;
    const { chooseButtons } = await import("../../grants.mjs");
    const tiers = geneticTiers(levelOf(actor));
    const tierKey = await chooseButtons(item.name, T('O1GeneticPrompt', { target: ally.name }), tiers.map(tier => [tier.key, T(tier.label)]));
    if (!tiers.some(tier => tier.key == tierKey)) {
      return null;
    }

    let extended = false;
    if (levelOf(actor) >= 14) {
      extended = (await chooseButtons(item.name, T('O1GeneticExtendedPrompt'), [['no', T('O1GeneticUntilTurn')], ['yes', T('O1GeneticScene')]])) == 'yes';
    }

    const uuid = await pickCompendiumAlteration(item.name, [tierKey]);
    const picked = uuid ? await shapeFromCompendium(uuid) : null;
    if (!picked || !(await pay('standard'))) {
      return null;
    }

    const expire = extended ? { kind: 'scene', ...sceneStamp() } : untilLenderTurn(actor);
    await addLend(ally, { label: `${item.name}: ${picked.source.name}`, ...picked.shape, expire });
    return T('O1GeneticGranted', { name: actor.name, target: ally.name, alteration: picked.source.name });
  },
});

/* -------------------------------------------- */
/*  Advanced Alteration Emulator                 */
/* -------------------------------------------- */

// Advanced Alteration Emulator (Cobra Codex, armor upgrade, p.101): "Choose a Limited Alteration.
// As a Standard Action, you can gain the benefit and the cost of this Alteration for 1 minute. You
// can't use your Alteration Emulator again until you succeed at a DIF 20 Technology Skill Test that
// takes 10 minutes." The Limited Alteration is picked on first use and kept on the upgrade.
function wornUpgrade(item) {
  const parentId = item?.flags?.essence20?.parentId;
  return !parentId || !!item.parent?.items?.get?.(parentId)?.system?.equipped;
}

registerUse({
  id: 'o1AlterationEmulator',
  matches: isFrom(O1_ALT.emulator),
  canUse: item => wornUpgrade(item),
  run: async (item, economy, pay) => {
    const actor = item.parent;
    const flags = item.flags?.essence20 ?? {};
    if (flags.o1EmulatorSpent) {
      const { rollTest } = await import("../../grants.mjs");
      const { success } = await rollTest(actor, 'technology', 20);
      if (success) {
        await item.unsetFlag('essence20', 'o1EmulatorSpent');
      }

      return T(success ? 'O1EmulatorRecharged' : 'O1EmulatorNotRecharged', { name: actor.name, item: item.name });
    }

    let uuid = flags.o1EmulatedUuid;
    if (!uuid) {
      uuid = await pickCompendiumAlteration(item.name, ['limited']);
      if (!uuid) {
        return null;
      }

      await item.setFlag('essence20', 'o1EmulatedUuid', uuid);
    }

    const picked = await shapeFromCompendium(uuid);
    if (!picked || !(await pay('standard'))) {
      return null;
    }

    await addLend(actor, { label: `${item.name}: ${picked.source.name}`, ...picked.shape, expire: forAMinute() });
    await item.setFlag('essence20', 'o1EmulatorSpent', true);
    return T('O1EmulatorUsed', { name: actor.name, alteration: picked.source.name });
  },
});

/* -------------------------------------------- */
/*  Thick Hide                                   */
/* -------------------------------------------- */

// Thick Hide (Cobra Codex, General Perk, p.81): "You're always considered equipped with a riot
// shield (see page 98). However, the benefit you gain from raising your shield is equal to the
// number of Alterations you have... Regardless of the number of Alterations you have, the Passive
// effect of your shield remains +1 Toughness." A Riot Shield copy is granted with the Perk; raised,
// its +2 Evasion is corrected to the Alteration count here in derived data.
export function thickHideDelta(actor) {
  const shield = itemsOf(actor).find(item => item.type == 'shield' && item.flags?.essence20?.o1ThickHide);
  if (!shield?.system?.active || !shield.system.equipped) {
    return 0;
  }

  const alterations = itemsOf(actor).filter(item => item.type == 'alteration').length;
  const raised = Number(shield.system.activeEffect?.option1?.value) || 0;
  return alterations - raised;
}

async function grantThickHideShield(actor, perk) {
  if (itemsOf(actor).some(item => item.type == 'shield' && item.flags?.essence20?.o1ThickHide)) {
    return null;
  }

  const { grantCopy } = await import("../../grants.mjs");
  return grantCopy(actor, O1_ALT.riotShield, {
    grantedBy: perk, name: perk.name, flags: { o1ThickHide: true }, system: { equipped: true },
  });
}

Hooks.on('createItem', async (item, options, userId) => {
  if (userId == game.user?.id && item.parent && sourceOf(item) == O1_ALT.thickHide) {
    await grantThickHideShield(item.parent, item);
  }
});

registerUse({
  id: 'o1ThickHide',
  matches: isFrom(O1_ALT.thickHide),
  canUse: item => !itemsOf(item.parent).some(other => other.type == 'shield' && other.flags?.essence20?.o1ThickHide),
  run: async (item) => ((await grantThickHideShield(item.parent, item)) ? T('O1ThickHideGranted', { name: item.parent.name }) : null),
});

// "Always considered equipped": unequipping it puts it straight back.
Hooks.on('updateItem', async (item, changes, options, userId) => {
  if (userId == game.user?.id && item.type == 'shield' && item.flags?.essence20?.o1ThickHide
    && foundry.utils.getProperty(changes, 'system.equipped') === false) {
    await item.update({ 'system.equipped': true });
  }
});
