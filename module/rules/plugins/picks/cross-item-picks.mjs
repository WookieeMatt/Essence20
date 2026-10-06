import { getSceneEpoch } from "../../../mechanics/resources/scene-clock.mjs";
import { registerUntil } from "../../expiry.mjs";
import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate, registerTag, SKILL_RANKS } from "../../predicate.mjs";
import { canAfford } from "../../steps.mjs";
import { RULE_TYPES } from "../../types.mjs";
import { itemsOf, sourceOf } from "../shared/card-text-helpers.mjs";

/**
 * Round 15 (items2): reading another item's pick, and the bits the Best Friends Forever / Better Together items need.
 *
 * Tags
 * - `picked:<16-char id>:<key>[:<tags joined by &>]` - the actor's copy of that book item (any printing) holds a pick
 *   under `key` (one value or a pickMany / pickEach list of actor uuids), some picked actor exists in the world, and -
 *   with tags - meets them (asked as the target; the roll's own facts stay: `target:skillDieAtLeast:d4`). "Any of my
 *   BFFs has this Skill at d4", "my Better Together partner is on the scene".
 * - `target:pickedBy:<16-char id>:<key>` - the other party is one of those picked actors.
 * - `target:skillDieAtLeast:<die>` - the other party's die in the rolled Skill is at least that one (d20 < d2 < d4 ... <
 *   3d6); false with no rolled Skill.
 * - `self:costRuleUsed:<id>` - the action-economy cost rule with that id (an ActionCost's `limit.key`, or a hand-written
 *   COST_RULES id) was used this turn (the ledger's perkUses) - "the assist cost a Free action".
 * Duration
 * - `until: "endOfNextRoundOrScene"` - in a combat (started or not): this round and the next of that combat; out of
 *   combat: the scene (the "this round or the last, else this scene" window the hand-written Leave It To Me read).
 * Assist `effect: "pay"` {cost: {resource, amount}, prompt?}
 * - The helper may Lend Assistance without being qualified by paying `cost` (asked first with `prompt`, an E20. key with
 *   {ally}; a Story Point is spent quietly) - mechanics/actions/lend-assistance.mjs asks ruleAssistPayment. `when` sees
 *   the other party as target:, the Skill as skill:.
 */

const lookup = uuid => (uuid ? globalThis.fromUuidSync?.(uuid, { strict: false }) ?? null : null);
const idOf = item => String(sourceOf(item) ?? '').split('.').pop();

/** The values a pick holds on the actor's copy of a book item (empty with no copy or no pick). */
export function pickedValues(actor, id, key) {
  const copy = itemsOf(actor).find(item => idOf(item) == id);
  const stored = copy?.flags?.essence20?.rules?.choices?.[key];
  return (Array.isArray(stored) ? stored : stored ? [stored] : []).map(value => (value && typeof value == 'object' ? value.uuid : value)).filter(Boolean);
}

/** The world actors a pick on the actor's copy of a book item names. */
export function pickedActors(actor, id, key) {
  return pickedValues(actor, id, key).map(lookup).filter(found => found && found.documentName != 'Item');
}

registerTag('picked', (rest, ctx) => {
  const [id, key, ...more] = String(rest ?? '').split(':');
  if (!id || !key || !ctx?.self) {
    return false;
  }

  const tags = more.join(':');
  const found = pickedActors(ctx.self, id, key);
  if (!tags) {
    return found.length > 0;
  }

  let unknown = false;
  for (const other of found) {
    const answer = evaluate(tags.split('&'), contextFor({ ...ctx, other }));
    if (answer === true) {
      return true;
    }

    unknown ||= answer === null;
  }

  return unknown ? null : false;
}, { family: 'self', param: 'text' });

registerTag('target:pickedBy', (rest, ctx) => {
  const [id, key] = String(rest ?? '').split(':');
  if (!ctx?.other) {
    return false;
  }

  return pickedValues(ctx.self, id, key).some(uuid => uuid == ctx.other.uuid);
});

registerTag('target:skillDieAtLeast', (rest, ctx) => {
  if (!ctx?.rolledSkill) {
    return false;
  }

  const shift = ctx.other?.system?.skills?.[ctx.rolledSkill]?.shift;
  return !!shift && SKILL_RANKS.indexOf(shift) >= SKILL_RANKS.indexOf(String(rest));
});

/* The action ledger's reader, filled at setup (tests set it). */
export const pickHelpers = { getLedger: null };
globalThis.Hooks?.once?.('setup', async () => {
  try {
    const economy = await import("../../../mechanics/actions/action-economy.mjs");
    pickHelpers.getLedger = economy.getLedger;
  } catch (error) {
    console.error('Essence20 | cross-item pick helpers failed to load', error);
  }
});

registerTag('self:costRuleUsed', (rest, ctx) => (Number(pickHelpers.getLedger?.(ctx?.self)?.perkUses?.[rest]) || 0) > 0);

/* -------------------------------------------- */
/*  endOfNextRoundOrScene                        */
/* -------------------------------------------- */

const sceneEpoch = () => getSceneEpoch();

registerUntil('endOfNextRoundOrScene', {
  stamp: combat => (combat ? { combatId: combat.id, round: Number(combat.round) || 0 } : { scene: sceneEpoch() }),
  expired: (stamp, combat) => (combat
    ? !(stamp.combatId == combat.id && (Number(combat.round) || 0) - (Number(stamp.round) || 0) <= 1)
    : stamp.scene != sceneEpoch()),
});

/* -------------------------------------------- */
/*  Assist effect "pay"                          */
/* -------------------------------------------- */

const assist = RULE_TYPES.Assist;
if (assist?.params?.effect?.options && !assist.params.effect.options.includes('pay')) {
  assist.params.effect.options.push('pay');
  assist.params.cost = { kind: 'object' };
  assist.params.prompt = { kind: 'string' };
  // message (effect refuse): the warning a refused helper sees (an E20. key with {name}) - adapter.mjs#ruleAssist.
  assist.params.message = { kind: 'string' };
}

/** The helper's Assist pay rule that lets them assist this ally unqualified, and that they can afford, or null. */
export function ruleAssistPayment(helper, ally, skill, essence = null) {
  for (const { rule, item } of rulesOfType(helper, 'Assist')) {
    if (rule.effect != 'pay' || (rule.side ?? 'give') != 'give' || !rule.cost?.resource) {
      continue;
    }

    if (evaluate(rule.when, contextFor({ self: helper, other: ally, ruleItem: item, rolledSkill: skill, rolledEssence: essence })) !== true) {
      continue;
    }

    const amount = Math.max(1, Math.round(Number(rule.cost.amount ?? 1)) || 1);
    if (canAfford(rule.cost.resource, amount, { actor: helper, item })) {
      return { rule, item, amount };
    }
  }

  return null;
}

/** Ask, then pay, an Assist pay rule. Resolves true when it was paid. */
export async function payForAssist(helper, ally, payment, confirm = null) {
  const i18n = globalThis.game?.i18n;
  const text = payment.rule.prompt ? (i18n?.format?.(payment.rule.prompt, { ally: ally?.name ?? '' }) ?? payment.rule.prompt) : payment.item?.name ?? '';
  const ask = confirm ?? (content => globalThis.foundry.applications.api.DialogV2.confirm({
    window: { title: i18n?.localize?.('E20.LendAssistanceTitle') ?? '' }, content: `<p>${content}</p>`, rejectClose: false,
  }));
  if (!(await ask(text))) {
    return false;
  }

  const resource = payment.rule.cost.resource;
  if (resource.storyPoints) {
    const { spendForActor } = await import("../../../mechanics/resources/story-points.mjs");
    await spendForActor(helper, payment.amount, { announce: false });
    return true;
  }

  const { changeResource } = await import("../../steps.mjs");
  return changeResource(resource, -payment.amount, { actor: helper, item: payment.item });
}
