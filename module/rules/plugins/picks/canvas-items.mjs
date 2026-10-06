import { getSceneEpoch } from "../../../mechanics/resources/scene-clock.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerPickSource, registerStep } from "../../steps.mjs";
import { write } from "../shared/chat-speaker-helpers.mjs";

/**
 * Picking what others on the scene have, and a per-scene list of picks (round 15, uses - I Can Do That):
 *   - Pick source `canvasItems {filter?, anyOf?, self?}` - the items of the actors of the canvas tokens (not the actor's own
 *     unless `self: true`) that meet `filter` (item tags, all of them) or any one of the tag lists in `anyOf`; one entry per
 *     book source (value: the source uuid), labelled "<actor>: <item>".
 *   - Pick source `sceneList {flag}` - the entries `addToSceneList` kept on the actor this scene.
 *   - Step `addToSceneList {flag, entry}` - keep `entry` (text, default "{var.picked}") on the actor under flags.essence20.<flag>
 *     as {scene, list: [{value, label}]}, labelled as the pick offered it; a new scene starts the list afresh.
 */

const varText = (text, ctx) => String(text).replace(/\{var\.([\w-]+)\}/g, (match, key) => String(ctx.vars?.[key] ?? ''));
const listOf = collection => collection?.contents ?? (collection ? [...collection] : []);
const sourceOf = item => item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource ?? null;

registerPickSource('canvasItems', (step, ctx) => {
  const all = Array.isArray(step.filter) ? step.filter : [];
  const alternatives = Array.isArray(step.anyOf) ? step.anyOf.filter(Array.isArray) : [];
  const options = [];
  for (const token of globalThis.canvas?.tokens?.placeables ?? []) {
    const other = token?.actor;
    if (!other || (!step.self && (other === ctx.actor || other.id == ctx.actor?.id))) {
      continue;
    }

    for (const item of listOf(other.items)) {
      const facts = contextFor({ self: ctx.actor, other, ruleItem: ctx.item, item });
      const fits = evaluate(all, facts) === true && (!alternatives.length || alternatives.some(tags => evaluate(tags, facts) === true));
      const source = sourceOf(item);
      if (fits && source && !options.some(option => option.value == source)) {
        options.push({ value: source, label: `${other.name}: ${item.name}` });
      }
    }
  }

  // addToSceneList labels its entry the way it was offered.
  ctx.vars.optionLabels = { ...(ctx.vars.optionLabels ?? {}), ...Object.fromEntries(options.map(option => [option.value, option.label])) };
  return options;
});

function sceneListOf(actor, flag) {
  const kept = actor?.flags?.essence20?.[flag];
  return kept && kept.scene == getSceneEpoch() && Array.isArray(kept.list) ? kept.list : [];
}

registerPickSource('sceneList', (step, ctx) => {
  const list = sceneListOf(ctx.actor, String(step.flag ?? ''));
  ctx.vars.optionLabels = { ...(ctx.vars.optionLabels ?? {}), ...Object.fromEntries(list.map(entry => [entry.value, entry.label])) };
  return list.map(entry => ({ value: entry.value, label: entry.label }));
});

registerStep('addToSceneList', async (step, ctx) => {
  const flag = String(step.flag ?? '');
  const value = varText(step.entry ?? '{var.picked}', ctx);
  if (!flag || !value || !ctx.actor) {
    return;
  }

  const list = sceneListOf(ctx.actor, flag);
  if (list.some(entry => entry.value == value)) {
    return;
  }

  const label = ctx.vars.optionLabels?.[value] ?? ctx.vars.granted?.name ?? value;
  await write(ctx.actor, 'setFlag', ['essence20', flag, { scene: getSceneEpoch(), list: [...list, { value, label }] }]);
}, {
  errors: (step, where) => (typeof step.flag == 'string' && step.flag ? [] : [`${where}: flag must be text`]),
});
