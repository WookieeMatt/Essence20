import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHECK_NAMES, registerTag, registerTagPhrase, registeredTags, tagPhrase } from './predicate.mjs';
import { CHECK_PHRASE_NAMES, describeTag, describeWhen, formulaFact, humanize, itemClauses, itemName, pathName, setNameLookup } from './describe-when.mjs';
import { summarizeRule } from './types.mjs';

await import('./plugins/index.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/* -------------------------------------------- */
/*  Every pack's `when` tags                     */
/* -------------------------------------------- */

const names = new Map();
const packTags = new Map();
const packRules = [];

function walkWhen(list) {
  for (const entry of Array.isArray(list) ? list : []) {
    if (entry && typeof entry == 'object' && Array.isArray(entry.any)) {
      walkWhen(entry.any);
    } else if (typeof entry == 'string') {
      packTags.set(entry, (packTags.get(entry) ?? 0) + 1);
    }
  }
}

function walk(node) {
  if (Array.isArray(node)) {
    node.forEach(walk);
    return;
  }

  if (!node || typeof node != 'object') {
    return;
  }

  for (const [key, value] of Object.entries(node)) {
    if (key == 'when' && Array.isArray(value)) {
      walkWhen(value);
    } else {
      walk(value);
    }
  }
}

for (const pack of readdirSync(join(ROOT, 'packs'))) {
  const dir = join(ROOT, 'packs', pack, '_source');
  if (!existsSync(dir)) {
    continue;
  }

  for (const file of readdirSync(dir).filter(name => name.endsWith('.json'))) {
    const doc = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    for (const item of Array.isArray(doc.items) ? [doc, ...doc.items] : [doc]) {
      if (item._id && item.name) {
        names.set(item._id, item.name);
      }

      if (Array.isArray(item.system?.rules)) {
        walk(item.system.rules);
        packRules.push(...item.system.rules);
      }
    }
  }
}

beforeAll(() => setNameLookup(ref => names.get(String(ref).split('.').pop()) ?? null));
afterAll(() => setNameLookup(null));

/** What a reader should never see: a `family:` token, a camelCase key, a stored path, a formula or a raw pick. */
const RAW = /\b[a-z]\w*:[\w$]|\b[a-z]+[A-Z]\w*\b|\bsystem\.|\bflags\.|@|[{}]|\bundefined\b|\bnull\b|\bnot while\b|(?:>=|<=|!=|[<>])/;
const unquoted = text => String(text).replace(/"[^"]*"/g, '""');

/* -------------------------------------------- */
/*  Families                                     */
/* -------------------------------------------- */

describe('describeWhen: the roll', () => {
  test('skills, Essences, attacks, Defenses', () => {
    expect(describeWhen(['skill:might'])).toBe('on Might tests');
    expect(describeWhen(['not:skill:animalHandling'])).toBe('except on Animal Handling tests');
    expect(describeWhen(['skill:{choice.skill}'])).toBe('on tests of the chosen Skill');
    expect(describeWhen(['essence:speed', 'essence:{item.choice}'])).toBe('on Speed tests, on tests of the chosen Essence');
    expect(describeWhen(['attack', 'not:attack'])).toBe("on attacks, on rolls that aren't attacks");
    expect(describeWhen(['attack:melee', 'not:attack:unarmed', 'attack:ram'])).toBe('on melee attacks, except on unarmed attacks, on Ram attacks');
    expect(describeWhen(['defense:evasion', 'not:defense:toughness'])).toBe('against Evasion, except against Toughness');
  });

  test('roll facts, dataset flags and switches', () => {
    expect(describeWhen(['roll:initiative', 'not:roll:dataset:isInitiative'])).toBe('on Initiative rolls, except on Initiative rolls');
    expect(describeWhen(['roll:edge', 'not:roll:snag', 'roll:aimed', 'roll:untrained'])).toBe('with an Edge, without a Snag, when Aiming, with an untrained Skill');
    expect(describeWhen(['roll:switch:menacingGlare', 'not:roll:switch:bumpAndRun'])).toBe("if you tick Menacing Glare, if you don't tick Bump and Run");
    expect(describeWhen(['roll:specialization=medicine'])).toBe('with the medicine Specialization');
    expect(describeWhen(['roll:targets>=1', 'roll:targets>=2', 'not:roll:targets=1'])).toBe("if the roll has a target, if the roll has at least 2 targets, if the roll doesn't have exactly 1 target");
    expect(describeWhen(['roll:dataset:shift=d20', 'roll:dataset:o3AgainStep=1'])).toBe("with an untrained Skill, if the roll's again step is 1");
  });

  test('damage, assistance, marks and stored values', () => {
    expect(describeWhen(['damage:fire', 'not:damage:crit', 'damage>=3'])).toBe('if the damage is Fire, unless it is a Critical Success, if the damage is at least 3');
    expect(describeWhen(['assist:skill'])).toBe('when Lending Assistance (skill)');
    expect(describeWhen(['markedBy:outwitted', 'not:markedByMe:primalFear'])).toBe("if the target put the Outwitted mark on you, if you didn't put the Primal Fear mark on the target");
    expect(describeWhen(['var:ok>=1', 'not:var:ok>=1'])).toBe("if that worked, if that didn't work");
    expect(describeWhen(['var:margin>=0', 'var:mode=1', 'not:var:scene'])).toBe("if the margin is at least 0, if the stored mode is 1, if the stored scene isn't set");
  });
});

describe('describeWhen: who it asks about', () => {
  test('self: state, data paths and levels read as "you"', () => {
    expect(describeWhen(['self:morphed', 'not:self:transformed'])).toBe("while you are Morphed, while you aren't in Alt Mode");
    expect(describeWhen(['self:combatant', 'not:self:actionUsed:standard'])).toBe("while you are in the combat, if you haven't taken your Standard action yet");
    expect(describeWhen(['self:actionUsed:move'])).toBe("if you've taken your Move action");
    expect(describeWhen(['self:data:system.movement.ground.total>0'])).toBe('while you have a Ground Movement');
    expect(describeWhen(['not:self:data:system.movement.aerial.base>0'])).toBe('while you have no Aerial Movement');
    expect(describeWhen(['self:data:system.health.value<$system.health.max'])).toBe('while your Health is less than your maximum Health');
    expect(describeWhen(['self:data:system.essences.smarts.value<$system.essences.smarts.max'])).toBe('while your Smarts is less than your maximum Smarts');
    expect(describeWhen(['self:level>=5', 'not:self:level>=7'])).toBe('while your level is at least 5, while your level is less than 7');
    expect(describeWhen(['self:skill:driving>=d2', 'target:skill:weird>d20'])).toBe('while your Driving is at least d2, while the target is trained in Weird');
    expect(describeWhen(['self:data:system.skills.finesse.isSpecialized', 'self:data:type=companion'])).toBe('while you are Specialized in Finesse, if you are a companion');
    expect(describeWhen(['self:data:system.trained.armors.medium', 'self:data:system.traits.computerized'])).toBe('while you are trained in Medium armor, while you have the Computerized trait');
  });

  test('self: items, statuses, marks, toggles, size and type', () => {
    expect(describeWhen(['self:status:prone', 'not:self:status:surprised'])).toBe("while you are Prone, while you aren't Surprised");
    expect(describeWhen(['self:type:zord', 'self:type:playerCharacter'])).toBe('if you are a Zord, if you are a player character');
    expect(describeWhen(['self:marked:overcharge', 'not:self:marked:zord1NinjaElementOn'])).toBe("while you have the Overcharge mark, while you don't have the Ninja Element On mark");
    expect(describeWhen(['self:toggle:on', 'not:self:toggle:granted'])).toBe('while it is switched on, while Granted is switched off');
    expect(describeWhen(['self:hasItem:name~blade', 'self:specializedIn:science'])).toBe('while you have an item named like "blade", while you have a Science Specialization');
    expect(describeWhen(['self:wearing>=medium', 'self:itemCount:armor:equipped<1', 'self:count:perk>=3'])).toBe('while you are wearing Medium armor or heavier, while you have no equipped armor, while you have at least 3 perks');
    expect(describeWhen(['self:size>=huge', 'self:sizeDiff>=1', 'self:hp<half'])).toBe("while your size is at least Huge, if your size is at least 1 above the target's, while you are below half Health");
    expect(describeWhen(['self:wielding', 'self:canTransform', 'self:recklessAbandon'])).toBe('while you are wielding a weapon, while you can change to Alt Mode, while you are acting with Reckless Abandon');
  });

  test('target: and holder: read as "the target" and "its owner"', () => {
    expect(describeWhen(['target:status:stunned', 'not:target:type:vehicle'])).toBe("while the target is Stunned, if the target isn't a vehicle");
    expect(describeWhen(['target:tag:robot', 'not:target:tag:cybertronian'])).toBe("if the target counts as Robot, if the target doesn't count as Cybertronian");
    expect(describeWhen(['target:within:30', 'not:target:self', 'target:ally'])).toBe("if the target is within 30 ft, if the target isn't you, if the target is an ally");
    expect(describeWhen(['target:levelDiff>=1', 'target:notActed'])).toBe("if the target's level is at least 1 above yours, if the target hasn't acted yet this round");
    expect(describeWhen(['holder:morphed', 'not:holder:status:defeated', 'holder:protects'])).toBe("while its owner is Morphed, while its owner isn't Defeated, if you are its Protected Target");
  });
});

describe('describeWhen: items', () => {
  test('item:, weapon:, host: and rule: tags', () => {
    expect(describeWhen(['item:type:weaponEffect', 'weapon:trait:ballistic'])).toBe('if the item is an attack, if the weapon has the Ballistic trait');
    expect(describeWhen(['item:own', 'not:item:own'])).toBe('with this item, with anything but this item');
    expect(describeWhen(['item:damageType:emp', 'item:data:system.classification.style=melee'])).toBe("if the item deals EMP damage, if the item's style is Melee");
    expect(describeWhen(['host:type:armor', 'item:equipped', 'item:name~unarmed'])).toBe('if the item it is attached to is armor, while this item is equipped, if the item\'s name contains "unarmed"');
    expect(describeWhen(['rule:altMode', 'rule:hostEquipped', 'not:rule:banked'])).toBe("while you are in this Alt Mode, while the item it is attached to is equipped, while no bonus this item banked is left");
    expect(describeWhen(['rule:data:system.choice=shipIntegration', 'rule:data:flags.essence20.rules.choices.gem=stealth'])).toBe('if you chose Ship Integration, if you chose Stealth for gem');
    expect(describeWhen(['not:rule:data:flags.essence20.granted', 'rule:granted:type:weapon'])).toBe("if this item isn't granted, while you still have something this item gave you where it is a weapon");
  });

  test('item names resolve through the lookup, else a neutral word', () => {
    setNameLookup(ref => (String(ref).endsWith('abcdefgh12345678') ? 'Test Blade' : null));
    expect(describeWhen(['self:hasItem:Compendium.essence20.x.Item.abcdefgh12345678'])).toBe('while you have Test Blade');
    expect(itemName('Compendium.essence20.x.Item.zzzzzzzzzzzzzzzz')).toBe('a particular item');
    setNameLookup(ref => names.get(String(ref).split('.').pop()) ?? null);
  });

  test('item clause lists, with any-groups', () => {
    expect(itemClauses(['item:type:weapon', { any: ['item:trait:thrown', 'item:name~grenade'] }])).toBe('it is a weapon and either it has the Thrown trait or its name contains "grenade"');
  });
});

describe('describeWhen: the situation', () => {
  test('combat, turns, rounds, sides', () => {
    expect(describeWhen(['combat', 'not:combat', 'combat:exists', 'not:combat:exists'])).toBe('in combat, outside combat, while a combat is set up, while no combat is set up');
    expect(describeWhen(['ownTurn', 'not:ownTurn', 'combat:round:2'])).toBe('on your turn, outside your turn, in round 2');
    expect(describeWhen(['combat:enemyStatus:surprised', 'combat:highestInitiative', 'combat:aheadOfTarget'])).toBe("while an enemy in the fight is Surprised, if you have the highest Initiative, if your Initiative is higher than the target's");
    expect(describeWhen(['combat:enemy:target:type:npc'])).toBe('while an enemy in the fight is an NPC');
    expect(describeWhen(['ally:within:30', 'not:enemy:within:5'])).toBe('with an ally within 30 ft, with no enemy within 5 ft');
  });

  test('vehicles, terrain, environment, scenes, ask', () => {
    expect(describeWhen(['vehicle:driving', 'not:vehicle:crew', 'vehicle:type:zord', 'vehicle:moves:aerial'])).toBe("while you drive a vehicle, while you don't crew a vehicle, while you crew a Zord, while the vehicle you crew has Aerial Movement");
    expect(describeWhen(['terrain:urban', 'not:terrain:set', 'terrain:wild'])).toBe("in Urban terrain, if the terrain isn't set, in the wild");
    expect(describeWhen(['environment:lowGravity', 'environment:vacuum', 'environment:extremeHeat'])).toBe('in low gravity, in a vacuum, in an extreme heat environment');
    expect(describeWhen(['scene:name~librar', 'scene:token:target:ally'])).toBe('in a scene named like "librar", while someone else in the scene is an ally');
    expect(describeWhen(['ask:it rains', 'not:ask:it rains', 'ask:dealing with natives of {choice.place}'])).toBe('when it rains, unless it rains, when dealing with natives of the chosen place');
    expect(describeWhen([{ any: ['self:morphed', 'self:transformed'] }])).toBe('while you are Morphed or while you are in Alt Mode');
  });

  test('checks: every check name has its own reading', () => {
    for (const name of CHECK_NAMES) {
      expect(CHECK_PHRASE_NAMES).toContain(name);
      expect(unquoted(describeWhen([`check:${name}`]))).not.toMatch(RAW);
    }

    expect(describeWhen(['check:monsterForm', 'not:check:inWater'])).toBe("if you are in Monster Form, if you aren't in the water");
    expect(describeWhen(['target:check:nonMystical', 'holder:check:personalShield', 'self:check:computerizedGear'])).toBe("if the target isn't magical, if its owner's personal shield is up, if you have computerized parts or gear");
  });

  test('calc: formulas read as comparisons', () => {
    expect(describeWhen(['calc:@level>=10', 'calc:@level<10'])).toBe('if your level is at least 10, if your level is less than 10');
    expect(describeWhen(['calc:@skill.acrobatics.rank - @skill.athletics.rank > 0'])).toBe('if your Acrobatics ranks are more than your Athletics ranks');
    expect(describeWhen(['calc:@versus.level>0'])).toBe("if your Level is above the target's");
    expect(describeWhen(['calc:@owned.abcdefgh12345678>0', 'not:calc:@owned.abcdefgh12345678>0'])).toBe("if you have a particular item, if you don't have a particular item");
    expect(formulaFact('min(1, max(0, @level - 5)) > 0').pos).toBe('its calculated condition holds');
  });
});

describe('describeWhen: plug-in tags and the fallback', () => {
  test('a plug-in phrase is used, in both senses, for the actor it asks about', () => {
    expect(describeWhen(['self:hidden', 'not:target:hidden'])).toBe("if you are Hidden, if the target isn't Hidden");
    expect(describeWhen(['not:self:windowUsed:emotionalStrengthUsedThisEncounter:encounter'])).toBe("if you haven't used Emotional Strength this encounter");
    expect(describeWhen(['self:markText:suggestFail=$skill'])).toBe('if you carry the Suggest Fail mark for the rolled Skill');
    expect(describeWhen(['form:active', 'not:form:active'])).toBe("if this Form is active, if this Form isn't active");
    expect(describeWhen(['allOf:self:morphed&combat'])).toBe('while you are Morphed and in combat');
  });

  test('registerTag meta.phrase: templates, pairs and functions', () => {
    registerTag('zzPhrased', () => true, { family: 'situation', phrase: ['{who} {has} {arg} handy', '{who} {hasnt} {arg} handy'] });
    registerTag('self:zzShout', () => true, { phrase: '{who} shout{s} "{raw}"' });
    registerTag('zzFn', () => true, { phrase: (arg, w) => (arg ? `${w.humanize(arg)} is lit` : null) });
    expect(describeWhen(['zzPhrased:spareKeys', 'not:zzPhrased:spareKeys'])).toBe("if you have Spare Keys handy, if you don't have Spare Keys handy");
    expect(describeWhen(['target:zzShout:hey', 'not:self:zzShout:hey'])).toBe('if the target shouts "hey", unless you shout "hey"');
    expect(describeWhen(['zzFn:bigLamp', 'zzFn'])).toBe('if Big Lamp is lit, if zz Fn');
    expect(tagPhrase('zzPhrased:x').arg).toBe('x');
    registerTag('self:zzLater', () => true);
    registerTagPhrase('self:zzLater', '{who} {is} late');
    expect(describeWhen(['holder:zzLater'])).toBe('if its owner is late');
  });

  test('every plug-in tag but holder:check carries a phrase', () => {
    const missing = registeredTags().filter(name => !/^zz|^(self|target):zz/.test(name) && name != 'holder:check' && !tagPhrase(`${name}:x`));
    expect(missing).toEqual([]);
  });

  test('an unknown tag is humanized, never raw', () => {
    expect(describeWhen(['zzMystery:someThing'])).toBe('if zz Mystery Some Thing');
    expect(describeWhen(['not:zzMystery'])).toBe('unless zz Mystery');
    expect(describeTag('')).toBe('');
    expect(describeWhen('nope')).toBe('');
    expect(humanize('zord1NinjaElementOn')).toBe('Ninja Element On');
    expect(pathName('system.movement.swim.altMode')).toBe('Alt Mode Swim Movement');
    expect(pathName('flags.essence20.rules.choices.element')).toBe('element choice');
  });
});

/* -------------------------------------------- */
/*  The packs                                    */
/* -------------------------------------------- */

describe('every pack tag reads as plain English', () => {
  test(`no raw family: tokens, camelCase keys or stored paths in ${packTags.size} tags`, () => {
    expect(packTags.size).toBeGreaterThan(1000);
    const raw = [...packTags.keys()].map(tag => [tag, describeWhen([tag])]).filter(([, text]) => !text || RAW.test(unquoted(text)));
    expect(raw).toEqual([]);
  });

  test('rule summaries drop stage labels, op words and raw paths', () => {
    const leaks = packRules.map(rule => summarizeRule(rule)).filter(text => /\((derived|afterGravity|derivedHook|final|item)\)|→|\bsystem\.\w|\bundefined\b|\[object/.test(text));
    expect(leaks).toEqual([]);
  });

  test('formula amounts in summaries read as words: no raw @refs or functions', () => {
    const formulas = packRules.map(rule => summarizeRule(rule)).filter(text => /@|\b(?:max|min|floor|ceil|abs|round)\(|calculated amount/.test(unquoted(text)));
    expect(formulas).toEqual([]);
    expect(summarizeRule({ type: 'RollModifier', upshift: '@level' })).toBe('↑ equal to your level');
    expect(summarizeRule({ type: 'DamageModifier', direction: 'dealt', amount: 'max(1, @item.system.advances.currentValue)' })).toBe("+ this item's Advances (at least 1) damage dealt");
    expect(summarizeRule({ type: 'Defense', defense: 'evasion', amount: '-@item.system.armorBonus.value' })).toBe("- this item's Armor Bonus to Evasion");
    expect(summarizeRule({ type: 'RollModifier', upshift: 'max(0, @skill.streetwise.rank - @skill.alertness.rank)' })).toBe('↑ equal to your Streetwise ranks minus your Alertness ranks (at least 0)');
    expect(summarizeRule({ type: 'RollModifier', upshift: 'abs(@size - @target.size)' })).toBe("↑ equal to the difference between your size step and the target's size step");
    expect(summarizeRule({ type: 'Movement', movement: 'aerial', op: 'set', value: '5 + 5 * floor(@level / 5)' })).toBe('Aerial Movement becomes 5 plus 5 times (your level divided by 5, rounded down)');
    expect(summarizeRule({ type: 'Use', label: 'Go', limit: { per: 'scene', max: '1 + min(1, @owned.abcdefgh12345678)' } })).toBe('Use: Go, up to 1 plus (1 if you have a particular item) per scene');
    expect(summarizeRule({ type: 'AttackCount', count: 'max(@essence.strength, @essence.speed)' })).toBe('attacks equal to the higher of your Strength and your Speed per Attack action');
    expect(summarizeRule({ type: 'DerivedStat', path: 'system.health.max', value: '@choice.bonus + @pool.grit' })).toBe('+ the chosen bonus plus the Grit pool to maximum Health');
    expect(summarizeRule({ type: 'Defense', defense: 'toughness', amount: '2 * min(1, max(0, @level - 6)) + min(1, max(0, @level - 11)) + min(1, max(0, @level - 19))' }))
      .toBe('+ an amount based on your level to Toughness');
    expect(summarizeRule({ type: 'ItemModifier', path: 'system.secondaryDamage', op: 'set', value: { type: 'sharp', value: 1 } })).toBe('Secondary Damage becomes 1 Sharp on items');
    expect(summarizeRule({ type: 'RollModifier', upshift: 'max(' })).toBe('↑ equal to a calculated amount');
    expect(summarizeRule({ type: 'Movement', movement: 'ground', op: 'add', value: 10, stage: 'derived', when: ['combat', 'self:combatant', 'not:self:actionUsed:standard', 'self:data:system.movement.ground.total>0'] }))
      .toBe("Ground Movement +10 in combat, while you are in the combat, if you haven't taken your Standard action yet, while you have a Ground Movement");
    expect(summarizeRule({ type: 'DerivedStat', path: 'system.resistances.acid', op: 'set', value: true })).toBe('Gains Acid resistance');
    expect(summarizeRule({ type: 'ItemModifier', path: 'system.radius', op: 'set', value: 15, items: ['item:type:weaponEffect', 'item:onHost'] }))
      .toBe('Radius becomes 15 on items where it is an attack and it is another attack on the same item');
  });
});
