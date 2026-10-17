import { poolMax } from "./adapter.mjs";
import { choiceLabel } from "./lifecycle.mjs";
import { collectRules, hostOf, ruleState } from "./index.mjs";
import { summarizeRule } from "./types.mjs";

/**
 * The actor sheet's Rules tab (templates/actor/tabs/effects.hbs) - the actor-side counterpart of the
 * item sheet's Rules tab (rules/sheet.mjs). Two read-outs, one tab:
 *
 *  - effectGroups: every Active Effect acting on the actor (its own and the ones its items transfer,
 *    Actor#allApplicableEffects), sorted so that anything that will go away - a condition, an area
 *    effect from a region, anything with a duration - sits apart from what is always on.
 *  - ruleGroups: a read-only summary of the live rules (system.rules) its items give it, one group per
 *    item, so a player can see where a bonus comes from and click through to it.
 *
 * The data stays two things, exactly as on the item sheet; only the view is shared. Plain Node safe.
 */

/** Effect group order on the sheet, top to bottom. `canCreate` groups keep their Add button. */
export const EFFECT_GROUPS = [
  { type: 'condition', label: 'E20.ActorRules.Group.Conditions', icon: 'fa-solid fa-person-burst', transient: true },
  { type: 'area', label: 'E20.ActorRules.Group.Area', icon: 'fa-solid fa-draw-polygon', transient: true },
  { type: 'temporary', label: 'E20.ActorRules.Group.Temporary', icon: 'fa-solid fa-hourglass-half', transient: true, canCreate: true },
  { type: 'passive', label: 'E20.ActorRules.Group.Passive', icon: 'fa-solid fa-infinity', canCreate: true },
  { type: 'inactive', label: 'E20.ActorRules.Group.Inactive', icon: 'fa-solid fa-power-off', canCreate: true },
];

const localizeWith = localize => localize ?? (key => globalThis.game?.i18n?.localize?.(key) ?? key);

/** A Set, an array or nothing - an effect's statuses, as an array. */
function statusesOf(effect) {
  const statuses = effect?.statuses;
  if (!statuses) {
    return [];
  }

  return typeof statuses[Symbol.iterator] == 'function' && typeof statuses != 'string' ? [...statuses] : [];
}

/**
 * Whether an effect was put on the actor by a region (v14's applyActiveEffect region behavior sets
 * `origin` to the behavior's uuid - mechanics/combat/aoe-targeting.mjs uses that behavior for
 * lingering Spell/Power areas).
 */
export function isRegionEffect(effect) {
  const origin = String(effect?.origin ?? '');
  return /(^|\.)Region\.[^.]+(\.RegionBehavior\.|$)/.test(origin);
}

/**
 * Which group an effect belongs in: inactive (switched off), condition (carries a status), area (from
 * a region), temporary (has a duration), or passive (always on).
 * @param {ActiveEffect} effect
 * @returns {String}
 */
export function classifyEffect(effect) {
  if (effect?.disabled) {
    return 'inactive';
  }

  if (statusesOf(effect).length) {
    return 'condition';
  }

  if (isRegionEffect(effect)) {
    return 'area';
  }

  return effect?.isTemporary ? 'temporary' : 'passive';
}

/**
 * The item an effect comes from, when it's one of this actor's items: the item it lives on (a
 * transferred effect), or the item its origin names.
 * @param {ActiveEffect} effect
 * @param {Actor} actor
 * @returns {Item|null}
 */
export function effectSourceItem(effect, actor) {
  const parent = effect?.parent;
  if (parent && parent.documentName == 'Item') {
    return parent;
  }

  const match = /(?:^|\.)Item\.([^.]+)$/.exec(String(effect?.origin ?? ''));
  return match ? actor?.items?.get?.(match[1]) ?? null : null;
}

/** Every effect acting on the actor - own first, then those its items transfer. */
function effectsOf(actor) {
  if (typeof actor?.allApplicableEffects == 'function') {
    return [...actor.allApplicableEffects()];
  }

  const effects = actor?.effects;
  if (Array.isArray(effects?.contents)) {
    return effects.contents;
  }

  return effects && typeof effects[Symbol.iterator] == 'function' ? [...effects] : [];
}

/** A status id as the token HUD names it. */
function statusLabel(id, localize) {
  const status = (globalThis.CONFIG?.statusEffects ?? []).find(entry => entry?.id == id);
  return status?.name ? localize(status.name) : id;
}

/**
 * The effect groups for the sheet. Every group is returned (empty ones too, so the template can keep
 * the Add buttons); `empty` says whether to draw a placeholder.
 * @param {Actor} actor
 * @param {Object} [options]
 * @param {Function} [options.summarize]   effect => [String] plain-English change lines.
 * @param {Function} [options.localize]
 * @returns {Array<Object>}
 */
export function actorEffectGroups(actor, { summarize = effect => effect?.e20Summaries ?? [], localize } = {}) {
  const T = localizeWith(localize);
  const groups = EFFECT_GROUPS.map(group => ({ ...group, effects: [] }));
  const byType = Object.fromEntries(groups.map(group => [group.type, group]));

  for (const effect of effectsOf(actor)) {
    const type = classifyEffect(effect);
    const sourceItem = effectSourceItem(effect, actor);
    const fromItem = effect?.parent?.documentName == 'Item';
    const temporary = !!effect?.isTemporary;
    const durationLabel = effect?.duration?.label;
    let duration;
    if (temporary) {
      duration = durationLabel || T('E20.ActorRules.Timed');
    } else if (type == 'condition' || type == 'area') {
      duration = T(type == 'area' ? 'E20.ActorRules.WhileInArea' : 'E20.ActorRules.UntilRemoved');
    } else {
      duration = T('E20.ActorRules.Permanent');
    }

    byType[type].effects.push({
      effect,
      id: effect?.id,
      uuid: effect?.uuid,
      name: effect?.name,
      img: effect?.img,
      disabled: !!effect?.disabled,
      suppressed: !effect?.disabled && !!effect?.isSuppressed,
      temporary,
      fromItem,
      // Deleting from the actor sheet only makes sense for the actor's own effects; an item's effect
      // is deleted from that item (the toggle and edit controls work on both).
      canDelete: !fromItem,
      sourceName: sourceItem?.name ?? (effect?.origin ? effect?.sourceName ?? '' : ''),
      sourceUuid: sourceItem?.uuid ?? null,
      duration,
      statuses: statusesOf(effect).map(id => statusLabel(id, T)),
      summaries: summarize(effect) ?? [],
    });
  }

  for (const group of groups) {
    group.empty = !group.effects.length;
    // Conditions and area effects only show up while there is one - they're added from the token HUD
    // and by regions, never from this tab.
    group.hidden = group.empty && !group.canCreate;
  }

  return groups;
}

/** "RollModifier" -> "Roll Modifier". */
function typeLabel(type) {
  return String(type ?? '').replace(/([a-z0-9])([A-Z])/g, '$1 $2');
}

/** A rule's live state on its item, for the summary: a toggle's on/off, a pool's count, a choice. */
function ruleStateLine(rule, item, actor, T) {
  const state = ruleState(item);
  if (rule.type == 'Toggle' && rule.key) {
    return T((state.toggles?.[rule.key] ?? rule.default) ? 'E20.ActorRules.On' : 'E20.ActorRules.Off');
  }

  if (rule.type == 'Pool' && rule.key) {
    const max = poolMax(rule, actor, item);
    return `${state.pools?.[rule.key]?.value ?? max} / ${max}`;
  }

  if (rule.type == 'ChoiceSet' && rule.key) {
    const value = state.choices?.[rule.key];
    if (value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)) {
      return T('E20.Rules.ChoiceUnset');
    }

    // A list pick (count) reads every label.
    return choiceLabel(rule, value, { actor, item });
  }

  return '';
}

/**
 * The live rules on the actor, one group per item, items by name and each item's rules in the order
 * it lists them. Only what collectRules counts - an unequipped weapon's rules aren't on the actor.
 * @param {Actor} actor
 * @param {Object} [options]
 * @param {Function} [options.localize]
 * @param {Function} [options.collect]   For tests; defaults to rules/index.mjs#collectRules.
 * @returns {Array<{item: Object, rules: Array<Object>}>}
 */
export function actorRuleGroups(actor, { localize, collect = collectRules } = {}) {
  const T = localizeWith(localize);
  const typeLabels = globalThis.CONFIG?.Item?.typeLabels ?? {};
  const groups = new Map();
  for (const list of Object.values(collect(actor) ?? {})) {
    for (const { rule, item, index } of list) {
      const key = item?.id ?? item?.uuid ?? item?.name;
      let group = groups.get(key);
      if (!group) {
        const host = hostOf(item);
        group = {
          id: item?.id,
          uuid: item?.uuid,
          name: item?.name ?? '',
          img: item?.img,
          type: item?.type,
          typeLabel: typeLabels[item?.type] ? T(typeLabels[item.type]) : typeLabel(item?.type),
          hostName: host?.name ?? null,
          rules: [],
        };
        groups.set(key, group);
      }

      group.rules.push({
        index,
        type: rule.type,
        typeLabel: typeLabel(rule.type),
        summary: summarizeRule(rule) || typeLabel(rule.type),
        situational: Array.isArray(rule.when) && rule.when.length > 0,
        linked: !!rule.scope && rule.scope != 'self',
        state: ruleStateLine(rule, item, actor, T),
      });
    }
  }

  const result = [...groups.values()];
  for (const group of result) {
    group.rules.sort((a, b) => a.index - b.index);
  }

  return result.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The whole tab's context.
 * @param {Actor} actor
 * @param {Object} [options]   Passed through to actorEffectGroups / actorRuleGroups.
 * @returns {{effectGroups: Array, ruleGroups: Array, ruleCount: Number, transientCount: Number}}
 */
export function actorRulesContext(actor, options = {}) {
  const effectGroups = actorEffectGroups(actor, options);
  const ruleGroups = actorRuleGroups(actor, options);
  return {
    effectGroups,
    ruleGroups,
    ruleCount: ruleGroups.reduce((total, group) => total + group.rules.length, 0),
    transientCount: effectGroups.filter(group => group.transient).reduce((total, group) => total + group.effects.length, 0),
  };
}

const escapeHtml = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * A chat card for one rule from the Rules tab: its item (a link, when Foundry can make one), the rule's type, its
 * summary and its live state, all as shown on the sheet.
 * @param {Object} item                       The rule's item ({name, img, toAnchor?}).
 * @param {{type: String, summary: String, state?: String}} rule
 * @returns {String}   HTML.
 */
export function ruleChatContent(item, { type = '', summary = '', state = '' } = {}) {
  const link = typeof item?.toAnchor == 'function' ? item.toAnchor().outerHTML : `<strong>${escapeHtml(item?.name)}</strong>`;
  return `<div class="essence20 e20-rule-chat">`
    + `<header class="e20-rule-chat-header">${item?.img ? `<img src="${escapeHtml(item.img)}" alt="">` : ''}${link}</header>`
    + `<p class="e20-rule-chat-body">${type ? `<span class="e20-rule-type">${escapeHtml(type)}</span> ` : ''}${escapeHtml(summary)}</p>`
    + (state ? `<p class="e20-rule-chat-state">${escapeHtml(state)}</p>` : '')
    + `</div>`;
}
