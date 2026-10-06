import { jest } from '@jest/globals';
import { runSteps, stepContext } from './steps.mjs';

/**
 * Bug fixes 2026-10-06 (docs/rules-batches/bugfix-2026-10-06.md) that live in the rules engine.
 */

function setPath(object, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((at, key) => (at[key] ??= {}), object)[last] = value;
}

beforeEach(() => {
  global.game = {
    combat: null, user: { id: 'u', isGM: true, targets: new Set() }, actors: { contents: [] }, settings: { get: () => 1 },
    i18n: { localize: key => key, format: key => key },
  };
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.foundry = { ...(global.foundry ?? {}), utils: { ...(global.foundry?.utils ?? {}), setProperty: setPath, getProperty: (o, k) => k.split('.').reduce((at, key) => at?.[key], o) } };
});

function makeActor({ value = 0, max = 10, defeated = false } = {}) {
  const statuses = new Set(defeated ? ['defeated'] : []);
  return {
    name: 'Hero', flags: {}, isOwner: true, statuses,
    system: { health: { value, max } },
    async update(data) {
      for (const [key, v] of Object.entries(data)) {
        setPath(this, key, v);
      }
    },
    toggleStatusEffect: jest.fn(async (id, { active }) => {
      if (active) {
        statuses.add(id);
      } else {
        statuses.delete(id);
      }
    }),
  };
}

describe('never-read table entries are gone', () => {
  test('COMP / KIT / TEAM / BOND / VU entries nothing read', async () => {
    const { COMP } = await import('../mechanics/companions/companion-uses.mjs');
    const { KIT } = await import('../mechanics/resources/kits.mjs');
    const { TEAM } = await import('../mechanics/actions/team-actions.mjs');
    const { BOND } = await import('../mechanics/companions/bonded-partners.mjs');
    const { VU } = await import('../mechanics/vehicles/vehicle-upgrades.mjs');
    for (const key of ['attackMlp', 'commandAndControl', 'inTheirElement', 'kittedPurpose']) {
      expect(COMP[key]).toBeUndefined();
    }

    expect(KIT.forageFamiliarity).toBeUndefined();
    // Kitted Purpose's own KIT entry is read (mechanics/resources/kits.mjs#activeKits) and stays.
    expect(KIT.kittedPurpose).toBeDefined();
    expect(TEAM.conniving).toBeUndefined();
    expect(TEAM.recklessAbandon).toBeUndefined();
    expect(BOND.linkLock).toBeUndefined();
    // The whole VU table went with the last vehicle upgrades it named (round 17, split3 - they are item rules).
    expect(VU).toBeUndefined();
  });
});

describe('heal step', () => {
  test('a real-Health heal clears Defeated, as the heal Skill Test does', async () => {
    const actor = makeActor({ value: 0, defeated: true });
    await runSteps([{ do: 'heal', amount: 2 }], stepContext({ actor, item: { name: 'Nano-Med Mastery' } }));
    expect(actor.system.health.value).toBe(2);
    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('defeated', { active: false });
    expect(actor.statuses.has('defeated')).toBe(false);
  });

  test('not Defeated: no status change; temporary Health leaves Defeated alone', async () => {
    const standing = makeActor({ value: 3 });
    await runSteps([{ do: 'heal', amount: 2 }], stepContext({ actor: standing, item: { name: 'X' } }));
    expect(standing.toggleStatusEffect).not.toHaveBeenCalled();

    const down = makeActor({ value: 0, defeated: true });
    down.system.health.bonus = 0;
    await runSteps([{ do: 'heal', amount: 2, temporary: true }], stepContext({ actor: down, item: { name: 'X' } }));
    expect(down.statuses.has('defeated')).toBe(true);
  });
});
