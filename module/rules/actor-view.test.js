import {
  EFFECT_GROUPS, actorEffectGroups, actorRuleGroups, actorRulesContext, classifyEffect, effectSourceItem, isRegionEffect,
} from './actor-view.mjs';

const T = key => `T(${key})`;

function makeEffect(data = {}) {
  return {
    id: data.id ?? 'e1',
    uuid: data.uuid ?? `Actor.a1.ActiveEffect.${data.id ?? 'e1'}`,
    name: data.name ?? 'Effect',
    img: 'icons/svg/aura.svg',
    disabled: false,
    isTemporary: false,
    isSuppressed: false,
    statuses: new Set(),
    origin: null,
    duration: { label: 'None' },
    sourceName: 'None',
    parent: { documentName: 'Actor' },
    ...data,
  };
}

function makeItem(id, data = {}) {
  return {
    id, uuid: `Actor.a1.Item.${id}`, name: data.name ?? id, img: `${id}.svg`, type: data.type ?? 'perk',
    documentName: 'Item', system: { rules: data.rules ?? [] }, flags: data.flags ?? {}, effects: data.effects ?? [], ...data.extra,
  };
}

function makeActor({ effects = [], items = [] } = {}) {
  const itemMap = new Map(items.map(item => [item.id, item]));
  const actor = {
    effects,
    items: { contents: items, get: id => itemMap.get(id), [Symbol.iterator]: () => items[Symbol.iterator]() },
    *allApplicableEffects() {
      yield* effects;
      for (const item of items) {
        for (const effect of item.effects) {
          if (effect.transfer !== false) {
            yield effect;
          }
        }
      }
    },
  };
  for (const item of items) {
    item.parent = actor;
  }

  return actor;
}

describe('classifyEffect', () => {
  test('disabled wins over everything', () => {
    expect(classifyEffect(makeEffect({ disabled: true, statuses: new Set(['stunned']), isTemporary: true }))).toBe('inactive');
  });

  test('a status makes it a condition', () => {
    expect(classifyEffect(makeEffect({ statuses: new Set(['stunned']), isTemporary: true }))).toBe('condition');
    expect(classifyEffect(makeEffect({ statuses: ['prone'] }))).toBe('condition');
  });

  test('a region origin makes it an area effect', () => {
    expect(classifyEffect(makeEffect({ origin: 'Scene.s1.Region.r1.RegionBehavior.b1', isTemporary: true }))).toBe('area');
  });

  test('a duration makes it temporary, otherwise passive', () => {
    expect(classifyEffect(makeEffect({ isTemporary: true }))).toBe('temporary');
    expect(classifyEffect(makeEffect())).toBe('passive');
    expect(classifyEffect(null)).toBe('passive');
  });
});

describe('isRegionEffect', () => {
  test('recognises region and region-behavior origins only', () => {
    expect(isRegionEffect({ origin: 'Scene.s1.Region.r1.RegionBehavior.b1' })).toBe(true);
    expect(isRegionEffect({ origin: 'Scene.s1.Region.r1' })).toBe(true);
    expect(isRegionEffect({ origin: 'Actor.a1.Item.i1' })).toBe(false);
    expect(isRegionEffect({})).toBe(false);
  });
});

describe('effectSourceItem', () => {
  test('a transferred effect comes from the item it lives on', () => {
    const item = makeItem('i1');
    expect(effectSourceItem({ parent: item }, makeActor())).toBe(item);
  });

  test("an actor effect whose origin names one of the actor's items", () => {
    const item = makeItem('i1');
    const actor = makeActor({ items: [item] });
    expect(effectSourceItem({ parent: actor, origin: 'Actor.a1.Item.i1' }, actor)).toBe(item);
    expect(effectSourceItem({ parent: actor, origin: 'Actor.a1.Item.zz' }, actor)).toBeNull();
    expect(effectSourceItem({ parent: actor, origin: 'Compendium.x.y' }, actor)).toBeNull();
  });
});

describe('actorEffectGroups', () => {
  beforeEach(() => {
    global.CONFIG = { statusEffects: [{ id: 'stunned', name: 'E20.StatusStunned' }] };
  });

  afterEach(() => {
    delete global.CONFIG;
  });

  test('returns every group in order, hiding empty conditions/area groups only', () => {
    const groups = actorEffectGroups(makeActor(), { localize: T });
    expect(groups.map(group => group.type)).toEqual(EFFECT_GROUPS.map(group => group.type));
    const hidden = Object.fromEntries(groups.map(group => [group.type, group.hidden]));
    expect(hidden).toEqual({ condition: true, area: true, temporary: false, passive: false, inactive: false });
    expect(groups.every(group => group.empty)).toBe(true);
  });

  test('sorts own and item effects into groups with duration, source and controls', () => {
    const fromItem = makeEffect({ id: 'e3', name: 'Armor bonus' });
    const item = makeItem('i1', { name: 'Vest', effects: [fromItem] });
    fromItem.parent = item;
    const stunned = makeEffect({ id: 'e1', name: 'Stunned', statuses: new Set(['stunned', 'odd']) });
    const timed = makeEffect({ id: 'e2', name: 'Rally', isTemporary: true, duration: { label: '2 Rounds' }, origin: 'Actor.a1.Item.i1' });
    const area = makeEffect({ id: 'e4', name: 'Fog', origin: 'Scene.s.Region.r.RegionBehavior.b', sourceName: 'Fog behavior' });
    const off = makeEffect({ id: 'e5', name: 'Off', disabled: true, isTemporary: true, duration: { label: '' } });
    const expired = makeEffect({ id: 'e6', name: 'Expired', isSuppressed: true });
    const actor = makeActor({ effects: [stunned, timed, area, off, expired], items: [item] });

    const groups = actorEffectGroups(actor, { localize: T, summarize: effect => [`sum ${effect.name}`] });
    const byType = Object.fromEntries(groups.map(group => [group.type, group]));

    expect(byType.condition.hidden).toBe(false);
    expect(byType.condition.transient).toBe(true);
    const [condition] = byType.condition.effects;
    expect(condition.statuses).toEqual(['T(E20.StatusStunned)', 'odd']);
    expect(condition.duration).toBe('T(E20.ActorRules.UntilRemoved)');
    expect(condition.sourceName).toBe('');

    expect(byType.area.effects[0].duration).toBe('T(E20.ActorRules.WhileInArea)');
    expect(byType.area.effects[0].sourceName).toBe('Fog behavior');

    const [rally] = byType.temporary.effects;
    expect(rally.duration).toBe('2 Rounds');
    expect(rally.temporary).toBe(true);
    expect(rally.sourceName).toBe('Vest');
    expect(rally.sourceUuid).toBe('Actor.a1.Item.i1');
    expect(rally.canDelete).toBe(true);
    expect(rally.summaries).toEqual(['sum Rally']);

    const passive = byType.passive.effects.map(entry => entry.name);
    expect(passive).toEqual(['Expired', 'Armor bonus']);
    const [expiredEntry, armor] = byType.passive.effects;
    expect(expiredEntry.suppressed).toBe(true);
    expect(expiredEntry.duration).toBe('T(E20.ActorRules.Permanent)');
    expect(armor.fromItem).toBe(true);
    expect(armor.canDelete).toBe(false);
    expect(armor.sourceUuid).toBe(item.uuid);

    const [offEntry] = byType.inactive.effects;
    expect(offEntry.disabled).toBe(true);
    expect(offEntry.suppressed).toBe(false);
    expect(offEntry.duration).toBe('T(E20.ActorRules.Timed)');
  });

  test('falls back to actor.effects and default summaries', () => {
    const effect = makeEffect({ e20Summaries: ['pre'] });
    const groups = actorEffectGroups({ effects: { contents: [effect] }, items: { get: () => null } }, { localize: T });
    expect(groups.find(group => group.type == 'passive').effects[0].summaries).toEqual(['pre']);
    expect(actorEffectGroups({ effects: [effect] }, { localize: T }).find(group => group.type == 'passive').effects).toHaveLength(1);
    expect(actorEffectGroups(null, { localize: T }).every(group => group.empty)).toBe(true);
  });
});

describe('actorRuleGroups', () => {
  afterEach(() => {
    delete global.CONFIG;
  });

  test('groups live rules by item, sorted by name, with live state', () => {
    global.CONFIG = { Item: { typeLabels: { perk: 'TYPES.Item.perk' } }, E20: { skills: { athletics: 'E20.SkillAthletics' } } };
    const toggle = { type: 'Toggle', key: 'active', label: 'Active' };
    const pool = { type: 'Pool', key: 'uses', label: 'Uses', max: 3 };
    const choice = { type: 'ChoiceSet', key: 'skill', label: 'Skill', from: 'skill' };
    const unset = { type: 'ChoiceSet', key: 'other', label: 'Other', from: 'list', options: ['a'] };
    const modifier = { type: 'RollModifier', when: ['skill:athletics'], upshift: 1, scope: 'crew' };
    const zeta = makeItem('z', { name: 'Zeta', rules: [toggle, pool], flags: { essence20: { rules: { toggles: { active: true }, pools: { uses: { value: 1 } } } } } });
    const alpha = makeItem('a', { name: 'Alpha', type: 'upgrade', rules: [modifier, choice, unset], flags: { essence20: { parentId: 'z', rules: { choices: { skill: 'athletics' } } } } });
    const actor = makeActor({ items: [zeta, alpha] });

    const groups = actorRuleGroups(actor, { localize: T });
    expect(groups.map(group => group.name)).toEqual(['Alpha', 'Zeta']);

    const [first, second] = groups;
    expect(first.hostName).toBe('Zeta');
    expect(first.typeLabel).toBe('upgrade');
    expect(first.uuid).toBe('Actor.a1.Item.a');
    expect(first.rules.map(rule => rule.index)).toEqual([0, 1, 2]);
    expect(first.rules[0]).toMatchObject({ type: 'RollModifier', typeLabel: 'Roll Modifier', situational: true, linked: true, state: '' });
    expect(first.rules[0].summary).toMatch(/^Its crew: /);
    expect(first.rules[1].state).toBe('E20.SkillAthletics');
    expect(first.rules[2].state).toBe('T(E20.Rules.ChoiceUnset)');

    expect(second.typeLabel).toBe('T(TYPES.Item.perk)');
    expect(second.hostName).toBeNull();
    expect(second.rules[0].state).toBe('T(E20.ActorRules.On)');
    expect(second.rules[1].state).toBe('1 / 3');
  });

  test('toggle off, full pool and a stored choice not in the options', () => {
    const rules = [
      { type: 'Toggle', key: 't', label: 'T' },
      { type: 'Pool', key: 'p', label: 'P', max: 2 },
      { type: 'ChoiceSet', key: 'c', label: 'C', from: 'list', options: [{ value: 'x', label: 'Ex' }] },
    ];
    const item = makeItem('i', { rules, flags: { essence20: { rules: { choices: { c: 'gone' } } } } });
    const [group] = actorRuleGroups(makeActor({ items: [item] }), { localize: T });
    expect(group.rules.map(rule => rule.state)).toEqual(['T(E20.ActorRules.Off)', '2 / 2', 'gone']);
  });

  test('uses an injected collector and tolerates empty input', () => {
    const item = makeItem('i');
    const collect = () => ({ Code: [{ rule: { type: 'Code', helper: 'x' }, item, index: 4 }], Other: [{ rule: { type: 'Mystery' }, item, index: 1 }] });
    const [group] = actorRuleGroups({}, { localize: T, collect });
    expect(group.rules.map(rule => rule.index)).toEqual([1, 4]);
    expect(group.rules[0].summary).toMatch(/^Mystery/);
    expect(actorRuleGroups(null, { collect: () => null })).toEqual([]);
  });

  test('skips unequipped items', () => {
    const item = makeItem('w', { type: 'weapon', rules: [{ type: 'Toggle', key: 'k' }], extra: {} });
    item.system.equipped = false;
    expect(actorRuleGroups(makeActor({ items: [item] }), { localize: T })).toEqual([]);
  });
});

describe('actorRulesContext', () => {
  test('counts rules and transient effects', () => {
    const item = makeItem('i', { rules: [{ type: 'Toggle', key: 'k' }, { type: 'Pool', key: 'p', max: 1 }] });
    const actor = makeActor({ effects: [makeEffect({ isTemporary: true }), makeEffect({ id: 'e2' })], items: [item] });
    const context = actorRulesContext(actor, { localize: T });
    expect(context.ruleCount).toBe(2);
    expect(context.transientCount).toBe(1);
    expect(context.effectGroups).toHaveLength(EFFECT_GROUPS.length);
    expect(context.ruleGroups).toHaveLength(1);
  });
});
