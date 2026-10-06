import { registerPreRoll } from "../../../helpers/extensions.mjs";
import { ruleMovementStages } from "../../adapter.mjs";
import { ruleLabel, rulesOfType } from "../../index.mjs";
import { linkedEntries } from "../../links.mjs";
import { contextFor, evaluate, feetBetween, registerTag } from "../../predicate.mjs";
import { resolveValue } from "../../formula.mjs";
import { RULE_TYPES, registerEvent, registerRuleType } from "../../types.mjs";
import { holderOf, itemsOf, resolve, sourceOf, worldActors, write } from "./common.mjs";
import { applyDerivedHookMovement, applyMovementStage, setMovementStages } from "./movement-hook.mjs";

/**
 * Group A: rule hooks in hand-written helpers, and the events / Movement stage they need.
 *
 * - Rule type `JoinTime` {amount, min?} (scope ownZord, on a Ranger's item): their Zord is ready to combine `amount`
 *   rounds sooner (dice allowed: "1d4"), at least `min` (default 1) - helpers/combiner-timer.mjs. One rule counts.
 * - Rule type `SummonTime` {mode: halve | subtract, amount?, min?}: the summoned Zord arrives sooner -
 *   helpers/zord-summon.mjs, the summoner's rules first (Unique Weapon (Small Melee): halve, rounded up), then the
 *   Zord's own (Genetic Resonance: 2 rounds sooner). Never below `min` (default 1).
 * - Rule type `AutoDisembark` {who?: driver | pilots}: the holder passes the emergency disembark test without rolling
 *   (helpers/vehicle-defeat.mjs) - from a vehicle they drive (driver), or (pilots) one they drive or, when nobody
 *   drives it, any vehicle they crew.
 * - Rule type `KnownOptions` {key, count, options, prompt?}: the options a helper may offer are only the ones the
 *   holder noted - as many as `count` (a formula), asked for when fewer are noted (Emotional Range's Emotional Mastery
 *   options; helpers/emotional-mastery.mjs asks ensureKnownOptions). `legacy`: an actor flag holding an older list.
 * - Event `beforeRoll` - a roll is about to be made (helpers/extensions.mjs's preRoll, before the dialog; a cancelled
 *   dialog still counted it): the rolled item is the roll item (item:own), roll:dataset: reads its dataset.
 * - Event `groupTestResult` - a Group Test card has every result in (helpers/group-tests.mjs), fired on each
 *   participant with `@var.success` (1 / 0), `@var.successes`, `@var.participants`.
 * - Movement stage `derivedHook` - where helpers/extensions/pr2/team.mjs puts it among the derived hooks (before the
 *   rules' own DerivedStats; Bend Physics' doubling, Unique Weapon (Two-Handed Melee)'s -10 ft).
 * - Tags `team:holds:<item uuid>` (another Player Character holds that compendium item) and
 *   `scene:tokenWithin:<ft>:<tags joined by &>` (some other token within that many feet meets them, asked as the target).
 */

registerEvent('beforeRoll');
registerEvent('groupTestResult');

/* -------------------------------------------- */
/*  Combining and summoning                      */
/* -------------------------------------------- */

registerRuleType('JoinTime', {
  params: { amount: { kind: 'formula', required: true }, min: { kind: 'formula' } },
  scopes: ['self', 'ownZord'],
});

/** A Zord's rolled join time, after its owner's JoinTime rule (helpers/combiner-timer.mjs). */
export function ruleJoinTime(zord, total, random = undefined) {
  const entry = [...rulesOfType(zord, 'JoinTime', 'self').map(e => ({ ...e, holder: zord })), ...linkedEntries(zord, 'JoinTime')]
    .find(({ rule, item, holder }) => evaluate(rule.when, contextFor({ self: zord, holder, ruleItem: item })) === true);
  if (!entry) {
    return total;
  }

  const scope = { actor: entry.holder, item: entry.item, random };
  return Math.max(Math.round(resolveValue(entry.rule.min ?? 1, scope, 1)), total - Math.round(resolveValue(entry.rule.amount, scope, 0)));
}

registerRuleType('SummonTime', {
  params: { mode: { kind: 'enum', required: true, options: ['halve', 'subtract'] }, amount: { kind: 'formula' }, min: { kind: 'formula' } },
  scopes: ['self'],
  validate: rule => (rule.mode == 'subtract' && rule.amount === undefined ? ['subtract needs an amount'] : []),
});

/** The rounds a summoned Zord takes to arrive, after the summoner's and the Zord's SummonTime rules. */
export function ruleSummonRounds(summoner, zord, rounds) {
  let out = rounds;
  for (const actor of [summoner, zord].filter(Boolean)) {
    for (const { rule, item } of rulesOfType(actor, 'SummonTime')) {
      if (evaluate(rule.when, contextFor({ self: actor, ruleItem: item })) !== true) {
        continue;
      }

      const min = Math.round(resolveValue(rule.min ?? 1, { actor, item }, 1));
      out = rule.mode == 'halve' ? Math.max(min, Math.ceil(out / 2)) : Math.max(min, out - Math.round(resolveValue(rule.amount ?? 0, { actor, item }, 0)));
    }
  }

  return out;
}

registerRuleType('AutoDisembark', {
  params: { who: { kind: 'enum', options: ['driver', 'pilots'] } },
  scopes: ['self'],
});

/**
 * Whether a crew member passes the emergency disembark test outright (helpers/vehicle-defeat.mjs).
 * @param {Actor} crewMember
 * @param {Object} entry    Their crew row ({uuid, vehicleRole}).
 * @param {Actor} vehicle
 */
export function ruleAutoDisembark(crewMember, entry, vehicle = null) {
  const rows = Object.values(vehicle?.system?.actors ?? {});
  const someoneDrives = rows.some(row => row?.vehicleRole == 'driver');
  return rulesOfType(crewMember, 'AutoDisembark').some(({ rule, item }) => {
    const pilots = entry?.vehicleRole == 'driver' || ((rule.who ?? 'driver') == 'pilots' && !someoneDrives);
    return pilots && evaluate(rule.when, contextFor({ self: crewMember, ruleItem: item })) === true;
  });
}

/* -------------------------------------------- */
/*  Known options                                */
/* -------------------------------------------- */

registerRuleType('KnownOptions', {
  params: {
    key: { kind: 'string', required: true }, count: { kind: 'formula', required: true }, options: { kind: 'strings', required: true },
    labels: { kind: 'string' }, prompt: { kind: 'string' }, title: { kind: 'string' }, legacy: { kind: 'string' },
  },
  scopes: ['self'],
});

/**
 * The options the actor may use from a KnownOptions list, topped up (by asking) to the rule's count first. null when
 * no rule limits the list (every option is offered).
 * @param {Actor} actor
 * @param {String} key
 * @returns {Promise<String[]|null>}
 */
export async function ensureKnownOptions(actor, key, { choose = null } = {}) {
  const entry = rulesOfType(actor, 'KnownOptions').find(({ rule, item }) => rule.key == key
    && evaluate(rule.when, contextFor({ self: actor, ruleItem: item })) === true);
  if (!entry) {
    return null;
  }

  const { rule, item } = entry;
  const count = Math.round(resolveValue(rule.count, { actor, item }, 0));
  if (!(count > 0)) {
    return null;
  }

  const stored = item.flags?.essence20?.rules?.choices?.[`known-${key}`];
  const legacy = rule.legacy ? actor.flags?.essence20?.[rule.legacy] : null;
  const known = (Array.isArray(stored) ? stored : Array.isArray(legacy) ? legacy : []).filter(option => rule.options.includes(option)).slice(0, count);
  if (known.length < count) {
    const localize = text => globalThis.game?.i18n?.localize?.(text) ?? text;
    const ask = choose ?? (async (title, prompt, options) => (await import("../../../helpers/grants.mjs")).chooseSelect(title, prompt, options));
    while (known.length < count) {
      const left = rule.options.filter(option => !known.includes(option));
      const label = option => localize(String(rule.labels ?? '{option}').replace('{Option}', option.charAt(0).toUpperCase() + option.slice(1)).replace('{option}', option));
      const picked = await ask(rule.title ?? ruleLabel(rule, item), String(rule.prompt ?? '').replace('{n}', known.length + 1).replace('{count}', count),
        left.map(value => ({ value, label: label(value) })));
      if (!picked) {
        break;
      }

      known.push(picked);
    }

    await write(item, 'update', [{ [`flags.essence20.rules.choices.known-${key}`]: known }]);
  }

  return known.length ? known : null;
}

/* -------------------------------------------- */
/*  Events                                       */
/* -------------------------------------------- */

registerPreRoll(async (actor, dataset, item) => {
  if (!actor || !rulesOfType(actor, 'Trigger').some(entry => entry.rule.event == 'beforeRoll')) {
    return;
  }

  const { fireTriggers } = await import("../../triggers.mjs");
  await fireTriggers(actor, 'beforeRoll', { roll: { item: item ?? null, rolledSkill: dataset?.skill, dataset: dataset ?? {} } });
});

/** A finished Group Test card: groupTestResult on each participant (by the client that changed the card). */
export async function onGroupTestCard(message) {
  const test = message?.flags?.essence20?.groupTest;
  if (!test?.participants?.length) {
    return;
  }

  const { tally } = await import("../../../helpers/group-tests.mjs");
  const outcome = tally(test);
  if (!outcome.done) {
    return;
  }

  const { fireTriggers } = await import("../../triggers.mjs");
  for (const id of test.participants) {
    const actor = resolve(id);
    if (actor) {
      await fireTriggers(actor, 'groupTestResult', { vars: { success: outcome.success ? 1 : 0, successes: outcome.successes, participants: outcome.rows.length } });
    }
  }
}

globalThis.Hooks?.on?.('updateChatMessage', (message, changes, options, userId) => {
  if (userId == globalThis.game?.user?.id && message?.flags?.essence20?.groupTest) {
    onGroupTestCard(message);
  }
});

/* -------------------------------------------- */
/*  Movement at a hand-written hook's place      */
/* -------------------------------------------- */

const stage = RULE_TYPES.Movement?.params?.stage;
if (stage?.options && !stage.options.includes('derivedHook')) {
  stage.options.push('derivedHook');
}

// The stage itself is applied by ./movement-hook.mjs (where the slice's call sits); it reads the rules' stages from here.
setMovementStages(ruleMovementStages);

// Rules reaching the whole team (scope team) change a teammate's derived data, and the team scan can miss a holder
// prepared before the world finished loading - prepare the Player Characters again once everyone exists.
globalThis.Hooks?.once?.('ready', () => {
  const team = worldActors().filter(actor => actor?.type == 'playerCharacter');
  if (team.some(actor => ['Movement', 'DerivedStat', 'Defense'].some(type => rulesOfType(actor, type, 'team').length))) {
    for (const member of team) {
      member.reset?.();
    }
  }
});

/* -------------------------------------------- */
/*  Tags                                         */
/* -------------------------------------------- */

registerTag('team', (rest, ctx) => {
  const held = /^holds:(.+)$/.exec(rest);
  if (!held) {
    return null;
  }

  return worldActors().some(actor => actor?.type == 'playerCharacter' && actor !== ctx.self && actor.uuid != ctx.self?.uuid
    && itemsOf(actor).some(item => sourceOf(item) == held[1] || item.uuid == held[1]));
}, { family: 'situation', param: 'teamTag' });

registerTag('scene:tokenWithin', (rest, ctx) => {
  const match = /^(\d+):(.+)$/.exec(rest);
  const tokens = globalThis.canvas?.tokens?.placeables;
  if (!match || !Array.isArray(tokens)) {
    return null;
  }

  const tags = match[2].split('&');
  return tokens.some(token => {
    const other = token.actor;
    if (!other || other === ctx.self || (ctx.self?.id && other.id == ctx.self.id)) {
      return false;
    }

    const feet = feetBetween(ctx.self, other);
    return feet !== null && feet !== undefined && feet <= Number(match[1]) && tags.every(tag => evaluate([tag], { ...ctx, other }) === true);
  });
});

export { applyDerivedHookMovement, applyMovementStage, holderOf };
