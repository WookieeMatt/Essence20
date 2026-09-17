import { parseStatBlock, preprocessStatBlock } from "./stat-block-parser.mjs";

/*
 * Fixtures are SYNTHESIZED - invented creatures written in each book's printed layout - rather
 * than pasted rulebook text. What is under test is format fidelity (pipes vs. no pipes, bullets,
 * "--" Essences, split labels, PDF extraction artifacts), not any specific published monster.
 */

/** Power Rangers CRB layout: pipe-separated pairs, bare skill lines, split MOVEMENT label. */
const DIALECT_A = `
Gravel Golem (Normal)
THREAT LEVEL: 6
SIZE: LARGE | HEALTH: 8
GROUND MOVEMENT: 30ft | AERIAL
MOVEMENT: 45ft
STRENGTH: 5 | SPEED: 4
SMARTS: 2 | SOCIAL: 1
TOUGHNESS: 15 | EVASION: 14
WILLPOWER: 12 | CLEVERNESS: 11
A lumbering pile of animated scree that guards the quarry road.
SKILLS
Alertness (Insight) +d4*
Melee (Boulder Toss) +d6*
Initiative +d4
Languages: English, Putty
PERKS
Stone Skin: The Gravel Golem reduces all incoming damage by 1.
ATTACKS
Boulder Toss (Might): +d6*, Reach (1 Blunt damage)
Grit Spray (Targeting): +d4, Range 20ft/40ft (1 Energy damage)
POWERS
Quarry Quake (2/scene, Standard): The golem stamps, and each creature within 15 feet must
succeed on a DIF 12 Brawn Skill Test.
HANG-UPS
Slow to Start: The Gravel Golem cannot take a Move action on the first round of combat.
`;

/** Finster's Cookbook layout: no pipes, combined MOVEMENT, bullets, split "AT TACKS" heading. */
const DIALECT_B = `
RUST WRAITH (GROWN)
THREAT LEVEL: 14
SIZE: Extended II HEALTH: 16
MOVEMENT: 40ft Ground; 30ft Aerial
STRENGTH: 12 SPEED: 9
SMARTS: 7 SOCIAL: 4
TOUGHNESS: 28 EVASION: 19
WILLPOWER: 17 CLEVERNESS: 14
SKILLS
• Might (Brawling) +d8*
• Conditioning +2
• Alertness +d6
• Languages: Machine Cant
PERKS
Corroding Touch: Anything the Rust Wraith grapples begins to oxidize.
AT TACKS
Oxide Blade (Finesse): +d6*, Reach x2 (5 Sharp damage)
Alternate Effects: 2 Acid damage
Hands: 1
Traits: Acid, Sharp, Silent
POWERS
Scrap Surge (1/scene; Standard): The wraith hurls a wave of shrapnel.
EQUIPMENT
Armor: Pitted Ironplate (+4 deflective to Toughness; Magical)
`;

/** G.I. JOE CRB vehicle layout: "--" Essences, colon skills, min range, Blast shape. */
const DIALECT_C = `
H.A.M.M.E.R. (HEAVY ASSAULT TRANSPORT)
THREAT LEVEL: 4
SIZE: Extended | HEALTH: 6
MOVEMENT: 50 ft Ground
STRENGTH: 3 | SPEED: 2 | SMARTS: -- | SOCIAL: --
TOUGHNESS: 14 | EVASION: 12
WILLPOWER: -- | CLEVERNESS: --
SKILLS
• Might: +d4
• Brawn: +d2
ATTACKS
• Mortar Pod (Targeting): Gunner's Targeting Skill, Range 90ft/180ft; min 25ft (2 Sharp damage,
Blast: 15ft radius)
• Traits: Anti-Tank, Reload
`;

describe("preprocessStatBlock", () => {
  test("strips the download watermark in both of its printed spellings", () => {
    const lines = preprocessStatBlock([
      'SIZE: LARGE',
      'Downloaded by A Person on 1/29/2025 . Unauthorized distribution prohibited.',
      'Downloded by A Person on 4/3/2022 . Unathorized distribution prohibited.',
      'HEALTH: 7',
    ].join('\n'));
    expect(lines).toEqual(['SIZE: LARGE', 'HEALTH: 7']);
  });

  test("strips running headers, bare page numbers and doubled title lines", () => {
    const lines = preprocessStatBlock([
      'POWER RANGERS ROLEPLAYING GAME - CHAPTER 13: THREATS216',
      '217',
      'POWER RANGERS ROLEPLAYING GAMEPOWER RANGERS ROLEPLAYING GAME',
      'SKILLS',
    ].join('\n'));
    expect(lines).toEqual(['SKILLS']);
  });

  test("collapses letter-spaced and ligature-split headings", () => {
    expect(preprocessStatBlock('AT TACKS')).toEqual(['ATTACKS']);
    expect(preprocessStatBlock('T H R E A T S')).toEqual(['THREATS']);
  });

  test("leaves a heading-shaped line with a colon or digits alone", () => {
    expect(preprocessStatBlock('THREAT LEVEL: 7')).toEqual(['THREAT LEVEL: 7']);
  });

  test("rejoins words the publisher hyphenated across a line break", () => {
    expect(preprocessStatBlock('transports doz-\nens of Joes')).toEqual(['transports dozens of Joes']);
  });

  test("keeps a real hyphenated compound that wrapped", () => {
    expect(preprocessStatBlock('Traits: Anti-\nTank')).toEqual(['Traits: Anti-', 'Tank']);
  });

  test("normalizes bullets, curly quotes and the multiplication sign", () => {
    expect(preprocessStatBlock('• Reach × 2')).toEqual(['- Reach x 2']);
    expect(preprocessStatBlock('Gunner’s Skill')).toEqual(["Gunner's Skill"]);
  });
});

describe("parseStatBlock - Power Rangers CRB dialect", () => {
  const ir = parseStatBlock(DIALECT_A);

  test("reads the name and header scalars", () => {
    expect(ir.name).toBe('Gravel Golem (Normal)');
    expect(ir.threatLevel).toBe(6);
    expect(ir.size).toBe('large');
    expect(ir.health).toBe(8);
  });

  test("reads pipe-separated Essences and Defenses", () => {
    expect(ir.essences).toEqual({ strength: 5, speed: 4, smarts: 2, social: 1 });
    expect(ir.defenses).toEqual({ toughness: 15, evasion: 14, willpower: 12, cleverness: 11 });
  });

  test("reads a MOVEMENT label split across a line break", () => {
    expect(ir.movement.ground).toBe(30);
    expect(ir.movement.aerial).toBe(45);
  });

  test("reads skills, specializations and the specialized marker", () => {
    expect(ir.skills).toContainEqual({
      key: 'alertness', shift: 'd4', modifier: 0, isSpecialized: true, specialization: 'Insight',
    });
    expect(ir.skills).toContainEqual({
      key: 'initiative', shift: 'd4', modifier: 0, isSpecialized: false, specialization: null,
    });
  });

  test("resolves the CRB's 'Melee' category label onto Might via the alias table", () => {
    expect(ir.skills).toContainEqual({
      key: 'might', shift: 'd6', modifier: 0, isSpecialized: true, specialization: 'Boulder Toss',
    });
    expect(ir.diagnostics.some(d => d.message.includes('Melee'))).toBe(false);
  });

  test("reads languages", () => {
    expect(ir.languages).toEqual(['English', 'Putty']);
  });

  test("reads a Reach attack and a ranged attack", () => {
    const melee = ir.attacks.find(attack => attack.name === 'Boulder Toss');
    expect(melee).toMatchObject({
      skill: 'might', shift: 'd6', isSpecialized: true, damageValue: 1, damageType: 'blunt',
    });

    const ranged = ir.attacks.find(attack => attack.name === 'Grit Spray');
    expect(ranged.range).toMatchObject({ value: 20, long: 40 });
  });

  test("maps printed 'Energy damage' onto the element damage type", () => {
    expect(ir.attacks.find(attack => attack.name === 'Grit Spray').damageType).toBe('element');
  });

  test("reads a Power's uses and action type", () => {
    expect(ir.powers[0]).toMatchObject({
      name: 'Quarry Quake', usesPer: 2, usesInterval: 'perScene', actionType: 'standard',
    });
  });

  test("joins a Power's wrapped description", () => {
    expect(ir.powers[0].text).toContain('DIF 12 Brawn Skill Test');
  });

  test("reads Perks and Hang-Ups", () => {
    expect(ir.perks).toEqual([{ name: 'Stone Skin', text: 'The Gravel Golem reduces all incoming damage by 1.' }]);
    expect(ir.hangUps[0].name).toBe('Slow to Start');
  });

  test("raises no error-severity diagnostics", () => {
    expect(ir.diagnostics.filter(d => d.severity === 'error')).toEqual([]);
  });
});

describe("parseStatBlock - Finster's Cookbook dialect", () => {
  const ir = parseStatBlock(DIALECT_B);

  test("maps the Roman-numeral Size class onto its config key", () => {
    expect(ir.size).toBe('extended2');
  });

  test("reads the combined MOVEMENT line", () => {
    expect(ir.movement).toMatchObject({ ground: 40, aerial: 30, swim: null, climb: null });
  });

  test("reads space-separated Essences and Defenses", () => {
    expect(ir.essences).toEqual({ strength: 12, speed: 9, smarts: 7, social: 4 });
    expect(ir.defenses.toughness).toBe(28);
  });

  test("reads Conditioning as a flat value, not a skill", () => {
    expect(ir.conditioning).toBe(2);
    expect(ir.skills.some(skill => skill.key === 'conditioning')).toBe(false);
  });

  test("finds the section under the ligature-split AT TACKS heading", () => {
    expect(ir.attacks).toHaveLength(1);
  });

  test("reads a reach multiplier, hands and traits", () => {
    expect(ir.attacks[0]).toMatchObject({
      name: 'Oxide Blade', skill: 'finesse', damageValue: 5, damageType: 'sharp', numHands: 1,
    });
    expect(ir.attacks[0].range.reachMultiplier).toBe(2);
    expect(ir.attacks[0].traits).toEqual(expect.arrayContaining(['acid', 'sharp', 'silent']));
  });

  test("reads an Alternate Effect as its own damage clause", () => {
    expect(ir.attacks[0].alternateEffects[0]).toMatchObject({ damageValue: 2, damageType: 'acid' });
  });

  test("reads a semicolon-separated Power parenthetical", () => {
    expect(ir.powers[0]).toMatchObject({ usesPer: 1, usesInterval: 'perScene', actionType: 'standard' });
  });

  test("reads an armour bonus out of the Equipment section", () => {
    expect(ir.equipment[0]).toMatchObject({ kind: 'armor', bonus: { value: 4, defense: 'toughness' } });
  });

  test("raises no error-severity diagnostics", () => {
    expect(ir.diagnostics.filter(d => d.severity === 'error')).toEqual([]);
  });
});

describe("parseStatBlock - G.I. JOE vehicle dialect", () => {
  const ir = parseStatBlock(DIALECT_C);

  test("reads '--' Essences and Defenses as null rather than zero", () => {
    expect(ir.essences).toEqual({ strength: 3, speed: 2, smarts: null, social: null });
    expect(ir.defenses).toEqual({ toughness: 14, evasion: 12, willpower: null, cleverness: null });
  });

  test("reads a single combined movement type with a space before the unit", () => {
    expect(ir.movement.ground).toBe(50);
  });

  test("reads colon-separated bulleted skills", () => {
    expect(ir.skills).toContainEqual({
      key: 'brawn', shift: 'd2', modifier: 0, isSpecialized: false, specialization: null,
    });
  });

  test("reads a minimum range and a Blast shape off a wrapped attack line", () => {
    expect(ir.attacks[0]).toMatchObject({
      name: 'Mortar Pod', skill: 'targeting', damageValue: 2, damageType: 'sharp',
      radius: 15, shape: 'burst',
    });
    expect(ir.attacks[0].range).toMatchObject({ value: 90, long: 180, min: 25 });
  });

  test("reads traits attached to the attack by a following bullet", () => {
    expect(ir.attacks[0].traits).toEqual(expect.arrayContaining(['antiTank']));
  });

  test("resolves a vehicle trait printed alongside weapon traits", () => {
    const ram = parseStatBlock([
      'Rig',
      'THREAT LEVEL: 2',
      'ATTACKS',
      "• Ram (Might): +d4 or driver's Driving Skill, Reach (Toughness, 2 Blunt Damage)",
      '• Traits: Blunt, Drive-By',
    ].join('\n'));

    expect(ram.attacks[0].traits).toEqual(expect.arrayContaining(['blunt', 'driveBy']));
    expect(ram.attacks[0].defenseType).toBe('toughness');
    expect(ram.diagnostics.filter(d => d.message.includes('trait'))).toEqual([]);
  });
});

describe("parseStatBlock - diagnostics", () => {
  test("reports an empty paste as an error instead of throwing", () => {
    const ir = parseStatBlock('   \n  \n');
    expect(ir.diagnostics[0]).toMatchObject({ severity: 'error' });
  });

  test("flags an unrecognized Size class", () => {
    const ir = parseStatBlock('Thing\nTHREAT LEVEL: 1\nSIZE: Enormous | HEALTH: 2');
    expect(ir.size).toBeNull();
    expect(ir.diagnostics.some(d => d.severity === 'error' && d.message.includes('Enormous'))).toBe(true);
  });

  test("flags an unrecognized skill that no attack can vouch for", () => {
    const ir = parseStatBlock('Thing\nTHREAT LEVEL: 1\nSKILLS\nWaffling +d4');
    expect(ir.diagnostics.some(d => d.severity === 'error' && d.message.includes('Waffling'))).toBe(true);
  });

  test("adopts an unknown skill label's real skill from the attack of the same name", () => {
    const ir = parseStatBlock([
      'Duelist',
      'THREAT LEVEL: 5',
      'SKILLS',
      'Bladework (Parry) +d8*',
      'ATTACKS',
      'Bladework (Finesse): +d8*, Reach (2 Sharp damage)',
    ].join('\n'));

    expect(ir.skills).toContainEqual({
      key: 'finesse', shift: 'd8', modifier: 0, isSpecialized: true, specialization: 'Bladework',
    });

    const note = ir.diagnostics.find(d => d.message.includes('not in E20.skills'));
    expect(note).toMatchObject({ severity: 'info' });
    expect(note.message).toContain('"finesse"');
  });

  test("flags an unrecognized weapon trait without dropping the attack", () => {
    const ir = parseStatBlock('Thing\nTHREAT LEVEL: 1\nATTACKS\nZap (Targeting): +d4, Range 10ft/20ft (1 Sharp damage)\nTraits: Nonsensical');
    expect(ir.attacks).toHaveLength(1);
    expect(ir.diagnostics.some(d => d.severity === 'warning' && d.message.includes('Nonsensical'))).toBe(true);
  });

  test("never throws on arbitrary prose", () => {
    expect(() => parseStatBlock('Just some words that are not a stat block at all.')).not.toThrow();
  });
});
