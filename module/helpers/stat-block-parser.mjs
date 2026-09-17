import { E20 } from "./config.mjs";

/**
 * Pure text -> IR parser for Essence20 Threat/NPC/vehicle stat blocks pasted out of a sourcebook
 * PDF. Phase 1 of docs/STAT_BLOCK_IMPORTER_PLAN.md - this file deliberately touches no Foundry
 * globals beyond CONFIG-equivalent data imported from helpers/config.mjs, so the whole grammar is
 * unit-testable without a running client. Turning the IR into real Actor/Item documents is the
 * builder's job (Phase 2, helpers/stat-block-import.mjs), not this file's.
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
 * -> "THREATS", "AT TACKS" -> "ATTACKS". Only applied to lines that are purely uppercase letters,
 * spaces and hyphens with no digits or colon, so "THREAT LEVEL: 7" is never touched.
 */
function collapseHeadingSpacing(line) {
  const trimmed = line.trim();
  if (!trimmed || !/^[A-Z][A-Z\s-]*$/.test(trimmed) || trimmed.length > 40) {
    return line;
  }

  return trimmed.replace(/\s+/g, '');
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

  const size = headerText.match(/SIZE:\s*([A-Za-z]+)(?:\s+(I{1,3}|[23])\b)?/i);
  if (size) {
    const printed = size[2] ? `${size[1]} ${size[2]}` : size[1];
    const resolved = resolve(printed, SIZE_LOOKUP, SIZE_ALIASES);
    if (resolved) {
      ir.size = resolved;
    } else {
      addDiagnostic(ir, 'error', printed, `Unrecognized Size class "${printed}".`);
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
  for (const match of combined[1].matchAll(pairPattern)) {
    const type = match[2].toLowerCase();
    if (ir.movement[type] === null) {
      ir.movement[type] = Number.parseInt(match[1], 10);
    }
  }
}

/* ------------------------------------------------------------------ *
 * Sectioning                                                          *
 * ------------------------------------------------------------------ */

/** The section key a line introduces, or null if it isn't a heading. */
function sectionFor(line) {
  const candidate = line.trim().toUpperCase();
  if (!candidate || candidate.includes(':') || /\d/.test(candidate)) {
    return null;
  }

  return SECTIONS[candidate.replace(/\s+/g, '')] ?? null;
}

/**
 * Splits preprocessed lines into the header block plus one bucket of raw lines per section.
 * @returns {{headerLines: String[], sections: Object<String, String[]>}}
 */
function splitSections(lines) {
  const headerLines = [];
  const sections = {};
  let current = null;

  for (const line of lines) {
    const section = sectionFor(line);
    if (section) {
      current = section;
      sections[current] ??= [];
      continue;
    }

    if (current) {
      sections[current].push(line);
    } else {
      headerLines.push(line);
    }
  }

  return { headerLines, sections };
}

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

  const damage = body.match(/(\d+)\s+([A-Za-z]+)\s+damage/i);
  if (damage) {
    effect.damageValue = Number.parseInt(damage[1], 10);
    const type = resolve(damage[2], DAMAGE_LOOKUP, DAMAGE_ALIASES);
    if (type) {
      effect.damageType = type;
    } else {
      addDiagnostic(ir, 'warning', sourceLine, `Unrecognized damage type "${damage[2]}".`);
    }
  }

  const reach = body.match(/\bReach\b(?:\s*x\s*(\d+))?/i);
  if (reach) {
    effect.isReach = true;
    effect.range.reachMultiplier = reach[1] ? Number.parseInt(reach[1], 10) : null;
  }

  const range = body.match(/\bRange\s*(\d+)\s*(?:ft|feet)?\s*\/\s*(\d+)\s*(?:ft|feet)?/i);
  if (range) {
    effect.range.value = Number.parseInt(range[1], 10);
    effect.range.long = Number.parseInt(range[2], 10);
  }

  const min = body.match(/\bmin\s*(\d+)\s*(?:ft|feet)?/i);
  if (min) {
    effect.range.min = Number.parseInt(min[1], 10);
  }

  const blast = body.match(/\bBlast:?\s*(\d+)\s*(?:ft|feet)?\s*(radius|cone)/i);
  if (blast) {
    effect.radius = Number.parseInt(blast[1], 10);
    effect.shape = blast[2].toLowerCase() === 'cone' ? 'cone' : 'burst';
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

    const [, name, printedSkill, rest] = head;
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
      traits: [],
      alternateEffects: [],
      ...parseEffectClauses(ir, primaryBody, entry),
    };

    const hands = detailBody.match(/\bHands:\s*(\d+)/i);
    if (hands) {
      attack.numHands = Number.parseInt(hands[1], 10);
    }

    const traits = detailBody.match(/\bTraits:\s*([^:]+?)(?=\s+(?:Alternate|Special|Hands)\b|$)/i);
    if (traits) {
      for (const printed of traits[1].split(',').map(trait => trait.trim()).filter(Boolean)) {
        const key = resolve(printed, TRAIT_LOOKUP);
        if (key) {
          attack.traits.push(key);
        } else {
          addDiagnostic(ir, 'warning', entry, `Unrecognized weapon trait "${printed}".`);
        }
      }
    }

    const alternates = detailBody.match(/\bAlternate Effects?:\s*([^:]+?)(?=\s+(?:Special|Hands|Traits)\b|$)/i);
    if (alternates) {
      attack.alternateEffects.push({
        name: alternates[1].trim(),
        ...parseEffectClauses(ir, alternates[1], entry),
      });
    }

    ir.attacks.push(attack);
  }
}

/* ------------------------------------------------------------------ *
 * Perks / Powers / Hang-Ups / Equipment                               *
 * ------------------------------------------------------------------ */

function parseNamedEntries(ir, lines) {
  return groupEntries(lines, line => NAMED_ENTRY.test(line))
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

function parseEquipment(ir, lines) {
  for (const entry of parseNamedEntries(ir, lines)) {
    const kind = normalizeKey(entry.name);
    const bonus = entry.text.match(/\+(\d+)\s+\w+\s+to\s+(\w+)/i);
    ir.equipment.push({
      kind: kind.startsWith('armor') ? 'armor' : kind.startsWith('weapon') ? 'weapon' : 'other',
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
  const lines = preprocessStatBlock(text).filter(line => line.length);

  if (!lines.length) {
    addDiagnostic(ir, 'error', null, 'Nothing to parse - the pasted text was empty.');
    return ir;
  }

  const { headerLines, sections } = splitSections(lines);

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

  resolveSkillsFromAttacks(ir);

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
