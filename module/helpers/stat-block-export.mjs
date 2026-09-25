/**
 * Renders an IR back out as printed-style stat block text. Phase 8 of
 * docs/STAT_BLOCK_IMPORTER_PLAN.md.
 *
 * The point is sharing homebrew: paired with `actorToIr` (helpers/stat-block-import.mjs) this
 * turns any Threat a GM has built - imported, grown, or made by hand - back into something that
 * can be pasted into a post, a message, or this system's own importer on someone else's machine.
 * Round-tripping is the test: what this writes, the parser reads.
 *
 * Output follows the Power Rangers CRB layout (pipe-separated header pairs), which is the dialect
 * the parser handles most directly and the one that reads best as plain text.
 *
 * **Deliberately language-independent.** Names are derived from CONFIG.E20's own KEYS rather than
 * its localized labels, so the output is the same canonical English the parser matches on no
 * matter what language the client runs in. Emitting localized labels would produce text this
 * system's own importer could not read back on a French or German client - found by the round-trip
 * test, which is exactly what that test is for.
 *
 * Pure - no Foundry documents, and no reliance on i18n having run.
 */

/** A config key as the books print it: `animalHandling` -> "Animal Handling", `antiTank` -> "Anti Tank". */
function printedName(key) {
  return String(key ?? '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, character => character.toUpperCase());
}

const MOVEMENT_ORDER = ['ground', 'aerial', 'swim', 'climb'];

/** "--" is what the books print for a stat an actor type simply does not have. */
function score(value) {
  return value === null || value === undefined ? '--' : String(value);
}

/** Uppercased Size label, as the header line prints it. */
function sizeLabel(size) {
  return size ? printedName(size).toUpperCase() : '--';
}

function headerLines(ir) {
  const lines = [];

  if (ir.name) {
    lines.push(ir.name);
  }

  if (ir.threatLevel !== null && ir.threatLevel !== undefined) {
    lines.push(`THREAT LEVEL: ${ir.threatLevel}`);
  }

  lines.push(`SIZE: ${sizeLabel(ir.size)} | HEALTH: ${score(ir.health)}`);

  const movement = MOVEMENT_ORDER
    .filter(type => ir.movement?.[type])
    .map(type => `${ir.movement[type]}ft ${printedName(type)}`);
  if (movement.length) {
    lines.push(`MOVEMENT: ${movement.join('; ')}`);
  }

  lines.push(`STRENGTH: ${score(ir.essences?.strength)} | SPEED: ${score(ir.essences?.speed)}`);
  lines.push(`SMARTS: ${score(ir.essences?.smarts)} | SOCIAL: ${score(ir.essences?.social)}`);
  lines.push(`TOUGHNESS: ${score(ir.defenses?.toughness)} | EVASION: ${score(ir.defenses?.evasion)}`);
  lines.push(`WILLPOWER: ${score(ir.defenses?.willpower)} | CLEVERNESS: ${score(ir.defenses?.cleverness)}`);

  return lines;
}

function skillLines(ir) {
  const lines = [];

  if (ir.conditioning) {
    lines.push(`Conditioning +${ir.conditioning}`);
  }

  for (const skill of ir.skills ?? []) {
    const label = printedName(skill.key);
    const specialization = skill.specialization ? ` (${skill.specialization})` : '';
    const value = skill.shift ?? `${skill.modifier ?? 0}`;
    lines.push(`${label}${specialization} +${value}${skill.isSpecialized ? '*' : ''}`);
  }

  if (ir.languages?.length) {
    lines.push(`Languages: ${ir.languages.join(', ')}`);
  }

  return lines;
}

/** One attack's printed clause, e.g. `Blasting Horn (Targeting): +d4, Range 30ft/60ft (1 Energy damage)`. */
function attackLine(attack) {
  const skill = attack.skill ? printedName(attack.skill) : '?';
  const parts = [];

  if (attack.shift) {
    parts.push(`+${attack.shift}${attack.isSpecialized ? '*' : ''}`);
  }

  if (attack.isReach) {
    parts.push(attack.range?.reachMultiplier > 1 ? `Reach x${attack.range.reachMultiplier}` : 'Reach');
  }

  if (attack.range?.value) {
    let range = `Range ${attack.range.value}ft/${attack.range.long}ft`;
    if (attack.range.min) {
      range += `; min ${attack.range.min}ft`;
    }

    parts.push(range);
  }

  const damage = [];
  if (attack.damageValue !== null && attack.damageValue !== undefined) {
    damage.push(`${attack.damageValue} ${printedName(attack.damageType)} damage`.replace(/\s+/g, ' ').trim());
  }

  if (attack.radius) {
    damage.push(`Blast: ${attack.radius}ft ${attack.shape === 'cone' ? 'cone' : 'radius'}`);
  }

  const head = `${attack.name} (${skill}): ${parts.join(', ')}`;
  return damage.length ? `${head} (${damage.join(', ')})` : head;
}

function attackLines(ir) {
  const lines = [];
  for (const attack of ir.attacks ?? []) {
    lines.push(attackLine(attack));

    for (const alternate of attack.alternateEffects ?? []) {
      const damage = alternate.damageValue !== null && alternate.damageValue !== undefined
        ? `${alternate.damageValue} ${printedName(alternate.damageType)} damage`.replace(/\s+/g, ' ').trim()
        : alternate.name;
      lines.push(`Alternate Effects: ${damage}`);
    }

    if (attack.numHands !== null && attack.numHands !== undefined) {
      lines.push(`Hands: ${attack.numHands}`);
    }

    if (attack.traits?.length) {
      lines.push(`Traits: ${attack.traits.map(printedName).join(', ')}`);
    }
  }

  return lines;
}

/** A Power's printed parenthetical, e.g. `(2/scene, Standard)`. */
function powerQualifier(power) {
  const parts = [];
  if (power.usesPer) {
    parts.push(`${power.usesPer}/${power.usesInterval === 'perTurn' ? 'turn' : 'scene'}`);
  }

  if (power.actionType) {
    parts.push(printedName(power.actionType));
  }

  return parts.length ? ` (${parts.join(', ')})` : '';
}

function section(heading, lines) {
  return lines.length ? [heading, ...lines] : [];
}

/** The Contact half, laid out the way the GI Joe books print it. */
function contactLines(ir) {
  const contact = ir.contact;
  if (!contact) {
    return [];
  }

  const cost = perk => (perk.cost ? ` (${perk.cost} Allegiance Point${perk.cost === 1 ? '' : 's'})` : '');
  return [
    `GAINING ${(ir.name ?? '').toUpperCase()} AS A CONTACT`.replace(/\s+/g, ' '),
    ...(contact.gaining ?? []).map(entry => (entry.name ? `${entry.name}: ${entry.text}` : entry.text).trim()),
    ...(contact.allegiancePoints !== null && contact.allegiancePoints !== undefined
      ? [`Allegiance Points: ${contact.allegiancePoints}`] : []),
    ...section('CONTACT PERKS', (contact.perks ?? []).map(perk => `${perk.name}${cost(perk)}: ${perk.text}`.trim())),
  ];
}

/**
 * @param {Object} ir   A parsed or actor-derived IR.
 * @returns {String}   Printed-style stat block text.
 */
export function irToStatBlockText(ir) {
  if (!ir) {
    return '';
  }

  return [
    ...headerLines(ir),
    ...section('SKILLS', skillLines(ir)),
    ...section('PERKS', (ir.perks ?? []).map(perk => `${perk.name}: ${perk.text}`.trim())),
    ...section('ATTACKS', attackLines(ir)),
    ...section('POWERS', (ir.powers ?? []).map(power => `${power.name}${powerQualifier(power)}: ${power.text}`.trim())),
    ...section('HANG-UPS', (ir.hangUps ?? []).map(hangUp => `${hangUp.name}: ${hangUp.text}`.trim())),
    ...section('EQUIPMENT', (ir.equipment ?? []).map(entry => `${entry.kind === 'armor' ? 'Armor' : 'Weapons'}: ${entry.text}`)),
    ...contactLines(ir),
  ].join('\n');
}
