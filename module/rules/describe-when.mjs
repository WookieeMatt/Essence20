import { tagPhrase } from "./predicate.mjs";

/**
 * A rule's `when` read out in plain English for the Rules tabs (the item sheet's and the actor sheet's):
 * "in combat, if you haven't taken your Standard action yet, while you have a Ground Movement".
 *
 * Every tag family the predicate knows (rules/predicate.mjs) has its own reading here; a plug-in tag brings its own
 * (registerTag's `meta.phrase`). Anything else is humanized - camelCase split, colons turned to words - so a new tag
 * never shows raw. Short functional phrases only, never book text.
 *
 * Plain Node safe: Foundry's game / CONFIG / fromUuidSync are only read when they're there.
 */

/* -------------------------------------------- */
/*  Words                                        */
/* -------------------------------------------- */

const SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with']);

const loc = key => {
  const text = globalThis.game?.i18n?.localize?.(key);
  return text && text != key ? text : null;
};

/** Game-line prefixes on internal keys: zord1Form, pr1DinoGem, tf2Beam, o3AgainStep, s2Survey, mlpShape. */
const KEY_PREFIX = /^(?:zord|pr|tf|gij|gi|mlp|wtnv|cc|o|s|dsoe|ttsg)\d*(?=[A-Z])/;

/**
 * An internal key or path as words: "selfImprovementStrength" -> "Self Improvement Strength",
 * "zord1NinjaElementOn" -> "Ninja Element On", "machine empire" stays. Interpolated picks read as the pick.
 * @param {String} text
 * @returns {String}
 */
export function humanize(text) {
  const value = String(text ?? '').trim();
  if (!value) {
    return '';
  }

  // A lone pick: "the chosen element".
  if (/^\{[^}\s]+\}$/.test(value)) {
    return humanize(fillPicks(value)).toLowerCase().replace(/^(chosen|stored|recorded) /, 'the $1 ');
  }

  // Free text (an ask: prompt) keeps its words; only its {picks} are read out.
  if (/\s/.test(value)) {
    return value.replace(/\{[^}]+\}/g, ref => humanize(ref).toLowerCase());
  }

  const parts = fillPicks(value).split(/[.:_|&]+/).filter(Boolean);
  return parts
    .filter(part => parts.length < 2 || !['system', 'flags', 'essence20', 'value', 'total'].includes(part))
    .map(part => part.replace(KEY_PREFIX, ''))
    .join(' ')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index, words) => ACRONYMS[word.toLowerCase()] ?? (index && index < words.length - 1 && SMALL.has(word.toLowerCase()) ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ');
}

const ACRONYMS = { emp: 'EMP', bff: 'BFF', bffs: 'BFFs', hud: 'HUD', npc: 'NPC', npcs: 'NPCs', dif: 'DIF', gm: 'GM', id: 'ID', uuid: 'ID' };

/** Interpolated picks as words-to-be: {choice.element} -> chosenElement, {item.choice} -> chosenOption. */
const fillPicks = text => String(text ?? '')
  .replace(/\{choice\.([\w-]+)\}/g, (match, key) => `chosen${capital(key)}`)
  .replace(/\{item\.choice\}/g, 'chosenOption')
  .replace(/\{sourced\.[\w.]+\}/g, 'recordedChoice')
  .replace(/\{var\.([\w-]+)\}/g, (match, key) => `stored${capital(key)}`);

const lowerWords = text => humanize(text).toLowerCase();
const article = text => (/^[aeiou]/i.test(String(text)) ? `an ${text}` : `a ${text}`);
const capital = text => String(text ?? '').charAt(0).toUpperCase() + String(text ?? '').slice(1);

export function skillName(key) {
  const config = globalThis.CONFIG?.E20?.skills?.[key];
  return loc(config ?? `E20.Skill${capital(key)}`) ?? humanize(key);
}

const essenceName = key => loc(globalThis.CONFIG?.E20?.essences?.[key] ?? `E20.Essence${capital(key)}`) ?? humanize(key);
const defenseName = key => loc(`E20.Defense${capital(key)}`) ?? humanize(key);

/** Who a tag is about, with the verbs that go with it. */
const YOU = {
  who: 'you', is: 'are', isnt: "aren't", has: 'have', hasnt: "don't have", does: 'do', doesnt: "don't", poss: 'your', its: 'your',
  havent: "haven't", hasDone: "you've", s: '', es: '', ies: 'y', was: 'were', wasnt: "weren't", self: 'yourself',
};
const third = (who, poss = `${who}'s`) => ({
  who, is: 'is', isnt: "isn't", has: 'has', hasnt: "doesn't have", does: 'does', doesnt: "doesn't", poss, its: 'its',
  havent: "hasn't", hasDone: `${who} has`, s: 's', es: 'es', ies: 'ies', was: 'was', wasnt: "wasn't", self: 'itself',
});

export const SUBJECTS = {
  self: YOU,
  target: third('the target'),
  holder: third('its owner', "its owner's"),
  vehicle: third('the vehicle you crew', "your vehicle's"),
  enemy: third('an enemy in the fight'),
  ally: third('an ally in the fight'),
  someone: third('someone else in the scene'),
  anyTarget: third('one of your targets'),
  item: third('the item', "the item's"),
  weapon: third('the weapon'),
  host: third('the item it is attached to', "the host item's"),
  rule: third('this item'),
  it: third('it', 'its'),
  attack: third('that attack'),
};

/** Fill a phrase template: {who}, {is}, {has}, {poss} ... from the subject; {arg} (as words), {raw}, {name}, {ft}. */
function fill(template, arg, who) {
  return String(template).replace(/\{(\w+)\}/g, (match, key) => {
    switch (key) {
    case 'arg': return humanize(arg);
    case 'raw': return String(arg ?? '');
    case 'name': return itemName(arg);
    case 'ft': return `${Number.parseFloat(arg) || 0} ft`;
    case 'Who': return capital(who.who);
    }

    return who[key] ?? match;
  });
}

/* -------------------------------------------- */
/*  Names, paths, comparisons                    */
/* -------------------------------------------- */

let nameLookup = null;
/** Hands in an id / uuid -> name lookup for when there's no game (tests, scripts). */
export function setNameLookup(fn) {
  nameLookup = fn;
  nameCache.clear();
}

const nameCache = new Map();

/** A compendium item's name from its uuid or 16-character id; "a particular item" when it can't be found. */
export function itemName(ref) {
  const key = String(ref ?? '');
  if (/^name~/.test(key)) {
    return `an item named like "${key.slice(5)}"`;
  }

  if (nameCache.has(key)) {
    return nameCache.get(key);
  }

  let name = null;
  try {
    name = nameLookup?.(key) ?? null;
    if (!name && key.includes('.')) {
      name = globalThis.fromUuidSync?.(key, { strict: false })?.name ?? null;
    }

    if (!name && globalThis.game?.packs) {
      const id = key.split('.').pop();
      for (const pack of globalThis.game.packs) {
        const entry = pack.documentName == 'Item' ? pack.index?.get?.(id) : null;
        if (entry?.name) {
          name = entry.name;
          break;
        }
      }
    }
  } catch {
    name = null;
  }

  const text = name ?? (/[{]/.test(key) ? humanize(key) : 'a particular item');
  nameCache.set(key, text);
  return text;
}

const MOVEMENT = /^system\.movement\.(\w+)\.(total|base|value|altMode)$/;

/** Stored paths by what they mean: "system.movement.ground.total" -> "Ground Movement". */
export function pathName(path) {
  const text = fillPicks(path).replace(/^_source\./, '');
  const movement = MOVEMENT.exec(text);
  if (movement) {
    return `${movement[2] == 'altMode' ? 'Alt Mode ' : ''}${humanize(movement[1])} Movement`;
  }

  const rules = [
    [/^system\.health\.(value|total)$/, () => 'Health'],
    [/^system\.health\.max$/, () => 'maximum Health'],
    [/^system\.essences\.(\w+)(?:\.value)?$/, m => essenceName(m[1])],
    [/^system\.essences\.(\w+)\.max$/, m => `maximum ${essenceName(m[1])}`],
    [/^system\.defenses\.(\w+)(?:\.(?:total|value))?$/, m => `${defenseName(m[1])} Defense`],
    [/^system\.defenses\.(\w+)\.(\w+)$/, m => `${humanize(m[2])} ${defenseName(m[1])} Defense`],
    [/^statuses\.size$/, () => 'number of Conditions'],
    [/^system\.resistances\.(\w+)$/, m => `${humanize(m[1])} resistance`],
    [/^system\.immunities\.(\w+)$/, m => `${humanize(m[1])} immunity`],
    [/^(?:uuid|id)$/, () => 'ID'],
    [/^system\.skills\.(\w+)\.shift$/, m => `${skillName(m[1])} rank`],
    [/^system\.skills\.(\w+)\.(\w+)$/, m => `${skillName(m[1])} ${lowerWords(m[2])}`],
    [/^system\.energon\.(\w+)\.(value|max)$/, m => `${m[2] == 'max' ? 'maximum ' : ''}${humanize(m[1])} Energon`],
    [/^system\.powers\.(\w+)\.(value|max)$/, m => `${m[2] == 'max' ? 'maximum ' : ''}${humanize(m[1])} Power`],
    [/^system\.power\.(value|max)$/, m => `${m[1] == 'max' ? 'maximum ' : ''}Power`],
    [/^system\.level$/, () => 'level'],
    [/^system\.threatLevel$/, () => 'Threat Level'],
    [/^system\.advances\.currentValue$/, () => 'Advances'],
    [/^system\.(?:total)?[aA]vailability$/, () => 'Availability'],
    [/^system\.size$/, () => 'size'],
    [/^system\.type$/, () => 'type'],
    [/^type$/, () => 'kind'],
    [/^parent\.type$/, () => "owner's kind"],
    [/^name$/, () => 'name'],
    [/^system\.choice$/, () => 'chosen option'],
    [/^system\.damageType$/, () => 'damage type'],
    [/^system\.classification\.style$/, () => 'style'],
    [/^system\.classification\.skill$/, () => 'Skill'],
    [/^system\.classification\.size$/, () => 'size'],
    [/^system\.numHands$/, () => 'number of hands'],
    [/^system\.altModeId$/, () => 'Alt Mode'],
    [/^flags\.essence20\.rules\.choices\.([\w-]+)(?:\.(.+))?$/, m => `${lowerWords(m[1])} choice${m[2] ? ` ${lowerWords(m[2])}` : ''}`],
    [/^flags\.essence20\.ruleMarks\.([\w-]+)\.(\w+)$/, m => `${humanize(m[1])} mark ${lowerWords(m[2])}`],
  ];
  for (const [pattern, name] of rules) {
    const match = pattern.exec(text);
    if (match) {
      return name(match);
    }
  }

  return humanize(text).replace(/ ID$/, '') || 'value';
}

const OPPOSITE = { '>=': '<', '<=': '>', '>': '<=', '<': '>=', '=': '!=', '!=': '=' };

const DIE = /^(\d*d\d+|autoFail|autoSuccess|fumble|criticalSuccess)$/;

/** A value as words: numbers stay, keys get humanized, `$path` reads as that stored value. */
function valueWords(value, poss = 'its') {
  const text = String(value ?? '');
  if (text.startsWith('$')) {
    return `${poss} ${pathName(text.slice(1))}`;
  }

  if (text === '' || Number.isFinite(Number(text)) || DIE.test(text)) {
    return text === '' ? 'empty' : text;
  }

  if (text == 'true' || text == 'false') {
    return text == 'true' ? 'on' : 'off';
  }

  if (/^Compendium\.|^[A-Za-z0-9]{16}$/.test(text) && /\d/.test(text)) {
    return itemName(text);
  }

  return humanize(text);
}

/** "at least 5", "below 0", "Huge", "not Fire". */
export function comparison(op, value, poss) {
  const words = valueWords(value, poss);
  const zero = String(value) == '0';
  switch (op) {
  case '>=': return `at least ${words}`;
  case '<=': return `at most ${words}`;
  case '>': return zero ? 'above 0' : `more than ${words}`;
  case '<': return zero ? 'below 0' : `less than ${words}`;
  case '!=': return `not ${words}`;
  case '~': return `like "${value}"`;
  }

  return words;
}

/* -------------------------------------------- */
/*  Facts: {lead, pos, neg}                      */
/* -------------------------------------------- */

/** A condition: the lead word ("if", "while", "on"...), its positive clause and, when it reads better, its negative. */
const fact = (lead, pos, neg = null) => ({ lead, pos, neg });

/** A comparison about a value someone has: "your level is at least 5" / "your level is below 5". */
function compareFact(lead, poss, label, op, value) {
  const opposite = OPPOSITE[op];
  return fact(lead, `${poss} ${label} is ${comparison(op, value, poss)}`,
    opposite ? `${poss} ${label} is ${comparison(opposite, value, poss)}` : null);
}

/** data:<path>[op value] on someone or something. */
function dataFact(rest, who, lead = 'while') {
  const match = /^data:([\w.$-]+?)(?:(>=|<=|!=|>|<|=)(.*))?$/.exec(rest);
  if (!match) {
    return null;
  }

  const [, path, op, value] = match;
  const label = pathName(path);
  const last = path.split('.').pop();
  const chooser = who === SUBJECTS.rule || who === SUBJECTS.self;
  const special = storedFact(path, op, value, who, lead);
  if (special) {
    return special;
  }

  if (!op) {
    const flag = /^(is|has|can)([A-Z].*)$/.exec(last);
    if (flag) {
      const words = humanize(flag[2]);
      return flag[1] == 'is' ? fact(lead, `${who.who} ${who.is} ${words}`, `${who.who} ${who.isnt} ${words}`)
        : flag[1] == 'has' ? fact(lead, `${who.who} ${who.has} ${words}`, `${who.who} ${who.hasnt} ${words}`)
          : fact(lead, `${who.who} can ${words}`, `${who.who} can't ${words}`);
    }

    return /Active$/.test(last) ? fact(lead, `${who.poss} ${humanize(last.replace(/Active$/, ''))} is active`, `${who.poss} ${humanize(last.replace(/Active$/, ''))} isn't active`)
      : fact(lead, `${who.poss} ${label} is set`, `${who.poss} ${label} isn't set`);
  }

  if (MOVEMENT.test(path) && op == '>' && value == '0') {
    return fact(lead, `${who.who} ${who.has} ${article(label)}`, `${who.who} ${who.has} no ${label}`);
  }

  if (chooser && /^flags\.essence20\.rules\.choices\.[\w-]+$/.test(path) && (op == '=' || op == '!=')) {
    const choice = `${valueWords(value)} for ${lowerWords(path.split('.').pop())}`;
    return op == '=' ? fact('if', `you chose ${choice}`, `you didn't choose ${choice}`) : fact('if', `you didn't choose ${choice}`, `you chose ${choice}`);
  }

  if (chooser && path == 'system.choice' && (op == '=' || op == '!=')) {
    const choice = valueWords(value);
    return op == '=' ? fact('if', `you chose ${choice}`, `you didn't choose ${choice}`) : fact('if', `you didn't choose ${choice}`, `you chose ${choice}`);
  }

  return compareFact(lead, who.poss, label, op, value);
}

/** Stored values with a reading of their own (a type, a Specialization, a trait, a mark...). Null for the rest. */
function storedFact(path, op, value, who, lead) {
  const is = (text, l = lead) => fact(l, `${who.who} ${who.is} ${text}`, `${who.who} ${who.isnt} ${text}`);
  const has = (text, l = lead) => fact(l, `${who.who} ${who.has} ${text}`, `${who.who} ${who.hasnt} ${text}`);
  const flip = found => (op == '!=' ? fact(found.lead, found.neg, found.pos) : found);
  if ((path == 'type' || path == 'parent.type') && (op == '=' || op == '!=') && value) {
    const kind = ACTOR_TYPES[value] ?? ITEM_TYPES[value] ?? article(lowerWords(value));
    return path == 'type' ? flip(is(kind, 'if')) : flip(fact('if', `${who.poss} owner is ${kind}`, `${who.poss} owner isn't ${kind}`));
  }

  if (op) {
    return null;
  }

  const lastTwo = /^(.+)\.([\w-]+)$/.exec(path);
  const rules = [
    [/^(?:uuid|id)$/, () => fact('if', `${who.who} exists`, `${who.who} doesn't exist`)],
    [/^system\.skills\.(\w+)\.isSpecialized$/, m => is(`Specialized in ${skillName(m[1])}`)],
    [/^system\.qualified\.(?:(\w+)\.)?(\w+)$/, m => is(`Qualified with ${humanize(m[2])}${m[1] ? ` ${lowerWords(m[1])}` : ''}`)],
    [/^system\.trained\.(?:(\w+)\.)?(\w+)$/, m => is(`trained in ${humanize(m[2])}${m[1] ? ` ${{ armors: 'armor' }[m[1]] ?? lowerWords(m[1])}` : ''}`)],
    [/^system\.traits\.(\w+)$/, m => has(`the ${humanize(m[1])} trait`)],
    [/^system\.immunities\.(\w+)$/, m => is(`immune to ${humanize(m[1])}`)],
    [/^system\.resistances\.(\w+)$/, m => fact(lead, `${who.who} resist${who.s} ${humanize(m[1])}`, `${who.who} ${who.doesnt} resist ${humanize(m[1])}`)],
    [/^flags\.essence20\.ruleMarks\.([\w-]+)$/, m => has(`the ${humanize(m[1])} mark`)],
    [/^flags\.essence20\.rules\.choices\.([\w-]+)(?:\.length)?$/, m => (who === SUBJECTS.rule ? fact('if', `you chose ${article(lowerWords(m[1]))}`, `you haven't chosen ${article(lowerWords(m[1]))}`) : null)],
    [/^(.+)\.length$/, m => fact(lead, `${who.poss} ${pathName(m[1])} list has entries`, `${who.poss} ${pathName(m[1])} list is empty`)],
  ];
  for (const [pattern, reading] of rules) {
    const match = pattern.exec(path);
    const found = match ? reading(match) : null;
    if (found) {
      return found;
    }
  }

  // flags.essence20.<thing>Active.<option> - "your Wisdom of the Elders (Enhanced Reflexes) is active".
  if (lastTwo && /Active$/.test(lastTwo[1].split('.').pop())) {
    const thing = humanize(lastTwo[1].split('.').pop().replace(/Active$/, ''));
    return fact(lead, `${who.poss} ${thing} (${humanize(lastTwo[2])}) is active`, `${who.poss} ${thing} (${humanize(lastTwo[2])}) isn't active`);
  }

  // A past participle: "this item is granted".
  if (/^[a-z]+ed$/.test(path.split('.').pop()) && !/^(?:system|flags)$/.test(path)) {
    return is(path.split('.').pop());
  }

  return null;
}

/* -------------------------------------------- */
/*  Item facts                                   */
/* -------------------------------------------- */

const ITEM_TYPES = {
  weaponEffect: 'an attack', weapon: 'a weapon', armor: 'armor', gear: 'gear', upgrade: 'an upgrade', perk: 'a Perk', power: 'a Power',
  spell: 'a Spell', hangUp: 'a Hang-Up', altMode: 'an Alt Mode', megaformTrait: 'a Megaform Trait', threatPower: 'a Threat Power',
  magicBauble: 'a Magic Bauble', specialization: 'a Specialization', role: 'a Role', origin: 'an Origin', influence: 'an Influence',
  contact: 'a Contact', alteration: 'an Alteration', shield: 'a shield', trait: 'a Trait', classFeature: 'a Class Feature',
};
const itemType = type => ITEM_TYPES[type] ?? article(lowerWords(type));

/** What an item tag says about the item it asks (`who`): "the weapon has the Ballistic trait". */
function itemFact(rest, who) {
  const [key, ...more] = String(rest ?? '').split(':');
  const arg = more.join(':');
  const plugged = pluginFact(`item:${rest}`, who);
  if (plugged) {
    return plugged;
  }

  const data = dataFact(rest, who, 'if');
  if (data) {
    return data;
  }

  const named = /^name~(.+)$/.exec(rest);
  if (named) {
    return fact('if', `${who.poss} name contains "${named[1]}"`, `${who.poss} name doesn't contain "${named[1]}"`);
  }

  const tier = /^availability(>=|<=|!=|>|<|=)(\w+)$/.exec(rest);
  if (tier) {
    return compareFact('if', who.poss, 'Availability', tier[1], tier[2]);
  }

  const tags = text => text.split('&').filter(Boolean);
  switch (key) {
  case 'word': return fact('if', `${who.poss} name has the word "${arg}"`, `${who.poss} name doesn't have the word "${arg}"`);
  case 'hasAttack': return fact('if', `${who.who} ${who.has} an attack where ${itemClauses(tags(arg), SUBJECTS.attack)}`, `${who.who} ${who.has} no attack where ${itemClauses(tags(arg), SUBJECTS.attack)}`);
  case 'hasUpgrade': return fact('if', `${who.who} ${who.has} ${itemName(arg)} attached`, `${who.who} ${who.hasnt} ${itemName(arg)} attached`);
  case 'granted': return fact('if', `${who.who} was given by this item`, `${who.who} wasn't given by this item`);
  case 'pickedSource': return fact('if', `${who.who} ${who.is} one of the items picked for ${lowerWords(arg)}`, `${who.who} ${who.isnt} one of the items picked for ${lowerWords(arg)}`);
  case 'picked': return fact('if', `${who.who} ${who.is} the item picked for ${lowerWords(arg)}`, `${who.who} ${who.isnt} the item picked for ${lowerWords(arg)}`);
  case 'id':
  case 'source': return fact('if', `${who.who} ${who.is} ${itemName(arg)}`, `${who.who} ${who.isnt} ${itemName(arg)}`);
  case 'isHost': return fact('if', `${who.who} ${who.is} the one this is attached to`, `${who.who} ${who.isnt} the one this is attached to`);
  case 'own': return who === SUBJECTS.item ? { lead: '', pos: 'with this item', neg: 'with anything but this item' } : fact('if', `${who.who} ${who.is} this item`, `${who.who} ${who.isnt} this item`);
  case 'onHost': return fact('if', `${who.who} ${who.is} another attack on the same item`, `${who.who} ${who.isnt} another attack on the same item`);
  case 'type': return fact('if', `${who.who} ${who.is} ${itemType(arg)}`, `${who.who} ${who.isnt} ${itemType(arg)}`);
  case 'trait': return fact('if', `${who.who} ${who.has} the ${humanize(arg)} trait`, `${who.who} ${who.hasnt} the ${humanize(arg)} trait`);
  case 'damageType':
  case 'element': return fact('if', `${who.who} deal${who.s} ${humanize(arg)} damage`, `${who.who} ${who.doesnt} deal ${humanize(arg)} damage`);
  case 'equipped': return fact('while', 'this item is equipped', "this item isn't equipped");
  }

  return fact('if', `${who.who} ${who.is} ${lowerWords(rest)}`, `${who.who} ${who.isnt} ${lowerWords(rest)}`);
}

/** Several item tags about one item, as clauses: "that attack's style is Melee and it has the Ballistic trait". */
export function itemClauses(tags, who = SUBJECTS.it) {
  return (Array.isArray(tags) ? tags : []).map(tag => {
    if (tag && typeof tag == 'object') {
      return Array.isArray(tag.any) ? `either ${tag.any.map(one => itemClauses([one], who)).join(' or ')}` : 'it matches';
    }

    const negated = String(tag).startsWith('not:');
    const text = negated ? String(tag).slice(4) : String(tag);
    const inner = text.replace(/^(item|weapon|host):/, '');
    const found = text.startsWith('attack') || text.startsWith('skill:') || text.startsWith('roll:') ? tagFact(text) : itemFact(inner, who);
    return negated ? found.neg ?? `not ${found.pos}` : found.pos;
  }).join(' and ');
}

/* -------------------------------------------- */
/*  Actor facts (self:, target:, holder:)        */
/* -------------------------------------------- */

const ACTOR_TYPES = {
  playerCharacter: 'a player character', npc: 'an NPC', vehicle: 'a vehicle', zord: 'a Zord', megaformZord: 'a Megaform Zord',
  party: 'a Party', companion: 'a companion', pony: 'a pony',
};
const ACTION_NAMES = { standard: 'Standard action', move: 'Move action', free: 'Free action', full: 'Full action' };

function statusWords(id) {
  const status = (globalThis.CONFIG?.statusEffects ?? []).find(effect => effect.id == id);
  const name = status?.name ? loc(status.name) ?? status.name : null;
  return name ?? humanize(id);
}

const statusList = text => String(text ?? '').split('|').map(statusWords).join(' or ');

/** What an actor tag says about someone (`who`). Null when it isn't one the core knows. */
function actorFact(rest, who, family) {
  const [key, ...more] = rest.split(':');
  const arg = more.join(':');
  const W = who;
  const is = (text, lead = 'while') => fact(lead, `${W.who} ${W.is} ${text}`, `${W.who} ${W.isnt} ${text}`);
  const has = (text, lead = 'while') => fact(lead, `${W.who} ${W.has} ${text}`, `${W.who} ${W.hasnt} ${text}`);

  const named = /^name~(.+)$/.exec(rest);
  if (named) {
    return fact('if', `${W.poss} name contains "${named[1]}"`, `${W.poss} name doesn't contain "${named[1]}"`);
  }

  const level = /^level(>=|<=|>|<|=)(\d+)$/.exec(rest);
  if (level) {
    return compareFact('while', W.poss, 'level', level[1], level[2]);
  }

  const data = dataFact(rest, W);
  if (data) {
    return data;
  }

  const skill = /^skill:([\w-]+)(>=|<=|>|<|=)(\w+)$/.exec(rest);
  if (skill && skill[3] == 'd20' && (skill[2] == '>' || skill[2] == '=')) {
    return skill[2] == '>' ? is(`trained in ${skillName(skill[1])}`) : is(`untrained in ${skillName(skill[1])}`);
  }

  if (skill) {
    return compareFact('while', W.poss, skillName(skill[1]), skill[2], skill[3]);
  }

  const essence = /^essence:([\w-]+)(>=|<=|>|<|=)(\d+)$/.exec(rest);
  if (essence) {
    return compareFact('while', W.poss, essenceName(essence[1]), essence[2], essence[3]);
  }

  const size = /^size(>=|<=|>|<|=)(\w+)$/.exec(rest);
  if (size) {
    return compareFact('while', W.poss, 'size', size[1], size[2]);
  }

  const versus = /^(levelDiff|sizeDiff)(>=|<=|>|<|=)(-?\d+)$/.exec(rest);
  if (versus) {
    const what = versus[1] == 'levelDiff' ? 'level' : 'size';
    const other = family == 'target' ? 'yours' : family == 'holder' ? "the target's" : "the target's";
    const n = Number(versus[3]);
    const ahead = { '>=': n <= 0 ? `at least ${-n} below` : `at least ${n} above`, '<=': n >= 0 ? `at most ${n} above` : `at least ${-n} below`, '>': `more than ${n} above`, '<': `less than ${n} above`, '=': n ? `${Math.abs(n)} ${n > 0 ? 'above' : 'below'}` : 'the same as' }[versus[2]];
    const neat = n == 0 ? { '>=': 'at least', '<=': 'at most', '>': 'above', '<': 'below', '=': 'the same as' }[versus[2]] : ahead;
    return fact('if', `${W.poss} ${what} is ${neat} ${other}`, `${W.poss} ${what} isn't ${neat} ${other}`);
  }

  const hasType = /^hasType:([\w-]+):(.+)$/.exec(rest);
  if (hasType) {
    return has(`the ${humanize(hasType[1])} ${hasType[2]}`);
  }

  if (key == 'has') {
    return has(arg);
  }

  const count = /^count:([\w-]+)(>=|<=|>|<|=)(\d+)$/.exec(rest) ?? /^itemCount:(\w+)(?::equipped)?(>=|<=|>|<|=)(\d+)$/.exec(rest);
  if (count) {
    const equipped = rest.includes(':equipped') ? ' equipped' : '';
    const noun = ['armor', 'gear'].includes(count[1]) ? count[1] : `${lowerWords(count[1])}s`;
    const none = (count[2] == '<' && count[3] == '1') || (count[2] == '=' && count[3] == '0') || (count[2] == '<=' && count[3] == '0');
    const some = (count[2] == '>=' && count[3] == '1') || (count[2] == '>' && count[3] == '0');
    if (none || some) {
      return none ? fact('while', `${W.who} ${W.has} no${equipped} ${noun}`, `${W.who} ${W.has}${equipped} ${noun}`) : fact('while', `${W.who} ${W.has}${equipped} ${noun}`, `${W.who} ${W.has} no${equipped} ${noun}`);
    }

    const amount = { '>=': `at least ${count[3]}`, '<=': `at most ${count[3]}`, '>': `more than ${count[3]}`, '<': `fewer than ${count[3]}`, '=': `exactly ${count[3]}` }[count[2]];
    return fact('while', `${W.who} ${W.has} ${amount}${equipped} ${noun}`, `${W.who} ${W.hasnt} ${amount}${equipped} ${noun}`);
  }

  const wearing = /^wearing(:|>=|<=)(\w+)$/.exec(rest);
  if (wearing) {
    const armor = wearing[2] == 'non' && wearing[1] == '>=' ? 'any armor' : `${humanize(wearing[2])} armor${wearing[1] == '>=' ? ' or heavier' : wearing[1] == '<=' ? ' or lighter' : ''}`;
    return fact('while', `${W.who} ${W.is} wearing ${armor}`, `${W.who} ${W.isnt} wearing ${armor}`);
  }

  const trained = /^trained:([\w-]+)\.([\w.-]+)$/.exec(rest);
  if (trained) {
    return is(`trained in ${humanize(trained[2])} ${humanize(trained[1]).replace(/s$/, '')}`);
  }

  switch (key) {
  case 'combatant': return is('in the combat');
  case 'onCanvas': return fact('while', `${W.who} ${W.has} a token in the scene`, `${W.who} ${W.has} no token in the scene`);
  case 'actionUsed': {
    const action = ACTION_NAMES[arg] ?? `${humanize(arg)} action`;
    return fact('if', `${W.hasDone} taken ${W.its} ${action}`, `${W.who} ${W.havent} taken ${W.its} ${action} yet`);
  }

  case 'wearingItem': return fact('while', `${W.who} ${W.is} wearing gear where ${itemClauses(arg.split('&'))}`, `${W.who} ${W.isnt} wearing gear where ${itemClauses(arg.split('&'))}`);
  case 'morphed': return is('Morphed');
  case 'transformed': return is('in Alt Mode');
  case 'canTransform': return fact('while', `${W.who} can change to Alt Mode`, `${W.who} can't change to Alt Mode`);
  case 'status': return /^any(:|$)/.test(arg) ? is(arg.length > 4 ? statusList(arg.slice(4)) : 'under any Condition') : is(arg.endsWith(':timed') ? `${statusWords(arg.slice(0, -6))} for a set time` : statusList(arg));
  case 'type': return is(ACTOR_TYPES[arg] ?? article(lowerWords(arg)), 'if');
  case 'hasItem': return has(itemName(arg));
  case 'specializedIn': return has(`a ${skillName(arg)} Specialization`);
  case 'tag': return fact('if', `${W.who} count${W.s} as ${humanize(arg)}`, `${W.who} ${W.doesnt} count as ${humanize(arg)}`);
  case 'hp<half': return is('below half Health');
  case 'toggle': return arg == 'on' ? fact('while', 'it is switched on', 'it is switched off') : fact('while', `${humanize(arg)} is switched on`, `${humanize(arg)} is switched off`);
  case 'marked': return has(`the ${humanize(arg)} mark`);
  case 'recklessAbandon': return is('acting with Reckless Abandon');
  case 'picked': return is(`the one picked for ${lowerWords(arg)}`, 'if');
  case 'wielding': return arg ? fact('while', `${W.who} ${W.is} wielding a weapon where ${itemClauses(arg.split('&'))}`, `${W.who} ${W.isnt} wielding a weapon where ${itemClauses(arg.split('&'))}`) : is('wielding a weapon');
  case 'check': return checkFact(arg, W);
  case 'notActed': return fact('if', `${W.who} ${W.havent} acted yet this round`, `${W.hasDone} already acted this round`);
  case 'within': return is(`within ${Number(arg) || 0} ft`, 'if');
  case 'self': return fact('if', `${W.who} ${W.is} you`, `${W.who} ${W.isnt} you`);
  case 'ally': return is('an ally', 'if');
  case 'enemy': return is('an enemy', 'if');
  case 'protects': return fact('if', 'you are its Protected Target', "you aren't its Protected Target");
  }

  if (rest == 'wielding') {
    return is('wielding a weapon');
  }

  return null;
}

/* -------------------------------------------- */
/*  Checks                                       */
/* -------------------------------------------- */

/** check:<name> - a state the system's own code answers, as a clause about `who`. */
const CHECK_PHRASES = {
  environmentalExpertise: ['{who} {is} in an environment of expertise', "{who} {isnt} in an environment of expertise"],
  outsideEnvironmentOfExpertise: ['{who} {is} outside {its} environment of expertise', "{who} {isnt} outside {its} environment of expertise"],
  cannoneerDugIn: ['{who} {is} dug in', "{who} {isnt} dug in"],
  bulwark: ['Bulwark is active', "Bulwark isn't active"],
  rushTheLine: ['Rush the Line is active', "Rush the Line isn't active"],
  sprinterBoost: ["Sprinter's boost is active", "Sprinter's boost isn't active"],
  skiing: ['{who} {is} skiing', "{who} {isnt} skiing"],
  nearbyDefeatedAlly: ['a Defeated ally is nearby', 'no Defeated ally is nearby'],
  defeatedAllyInReach: ['a Defeated ally is within reach', 'no Defeated ally is within reach'],
  frictionlessMovement: ['Frictionless Movement is active', "Frictionless Movement isn't active"],
  gravityOptional: ['Gravity Optional is active', "Gravity Optional isn't active"],
  wisdomOfTheElders: ['Wisdom of the Elders is active', "Wisdom of the Elders isn't active"],
  monsterForm: ['{who} {is} in Monster Form', "{who} {isnt} in Monster Form"],
  warriorMode: ['{who} {is} in Warrior Mode', "{who} {isnt} in Warrior Mode"],
  powerAdaptation: ['Power Adaptation is active', "Power Adaptation isn't active"],
  highGear: ['High Gear is active', "High Gear isn't active"],
  theToughGetGoing: ['The Tough Get Going is active', "The Tough Get Going isn't active"],
  energyAffinityAttack: ['the attack uses {its} Energy Affinity element', "the attack doesn't use {its} Energy Affinity element"],
  equippedFireWeapon: ['{who} {is} wielding a Fire weapon', "{who} {isnt} wielding a Fire weapon"],
  decepticonNemesis: ['the target is {poss} Decepticon Nemesis', "the target isn't {poss} Decepticon Nemesis"],
  nemesisInScene: ['{poss} Nemesis is in the scene', "{poss} Nemesis isn't in the scene"],
  multipleTargetsWeapon: ['the weapon can hit several targets', "the weapon can't hit several targets"],
  favoriteWeaponEquipped: ['{poss} Favorite Weapon is equipped', "{poss} Favorite Weapon isn't equipped"],
  favoriteWeaponRolled: ['rolling with {poss} Favorite Weapon', 'not rolling with {poss} Favorite Weapon'],
  zordHasDriver: ['{who} {has} a driver', '{who} {has} no driver'],
  personalShield: ['{poss} personal shield is up', "{poss} personal shield isn't up"],
  computerizedGear: ['{who} {has} computerized parts or gear', '{who} {has} no computerized parts or gear'],
  nonMystical: ["{who} {isnt} magical", '{who} {is} magical'],
  medicineKit: ['{who} carr{ies} a Medicine kit', "{who} {doesnt} carry a Medicine kit"],
  shapeShifted: ['{who} {has} changed shape', "{who} {havent} changed shape"],
  disguised: ['{who} {is} disguised', "{who} {isnt} disguised"],
  grappleEscape: ['the Skill is one {who} use{s} to escape a grapple', "the Skill isn't one {who} use{s} to escape a grapple"],
  infiltrating: ['{who} {is} infiltrating', "{who} {isnt} infiltrating"],
  inWater: ['{who} {is} in the water', "{who} {isnt} in the water"],
  onLand: ['{who} {is} on land', "{who} {isnt} on land"],
  seaOrWetlands: ['{who} {is} at sea or in wetlands', "{who} {isnt} at sea or in wetlands"],
  aboardAquaticVessel: ['{who} {is} aboard a boat or ship', "{who} {isnt} aboard a boat or ship"],
  completeDarkness: ['{who} {is} in complete darkness', "{who} {isnt} in complete darkness"],
  contingencyLikely: ['{who} {has} a Contingency ready off {its} turn', '{who} {has} no Contingency ready'],
  survivalSpecialization: ['a Survival Specialization fits the terrain', 'no Survival Specialization fits the terrain'],
  inAppraisedArea: ['{who} {is} in the appraised area', "{who} {isnt} in the appraised area"],
  attackedByAlly: ['an ally already attacked the target this round', 'no ally has attacked the target this round'],
  markTarget: ['the target carries {poss} mark', "the target doesn't carry {poss} mark"],
  vehicleInRoughTerrain: ['the vehicle is in rough terrain', "the vehicle isn't in rough terrain"],
};

function checkFact(rest, who) {
  const [name, ...option] = String(rest ?? '').split(':');
  const words = who;
  const known = CHECK_PHRASES[name];
  const extra = option.length ? ` (${humanize(option.join(':'))})` : '';
  if (known) {
    return fact('if', `${fill(known[0], '', words)}${extra}`, `${fill(known[1], '', words)}${extra}`);
  }

  return fact('if', `${humanize(name)} holds${extra}`, `${humanize(name)} doesn't hold${extra}`);
}

/** Every check name with its own reading (the describe-when test makes sure CHECK_NAMES has no gaps). */
export const CHECK_PHRASE_NAMES = Object.keys(CHECK_PHRASES);

/* -------------------------------------------- */
/*  Formulas (calc:) and shared plug-in phrases  */
/* -------------------------------------------- */

/** A formula reference as words: @level -> "your level", @skill.might.rank -> "your Might ranks". Null when unknown. */
function refWords(text) {
  const ref = String(text ?? '').trim();
  const rules = [
    [/^@level$/, () => 'your level'],
    [/^max\(@level, @actor\.system\.threatLevel\)$/, () => 'your level (or Threat Level)'],
    [/^@actor\.system\.skills\.(\w+)\.isSpecialized$/, m => `1 if you are Specialized in ${skillName(m[1])}`],
    [/^@actor\.system\.isMorphed$/, () => '1 while you are Morphed'],
    [/^@(size|target\.size|vehicle\.size)$/, m => `${{ size: 'your', 'target.size': "the target's", 'vehicle.size': "your vehicle's" }[m[1]]} size step`],
    [/^@essence\.(\w+)$/, m => `your ${essenceName(m[1])}`],
    [/^@actor\.(?:_source\.)?([\w.]+)$/, m => `your ${pathName(m[1])}`],
    [/^@target\.(?:my)?[mM]ark\.([\w-]+)$/, m => `the target's ${humanize(m[1])} mark`],
    [/^@target\.(?:_source\.)?([\w.]+)$/, m => `the target's ${pathName(m[1])}`],
    [/^@targetKeyed\.([\w.]+)$/, m => `the target's ${pathName(m[1])} about you`],
    [/^@item\.(?:_source\.)?([\w.]+)$/, m => `this item's ${pathName(m[1])}`],
    [/^@other\.([\w.]+)$/, m => `the item's ${pathName(m[1])}`],
    [/^@rolled\.([\w.]+)$/, m => `the rolled item's ${pathName(m[1])}`],
    [/^@host\.([\w.]+)$/, m => `the host item's ${pathName(m[1])}`],
    [/^@sourced\.(\w{16})\.([\w.]+)$/, m => `your ${itemName(m[1])}'s ${pathName(m[2])}`],
    [/^@spent$/, () => 'the amount spent'],
    [/^@count\.items\.(\w+)$/, m => `the number of your ${lowerWords(m[1])} items`],
    [/^@count\.named\.([\w-]+)$/, m => `the number of your ${lowerWords(m[1])} items`],
    [/^@copiesWith\.([\w.]+)$/, m => `your copies with ${lowerWords(m[1])}`],
    [/^@sum\.equipped\.(\w+)\.([\w.]+)$/, m => `your equipped ${lowerWords(m[1])}'s ${pathName(m[2])}`],
    [/^@sum\.equippedTrait\.(\w+)\.(\w+)\.system\.equipped$/, m => `your equipped ${humanize(m[1])} ${lowerWords(m[2])} count`],
    [/^@sum\.equippedTrait\.(\w+)\.(\w+)\.([\w.]+)$/, m => `your equipped ${humanize(m[1])} ${lowerWords(m[2])}'s ${pathName(m[3])}`],
    [/^@reach\.size$/, () => 'the Reach for your size'],
    [/^@reach\.(\w+)$/, m => `${humanize(m[1])} Reach`],
    [/^@most\.items\.(\w+)\.([\w.]+)$/, m => `the best ${pathName(m[2])} of your ${lowerWords(m[1])} items`],
    [/^@ledger\.perkUses\.([\w-]+)$/, m => `your ${humanize(m[1])} uses this turn`],
    [/^@tokensHolding\.(\w{16})\.(\d+)$/, m => `the creatures within ${m[2]} ft holding ${itemName(m[1])}`],
    [/^@alliesWearing\.(\w{16})\.(\d+)$/, m => `the allies wearing ${itemName(m[1])}`],
    [/^@(?:recipient|actor)\.flags\.essence20\.ruleMarks\.([\w-]+)\.count$/, m => `the ${humanize(m[1])} mark count`],
    [/^@choice\.([\w-]+)$/, m => `the chosen ${lowerWords(m[1])}`],
    [/^@(?:pool|pools)\.([\w-]+)$/, m => `the ${humanize(m[1])} pool`],
    [/^@owned\.(\w{16})$/, m => `your copies of ${itemName(m[1])}`],
    [/^@skill\.(\w+)\.rank$/, m => `your ${skillName(m[1])} ranks`],
    [/^@var\.([\w-]+)$/, m => `the stored ${lowerWords(m[1])}`],
    [/^@mark\.([\w-]+)$/, m => `the ${humanize(m[1])} mark`],
    [/^@rolePoints(?:\.([\w-]+))?$/, m => (m[1] ? `your ${humanize(m[1]).replace(/ Points$/, '')} points` : 'your Role Points')],
    [/^@combat\.round$/, () => 'the round'],
    [/^@clock\.session$/, () => 'the session count'],
    [/^@count\.(enemies|allies)\.(\d+)$/, m => (Number(m[2]) >= 1000 ? `the number of ${m[1]}` : `the number of ${m[1]} within ${m[2]} ft`)],
    [/^@initiative\.target$/, () => "the target's Initiative"],
    [/^@([\w.]+)$/, m => `the ${lowerWords(m[1])}`],
    [/^-?\d+(?:\.\d+)?$/, m => m[0]],
  ];
  for (const [pattern, words] of rules) {
    const match = pattern.exec(ref);
    if (match) {
      return words(match);
    }
  }

  return null;
}

/* -------------------------------------------- */
/*  Formula amounts                              */
/* -------------------------------------------- */

/** Formula text -> a tree of {num} / {ref} / {op, a, b} / {neg} / {fn, args}. Null when it doesn't parse. */
function parseFormula(text) {
  const tokens = String(text ?? '').match(/@[\w.-]+|\d+(?:\.\d+)?|[A-Za-z_]\w*|[-+*/(),]|\S/g) ?? [];
  let at = 0;
  const peek = () => tokens[at];
  const next = () => tokens[at++];
  const primary = () => {
    const token = next();
    if (token === undefined) {
      throw new Error('end');
    }

    if (token == '-') {
      return { neg: primary() };
    }

    if (token == '(') {
      const inner = sum();
      if (next() != ')') {
        throw new Error(')');
      }

      return inner;
    }

    if (/^\d/.test(token)) {
      return { num: Number(token) };
    }

    if (token.startsWith('@')) {
      return { ref: token };
    }

    if (/^[A-Za-z_]/.test(token) && peek() == '(') {
      next();
      const args = [sum()];
      while (peek() == ',') {
        next();
        args.push(sum());
      }

      if (next() != ')') {
        throw new Error(')');
      }

      return { fn: token, args };
    }

    throw new Error(token);
  };

  const product = () => {
    let node = primary();
    while (peek() == '*' || peek() == '/') {
      node = { op: next(), a: node, b: primary() };
    }

    return node;
  };

  function sum() {
    let node = product();
    while (peek() == '+' || peek() == '-') {
      node = { op: next(), a: node, b: product() };
    }

    return node;
  }

  try {
    const tree = sum();
    return at == tokens.length ? tree : null;
  } catch {
    return null;
  }
}

const isNum = node => node && node.num !== undefined;
const listWords = list => (list.length < 2 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`);

/** One node as words. */
function nodeWords(node) {
  if (isNum(node)) {
    return String(node.num);
  }

  if (node.ref) {
    return refWords(node.ref) ?? `the ${lowerWords(node.ref.slice(1))}`;
  }

  if (node.neg) {
    return `minus ${nodeWords(node.neg)}`;
  }

  if (node.op) {
    const { op, a, b } = node;
    // A sum inside a product, or a rounded / bounded value inside any sum, keeps its grouping.
    const grouped = child => {
      const loose = child.op && (child.op == '+' || child.op == '-') && (op == '*' || op == '/');
      const closed = child.fn || (child.op && op != child.op && (op == '*' || op == '/'));
      return loose || closed ? `(${nodeWords(child)})` : nodeWords(child);
    };

    if (op == '-' && isNum(a) && a.num == 0) {
      return `minus ${grouped(b)}`;
    }

    if (op == '/' && isNum(b)) {
      return b.num == 2 ? `half ${grouped(a)}` : `${grouped(a)} divided by ${b.num}`;
    }

    if (op == '*' && (isNum(a) || isNum(b))) {
      const [n, other] = isNum(a) ? [a.num, b] : [b.num, a];
      return n == 2 ? `twice ${grouped(other)}` : n == 0.5 ? `half ${grouped(other)}` : `${n} times ${grouped(other)}`;
    }

    return `${grouped(a)} ${{ '+': 'plus', '-': 'minus', '*': 'times', '/': 'divided by' }[op]} ${grouped(b)}`;
  }

  const args = node.args;
  switch (node.fn) {
  case 'max':
  case 'min': {
    const numbers = args.filter(isNum);
    const others = args.filter(arg => !isNum(arg));
    if (others.length == 1 && numbers.length) {
      // min(1, @owned.x) - "1 if you have X".
      const owned = /^@owned\.(\w{16})$/.exec(others[0].ref ?? '');
      if (node.fn == 'min' && owned && numbers[0].num == 1) {
        return `1 if you have ${itemName(owned[1])}`;
      }

      const bound = node.fn == 'max' ? Math.max(...numbers.map(n => n.num)) : Math.min(...numbers.map(n => n.num));
      return `${nodeWords(others[0])} (at ${node.fn == 'max' ? 'least' : 'most'} ${bound})`;
    }

    const words = args.map(nodeWords);
    const which = node.fn == 'max' ? (args.length > 2 ? 'highest' : 'higher') : args.length > 2 ? 'lowest' : 'lower';
    return `the ${which} of ${listWords(words)}`;
  }

  case 'floor':
  case 'ceil':
  case 'round': return `${nodeWords(args[0])}, rounded ${node.fn == 'floor' ? 'down' : node.fn == 'ceil' ? 'up' : 'off'}`;
  case 'abs': return args[0]?.op == '-' ? `the difference between ${nodeWords(args[0].a)} and ${nodeWords(args[0].b)}` : `${nodeWords(args[0])} (ignoring sign)`;
  }

  return `the ${lowerWords(node.fn)} of ${listWords(args.map(nodeWords))}`;
}

/** Every reference a tree reads, as words, once each. */
function refsOf(node, found = []) {
  if (node?.ref) {
    const words = refWords(node.ref) ?? `the ${lowerWords(node.ref.slice(1))}`;
    if (!found.includes(words) && !/^\d/.test(words)) {
      found.push(words);
    }
  }

  for (const child of [node?.a, node?.b, node?.neg, ...(node?.args ?? [])]) {
    if (child) {
      refsOf(child, found);
    }
  }

  return found;
}

/**
 * A formula amount in plain English: "@level" -> "your level", "max(1, @item.system.advances.currentValue)" ->
 * "this item's Advances (at least 1)". A long step formula reads as what it is based on. Never shows "@" or "max(".
 * @param {String|Number} formula
 * @returns {{text: String, negative: Boolean}}
 */
export function formulaWords(formula) {
  if (typeof formula == 'number') {
    return { text: String(Math.abs(formula)), negative: formula < 0 };
  }

  const tree = parseFormula(formula);
  if (!tree) {
    return { text: 'a calculated amount', negative: false };
  }

  const negative = !!tree.neg || (tree.op == '-' && isNum(tree.a) && tree.a.num == 0);
  const body = tree.neg ?? (negative ? tree.b : tree);
  const text = nodeWords(body);
  if (text.length <= 80 && !/@/.test(text)) {
    return { text, negative };
  }

  const refs = refsOf(body);
  return { text: refs.length ? `an amount based on ${listWords(refs.slice(0, 3))}` : 'a calculated amount', negative };
}

/** "are" after a plural ("your Might ranks are"), else "is". */
const be = subject => (/(?:ranks|points|Points|shots)$/.test(subject) ? 'are' : 'is');

/** calc:<formula><op><n> - "if your level is at least 10", "if your Acrobatics ranks are more than your Athletics ranks". */
export function formulaFact(text) {
  const source = String(text ?? '').trim();
  const fallback = fact('if', 'its calculated condition holds', "its calculated condition doesn't hold");
  const match = /^(.*?)\s*(>=|<=|!=|>|<|=)\s*(-?\d+(?:\.\d+)?)$/.exec(source);
  if (!match) {
    return fallback;
  }

  const [, left, op, number] = match;
  const owned = /^@owned\.(\w{16})$/.exec(left.trim());
  if (owned) {
    const name = itemName(owned[1]);
    const any = (op == '>' && number == '0') || (op == '>=' && number == '1');
    const none = (op == '<' && number == '1') || (op == '<=' && number == '0') || (op == '=' && number == '0');
    if (any || none) {
      return any ? fact('if', `you have ${name}`, `you don't have ${name}`) : fact('if', `you don't have ${name}`, `you have ${name}`);
    }
  }

  const versus = /^@versus\.(\w+)$/.exec(left.trim());
  if (versus && number == '0') {
    const what = humanize(versus[1]);
    const words = { '>': 'above', '<': 'below', '>=': 'at least', '<=': 'at most', '=': 'the same as' }[op];
    return fact('if', `your ${what} is ${words} the target's`, `your ${what} isn't ${words} the target's`);
  }

  const single = refWords(left);
  if (single) {
    return fact('if', `${single} ${be(single)} ${comparison(op, number)}`, OPPOSITE[op] ? `${single} ${be(single)} ${comparison(OPPOSITE[op], number)}` : null);
  }

  // A - B against 0: "A is more than B".
  const difference = /^(@[\w.]+)\s*-\s*(@[\w.]+)$/.exec(left.trim());
  if (difference && number == '0' && refWords(difference[1]) && refWords(difference[2])) {
    const [a, b] = [refWords(difference[1]), refWords(difference[2])];
    const words = { '>': 'more than', '<': 'less than', '>=': 'at least', '<=': 'at most', '=': 'the same as', '!=': 'not the same as' };
    return fact('if', `${a} ${be(a)} ${words[op]} ${b}`, OPPOSITE[op] ? `${a} ${be(a)} ${words[OPPOSITE[op]]} ${b}` : null);
  }

  // Plain arithmetic over known references reads out; anything with functions or brackets doesn't.
  if (/^[@\w.\s+\-*/]+$/.test(left)) {
    const parts = left.trim().split(/\s*([+\-*/])\s*/);
    const words = parts.map(part => ({ '+': 'plus', '-': 'minus', '*': 'times', '/': 'divided by' }[part] ?? refWords(part)));
    if (words.every(Boolean)) {
      const expression = words.join(' ');
      return fact('if', `${expression} is ${comparison(op, number)}`, OPPOSITE[op] ? `${expression} is ${comparison(OPPOSITE[op], number)}` : null);
    }
  }

  return fallback;
}

/** self: / target:markText:<key>[=|!=<text>] - a mark that keeps a word. */
function markTextPhrase(arg) {
  const match = /^([\w-]+)(?:(!=|=)(.*))?$/.exec(String(arg ?? ''));
  if (!match) {
    return null;
  }

  const text = match[3] == '$skill' ? 'the rolled Skill' : String(match[3] ?? '').startsWith('$item.') ? `the rolled item's ${lowerFirst(pathName(match[3].slice(6)))}` : humanize(match[3]);
  const mark = `the ${humanize(match[1])} mark`;
  if (!match[2]) {
    return [`{who} carr{ies} ${mark}`, `{who} {doesnt} carry ${mark}`];
  }

  const what = match[2] == '=' ? `for ${text}` : `for something other than ${text}`;
  return [`{who} carr{ies} ${mark} ${what}`, `{who} {doesnt} carry ${mark} ${what}`];
}

/** self: / target: / holder:windowUsed:<flag>:<window>[:<n>] - a scene-clock counter. */
function windowUsedPhrase(arg) {
  const [flag, window = 'scene', count] = String(arg ?? '').split(':');
  const name = humanize(flag).replace(/( Used)?( This)? (Encounter|Scene|Mission|Round|Turn|Session)$/, '').replace(/ Used$/, '');
  const times = Number(count) > 1 ? ` ${count} times` : '';
  return [`{who} used ${name}${times} this ${window}`, `{who} {havent} used ${name}${times} this ${window}`];
}

/* -------------------------------------------- */
/*  Plug-in tags                                 */
/* -------------------------------------------- */

/** Helpers a plug-in's phrase function gets beside the subject's words. */
const HELPERS = {
  humanize, itemName, pathName, comparison, skillName,
  describe: (tags, joiner = ' and ') => tags.map(tag => describeTag(tag)).join(joiner),
  formula: text => {
    const found = formulaFact(text);
    return [found.pos, found.neg];
  },
  markText: markTextPhrase,
  windowUsed: windowUsedPhrase,
  /** Item tags as clauses about one item: "it is a weapon and it has the Ballistic trait" (or about `name`). */
  items: (tags, name) => itemClauses(tags, name ? third(name) : SUBJECTS.it),
  /** Actor tags (target: ones, or self: ones with family 'self') as clauses about `name` (default the target). */
  facts: (tags, name, family = 'target') => tags.map(tag => clause(family == 'self' ? String(tag).replace(/^(not:)?self:/, '$1target:') : tag, name ? third(name) : SUBJECTS.target)).join(' and '),
};

/** A plug-in's own reading, as a fact - or null when it gave none. */
function pluginFact(tag, who) {
  const found = tagPhrase(tag);
  if (!found) {
    return null;
  }

  const words = { ...who, ...HELPERS };
  let phrase = found.phrase;
  if (typeof phrase == 'function') {
    try {
      phrase = phrase(found.arg, words);
    } catch {
      phrase = null;
    }
  }

  if (!phrase) {
    return null;
  }

  const [pos, neg] = Array.isArray(phrase) ? phrase : [phrase, null];
  const text = fill(pos, found.arg, who);
  // A phrase may carry its own lead word ("on attacks ...", "in round 2"); a bare clause is led by "if".
  const led = /^(on|in|with|without|while|when|against|during|after|before|outside|if|unless|except|at|for)\b/.exec(text);
  return led ? { lead: '', pos: text, neg: neg ? fill(neg, found.arg, who) : `not ${text}` } : fact('if', text, neg ? fill(neg, found.arg, who) : null);
}

/* -------------------------------------------- */
/*  One tag                                      */
/* -------------------------------------------- */

const ROLL_FLAGS = {
  initiative: ['on Initiative rolls', 'except on Initiative rolls'],
  specialized: ['with a Specialization', 'without a Specialization'],
  shove: ['on a Shove', 'except on a Shove'],
  fumble: ['on a Fumble', 'unless it Fumbles'],
  downshifted: ['if the roll already has a downshift', "if the roll has no downshift yet"],
  edge: ['with an Edge', 'without an Edge'],
  snag: ['with a Snag', 'without a Snag'],
  aimed: ['when Aiming', 'when not Aiming'],
  untrained: ['with an untrained Skill', 'with a trained Skill'],
  outranks: ["if you have more ranks in the Skill than the target", "unless you have more ranks in the Skill than the target"],
};

const DATASET = {
  isInitiative: ['on Initiative rolls', 'except on Initiative rolls'],
  specializationKey: ['with a Specialization', 'without a Specialization'],
  requisitionItemName: ['when requisitioning an item', 'except when requisitioning'],
  isSpecialized: ['with a Specialization', 'without a Specialization'],
};

/** The roll family: roll:<what>. */
function rollFact(rest) {
  const flag = /^dataset:([\w.-]+)(?:=(.+))?$/.exec(rest);
  if (flag) {
    if (!flag[2] && DATASET[flag[1]]) {
      return { lead: '', pos: DATASET[flag[1]][0], neg: DATASET[flag[1]][1] };
    }

    if (flag[1] == 'shift' && flag[2]) {
      return flag[2] == 'd20' ? { lead: '', pos: 'with an untrained Skill', neg: 'with a trained Skill' } : fact('if', `the Skill die is ${flag[2]}`, `the Skill die isn't ${flag[2]}`);
    }

    const label = lowerWords(flag[1]);
    return flag[2] ? fact('if', `the roll's ${label} is ${valueWords(flag[2])}`, `the roll's ${label} isn't ${valueWords(flag[2])}`)
      : fact('if', `the roll is marked ${label}`, `the roll isn't marked ${label}`);
  }

  if (rest.startsWith('switch:')) {
    return fact('if', `you tick ${humanize(rest.slice(7))}`, `you don't tick ${humanize(rest.slice(7))}`);
  }

  const specialized = /^specialization(~|=)(.+)$/.exec(rest);
  if (specialized) {
    return { lead: '', pos: `with the ${specialized[2]} Specialization`, neg: `without the ${specialized[2]} Specialization` };
  }

  const targets = /^targets(>=|<=|>|<|=)(\d+)$/.exec(rest);
  if (targets) {
    const count = (op, n) => (op == '>=' && n == '1') || (op == '>' && n == '0') ? 'a target' : op == '=' ? `exactly ${n} target${n == '1' ? '' : 's'}` : `${comparison(op, n)} targets`;
    return fact('if', `the roll has ${count(targets[1], targets[2])}`, targets[1] == '=' ? `the roll doesn't have ${count('=', targets[2])}` : `the roll has ${count(OPPOSITE[targets[1]], targets[2])}`);
  }

  if (ROLL_FLAGS[rest]) {
    return { lead: '', pos: ROLL_FLAGS[rest][0], neg: ROLL_FLAGS[rest][1] };
  }

  return fact('if', `the roll is ${lowerWords(rest)}`, `the roll isn't ${lowerWords(rest)}`);
}

const ATTACK_KINDS = { melee: 'melee attacks', ranged: 'ranged attacks', area: 'area attacks', unarmed: 'unarmed attacks', ram: 'Ram attacks' };

const ENVIRONMENTS = { lowGravity: 'in low gravity', zeroGravity: 'in zero gravity', vacuum: 'in a vacuum', underwater: 'underwater', normal: 'in a normal environment' };

/** Any tag, as a fact. `who` overrides the target subject (combat:enemy:<target tags>). */
function tagFact(text, other = SUBJECTS.target) {
  const tag = String(text ?? '').trim();
  const compared = /^damage(>=|<=|>|<|=)(\d+)$/.exec(tag);
  const separator = tag.indexOf(':');
  const family = compared ? 'damage' : separator < 0 ? tag : tag.slice(0, separator);
  const rest = compared ? `${compared[1]}${compared[2]}` : separator < 0 ? '' : tag.slice(separator + 1);
  const subjects = { self: SUBJECTS.self, target: other, holder: SUBJECTS.holder, item: SUBJECTS.item, weapon: SUBJECTS.weapon, host: SUBJECTS.host, rule: SUBJECTS.rule, vehicle: SUBJECTS.vehicle };
  const plugged = pluginFact(tag, subjects[family] ?? SUBJECTS.self);
  if (plugged) {
    return plugged;
  }

  const full = (pos, neg) => ({ lead: '', pos, neg });
  switch (family) {
  case 'skill': {
    if (rest.startsWith('choiceOf:')) {
      return full(`on tests with the Skill chosen for ${itemName(rest.slice(9))}`, `except on tests with the Skill chosen for ${itemName(rest.slice(9))}`);
    }

    return rest.includes('{') ? full('on tests of the chosen Skill', 'except on tests of the chosen Skill') : full(`on ${skillName(rest)} tests`, `except on ${skillName(rest)} tests`);
  }

  case 'essence': return rest.includes('{') ? full('on tests of the chosen Essence', 'except on tests of the chosen Essence') : full(`on ${essenceName(rest)} tests`, `except on ${essenceName(rest)} tests`);
  case 'attack': return rest ? full(`on ${ATTACK_KINDS[rest] ?? `${lowerWords(rest)} attacks`}`, `except on ${ATTACK_KINDS[rest] ?? `${lowerWords(rest)} attacks`}`) : full('on attacks', 'on rolls that aren\'t attacks');
  case 'defense': return rest.includes('{') ? full('against the chosen Defense', 'except against the chosen Defense') : full(`against ${defenseName(rest)}`, `except against ${defenseName(rest)}`);
  case 'roll': return rollFact(rest);
  case 'item': return itemFact(rest, SUBJECTS.item);
  case 'weapon': return itemFact(rest, SUBJECTS.weapon);
  case 'host': return itemFact(rest, SUBJECTS.host);
  case 'rule': {
    switch (rest) {
    case 'altMode': return fact('while', 'you are in this Alt Mode', "you aren't in this Alt Mode");
    case 'hostEquipped': return fact('while', 'the item it is attached to is equipped', "the item it is attached to isn't equipped");
    case 'banked': return fact('while', 'a bonus this item banked is unspent', 'no bonus this item banked is left');
    case 'granted': return fact('while', 'something this item gave you is still there', 'nothing this item gave you is left');
    }

    if (rest.startsWith('granted:')) {
      return fact('while', `you still have something this item gave you where ${itemClauses([rest.slice(8)])}`, `you have nothing this item gave you where ${itemClauses([rest.slice(8)])}`);
    }

    return itemFact(rest, SUBJECTS.rule);
  }

  case 'self':
  case 'holder':
  case 'target': {
    const who = subjects[family];
    if (family == 'target' && rest == '') {
      return fact('if', 'there is a target', 'there is no target');
    }

    return actorFact(rest, who, family) ?? fact('if', `${who.who} ${who.is} ${lowerWords(rest)}`, `${who.who} ${who.isnt} ${lowerWords(rest)}`);
  }

  case 'check': return checkFact(rest, SUBJECTS.self);
  case 'combat': {
    if (!rest) {
      return full('in combat', 'outside combat');
    }

    const status = /^(enemy|ally)Status:(.+)$/.exec(rest);
    if (status) {
      return fact('while', `${status[1] == 'enemy' ? 'an enemy' : 'an ally'} in the fight is ${statusList(status[2])}`, `no ${status[1]} in the fight is ${statusList(status[2])}`);
    }

    const side = /^(enemy|ally):(.+)$/.exec(rest);
    if (side) {
      const who = SUBJECTS[side[1]];
      return fact('while', clauses(side[2].split('&'), who), `no ${side[1]} in the fight matches`);
    }

    if (rest.startsWith('round:')) {
      return full(`in round ${rest.slice(6)}`, `except in round ${rest.slice(6)}`);
    }

    switch (rest) {
    case 'exists': return fact('while', 'a combat is set up', 'no combat is set up');
    case 'aheadOfTarget': return fact('if', "your Initiative is higher than the target's", "your Initiative isn't higher than the target's");
    case 'highestInitiative': return fact('if', 'you have the highest Initiative', "you don't have the highest Initiative");
    case 'first': return fact('if', 'you are first in the Initiative order', "you aren't first in the Initiative order");
    }

    return fact('if', `the combat is ${lowerWords(rest)}`, `the combat isn't ${lowerWords(rest)}`);
  }

  case 'markedBy': return fact('if', `the target put the ${humanize(rest)} mark on you`, `the target didn't put the ${humanize(rest)} mark on you`);
  case 'markedByMe': return fact('if', `you put the ${humanize(rest)} mark on the target`, `you didn't put the ${humanize(rest)} mark on the target`);
  case 'assist': return full(`when Lending Assistance (${lowerWords(rest)})`, `except when Lending Assistance (${lowerWords(rest)})`);
  case 'damage': {
    if (rest == 'crit') {
      return full('on a Critical Success', 'unless it is a Critical Success');
    }

    const amount = /^(>=|<=|>|<|=)(\d+)$/.exec(rest);
    return amount ? fact('if', `the damage is ${comparison(amount[1], amount[2])}`, `the damage is ${comparison(OPPOSITE[amount[1]], amount[2])}`)
      : fact('if', `the damage is ${humanize(rest)}`, `the damage isn't ${humanize(rest)}`);
  }

  case 'ownTurn': return full('on your turn', 'outside your turn');
  case 'var': return varFact(rest);
  case 'vehicle': {
    switch (rest) {
    case 'crew': return fact('while', 'you crew a vehicle', "you don't crew a vehicle");
    case 'driving': return fact('while', 'you drive a vehicle', "you don't drive a vehicle");
    }

    const data = dataFact(rest, SUBJECTS.vehicle);
    if (data) {
      return data;
    }

    if (rest.startsWith('name~')) {
      return fact('while', `you crew a vehicle named like "${rest.slice(5)}"`, `you don't crew a vehicle named like "${rest.slice(5)}"`);
    }

    const kind = /^type:(\w+)$/.exec(rest);
    if (kind) {
      return fact('while', `you crew ${ACTOR_TYPES[kind[1]] ?? article(lowerWords(kind[1]))}`, `you don't crew ${ACTOR_TYPES[kind[1]] ?? article(lowerWords(kind[1]))}`);
    }

    const moves = /^moves:(.+)$/.exec(rest);
    if (moves) {
      const kind = moves[1].includes('{') ? 'the chosen' : humanize(moves[1]);
      return fact('while', `the vehicle you crew has ${kind} Movement`, `the vehicle you crew has no ${kind} Movement`);
    }

    return fact('while', `the vehicle you crew is ${lowerWords(rest)}`, `the vehicle you crew isn't ${lowerWords(rest)}`);
  }

  case 'ally':
  case 'enemy': {
    const within = /^within:(\d+)$/.exec(rest);
    const range = within ? ` within ${within[1]} ft` : '';
    return full(`with ${article(family)}${range}`, `with no ${family}${range}`);
  }

  case 'terrain': {
    if (rest == 'set') {
      return fact('if', 'the terrain is set', "the terrain isn't set");
    }

    return rest == 'wild' ? full('in the wild', 'outside the wild') : full(`in ${humanize(rest)} terrain`, `outside ${humanize(rest)} terrain`);
  }

  case 'environment': {
    const outside = rest.startsWith('outside:');
    const key = outside ? rest.slice(8) : rest;
    const where = ENVIRONMENTS[key] ?? `in ${article(lowerWords(key))} environment`;
    return outside ? fact('while', `you stand ${where.replace(/^in /, 'in ')} outside any vessel`, `you don't stand ${where} outside a vessel`) : full(where, `not ${where}`);
  }

  case 'scene': {
    if (rest.startsWith('token:')) {
      return fact('while', clauses(rest.slice(6).split('&'), SUBJECTS.someone), 'nobody else in the scene matches');
    }

    const name = /^name~(.+)$/.exec(rest);
    return name ? full(`in a scene named like "${name[1]}"`, `outside scenes named like "${name[1]}"`) : fact('if', `the scene is ${lowerWords(rest)}`, `the scene isn't ${lowerWords(rest)}`);
  }

  case 'ask': return fact('when', rest ? rest.replace(/\{[^}]+\}/g, ref => humanize(ref).toLowerCase()) : 'you say so');
  }

  // A tag nobody knows: its words, so it never shows raw.
  const words = humanize(tag);
  return fact('if', lowerFirst(words), null);
}

const lowerFirst = text => String(text).charAt(0).toLowerCase() + String(text).slice(1);

/** var:<key>[op value] - a value stored earlier in the run. */
function varFact(rest) {
  const test = /^([\w-]+)(>=|<=|!=|>|<|=)?(.*)$/.exec(rest);
  if (!test) {
    return fact('if', lowerWords(rest), null);
  }

  const [, key, op, value] = test;
  if (key == 'ok' && op == '>=' && value == '1') {
    return fact('if', 'that worked', "that didn't work");
  }

  const label = { margin: 'the margin', rolled: 'the roll', picked: 'the pick' }[key] ?? `the stored ${lowerWords(key)}`;
  if (!op) {
    return fact('if', `${label} is set`, `${label} isn't set`);
  }

  return fact('if', `${label} is ${comparison(op, value)}`, OPPOSITE[op] ? `${label} is ${comparison(OPPOSITE[op], value)}` : null);
}

/** A fact read out, negated or not. */
function render(found, negated) {
  if (!negated) {
    return [found.lead, found.pos].filter(Boolean).join(' ');
  }

  if (found.neg) {
    return [found.lead, found.neg].filter(Boolean).join(' ');
  }

  return found.lead ? `unless ${found.pos}` : `not ${found.pos}`;
}

/** One tag's clause without its lead word (for joining several about one subject). */
function clause(tag, who) {
  const negated = String(tag).startsWith('not:');
  const text = negated ? String(tag).slice(4) : String(tag);
  const found = tagFact(text, who);
  return negated ? found.neg ?? `not ${found.pos}` : found.pos;
}

/** Several tags about the same subject: "an enemy in the fight is an NPC and its name contains ...". */
function clauses(tags, who) {
  return tags.map(tag => clause(tag, who)).join(' and ');
}

/**
 * One `when` entry in plain English.
 * @param {String} tag
 * @returns {String}
 */
export function describeTag(tag) {
  const text = String(tag ?? '').trim();
  if (!text) {
    return '';
  }

  const negated = text.startsWith('not:');
  return render(tagFact(negated ? text.slice(4) : text), negated);
}

/**
 * A whole `when` list: "on Might tests, while you are Morphed". `{any: [...]}` reads as "A or B".
 * @param {Array<String|Object>} when
 * @returns {String}
 */
export function describeWhen(when) {
  const parts = [];
  for (const entry of Array.isArray(when) ? when : []) {
    if (entry && typeof entry == 'object' && Array.isArray(entry.any)) {
      parts.push(entry.any.map(inner => describeWhen([inner])).filter(Boolean).join(' or '));
      continue;
    }

    const text = describeTag(entry);
    if (text) {
      parts.push(text);
    }
  }

  return parts.join(', ');
}
