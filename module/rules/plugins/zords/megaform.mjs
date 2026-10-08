import { registerDerived } from "../../../mechanics/item-hooks.mjs";
import { rulesOfType } from "../../index.mjs";
import { linkedEntries } from "../../links.mjs";
import { contextFor, evaluate, registerTag } from "../../predicate.mjs";
import { resolveValue } from "../../formula.mjs";
import { registerPickSource, registerStep } from "../../steps.mjs";
import { registerEvent, registerRuleType } from "../../types.mjs";
import { escape, flagOf, holderOf, isCombinerForm, itemsOf, megaformsContaining, rosterOf, sourceOf, T, write } from "../shared/zord-crew-lookups.mjs";

/**
 * Group A: Megaform pieces.
 *
 * - Rule type `MegaformHealth` {amount} (scope megaform): the holder's own row of the Megaform's Health array, and the
 *   combined Health, gain that much (Roller Drum).
 * - Rule type `MegaformMirror` {items: [item tags]} (on a participant): the participant's items the tags match are
 *   mirrored onto every Megaform it is part of while it stays in it (Power Master: Perks and Powers; Target Master:
 *   weapons). Kept in step when the roster changes, and by the step `megaformSync`.
 * - Event `megaformCombined`: a Megaform's roster changed (fired on the Megaform, by the client that changed it;
 *   `@var.participants`, `@var.zords`). Participants' Triggers reach it through `scope: megaform`.
 * - Tags `item:attachedAttack` (a weapon's own attack), `target:combinerForm`.
 */

registerEvent('megaformCombined');

/* -------------------------------------------- */
/*  MegaformHealth                               */
/* -------------------------------------------- */

registerRuleType('MegaformHealth', {
  params: { amount: { kind: 'formula', required: true } },
  scopes: ['megaform'],
});

/** The participants' MegaformHealth rules, added to their rows and the combined Health. */
export function megaformHealthDerived(actor) {
  const system = actor?.system;
  if (actor?.type != 'megaform' || !system) {
    return;
  }

  for (const { rule, item, holder } of linkedEntries(actor, 'MegaformHealth')) {
    if ((rule.scope ?? 'self') != 'megaform' || evaluate(rule.when, contextFor({ self: actor, holder, ruleItem: item })) !== true) {
      continue;
    }

    const amount = Math.round(resolveValue(rule.amount, { actor: holder, item }, 0));
    if (!amount) {
      continue;
    }

    const row = (system.participantHealth ?? []).find(entry => entry.name == holder.name);
    if (row) {
      row.max += amount;
      row.value += amount;
    }

    system.combinedHealthMax = (system.combinedHealthMax ?? 0) + amount;
    system.combinedHealthValue = (system.combinedHealthValue ?? 0) + amount;
    if (system.health) {
      system.health.max = (system.health.max ?? 0) + amount;
      system.health.value = (system.health.value ?? 0) + amount;
    }
  }
}

registerDerived(megaformHealthDerived);

/* -------------------------------------------- */
/*  MegaformMirror                               */
/* -------------------------------------------- */

registerRuleType('MegaformMirror', {
  params: { items: { kind: 'object', required: true } },
  scopes: ['self'],
  validate: rule => (Array.isArray(rule.items) && rule.items.length ? [] : ['items must be a list of item: tags']),
});

export const MIRROR_FLAG = 'zord1MirrorOf';

// A weapon's own attack (a weaponEffect attached to a weapon).
registerTag('item:attachedAttack', (rest, ctx) => ctx.item?.type == 'weaponEffect' && !!ctx.item.flags?.essence20?.parentId, { phrase: ["{who} {is} a weapon's own attack", "{who} {isnt} a weapon's own attack"] });
registerTag('target:combinerForm', (rest, ctx) => isCombinerForm(ctx.other), { phrase: ['{who} {is} a Combiner form', '{who} {isnt} a Combiner form'] });

/** What a Megaform should be carrying from its participants' MegaformMirror rules: [{key, item}]. */
export function desiredMirrors(megaform) {
  const out = [];
  for (const actor of rosterOf(megaform)) {
    const rules = rulesOfType(actor, 'MegaformMirror');
    if (!rules.length) {
      continue;
    }

    for (const item of itemsOf(actor)) {
      if (flagOf(item, MIRROR_FLAG)) {
        continue;
      }

      const wanted = rules.some(({ rule, item: ruleItem }) => evaluate(rule.when, contextFor({ self: actor, ruleItem })) === true
        && evaluate(rule.items, contextFor({ self: actor, ruleItem, item })) === true);
      if (wanted) {
        out.push({ key: `${actor.uuid}|${item.id}`, item });
      }
    }
  }

  return out;
}

/** Bring a Megaform's mirrored items in line with its participants. */
export async function syncMirrors(megaform) {
  if (megaform?.type != 'megaform') {
    return;
  }

  const want = desiredMirrors(megaform);
  const wantKeys = new Set(want.map(entry => entry.key));
  const have = itemsOf(megaform).filter(item => flagOf(item, MIRROR_FLAG));
  const haveKeys = new Set(have.map(item => flagOf(item, MIRROR_FLAG)));
  const stale = have.filter(item => !wantKeys.has(flagOf(item, MIRROR_FLAG))).map(item => item.id);
  if (stale.length) {
    await megaform.deleteEmbeddedDocuments('Item', stale);
  }

  const fresh = want.filter(entry => !haveKeys.has(entry.key)).map(({ key, item }) => {
    const data = item.toObject();
    globalThis.foundry.utils.setProperty(data, `flags.essence20.${MIRROR_FLAG}`, key);
    if (!sourceOf(data) && item.uuid) {
      globalThis.foundry.utils.setProperty(data, 'flags.core.sourceId', item.uuid);
    }

    return data;
  });
  if (fresh.length) {
    // Same ids as the participant's items, so a mirrored attack still points at its weapon.
    await megaform.createEmbeddedDocuments('Item', fresh, { keepId: true });
  }
}

// megaformSync: every Megaform the actor is part of mirrors its items again; @var.megaforms names them.
registerStep('megaformSync', async (step, ctx) => {
  const megaforms = megaformsContaining(ctx.actor);
  for (const megaform of megaforms) {
    await syncMirrors(megaform);
  }

  ctx.vars.megaforms = megaforms.map(megaform => megaform.name).join(', ');
  ctx.vars.megaformCount = megaforms.length;
});

/* -------------------------------------------- */
/*  The roster changes                           */
/* -------------------------------------------- */

/** A Megaform's roster changed on this client: its mirrors follow, and megaformCombined Triggers run. */
export async function onRosterChanged(megaform) {
  await syncMirrors(megaform);
  const roster = rosterOf(megaform);
  const { fireTriggers } = await import("../../triggers.mjs");
  await fireTriggers(megaform, 'megaformCombined', {
    vars: { participants: roster.length, zords: roster.filter(actor => actor.type == 'zord').length },
  });
}

globalThis.Hooks?.on?.('updateActor', (actor, changes, options, userId) => {
  if (userId == globalThis.game?.user?.id && actor?.type == 'megaform' && changes?.system?.actors !== undefined) {
    onRosterChanged(actor);
  }
});

export { holderOf };

/* -------------------------------------------- */
/*  Noted entries (Multi-Megaform)               */
/* -------------------------------------------- */

/** The uuids noted on an item under choices.<key> (or at its legacy path). */
export function notedOn(item, key, legacy = null) {
  const stored = item?.flags?.essence20?.rules?.choices?.[key];
  const list = Array.isArray(stored) ? stored : legacy ? String(legacy).split('.').reduce((at, part) => at?.[part], item) : null;
  return Array.isArray(list) ? list.map(entry => (typeof entry == 'string' ? entry : entry?.uuid)).filter(Boolean) : [];
}

/** What the actor's other copies of this item have noted under the key. */
export function notedOnOtherCopies(item, key, legacy = null) {
  const source = sourceOf(item);
  return itemsOf(holderOf(item)).filter(other => other !== item && other.id != item?.id && source && sourceOf(other) == source)
    .flatMap(other => notedOn(other, key, legacy));
}

/**
 * noteEntries {key, count, from: {type}, title?, legacy?} - choose up to `count` different compendium entries one at a
 * time and note them on the rule's item (choices.<key>, a uuid list), replacing the old list. Entries already noted on
 * the actor's other copies of the item are left out. Stopping part way keeps the ones chosen; stopping at the first
 * keeps the old list and stops the run. @var.noted is the count.
 */
registerStep('noteEntries', async (step, ctx) => {
  const key = String(step.key ?? '');
  if (!key || !ctx.item) {
    return false;
  }

  const helpers = ctx.grantHelpers ?? await import("../../../mechanics/resources/grants.mjs");
  const rows = await helpers.findItems({ type: step.from?.type });
  const taken = new Set(notedOnOtherCopies(ctx.item, key, step.legacy));
  const count = Math.max(0, Math.round(resolveValue(step.count ?? 1, { actor: ctx.actor, item: ctx.item, vars: ctx.vars }, 1)));
  const chosen = [];
  for (let i = 0; i < count; i++) {
    const title = String(step.title ?? T('NoteNth', { n: i + 1, count })).replace('{n}', i + 1);
    const uuid = await helpers.pickOne(title, rows.filter(row => !chosen.includes(row.uuid) && !taken.has(row.uuid)));
    if (!uuid) {
      break;
    }

    chosen.push(uuid);
  }

  if (!chosen.length) {
    return false;
  }

  await write(ctx.item, 'update', [{ [`flags.essence20.rules.choices.${key}`]: chosen }]);
  globalThis.foundry?.utils?.setProperty?.(ctx.item, `flags.essence20.rules.choices.${key}`, chosen);
  ctx.vars.noted = chosen.length;
  ctx.chat.push(escape(T('Noted', { name: ctx.item.name, n: chosen.length })));
}, { errors: (step, where) => [...(step.key ? [] : [`${where}: noteEntries needs a key`]), ...(step.from?.type ? [] : [`${where}: noteEntries needs from.type`])] });

// pick from: noted {list: <key>, listLegacy?} - the entries noteEntries kept on this item.
registerPickSource('noted', (step, ctx) => notedOn(ctx.item, String(step.list ?? ''), step.listLegacy)
  .map(uuid => ({ value: uuid, label: globalThis.fromUuidSync?.(uuid, { strict: false })?.name ?? uuid })));

