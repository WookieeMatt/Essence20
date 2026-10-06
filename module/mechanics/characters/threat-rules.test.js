import {
  allowedSizes, applyQuickPerks, appropriateThreatLevel, auditThreat, buildThreatIr, defaultRulesetFor,
  defenseSpread, essenceBudget, essencesFromSkills, skillGuideFor, extraMovementRate, inferThreatType, maxDamagePerks, perkBudget, skillSpend,
  threatDefenses, threatFromActor, threatGroundMovement, threatHealth, threatLevelForEssence, threatLevelForRole,
} from './threat-rules.mjs';

describe('threatHealth (Field Guide p.146-147)', () => {
  test('Typical = TL, Resilient x1.5, Canny x0.75 rounded up, Canny at least 1', () => {
    expect(threatHealth(10, 'typical')).toBe(10);
    expect(threatHealth(5, 'resilient')).toBe(8);
    expect(threatHealth(5, 'canny')).toBe(4);
    expect(threatHealth(1, 'canny')).toBe(1);
  });

  test('TL 0 is capped at 2 Health', () => {
    expect(threatHealth(0, 'resilient')).toBeLessThanOrEqual(2);
    expect(threatHealth(0, 'canny')).toBe(1);
  });
});

describe('movement', () => {
  test('Typical 40ft, Resilient and Canny 30ft', () => {
    expect(threatGroundMovement('typical')).toBe(40);
    expect(threatGroundMovement('resilient')).toBe(30);
    expect(threatGroundMovement('canny')).toBe(30);
  });

  test("Finster's trades 5ft of Ground per extra Movement type", () => {
    expect(threatGroundMovement('typical', { ruleset: 'finster', extraTypes: 2 })).toBe(30);
    expect(threatGroundMovement('typical', { ruleset: 'fieldGuide', extraTypes: 2 })).toBe(40);
  });

  test('the Perk-bought movement types (Field Guide p.148)', () => {
    expect(extraMovementRate('swim', 30)).toBe(60);
    expect(extraMovementRate('aerial', 30)).toBe(20);
    expect(extraMovementRate('climb', 30)).toBe(30);
  });
});

describe('allowedSizes', () => {
  test('Resilient Small-Large, others Small or Common; only the Field Guide sets this', () => {
    expect(allowedSizes('resilient')).toEqual(['small', 'common', 'large']);
    expect(allowedSizes('canny')).toEqual(['small', 'common']);
    expect(allowedSizes('typical', 'finster')).toBeNull();
  });
});

describe('essenceBudget', () => {
  test('TL x 2 + 6 (TL9 has 24, per the Field Guide example)', () => {
    expect(essenceBudget({ tl: 9 }).total).toBe(24);
    expect(essenceBudget({ tl: 0 }).total).toBe(6);
  });

  test("a social TL10 Threat has 33, 7 of them for Smarts and Social (Field Guide p.147's example)", () => {
    const budget = essenceBudget({ tl: 10, social: true });
    expect(budget.total).toBe(33);
    expect(budget.social).toBe(7);
    expect(essenceBudget({ tl: 20, social: true }).social).toBe(17);
    expect(essenceBudget({ tl: 0, social: true }).social).toBe(0);
  });

  test("Finster's Advanced Threats: up to TL - 3 extra from TL4 (17 at TL20)", () => {
    expect(essenceBudget({ tl: 20, ruleset: 'finster', advanced: 99 }).advanced).toBe(17);
    expect(essenceBudget({ tl: 3, ruleset: 'finster', advanced: 5 }).advanced).toBe(0);
    expect(essenceBudget({ tl: 5, ruleset: 'fieldGuide', advanced: 5 }).advanced).toBe(0);
  });

  test('vehicles: TL + 3 without an A.I., the ordinary formula with one', () => {
    expect(essenceBudget({ tl: 4, ruleset: 'vehicle' }).total).toBe(7);
    expect(essenceBudget({ tl: 4, ruleset: 'vehicle', vehicleAi: true }).total).toBe(14);
  });

  test('the reverse formula', () => {
    expect(threatLevelForEssence(24)).toBe(9);
    expect(threatLevelForEssence(7, { ruleset: 'vehicle' })).toBe(4);
  });
});

describe('perkBudget', () => {
  test('Field Guide: one at TL1, then every 4/3/2 levels by type, +1 per Hang-Up up to two', () => {
    expect(perkBudget({ tl: 0 }).perks).toBe(0);
    expect(perkBudget({ tl: 1, type: 'typical' }).perks).toBe(1);
    expect(perkBudget({ tl: 6, type: 'typical' }).perks).toBe(3);
    expect(perkBudget({ tl: 8, type: 'resilient' }).perks).toBe(3);
    expect(perkBudget({ tl: 8, type: 'canny' }).perks).toBe(5);
    expect(perkBudget({ tl: 8, type: 'canny', hangUps: 5 }).perks).toBe(7);
    expect(perkBudget({ tl: 1 }).includesPowers).toBe(true);
  });

  test("Finster's: 1 + every 4 levels, Resilient -1, Canny +1, Powers separate", () => {
    expect(perkBudget({ tl: 0, ruleset: 'finster' }).perks).toBe(1);
    expect(perkBudget({ tl: 8, ruleset: 'finster', type: 'canny' }).perks).toBe(4);
    expect(perkBudget({ tl: 2, ruleset: 'finster', type: 'resilient' }).perks).toBe(0);
    expect(perkBudget({ tl: 2, ruleset: 'finster' }).includesPowers).toBe(false);
  });

  test('Knights of Canterlot: one or two', () => {
    expect(perkBudget({ tl: 9, ruleset: 'canterlot' })).toMatchObject({ perks: 1, max: 2 });
  });
});

describe('skills and defenses', () => {
  test('rank steps, a bought Specialization and Conditioning are spent from their Essence', () => {
    const spend = skillSpend({ skills: { might: { shift: 'd6', specialization: 'Melee' }, targeting: { shift: 'd4' } }, conditioning: 2 });
    expect(spend).toEqual({ strength: 6, speed: 2, smarts: 0, social: 0 });
  });

  test('Defense = 10 + Essence + bonus; spread is highest minus lowest', () => {
    const defenses = threatDefenses({ strength: 2, speed: 2, smarts: 2, social: 2 }, { toughness: 1 });
    // The Field Guide's Security Guard (p.150): Toughness 13 with its +1 vest, the rest 12.
    expect(defenses).toEqual({ toughness: 13, evasion: 12, willpower: 12, cleverness: 12 });
    expect(defenseSpread(defenses)).toBe(1);
  });
});

describe('party and roles', () => {
  test('total PC levels / 4, rounded down (Field Guide p.145)', () => {
    expect(appropriateThreatLevel([7, 7, 7])).toBe(5);
    expect(appropriateThreatLevel([7, 7, 7, 7, 7, 7])).toBe(10);
  });

  test('role presets from the party level', () => {
    expect(threatLevelForRole('lackey', 5)).toBe(3);
    expect(threatLevelForRole('mastermind', 5)).toBe(7);
    expect(threatLevelForRole('lackey', 1)).toBe(0);
  });

  test('defaults by game line', () => {
    expect(defaultRulesetFor('myLittlePony')).toBe('canterlot');
    expect(defaultRulesetFor('powerRangers')).toBe('fieldGuide');
    expect(defaultRulesetFor('')).toBe('fieldGuide');
  });

  test('inferring a Threat type from Health', () => {
    expect(inferThreatType(8, 5)).toBe('resilient');
    expect(inferThreatType(4, 5)).toBe('canny');
    expect(inferThreatType(5, 5)).toBe('typical');
  });
});

describe('quick Perks', () => {
  test('stat changes, and +1 damage is capped by Size', () => {
    const out = applyQuickPerks({ health: 3, size: 'common', movement: { ground: 30 }, attacks: [{ damageValue: 1 }] },
      [{ key: 'health' }, { key: 'size' }, { key: 'aerial' }, { key: 'damage', attack: 0 }]);
    expect(out).toMatchObject({ health: 4, size: 'large', movement: { ground: 30, aerial: 20 }, attacks: [{ damageValue: 2 }] });
    expect(maxDamagePerks('small')).toBe(0);
    expect(maxDamagePerks('gigantic')).toBe(4);
  });
});

const guard = () => ({
  ruleset: 'fieldGuide', type: 'typical', tl: 1, size: 'common', health: 1,
  essences: { strength: 2, speed: 2, smarts: 2, social: 2 },
  skills: { alertness: { shift: 'd4' }, might: { shift: 'd4' }, persuasion: { shift: 'd4' }, targeting: { shift: 'd4' }, initiative: { shift: 'd20' } },
  defenses: { toughness: 13, evasion: 12, willpower: 12, cleverness: 12 },
  perks: 0, powers: 1, hangUps: 1,
  attacks: [{ melee: false }, { melee: true }],
});

describe('auditThreat', () => {
  test("the Field Guide's own Security Guard follows its rules apart from Initiative", () => {
    // TL1 Typical: 8 Essence, Health 1, 1 Perk + 1 for its Hang-Up = 2, spent on 1 Power.
    const keys = auditThreat(guard()).map(f => f.key);
    expect(keys).toEqual(['NoInitiative', 'PerksUnder']);
  });

  test('flags Essence over budget with the Threat Level the total fits', () => {
    const threat = { ...guard(), essences: { strength: 6, speed: 4, smarts: 3, social: 3 } };
    const finding = auditThreat(threat).find(f => f.key == 'EssenceOver');
    expect(finding.data).toMatchObject({ total: 16, budget: 8, fits: 5 });
  });

  test('flags overspent skills, a zero Essence, too many Perks and no attacks', () => {
    const threat = { ...guard(), essences: { strength: 1, speed: 3, smarts: 4, social: 0 }, skills: { might: { shift: 'd6' } }, perks: 4, attacks: [] };
    const keys = auditThreat(threat).map(f => f.key);
    expect(keys).toEqual(expect.arrayContaining(['EssenceZero', 'SkillsOver', 'PerksOver', 'NoAttacks']));
  });

  test("Finster's wants a Hang-Up; the Field Guide caps them at two", () => {
    expect(auditThreat({ ...guard(), ruleset: 'finster', hangUps: 0 }).map(f => f.key)).toContain('HangUpsUnder');
    expect(auditThreat({ ...guard(), hangUps: 3 }).map(f => f.key)).toContain('HangUpsOver');
  });
});

describe('threatFromActor', () => {
  test('reads a stored build, or infers the type', () => {
    const actor = {
      type: 'npc',
      system: {
        threatLevel: 5, size: 'common', conditioning: 1, health: { max: 9 },
        essences: { strength: { max: 5 }, speed: { max: 4 }, smarts: { max: 3 }, social: { max: 4 } },
        skills: { might: { shift: 'd6', specializations: { melee: { granted: false } } } },
        defenses: { toughness: { total: 15 }, evasion: { total: 14 }, willpower: { total: 13 }, cleverness: { total: 14 } },
      },
      flags: {},
      items: [
        { id: 'w1', type: 'weapon', name: 'Claw' },
        { type: 'weaponEffect', flags: { essence20: { parentId: 'w1' } }, system: { range: { value: null } } },
        { type: 'perk', system: { type: 'general' } },
        { type: 'hangUp' },
      ],
    };
    const threat = threatFromActor(actor);
    expect(threat).toMatchObject({ ruleset: 'fieldGuide', type: 'resilient', typeInferred: true, tl: 5, healthBonus: 1, perks: 1, hangUps: 1 });
    expect(threat.skills.might).toEqual({ shift: 'd6', specialization: 'yes' });
    expect(threat.attacks).toEqual([{ name: 'Claw', melee: true }]);
    expect(threatFromActor({ ...actor, flags: { essence20: { threatBuild: { ruleset: 'finster', type: 'canny', healthPerks: 2 } } } })).toMatchObject({ ruleset: 'finster', type: 'canny', typeInferred: false, healthBonus: 3 });
  });
});

describe('buildThreatIr', () => {
  test("produces the importer's IR, with quick Perks applied and Conditioning in Health", () => {
    const ir = buildThreatIr({
      name: 'Gladiator Pig', ruleset: 'fieldGuide', type: 'resilient', tl: 4, size: 'common', conditioning: 1,
      essences: { strength: 6, speed: 3, smarts: 2, social: 3 },
      skills: { might: { shift: 'd6', specialization: 'Grapple' }, initiative: { shift: 'd2' }, culture: { shift: 'd20' } },
      movementTypes: { swim: true },
      quickPerks: [{ key: 'health' }, { key: 'damage', attack: 0 }],
      customPerks: [{ name: 'Crowd Pleaser', text: 'Edge on Performance.' }, { name: '' }],
      customPowers: [{ name: 'Roar', text: 'Frightens.', actionType: 'standard' }],
      customHangUps: [{ name: 'Hungry', text: 'Distracted by food.' }],
      attacks: [{ name: 'Tusks', melee: true, damageValue: 2, damageType: 'sharp' }, { name: 'Thrown Plate', melee: false, range: 20 }],
    }, { quickPerk: { health: '+1 Health', damage: '+1 Damage' } });

    expect(ir).toMatchObject({
      name: 'Gladiator Pig', threatLevel: 4, size: 'common', conditioning: 1,
      // Resilient TL4 = 6 Health, +1 from the quick Perk, +1 Conditioning printed in.
      health: 8,
      movement: { ground: 30, swim: 60 },
      defenses: { toughness: 16, evasion: 13, willpower: 12, cleverness: 13 },
    });
    expect(ir.skills.map(s => s.key)).toEqual(['might', 'initiative']);
    expect(ir.skills[0]).toMatchObject({ isSpecialized: true, specialization: 'Grapple' });
    expect(ir.perks.map(p => p.name)).toEqual(['+1 Health', '+1 Damage', 'Crowd Pleaser']);
    expect(ir.powers).toEqual([expect.objectContaining({ name: 'Roar', actionType: 'standard' })]);
    expect(ir.hangUps).toHaveLength(1);
    expect(ir.attacks[0]).toMatchObject({ name: 'Tusks', isReach: true, damageValue: 3, damageType: 'sharp', skill: 'might' });
    expect(ir.attacks[1]).toMatchObject({ isReach: false, skill: 'targeting', range: { value: 20 } });
  });
});

describe("the developers' threat spreadsheet", () => {
  test('Animal Threats have 75% of the Essence points, rounded down', () => {
    expect(essenceBudget({ tl: 1, animal: true }).total).toBe(6);
    expect(essenceBudget({ tl: 2, animal: true }).total).toBe(7);
    expect(essenceBudget({ tl: 4, ruleset: 'vehicle', animal: true }).total).toBe(7);
  });

  test('Essences worked out from the skills under them', () => {
    expect(essencesFromSkills({ skills: { athletics: { shift: 'd4' }, might: { shift: 'd6' }, alertness: { shift: 'd2' } }, conditioning: 1 }))
      .toEqual({ strength: 6, speed: 0, smarts: 1, social: 0 });
  });

  test('typical and max skill die by level', () => {
    expect(skillGuideFor(1)).toEqual({ typical: 'd2', max: 'd6' });
    expect(skillGuideFor(5)).toEqual({ typical: 'd6', max: 'd10' });
    expect(skillGuideFor(20)).toEqual({ typical: 'd12', max: 'd12' });
  });

  test('the audit notes skills above the max for the level', () => {
    const finding = auditThreat({ ...guard(), skills: { ...guard().skills, might: { shift: 'd10' } } }).find(f => f.key == 'SkillsAboveGuide');
    expect(finding.data).toEqual({ skills: ['might'], max: 'd6' });
  });
});
