import { contextFor, evaluate } from "./predicate.mjs";

/**
 * Prerequisites (docs/PREREQUISITES_PLAN.md): what an item requires of the character taking it, or -
 * for an Upgrade - of the item it attaches to. Stored as `system.prerequisites.when`, the same tag
 * list rules use (rules/predicate.mjs). Everything that shows an item's prerequisite (the actor-sheet
 * chip, the chat card, an attached Upgrade's line) shows prerequisiteText(item), the tags in words.
 * The old typed `system.prerequisite` text was retired 2026-10-07 (docs/rules-batches/prereq-text-retired.md):
 * a world migration moves text with no tags into one `ask:` tag; it is only read here as a fallback for
 * an unmigrated item until the field leaves the data model in 6.1.
 *
 * Checked when an item is added to an actor and when an Upgrade is attached. The world setting
 * `essence20.prerequisiteMode` decides what an unmet prerequisite does (decided 2026-10-02):
 *   off     nothing is checked
 *   warn    anyone can add it; the GM gets a note (the default)
 *   strict  only the GM can add it; a player is refused
 * An `ask:` tag ("GM approval", a story event) never blocks, in either mode - the GM is always told.
 * A character who later stops meeting one (a lost Perk, a lowered Skill) gets a note to the GM too;
 * nothing is removed.
 *
 * The pure checks (prerequisitesOf, checkPrerequisites, describePrerequisite) run under plain Node.
 */

export const PREREQUISITE_MODES = ['off', 'warn', 'strict'];

/** An item's prerequisite tags. */
export function prerequisitesOf(item) {
  const when = item?.system?.prerequisites?.when;
  return Array.isArray(when) ? when : [];
}

const capital = text => String(text ?? '').replace(/^\w/, c => c.toUpperCase());
const words = key => String(key ?? '').replace(/([a-z])([A-Z])/g, '$1 $2');

/**
 * One prerequisite in plain words: "Might d6+", "Level 5+", "Owns Favorite Command".
 * @param {String|Object} entry   A tag, or {any: [...]}.
 * @returns {String}
 */
export function describePrerequisite(entry) {
  if (entry && typeof entry == 'object' && Array.isArray(entry.any)) {
    return entry.any.map(describePrerequisite).join(' or ');
  }

  const text = String(entry ?? '');
  if (text.startsWith('not:')) {
    return `Not: ${describePrerequisite(text.slice(4))}`;
  }

  const op = sign => ({ '>=': '+', '<=': ' or less', '>': '+ (more than)', '<': ' (less than)', '=': '' })[sign] ?? '';
  let match;
  if ((match = /^self:level(>=|<=|>|<|=)(\d+)$/.exec(text))) {
    return match[1] == '<=' ? `Level ${match[2]} or lower` : `Level ${match[2]}${op(match[1])}`;
  }

  if ((match = /^self:skill:([\w-]+)(>=|<=|>|<|=)(\w+)$/.exec(text))) {
    return `${capital(words(match[1]))} ${match[3]}${op(match[2])}`;
  }

  if ((match = /^self:essence:([\w-]+)(>=|<=|>|<|=)(\d+)$/.exec(text))) {
    return `${capital(match[1])} ${match[3]}${op(match[2])}`;
  }

  if ((match = /^self:size(>=|<=|>|<|=)(\w+)$/.exec(text))) {
    return `Size ${capital(match[2])}${match[1] == '>=' ? ' or larger' : match[1] == '<=' ? ' or smaller' : ''}`;
  }

  if ((match = /^self:hasType:([\w-]+):(.+)$/.exec(text))) {
    return `Has ${match[2]} (${words(match[1])})`;
  }

  if ((match = /^self:has:(.+)$/.exec(text))) {
    return `Has ${match[1]}`;
  }

  if ((match = /^self:hasItem:(.+)$/.exec(text))) {
    const name = globalThis.fromUuidSync?.(match[1])?.name;
    return `Has ${name ?? match[1]}`;
  }

  if ((match = /^self:count:([\w-]+)(>=|<=|>|<|=)(\d+)$/.exec(text))) {
    return `${match[3]}${match[2] == '>=' ? ' or more' : match[2] == '<=' ? ' or fewer' : ''} ${capital(words(match[1]))} items`;
  }

  if ((match = /^self:trained:([\w.-]+)$/.exec(text))) {
    return `Trained: ${match[1].split('.').map(words).join(' ')}`;
  }

  if ((match = /^host:(\w+):(.+)$/.exec(text))) {
    return `Attached to: ${words(match[1])} ${match[2]}`;
  }

  if (text == 'self:canTransform') {
    return 'Has an Alt Mode';
  }

  if ((match = /^ask:(.+)$/.exec(text))) {
    return capital(match[1]);
  }

  if ((match = /^self:tag:([\w-]+)$/.exec(text))) {
    return `${capital(words(match[1]))} trait`;
  }

  if ((match = /^self:type:([\w-]+)$/.exec(text))) {
    return `Is a ${ACTOR_TYPE_WORDS[match[1]] ?? words(match[1]).toLowerCase()}`;
  }

  if ((match = /^self:data:system\.traits\.([\w-]+)$/.exec(text))) {
    return `${capital(words(match[1]))} trait`;
  }

  if ((match = /^self:data:system\.qualified\.([\w.-]+)$/.exec(text))) {
    return `Qualified: ${match[1].split('.').map(words).join(' ')}`;
  }

  if ((match = /^self:data:([\w.-]+?)(>=|<=|>|<|=)([\w.-]+)$/.exec(text))) {
    return `${dataWords(match[1])} ${match[3]}${match[2] == '<=' ? ' or less' : op(match[2])}`;
  }

  if ((match = /^self:data:([\w.-]+)$/.exec(text))) {
    return `Has ${dataWords(match[1]).toLowerCase()}`;
  }

  return text;
}

const ACTOR_TYPE_WORDS = { npc: 'Threat', playerCharacter: 'player character', zord: 'Zord', megaform: 'Megaform Zord' };

/* A `self:data:` path in words: a few known ones by name, else its last parts ("system.crew.numPassengers"
   -> "Crew num passengers"). */
const DATA_WORDS = {
  'system.powers.personal.max': 'Maximum Personal Power',
  'system.energon.normal.max': 'Energon Pool max',
  'system.conditioning': 'Conditioning',
  'system.crew.numPassengers': 'Passengers',
};
function dataWords(path) {
  if (DATA_WORDS[path]) {
    return DATA_WORDS[path];
  }

  const movement = /^system\.movement\.(\w+)\.total$/.exec(path);
  if (movement) {
    return `${capital(words(movement[1]))} Movement`;
  }

  return capital(path.replace(/^(system|flags\.essence20)\./, '').split('.').map(words).join(' ').toLowerCase());
}

/**
 * An item's prerequisites as one line of words ("Might d6+ or Finesse d6+; Level 5+"), for display -
 * '' when it has none. Takes an Item (or its data) or a parent item's attachment entry (an Upgrade's
 * `system.items` snapshot on its weapon or armor), whose tags are read from the attached item (its uuid).
 * Until 6.1, an item with no tags falls back to its old typed `prerequisite` text (an unmigrated item).
 * @param {Item|Object} item
 * @returns {String}
 */
export function prerequisiteText(item) {
  if (!item) {
    return '';
  }

  let when = prerequisitesOf(item);
  if (!item.system && item.uuid) {
    // An attachment entry carries no tags of its own: read the attached item's, live.
    when = prerequisitesOf(globalThis.fromUuidSync?.(item.uuid, { strict: false }));
  }

  if (when.length) {
    return when.map(describePrerequisite).join('; ');
  }

  const legacy = item.system ? item.system.prerequisite : item.prerequisite;
  return typeof legacy == 'string' ? legacy.trim() : '';
}

/**
 * Check an item's prerequisites against a character.
 * @param {Actor} actor
 * @param {Item|Object} item       The item being added (an Item or its data).
 * @param {Object} [options]
 * @param {Item} [options.host]    The item an Upgrade is being attached to.
 * @returns {{met: Boolean, unmet: String[], asks: String[], waiting: String[]}}
 *   unmet: what the character doesn't have; asks: what needs the GM (`ask:` tags and anything the
 *   system can't read); waiting: `host:` checks for an Upgrade not attached yet.
 */
export function checkPrerequisites(actor, item, { host = null } = {}) {
  if (actor?.type == 'megaform' && actor.system?.subtype?.includes?.('megaformCombiner')) {
    return checkCombinerPrerequisites(actor, item, { host });
  }

  return checkOne(actor, item, { host });
}

/**
 * A Combiner form's weapon (EoC p.44): at least one component must be Qualified to use the weapon's normal size - its
 * prerequisites are checked against each active component, and met when any one meets them. An upscaled weapon
 * (items/attacks/weapon-upscale.mjs) is checked on its normal size's prerequisites that way, and on its size
 * requirement against the form itself.
 */
function checkCombinerPrerequisites(form, item, options) {
  // A form with nobody in it (broken apart, not merged yet) wields nothing: nothing to check.
  if (!Object.keys(form.system?.actors ?? {}).length) {
    return { met: true, unmet: [], asks: [], waiting: [] };
  }

  const upscaled = item?.flags?.essence20?.upscaled;
  const own = upscaled ? checkOne(form, item, options) : { met: true, unmet: [], asks: [], waiting: [] };
  const normal = upscaled ? { type: item.type, name: item.name, system: { prerequisites: upscaled.prerequisites } } : item;
  const members = Object.values(form.system?.actors ?? {})
    .map(entry => globalThis.fromUuidSync?.(entry?.uuid))
    .filter(member => member && !['zord', 'vehicle', 'megaform'].includes(member.type)
      && !(Number(member.system?.health?.max) > 0 && Number(member.system?.health?.value) <= 0));
  const results = members.map(member => checkOne(member, normal, options));
  const best = results.find(result => result.met) ?? results[0] ?? checkOne(form, normal, options);
  return {
    met: own.met && best.met,
    unmet: [...own.unmet, ...best.unmet],
    asks: [...own.asks, ...best.asks],
    waiting: [...own.waiting, ...best.waiting],
  };
}

function checkOne(actor, item, { host = null } = {}) {
  const result = { met: true, unmet: [], asks: [], waiting: [] };
  for (const entry of prerequisitesOf(item)) {
    const answer = evaluate([entry], contextFor({ self: actor, ruleItem: item, host, combat: null }));
    if (answer === true) {
      continue;
    }

    const words = describePrerequisite(entry);
    if (answer === false) {
      result.unmet.push(words);
    } else if (!host && JSON.stringify(entry).includes('host:')) {
      result.waiting.push(words);
    } else {
      result.asks.push(words);
    }
  }

  result.met = !result.unmet.length;
  return result;
}

/* -------------------------------------------- */
/*  In Foundry                                   */
/* -------------------------------------------- */

const T = (key, data) => (data ? game.i18n.format(`E20.Prerequisites.${key}`, data) : game.i18n.localize(`E20.Prerequisites.${key}`));
const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function mode() {
  try {
    const value = game.settings.get('essence20', 'prerequisiteMode');
    return PREREQUISITE_MODES.includes(value) ? value : 'warn';
  } catch (error) {
    return 'warn';
  }
}

const listHtml = lines => `<ul>${lines.map(line => `<li>${escape(line)}</li>`).join('')}</ul>`;

/**
 * A chat note only GMs see. `toast` (a pop-up's text) also shows it on every GM's screen as a warning (onGmNote) - for
 * an item added without its prerequisites, by anyone, in warn or strict mode (user ruling 2026-10-07).
 */
async function noteGm(content, toast = null) {
  const whisper = game.users.filter(user => user.isGM).map(user => user.id);
  if (whisper.length) {
    await ChatMessage.create({ content, whisper, speaker: { alias: T('Title') }, ...(toast ? { flags: { essence20: { prerequisiteToast: toast } } } : {}) });
  }
}

/** On each GM's client: a prerequisite note that carries a toast pops up as a warning. */
export function onGmNote(message) {
  const toast = message?.flags?.essence20?.prerequisiteToast;
  if (toast && game.user?.isGM) {
    ui.notifications.warn(toast);
  }
}

/** What adding (or attaching) an unmet item tells the GM, and the player. */
async function reportAdded(actor, item, result) {
  if (result.unmet.length) {
    await noteGm(`<p>${escape(T('AddedUnmet', { actor: actor.name, item: item.name, user: game.user.name }))}</p>${listHtml(result.unmet)}`,
      T('AddedUnmetGm', { actor: actor.name, item: item.name, missing: result.unmet.join('; ') }));
    if (!game.user.isGM) {
      ui.notifications.warn(T('AddedUnmetPlayer', { item: item.name, missing: result.unmet.join('; ') }));
    }
  }

  if (result.asks.length) {
    await noteGm(`<p>${escape(T('NeedsGm', { actor: actor.name, item: item.name }))}</p>${listHtml(result.asks)}`);
  }
}

/**
 * For a chooser offering compendium items (apps/choices-selector.mjs): what this character is
 * missing for one option, read from the compendium index (system.prerequisites rides in it), and
 * whether the option should be refused outright (strict mode, for a player). Null when nothing's
 * missing or prerequisites are off.
 * @param {Actor} actor
 * @param {String} uuid
 * @returns {{missing: String, blocked: Boolean}|null}
 */
export function choicePrerequisites(actor, uuid) {
  if (!actor || !uuid || mode() == 'off') {
    return null;
  }

  const entry = globalThis.fromUuidSync?.(uuid, { strict: false });
  if (!entry?.system?.prerequisites?.when?.length) {
    return null;
  }

  const result = checkPrerequisites(actor, entry);
  return result.met ? null : { missing: result.unmet.join('; '), blocked: mode() == 'strict' && !game.user?.isGM };
}

/**
 * Strict mode, a GM dropping an item onto a character who doesn't meet its prerequisites: asked "add it anyway?"
 * first (user ruling 2026-10-07; players stay refused by onPreCreateItem). Called by the sheet's drop handler before
 * anything is created, so the drop's own set-up (a Perk's values, a Role's picks) runs as usual on a yes. A yes still
 * leaves the GM the usual chat note (onCreateItem). Upgrades are checked once attached (checkAttached).
 * @returns {Promise<Boolean>} false to stop the drop.
 */
export async function confirmGmDrop(actor, item) {
  if (!game.user?.isGM || mode() != 'strict' || !actor || item?.type == 'upgrade' || !prerequisitesOf(item).length) {
    return true;
  }

  const result = checkPrerequisites(actor, item);
  if (result.met) {
    return true;
  }

  const answer = await foundry.applications.api.DialogV2.confirm({
    window: { title: T('Title') },
    content: `<p>${escape(T('GmConfirm', { actor: actor.name, item: item.name }))}</p>${listHtml(result.unmet)}<p>${escape(T('GmConfirmQuestion'))}</p>`,
    rejectClose: false,
  });
  return answer === true;
}

/** An item a rule gives (flags.essence20.grantedBy) isn't the character taking it: no prerequisite check. */
const isGranted = item => !!item?.flags?.essence20?.grantedBy;

/** Strict mode stops a player adding an item whose prerequisites aren't met. Sync: preCreate can't wait. */
export function onPreCreateItem(item, data, options, userId) {
  const actor = item.parent;
  if (userId != game.user.id || actor?.documentName != 'Actor' || options.e20SkipPrerequisites || !prerequisitesOf(item).length || isGranted(item)) {
    return;
  }

  if (mode() != 'strict' || game.user.isGM) {
    return;
  }

  const result = checkPrerequisites(actor, item);
  if (!result.met) {
    ui.notifications.warn(T('Refused', { item: item.name, missing: result.unmet.join('; ') }));
    return false;
  }
}

export async function onCreateItem(item, options, userId) {
  const actor = item.parent;
  if (userId != game.user.id || actor?.documentName != 'Actor' || options.e20SkipPrerequisites || mode() == 'off' || !prerequisitesOf(item).length || isGranted(item)) {
    return;
  }

  // An Upgrade is checked once it's attached (checkAttached), against what it's attached to.
  if (item.type == 'upgrade' && !item.flags?.essence20?.parentId) {
    return;
  }

  await reportAdded(actor, item, checkPrerequisites(actor, item));
}

/**
 * After an Upgrade is attached (sheet-handlers/attachment-handler.mjs#_attachItem): check it with
 * the item it went on. In strict mode a player's unmet attachment is taken off again.
 * @returns {Promise<Boolean>} false when it was removed.
 */
export async function checkAttached(actor, upgrade, host) {
  if (!actor || !upgrade || mode() == 'off' || !prerequisitesOf(upgrade).length) {
    return true;
  }

  const result = checkPrerequisites(actor, upgrade, { host });
  if (!result.met && mode() == 'strict' && !game.user.isGM) {
    ui.notifications.warn(T('Refused', { item: upgrade.name, missing: result.unmet.join('; ') }));
    await upgrade.delete();
    return false;
  }

  await reportAdded(actor, upgrade, result);
  return true;
}

/* A character who stops meeting a prerequisite later: a note to the GM, once, on the active GM's
   client. Each item remembers whether it was met (flags.essence20.prerequisitesMet); the first check
   just records it, so an item added unmet isn't reported a second time. */
const pending = new Map();

function recheckSoon(actor) {
  if (!actor?.id || actor.documentName != 'Actor' || !game.users?.activeGM?.isSelf || mode() == 'off') {
    return;
  }

  clearTimeout(pending.get(actor.id));
  pending.set(actor.id, setTimeout(() => {
    pending.delete(actor.id);
    recheck(actor).catch(error => console.error('Essence20 | prerequisite recheck failed', error));
  }, 500));
}

export async function recheck(actor) {
  const updates = [];
  const lost = [];
  for (const item of actor.items) {
    if (!prerequisitesOf(item).length) {
      continue;
    }

    const host = item.flags?.essence20?.parentId ? actor.items.get(item.flags.essence20.parentId) : null;
    if (item.type == 'upgrade' && !host) {
      continue;
    }

    const result = checkPrerequisites(actor, item, { host });
    const was = item.flags?.essence20?.prerequisitesMet;
    if (was === result.met) {
      continue;
    }

    if (was === true && !result.met) {
      lost.push({ item, unmet: result.unmet });
    }

    updates.push({ _id: item.id, 'flags.essence20.prerequisitesMet': result.met });
  }

  if (updates.length) {
    await actor.updateEmbeddedDocuments('Item', updates, { e20SkipPrerequisites: true });
  }

  for (const { item, unmet } of lost) {
    await noteGm(`<p>${escape(T('Lost', { actor: actor.name, item: item.name }))}</p>${listHtml(unmet)}`);
  }
}

if (globalThis.Hooks?.on) {
  Hooks.once?.('init', () => {
    game.settings.register('essence20', 'prerequisiteMode', {
      name: 'E20.Prerequisites.Setting',
      hint: 'E20.Prerequisites.SettingHint',
      scope: 'world',
      config: true,
      type: String,
      default: 'warn',
      choices: { off: 'E20.Prerequisites.ModeOff', warn: 'E20.Prerequisites.ModeWarn', strict: 'E20.Prerequisites.ModeStrict' },
    });
  });
  Hooks.on('preCreateItem', onPreCreateItem);
  Hooks.on('createItem', onCreateItem);
  Hooks.on('createChatMessage', onGmNote);
  Hooks.on('updateActor', actor => recheckSoon(actor));
  Hooks.on('createItem', item => recheckSoon(item.parent));
  Hooks.on('deleteItem', item => recheckSoon(item.parent));
  Hooks.on('updateItem', (item, changes, options) => {
    if (!options?.e20SkipPrerequisites) {
      recheckSoon(item.parent);
    }
  });
}
