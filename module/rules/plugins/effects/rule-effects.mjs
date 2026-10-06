import { formulaError, resolveValue } from "../../formula.mjs";
import { recipients, registerStep } from "../../steps.mjs";
import { listOf, localize, read, write } from "../shared/copy-and-data-helpers.mjs";

/**
 * Group H: Active Effects made by a rule, and a value kept to be put back later.
 *
 *   addEffect {changes: [{key, value, mode?}], name?, img?, on?: item | actor, to?, flags?}
 *       An Active Effect with those changes - on the rule's own item (on: item, the default: it transfers to the actor
 *       and goes with the item) or on each recipient (on: actor). `value` is a formula (@var.penalty, -@var.x), stored
 *       as its number; `mode` defaults to 2 (add). A key holding `{movement}` is repeated for every Movement type the
 *       actor has a base speed in (system.movement.{movement}.bonus). Keys and the name fill {choice.x} / {var.x}; the name may be an E20. key.
 *       `flags` are set under flags.essence20 on the effect (so removeEffects - or older code - can find it).
 *   removeEffects {flag, to?}
 *       Delete the recipients' Active Effects carrying flags.essence20.<flag>.
 *   keepValue {path, at}
 *       Copy the actor's value at `path` ({choice.x} / {var.x} / {item.<path>} filled) onto the rule's item at `at` - the
 *       Skill die before a step moves it.
 *   restoreValue {path, from}
 *       Put the value the rule's item keeps at `from` back at the actor's `path` (same filling) - skipped when the item
 *       keeps none or the actor has nothing at that path's parent (a Skill it no longer has). Works in a `removed`
 *       Trigger (the item is read as it was).
 */

/** {choice.x}, {var.x} and {item.<path>} filled from the run. */
export function fill(text, ctx) {
  return String(text ?? '')
    .replace(/\{choice\.([\w-]+)\}/g, (match, key) => String(ctx.item?.flags?.essence20?.rules?.choices?.[key] ?? ''))
    .replace(/\{var\.([\w-]+)\}/g, (match, key) => String(ctx.vars?.[key] ?? ''))
    .replace(/\{item\.([\w.-]+)\}/g, (match, path) => String(read(ctx.item, path) ?? ''));
}

/** The Movement types the actor has a base speed in. */
function movementTypes(actor) {
  return Object.entries(actor?.system?.movement ?? {}).filter(([, movement]) => (Number(movement?.base) || 0) > 0).map(([key]) => key);
}

function effectChanges(step, ctx, actor) {
  const out = [];
  for (const change of Array.isArray(step.changes) ? step.changes : []) {
    const value = String(Math.round(resolveValue(change.value ?? 0, { actor: ctx.actor, item: ctx.item, vars: ctx.vars, other: ctx.targets?.[0] ?? null }, 0)));
    const mode = Number.isFinite(Number(change.mode)) ? Number(change.mode) : 2;
    const key = fill(change.key, ctx);
    const keys = key.includes('{movement}') ? movementTypes(actor).map(type => key.replace(/\{movement\}/g, type)) : [key];
    keys.forEach(one => out.push({ key: one, mode, value }));
  }

  return out;
}

registerStep('addEffect', async (step, ctx) => {
  const onItem = (step.on ?? 'item') == 'item';
  const holders = onItem ? (ctx.item ? [ctx.item] : []) : recipients(step, ctx);
  if (!holders.length) {
    return false;
  }

  for (const holder of holders) {
    const actor = onItem ? ctx.actor : holder;
    const data = {
      name: localize(fill(step.name ?? ctx.item?.name ?? '', ctx)) || ctx.item?.name || '',
      img: step.img ?? ctx.item?.img ?? 'icons/svg/aura.svg',
      disabled: false,
      changes: effectChanges(step, ctx, actor),
      ...(onItem ? { transfer: true } : {}),
      ...(step.flags ? { flags: { essence20: { ...step.flags } } } : {}),
    };
    await write(holder, 'createEmbeddedDocuments', ['ActiveEffect', [data]]);
  }
}, {
  errors: (step, where) => [
    ...(Array.isArray(step.changes) && step.changes.length && step.changes.every(change => change?.key) ? [] : [`${where}: addEffect needs changes (each with a key)`]),
    ...(Array.isArray(step.changes) ? step.changes.map(change => formulaError(change?.value ?? 0) && `${where}: addEffect value: ${formulaError(change.value)}`).filter(Boolean) : []),
    ...(['item', 'actor', undefined].includes(step.on) ? [] : [`${where}: addEffect on must be item or actor`]),
  ],
});

registerStep('removeEffects', async (step, ctx) => {
  for (const actor of recipients(step, ctx)) {
    const ids = listOf(actor?.effects).filter(effect => effect?.flags?.essence20?.[step.flag]).map(effect => effect.id);
    if (ids.length) {
      await write(actor, 'deleteEmbeddedDocuments', ['ActiveEffect', ids]);
    }
  }
}, { errors: (step, where) => (typeof step.flag == 'string' && /^[\w-]+$/.test(step.flag) ? [] : [`${where}: removeEffects needs a flag name`]) });

registerStep('keepValue', async (step, ctx) => {
  const path = fill(step.path, ctx);
  if (!ctx.item || !path || /\.\./.test(path) || path.endsWith('.')) {
    return false;
  }

  const value = read(ctx.actor, path);
  await write(ctx.item, 'update', [{ [step.at]: value ?? null }]);
  globalThis.foundry?.utils?.setProperty?.(ctx.item, step.at, value ?? null);
}, { errors: (step, where) => (step.path && /^flags\./.test(String(step.at ?? '')) ? [] : [`${where}: keepValue needs a path and an at (a flags. path on the item)`]) });

registerStep('restoreValue', async (step, ctx) => {
  const value = read(ctx.item, step.from);
  const path = fill(step.path, ctx);
  const parent = path.split('.').slice(0, -1).join('.');
  if (value === undefined || value === null || !path || /\.\./.test(path) || read(ctx.actor, parent) === undefined || read(ctx.actor, parent) === null) {
    return;
  }

  await write(ctx.actor, 'update', [{ [path]: value }]);
}, { errors: (step, where) => (step.path && step.from ? [] : [`${where}: restoreValue needs a path and a from`]) });
