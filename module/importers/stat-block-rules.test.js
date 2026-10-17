import { addRulesFromText, rulesFromText } from "./stat-block-rules.mjs";

/** Plain "↓1 to Social Skill Tests" sentences on pasted Perks / Hang-Ups become Roll Modifier rules (made-up text). */

test("a downshift to an Essence's Skill Tests, with what follows as the reason", () => {
  expect(rulesFromText('Aloof', 'He suffers ↓1 to all Social Skill Tests with other Decepticons, including his team.')).toEqual([{
    type: 'RollModifier', label: 'Aloof (with other Decepticons, including his team)', when: ['essence:social'], downshift: 1,
  }]);
});

test("a paste that lost its arrow: the verb decides up or down", () => {
  expect(rulesFromText('Aloof', 'He suffers 1 to all Social Skill Tests.')[0]).toMatchObject({ downshift: 1, label: 'Aloof' });
  expect(rulesFromText('Keen', 'She gains 2 on Alertness Skill Tests.')[0]).toMatchObject({ upshift: 2, when: ['skill:alertness'] });
});

test("Edge / Snag, and a list of Skills", () => {
  expect(rulesFromText('Smooth', 'Has Edge on Deception and Persuasion Skill Tests.')[0]).toMatchObject({
    edge: true, when: [{ any: ['skill:deception', 'skill:persuasion'] }],
  });
  expect(rulesFromText('Clumsy', 'Suffers a Snag on Athletics Skill Tests')[0]).toMatchObject({ snag: true, when: ['skill:athletics'] });
});

test("anything else is left as text", () => {
  expect(rulesFromText('Odd', 'He suffers 1 to all Juggling Skill Tests.')).toEqual([]);
  expect(rulesFromText('Odd', 'Gains 2 on ranged attacks against targets far away.')).toEqual([]);
});

test("only bare items get rules - never a compendium copy or one that has its own", () => {
  const items = [
    { name: 'Aloof', type: 'hangUp', system: { description: 'Suffers 1 to all Social Skill Tests.' } },
    { name: 'Copy', type: 'perk', _stats: { compendiumSource: 'Compendium.x' }, system: { description: 'Gains 1 on Might Skill Tests.' } },
    { name: 'Gun', type: 'weapon', system: { description: 'Gains 1 on Might Skill Tests.' } },
  ];
  expect(addRulesFromText(items)).toBe(1);
  expect(items[0].system.rules).toHaveLength(1);
  expect(items[1].system.rules).toBeUndefined();
});

test('"Smarts-based Skill Tests" is every Skill of that Essence', () => {
  expect(rulesFromText('Bungling', 'He suffers Snag on all Smarts-based Skill Tests and takes 1 on others.')[0]).toMatchObject({ snag: true, when: ['essence:smarts'], label: 'Bungling' });
});
