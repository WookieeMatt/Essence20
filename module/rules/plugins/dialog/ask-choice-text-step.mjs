import { registerStep } from "../../steps.mjs";
import { rememberChoice as remember } from "../shared/zord-crew-lookups.mjs";

/**
 * Group A (round 10): step `askChoiceText` {key, prompt?} - the player types a text, kept on the rule's item
 * (rules.choices.<key>, read back with {choice.<key>}) and as @var / {var.<key>}. Cancelled or empty: the run stops.
 * (askText, which only fills @var, is ./ask-text-step.mjs.)
 */

registerStep('askChoiceText', async (step, ctx) => {
  const key = String(step.key ?? '');
  const text = ctx.askText ? await ctx.askText(step, ctx) : await promptText(step, ctx);
  if (!key || !text || !String(text).trim()) {
    return false;
  }

  const value = String(text).trim();
  ctx.vars[key] = value;
  if (ctx.item) {
    await remember(ctx.item, key, value);
  }
}, { errors: (step, where) => (step.key ? [] : [`${where}: askChoiceText needs a key`]) });

async function promptText(step, ctx) {
  const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const { DialogV2 } = globalThis.foundry.applications.api;
  return DialogV2.prompt({
    window: { title: ctx.item?.name ?? '' },
    classes: ['essence20', 'e20-window'],
    content: `<div class="form-group"><label>${escape(step.prompt ?? '')}</label><input type="text" name="text" autofocus></div>`,
    ok: { callback: (event, button) => button.form.elements.text.value },
    rejectClose: false,
  });
}
