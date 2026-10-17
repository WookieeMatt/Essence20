import { E20 } from "../util/config.mjs";

/**
 * Pure text -> IR parser for Essence20 Threat/NPC/vehicle stat blocks pasted out of a sourcebook
 * PDF. Phase 1 of docs/STAT_BLOCK_IMPORTER_PLAN.md - this file deliberately touches no Foundry
 * globals beyond CONFIG-equivalent data imported from util/config.mjs, so the whole grammar is
 * unit-testable without a running client. Turning the IR into real Actor/Item documents is the
 * builder's job (Phase 2, importers/stat-block-import.mjs), not this file's.
 *
 * Three printed dialects are supported by ONE tolerant grammar rather than three parsers - see the
 * plan's §1 for verbatim-shaped samples of each:
 *  - Power Rangers CRB: pipe-separated header pairs, bare skill lines, GROUND/AERIAL MOVEMENT as
 *    separate labels (and frequently split across a line break mid-label).
 *  - Finster's Monster-Matic Cookbook: no pipes, one MOVEMENT: line with semicolon-separated
 *    types, bulleted skills, letter-spaced headings ("AT TACKS"), sub-lines under each attack.
 *  - G.I. JOE CRB vehicles: "--" for absent Essences, colon-separated skills, bulleted attacks
 *    with `min` ranges and `Blast:` shapes.
 *
 * The header block is parsed by whitespace-flexible regex over the WHOLE block rather than line by
 * line, which is what makes a label split across a line break ("GROUND MOVEMENT: 30ft | AERIAL\n
 * MOVEMENT: 60ft") parse correctly without having to guess where the publisher wrapped.
 *
 * Nothing is ever silently dropped: anything unrecognized becomes an entry in `ir.diagnostics`
 * for the importer UI to surface before any document is created.
 */

/* ------------------------------------------------------------------ *
 * Lookup tables                                                       *
 * ------------------------------------------------------------------ */

/** Strips a printed name down to a comparable key: "Animal Handling" -> "animalhandling". */
function normalizeKey(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Builds a {normalized -> real config key} lookup from a CONFIG.E20 map's own keys. */
function buildLookup(configMap) {
  const lookup = {};
  for (const key of Object.keys(configMap)) {
    lookup[normalizeKey(key)] = key;
  }

  return lookup;
}

const SKILL_LOOKUP = buildLookup(E20.skills);
const DAMAGE_LOOKUP = buildLookup(E20.damageTypes);
// A vehicle attack's printed `Traits:` line mixes both maps - the G.I. JOE CRB's own Ram/Flyby
// attacks carry "Drive-By", which lives in E20.vehicleTraits, not E20.weaponTraits (see
// data/item/weapon-effect.mjs's own isRam/isFlyby comment). Weapon traits win a key collision,
// since the great majority of parsed attacks are ordinary weapons.
const TRAIT_LOOKUP = { ...buildLookup(E20.vehicleTraits), ...buildLookup(E20.weaponTraits) };
const SIZE_LOOKUP = buildLookup(E20.actorSizes);
const ACTION_LOOKUP = buildLookup(E20.actionTypes);

/**
 * Printed names that don't normalize onto their own config key.
 *
 * `melee` is the one that matters: the Power Rangers CRB prints "Melee (Unarmed Combat)" in its
 * Skills list where Finster's Cookbook correctly prints "Might (Brawling)" - the CRB is using a
 * category label for a skill that does not exist in E20.skills. §3.3 of the plan covers the
 * second half of this fix (attack lines name their own skill in parentheses, so an unresolved
 * skill whose NAME matches an attack can adopt that attack's skill).
 */
const SKILL_ALIASES = {
  melee: 'might',
  // The Power Rangers CRB's FIRST printing uses pre-errata skill names that no longer exist in
  // E20.skills. Confirmed by comparing the same Threat across printings: 1st-printing Chunky
  // Chicken lists "Perception", "Stealth" and "Melee", where the 2nd printing of that very block
  // lists "Alertness (Perception)", "Infiltration" and "Might (Scissors)". 2nd-printing text uses
  // Perception/Stealth zero times as skills and Alertness/Infiltration 44 times.
  perception: 'alertness',
  stealth: 'infiltration',
  // Operation: Cold Iron lists "Awareness" in the Cobra Viper's skills. There is no such skill
  // in E20, and the same book writes "Alertness (Situational Awareness)" elsewhere, so it is the
  // same loose printing as Perception above.
  awareness: 'alertness',
};

/**
 * "Energy damage" is printed constantly but there is no `energy` key. It maps to `element`, whose
 * own en.json label is literally "Element/Energy" and which is the second most-used damageType
 * across the shipped packs (375 weaponEffects) - so this is a confirmed alias, not a config gap.
 * `knockprone` covers the typo'd `knocProne` config key.
 */
const DAMAGE_ALIASES = {
  energy: 'element',
  knockprone: 'knocProne',
};

/** E20.actorSizes spells these `extended2`/`extended3`; the books print Roman numerals. */
const SIZE_ALIASES = {
  extendedii: 'extended2',
  extendediii: 'extended3',
  extended2: 'extended2',
  extended3: 'extended3',
};

const ESSENCE_NAMES = ['strength', 'speed', 'smarts', 'social'];
const DEFENSE_NAMES = ['toughness', 'evasion', 'willpower', 'cleverness'];
const MOVEMENT_NAMES = ['ground', 'aerial', 'swim', 'climb'];

/** Section headings we split on, keyed by their space-stripped uppercase form. */
const SECTIONS = {
  SKILLS: 'skills',
  PERK: 'perks',
  PERKS: 'perks',
  POWER: 'powers',
  POWERS: 'powers',
  ATTACK: 'attacks',
  ATTACKS: 'attacks',
  'HANG-UP': 'hangUps',
  'HANG-UPS': 'hangUps',
  HANGUP: 'hangUps',
  HANGUPS: 'hangUps',
  EQUIPMENT: 'equipment',
  GEAR: 'equipment',
};

/** Sub-labels that belong to the attack entry above them rather than starting a new one. */
const ATTACK_SUBLABELS = [
  'alternate effects',
  'alternate effect',
  'special effects',
  'special effect',
  'hands',
  'traits',
  // Transformers attacks: "Requirements: Bot Mode only", "Upgrades: Piercing".
  'requirements',
  'requirement',
  'upgrades',
  'upgrade',
];

/* ------------------------------------------------------------------ *
 * Preprocessing                                                       *
 * ------------------------------------------------------------------ */

/**
 * Lines that are page furniture rather than stat block content. Deliberately loose - the two
 * "Downloaded by ... Unauthorized distribution prohibited." watermark variants in the real books
 * are spelled differently from each other ("Downloded", "Unathorized"), so this matches on the
 * stable parts only.
 */
const FURNITURE_PATTERNS = [
  /downlo.?ded by .*distribution prohibited/i,
  /roleplaying game/i,
  /^=+\s*page\s+\d+\s*=+$/i,
  /^\d+$/,
  /^\d{2,6}[A-Z][A-Z' -]{5,}$/,
  // A chapter running head ("CHAPTER ONE: COBRA STRIKES"). A Contact section often runs over a
  // page break, and inside one this has exactly the "Name: text" shape of a way to gain the Contact.
  /^CHAPTER\s+[A-Z]+:\s*[A-Z][A-Z' -]*$/,
];

/**
 * True when a line is its own text twice over - the shape a PDF's mirrored running header takes
 * when extracted ("POWER RANGERS ROLEPLAYING GAMEPOWER RANGERS ROLEPLAYING GAME").
 */
function isDoubledLine(line) {
  const compact = line.replace(/\s/g, '');
  if (compact.length < 12 || compact.length % 2 !== 0) {
    return false;
  }

  const half = compact.length / 2;
  return compact.slice(0, half) === compact.slice(half);
}

function isFurniture(line) {
  if (!line.trim()) {
    return false;
  }

  return FURNITURE_PATTERNS.some(pattern => pattern.test(line)) || isDoubledLine(line);
}

/**
 * Collapses a letter-spaced or ligature-split all-caps heading down to one word: "T H R E A T S"
 * -> "THREATS", "AT TACKS" -> "ATTACKS".
 *
 * What is NOT touched matters more than it sounds. The old rule collapsed any all-caps line, and
 * a threat's name is an all-caps line: every block read out of Operation: Cold Iron came back
 * named "COBRAVIPER", "SNOWSERPENT", "POLARBEAR". Names with a bracket in them ("BUZZSAW
 * (DREADNOK SCRAPPER)") escaped only because the bracket failed the character test, which is not
 * a distinction worth keeping.
 *
 * So a line is collapsed only on evidence that its spacing is not real: either it lands on a
 * section heading, or one of its pieces is a letter or two, which is what a word broken by
 * letter-spacing leaves behind and what a name made of real words never does. Two rather than
 * three, because "ICE VIPER" is a threat.
 */
function collapseHeadingSpacing(line) {
  const trimmed = line.trim();
  if (!trimmed || !/^[A-Z][A-Z\s-]*$/.test(trimmed) || trimmed.length > 40) {
    return line;
  }

  const collapsed = trimmed.replace(/\s+/g, '');
  const split = trimmed.split(/\s+/).some(piece => piece.length <= 2);
  return SECTIONS[collapsed] || split ? collapsed : line;
}

/**
 * Cleans a raw paste into an array of usable lines. Order matters: furniture has to go before
 * de-hyphenation (or a watermark line gets glued onto real content), and de-hyphenation before
 * heading collapsing (or a hyphen-wrapped heading is mis-detected).
 * @param {String} text
 * @returns {String[]}
 */
export function preprocessStatBlock(text) {
  const normalized = String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u00d7/g, 'x')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2022\u2023\u25cf\u25aa\u2043]/g, '-');

  const kept = normalized.split('\n').filter(line => !isFurniture(line));

  // De-hyphenate words the publisher wrapped mid-token ("doz-\nens"), but leave real hyphenated
  // compounds alone by requiring the continuation to start lowercase ("Anti-\nTank" survives).
  const dehyphenated = [];
  for (const line of kept) {
    const previous = dehyphenated[dehyphenated.length - 1];
    if (previous !== undefined && /[A-Za-z]-$/.test(previous.trim()) && /^[a-z]/.test(line.trim())) {
      dehyphenated[dehyphenated.length - 1] = previous.trim().replace(/-$/, '') + line.trim();
      continue;
    }

    dehyphenated.push(line);
  }

  return dehyphenated.map(collapseHeadingSpacing).map(line => line.trim());
}

/* ------------------------------------------------------------------ *
 * IR scaffolding                                                      *
 * ------------------------------------------------------------------ */

function makeIr() {
  const ir = {
    name: '',
    threatLevel: null,
    size: null,
    health: null,
    conditioning: 0,
    essences: {},
    defenses: {},
    movement: {},
    languages: [],
    skills: [],
    perks: [],
    powers: [],
    hangUps: [],
    attacks: [],
    equipment: [],
    contact: null,
    // A Cybertronian's Alt Mode (SIZE: Huge/Extended, "... Aerial (Alt Mode)" movement): {size, movement}, else null.
    altMode: null,
    // A Power Rangers Zord's "Zord Features:" ({name, matchNames}) and the Megaform Traits they name ({name, matchNames}).
    zordFeatures: [],
    megaformTraits: [],
    diagnostics: [],
  };

  for (const essence of ESSENCE_NAMES) {
    ir.essences[essence] = null;
  }

  for (const defense of DEFENSE_NAMES) {
    ir.defenses[defense] = null;
  }

  for (const movement of MOVEMENT_NAMES) {
    ir.movement[movement] = null;
  }

  return ir;
}

/**
 * @param {Object} ir
 * @param {"error"|"warning"|"info"} severity   `error` blocks import until resolved in the UI.
 * @param {String|null} line   The offending source text, for the UI to show in context.
 * @param {String} message
 */
function addDiagnostic(ir, severity, line, message) {
  ir.diagnostics.push({ severity, line: line ?? null, message });
}

/** Resolves a printed name against a config lookup + its alias table, or null. */
function resolve(printed, lookup, aliases = {}) {
  const key = normalizeKey(printed);
  return lookup[key] ?? aliases[key] ?? null;
}

/** Parses a printed Essence/Defense value, where "--" means "this actor type has none". */
function parseScore(raw) {
  if (/^-{1,2}$/.test(raw)) {
    return null;
  }

  const value = Number.parseInt(raw, 10);
  return Number.isNaN(value) ? null : value;
}

/* ------------------------------------------------------------------ *
 * Header block                                                        *
 * ------------------------------------------------------------------ */

function parseHeader(ir, headerText) {
  const threatLevel = headerText.match(/THREAT\s+LEVEL:\s*(-?\d+)/i);
  if (threatLevel) {
    ir.threatLevel = Number.parseInt(threatLevel[1], 10);
  } else {
    addDiagnostic(ir, 'warning', null, 'No "THREAT LEVEL:" found in the header block.');
  }

  // A Cybertronian prints both Modes' Sizes: "SIZE: Huge/Extended" - Bot Mode, then Alt Mode.
  const size = headerText.match(/SIZE:\s*([A-Za-z]+)(?:\s+(I{1,3}|[23])\b)?(?:\s*\/\s*([A-Za-z]+)(?:\s+(I{1,3}|[23])\b)?)?/i);
  if (size) {
    const printed = size[2] ? `${size[1]} ${size[2]}` : size[1];
    const resolved = resolve(printed, SIZE_LOOKUP, SIZE_ALIASES);
    if (resolved) {
      ir.size = resolved;
    } else {
      addDiagnostic(ir, 'error', printed, `Unrecognized Size class "${printed}".`);
    }

    if (size[3]) {
      const printedAlt = size[4] ? `${size[3]} ${size[4]}` : size[3];
      const altSize = resolve(printedAlt, SIZE_LOOKUP, SIZE_ALIASES);
      if (altSize) {
        altModeOf(ir).size = altSize;
      } else {
        addDiagnostic(ir, 'error', printedAlt, `Unrecognized Alt Mode Size class "${printedAlt}".`);
      }
    }
  } else {
    addDiagnostic(ir, 'warning', null, 'No "SIZE:" found in the header block.');
  }

  const health = headerText.match(/HEALTH:\s*(\d+)/i);
  if (health) {
    ir.health = Number.parseInt(health[1], 10);
  } else {
    addDiagnostic(ir, 'warning', null, 'No "HEALTH:" found in the header block.');
  }

  parseMovement(ir, headerText);

  const scorePattern = new RegExp(
    `\\b(${[...ESSENCE_NAMES, ...DEFENSE_NAMES].join('|')}):\\s*(-{1,2}|\\d+)`, 'gi');
  for (const match of headerText.matchAll(scorePattern)) {
    const name = match[1].toLowerCase();
    const value = parseScore(match[2]);
    if (ESSENCE_NAMES.includes(name)) {
      ir.essences[name] = value;
    } else {
      ir.defenses[name] = value;
    }
  }

  // A Zord prints its armor beside the Defense: "TOUGHNESS: 21 (2 Plating Armor)".
  const armorPattern = new RegExp(`\\b(${DEFENSE_NAMES.join('|')}):\\s*\\d+\\s*\\(\\s*(\\d+)\\s+(?:Plating\\s+)?Armor\\s*\\)`, 'gi');
  for (const match of headerText.matchAll(armorPattern)) {
    ir.armor ??= {};
    ir.armor[match[1].toLowerCase()] = Number.parseInt(match[2], 10);
  }

  // A Megazord / Combiner prints its participants' Health: "HEALTH (9/9/7/7/7)", "HEALTH: 16/12/9/9/8" - its own comes
  // from them, so this is a block to import onto that Megaform ("Import into").
  if (/HEALTH:\s*\(?\s*\d+(?:\s*\/\s*\d+)+\s*\)?/i.test(headerText)) {
    ir.isMegaform = true;
    addDiagnostic(ir, 'info', null, 'Health is printed per participant: a Megaform\'s Health comes from its members. Import it into that Megaform.');
  }
}

/**
 * The Power Rangers Zord blocks print their labels without colons ("SIZE Gigantic | HEALTH 8", "GROUND MOVEMENT 40ft"):
 * a colon is put after each one, so the rest of the grammar reads them as it reads everything else. Upper case only -
 * the same words in prose are left alone.
 */
const BARE_LABEL = /(^|\|\s*)(THREAT LEVEL|SIZE|HEALTH|STRENGTH|SPEED|SMARTS|SOCIAL|TOUGHNESS|EVASION|WILLPOWER|CLEVERNESS|(?:GROUND|AERIAL|SWIM|CLIMB) MOVEMENT|MOVEMENT)(?=\s+[^\s:]|\s*$)/g;

function addLabelColons(line) {
  return line.replace(BARE_LABEL, '$1$2:');
}

/**
 * Both printed movement dialects. Labelled form ("GROUND MOVEMENT: 30ft") wins where present;
 * the combined form ("MOVEMENT: 45ft Ground; 35ft Aerial") fills in whatever it didn't cover.
 */
function parseMovement(ir, headerText) {
  const labelled = new RegExp(`\\b(${MOVEMENT_NAMES.join('|')})\\s+MOVEMENT:\\s*(\\d+)`, 'gi');
  for (const match of headerText.matchAll(labelled)) {
    ir.movement[match[1].toLowerCase()] = Number.parseInt(match[2], 10);
  }

  const combined = headerText.match(/(?<![A-Za-z]\s)\bMOVEMENT:\s*([^\n|]*(?:\n(?![A-Z][A-Z ]*:)[^\n|]*)*)/i);
  if (!combined) {
    return;
  }

  const pairPattern = new RegExp(`(\\d+)\\s*(?:ft|feet)\\.?\\s*(${MOVEMENT_NAMES.join('|')})`, 'gi');
  // A Cybertronian tags each part with its Mode: "40ft Ground (Bot Mode); 80 ft (40ft) Aerial (Alt Mode)". The
  // bracketed distance after a speed (a take-off run) isn't a movement of its own.
  for (const part of combined[1].split(';')) {
    const isAlt = /\(\s*Alt\s*Mode\s*\)/i.test(part);
    const target = isAlt ? altModeOf(ir).movement : ir.movement;
    for (const match of part.replace(/\(\s*\d+\s*(?:ft|feet)\.?\s*\)/gi, ' ').matchAll(pairPattern)) {
      const type = match[2].toLowerCase();
      if (target[type] === null || target[type] === undefined) {
        target[type] = Number.parseInt(match[1], 10);
      }
    }
  }
}

/** The IR's Alt Mode, made on first use. */
function altModeOf(ir) {
  ir.altMode ??= { size: null, movement: Object.fromEntries(MOVEMENT_NAMES.map(type => [type, null])) };
  return ir.altMode;
}

/**
 * After the whole block is read: an attack that needs a Mode, or a Mode Conversion Perk, makes it a Cybertronian too,
 * and a Mode the block didn't print takes the Bot Mode's (its Size, its movement).
 */
function finishAltMode(ir) {
  const hasModes = ir.attacks.some(attack => attack.mode) || ir.perks.some(perk => /^mode conversion$/i.test(perk.name));
  if (!ir.altMode && !hasModes) {
    return;
  }

  const altMode = altModeOf(ir);
  altMode.size ??= ir.size;
  if (MOVEMENT_NAMES.every(type => altMode.movement[type] === null)) {
    altMode.movement = { ...ir.movement };
    addDiagnostic(ir, 'info', null, 'No Alt Mode movement printed: it uses the Bot Mode movement.');
  }
}

/* ------------------------------------------------------------------ *
 * Sectioning                                                          *
 * ------------------------------------------------------------------ */

/** The section key a line introduces, or null if it isn't a heading. */
function sectionFor(line) {
  // A trailing colon is stripped first: several printings head their sections "SKILLS:" /
  // "ATTACKS:" / "POWERS:" rather than bare. Any OTHER colon still disqualifies the line, so a
  // field like "THREAT LEVEL: 7" is never mistaken for a heading.
  const candidate = line.trim().toUpperCase().replace(/:$/, '');
  if (!candidate || candidate.includes(':') || /\d/.test(candidate)) {
    return null;
  }

  return SECTIONS[candidate.replace(/\s+/g, '')] ?? null;
}

/**
 * The Contact sections a line introduces, which the plain SECTIONS table cannot express: the
 * "gaining" heading carries the NPC's own name ("GAINING GENERAL FLAGG AS A CONTACT", or the
 * Power Rangers books' bare "GAINING AS A CONTACT", or My Little Pony's "Gaining Fluttershy as a
 * contact:"). Compared with every space removed, since a heading may be letter-spaced or
 * already collapsed by collapseHeadingSpacing().
 * @param {String} line
 * @returns {?String}
 */
function contactSectionFor(line) {
  const compact = line.replace(/\s+/g, '').toUpperCase().replace(/:$/, '');
  if (/^GAINING.*ASACONTACT$/.test(compact) && compact.length <= 80) {
    return 'contactGaining';
  }

  return compact === 'CONTACTPERKS' || compact === 'CONTACTPERK' ? 'contactPerks' : null;
}

/** "Allegiance Points: 3" - the Contact's pool, printed before or after the ways to gain it. */
const ALLEGIANCE_LINE = /^allegiance\s+points?\s*:\s*(\d+)\s*$/i;

/**
 * Splits preprocessed lines into the header block plus one bucket of raw lines per section.
 * @returns {{headerLines: String[], sections: Object<String, String[]>, allegiancePoints: ?Number}}
 */
function splitSections(lines) {
  const headerLines = [];
  const sections = {};
  let current = null;
  let allegiancePoints = null;

  const inlineSections = new Set();
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const allegiance = line.match(ALLEGIANCE_LINE);
    if (allegiance) {
      allegiancePoints = Number.parseInt(allegiance[1], 10);
      continue;
    }

    // The gaining heading is long enough to wrap: "GAINING THE MAGNA DEFENDER AS A" / "CONTACT".
    const ownLine = contactSectionFor(line);
    const wrapped = !ownLine && /^gaining\b/i.test(line) && lines[index + 1] !== undefined
      ? contactSectionFor(`${line} ${lines[index + 1]}`)
      : null;
    if (ownLine || wrapped) {
      current = ownLine ?? wrapped;
      sections[current] ??= [];
      if (wrapped) {
        index++;
      }

      continue;
    }

    const section = sectionFor(line);
    if (section) {
      current = section;
      sections[current] ??= [];
      continue;
    }

    // A list on its heading's line, comma-separated and wrapping onto the next ones: "Skills: Conditioning +4, Driving
    // (Autopilot) +d2," / "Zord Features: Call to Action, ..." (Power Rangers Zords). The attacks follow with no
    // heading of their own, so an attack line after one of these lists starts them.
    const inline = line.match(INLINE_LIST);
    if (inline) {
      current = INLINE_SECTIONS[inline[1].toLowerCase().replace(/\s+/g, ' ')];
      inlineSections.add(current);
      sections[current] ??= [];
      sections[current].push(inline[2]);
      continue;
    }

    if (inlineSections.has(current) && isAttackStart(line)) {
      current = 'attacks';
      sections[current] ??= [];
    }

    if (current) {
      sections[current].push(line);
    } else {
      headerLines.push(line);
    }
  }

  // An inline list is one comma-separated run, however it wrapped: one entry per line from here on.
  for (const key of inlineSections) {
    sections[key] = splitTopLevel(sections[key].join(' '));
  }

  return { headerLines, sections, allegiancePoints };
}

const INLINE_LIST = /^(Skills|Zord Features)\s*:\s*(.+)$/i;
const INLINE_SECTIONS = { 'skills': 'skills', 'zord features': 'zordFeatures' };

/**
 * Groups a section's lines into entries, joining continuation lines onto the entry above them.
 * @param {String[]} lines
 * @param {Function} isEntryStart   Predicate deciding whether a line begins a new entry.
 * @returns {String[]}
 */
function groupEntries(lines, isEntryStart) {
  const entries = [];
  for (const raw of lines) {
    const line = raw.replace(/^[-*]\s*/, '').trim();
    if (!line) {
      continue;
    }

    if (!entries.length || isEntryStart(line)) {
      entries.push(line);
    } else {
      entries[entries.length - 1] += ` ${line}`;
    }
  }

  return entries;
}

/** `Name: body` - the shape every Perk, Power, Hang-Up and Equipment entry shares. */
const NAMED_ENTRY = /^([^:]{1,70}):\s*(.*)$/;

/**
 * Whether a line starts a new `Name: body` entry, rather than continuing the one above it.
 *
 * A colon is not enough: prose wraps anywhere, and a line of it can happen to hold one. General
 * Flagg's Call In the JOEs wraps onto "was a PC: He can use a Standard action...", which was read
 * as a Power named "was a PC". A printed name never starts in lower case, so a line that does is
 * the middle of a sentence.
 * @param {String} line
 * @returns {Boolean}
 */
function startsNamedEntry(line) {
  return NAMED_ENTRY.test(line) && !/^\p{Ll}/u.test(line);
}

/* ------------------------------------------------------------------ *
 * Skills                                                              *
 * ------------------------------------------------------------------ */

const SKILL_LINE = /^(.+?)\s*(?:\(([^)]+)\))?\s*:?\s*\+\s*(d\d+|\d+)\s*(\*)?$/;

/** A Skills-section line that opens a new entry rather than continuing the one above it. */
function isSkillStart(line) {
  return SKILL_LINE.test(line) || /^Languages?:/i.test(line);
}

function parseSkills(ir, lines) {
  // Grouped rather than read line by line because the Languages entry in particular wraps in the
  // real books ("Languages: Putty, Sirian, Tenga; Understands and\nspeaks most Earth-based
  // Languages"), and its tail is not a skill line.
  for (const line of groupEntries(lines, isSkillStart)) {
    const languages = line.match(/^Languages?:\s*(.+)$/i);
    if (languages) {
      ir.languages.push(...languages[1].split(/[,;]/).map(entry => entry.trim()).filter(Boolean));
      continue;
    }

    const match = line.match(SKILL_LINE);
    if (!match) {
      addDiagnostic(ir, 'warning', line, 'Could not read this as a Skill line.');
      continue;
    }

    const [, printedName, specialization, value, star] = match;

    // Conditioning is a flat Strength value on the actor (system.conditioning), not an entry in
    // system.skills - and it is printed as "+3", not "+d4", so it never has a shift at all.
    if (normalizeKey(printedName) === 'conditioning') {
      ir.conditioning = Number.parseInt(value, 10) || 0;
      continue;
    }

    const key = resolve(printedName, SKILL_LOOKUP, SKILL_ALIASES);
    if (!key) {
      addDiagnostic(ir, 'error', line, `Unrecognized Skill "${printedName.trim()}".`);
      continue;
    }

    ir.skills.push({
      key,
      shift: /^d\d+$/.test(value) ? value : null,
      modifier: /^\d+$/.test(value) ? Number.parseInt(value, 10) : 0,
      isSpecialized: Boolean(star),
      specialization: specialization?.trim() ?? null,
    });
  }
}

/* ------------------------------------------------------------------ *
 * Attacks                                                             *
 * ------------------------------------------------------------------ */

function isAttackSublabel(line) {
  const label = line.split(':')[0]?.trim().toLowerCase();
  return ATTACK_SUBLABELS.includes(label);
}

/**
 * One sub-label's text, up to the next sub-label - by position, so a colon inside it ("2 Fire damage Blast: 20ft
 * radius") doesn't cut it short.
 * @param {String} body    The attack's sub-labels, joined.
 * @param {String} label   A regex source for the label, e.g. 'Alternate Effects?'.
 * @returns {String|null}
 */
function sublabelText(body, label) {
  const start = new RegExp(`\\b${label}:\\s*`, 'i').exec(body);
  if (!start) {
    return null;
  }

  const rest = body.slice(start.index + start[0].length);
  const labels = [...ATTACK_SUBLABELS].sort((a, b) => b.length - a.length).join('|');
  const next = rest.search(new RegExp(`\\s(?:${labels})\\s*:`, 'i'));
  return (next === -1 ? rest : rest.slice(0, next)).trim();
}

/**
 * An Alternate Effect's printed ↓: the last entry of the bracket it ends on - "(↓1)", or "(Reach, ↓1)" in "2 Sharp
 * damage—Multiple (2) Targets (Reach, ↓1)". A bare number with no arrow ("(1)", the arrow lost in the copy) counts too,
 * except where it's a count ("Multiple Targets (2)").
 * @param {String} printed
 * @returns {Number}
 */
function printedShiftDown(printed) {
  const bracket = printed.match(/\(([^()]*)\)\s*$/);
  if (!bracket) {
    return 0;
  }

  const parts = bracket[1].split(',');
  const last = parts.at(-1).trim().match(/^([^\d\s]{0,2})\s*(\d+)$/);
  if (!last || isUpArrow(last[1])) {
    return 0;
  }

  const before = printed.slice(0, bracket.index);
  if (parts.length == 1 && !last[1] && /\b(?:Targets?|Multiple|Multi-Weapon)\s*$/i.test(before)) {
    return 0;
  }

  return Number.parseInt(last[2], 10);
}

/** An up arrow, as a PDF copy gives it ("↑", or the symbol font's U+F0E1). */
function isUpArrow(symbol) {
  return /[↑\uF0E1]/.test(symbol ?? '');
}

/** A list split on its commas, but not those inside brackets or in a number ("1,000ft"). */
function splitTopLevel(text) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const [i, char] of [...text].entries()) {
    depth += char == '(' ? 1 : char == ')' ? -1 : 0;
    if (char == ',' && depth <= 0 && !/\d/.test(text[i + 1] ?? '')) {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  parts.push(current);
  return parts.map(part => part.trim()).filter(Boolean);
}

/** An attack entry opens with `Name (Skill):` and is not one of the sub-labels. */
function isAttackStart(line) {
  return !isAttackSublabel(line) && /^.+\([^)]+\)\s*:/.test(line);
}

/**
 * Reads the damage/range/shape clauses shared by a primary attack and each of its Alternate
 * Effects, both of which become their own `weaponEffect` Item in Phase 2.
 */
function parseEffectClauses(ir, body, sourceLine) {
  const effect = {
    damageValue: null,
    damageType: null,
    // `isReach` is separate from `reachMultiplier` on purpose: a plain "Reach" and a "Reach x2"
    // are both melee, but only the second carries a multiplier, and a multiplier of null is also
    // what an attack with no Reach clause at all has. The builder needs to tell those apart to
    // infer the weaponEffect's `classification.style`.
    isReach: false,
    range: { value: null, long: null, min: null, reachMultiplier: null },
    radius: 0,
    shape: null,
    defenseType: null,
  };

  // Stun is printed bare, with no "damage" after it - "(1 Stun)" on Unarmed Combat across the GI
  // Joe books - so it has its own pattern; the general one never matched it, and the attack came
  // in with no damage at all. Transformers prints it number last, "(Stun 1)".
  const stunLast = body.match(/\(Stun\s+(\d+)\)/i);
  const damage = body.match(/(\d+)\s+([A-Za-z]+)\s+damage/i) ?? body.match(/\((\d+)\s+(Stun)\)/i)
    ?? (stunLast ? [stunLast[0], stunLast[1], 'Stun'] : null);
  if (damage) {
    effect.damageValue = Number.parseInt(damage[1], 10);
    const type = resolve(damage[2], DAMAGE_LOOKUP, DAMAGE_ALIASES);
    if (type) {
      effect.damageType = type;
    } else {
      addDiagnostic(ir, 'warning', sourceLine, `Unrecognized damage type "${damage[2]}".`);
    }
  }

  const reach = body.match(/\bReach\b(?:\s*[x×]\s*(\d+))?/i);
  if (reach) {
    effect.isReach = true;
    effect.range.reachMultiplier = reach[1] ? Number.parseInt(reach[1], 10) : null;
  }

  const range = body.match(/\bRange\s*(\d+)\s*(?:ft|feet)?\s*\/\s*(\d+)\s*(?:ft|feet)?/i);
  if (range) {
    effect.range.value = Number.parseInt(range[1], 10);
    effect.range.long = Number.parseInt(range[2], 10);
  }

  const min = body.match(/\bmin\.?\s*(\d+)\s*(?:ft|feet)?/i);
  if (min) {
    effect.range.min = Number.parseInt(min[1], 10);
  }

  // "Multiple (2) Targets" / "Multiple Targets (5, 30 ft cone)": how many it hits.
  const targets = body.match(/\bMultiple\s*\(\s*(\d+)\s*\)\s*Targets?\b/i) ?? body.match(/\bMultiple\s+Targets?\s*\(\s*(\d+)\b/i);
  if (targets) {
    effect.numTargets = Number.parseInt(targets[1], 10);
  }

  const blast = body.match(/\bBlast:?\s*(\d+)\s*(?:ft|feet)?\s*(radius|cone)/i);
  if (blast) {
    effect.radius = Number.parseInt(blast[1], 10);
    // The names are Foundry's own region shapes, which is what data/aoe-schema.mjs stores and
    // what mechanics/combat/aoe-targeting.mjs places. "burst" was this parser's own word for a radius
    // and no schema ever accepted it, so every Blast attack imported was refused its shape.
    effect.shape = blast[2].toLowerCase() === 'cone' ? 'cone' : 'circle';
  }

  const defense = new RegExp(`\\b(${DEFENSE_NAMES.join('|')})\\b`, 'i').exec(body);
  if (defense) {
    effect.defenseType = defense[1].toLowerCase();
  }

  return effect;
}

function parseAttacks(ir, lines) {
  const entries = groupEntries(lines, isAttackStart);

  for (const entry of entries) {
    if (isAttackSublabel(entry)) {
      addDiagnostic(ir, 'warning', entry, 'Attack detail line found with no attack above it.');
      continue;
    }

    const head = entry.match(/^(.+?)\s*\(([^)]+)\)\s*:\s*(.*)$/);
    if (!head) {
      addDiagnostic(ir, 'warning', entry, 'Could not read this as an Attack.');
      continue;
    }

    const [, name, printedHead, rest] = head;
    // "Golden Claw (1/scene, Might)": the uses come before the Skill.
    const uses = printedHead.match(/^\s*(\d+)\s*\/\s*scene\s*,\s*(.+)$/i);
    const printedSkill = uses ? uses[2] : printedHead;
    const skill = resolve(printedSkill, SKILL_LOOKUP, SKILL_ALIASES);
    if (!skill) {
      addDiagnostic(ir, 'error', entry, `Unrecognized Skill "${printedSkill}" on attack "${name.trim()}".`);
    }

    // Everything up to the first sub-label is the attack's own clause; the sub-labels that follow
    // are split back out here (groupEntries joined them onto this entry).
    const sublabelPattern = new RegExp(`\\b(${ATTACK_SUBLABELS.join('|')}):`, 'i');
    const firstSublabel = rest.search(sublabelPattern);
    const primaryBody = firstSublabel === -1 ? rest : rest.slice(0, firstSublabel);
    const detailBody = firstSublabel === -1 ? '' : rest.slice(firstSublabel);

    const shift = primaryBody.match(/\+\s*(d\d+)/i);
    const attack = {
      name: name.trim(),
      skill,
      shift: shift ? shift[1] : null,
      isSpecialized: /\+\s*d\d+\s*\*/.test(primaryBody),
      numHands: null,
      size: null,
      traits: [],
      alternateEffects: [],
      ...parseEffectClauses(ir, primaryBody, entry),
    };

    if (uses) {
      attack.usesPerScene = Number.parseInt(uses[1], 10);
    }

    // "+d6 with ↓1 or pilot's Driving with ↓1" (the arrow can come through as anything - see printedShift).
    const withShift = primaryBody.match(/\+\s*d\d+\s*\*?\s+with\s+([^\d\s]{0,2})\s*(\d+)/i);
    if (withShift && !isUpArrow(withShift[1])) {
      attack.shiftDown = Number.parseInt(withShift[2], 10);
    }

    const hands = detailBody.match(/\bHands:\s*(\d+)/i);
    if (hands) {
      attack.numHands = Number.parseInt(hands[1], 10);
    }

    const traits = sublabelText(detailBody, 'Traits');
    if (traits) {
      for (const printed of traits.split(',').map(trait => trait.trim()).filter(Boolean)) {
        // The books print "Integrated" among the traits, but this system keeps it as the weapon's
        // Size (E20.weaponSizes, system.classification.size) - not a trait, so it is read as one.
        if (normalizeKey(printed) === 'integrated') {
          attack.size = 'integrated';
          continue;
        }

        const key = resolve(printed, TRAIT_LOOKUP);
        if (key) {
          attack.traits.push(key);
        } else {
          addDiagnostic(ir, 'warning', entry, `Unrecognized weapon trait "${printed}".`);
        }
      }
    }

    // "Alternate Effects: 2 Sharp damage (↓1), 3 Sharp damage (↓3)" - one Alternate Effect per comma, each with its own
    // printed ↓. The arrow comes through a PDF copy as "↓", as a symbol-font character (Enigma of Combination's U+F0E2),
    // as nothing at all, or as something else again - so whatever sits before the number counts, unless it's an up arrow.
    // An Alternate Effect that prints no range of its own fires at the weapon's.
    const alternates = sublabelText(detailBody, 'Alternate Effects?');
    for (const printed of splitTopLevel(alternates ?? '')) {
      const alternate = {
        name: printed,
        ...parseEffectClauses(ir, printed, entry),
        shiftDown: printedShiftDown(printed),
      };
      if (!alternate.range.value && !alternate.isReach) {
        alternate.range = { ...attack.range };
        alternate.isReach = attack.isReach;
      }

      attack.alternateEffects.push(alternate);
    }

    // "Requirements: Bot Mode only" / "Alt Mode only" (Transformers) - kept as printed, and the Mode when it names one.
    const requirements = sublabelText(detailBody, 'Requirements?');
    if (requirements) {
      attack.requirements = requirements;
      const bot = /\bBot[- ]?Mode\b/i.test(requirements);
      const alt = /\bAlt[- ]?Mode\b/i.test(requirements);
      if (bot != alt) {
        attack.mode = bot ? 'bot' : 'alt';
      }
    }

    ir.attacks.push(attack);
  }
}

/* ------------------------------------------------------------------ *
 * Perks / Powers / Hang-Ups / Equipment                               *
 * ------------------------------------------------------------------ */

function parseNamedEntries(ir, lines) {
  return groupEntries(lines, startsNamedEntry)
    .map(entry => {
      const match = entry.match(NAMED_ENTRY);
      if (!match) {
        addDiagnostic(ir, 'warning', entry, 'Could not read this as a "Name: description" entry.');
        return null;
      }

      return { name: match[1].trim(), text: match[2].trim() };
    })
    .filter(Boolean);
}

/**
 * Powers carry a usage/action parenthetical on their name: "Lightning Vision (2/scene, Standard)".
 * "(Special)" is a real printed value with no E20.actionTypes equivalent, so it is recorded as a
 * diagnostic rather than forced onto a wrong key.
 */
function parsePowers(ir, lines) {
  for (const entry of parseNamedEntries(ir, lines)) {
    const power = { name: entry.name, text: entry.text, usesPer: null, usesInterval: null, actionType: null };
    const parenthetical = entry.name.match(/^(.+?)\s*\(([^)]*)\)\s*$/);

    if (parenthetical) {
      power.name = parenthetical[1].trim();
      for (const part of parenthetical[2].split(/[,;]/).map(value => value.trim()).filter(Boolean)) {
        const uses = part.match(/^(\d+)\s*\/\s*(scene|turn|round)$/i);
        if (uses) {
          power.usesPer = Number.parseInt(uses[1], 10);
          power.usesInterval = uses[2].toLowerCase() === 'turn' ? 'perTurn' : 'perScene';
          continue;
        }

        const action = resolve(part, ACTION_LOOKUP);
        if (action) {
          power.actionType = action;
        } else {
          addDiagnostic(ir, 'info', entry.name, `Unmapped Power qualifier "${part}".`);
        }
      }
    }

    ir.powers.push(power);
  }
}

/**
 * A Contact Perk's name carries its cost: "Flash the Brass (1 Allegiance Point)", or My Little
 * Pony's shorter "Animal Expert (2 Allegiance)".
 */
const CONTACT_PERK_COST = /^(.+?)\s*\(\s*(\d+)\s+allegiance(?:\s+points?)?\s*\)\s*$/i;

/**
 * The Contact half of a stat block, or null when it has none. Only a block with at least one of
 * the three parts counts, so an ordinary Threat stays `contact: null`.
 */
function parseContact(ir, sections, allegiancePoints) {
  const gainingLines = sections.contactGaining ?? [];
  const perkLines = sections.contactPerks ?? [];
  if (!gainingLines.length && !perkLines.length && allegiancePoints === null) {
    return null;
  }

  // A cost can wrap away from its name - "'I'm only going to say this nicely once!' (3" then
  // "Allegiance): ...", or "Supply Chain of Command (2 Allegiance" then "Points): ...". The first
  // half has no colon but still opens a new Perk; the second has one but only finishes the cost.
  const isCostTail = line => /^(?:allegiance\s*)?(?:points?\s*)?\)\s*:/i.test(line);
  const opensCost = line => /\(\s*\d+(?:\s+allegiance)?(?:\s+points?)?\s*$/i.test(line);
  const perks = groupEntries(perkLines, line => !isCostTail(line) && (startsNamedEntry(line) || opensCost(line)))
    .map(entry => {
      const match = entry.match(NAMED_ENTRY);
      if (!match) {
        addDiagnostic(ir, 'warning', entry, 'Could not read this as a "Name (cost): description" Contact Perk.');
        return null;
      }

      const cost = match[1].trim().match(CONTACT_PERK_COST);
      if (!cost) {
        addDiagnostic(ir, 'info', entry, `No Allegiance Point cost found on Contact Perk "${match[1].trim()}".`);
      }

      return {
        name: (cost ? cost[1] : match[1]).trim(),
        cost: cost ? Number.parseInt(cost[2], 10) : null,
        text: match[2].trim(),
      };
    })
    .filter(Boolean);

  return {
    gaining: parseNamedEntries(ir, gainingLines),
    allegiancePoints,
    perks,
  };
}

function parseEquipment(ir, lines) {
  for (const entry of parseNamedEntries(ir, lines)) {
    const kind = normalizeKey(entry.name);
    const bonus = entry.text.match(/\+(\d+)\s+\w+\s+to\s+(\w+)/i);
    // Armor is not always labelled "Armor": General Flagg's reads "Battledress: Tactical Armor
    // (+1 deflective to Toughness)". Armor named in the text with a Defense bonus is armor too,
    // or its bonus is never counted as armor when the Defenses are worked out.
    const isArmor = kind.startsWith('armor') || (!!bonus && /\barmou?r\b/i.test(entry.text));
    ir.equipment.push({
      kind: isArmor ? 'armor' : kind.startsWith('weapon') ? 'weapon' : 'other',
      name: entry.text.replace(/\s*\(.*\)\s*$/, '').trim(),
      text: entry.text,
      bonus: bonus ? { value: Number.parseInt(bonus[1], 10), defense: bonus[2].toLowerCase() } : null,
    });
  }
}

/* ------------------------------------------------------------------ *
 * Entry point                                                         *
 * ------------------------------------------------------------------ */

/**
 * Splits a paste containing several stat blocks into one chunk each.
 *
 * "THREAT LEVEL:" is the only line every printed block in every dialect carries exactly once, so
 * it is the boundary marker. A block's name sits on the line immediately above its Threat Level,
 * so each split is taken one line early to keep it - except the first, which takes everything from
 * the top (a single-block paste often has a page header or two above the name).
 *
 * Returns a single-element array for an ordinary one-block paste, so callers do not need to care
 * which they were given.
 *
 * @param {String} text
 * @returns {String[]}
 */
export function splitStatBlocks(text) {
  const lines = preprocessStatBlock(text).filter(line => line.length);
  const markers = lines.reduce((found, line, index) => {
    if (/^THREAT\s+LEVEL:/i.test(line)) {
      found.push(index);
    }

    return found;
  }, []);

  if (markers.length <= 1) {
    return lines.length ? [lines.join('\n')] : [];
  }

  const starts = markers.map((marker, index) => (index === 0 ? 0 : Math.max(0, marker - 1)));
  return starts.map((start, index) => lines.slice(start, starts[index + 1] ?? lines.length).join('\n'));
}

/**
 * Parses one pasted stat block into the IR documented in docs/STAT_BLOCK_IMPORTER_PLAN.md §2.1.
 * Always returns an IR - failures are reported through `ir.diagnostics`, never thrown, so the
 * importer UI can show a partial parse for the GM to correct rather than an empty dialog.
 * @param {String} text   One stat block's worth of pasted text.
 * @returns {Object}
 */
export function parseStatBlock(text) {
  const ir = makeIr();
  const lines = preprocessStatBlock(text).filter(line => line.length).map(addLabelColons);

  if (!lines.length) {
    addDiagnostic(ir, 'error', null, 'Nothing to parse - the pasted text was empty.');
    return ir;
  }

  const { headerLines, sections, allegiancePoints } = splitSections(lines);

  // The name is whatever precedes the first stat label. Anything after it in the header block is
  // flavour prose, which the header regexes simply don't match.
  const firstLabel = headerLines.findIndex(line => /^[A-Z][A-Z ]*:/.test(line));
  ir.name = (firstLabel > 0 ? headerLines[0] : headerLines[0] ?? '').trim();
  if (!ir.name || firstLabel === 0) {
    addDiagnostic(ir, 'warning', null, 'No name line found above the stat labels.');
  }

  parseHeader(ir, headerLines.join('\n'));
  parseSkills(ir, sections.skills ?? []);
  parseAttacks(ir, sections.attacks ?? []);
  parsePowers(ir, sections.powers ?? []);
  parseEquipment(ir, sections.equipment ?? []);
  ir.perks = parseNamedEntries(ir, sections.perks ?? []);
  ir.hangUps = parseNamedEntries(ir, sections.hangUps ?? []);
  ir.contact = parseContact(ir, sections, allegiancePoints);
  parseZordFeatures(ir, sections.zordFeatures ?? []);
  combinerTraitsFromPerks(ir);

  resolveSkillsFromAttacks(ir);
  finishAltMode(ir);
  finishZord(ir, sections);

  return ir;
}

/**
 * Second half of the "Melee" fix (plan §3.3): an attack line always names its own skill in
 * parentheses, so a Skill line that failed to resolve but shares a NAME with a parsed attack can
 * adopt that attack's skill. Rewrites the diagnostic to `info` when it succeeds, so the UI shows
 * what was inferred instead of blocking the import.
 */
function resolveSkillsFromAttacks(ir) {
  for (const diagnostic of ir.diagnostics) {
    const unresolved = diagnostic.message.match(/^Unrecognized Skill "(.+)"\.$/);
    if (!unresolved || diagnostic.severity !== 'error') {
      continue;
    }

    const printed = normalizeKey(unresolved[1]);
    const match = ir.attacks.find(attack => normalizeKey(attack.name) === printed && attack.skill);
    if (!match) {
      continue;
    }

    if (!ir.skills.some(skill => skill.key === match.skill)) {
      const shift = diagnostic.line?.match(/\+\s*(d\d+)/);
      ir.skills.push({
        key: match.skill,
        shift: shift ? shift[1] : null,
        modifier: 0,
        isSpecialized: /\*\s*$/.test(diagnostic.line ?? ''),
        specialization: unresolved[1],
      });
    }

    diagnostic.severity = 'info';
    diagnostic.message =
      `Skill "${unresolved[1]}" is not in E20.skills; read as "${match.skill}" from the attack of the same name.`;
  }
}

/* ------------------------------------------------------------------ *
 * Zords (Power Rangers CRB Ch.9)                                      *
 * ------------------------------------------------------------------ */

/** The compendium spells some Features differently from the stat blocks ("Enhanced (Claws)", "Movement Boost"). */
const FEATURE_ALIASES = { enhanced: 'Enhance', 'movement boost': 'Movement Booster' };
const ESSENCE_WORD = /\s+(Strength|Speed|Smarts|Social)$/i;

/**
 * "Zord Features: Call to Action, Combiner (Core Body), Increase (Strength), Enhance (Tail Cannons)". Each is matched
 * against the compendium by the names it could have there - itself, its name before the brackets, or that with the
 * compendium's own placeholder ("Increase (Essence)", "Enhance (Attack)"). A Combiner / Megaform Trait names its
 * Megaform Trait in the brackets, which is matched too ("Core Ability Speed" is the Core Ability trait).
 */
function parseZordFeatures(ir, entries) {
  for (const printed of entries) {
    const [, rawBase, option] = printed.match(/^(.+?)\s*(?:\(([^)]*)\))?$/) ?? [null, printed, null];
    const base = FEATURE_ALIASES[rawBase.toLowerCase()] ?? rawBase;
    ir.zordFeatures.push({
      name: printed,
      text: '',
      matchNames: [...new Set([printed, base, `${base} (Essence)`, `${base} (Attack)`])],
    });

    if (option && /^(Combiner|Megaform Trait)$/i.test(base) && !/^\d+$/.test(option)) {
      ir.megaformTraits.push(megaformTraitEntry(option));
    }
  }
}

const MOVEMENT_WORDS = { ground: 'ground', aerial: 'aerial', air: 'aerial', flying: 'aerial', swim: 'swim', aquatic: 'swim', water: 'swim', climb: 'climb' };

/**
 * A Megaform Trait / Combiner feature as an IR entry: the names it can have in the compendium, and what its brackets
 * choose - "Core Essence [Speed]", "Enhanced Move [Aerial]", "Skill Expertise [Might]", "Commander [Strength, Speed]",
 * or a Zord's "Core Ability Speed". `overrides` is merged onto the item (importers/stat-block-import.mjs).
 */
function megaformTraitEntry(printed) {
  const [, rawName, bracket] = printed.match(/^(.+?)\s*(?:\[([^\]]*)\])?\s*$/) ?? [null, printed, null];
  const choices = (bracket ?? '').split(',').map(word => word.trim()).filter(Boolean);
  const trailing = rawName.match(ESSENCE_WORD);
  const name = rawName.replace(/\bRange\b/i, 'Ranged').trim();
  const base = trailing ? name.replace(ESSENCE_WORD, '').trim() : name;
  if (trailing) {
    choices.unshift(trailing[1]);
  }

  const essences = choices.map(word => word.toLowerCase()).filter(word => ESSENCE_NAMES.includes(word));
  const movement = choices.map(word => MOVEMENT_WORDS[word.toLowerCase()]).find(Boolean);
  const skill = choices.map(word => skillKeyOf(word)).find(Boolean);
  const system = {};
  const flags = {};
  if (/^commander$/i.test(base)) {
    if (essences.length == 2) {
      flags.commanderEssences = essences;
    }
  } else if (essences.length) {
    system.essence = essences[0];
    // Core Essence raises "one associated Skill" - the compendium item's own default (Athletics) is only right for
    // Strength, so with no Skill named none is raised rather than the wrong one.
    system.skill = skill ?? null;
  } else if (skill) {
    system.skill = skill;
  }

  if (movement) {
    system.movementType = movement;
  }

  return { name: printed, text: '', matchNames: [...new Set([name, base])], overrides: { system, flags } };
}

/** Commas that separate, not those inside "[Strength, Speed]". */
function splitOutsideBrackets(text) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const char of text) {
    depth += '[('.includes(char) ? 1 : ')]'.includes(char) ? -1 : 0;
    if (char == ',' && depth <= 0) {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  parts.push(current);
  return parts.map(part => part.trim()).filter(Boolean);
}

/**
 * A Transformers member's "Gestalt Combiner (Commander [Strength, Speed])" / "Matched Combiner (Core Essence [Speed])"
 * Perk names the Combiner feature it brings: that feature is a Megaform Trait on the member, which the Combiner form
 * reads (documents/actor.mjs#_prepareMegaformCombinerData). The Perk itself is matched by its name before the brackets.
 */
function combinerTraitsFromPerks(ir) {
  for (const perk of ir.perks) {
    const match = perk.name.match(/^((?:Gestalt|Matched)\s+Combiner)\s*\((.+)\)\s*$/i);
    const base = perk.name.replace(/\s*\([^)]*\)\s*$/, '').trim();
    if (base != perk.name) {
      perk.matchNames = [base];
    }

    if (match) {
      perk.matchNames = [match[1]];
      ir.megaformTraits.push(...splitOutsideBrackets(match[2]).map(megaformTraitEntry));
    }
  }
}

/** A Zord's block (Zord Features, or attacks "or pilot's Driving"): no Threat Level to miss, and it's a Zord to import. */
function finishZord(ir, sections) {
  const piloted = (sections.attacks ?? []).some(line => /\bpilot['’]s\b/i.test(line));
  if (!ir.zordFeatures.length && !piloted) {
    return;
  }

  ir.suggestedType = 'zord';
  ir.diagnostics = ir.diagnostics.filter(entry => !/THREAT LEVEL/.test(entry.message));
}

/** A printed Skill name's key ("Social" isn't one - see importers/stat-block-rules.mjs), or null. */
export function skillKeyOf(printed) {
  return resolve(printed, SKILL_LOOKUP, SKILL_ALIASES);
}
