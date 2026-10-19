// Rules-engine plug-ins, round 15 (rest-other - docs/rules-batches/slOther15.md): PreCast and grantSpecialization.
// Registered on import; see module/rules/plugins/index.mjs. Import-light: documents/item.mjs loads it directly (the step
// engine is imported lazily).
import { rulesOf } from "../../index.mjs";
import { registerStep } from "../../steps.mjs";
import { TO, registerStepForm } from "../../editor-spec.mjs";
import { registerRuleType } from "../../types.mjs";
import { ITEM_GRANTS_FLAG, existingSpecialization, grantSpecializationUpdate, releaseSpecializationsUpdate } from "../../../mechanics/characters/specialization-grants.mjs";

/**
 * `PreCast {steps}` - on a spell: steps run as it is cast (documents/item.mjs's spell branch, after its Casting Cost is
 * worked out and before its area is placed or anything is rolled), where the hand-written per-spell pickers ran. A
 * stopped run (a cancelled `pick`, an empty `askChoiceText`) cancels the cast: nothing is rolled and no Casting Cost
 * lands. Picks are kept on the spell (`{choice.<key>}`) for its own afterRoll Trigger (Enchant, Get To Know, Bestow
 * Expertise). `when` sees the caster and the spell.
 */
registerRuleType('PreCast', {
  params: { steps: { kind: 'object', required: true } },
  scopes: ['self'],
  validate: rule => (Array.isArray(rule.steps) && rule.steps.length ? [] : ['steps must be a list of steps']),
});

/**
 * Run a spell's own PreCast rules for this cast.
 * @param {Actor} actor   The caster.
 * @param {Item} spell
 * @returns {Promise<Boolean>}   false when one stopped (the cast is cancelled).
 */
export async function runPreCast(actor, spell) {
  const rules = rulesOf(spell).filter(rule => rule?.type == 'PreCast' && !rule.disabled);
  if (!rules.length) {
    return true;
  }

  const { runSteps, stepContext } = await import("../../steps.mjs");
  const { contextFor, evaluate } = await import("../../predicate.mjs");
  for (const rule of rules) {
    if (evaluate(rule.when, contextFor({ self: actor, holder: actor, ruleItem: spell, item: spell })) === false) {
      continue;
    }

    const ctx = stepContext({ actor, item: spell, rule });
    if (!(await runSteps(rule.steps, ctx))) {
      return false;
    }
  }

  return true;
}

/* -------------------------------------------- */
/*  grantSpecialization                          */
/* -------------------------------------------- */

const SKILL_TEXT = /^\{(?:var|choice)\.[\w-]+\}$|^[a-zA-Z]+$/;

function fill(text, ctx) {
  const choices = ctx.item?.flags?.essence20?.rules?.choices ?? {};
  return String(text ?? '')
    .replace(/\{var\.([\w-]+)\}/g, (match, key) => String(ctx.vars?.[key] ?? ''))
    .replace(/\{choice\.([\w-]+)\}/g, (match, key) => String(choices[key] ?? ''));
}

/**
 * Step `grantSpecialization {skill, name, to?, until?}` - each recipient gains a Specialization of that Skill named `name`
 * (`{var.x}` / `{choice.x}` filled; title-cased), at the Skill's own die. A Skill that already has one of that name gets
 * no second copy (mechanics/characters/specialization-grants.mjs).
 * - until "scene" (the default - Bestow Expertise): for the rest of the scene; the scene-advance sweep
 *   (items/magic/bestow-expertise-scene-expiry.mjs) removes it.
 * - until "item": for as long as the rule's item is on its actor - deleting the item (or a removeSpecialization step)
 *   takes it back. A Perk that simply gives one is a Trigger {event: "added"} with this step; gear that gives one while
 *   worn pairs it with an "equipped" Trigger and an "unequipped" removeSpecialization.
 * An empty name or an unknown Skill stops the run.
 */
registerStep('grantSpecialization', async (step, ctx) => {
  const { recipients } = await import("../../steps.mjs");
  const { slugifySpecializationName, titleCaseSpecializationName } = await import("../../../util/utils.mjs");
  const skill = fill(step.skill, ctx);
  const name = fill(step.name, ctx).trim();
  if (!skill || !name) {
    return false;
  }

  for (const actor of recipients(step, ctx)) {
    const fields = actor.system?.skills?.[skill];
    if (!fields) {
      continue;
    }

    const update = grantSpecializationUpdate({
      fields, flags: actor.flags?.essence20 ?? {}, skill, name: titleCaseSpecializationName(name),
      until: step.until ?? 'scene', source: ctx.item?.uuid ?? null, slug: slugifySpecializationName,
    });
    if (update) {
      await updateActor(actor, update);
    }
  }
}, {
  errors: (step, where) => [
    ...(step.skill && SKILL_TEXT.test(String(step.skill)) ? [] : [`${where}: grantSpecialization needs a skill (a key, {var.x} or {choice.x})`]),
    ...(step.name ? [] : [`${where}: grantSpecialization needs a name`]),
    ...(step.until === undefined || ['scene', 'item'].includes(step.until) ? [] : [`${where}: grantSpecialization lasts until scene or item`]),
  ],
});

/**
 * Step `removeSpecialization {skill?, name?, to?}` - takes back the Specializations this rule's item gave its recipients
 * with until "item": all of them, or only that Skill's / that name's. One the character has of their own, or that
 * another item still gives, stays.
 */
registerStep('removeSpecialization', async (step, ctx) => {
  const { recipients } = await import("../../steps.mjs");
  const source = ctx.item?.uuid;
  if (!source) {
    return;
  }

  const skill = step.skill ? fill(step.skill, ctx) : null;
  const name = step.name ? fill(step.name, ctx).trim() : null;
  for (const actor of recipients(step, ctx)) {
    const key = name && skill ? existingSpecialization(actor.system?.skills?.[skill]?.specializations, name) : null;
    if (name && !key) {
      continue;
    }

    await releaseFrom(actor, source, { skill, key });
  }
}, {
  errors: (step, where) => [
    ...(step.skill === undefined || SKILL_TEXT.test(String(step.skill)) ? [] : [`${where}: removeSpecialization's skill must be a key, {var.x} or {choice.x}`]),
    ...(step.name === undefined || step.skill ? [] : [`${where}: removeSpecialization needs the skill a name is on`]),
  ],
});

async function updateActor(actor, update) {
  const { needsGmRelay, relayToGm } = await import("../../../mechanics/world/gm-relay.mjs");
  await (needsGmRelay(actor) ? relayToGm(actor, 'update', [update]) : actor.update(update));
}

async function releaseFrom(actor, source, options = {}) {
  const deletion = new foundry.data.operators.ForcedDeletion();
  const update = releaseSpecializationsUpdate(actor.flags?.essence20 ?? {}, source, { ...options, deletion });
  if (update) {
    await updateActor(actor, update);
  }
}

/** An item deleted: what it gave with until "item" goes - from its own actor and from anyone else it gave one to. */
async function onDeleteItem(item, options, userId) {
  if (userId != globalThis.game?.user?.id || !item?.uuid) {
    return;
  }

  const { worldActors } = await import("../../../mechanics/companions/companion-link.mjs");
  const actors = new Set([item.parent, ...worldActors()].filter(actor => actor?.documentName == 'Actor'));
  for (const actor of actors) {
    if ((actor.flags?.essence20?.[ITEM_GRANTS_FLAG] ?? []).some(entry => entry?.item == item.uuid)) {
      await releaseFrom(actor, item.uuid);
    }
  }
}

globalThis.Hooks?.on?.('deleteItem', onDeleteItem);

registerStepForm('grantSpecialization', [
  TO,
  { path: 'skill', kind: 'select', label: 'Skill', options: 'skills' },
  { path: 'name', kind: 'text', label: 'SpecializationName', hint: 'SpecializationNameHint' },
  { path: 'until', kind: 'select', label: 'SpecializationUntil', options: [['scene', 'SpecializationUntilScene'], ['item', 'SpecializationUntilItem']] },
]);

registerStepForm('removeSpecialization', [
  TO,
  { path: 'skill', kind: 'select', label: 'Skill', options: [['', 'SpecializationAnySkill'], 'skills'] },
  { path: 'name', kind: 'text', label: 'SpecializationName', hint: 'SpecializationRemoveHint' },
]);
