import { parseStatBlock, splitStatBlocks } from "./stat-block-parser.mjs";
import { irToStatBlockText } from "./stat-block-export.mjs";

const BLOCK = `Gravel Golem
THREAT LEVEL: 6
SIZE: LARGE | HEALTH: 8
GROUND MOVEMENT: 30ft | AERIAL
MOVEMENT: 45ft
STRENGTH: 5 | SPEED: 4
SMARTS: 2 | SOCIAL: 1
TOUGHNESS: 15 | EVASION: 14
WILLPOWER: 12 | CLEVERNESS: 11
SKILLS
Alertness (Insight) +d4*
Conditioning +3
Initiative +d4
Languages: English, Putty
PERKS
Stone Skin: Reduces all incoming damage by 1.
ATTACKS
Boulder Toss (Might): +d6*, Reach x2 (1 Blunt damage)
Grit Spray (Targeting): +d4, Range 20ft/40ft (1 Energy damage)
POWERS
Quarry Quake (2/scene, Standard): The golem stamps the ground.
HANG-UPS
Slow to Start: Cannot take a Move action on the first round.`;

const ir = parseStatBlock(BLOCK);
const text = irToStatBlockText(ir);

describe("irToStatBlockText", () => {
  test("writes the header in the printed pipe-separated layout", () => {
    expect(text).toContain('THREAT LEVEL: 6');
    expect(text).toContain('SIZE: LARGE | HEALTH: 8');
    expect(text).toContain('STRENGTH: 5 | SPEED: 4');
    expect(text).toContain('TOUGHNESS: 15 | EVASION: 14');
  });

  test("writes every movement type it has", () => {
    expect(text).toContain('MOVEMENT: 30ft Ground; 45ft Aerial');
  });

  test("writes Conditioning, skills with their specialization, and languages", () => {
    expect(text).toContain('Conditioning +3');
    expect(text).toContain('Alertness (Insight) +d4*');
    expect(text).toContain('Languages: English, Putty');
  });

  test("writes a reach multiplier and a printed range", () => {
    expect(text).toContain('Reach x2');
    expect(text).toContain('Range 20ft/40ft');
  });

  test("writes a Power's uses and action back into its parenthetical", () => {
    expect(text).toContain('Quarry Quake (2/scene, Standard):');
  });

  test("emits '--' for a stat the actor type does not have", () => {
    const vehicle = parseStatBlock([
      'Rig', 'THREAT LEVEL: 2', 'SIZE: Large | HEALTH: 4',
      'STRENGTH: 3 | SPEED: 2 | SMARTS: -- | SOCIAL: --',
      'TOUGHNESS: 13 | EVASION: 12', 'WILLPOWER: -- | CLEVERNESS: --',
    ].join('\n'));
    expect(irToStatBlockText(vehicle)).toContain('WILLPOWER: -- | CLEVERNESS: --');
  });

  test("omits a section the block has nothing for", () => {
    expect(irToStatBlockText({ name: 'Blank' })).not.toContain('PERKS');
  });

  test("returns an empty string for no IR at all", () => {
    expect(irToStatBlockText(null)).toBe('');
  });
});

describe("round trip", () => {
  /*
   * The real test of the exporter: what it writes, the parser reads back to the same thing. This
   * is what makes "share your homebrew Threat as text" actually work.
   */
  const reparsed = parseStatBlock(text);

  test("recovers the header scalars", () => {
    expect(reparsed).toMatchObject({
      name: 'Gravel Golem', threatLevel: 6, size: 'large', health: 8, conditioning: 3,
    });
  });

  test("recovers Essences and Defenses", () => {
    expect(reparsed.essences).toEqual(ir.essences);
    expect(reparsed.defenses).toEqual(ir.defenses);
  });

  test("recovers movement and languages", () => {
    expect(reparsed.movement).toEqual(ir.movement);
    expect(reparsed.languages).toEqual(ir.languages);
  });

  test("recovers every skill with its shift and specialization", () => {
    expect(reparsed.skills).toEqual(ir.skills);
  });

  test("recovers attacks with their damage and ranges", () => {
    expect(reparsed.attacks.map(a => ({
      name: a.name, skill: a.skill, damageValue: a.damageValue, damageType: a.damageType,
      value: a.range.value, reach: a.range.reachMultiplier,
    }))).toEqual(ir.attacks.map(a => ({
      name: a.name, skill: a.skill, damageValue: a.damageValue, damageType: a.damageType,
      value: a.range.value, reach: a.range.reachMultiplier,
    })));
  });

  test("recovers Perks, Powers and Hang-Ups", () => {
    expect(reparsed.perks).toEqual(ir.perks);
    expect(reparsed.powers).toEqual(ir.powers);
    expect(reparsed.hangUps).toEqual(ir.hangUps);
  });

  test("reads back with no error diagnostics", () => {
    expect(reparsed.diagnostics.filter(d => d.severity === 'error')).toEqual([]);
  });
});

describe("splitStatBlocks", () => {
  test("returns a single chunk for an ordinary one-block paste", () => {
    expect(splitStatBlocks(BLOCK)).toHaveLength(1);
  });

  test("returns nothing for an empty paste", () => {
    expect(splitStatBlocks('   \n  ')).toEqual([]);
  });

  test("splits several blocks and keeps each name with its own block", () => {
    const blocks = splitStatBlocks([BLOCK, BLOCK.replace('Gravel Golem', 'Rust Wraith')].join('\n'));
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toContain('Gravel Golem');
    expect(blocks[1].startsWith('Rust Wraith')).toBe(true);
    expect(blocks[1]).not.toContain('Gravel Golem');
  });

  test("each split chunk parses on its own", () => {
    const blocks = splitStatBlocks([BLOCK, BLOCK.replace('Gravel Golem', 'Rust Wraith')].join('\n'));
    const parsed = blocks.map(parseStatBlock);
    expect(parsed.map(p => p.name)).toEqual(['Gravel Golem', 'Rust Wraith']);
    expect(parsed.every(p => p.threatLevel === 6)).toBe(true);
    expect(parsed.every(p => p.attacks.length === 2)).toBe(true);
  });

  test("keeps page furniture above the first block out of the second", () => {
    const withHeader = `POWER RANGERS ROLEPLAYING GAME - CHAPTER 13: THREATS216\n${BLOCK}`;
    const blocks = splitStatBlocks([withHeader, BLOCK.replace('Gravel Golem', 'Rust Wraith')].join('\n'));
    expect(blocks[0]).toContain('Gravel Golem');
    expect(blocks[0]).not.toContain('ROLEPLAYING GAME');
  });
});
