import { registerStep } from "../../steps.mjs";

/**
 * Round 17 (split2 - docs/rules-batches/slSplit217.md): step `makeKit {tier, skills, prompt?, none?}` - the actor picks
 * one of its own Specializations in those Skills and gets a kit of that tier for it (mechanics/resources/kits.mjs#makeKit,
 * granted by the rule's item). `prompt` / `none` (shown when it has no such Specialization - the run stops) may be E20.
 * keys. `@var.kit` / {var.kit} is "<Skill> (<Specialization>)". A cancelled pick stops the run. Earth Defense Command's
 * Space Kit: `{tier: limited, skills: [driving, culture, science, technology]}`.
 */

const localize = key => (/^E20\./.test(String(key ?? '')) ? globalThis.game?.i18n?.localize?.(key) ?? key : String(key ?? ''));

registerStep('makeKit', async (step, ctx) => {
  const actor = ctx.actor;
  const skills = Array.isArray(step.skills) ? step.skills : [];
  const specs = [];
  for (const skill of skills) {
    for (const spec of Object.values(actor?.system?.skills?.[skill]?.specializations ?? {})) {
      if (spec?.name) {
        specs.push({ value: `${skill}|${spec.name}`, label: `${localize(globalThis.CONFIG?.E20?.skills?.[skill] ?? skill)} (${spec.name})` });
      }
    }
  }

  if (!specs.length) {
    globalThis.ui?.notifications?.warn?.(localize(step.none ?? 'E20.RulesExtSplit217.NoSpecialization'));
    return false;
  }

  const { chooseSelect } = await import("../../../mechanics/resources/grants.mjs");
  const picked = await chooseSelect(ctx.item?.name ?? '', localize(step.prompt ?? 'E20.RulesExtSplit217.KitPrompt'), specs);
  if (!picked) {
    return false;
  }

  const [skill, spec] = String(picked).split('|');
  const { makeKit } = await import("../../../mechanics/resources/kits.mjs");
  await makeKit(actor, ctx.item, step.tier ?? 'limited', skill, spec);
  ctx.vars.kit = `${skill} (${spec})`;
}, {
  errors: (step, where) => [
    ...(Array.isArray(step.skills) && step.skills.length ? [] : [`${where}: makeKit needs skills`]),
    ...(['standard', 'limited', 'restricted', undefined].includes(step.tier) ? [] : [`${where}: makeKit tier must be standard, limited or restricted`]),
  ],
});
