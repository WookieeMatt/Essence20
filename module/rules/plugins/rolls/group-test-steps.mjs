import { resolveValue } from "../../formula.mjs";
import { registerRecipient, registerStep } from "../../steps.mjs";

/**
 * Round 15 (items2) - a rule's own Group Skill Test (mechanics/rolls/group-tests.mjs: the card, each participant's
 * Roll button, the group Perks' bonuses). Guardian Blast.
 *
 *   groupTest {skill, dif, cost?, var?}
 *       Posts a Group Skill Test card: the actor leads, with the run's targets as the other participants, against `dif`
 *       (a formula). `cost` (free | move | standard): what each other participant spends, in combat, when they roll.
 *       @var.<var> (default groupTest) is the test's id and <var>Participants its participants' uuids, so a later
 *       `button` can tally it.
 *   groupTally {var?}
 *       Reads that test's results as they stand: @var.successes, @var.participantCount, @var.groupSuccess (1 when half or
 *       more succeeded) and @var.groupDone (1 when everyone has rolled).
 *   recipient varActor:<var> - the actor whose uuid a step kept in @var.<var> (rememberTarget).
 */

const lookup = uuid => {
  try {
    return uuid ? globalThis.fromUuidSync?.(uuid, { strict: false }) ?? null : null;
  } catch (error) {
    return null;
  }
};

registerRecipient(/^varActor:([\w-]+)$/, (match, ctx) => [lookup(ctx.vars?.[match[1]])].filter(Boolean));

registerStep('groupTest', async (step, ctx) => {
  const name = step.var || 'groupTest';
  const participants = [...new Set([ctx.actor?.uuid, ...ctx.targets.map(target => target?.uuid)].filter(Boolean))];
  if (!participants.length || !globalThis.ChatMessage?.create) {
    return false;
  }

  const dif = Math.max(0, Math.round(resolveValue(step.dif ?? 0, { actor: ctx.actor, item: ctx.item, vars: ctx.vars, other: ctx.targets?.[0] ?? null }, 0)));
  const test = {
    id: globalThis.foundry?.utils?.randomID?.() ?? String(Date.now()), skill: step.skill ?? 'athletics', dif, leader: ctx.actor.uuid, participants,
    ...(step.cost ? { cost: step.cost } : {}),
  };
  const { renderCard } = await import("../../../mechanics/rolls/group-tests.mjs");
  await globalThis.ChatMessage.create({ content: renderCard(test), flags: { essence20: { groupTest: test } } });
  ctx.vars[name] = test.id;
  ctx.vars[`${name}Participants`] = participants.join(',');
}, {
  errors: (step, where) => [
    ...(step.skill ? [] : [`${where}: groupTest needs a skill`]),
    ...(step.cost === undefined || ['free', 'move', 'standard'].includes(step.cost) ? [] : [`${where}: groupTest cost must be free, move or standard`]),
  ],
});

registerStep('groupTally', async (step, ctx) => {
  const name = step.var || 'groupTest';
  const id = ctx.vars?.[name];
  const participants = String(ctx.vars?.[`${name}Participants`] ?? '').split(',').filter(Boolean);
  if (!id || !participants.length) {
    return false;
  }

  const { tally } = await import("../../../mechanics/rolls/group-tests.mjs");
  const result = tally({ id, participants });
  ctx.vars.successes = result.successes;
  ctx.vars.participantCount = participants.length;
  ctx.vars.groupSuccess = result.success ? 1 : 0;
  ctx.vars.groupDone = result.done ? 1 : 0;
});
