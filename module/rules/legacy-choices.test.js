import { legacyChoiceUpdates } from './legacy-choices.mjs';

const item = (id, source, flags = {}) => ({ id, name: id, flags: { essence20: flags }, _stats: { compendiumSource: `Compendium.essence20.x.Item.${source}` } });

test('old picks move into rule choices; choices already made are kept', () => {
  const spell = { id: 's1', name: 'Fireball', flags: {} };
  const items = [
    item('mastery', 'DyIbIDlzOJX5GiO2', { mastery: { tier: 'elementary', circle: 'beam' } }),
    item('focus', 'xNXlgRyE6Jpc4lnm', { spellFocus: ['s1'] }),
    item('traveler', 'goE0NFHWUPhxjaq1', { place: 'Yakyakistan', rules: { choices: { place: 'Already set' } } }),
    item('means', 'llLxndbUKCtKIUMW', { gij3MeansSkills: ['might', 'finesse', 'technology', 'deception'] }),
    item('cover', '3SiGvDR98s0FQtdf', { gij1Choice: { skill: 'persuasion', text: 'Lawyer' } }),
    item('double', 'Bl14FV81J88Um0Ls', { gij1Choice: { skill: 'science', text: 'Chemistry' } }),
    item('plain', 'zzzzzzzzzzzzzzzz'),
    spell,
  ];
  const actor = { items: Object.assign(items, { get: id => items.find(i => i.id == id) }) };
  expect(legacyChoiceUpdates(actor)).toEqual([
    { _id: 'mastery', 'flags.essence20.rules.choices.tier': 'elementary', 'flags.essence20.rules.choices.circle': 'beam' },
    { _id: 'focus', 'flags.essence20.rules.choices.spell': 'Fireball' },
    {
      _id: 'means', 'flags.essence20.rules.choices.strength': 'might', 'flags.essence20.rules.choices.speed': 'finesse',
      'flags.essence20.rules.choices.smarts': 'technology', 'flags.essence20.rules.choices.social': 'deception',
    },
    { _id: 'cover', 'flags.essence20.rules.choices.skill': 'persuasion', 'flags.essence20.rules.choices.profession': 'Lawyer' },
    { _id: 'double', 'flags.essence20.rules.choices.skill': 'science', 'flags.essence20.rules.choices.spec': 'Chemistry' },
  ]);
});
