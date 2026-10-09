import { parseStatBlock } from "./stat-block-parser.mjs";
import { buildActorData, buildSimpleItems, buildWeaponData, collectEffectContributions } from "./stat-block-import.mjs";

/** Power Rangers Zord stat blocks (PR CRB Ch.9 layout) - a made-up Zord, not a book one. */

const block = [
  'Test Dinozord',
  'As Linked to a 6th-level Test Ranger',
  'SIZE Gigantic | HEALTH 8',
  'STRENGTH 9 | SPEED 4 | SMARTS * | SOCIAL *',
  'TOUGHNESS 21 (2 Plating Armor) | EVASION 14',
  'GROUND MOVEMENT 40ft | AERIAL MOVEMENT',
  '60ft (30ft)',
  'Skills: Conditioning +4, Driving (Autopilot) +d2,',
  'Might +d10, Targeting +d6',
  'Zord Features: Call to Action, Combiner (Core Ability',
  'Speed), Increase (Strength), Enhanced (Claws)',
  'Claws (Might): +d10 or pilot\'s Driving, Reach',
  '(2 Sharp damage)',
  'Big Swing (1/scene, Might): +d10 with ↓1 or pilot\'s Driving with ↓1, Reach ×2 (9 Sharp damage)',
].join('\n');

test("the colonless header, the inline lists and the headless attacks all read", () => {
  const ir = parseStatBlock(block);
  expect(ir).toMatchObject({
    name: 'Test Dinozord', size: 'gigantic', health: 8, conditioning: 4, suggestedType: 'zord',
    essences: { strength: 9, speed: 4, smarts: null, social: null },
    defenses: { toughness: 21, evasion: 14 }, armor: { toughness: 2 },
    movement: { ground: 40, aerial: 60 },
  });
  expect(ir.skills.map(skill => `${skill.key}${skill.shift}`)).toEqual(['drivingd2', 'mightd10', 'targetingd6']);
  expect(ir.zordFeatures.map(feature => feature.name)).toEqual(['Call to Action', 'Combiner (Core Ability Speed)', 'Increase (Strength)', 'Enhanced (Claws)']);
  expect(ir.zordFeatures[2].matchNames).toContain('Increase (Essence)');
  expect(ir.zordFeatures[3].matchNames).toContain('Enhance (Attack)');
  expect(ir.megaformTraits).toEqual([{ name: 'Core Ability Speed', text: '', matchNames: ['Core Ability Speed', 'Core Ability'], overrides: { system: { essence: 'speed', skill: null }, flags: {} } }]);
  expect(ir.attacks.map(attack => attack.name)).toEqual(['Claws', 'Big Swing']);
  expect(ir.attacks[1]).toMatchObject({ skill: 'might', usesPerScene: 1, shiftDown: 1, damageValue: 9, range: { reachMultiplier: 2 } });
  expect(ir.diagnostics.filter(entry => entry.severity != 'info')).toEqual([]);
});

test("it builds as a Zord: Plating Armor in the armor, Features and the Megaform Trait as items", () => {
  const ir = parseStatBlock(block);
  const actor = buildActorData(ir, { type: 'zord' });
  expect(actor.system.defenses.toughness).toEqual({ armor: 2, bonus: 0 });
  expect(actor.system.essences.strength).toEqual({ value: 9 });
  const items = buildSimpleItems(ir, { type: 'zord' });
  expect(items.filter(item => item.type == 'feature').map(item => item.name)).toHaveLength(4);
  expect(items.filter(item => item.type == 'megaformTrait').map(item => item.name)).toEqual(['Core Ability Speed']);
  const { weapon, effects } = buildWeaponData(ir.attacks[1]);
  expect(weapon.system.usesPerScene).toBe(1);
  expect(effects[0].system.shiftDown).toBe(1);
});

test("a matched Feature's Essence bonus (Heavy Chassis +1 Strength) comes back out of the printed Essence", () => {
  const ir = parseStatBlock(block);
  const heavy = { name: 'Heavy Chassis', effects: [{ changes: [{ key: 'system.essences.strength.value', mode: 2, value: '1' }] }] };
  const contributions = collectEffectContributions([heavy]);
  expect(contributions.essences).toEqual({ strength: 1 });
  expect(buildActorData(ir, { type: 'zord', effectContributions: contributions }).system.essences.strength).toEqual({ value: 8 });
});

test("an Alternate Effect's ↓ reads however the PDF copy gave the arrow, and it fires at the weapon's range", () => {
  // "↓", Enigma of Combination's symbol-font arrow, nothing, a space, a stand-in character.
  for (const arrow of ['↓', '', '', ' ', '?', '�']) {
    const ir = parseStatBlock(['Gun Bot', 'THREAT LEVEL: 2', 'ATTACKS',
      'Rifle (Targeting): +d8, Range 150ft/600ft; min. 30ft (1 Sharp damage)',
      `Alternate Effects: 2 Sharp damage (${arrow}1), 3 Sharp damage (${arrow}3)`].join('\n'));
    const [first, second] = ir.attacks[0].alternateEffects;
    expect([first.shiftDown, second.shiftDown]).toEqual([1, 3]);
    expect(first.range).toEqual({ value: 150, long: 600, min: 30, reachMultiplier: null });
  }

  const up = parseStatBlock(['Gun Bot', 'THREAT LEVEL: 2', 'ATTACKS', 'Rifle (Targeting): +d8, Reach (1 Sharp damage)',
    'Alternate Effects: 2 Sharp damage (↑1)'].join('\n'));
  expect(up.attacks[0].alternateEffects[0]).toMatchObject({ shiftDown: 0, isReach: true });

  // The ↓ sharing its bracket with the range, and a target count that isn't one.
  const rotor = parseStatBlock(['Copter', 'THREAT LEVEL: 2', 'ATTACKS', 'Rotor Blades (Finesse): +d6, Reach (2 Sharp damage)',
    'Alternate Effects: 2 Sharp damage—Multiple (2) Targets (Reach, ↓1)', 'Hands: 2'].join('\n'));
  expect(rotor.attacks[0].alternateEffects[0]).toMatchObject({ shiftDown: 1, numTargets: 2, isReach: true, damageValue: 2 });
  const counted = parseStatBlock(['Copter', 'THREAT LEVEL: 2', 'ATTACKS', 'Gun (Targeting): +d6, Range 50ft/100ft (2 Sharp damage)',
    'Alternate Effects: 1 Sharp damage Multiple Targets (2)'].join('\n'));
  expect(counted.attacks[0].alternateEffects[0]).toMatchObject({ shiftDown: 0, numTargets: 2 });
  expect(parseStatBlock(['Bot', 'THREAT LEVEL: 2', 'ATTACKS', 'Fists (Might): +d6, Reach (2 Blunt damage)', 'Alternate Effects: Multi-Weapon (2)'].join(String.fromCharCode(10))).attacks[0].alternateEffects[0].shiftDown).toBe(0);
});
