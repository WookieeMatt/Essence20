import { formulaError, resolveValue } from "./formula.mjs";
import { contextFor, evaluate, interpolate, sideActorsWithin, unknownTags as unknownTagsOf } from "./predicate.mjs";

/**
 * The step language (docs/RULES_ENGINE_PLAN.md §5.5) - what a Use button or a Trigger does, as a
 * list of `{do, ...}` steps run in order. Each step may carry its own `when`, checked as it runs.
 *
 * Who a step lands on is its `to`: "self" (the default), "target" (the first target) or "targets"
 * (all of them). Targets come from a `target` step, or the user's targeted tokens.
 *
 * A run carries a context: {actor, item, rule, targets, damage, chat, vars}. A step that can't go
 * ahead (no target, not enough of a resource) stops the run, and says why in chat.
 *
 * Writes to an actor this user doesn't own go through the GM (helpers/gm-relay.mjs), the same as the
 * hand-written Perks do. Heavy helpers are imported lazily, so this file loads under plain Node.
 */

export const STEP_TYPES = [
  'chat', 'spend', 'gainResource', 'heal', 'damage', 'applyCondition', 'removeCondition', 'roll', 'grant', 'bank',
  'grantActions', 'setToggle', 'choose', 'target', 'negateDamage', 'leaveAt', 'mark', 'unmark', 'askNumber', 'pickGrant', 'bonusAttack', 'setForm', 'save', 'pickAlly', 'pickPerk', 'fitAttack',
];

const T = (key, data) => {
  const i18n = globalThis.game?.i18n;
  const full = `E20.Rules.Step.${key}`;
  const text = data ? i18n?.format?.(full, data) : i18n?.localize?.(full);
  return text && text != full ? text : `${key}${data ? ` ${JSON.stringify(data)}` : ''}`;
};

const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** The user's targeted actors. */
export function targetedActors() {
  const targets = globalThis.game?.user?.targets;
  return targets ? [...targets].map(token => token.actor).filter(Boolean) : [];
}

/** Who a step lands on. */
export function recipients(step, ctx) {
  switch (step.to ?? 'self') {
  case 'target': return ctx.targets.slice(0, 1);
  case 'targets': return ctx.targets;
  // The first target, or the actor when nothing is targeted ("Reach", including yourself).
  case 'targetOrSelf': return [ctx.targets[0] ?? ctx.actor];
  }

  // allies:<ft> / enemies:<ft> - every allied or enemy token's actor within that range (not self);
  // allies+self:<ft> includes the actor too; all:<ft> is everyone else in range, either side.
  const near = /^(allies|enemies|allies\+self|all):(\d+)$/.exec(step.to ?? '');
  if (near) {
    const side = { enemies: 'enemy', all: 'any' }[near[1]] ?? 'ally';
    const others = sideActorsWithin(ctx.actor, Number(near[2]), side);
    return near[1] == 'allies+self' ? [ctx.actor, ...others] : others;
  }

  return [ctx.actor];
}

/** Update a document, through the GM when this user can't write to it. */
async function write(doc, method, args) {
  const { needsGmRelay, relayToGm } = await import("../helpers/gm-relay.mjs");
  if (needsGmRelay(doc)) {
    return relayToGm(doc, method, args);
  }

  return doc[method](...args);
}

/* -------------------------------------------- */
/*  Resources                                    */
/* -------------------------------------------- */

/**
 * The Story Point helpers (helpers/story-points.mjs), handed in at start-up by essence20.mjs - that file
 * pulls in the settings module, which plain Node can't load. {canSpendForActor, spendForActor,
 * requestStoryPointGrant, poolFor}. Without them (tests), Story Point costs are treated as payable.
 */
let storyPoints = null;
export function setStoryPointHelpers(helpers) {
  storyPoints = helpers;
}

/**
 * The actor's base Role Points item (Cheer Points, Terror, Energon...), as the sheet shows it - or, given
 * a name ({rolePoints: "Moxie"}), the Role Points item of that name (an additive Role's own).
 */
export function rolePointsOf(actor, name = null) {
  if (typeof name == 'string' && name) {
    const all = actor?.items?.contents ?? [...(actor?.items ?? [])];
    return all.find(item => item.type == 'rolePoints' && item.name?.toLowerCase() == name.toLowerCase()) ?? null;
  }

  const base = actor?._getBaseRolePoints?.();
  if (base) {
    return base;
  }

  const items = actor?.items?.contents ?? [...(actor?.items ?? [])];
  return items.find(item => item.type == 'rolePoints' && !item.flags?.essence20?.parentId)
    ?? items.find(item => item.type == 'rolePoints') ?? null;
}

/**
 * A resource reference: {pool: key} (a Pool on the rule's item), {path: "system.x.value"} (a number
 * on the actor), {rolePoints: true} (the actor's Role Points - Cheer, Terror...; {rolePoints: "Moxie"} for
 * the Role Points item of that name), or
 * {storyPoints: true} (the party's Story Points).
 */
export function readResource(resource, ctx) {
  if (resource?.rolePoints) {
    return Number(rolePointsOf(ctx.actor, resource.rolePoints)?.system?.resource?.value) || 0;
  }

  if (resource?.pool) {
    return Number(ctx.item?.flags?.essence20?.rules?.pools?.[resource.pool]?.value) || 0;
  }

  if (resource?.path) {
    return Number(globalThis.foundry?.utils?.getProperty?.(ctx.actor, resource.path)) || 0;
  }

  return 0;
}

/** Whether the actor can pay this resource cost. Story Points are checked by their own spend. */
export function canAfford(resource, amount, ctx) {
  if (!resource || !amount) {
    return true;
  }

  // The same gate the hand-written Story Point spends use: this client can spend for the actor, and
  // the actor's own pool (the Party's, or the GM's for a Threat) can afford it.
  if (resource.storyPoints) {
    return storyPoints ? !!storyPoints.canSpendForActor(ctx.actor, amount) : true;
  }

  return readResource(resource, ctx) >= amount;
}

/** Add (or with a negative amount, take) a resource. Resolves false when it couldn't be paid. */
export async function changeResource(resource, amount, ctx) {
  if (!resource || !amount) {
    return true;
  }

  if (resource.storyPoints) {
    if (!storyPoints) {
      return true;
    }

    if (amount > 0) {
      // A player's grant is relayed to the GM, so with no GM connected it would go nowhere: warn and
      // stop, leaving the Use (and its limit) untouched - the same as the hand-written grants.
      if (storyPoints.canWriteStoryPoints && !storyPoints.canWriteStoryPoints()) {
        globalThis.ui?.notifications?.warn?.(T('NoGmForStoryPoints'));
        return false;
      }

      await storyPoints.requestStoryPointGrant(ctx.actor, amount, { pool: storyPoints.poolFor(ctx.actor) });
      return true;
    }

    // requestStoryPointSpend answers nothing (a player's spend is relayed to the GM), so check first.
    if (!storyPoints.canSpendForActor(ctx.actor, -amount)) {
      return false;
    }

    await storyPoints.spendForActor(ctx.actor, -amount);
    return true;
  }

  const current = readResource(resource, ctx);
  if (amount < 0 && current < -amount) {
    return false;
  }

  if (resource.rolePoints) {
    const points = rolePointsOf(ctx.actor, resource.rolePoints);
    if (!points) {
      return false;
    }

    const max = Number(points?.system?.resource?.max);
    const next = Math.max(0, current + amount);
    await write(points, 'update', [{ 'system.resource.value': Number.isFinite(max) && max > 0 ? Math.min(max, next) : next }]);
    return true;
  }

  if (resource.pool) {
    const { poolMax } = await import("./adapter.mjs");
    const rule = (ctx.item?.system?.rules ?? []).find(r => r?.type == 'Pool' && r.key == resource.pool);
    const max = rule ? poolMax(rule, ctx.actor, ctx.item) : Infinity;
    await ctx.item.update({ [`flags.essence20.rules.pools.${resource.pool}.value`]: Math.max(0, Math.min(max, current + amount)) });
    return true;
  }

  // A gain stops at the matching .max beside a .value path (system.powers.personal.value -> .max),
  // without taking away anything already above it.
  const maxPath = /\.value$/.test(resource.path) ? resource.path.replace(/\.value$/, '.max') : null;
  const max = maxPath ? Number(globalThis.foundry?.utils?.getProperty?.(ctx.actor, maxPath)) : NaN;
  const next = amount > 0 && Number.isFinite(max) && max > 0 ? Math.max(current, Math.min(max, current + amount)) : current + amount;
  await write(ctx.actor, 'update', [{ [resource.path]: Math.max(0, next) }]);
  return true;
}

/* -------------------------------------------- */
/*  Steps                                        */
/* -------------------------------------------- */

const amountOf = (value, ctx, fallback = 0) => Math.round(resolveValue(value, { actor: ctx.actor, item: ctx.item, vars: ctx.vars }, fallback));

/**
 * A spend whose amount the player picks: `amount: {min, max}` (each a number or formula). Asks for
 * the number; null when they back out.
 */
async function pickAmount(step, ctx) {
  const min = Math.max(0, amountOf(step.amount.min ?? 1, ctx, 1));
  const max = Math.max(min, amountOf(step.amount.max ?? min, ctx, min));
  if (min == max) {
    return min;
  }

  if (ctx.askNumber) {
    return ctx.askNumber(step, min, max, ctx);
  }

  const { DialogV2 } = foundry.applications.api;
  const value = await DialogV2.prompt({
    window: { title: ctx.item?.name ?? '' },
    classes: ['essence20', 'e20-window'],
    content: `<p>${escape(step.prompt ?? T('HowMany'))}</p><input type="number" name="amount" min="${min}" max="${max}" value="${min}" autofocus>`,
    ok: { callback: (event, button) => Number(button.form.elements.amount.value) },
    rejectClose: false,
  });
  return value === null || value === undefined || !Number.isFinite(value) ? null : Math.min(max, Math.max(min, Math.round(value)));
}

const HANDLERS = {
  async chat(step, ctx) {
    ctx.chat.push(escape(step.text ?? '').replace(/\{name\}/g, escape(ctx.actor?.name)).replace(/\{target\}/g, escape(ctx.targets[0]?.name ?? '')));
  },

  async spend(step, ctx) {
    const ranged = step.amount && typeof step.amount == 'object';
    const amount = ranged ? await pickAmount(step, ctx) : amountOf(step.amount ?? 1, ctx, 1);
    if (amount === null) {
      return false;
    }

    if (await changeResource(step.resource, -amount, ctx)) {
      // What was taken - later steps read it as @spent.
      ctx.vars.spent = amount;
      return true;
    }

    ctx.chat.push(T('NotEnough', { name: escape(ctx.actor?.name) }));
    if (step.onFail) {
      await runSteps(step.onFail, ctx);
    }

    return false;
  },

  async gainResource(step, ctx) {
    // False (stop the run) when it couldn't be given - Story Points with no GM to receive them.
    return changeResource(step.resource, amountOf(step.amount ?? 1, ctx, 1), ctx);
  },

  async heal(step, ctx) {
    const amount = amountOf(step.amount ?? 1, ctx, 1);
    for (const actor of recipients(step, ctx)) {
      const health = actor.system?.health;
      if (!health) {
        continue;
      }

      // Temporary Health: added on top (system.health.bonus), as You Got This! and Boosted Vigor do.
      if (step.temporary) {
        await write(actor, 'update', [{ 'system.health.bonus': (Number(health.bonus) || 0) + amount }]);
        ctx.chat.push(T('TempHealth', { name: escape(actor.name), amount }));
        continue;
      }

      const max = Number(health.max);
      const value = Number(health.value) || 0;
      // Capped at the maximum, but never below where it started - a heal must not lower Health (an
      // actor whose maximum works out to 0, or one already above it, keeps what it has).
      const capped = Number.isFinite(max) && max > 0 ? Math.min(max, value + amount) : value + amount;
      const next = Math.max(value, capped);
      await write(actor, 'update', [{ 'system.health.value': next }]);
      ctx.chat.push(T('Healed', { name: escape(actor.name), amount: next - value }));
    }
  },

  async damage(step, ctx) {
    const amount = amountOf(step.amount ?? 1, ctx, 1);
    const type = step.damageType ?? 'blunt';
    const { applyDamage } = await import("../helpers/combat.mjs");
    for (const actor of recipients(step, ctx)) {
      if (actor.isOwner) {
        await applyDamage(actor, amount, type);
        ctx.chat.push(T('Damaged', { name: escape(actor.name), amount, type }));
      } else {
        ctx.chat.push(T('DamageForGm', { name: escape(actor.name), amount, type }));
      }
    }
  },

  async applyCondition(step, ctx) {
    const rounds = amountOf(step.rounds ?? 0, ctx, 0);
    for (const actor of recipients(step, ctx)) {
      const { needsGmRelay, relayToGm } = await import("../helpers/gm-relay.mjs");
      if (needsGmRelay(actor)) {
        await relayToGm(actor, 'toggleStatusEffect', [step.condition, { active: true }]);
      } else {
        const { applyTimedCondition } = await import("../helpers/timed-status.mjs");
        await applyTimedCondition(actor, step.condition, rounds);
      }

      ctx.chat.push(T('Condition', { name: escape(actor.name), condition: escape(step.condition) }));
    }
  },

  async removeCondition(step, ctx) {
    for (const actor of recipients(step, ctx)) {
      if (actor.statuses?.has?.(step.condition)) {
        await write(actor, 'toggleStatusEffect', [step.condition, { active: false }]);
      }
    }
  },

  async roll(step, ctx) {
    const { rollTest } = await import("../helpers/grants.mjs");
    // difDefense: the target's Defense is the DIF (Toughness, Evasion...), like an attack.
    let dif = amountOf(step.dif ?? 10, ctx, 10);
    if (step.difDefense) {
      const target = ctx.targets[0];
      if (!target) {
        ctx.chat.push(T('NeedsTarget', { item: escape(ctx.item?.name) }));
        return false;
      }

      dif = Number(target.system?.defenses?.[step.difDefense]?.total) || dif;
    }

    // An Edge on this roll: always (edge), or when edgeWhen's tags hold (target: = the first target).
    let edge = !!step.edge;
    if (!edge && Array.isArray(step.edgeWhen) && step.edgeWhen.length) {
      const { contextFor, evaluate } = await import("./predicate.mjs");
      edge = evaluate(step.edgeWhen, contextFor({ self: ctx.actor, other: ctx.targets[0] ?? null, ruleItem: ctx.item, rolledSkill: step.skill })) === true;
    }

    // itemUuid: the roll belongs to this Use's item, for afterRoll / hit Triggers' `item:own`.
    const result = await rollTest(ctx.actor, step.skill, dif, { ...(edge ? { edge: true } : {}), ...(ctx.item?.uuid ? { itemUuid: ctx.item.uuid } : {}) });
    ctx.vars.lastRoll = result;
    const branch = result.crit && step.onCrit ? step.onCrit : result.success ? step.onSuccess : step.onFail;
    if (branch) {
      return runSteps(branch, ctx);
    }
  },

  async grant(step, ctx) {
    // "{choice.x}" - the item picked through a ChoiceSet.
    const uuid = interpolate(String(step.uuid ?? ''), ctx.item);
    const source = uuid ? await globalThis.fromUuid?.(uuid) : null;
    if (!source) {
      return;
    }

    for (const actor of recipients(step, ctx)) {
      const data = source.toObject();
      delete data._id;
      globalThis.foundry.utils.setProperty(data, '_stats.compendiumSource', uuid);
      globalThis.foundry.utils.setProperty(data, 'flags.essence20.grantedBy', ctx.item?.id ?? null);
      if (step.until) {
        const { stampFor } = await import("./expiry.mjs");
        globalThis.foundry.utils.setProperty(data, 'flags.essence20.rulesExpiry', { until: step.until, stamp: stampFor(step.until, undefined, ctx.actor) });
      }

      // flags / system: values the granted copy carries (flags under flags.essence20).
      for (const [path, value] of Object.entries(step.flags ?? {})) {
        globalThis.foundry.utils.setProperty(data, `flags.essence20.${path}`, value);
      }

      for (const [path, value] of Object.entries(step.system ?? {})) {
        globalThis.foundry.utils.setProperty(data, `system.${path}`, value);
      }

      const created = await actor.createEmbeddedDocuments('Item', [data]);
      ctx.vars.granted = created?.[0] ?? null;
      // A weapon / armor / shield arrives with its own attacks and upgrades.
      const { attachGrantedChildren } = await import("./lifecycle.mjs");
      await attachGrantedChildren(actor, created);
      ctx.chat.push(T('Granted', { name: escape(actor.name), item: escape(source.name) }));
    }
  },

  async bank(step, ctx) {
    const { bankRollBonus } = await import("./bank.mjs");
    for (const actor of recipients(step, ctx)) {
      await bankRollBonus(actor, {
        label: step.label || ctx.item?.name,
        shiftUp: amountOf(step.upshift ?? 0, ctx, 0),
        shiftDown: amountOf(step.downshift ?? 0, ctx, 0),
        edge: !!step.edge,
        snag: !!step.snag,
        specialize: !!step.specialize,
        damage: amountOf(step.damage ?? 0, ctx, 0),
        when: step.appliesWhen ?? [],
        uses: amountOf(step.uses ?? 1, ctx, 1),
        until: step.until ?? null,
        source: ctx.item?.id ?? null,
        untilActor: ctx.actor,
        ...(step.defense ? { defense: step.defense, defenseBonus: amountOf(step.defenseBonus ?? 0, ctx, 0), persist: !!step.persist } : {}),
      }, write);
      const bonus = [step.defense && `+${amountOf(step.defenseBonus ?? 0, ctx, 0)} ${step.defense == 'any' ? 'Defenses' : [step.defense].flat().join('/')}`, step.upshift && `↑${amountOf(step.upshift, ctx)}`, step.downshift && `↓${amountOf(step.downshift, ctx)}`, step.edge && 'Edge', step.snag && 'Snag', step.specialize && 'Specialized', step.damage && `+${amountOf(step.damage, ctx)} damage`].filter(Boolean).join(', ');
      ctx.chat.push(T('Banked', { name: escape(actor.name), bonus }));
    }
  },

  async grantActions(step, ctx) {
    const { grantActionsThisTurn } = await import("../helpers/action-economy.mjs");
    const grants = { free: amountOf(step.free ?? 0, ctx), move: amountOf(step.move ?? 0, ctx), standard: amountOf(step.standard ?? 0, ctx) };
    for (const actor of recipients(step, ctx)) {
      await grantActionsThisTurn(actor, grants, ctx.item?.name, { granter: ctx.actor });
    }
  },

  async setToggle(step, ctx) {
    const { toggleOf } = await import("./predicate.mjs");
    const { stampFor } = await import("./expiry.mjs");
    const current = !!toggleOf(ctx.item, step.key);
    const value = step.value === 'toggle' || step.value === undefined ? !current : step.value === true || step.value === 'true';
    await ctx.item.update({
      [`flags.essence20.rules.toggles.${step.key}`]: value,
      [`flags.essence20.rules.toggleUntil.${step.key}`]: value && step.until ? { until: step.until, stamp: stampFor(step.until, undefined, ctx.actor) } : null,
    });
  },

  async choose(step, ctx) {
    const options = Array.isArray(step.options) ? step.options : [];
    const picked = await (ctx.ask ?? askOption)(step, options, ctx);
    if (picked === null || picked === undefined || !options[picked]) {
      return false;
    }

    return runSteps(options[picked].steps ?? [], ctx);
  },

  // A Perk from another Role or Focus, granted outright (helpers/grants.mjs#pickPerkFrom): {from: role |
  // focus | branch, line?: same | <line>, notOwn?, ofOwnRole?, minLevel?, maxLevel? (formulas),
  // notOwnPerkNames?, excludeName?, subtype?, notAdvanced?}. The granted Perk's uuid is @var.picked's source.
  async pickPerk(step, ctx) {
    const { pickPerkFrom } = await import("../helpers/grants.mjs");
    const spec = { ...step };
    for (const key of ['minLevel', 'maxLevel']) {
      if (step[key] !== undefined) {
        spec[key] = amountOf(step[key], ctx, 0);
      }
    }

    const granted = await pickPerkFrom(ctx.actor, ctx.item, spec);
    if (!granted) {
      return false;
    }

    ctx.vars.picked = granted.uuid;
    ctx.chat.push(T('Granted', { name: escape(ctx.actor.name), item: escape(granted.name) }));
  },

  // Fit the weapon the last grant step made to what gave it (helpers/weapon-fit.mjs): its Blunt hit's
  // damage, and Blunt or Sharp / Finesse or Might asked when offered. {damage?, types?, skills?}
  async fitAttack(step, ctx) {
    const weapon = ctx.vars.granted;
    if (weapon?.type != 'weapon') {
      return;
    }

    const { fitGrantedWeapon } = await import("../helpers/weapon-fit.mjs");
    await fitGrantedWeapon(weapon.parent ?? ctx.actor, weapon, {
      title: ctx.item?.name ?? '', damage: step.damage ?? null, types: step.types ?? [], skills: step.skills ?? [],
    });
  },

  // An ally to act on: the targeted one(s) when there are 1..max, else a picker over the allies within
  // `within` feet (default: anywhere on the scene) whose `filter` tags (target: ...) hold - and the actor
  // too with `includeSelf`. Sets the targets.
  async pickAlly(step, ctx) {
    const { getNearbyAllyTokens, pickAllyTargets } = await import("../helpers/allies.mjs");
    const { contextFor, evaluate } = await import("./predicate.mjs");
    const within = step.within === undefined ? Infinity : amountOf(step.within, ctx, 0);
    const candidates = [...(step.includeSelf ? [ctx.actor] : []), ...getNearbyAllyTokens(ctx.actor, within).map(token => token.actor)].filter(Boolean)
      .filter(ally => !step.filter?.length || evaluate(step.filter, contextFor({ self: ctx.actor, other: ally, ruleItem: ctx.item })) === true);
    // all: every one of them, no picker (Superb Soloist).
    const picked = step.all ? [...new Set(candidates)]
      : await pickAllyTargets(ctx.actor, [...new Set(candidates)], ctx.item?.name ?? '', Math.max(1, Number(step.max) || 1));
    if (!picked.length) {
      return false;
    }

    ctx.targets = picked;
  },

  async target(step, ctx) {
    const targets = targetedActors();
    const min = step.min ?? 1;
    if (targets.length < min) {
      ctx.chat.push(T('NeedsTarget', { item: escape(ctx.item?.name) }));
      globalThis.ui?.notifications?.warn?.(T('NeedsTarget', { item: ctx.item?.name }));
      return false;
    }

    ctx.targets = step.max ? targets.slice(0, step.max) : targets;
  },

  // Pick a compendium item and give it (helpers/grants.mjs): from {type, availabilities?, tags?} -
  // `tags` are item: tags tested against each compendium entry (item:trait:x, item:data:system.y=z).
  // integrated: give it the Integrated trait; until: it goes when that runs out. The picked uuid is
  // kept as @var.picked for later steps' text.
  async pickGrant(step, ctx) {
    const helpers = ctx.grantHelpers ?? await import("../helpers/grants.mjs");
    const from = step.from ?? {};
    const tags = Array.isArray(from.tags) ? from.tags : [];
    const rows = await helpers.findItems({
      type: from.type,
      availabilities: Array.isArray(from.availabilities) && from.availabilities.length ? from.availabilities : null,
      matches: tags.length ? entry => evaluate(tags, contextFor({ self: ctx.actor, item: entry, ruleItem: ctx.item })) === true : null,
    });
    const uuid = await helpers.pickOne(step.title || ctx.item?.name || '', rows);
    if (!uuid) {
      return false;
    }

    // flags / system: values the granted copy carries (flags under flags.essence20) - alterationWorn, droneWeapon...
    const flags = { ...(step.flags ?? {}) };
    if (step.until) {
      const { stampFor } = await import("./expiry.mjs");
      flags.rulesExpiry = { until: step.until, stamp: stampFor(step.until, undefined, ctx.actor) };
    }

    for (const actor of recipients(step, ctx)) {
      const created = await helpers.grantCopy(actor, uuid, { grantedBy: ctx.item, integrated: !!step.integrated, flags, system: step.system ?? {} });
      if (created) {
        ctx.chat.push(T('Granted', { name: escape(actor.name), item: escape(created.name) }));
      }
    }

    ctx.vars.picked = uuid;
  },

  // Extra attacks this turn (helpers/action-economy.mjs#grantBonusAttack): each costs `cost` (none,
  // free, move, standard) when taken; `when` is the attack it has to be (weapon:trait:ballistic,
  // attack:melee...); psychicOnMiss adds that much Psychic damage on a miss. Needs a combat.
  async bonusAttack(step, ctx) {
    const economy = ctx.economy ?? await import("../helpers/action-economy.mjs");
    const count = Math.max(0, amountOf(step.count ?? 1, ctx, 1));
    const filter = Array.isArray(step.when) && step.when.length ? { when: step.when } : null;
    let granted = 0;
    for (const actor of recipients(step, ctx)) {
      for (let i = 0; i < count; i++) {
        if (await economy.grantBonusAttack(actor, {
          source: ctx.item?.name ?? null, cost: step.cost ?? 'free', filter, psychicOnMiss: Number(step.psychicOnMiss) || 0,
        })) {
          granted++;
        }
      }
    }

    if (count && !granted) {
      ctx.chat.push(T('NeedsCombat', { item: escape(ctx.item?.name) }));
      return false;
    }
  },

  // The player picks a number (within min-max); later steps read it as @var.<var>.
  async askNumber(step, ctx) {
    const value = await pickAmount({ ...step, amount: { min: step.min ?? 1, max: step.max ?? step.min ?? 1 } }, ctx);
    if (value === null) {
      return false;
    }

    ctx.vars[step.var || 'n'] = value;
  },

  // Tag an actor for other rules to test (`target:marked:<key>`, `self:marked:<key>`), for a while.
  async mark(step, ctx) {
    const { stampFor } = await import("./expiry.mjs");
    for (const actor of recipients(step, ctx)) {
      await write(actor, 'update', [{
        [`flags.essence20.ruleMarks.${step.key}`]: {
          by: ctx.actor?.uuid ?? null, until: step.until ?? null, stamp: step.until ? stampFor(step.until, undefined, ctx.actor) : null,
        },
      }]);
    }
  },

  async unmark(step, ctx) {
    for (const actor of recipients(step, ctx)) {
      await write(actor, 'update', [{ [`flags.essence20.ruleMarks.-=${step.key}`]: null }]);
    }
  },

  async negateDamage(step, ctx) {
    if (ctx.damage) {
      ctx.damage.amount = 0;
    }
  },

  // A save card (helpers/save-riders.mjs): everyone it reaches rolls one of `skills` against `dif`,
  // a failure gives `status` (for `rounds`) and/or `damage`; `removeOnSuccess` makes it an escape.
  async save(step, ctx) {
    const { postSaveCard } = await import("../helpers/save-riders.mjs");
    const spec = {
      title: step.title || ctx.item?.name || '',
      skills: [step.skills ?? []].flat().filter(Boolean),
      dif: amountOf(step.dif ?? 10, ctx, 10),
    };
    if (step.status) {
      spec.status = step.status;
    }

    if (step.rounds !== undefined) {
      spec.rounds = amountOf(step.rounds, ctx, 0);
    }

    for (const key of ['damage', 'damageAlways']) {
      if (step[key]) {
        spec[key] = { value: amountOf(step[key].value ?? 0, ctx, 0), type: step[key].type };
      }
    }

    if (step.removeOnSuccess) {
      spec.removeOnSuccess = true;
    }

    await postSaveCard(ctx.actor, recipients(step, ctx), spec);
  },

  // Morph / Alt Mode on or off: { do: 'setForm', form: 'morphed' | 'transformed', value: true | false }.
  async setForm(step, ctx) {
    const path = step.form == 'transformed' ? 'system.isTransformed' : 'system.isMorphed';
    const value = step.value === true || step.value === 'true';
    for (const actor of recipients(step, ctx)) {
      if (!!foundry.utils.getProperty(actor, path) == value) {
        continue;
      }

      const { needsGmRelay, relayToGm } = await import("../helpers/gm-relay.mjs");
      await (needsGmRelay(actor) ? relayToGm(actor, 'update', [{ [path]: value }]) : actor.update({ [path]: value }));
    }
  },

  async leaveAt(step, ctx) {
    if (ctx.damage) {
      const health = Number(ctx.actor?.system?.health?.value) || 0;
      ctx.damage.amount = Math.max(0, Math.min(ctx.damage.amount, health - amountOf(step.value ?? 1, ctx, 1)));
    }
  },
};

/** Ask which of a `choose` step's options to take. Resolves to its index, or null. */
async function askOption(step, options, ctx) {
  const { DialogV2 } = foundry.applications.api;
  const result = await DialogV2.wait({
    window: { title: ctx.item?.name ?? '' },
    classes: ['essence20', 'e20-window'],
    content: step.prompt ? `<p>${escape(step.prompt)}</p>` : '',
    buttons: options.map((option, index) => ({ action: String(index), label: option.label ?? String(index + 1) })),
    rejectClose: false,
  });
  return result === null || result === undefined ? null : Number(result);
}

/**
 * Run a list of steps. Resolves false if a step stopped the run.
 * @param {Array<Object>} steps
 * @param {Object} ctx   {actor, item, rule, targets, damage, chat, vars, ask?}
 * @returns {Promise<Boolean>}
 */
export async function runSteps(steps, ctx) {
  for (const step of Array.isArray(steps) ? steps : []) {
    const handler = HANDLERS[step?.do];
    if (!handler) {
      continue;
    }

    if (step.when && step.do != 'bonusAttack' && evaluate(step.when, contextFor({ self: ctx.actor, ruleItem: ctx.item, other: ctx.targets[0] ?? null })) !== true) {
      continue;
    }

    try {
      if (await handler(step, ctx) === false) {
        return false;
      }
    } catch (error) {
      console.error(`Essence20 | rule step "${step.do}" failed on ${ctx.item?.name}`, error);
      return false;
    }
  }

  return true;
}

/** A fresh run context. */
export function stepContext({ actor, item, rule, targets = null, damage = null, ask = null, askNumber = null } = {}) {
  return { actor, item, rule, targets: targets ?? targetedActors(), damage, chat: [], vars: {}, ask, askNumber };
}

/** Validator: problems in a step list. */
export function stepErrors(steps, path = 'steps') {
  const errors = [];
  if (!Array.isArray(steps)) {
    return [`${path} must be a list`];
  }

  steps.forEach((step, index) => {
    const where = `${path}[${index}]`;
    if (!step || typeof step != 'object') {
      errors.push(`${where} is not a step`);
      return;
    }

    if (!STEP_TYPES.includes(step.do)) {
      errors.push(`${where}: unknown step "${step.do ?? ''}"`);
      return;
    }

    if (step.until && !['endOfTurn', 'endOfRound', 'endOfNextRound', 'nextTurn', 'encounter', 'scene'].includes(step.until)) {
      errors.push(`${where}: until must be endOfTurn, endOfRound, endOfNextRound, nextTurn, encounter or scene`);
    }

    if (step.to && !['self', 'target', 'targets', 'targetOrSelf'].includes(step.to) && !/^(allies|enemies|allies\+self|all):\d+$/.test(step.to)) {
      errors.push(`${where}: to must be self, target, targets, targetOrSelf, allies:<ft>, enemies:<ft>, allies+self:<ft> or all:<ft>`);
    }

    if (step.difDefense && !['toughness', 'evasion', 'willpower', 'cleverness'].includes(step.difDefense)) {
      errors.push(`${where}: difDefense must be toughness, evasion, willpower or cleverness`);
    }

    if (step.do == 'pickGrant' && step.from?.tags) {
      for (const tag of unknownTagsOf(step.from.tags)) {
        errors.push(`${where}: unknown tag "${tag}" in from.tags`);
      }
    }

    const needs = {
      applyCondition: 'condition', removeCondition: 'condition', roll: 'skill', grant: 'uuid', setToggle: 'key',
      spend: 'resource', gainResource: 'resource', mark: 'key', unmark: 'key',
    }[step.do];
    if (step.do == 'bank' && step.defense && ![step.defense].flat().every(defense => ['toughness', 'evasion', 'willpower', 'cleverness', 'any'].includes(defense))) {
      errors.push(`${where}: defense must be toughness, evasion, willpower, cleverness or any`);
    }

    if (step.do == 'pickPerk' && !['role', 'focus', 'branch'].includes(step.from)) {
      errors.push(`${where}: pickPerk needs from: role, focus or branch`);
    }

    if (step.do == 'roll' && step.edgeWhen) {
      for (const tag of unknownTagsOf(step.edgeWhen)) {
        errors.push(`${where}: unknown tag "${tag}" in edgeWhen`);
      }
    }

    if (step.do == 'pickAlly' && step.filter) {
      for (const tag of unknownTagsOf(step.filter)) {
        errors.push(`${where}: unknown tag "${tag}" in filter`);
      }
    }

    if (step.do == 'save' && ![step.skills ?? []].flat().filter(Boolean).length) {
      errors.push(`${where}: save needs skills`);
    }

    if (step.do == 'save' && !step.status && !step.damage && !step.damageAlways) {
      errors.push(`${where}: save needs a status or damage for a failure`);
    }

    if (step.do == 'setForm' && !['morphed', 'transformed'].includes(step.form)) {
      errors.push(`${where}: form must be morphed or transformed`);
    }

    if (step.do == 'pickGrant' && !step.from?.type) {
      errors.push(`${where}: pickGrant needs from.type`);
    }

    if (needs && !step[needs]) {
      errors.push(`${where}: ${step.do} needs ${needs}`);
    }

    if (step.do == 'spend' && step.amount && typeof step.amount == 'object') {
      for (const end of ['min', 'max']) {
        const error = formulaError(step.amount[end]);
        if (error) {
          errors.push(`${where}.amount.${end}: ${error}`);
        }
      }
    }

    if (step.do == 'bonusAttack' && step.cost && !['none', 'free', 'move', 'standard'].includes(step.cost)) {
      errors.push(`${where}: cost must be none, free, move or standard`);
    }

    if (step.do == 'askNumber' && step.var && !/^[\w-]+$/.test(step.var)) {
      errors.push(`${where}: var must be a plain name`);
    }

    for (const key of ['amount', 'dif', 'rounds', 'value', 'uses', 'upshift', 'downshift', 'min', 'max', 'defenseBonus', 'minLevel', 'maxLevel']) {
      const objectAmount = key == 'amount' && step.do == 'spend' && step.amount && typeof step.amount == 'object';
      const error = (key == 'value' && ['setToggle', 'setForm'].includes(step.do)) || objectAmount ? null : formulaError(step[key]);
      if (error) {
        errors.push(`${where}.${key}: ${error}`);
      }
    }

    for (const branch of ['onSuccess', 'onFail', 'onCrit']) {
      if (step[branch]) {
        errors.push(...stepErrors(step[branch], `${where}.${branch}`));
      }
    }

    if (step.do == 'choose') {
      if (!Array.isArray(step.options) || !step.options.length) {
        errors.push(`${where}: choose needs options`);
      } else {
        step.options.forEach((option, i) => errors.push(...stepErrors(option?.steps ?? [], `${where}.options[${i}].steps`)));
      }
    }
  });

  return errors;
}
