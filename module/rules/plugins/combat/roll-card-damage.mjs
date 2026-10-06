import { formulaError } from "../../formula.mjs";
import { registerStep, runSteps } from "../../steps.mjs";
import { stepAmount } from "../shared/step-amount.mjs";

/**
 * Step `rollCheck {skill, essence?, shiftUp?, shiftDown?, defense?, dif?, edge?, damage?: {value, type}, dataset?, onSuccess?,
 * onFail?}` (round 15, systems - docs/rules-batches/slSystems15.md): an ordinary Skill Test made the way the
 * hand-written Power effects made theirs (`actor._dice.rollSkill(dataset)` - no item, the user's targets as they are):
 * against the targets' `defense` (each target's own Defense, every per-target change dice.mjs makes), else the flat
 * `dif`. `damage` - the card carries Apply Damage buttons for that much damage of that type, times the Degrees of
 * Success (dice.mjs's synthetic-damage chain reads `dataset.stepDamage`, as for rollVsEach's `damage`). Shifts left out are
 * left out of the dataset too, as the old calls did. `onSuccess` / `onFail` run after (some row succeeded / none
 * did); a cancelled roll stops the run. `@var.rollTotal` - the roll's total. `dataset`: plain flags the roll carries, for its
 * own hit / miss / afterRoll Triggers (`roll:dataset:<key>` - Laughtracting's beaten targets).
 */

const DEFENSES = ['toughness', 'evasion', 'willpower', 'cleverness'];

registerStep('rollCheck', async (step, ctx) => {
  const actor = ctx.actor;
  const skill = String(step.skill ?? '');
  if (!skill || !actor?._dice?.rollSkill) {
    return false;
  }

  const dataset = { skill, essence: step.essence ?? globalThis.CONFIG?.E20?.skillToEssence?.[skill] ?? 'smarts' };
  for (const key of ['shiftUp', 'shiftDown']) {
    if (step[key] !== undefined) {
      dataset[key] = stepAmount(step[key], ctx, 0);
    }
  }

  if (step.defense) {
    dataset.defenseType = step.defense;
  }

  if (step.dif !== undefined) {
    dataset.dif = String(stepAmount(step.dif, ctx, 10));
  }

  if (step.edge) {
    dataset.edge = true;
  }

  if (step.damage?.type) {
    dataset.stepDamage = { value: stepAmount(step.damage.value ?? 1, ctx, 1), type: String(step.damage.type) };
  }

  for (const [key, value] of Object.entries(step.dataset && typeof step.dataset == 'object' ? step.dataset : {})) {
    if (['string', 'number', 'boolean'].includes(typeof value) && !(key in dataset)) {
      dataset[key] = value;
    }
  }

  const result = await actor._dice.rollSkill(dataset, actor);
  if (!result || result.cancelled) {
    return false;
  }

  const outcome = result.outcomes?.[0];
  ctx.vars.lastRoll = { success: !!result.success, total: Number(outcome?.roll?.total ?? outcome?.results?.[0]?.total) || 0 };
  ctx.vars.rollTotal = ctx.vars.lastRoll.total;
  const branch = result.success ? step.onSuccess : step.onFail;
  return Array.isArray(branch) ? runSteps(branch, ctx) : undefined;
}, {
  branches: ['onSuccess', 'onFail'],
  errors: (step, where) => [
    ...(step.skill ? [] : [`${where}: rollCheck needs a skill`]),
    ...(step.defense && !DEFENSES.includes(step.defense) ? [`${where}: defense must be one of ${DEFENSES.join(', ')}`] : []),
    ...['shiftUp', 'shiftDown', 'dif'].filter(key => step[key] !== undefined && formulaError(step[key])).map(key => `${where}: ${key}: ${formulaError(step[key])}`),
    ...(step.dataset !== undefined && (typeof step.dataset != 'object' || Array.isArray(step.dataset)) ? [`${where}: rollCheck dataset must be an object of flags`] : []),
    ...(step.damage !== undefined && (!step.damage?.type || formulaError(step.damage?.value ?? 1)) ? [`${where}: damage needs {value, type}`] : []),
  ],
});

