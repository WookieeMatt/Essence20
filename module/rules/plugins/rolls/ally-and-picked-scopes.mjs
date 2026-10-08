import { registerRerollGrant } from "../../../mechanics/item-hooks.mjs";
import { LINK_HOLDERS, addLinkedScope, ruleLabel, rulesOfType } from "../../index.mjs";
import { resolveValue } from "../../formula.mjs";
import { contextFor, evaluate, interpolate } from "../../predicate.mjs";
import { RULE_TYPES } from "../../types.mjs";
import { baseActorOf, listOf, worldActors } from "../shared/base-actor-helpers.mjs";

/**
 * Two more ways a rule reaches other actors (round 12, group I):
 *
 *   DialogSwitch scope "alliesAnywhere" - group E's scope (every other actor on the holder's side, anywhere: token
 *     dispositions on the canvas, else Player Character or not) on Roll Options Dialog switches too: the switch is
 *     offered on those allies' rolls. "{holder}" in its label is the holder's name (rules/adapter.mjs). One switch per
 *     holder - give them a `stack` group so ticking two counts once.
 *
 *   Reroll scope "picked" + `picked: <key>` - the reroll reaches every actor whose uuid is in the list a pick
 *     (pickMany, pickEach) stored on the rule's item under that key, and with `includeHolder: true` the holder too.
 *     `skills` entries may be "{choice.<key>}" (another pick); while a list or a skill pick is missing, nobody gets
 *     it. An unlinked token's actor counts as its world actor. The rest is a Reroll rule as usual (mode, target,
 *     reset, maxUses...).
 *     `legacyEffects: "<flag>"` - Active Effects an older version handed out for the same grant (flagged
 *     flags.essence20.<flag> = the holder's uuid) are deleted once, at start-up, by the active GM, so the reroll
 *     isn't offered twice.
 */

for (const type of ['DialogSwitch']) {
  if (!RULE_TYPES[type].scopes.includes('alliesAnywhere')) {
    RULE_TYPES[type].scopes.push('alliesAnywhere');
  }
}

if (!RULE_TYPES.Reroll.scopes.includes('picked')) {
  RULE_TYPES.Reroll.scopes.push('picked');
}

for (const key of ['picked', 'includeHolder', 'legacyEffects']) {
  RULE_TYPES.Reroll.params[key] ??= { kind: 'any' };
}

const previous = RULE_TYPES.Reroll.validate;
RULE_TYPES.Reroll.validate = rule => [
  ...(previous ? previous(rule) : []),
  ...(rule.scope == 'picked' && !rule.picked ? ['scope picked needs `picked` (the pick key holding the list)'] : []),
];

// Holders of picked-scope rules are tracked like any linked rule's (LINK_HOLDERS).
addLinkedScope('picked');

const NOT_REROLL = ['type', 'label', 'when', 'scope', 'priority', 'disabled', 'stacks', 'picked', 'includeHolder', 'legacyEffects'];

/** The uuids a picked-scope rule reaches, or null while its picks aren't made. */
function reachedBy(rule, item, holder) {
  const list = item?.flags?.essence20?.rules?.choices?.[rule.picked];
  if (!Array.isArray(list)) {
    return null;
  }

  return [...(rule.includeHolder ? [holder?.uuid] : []), ...list].filter(Boolean);
}

/** The rule's reroll config, its {choice.x} skills filled - or null while one isn't picked. */
function configOf(rule, item, holder, index) {
  const settings = Object.fromEntries(Object.entries(rule).filter(([key]) => !NOT_REROLL.includes(key)));
  if (Array.isArray(settings.skills)) {
    const skills = settings.skills.map(skill => interpolate(String(skill), item));
    if (skills.some(skill => !skill)) {
      return null;
    }

    settings.skills = skills;
  }

  return {
    ...settings,
    maxUses: settings.maxUses === undefined ? undefined : resolveValue(settings.maxUses, { actor: holder, item }, 1),
    source: `${item.uuid ?? item.id}#rule${index}`,
    name: ruleLabel(rule, item),
  };
}

/** The picked-scope Reroll rules reaching this actor, as reroll configs (mechanics/rolls/reroll.mjs#getRerollConfigs). */
export function pickedRerollGrants(actor) {
  if (!actor) {
    return [];
  }

  const me = new Set([actor.uuid, baseActorOf(actor)?.uuid].filter(Boolean));
  const holders = new Map();
  for (const holder of [actor, ...[...LINK_HOLDERS].map(id => globalThis.game?.actors?.get?.(id))]) {
    if (holder?.uuid && !holders.has(holder.uuid)) {
      holders.set(holder.uuid, holder);
    }
  }

  const configs = [];
  for (const holder of holders.values()) {
    for (const { rule, item, index } of rulesOfType(holder, 'Reroll', 'picked')) {
      const reached = reachedBy(rule, item, holder);
      if (!reached || !reached.some(uuid => me.has(uuid))) {
        continue;
      }

      if (evaluate(rule.when, contextFor({ self: actor, holder, ruleItem: item })) === false) {
        continue;
      }

      const config = configOf(rule, item, holder, index);
      if (config) {
        configs.push(config);
      }
    }
  }

  return configs;
}

registerRerollGrant(pickedRerollGrants);

/** The old Active Effects (flags.essence20.<legacyEffects> = a holder's uuid) whose holder carries such a rule now. */
export function legacyRerollEffects(actors = worldActors()) {
  const wanted = new Map();
  for (const holder of actors) {
    for (const { rule } of rulesOfType(holder, 'Reroll', 'picked')) {
      if (rule.legacyEffects && holder?.uuid) {
        wanted.set(`${rule.legacyEffects}|${holder.uuid}`, true);
      }
    }
  }

  const found = [];
  for (const actor of actors) {
    const ids = listOf(actor?.effects).filter(effect => Object.entries(effect.flags?.essence20 ?? {})
      .some(([flag, value]) => wanted.has(`${flag}|${value}`))).map(effect => effect.id);
    if (ids.length) {
      found.push({ actor, ids });
    }
  }

  return found;
}

globalThis.Hooks?.once?.('ready', async () => {
  if (!globalThis.game?.user?.isActiveGM) {
    return;
  }

  for (const { actor, ids } of legacyRerollEffects()) {
    try {
      await actor.deleteEmbeddedDocuments('ActiveEffect', ids);
    } catch (error) {
      console.warn('Essence20 | could not remove old reroll effects', error);
    }
  }
});
