import { T } from "../shared/item-lang.mjs";
import { num } from "../shared/numbers.mjs";

/**
 * Sorcery: building an enchanted item or focus (Finster's Monster-Matic Cookbook, "Building an Enchanted Item or Focus",
 * p.274). A character with the Sorcery Perk spends points of the Sorcery build budget on a magical focus: 2 points, 1
 * for a one-use focus, +1 for a unique adjustment. While it is wielded or worn it grants one basic attack or one
 * Sorcerous Power worth up to 3 points, once per scene. A focus built into a weapon or armor gives that item the
 * Sorcerous trait. It can be summoned back to hand for a Story Point, and a destroyed one (not a one-use focus) is
 * replaced with an hour-long ritual and a DIF 15 Performance (Rituals) test. Table 4-1 (p.273) also makes a Sorcerous
 * Power or attack that needs a specific focus 1 point cheaper - such a Power works only while its focus is ready.
 *
 * NOT a Role Focus. A Role Focus is the `focus` Item type (data/item/focus.mjs, role-handler.mjs); a magical focus is a
 * Sorcerous Power Item (system.type 'sorcerous') carrying `flags.essence20.sorcerousFocus`. Nothing here creates, reads
 * or changes a `focus` Item, and the rules steps are named `*SorcerousFocus` so they never meet the `focus` step
 * (rules/plugins/picks/pick-and-loop-steps.mjs).
 *
 * The flag:
 * - on the focus itself: `{isFocus: true, host, oneUse, unique, addedTrait, granted}` - host the id of the weapon,
 *   armor or gear it is built into (null for a focus that is an object of its own), addedTrait whether building it put
 *   the Sorcerous trait on the host, granted the id of the Power it grants;
 * - on a Power that needs it: `{requires: <focus id>}`, plus `grantedBy: <focus id>` on the Power the focus grants (which
 *   the focus paid for, so it isn't counted against the budget again - documents/actor.mjs#_prepareSorcerousPower).
 *
 * Lost and destroyed are the focus's own rule toggles (`lost`, `destroyed`), set from its Use buttons.
 */

export const FOCUS_FLAG = 'sorcerousFocus';

/** The most a Power granted by a focus may cost (p.274). */
export const GRANTED_POWER_MAX = 3;

/** DIF of the ritual that replaces a destroyed focus (p.274). */
export const REPLACE_DIF = 15;

/**
 * Points of the Sorcery budget a focus costs: 2, or 1 for a one-use focus; +1 for a unique adjustment.
 * @param {{oneUse?: Boolean, unique?: Boolean}} build
 * @returns {Number}
 */
export function focusCost({ oneUse = false, unique = false } = {}) {
  return (oneUse ? 1 : 2) + (unique ? 1 : 0);
}

/** The item's sorcerousFocus flag, or an empty object. */
export function focusFlag(item) {
  return item?.flags?.essence20?.[FOCUS_FLAG] ?? {};
}

/** Whether the item is a magical focus (never a Role Focus - those are `focus` Items). */
export function isSorcerousFocus(item) {
  return item?.type == 'power' && focusFlag(item).isFocus === true;
}

/** Whether a Power's build cost counts against the Sorcery budget (a Power granted by a focus was paid for by it). */
export function countsAgainstBudget(power) {
  return !focusFlag(power).grantedBy;
}

function itemsOf(actor) {
  const items = actor?.items;
  return items?.contents ?? (items ? [...items] : []);
}

function itemOf(actor, id) {
  return id ? (actor?.items?.get?.(id) ?? itemsOf(actor).find(item => item.id == id || item._id == id) ?? null) : null;
}

/** The actor's magical foci. */
export function sorcerousFoci(actor) {
  return itemsOf(actor).filter(isSorcerousFocus);
}

/**
 * The focus an item belongs to: the item itself when it is one, else the focus it needs.
 * @param {Item} item
 * @param {Actor} [actor]
 * @returns {Item|null}
 */
export function focusFor(item, actor = item?.parent) {
  if (isSorcerousFocus(item)) {
    return item;
  }

  const id = focusFlag(item).requires;
  const focus = itemOf(actor, id);
  return isSorcerousFocus(focus) ? focus : null;
}

/** The weapon, armor or gear a focus is built into, when it is still there. */
export function focusHost(focus, actor = focus?.parent) {
  return itemOf(actor, focusFlag(focus).host);
}

function toggled(item, key) {
  return !!item?.flags?.essence20?.rules?.toggles?.[key];
}

/**
 * Why a focus can't be used right now, or null when it can. "Wielded or worn" (p.274): a focus built into an item
 * needs that item on the character and, where the item can be equipped, equipped.
 * @param {Item} focus
 * @param {Actor} [actor]
 * @returns {'missing'|'destroyed'|'lost'|'hostMissing'|'notWielded'|null}
 */
export function focusProblem(focus, actor = focus?.parent) {
  if (!isSorcerousFocus(focus)) {
    return 'missing';
  }

  if (toggled(focus, 'destroyed')) {
    return 'destroyed';
  }

  if (toggled(focus, 'lost')) {
    return 'lost';
  }

  const hostId = focusFlag(focus).host;
  if (!hostId) {
    return null;
  }

  const host = focusHost(focus, actor);
  if (!host) {
    return 'hostMissing';
  }

  return host.system?.equipped === false ? 'notWielded' : null;
}

/** Whether the item's focus (itself, or the one it needs) is wielded or worn and neither lost nor destroyed. */
export function focusReady(item, actor = item?.parent) {
  const flag = focusFlag(item);
  if (!flag.isFocus && !flag.requires) {
    return true;
  }

  return focusProblem(focusFor(item, actor), actor) === null;
}

/* -------------------------------------------- */
/*  Item data                                    */
/* -------------------------------------------- */

const READY = 'rule:sorcerousFocusReady';

/**
 * The rules every Power that needs a focus carries: it can be activated only while its focus is ready, and using it
 * spends a one-use focus. `perScene` adds the once-per-scene limit of a Power the focus grants.
 * @param {{perScene?: Boolean, key?: String}} options
 * @returns {Object[]}
 */
export function focusGateRules({ perScene = false, key = 'sorcerousFocus' } = {}) {
  const gate = [READY];
  const used = { type: 'Trigger', event: 'powerUsed', label: T('SorcerousFocusUsedLabel'), when: ['item:own'], steps: [{ do: 'useSorcerousFocus' }] };
  if (perScene) {
    gate.push(`not:self:limitUsed:${key}:scene`);
    used.limit = { per: 'scene', key };
  }

  return [{ type: 'PowerGate', label: T('SorcerousFocusGateLabel'), when: gate }, used];
}

/** The focus's own Use buttons: lost, summoned back for a Story Point, destroyed, replaced by ritual. */
export function focusUseRules({ oneUse = false } = {}) {
  const rules = [
    { type: 'Use', label: T('SorcerousFocusLoseLabel'), when: ['not:self:toggle:lost', 'not:self:toggle:destroyed'], steps: [{ do: 'setToggle', key: 'lost', value: true }, { do: 'chat', text: T('SorcerousFocusLostChat') }] },
    { type: 'Use', label: T('SorcerousFocusSummonLabel'), when: ['self:toggle:lost', 'not:self:toggle:destroyed'], steps: [{ do: 'spend', resource: { storyPoints: true }, amount: 1 }, { do: 'readySorcerousFocus' }, { do: 'chat', text: T('SorcerousFocusSummonChat') }] },
    { type: 'Use', label: T('SorcerousFocusDestroyLabel'), when: ['not:self:toggle:destroyed'], steps: [{ do: 'setToggle', key: 'destroyed', value: true }, { do: 'chat', text: T('SorcerousFocusDestroyedChat') }] },
  ];
  // "If somehow destroyed, a magical focus (not designed to be one use) can be replaced" (p.274).
  if (!oneUse) {
    rules.push({
      type: 'Use', label: T('SorcerousFocusReplaceLabel'), when: ['self:toggle:destroyed'],
      steps: [{
        do: 'roll', skill: 'performance', dif: REPLACE_DIF, sheetShifts: true,
        onSuccess: [{ do: 'readySorcerousFocus', destroyed: true }, { do: 'chat', text: T('SorcerousFocusReplacedChat') }],
        onFail: [{ do: 'chat', text: T('SorcerousFocusReplaceFailedChat') }],
      }],
    });
  }

  return rules;
}

/**
 * The focus itself: a Sorcerous Power at the focus's cost (so the sheet's committed / max counts it), no activation of
 * its own, and its Use buttons.
 * @param {{name: String, host?: String|null, hostName?: String, oneUse?: Boolean, unique?: Boolean, grant?: String}} build
 * @returns {Object}   Item data.
 */
export function focusPowerData(build) {
  const cost = focusCost(build);
  const where = build.hostName ? T('SorcerousFocusSummaryHost', { item: build.hostName }) : T('SorcerousFocusSummaryObject');
  const parts = [where, T(`SorcerousFocusGrant.${build.grant || 'none'}`)];
  if (build.oneUse) {
    parts.push(T('SorcerousFocusSummaryOneUse'));
  }

  if (build.unique) {
    parts.push(T('SorcerousFocusSummaryUnique'));
  }

  return {
    name: build.name || T('SorcerousFocusDefaultName'),
    type: 'power',
    img: 'systems/essence20/assets/icons/items/powers.svg',
    system: {
      type: 'sorcerous',
      powerCost: cost,
      canActivate: false,
      description: `<p>${parts.join('; ')}</p>`,
      rules: focusUseRules(build),
    },
    flags: { essence20: { [FOCUS_FLAG]: { isFocus: true, host: build.host || null, oneUse: !!build.oneUse, unique: !!build.unique, addedTrait: false, granted: null } } },
  };
}

/** The Sorcerous Power builder's choices for the focus's basic attack (Table 4-1's basic attack: 1 Energy damage). */
export function basicAttackBuild(kind, name) {
  return { name, base: kind == 'melee' ? 'melee' : 'targeting', damageType: 'element', shape: 'none', rangeSteps: 0, extraDamage: 0, extraTraits: 0, multiple: 0, ritual: 'none' };
}

/**
 * The Power a focus grants, from the builder's data: once per scene, only while the focus is ready, and paid for by
 * the focus (grantedBy).
 * @param {Object} data       Power Item data (sorceryPowerData).
 * @param {String} focusId
 * @returns {Object}
 */
export function grantedPowerData(data, focusId) {
  return {
    ...data,
    system: { ...data.system, usesInterval: 'perScene', usesPer: 1, rules: [...(data.system?.rules ?? []), ...focusGateRules({ perScene: true, key: `sorcerousFocus-${focusId}` })] },
    flags: { ...(data.flags ?? {}), essence20: { ...(data.flags?.essence20 ?? {}), [FOCUS_FLAG]: { requires: focusId, grantedBy: focusId } } },
  };
}

/**
 * A Power built with "needs a focus": it works only while that focus is ready. `discounted`: whether the builder's -1
 * actually came off its cost (not when the cost was already at the floor of 1) - the sheet puts it back if the
 * requirement is cleared (focusRequirementChanges).
 */
export function requiringPowerData(data, focusId, { discounted = true } = {}) {
  return {
    ...data,
    system: { ...data.system, rules: [...(data.system?.rules ?? []), ...focusGateRules()] },
    flags: { ...(data.flags ?? {}), essence20: { ...(data.flags?.essence20 ?? {}), [FOCUS_FLAG]: { requires: focusId, discounted } } },
  };
}

/** Whether a rule is one focusGateRules made: the focus gate, or the trigger that spends a one-use focus. */
export function isFocusGateRule(rule) {
  return (rule?.type == 'PowerGate' && Array.isArray(rule.when) && rule.when.includes(READY))
    || (rule?.type == 'Trigger' && Array.isArray(rule.steps) && rule.steps.some(step => step?.do == 'useSorcerousFocus'));
}

/** Whether a Sorcerous Power can be given (or lose) a focus requirement on its sheet - not a focus, nor what one grants. */
export function takesFocusRequirement(power) {
  const flag = focusFlag(power);
  return power?.type == 'power' && power.system?.type == 'sorcerous' && !flag.isFocus && !flag.grantedBy;
}

/** Whether the focus discount is already in the Power's cost (an older build with the "needs a focus" box ticked). */
function discountTaken(power) {
  const flag = focusFlag(power);
  if (typeof flag.discounted == 'boolean') {
    return flag.discounted;
  }

  return !!flag.requires || !!power?.flags?.essence20?.o2SorceryBuild?.focus;
}

/**
 * What changes when a Sorcerous Power's sheet picks, switches or clears the focus it needs (Table 4-1: "requires a
 * specific enchanted item or focus to function", -1 point, p.275): the requirement, the focus gate and one-use spend
 * rules, and the cost - 1 less, never below 1 ("cannot be modified lower than 1", p.274), and given back when cleared.
 * @param {Item} power          The Power as it is now.
 * @param {String|null} focusId The focus it should need ('' or null for none).
 * @returns {Object|null}       Flattened update data, or null when nothing changes.
 */
export function focusRequirementChanges(power, focusId) {
  const wanted = focusId || null;
  const flag = focusFlag(power);
  if (!takesFocusRequirement(power) || wanted == (flag.requires || null)) {
    return null;
  }

  const rules = (Array.isArray(power.system?.rules) ? power.system.rules : []).filter(rule => !isFocusGateRule(rule));
  const cost = parseInt(power._source?.system?.powerCost ?? power.system?.powerCost) || 0;
  const path = `flags.essence20.${FOCUS_FLAG}`;
  const changes = { [`${path}.requires`]: wanted, 'system.rules': wanted ? [...rules, ...focusGateRules()] : rules };
  const taken = discountTaken(power);
  if (wanted && !taken) {
    changes[`${path}.discounted`] = cost > 1;
    changes['system.powerCost'] = Math.max(1, cost - 1);
  } else if (!wanted && taken) {
    changes[`${path}.discounted`] = false;
    changes['system.powerCost'] = cost + 1;
  }

  // A Power from the builder keeps its build record in step, so rebuilding it reads the same.
  if (power.flags?.essence20?.o2SorceryBuild) {
    changes['flags.essence20.o2SorceryBuild.focus'] = !!wanted;
    changes['flags.essence20.o2SorceryBuild.focusId'] = wanted;
  }

  return changes;
}

/** The Power sheet's focus picker: the owner's foci, and which one this Power needs. Null when it doesn't apply. */
export function focusPickerContext(power) {
  if (!takesFocusRequirement(power) || !power.parent) {
    return null;
  }

  const requires = focusFlag(power).requires || '';
  return { requires, options: Object.fromEntries(sorcerousFoci(power.parent).map(focus => [focus.id, focus.name])) };
}

if (typeof Hooks != 'undefined') {
  // Picking the focus on the sheet submits only the requirement: the -1, the gate and the rules follow it here.
  Hooks.on('preUpdateItem', (item, changes) => {
    const utils = globalThis.foundry?.utils;
    const key = `flags.essence20.${FOCUS_FLAG}.requires`;
    if (!utils?.hasProperty?.(changes, key)) {
      return;
    }

    const extra = focusRequirementChanges(item, utils.getProperty(changes, key));
    if (extra) {
      utils.mergeObject(changes, utils.expandObject(extra));
    }
  });
}

/** Items a focus can be built into: weapons, armor (not a Morphin shell - armor only) and gear. */
export function focusHostOptions(actor) {
  return itemsOf(actor).filter(item => ['weapon', 'armor', 'gear'].includes(item.type) && !isSorcerousFocus(item))
    .map(item => ({ id: item.id, name: item.name, type: item.type }));
}

/** Whether building a focus into this item gives it the Sorcerous trait (a weapon or armor - p.274). */
export function hostTakesTrait(host) {
  return ['weapon', 'armor'].includes(host?.type);
}

/* -------------------------------------------- */
/*  Changing the actor                           */
/* -------------------------------------------- */

/** Add the Sorcerous trait to a weapon or armor. Answers whether it was added (false when it already had it). */
export async function addSorcerousTrait(item) {
  const traits = Array.isArray(item?.system?.traits) ? item.system.traits : [];
  if (!hostTakesTrait(item) || traits.includes('sorcerous')) {
    return false;
  }

  await item.update({ 'system.traits': [...traits, 'sorcerous'] });
  return true;
}

/** Put a lost or destroyed focus back in hand: both toggles off, and its host equipped again. */
export async function readyFocus(focus, { destroyed = false } = {}) {
  if (!isSorcerousFocus(focus)) {
    return false;
  }

  const update = { 'flags.essence20.rules.toggles.lost': false };
  if (destroyed) {
    update['flags.essence20.rules.toggles.destroyed'] = false;
  }

  await focus.update(update);
  const host = focusHost(focus);
  if (host && host.system?.equipped === false) {
    await host.update({ 'system.equipped': true });
  }

  return true;
}

/**
 * What a focus leaves behind once it goes: the Power it grants (which would otherwise keep working with nothing to
 * check its once-per-scene limit against) and the Sorcerous trait it gave its host. Safe to run twice - only what is
 * still there is touched. Powers that merely needed the focus keep needing it (and stay gated) until they're rebuilt
 * or deleted.
 * @param {Item} focus
 * @param {Actor} [actor]
 */
export async function cleanUpAfterFocus(focus, actor = focus?.parent) {
  if (!isSorcerousFocus(focus) || !actor) {
    return;
  }

  const host = focusHost(focus, actor);
  const traits = host?.system?.traits;
  if (focusFlag(focus).addedTrait && Array.isArray(traits) && traits.includes('sorcerous')) {
    await host.update({ 'system.traits': traits.filter(trait => trait != 'sorcerous') });
  }

  const ids = itemsOf(actor).filter(item => item.id != focus.id && focusFlag(item).grantedBy == focus.id).map(item => item.id);
  if (ids.length) {
    await actor.deleteEmbeddedDocuments('Item', ids);
  }
}

/** Remove a focus: it, the Power it grants, and the Sorcerous trait it gave its host (cleanUpAfterFocus). */
export async function removeFocus(focus) {
  const actor = focus?.parent;
  if (!isSorcerousFocus(focus) || !actor) {
    return;
  }

  await cleanUpAfterFocus(focus, actor);
  await actor.deleteEmbeddedDocuments('Item', [focus.id]);
}

if (typeof Hooks != 'undefined') {
  // A focus deleted any other way (the sheet's delete, a drag off, a script) takes its granted Power and trait with it.
  // Only the client that deleted it does the work, so it happens once.
  Hooks.on('deleteItem', (item, options, userId) => {
    if (userId == globalThis.game?.user?.id && isSorcerousFocus(item) && item.parent) {
      cleanUpAfterFocus(item, item.parent);
    }
  });
}

/**
 * After a Power that needs a focus is used: a one-use focus is spent ("designed to be a one-use item", p.274).
 * @returns {Promise<String|null>}   A chat line when the focus was used up.
 */
export async function useFocusFor(power) {
  const focus = focusFor(power);
  if (!focus || !focusFlag(focus).oneUse) {
    return null;
  }

  const name = focus.name;
  await removeFocus(focus);
  return T('SorcerousFocusSpentChat', { focus: name });
}

/* -------------------------------------------- */
/*  The Powers tab's Build Focus button           */
/* -------------------------------------------- */

/** Whether a rule is the Use that builds a focus (the Sorcery Perk's "Build an enchanted item or focus"). */
export function isBuildFocusUse(rule) {
  return rule?.type == 'Use' && Array.isArray(rule.steps) && rule.steps.some(step => step?.do == 'buildSorcerousFocus');
}

/** The actor's item that can build a focus - the Sorcery Perk, or any item carrying that Use - or null. */
export function focusBuilderSource(actor) {
  return itemsOf(actor).find(item => Array.isArray(item.system?.rules) && item.system.rules.some(isBuildFocusUse)) ?? null;
}

/**
 * The Powers tab's Build Focus button: runs the Sorcery Perk's own build Use (the same dialog, limits and chat card
 * as its Use button, without asking which of its Uses), and posts the card.
 * @param {Actor} actor
 * @param {{runUse?: Function}} [options]   runUse: rules/triggers.mjs#runUse (tests).
 * @returns {Promise<String|null>}   The chat card, or null when nothing was built.
 */
export async function buildFocusFromSheet(actor, { runUse = null } = {}) {
  const source = focusBuilderSource(actor);
  if (!source) {
    globalThis.ui?.notifications?.warn?.(T('SorcerousFocusNoBuilder', { name: actor?.name ?? '' }));
    return null;
  }

  runUse ??= (await import("../../rules/triggers.mjs")).runUse;
  const card = await runUse(source, async () => true, { pick: (item, available) => available.find(({ rule }) => isBuildFocusUse(rule)) ?? null });
  if (card && globalThis.ChatMessage?.create) {
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: card });
  }

  return card ?? null;
}

/* -------------------------------------------- */
/*  The builder dialog                           */
/* -------------------------------------------- */

function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function focusForm(actor) {
  const hosts = focusHostOptions(actor);
  const hostOptions = [`<option value="">${T('SorcerousFocusHostNone')}</option>`,
    ...hosts.map(host => `<option value="${host.id}">${escapeHtml(host.name)} (${game.i18n.localize(`TYPES.Item.${host.type}`)})</option>`)].join('');
  const grants = ['none', 'ranged', 'melee', 'power'].map(key => `<option value="${key}">${T(`SorcerousFocusGrant.${key}`)}</option>`).join('');
  const sorcerous = actor.system?.powers?.sorcerous ?? {};
  const left = num(sorcerous.max) - num(sorcerous.committed);
  return `
    <p class="hint">${T('SorcerousFocusBudget', { left })}</p>
    <div class="form-group"><label>${T('SorcerousFocusLabel.name')}</label><input type="text" name="name"/></div>
    <div class="form-group"><label>${T('SorcerousFocusLabel.host')}</label><select name="host">${hostOptions}</select></div>
    <div class="form-group"><label>${T('SorcerousFocusLabel.grant')}</label><select name="grant">${grants}</select></div>
    <div class="form-group"><label>${T('SorcerousFocusLabel.oneUse')}</label><input type="checkbox" name="oneUse"/></div>
    <div class="form-group"><label>${T('SorcerousFocusLabel.unique')}</label><input type="checkbox" name="unique"/></div>`;
}

function readFocusForm(form) {
  const e = form.elements;
  return { name: e.name.value.trim(), host: e.host.value || null, grant: e.grant.value, oneUse: e.oneUse.checked, unique: e.unique.checked };
}

/**
 * Build a magical focus on the actor (the Sorcery Perk's Use): the focus, the Sorcerous trait on its weapon or armor,
 * and the attack or Power it grants. A cancelled dialog makes nothing.
 * @param {Actor} actor
 * @returns {Promise<String|null>}   The chat line, or null when cancelled.
 */
export async function buildSorcerousFocus(actor) {
  const build = await foundry.applications.api.DialogV2.wait({
    window: { title: T('SorcerousFocusTitle') },
    // A fixed width: with none, the long intro paragraph stretches the dialog across the screen.
    position: { width: 460 },
    classes: ["window-app", "e20-window"],
    content: focusForm(actor),
    buttons: [
      { action: 'ok', label: T('SorcerousFocusCreate'), default: true, callback: (event, button) => readFocusForm(button.form) },
      { action: 'cancel', label: game.i18n.localize('E20.DialogCancelButton') },
    ],
    rejectClose: false,
  });
  if (!build || build == 'cancel') {
    return null;
  }

  const host = itemOf(actor, build.host);
  build.hostName = host?.name ?? '';
  build.name ||= host ? T('SorcerousFocusNameFor', { item: host.name }) : T('SorcerousFocusDefaultName');

  // The Power it grants is built first, so backing out of that builder makes nothing at all.
  let granted = null;
  if (build.grant == 'power') {
    const builder = await import("./temper-tempest-sorcery-builder.mjs");
    granted = await builder.askSorcerousPower(actor, { maxCost: GRANTED_POWER_MAX, focusable: false, title: T('SorcerousFocusGrantTitle', { focus: build.name }) });
    if (!granted) {
      return null;
    }
  } else if (build.grant == 'ranged' || build.grant == 'melee') {
    const builder = await import("./temper-tempest-sorcery-builder.mjs");
    granted = builder.sorceryPowerData(basicAttackBuild(build.grant, T(`SorcerousFocusAttackName.${build.grant}`, { focus: build.name })));
  }

  const data = focusPowerData(build);
  const sorcerous = actor.system?.powers?.sorcerous ?? {};
  if (num(sorcerous.committed) + data.system.powerCost > num(sorcerous.max)) {
    ui.notifications?.warn?.(T('O2SorceryOverBudget', { cost: data.system.powerCost, left: num(sorcerous.max) - num(sorcerous.committed) }));
  }

  const [focus] = await actor.createEmbeddedDocuments('Item', [data]);
  const addedTrait = await addSorcerousTrait(host);
  let grantedItem = null;
  if (granted) {
    [grantedItem] = await actor.createEmbeddedDocuments('Item', [grantedPowerData(granted, focus.id)]);
  }

  await focus.update({ [`flags.essence20.${FOCUS_FLAG}.addedTrait`]: addedTrait, [`flags.essence20.${FOCUS_FLAG}.granted`]: grantedItem?.id ?? null });
  return T('SorcerousFocusBuilt', { name: actor.name, focus: focus.name, cost: data.system.powerCost });
}
