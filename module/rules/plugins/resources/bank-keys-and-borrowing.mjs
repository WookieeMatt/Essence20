// Rules-engine plug-ins, round 16 (part b - docs/rules-batches/slLeftB16.md). Registered on import; see
// module/rules/plugins/index.mjs.
import { bankedEntries } from "../../bank.mjs";
import { contextFor, evaluate, registerTag, sideActorsWithin } from "../../predicate.mjs";
import { recipients, registerPickSource, registerStep } from "../../steps.mjs";
import { escapeHtml, localized, T } from "../shared/left-b-text.mjs";

/**
 * Borrowed Specializations and keyed banks (Data Bridge, Think Tank, Misery Loves Company, Tactical Triangulation):
 *
 *  - Pick source `allySpecializations` - every Skill Specialization an ally on the scene holds (the system's ally count,
 *    any range): value the Skill, label "<Specialization> (<Skill>) - <ally>". With `perAlly: true`, one option per ally
 *    holding any (allies of the same name count as one), value every Skill they're Specialized in joined by "|".
 *  - Tag `self:allySpecializations` - some ally on the scene holds a Specialization.
 *  - Tag `skill:in:<a|b|...>` - the rolled Skill is one of these (`skill:in:{var.picked}` after a perAlly pick).
 *  - Tags `self:bankKey:<key>` / `target:bankKey:<key>` - the actor holds a live banked bonus under that `key` (the bank
 *    step's key). `self:sideBankKey:<key>` - the actor (with a token on the scene) or an ally on the scene does;
 *    `self:sideStatus:<a|b>` - the actor (with a token) or an ally has one of those Conditions.
 *  - `hasBankKey(actor, key)` / `bankKeySideCount(actor, key)` - the same facts for hand-written readers (dice.mjs's
 *    DataBridgeBonus: "allies currently benefitting from your Data Bridge").
 *  - Step `moveCondition {conditions, from?, to?, toFilter?, title?, fromLabel?, toLabel?}` - one dialog: which (creature,
 *    Condition) pair among the `from` recipients (default "allies+self:999999", the actor counted only with a token on
 *    the scene) loses its Condition, and which of the `to` recipients (default the same, narrowed by `toFilter`, tags
 *    asked as the target) gains it. Nothing to choose, a cancel or the same creature twice stops the run. Labels may be
 *    E20. keys.
 */

const ALLY_RANGE = Infinity;

/** The actor's allies on the scene - the system's own count (mechanics/combat/nearby-allies.mjs), any range. */
function alliesOf(actor) {
  return sideActorsWithin(actor, ALLY_RANGE, 'ally');
}

const hasToken = actor => !!actor?.getActiveTokens?.()?.[0];

/** The actor (when it has a token on the scene) and its allies there - the old "own token, then the allies" list. */
function sideOf(actor) {
  return [...(hasToken(actor) ? [actor] : []), ...alliesOf(actor)];
}

const skillName = skill => globalThis.game?.i18n?.localize?.(globalThis.CONFIG?.E20?.skills?.[skill] ?? skill) ?? skill;

/** Every [ally, skill, Specialization name] an ally on the scene offers. */
function allySpecializations(actor) {
  const out = [];
  for (const ally of alliesOf(actor)) {
    for (const [skill, data] of Object.entries(ally.system?.skills ?? {})) {
      for (const spec of Object.values(data?.specializations ?? {})) {
        if (spec?.name) {
          out.push({ ally, skill, name: spec.name });
        }
      }
    }
  }

  return out;
}

registerPickSource('allySpecializations', (step, ctx) => {
  const found = allySpecializations(ctx.actor);
  if (!step.perAlly) {
    return found.map(({ ally, skill, name }) => ({ value: skill, label: `${name} (${skillName(skill)}) - ${ally.name}` }));
  }

  const byName = new Map();
  for (const { ally, skill } of found) {
    byName.set(ally.name, [...(byName.get(ally.name) ?? []), skill]);
  }

  return [...byName.entries()].map(([name, skills]) => ({ value: skills.join('|'), label: name }));
});

registerTag('self:allySpecializations', (rest, ctx) => allySpecializations(ctx?.self).length > 0);

registerTag('skill:in', (rest, ctx) => (ctx?.rolledSkill === undefined ? null : String(rest ?? '').split('|').includes(ctx.rolledSkill)));

/** Whether the actor holds a live banked bonus under that key. */
export function hasBankKey(actor, key) {
  return !!actor && bankedEntries(actor).some(entry => entry.key == key);
}

/** How many of the actor (counted with or without a token) and its allies on the scene hold a live bank under that key. */
export function bankKeySideCount(actor, key) {
  return (hasBankKey(actor, key) ? 1 : 0) + alliesOf(actor).filter(ally => hasBankKey(ally, key)).length;
}

registerTag('self:bankKey', (rest, ctx) => hasBankKey(ctx?.self, rest));
registerTag('target:bankKey', (rest, ctx) => hasBankKey(ctx?.other, rest));
registerTag('self:sideBankKey', (rest, ctx) => sideOf(ctx?.self).some(actor => hasBankKey(actor, rest)));
registerTag('self:sideStatus', (rest, ctx) => {
  const statuses = String(rest ?? '').split('|').filter(Boolean);
  return sideOf(ctx?.self).some(actor => statuses.some(status => actor.statuses?.has?.(status)));
});

/* -------------------------------------------- */
/*  moveCondition                                */
/* -------------------------------------------- */

const conditionName = status => localized(`E20.Status${status.charAt(0).toUpperCase()}${status.slice(1)}`);

/** A list step key's actors: a recipient spec, or (none given) the actor with a token and its allies, any range. */
function listFor(spec, ctx) {
  return spec ? recipients({ to: spec }, ctx) : sideOf(ctx.actor);
}

/** Ask which pair and which receiver; resolves {pair, to} or null. */
async function askMove(step, pairs, receivers) {
  const select = (name, rows) => `<select name="${name}">${rows.map((label, index) => `<option value="${index}">${escapeHtml(label)}</option>`).join('')}</select>`;
  const chosen = await globalThis.foundry?.applications?.api?.DialogV2?.wait?.({
    window: { title: localized(step.title ?? 'E20.MiseryLovesCompanyPickTransferTitle') },
    classes: ['window-app', 'e20-window'],
    content: `<div class="form-group"><label>${escapeHtml(localized(step.fromLabel ?? 'E20.MiseryLovesCompanyCureLabel'))}</label>${select('pair', pairs.map(pair => `${pair.actor.name} - ${conditionName(pair.condition)}`))}</div>`
      + `<div class="form-group"><label>${escapeHtml(localized(step.toLabel ?? 'E20.MiseryLovesCompanyTransmitLabel'))}</label>${select('to', receivers.map(actor => actor.name))}</div>`,
    modal: true,
    buttons: [
      { label: localized('E20.DialogConfirmButton'), action: 'confirm', callback: (event, button) => ({ pair: button.form.elements.pair.value, to: button.form.elements.to.value }) },
      { label: localized('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });
  if (!chosen || chosen == 'cancel') {
    return null;
  }

  const pair = pairs[Number(chosen.pair)];
  const to = receivers[Number(chosen.to)];
  return pair && to ? { pair, to } : null;
}

registerStep('moveCondition', async (step, ctx) => {
  const conditions = Array.isArray(step.conditions) ? step.conditions : [];
  const pairs = [];
  for (const actor of listFor(step.from, ctx)) {
    for (const condition of conditions) {
      if (actor?.statuses?.has?.(condition)) {
        pairs.push({ actor, condition });
      }
    }
  }

  const filter = Array.isArray(step.toFilter) ? step.toFilter : [];
  const destinations = listFor(step.to, ctx).filter(actor => !filter.length
    || evaluate(filter, contextFor({ self: ctx.actor, holder: ctx.actor, ruleItem: ctx.item, other: actor })) === true);
  if (!pairs.length || !destinations.length) {
    return false;
  }

  const picked = await (ctx.askMove ?? askMove)(step, pairs, destinations);
  if (!picked || picked.pair.actor === picked.to) {
    return false;
  }

  const { write } = await import("../shared/chat-speaker-helpers.mjs");
  await write(picked.pair.actor, 'toggleStatusEffect', [picked.pair.condition, { active: false }]);
  await write(picked.to, 'toggleStatusEffect', [picked.pair.condition, { active: true }]);
  ctx.vars.moved = picked.pair.condition;
  ctx.chat.push(escapeHtml(T('ConditionMoved', { condition: conditionName(picked.pair.condition), from: picked.pair.actor.name, to: picked.to.name })));
}, {
  errors: (step, where) => (Array.isArray(step.conditions) && step.conditions.length ? [] : [`${where}: moveCondition needs conditions (status ids)`]),
});
