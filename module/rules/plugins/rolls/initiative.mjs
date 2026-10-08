import { registerDerived } from "../../../mechanics/item-hooks.mjs";
import { registerRef, resolveValue } from "../../formula.mjs";
import { rulesOfType } from "../../index.mjs";
import { registerTag } from "../../predicate.mjs";
import { recipients, registerRecipient, registerStep, runSteps } from "../../steps.mjs";
import { registerEvent, registerRuleType } from "../../types.mjs";
import { combatantOf, escape, listOf, T, worldActors, write } from "../shared/chat-speaker-helpers.mjs";

/**
 * Initiative pieces (round 10, group D):
 *
 *  - Rule type `InitiativeReroll {atMost}` - the actor's Initiative formula rerolls Skill dice showing atMost or less
 *    once (Foundry's r<=N on every d3-d12; the d20 and a d2 are left alone).
 *  - Trigger event `initiativeRolling` - fired from the Initiative roll itself (dice.mjs INITIATIVE_EXTENSIONS),
 *    after the Roll Options Dialog and before the formula is built.
 *  - Steps `rollInitiative {to, keepHigher?}` (roll it again through the combat; keepHigher - a result that isn't higher
 *    keeps the old one), `swapInitiative {requireLower?}` (with the first
 *    target), `distribute {to, total, prompt?, steps}` (share up to `total` points among the recipients - each
 *    recipient's steps run with it as the target and its share as @var.share).
 *  - Formula ref `@initiative` (this actor's Initiative in the running combat; @initiative.target - the first
 *    target's, @initiative.recipient - the actor a step is acting on). 0 when not rolled.
 *  - Tags `self:initiative` / `target:initiative` (has rolled Initiative in the running combat).
 *  - Recipients `protectedTarget` (the holder's Protected Target), `markers:<key>` (actors who set the per-setter mark
 *    <key> on this actor - "teammates who chose to follow me").
 */

/* -------------------------------------------- */
/*  InitiativeReroll                             */
/* -------------------------------------------- */

registerRuleType('InitiativeReroll', {
  params: { atMost: { kind: 'formula', required: true } },
  scopes: ['self'],
});

/** Every Skill die (d3-d12) in an Initiative formula rerolls results of `atMost` or less once. */
export function withInitiativeRerolls(formula, atMost = 2) {
  return String(formula ?? '').replace(/(\d*)d(\d+)(?![\dr])/g, (match, count, faces) => {
    const size = Number(faces);
    return size >= 3 && size <= 12 ? `${match}r<=${atMost}` : match;
  });
}

export function initiativeRerollDerived(actor) {
  const initiative = actor?.system?.initiative;
  const [entry] = rulesOfType(actor, 'InitiativeReroll');
  if (!initiative?.formula || !entry || initiative.formula.includes('r<=')) {
    return;
  }

  initiative.formula = withInitiativeRerolls(initiative.formula, Math.round(resolveValue(entry.rule.atMost, { actor, item: entry.item }, 2)));
}

registerDerived(initiativeRerollDerived);

/* -------------------------------------------- */
/*  initiativeRolling                            */
/* -------------------------------------------- */

registerEvent('initiativeRolling');

export async function initiativeRolling(actor, options = null) {
  const { fireTriggers } = await import("../../triggers.mjs");
  // The Initiative roll's ticked switch keys reach `roll:switch:<key>` (round 15: "Friendly" Fire after Spoof).
  await fireTriggers(actor, 'initiativeRolling', { roll: { rolledSkill: actor?.system?.initiative?.skill, switches: options?.ruleKeys ?? [] } });
}

globalThis.Hooks?.once?.('init', async () => {
  const dice = await import("../../../dice.mjs");
  dice.INITIATIVE_EXTENSIONS?.push((actor, options) => initiativeRolling(actor, options));
});

/* -------------------------------------------- */
/*  Refs, tags, recipients                       */
/* -------------------------------------------- */

/** An actor's Initiative in the running combat, or null when it hasn't rolled (or isn't in it). */
export function initiativeOf(actor) {
  const value = combatantOf(actor)?.initiative;
  return value === null || value === undefined || !Number.isFinite(Number(value)) ? null : Number(value);
}

/**
 * The Initiative that sorts a combatant straight after the one acting now: halfway to the next one, or 1 below the
 * current one when it's last; null when the current one hasn't rolled (round 15, items2 - Queen's Gambit).
 */
export function initiativeAfterCurrent(combat = globalThis.game?.combat) {
  const turns = combat?.turns ?? [];
  const current = turns[combat?.turn ?? 0];
  if (current?.initiative == null) {
    return null;
  }

  const next = turns[(combat.turn ?? 0) + 1];
  return next?.initiative != null ? (current.initiative + next.initiative) / 2 : current.initiative - 1;
}

registerRef('initiative', (key, scope) => {
  // @initiative.afterCurrent: straight after whoever is acting now (writeInitiative with exact: true).
  if (key == 'afterCurrent') {
    return initiativeAfterCurrent() ?? 0;
  }

  const actor = key == 'target' ? scope.other : key == 'recipient' ? scope.recipient : scope.actor;
  return initiativeOf(actor) ?? 0;
});

registerTag('self:initiative', (rest, ctx) => (globalThis.game?.combat ? initiativeOf(ctx.self) !== null : false), { phrase: ['{who} {has} rolled Initiative', '{who} {havent} rolled Initiative'] });
registerTag('target:initiative', (rest, ctx) => (ctx.other && globalThis.game?.combat ? initiativeOf(ctx.other) !== null : false), { phrase: ['{who} {has} rolled Initiative', '{who} {havent} rolled Initiative'] });

registerRecipient('protectedTarget', (match, ctx) => {
  const uuid = ctx.actor?.getFlag?.('essence20', 'protectedTargetUuid') ?? ctx.actor?.flags?.essence20?.protectedTargetUuid;
  const actor = uuid ? globalThis.fromUuidSync?.(uuid, { strict: false }) ?? null : null;
  return actor ? [actor] : [];
});

/** Actors who set the per-setter mark <key> on this actor (live marks only). */
export function markersOf(actor, key, actors = worldActors()) {
  const marks = actor?.flags?.essence20?.ruleMarks ?? {};
  const uuids = Object.entries(marks).filter(([name, mark]) => (name == key || name.startsWith(`${key}--`)) && mark?.by).map(([, mark]) => mark.by);
  return [...new Set(uuids)].map(uuid => actors.find(other => other?.uuid == uuid) ?? globalThis.fromUuidSync?.(uuid, { strict: false }) ?? null).filter(Boolean);
}

registerRecipient(/^markers:([\w-]+)$/, (match, ctx) => markersOf(ctx.actor, match[1]));

/* -------------------------------------------- */
/*  Steps                                        */
/* -------------------------------------------- */

registerStep('rollInitiative', async (step, ctx) => {
  const combat = globalThis.game?.combat;
  const ids = recipients(step, ctx).map(actor => combatantOf(actor, combat)?.id).filter(Boolean);
  if (!combat || !ids.length) {
    return false;
  }

  // keepHigher (round 17, split2 - Deceptive Warfare's reset): a new result that isn't higher puts the old one back.
  const before = step.keepHigher ? new Map(ids.map(id => [id, Number(combat.combatants?.get?.(id)?.initiative)])) : null;
  await combat.rollInitiative(ids);
  if (!before) {
    ctx.chat.push(escape(T('InitiativeRerolled', { name: recipients(step, ctx).map(actor => actor.name).join(', ') })));
    return;
  }

  for (const [id, old] of before) {
    const combatant = combat.combatants?.get?.(id);
    const after = Number(combatant?.initiative);
    const name = combatant?.actor?.name ?? combatant?.name ?? '';
    if (Number.isFinite(old) && !(after > old)) {
      await write(combatant, 'update', [{ initiative: old }]);
      ctx.chat.push(escape(globalThis.game?.i18n?.format?.('E20.RulesExtSplit217.InitiativeKept', { name, before: old, after }) ?? name));
    } else {
      ctx.chat.push(escape(globalThis.game?.i18n?.format?.('E20.RulesExtSplit217.InitiativeMoved', { name, after }) ?? name));
    }
  }
});

// swapInitiative: this actor and the first target trade Initiative (requireLower: only with one who rolled lower).
registerStep('swapInitiative', async (step, ctx) => {
  const combat = globalThis.game?.combat;
  const other = ctx.targets[0];
  const mine = combatantOf(ctx.actor, combat);
  const theirs = other ? combatantOf(other, combat) : null;
  if (!combat || !mine || !theirs) {
    globalThis.ui?.notifications?.warn?.(T('SwapNeedsTarget'));
    return false;
  }

  const a = mine.initiative;
  const b = theirs.initiative;
  if (step.requireLower && !(b < a)) {
    globalThis.ui?.notifications?.warn?.(T('SwapMustBeLower'));
    return false;
  }

  await write(mine, 'update', [{ initiative: b }]);
  await write(theirs, 'update', [{ initiative: a }]);
  ctx.chat.push(escape(T('InitiativeSwapped', { name: ctx.actor?.name ?? '', target: other.name })));
});

/** Ask how to share up to `total` points among the recipients: {uuid: points}, or null. */
async function askShares(step, list, total, ctx) {
  if (ctx.askShares) {
    return ctx.askShares(step, list, total, ctx);
  }

  const { DialogV2 } = globalThis.foundry.applications.api;
  const rows = list.map((actor, i) => `<div class="form-group"><label>${escape(actor.name)}${initiativeOf(actor) !== null ? ` (${initiativeOf(actor)})` : ''}</label><input type="number" name="r${i}" value="0" min="0" max="${total}" /></div>`).join('');
  const answer = await DialogV2.wait({
    window: { title: ctx.item?.name ?? '' },
    classes: ['essence20', 'e20-window'],
    content: `<p>${escape(step.prompt ?? T('DistributePrompt', { total }))}</p>${rows}`,
    buttons: [
      { action: 'ok', label: globalThis.game.i18n.localize('E20.DialogConfirmButton'), default: true,
        callback: (event, button) => Object.fromEntries(list.map((actor, i) => [actor.uuid, Math.max(0, Number(button.form.elements[`r${i}`]?.value) || 0)])) },
      { action: 'cancel', label: globalThis.game.i18n.localize('E20.DialogCancelButton') },
    ],
    rejectClose: false,
  });
  return answer && typeof answer == 'object' ? answer : null;
}

// distribute: share at most `total` points among the recipients (at least one point in all); each recipient given
// some runs `steps` with it as the target and its share as @var.share. Too many, none, or a cancel stops the run.
registerStep('distribute', async (step, ctx) => {
  const list = recipients(step, ctx);
  const total = Math.max(0, Math.round(resolveValue(step.total ?? 0, { actor: ctx.actor, item: ctx.item, vars: ctx.vars }, 0)));
  if (!list.length || !total) {
    return false;
  }

  const shares = await askShares(step, list, total, ctx);
  const given = shares ? Object.values(shares).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0) : 0;
  if (!shares || given <= 0 || given > total) {
    if (shares) {
      globalThis.ui?.notifications?.warn?.(T('DistributeTooMuch', { total }));
    }

    return false;
  }

  const saved = ctx.targets;
  const lines = [];
  for (const actor of list) {
    const share = Math.max(0, Number(shares[actor.uuid]) || 0);
    if (!share) {
      continue;
    }

    ctx.targets = [actor];
    ctx.vars.share = share;
    lines.push(`${actor.name} +${share}`);
    await runSteps(step.steps ?? [], ctx);
  }

  ctx.targets = saved;
  ctx.chat.push(escape(T('Distributed', { name: ctx.actor?.name ?? '', list: lines.join(', ') })));
}, { errors: (step, where) => (step.total === undefined ? [`${where}: distribute needs a total`] : []), branches: ['steps'] });

/** Combatants in the running combat (for tests and the editor). */
export const combatActors = () => listOf(globalThis.game?.combat?.combatants).map(c => c.actor).filter(Boolean);
