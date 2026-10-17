import { setShape, shapeOf } from "../../../items/forms/pony-shape-shifting.mjs";
import { rulesOfType } from "../../index.mjs";
import { registerTag } from "../../predicate.mjs";
import { registerStep } from "../../steps.mjs";
import { registerRuleType } from "../../types.mjs";
import { escape, write } from "../shared/chat-speaker-helpers.mjs";

/**
 * A changed shape as rule data (round 15, items1) - the MLP shape-shifters' shared shape (flags.essence20.mlpShape, this
 * scene only: items/forms/pony-shape-shifting.mjs#shapeOf - check:shapeShifted and the shape spells read it too).
 *
 *  - Rule type `ShapeOption {key?, kind: skill | size, label}` - a pick the shape change offers: `skill` - a Skill kept
 *    in the shape under `key` (Face-Shift's faceSkill, Master Morph's morphSkill), "none" allowed; `size` - a new size
 *    up to one step away per ShapeOption size rule the actor has (each Size-Shift copy). `label`: an E20 key or text.
 *  - Step `changeShape {title?, prompt?}` - while shaped this scene, back to normal (the size it had); else one dialog
 *    with every ShapeOption the actor's items give, and the shape is taken for the scene.
 *  - Tag `shape:skill:<key>` - the rolled Skill is the one the current shape keeps under that key.
 *  Shape-Shift, Face-Shift, Master Morph, Size-Shift.
 */

registerRuleType('ShapeOption', {
  params: { key: { kind: 'string' }, kind: { kind: 'enum', options: ['skill', 'size'] }, label: { kind: 'string' } },
  scopes: ['self'],
  validate: rule => [
    ...(['skill', 'size'].includes(rule.kind) ? [] : ['kind must be skill or size']),
    ...(rule.kind == 'skill' && !/^[\w-]+$/.test(String(rule.key ?? '')) ? ['a skill option needs a key'] : []),
  ],
});

const i18n = (key, data) => {
  const text = String(key ?? '');
  if (!text.startsWith('E20.')) {
    return text;
  }

  return (data ? globalThis.game?.i18n?.format?.(text, data) : globalThis.game?.i18n?.localize?.(text)) ?? text;
};

/** The shape choices the actor's ShapeOption rules give: {skills: [{key, label}], sizeSteps}. */
export function shapeOptions(actor) {
  const skills = [];
  let sizeSteps = 0;
  for (const { rule } of rulesOfType(actor, 'ShapeOption')) {
    if (rule.kind == 'size') {
      sizeSteps++;
    } else if (rule.kind == 'skill' && !skills.some(skill => skill.key == rule.key)) {
      skills.push({ key: rule.key, label: rule.label ?? rule.key });
    }
  }

  return { skills, sizeSteps };
}

registerStep('changeShape', async (step, ctx) => {
  const actor = ctx.actor;
  const current = shapeOf(actor);
  if (current) {
    if (current.originalSize) {
      await write(actor, 'update', [{ 'system.size': current.originalSize }]);
    }

    await actor.unsetFlag('essence20', 'mlpShape');
    ctx.chat.push(escape(i18n('E20.Mlp1ShapeEnds', { name: actor.name })));
    return;
  }

  const E20 = globalThis.CONFIG?.E20 ?? {};
  const { skills, sizeSteps } = shapeOptions(actor);
  const skillList = Object.entries(E20.skills ?? {}).map(([value, label]) => `<option value="${value}">${escape(i18n(label))}</option>`).join('');
  const sizes = Object.keys(E20.actorSizes ?? {});
  const here = sizes.indexOf(actor.system?.size ?? 'common');
  const sizeList = sizeSteps ? sizes.map((size, at) => [size, at]).filter(([, at]) => Math.abs(at - here) <= sizeSteps)
    .map(([size]) => `<option value="${size}" ${size == actor.system?.size ? 'selected' : ''}>${escape(i18n(E20.actorSizes[size]))}</option>`).join('') : '';
  const answer = await globalThis.foundry.applications.api.DialogV2.wait({
    window: { title: i18n(step.title ?? 'E20.Mlp1ShapeTitle') },
    classes: ["window-app", "e20-window"],
    content: [
      ...skills.map(({ key, label }) => `<div class="form-group"><label>${escape(i18n(label))}</label><select name="${key}"><option value="">${escape(i18n('E20.None'))}</option>${skillList}</select></div>`),
      sizeSteps ? `<div class="form-group"><label>${escape(i18n(rulesOfType(actor, 'ShapeOption').find(({ rule }) => rule.kind == 'size')?.rule.label ?? 'E20.Mlp1Size'))}</label><select name="size">${sizeList}</select></div>` : '',
      `<p>${escape(i18n(step.prompt ?? 'E20.Mlp1ShapePrompt'))}</p>`,
    ].join(''),
    buttons: [
      { action: 'ok', label: i18n('E20.DialogConfirmButton'), default: true, callback: (event, button) => ({
        ...Object.fromEntries(skills.map(({ key }) => [key, button.form.elements[key]?.value || null])),
        size: button.form.elements.size?.value || null,
      }) },
      { action: 'cancel', label: i18n('E20.DialogCancelButton') },
    ],
    rejectClose: false,
  });
  if (!answer || answer == 'cancel') {
    return false;
  }

  const shape = Object.fromEntries(skills.map(({ key }) => [key, answer[key] ?? null]));
  if (answer.size && answer.size != actor.system?.size) {
    shape.originalSize = actor.system?.size ?? 'common';
    await write(actor, 'update', [{ 'system.size': answer.size }]);
  }

  await setShape(actor, shape);
  ctx.chat.push(escape(i18n('E20.Mlp1ShapeChanged', { name: actor.name })));
}, { errors: (step, where) => ['title', 'prompt'].filter(key => step[key] !== undefined && typeof step[key] != 'string').map(key => `${where}: changeShape ${key} must be text`) });

registerTag('shape:skill', (key, ctx) => {
  const shape = shapeOf(ctx.self);
  return !!shape?.[key] && !!ctx.rolledSkill && shape[key] == ctx.rolledSkill;
}, { phrase: ["the Skill is your changed shape's {arg}", "the Skill isn't your changed shape's {arg}"] });
