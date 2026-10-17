// Rules-engine plug-in, round 15 (banked - docs/rules-batches/slBanked15.md). Registered on import; see
// module/rules/plugins/index.mjs.
import { bankedEntries, bankRollBonus } from "../../bank.mjs";
import { registerTag } from "../../predicate.mjs";
import { recipients, registerStep } from "../../steps.mjs";
import { itemsOf, sourceOf } from "../shared/zord-crew-lookups.mjs";

const T = (key, data) => {
  const full = `E20.RulesExtBanked.${key}`;
  const text = data ? globalThis.game?.i18n?.format?.(full, data) : globalThis.game?.i18n?.localize?.(full);
  return text && text != full ? text : key;
};

const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

async function write(doc, method, args) {
  const { needsGmRelay, relayToGm } = await import("../../../mechanics/world/gm-relay.mjs");
  return needsGmRelay(doc) ? relayToGm(doc, method, args) : doc[method](...args);
}

async function choose(ctx, title, prompt, options) {
  if (ctx.askPick) {
    return ctx.askPick({ prompt }, options, ctx);
  }

  const { chooseSelect } = await import("../../../mechanics/resources/grants.mjs");
  return chooseSelect(title, escape(prompt), options);
}

/**
 * Step `splitBank` - for a `button` the rule posts after banking an upshift on an ally (Plan of Action's Split, the old
 * items/social/plan-of-action-split.mjs): part of the ↑ this rule's item banked on the run's first target (the ally it went
 * to) moves to another ally the presser picks (any ally of the rule's actor on the scene - nearby-allies.mjs), as many as
 * they choose from 1 to all but one. The first ally keeps the rest; the second gets a bank of its own (same label, the
 * same rolls it applies to and how long it lasts). With no bank of ↑2 or more to split, a warning and the run stops.
 */
registerStep('splitBank', async (step, ctx) => {
  const first = ctx.targets?.[0];
  const entry = first ? [...bankedEntries(first)].reverse().find(bank => bank.source == ctx.item?.id && !bank.defense && bank.shiftUp >= 2) : null;
  if (!entry) {
    globalThis.ui?.notifications?.warn?.(T('SplitBankNothing'));
    return false;
  }

  const { getNearbyAllyTokens } = await import("../../../mechanics/combat/nearby-allies.mjs");
  const allies = [...new Set(getNearbyAllyTokens(ctx.actor, Infinity).map(token => token.actor).filter(ally => ally && ally !== first && ally !== ctx.actor))];
  const title = ctx.item?.name ?? '';
  const secondUuid = await choose(ctx, title, T('SplitBankWho', { name: first.name }), allies.map(ally => ({ value: ally.uuid, label: ally.name })));
  const second = allies.find(ally => ally.uuid == secondUuid);
  if (!second) {
    return false;
  }

  const amounts = Array.from({ length: entry.shiftUp - 1 }, (unused, i) => ({ value: String(i + 1), label: `↑${i + 1}` }));
  const moved = Number(await choose(ctx, title, T('SplitBankHowMany', { name: second.name }), amounts));
  if (!(moved >= 1 && moved < entry.shiftUp)) {
    return false;
  }

  const list = bankedEntries(first).map(bank => (bank.id == entry.id ? { ...bank, shiftUp: bank.shiftUp - moved } : bank));
  await write(first, 'update', [{ 'flags.essence20.ruleBank': list }]);
  await bankRollBonus(second, { label: entry.label, shiftUp: moved, when: entry.when, uses: entry.uses, until: entry.until, source: entry.source, untilActor: ctx.actor }, write);
  ctx.chat.push(escape(T('SplitBankDone', { first: first.name, a: entry.shiftUp - moved, second: second.name, b: moved })));
});

/** The ids of the actor's copies of a book item (the `source` its banks carry). */
function copyIds(actor, uuid) {
  return new Set(itemsOf(actor).filter(item => sourceOf(item) == uuid || item.uuid == uuid).map(item => item.id));
}

/**
 * Tag `self:bankedFrom:<uuid>` (target: too) - a bank that the actor's copy of that book item made is live on the actor
 * (rules/bank.mjs: unspent and not run out). Stand Firm's "while your Stalwart Defense bonus lasts".
 */
export function bankedFrom(actor, uuid) {
  const ids = copyIds(actor, uuid);
  return ids.size > 0 && bankedEntries(actor).some(entry => ids.has(entry.source));
}

registerTag('self:bankedFrom', (rest, ctx) => bankedFrom(ctx?.self, rest), { phrase: ['{who} {has} a bonus banked from {name}', '{who} {has} no bonus banked from {name}'] });
registerTag('target:bankedFrom', (rest, ctx) => (ctx?.other ? bankedFrom(ctx.other, rest) : null), { phrase: ['{who} {has} a bonus banked from {name}', '{who} {has} no bonus banked from {name}'] });

/**
 * Step `scaleBank {from: <uuid>, multiply, to?}` - the live banks the recipient's (default: the actor's) copy of that book
 * item made are scaled in place: their Defense bonus, ↑ and ↓ multiplied (Stand Firm doubling the Stalwart Defense bonus).
 * They keep how long they last. None - the run stops.
 */
registerStep('scaleBank', async (step, ctx) => {
  const factor = Number(step.multiply) || 1;
  let scaled = 0;
  for (const actor of recipients(step, ctx)) {
    const ids = copyIds(actor, String(step.from ?? ''));
    const list = bankedEntries(actor).map(entry => {
      if (!ids.has(entry.source)) {
        return entry;
      }

      scaled++;
      return {
        ...entry, shiftUp: entry.shiftUp * factor, shiftDown: entry.shiftDown * factor,
        ...(entry.defense ? { defenseBonus: (Number(entry.defenseBonus) || 0) * factor } : {}),
      };
    });
    if (scaled) {
      await write(actor, 'update', [{ 'flags.essence20.ruleBank': list }]);
    }
  }

  if (!scaled) {
    return false;
  }
}, { errors: (step, where) => [...(step.from ? [] : [`${where}: scaleBank needs from (a book item uuid)`]), ...(Number(step.multiply) > 0 ? [] : [`${where}: scaleBank needs multiply`])] });
