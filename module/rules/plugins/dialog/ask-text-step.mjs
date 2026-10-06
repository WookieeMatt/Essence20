import { registerStep } from "../../steps.mjs";
import { escape } from "../shared/chat-speaker-helpers.mjs";

/**
 * The askText step (round 10, group D - docs/rules-batches/slD10.md): a line of text typed into @var. (askChoiceText,
 * which keeps it on the rule's item, is ./ask-choice-text-step.mjs.)
 */

/** Ask for a line of text. */
async function askText(step, ctx) {
  if (ctx.askText) {
    return ctx.askText(step, ctx);
  }

  const { DialogV2 } = globalThis.foundry.applications.api;
  const value = await DialogV2.prompt({
    window: { title: ctx.item?.name ?? '' },
    classes: ['essence20', 'e20-window'],
    content: `<div class="form-group"><label>${escape(step.prompt ?? '')}</label><input type="text" name="text" value="" autofocus></div>`,
    ok: { callback: (event, button) => String(button.form.elements.text.value ?? '') },
    rejectClose: false,
  });
  return typeof value == 'string' ? value : null;
}

// askText {var, prompt, firstWord?}: the player types something ({var.<var>}); empty or cancelled stops the run.
registerStep('askText', async (step, ctx) => {
  let text = await askText(step, ctx);
  text = String(text ?? '').trim();
  if (step.firstWord) {
    text = text.split(/\s+/)[0] ?? '';
  }

  if (!text) {
    return false;
  }

  ctx.vars[step.var || 'text'] = text;
}, { errors: (step, where) => (step.var && !/^[\w-]+$/.test(step.var) ? [`${where}: var must be a plain name`] : []) });
