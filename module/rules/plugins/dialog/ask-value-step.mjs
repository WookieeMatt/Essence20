import { registerStep } from "../../steps.mjs";

/**
 * Step `askValue {var, prompt?}` (round 15, systems - docs/rules-batches/slSystems15.md): the player types any number -
 * decimals and negatives too, no range (an Initiative to move to: Chronomantic Pulse) - kept as `@var.<var>`. An empty
 * box, a non-number or a cancel stops the run. (`askNumber` is a whole number within a range.) `prompt` may be an
 * `E20.` key.
 */
registerStep('askValue', async (step, ctx) => {
  const key = String(step.var || 'value');
  const ask = ctx.askValue ?? (async () => {
    const { DialogV2 } = foundry.applications.api;
    const prompt = step.prompt ? globalThis.game?.i18n?.localize?.(String(step.prompt)) ?? String(step.prompt) : '';
    const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    return DialogV2.prompt({
      window: { title: ctx.item?.name ?? '' },
      classes: ['essence20', 'e20-window'],
      content: `${prompt ? `<p>${escape(prompt)}</p>` : ''}<input type="number" name="value" step="any" autofocus>`,
      ok: { callback: (event, button) => button.form.elements.value.value },
      rejectClose: false,
    });
  });
  const raw = await ask(step, ctx);
  if (raw === null || raw === undefined || raw === '') {
    return false;
  }

  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return false;
  }

  ctx.vars[key] = value;
}, {
  errors: (step, where) => (step.var === undefined || /^[\w-]+$/.test(String(step.var)) ? [] : [`${where}: askValue var must be a plain name`]),
});
