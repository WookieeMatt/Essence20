import { jest } from '@jest/globals';
import { bankRetributionBonus, computeRetributionBonusType, RETRIBUTION_ID, RETRIBUTION_PENDING_FLAG } from './retribution.mjs';

describe("computeRetributionBonusType", () => {
  test("null when Defender Step never activated for this entry", () => {
    const entry = { defenderStepReactorUuid: null, defenderStepBonus: 0, difficulty: 15 };
    expect(computeRetributionBonusType(entry, 20)).toBeNull();
  });

  test("'damage' when the attack still hit despite Defender Step's own boost", () => {
    // difficulty already includes the +2 Defender Step bonus (17 base + 2 boost = 19).
    const entry = { defenderStepReactorUuid: 'Actor.reactor', defenderStepBonus: 2, difficulty: 19 };
    expect(computeRetributionBonusType(entry, 20)).toBe('damage');
  });

  test("'edge' when Defender Step's own boost was the deciding factor in the miss", () => {
    // Without the +2 boost, 18 would have hit a total of 18; with it (19), the same total misses.
    const entry = { defenderStepReactorUuid: 'Actor.reactor', defenderStepBonus: 2, difficulty: 19 };
    expect(computeRetributionBonusType(entry, 18)).toBe('edge');
  });

  test("null when the attack would have missed regardless of Defender Step's boost", () => {
    const entry = { defenderStepReactorUuid: 'Actor.reactor', defenderStepBonus: 2, difficulty: 19 };
    expect(computeRetributionBonusType(entry, 10)).toBeNull();
  });
});

describe("bankRetributionBonus", () => {
  let originalFromUuid;
  beforeEach(() => {
    originalFromUuid = global.fromUuid;
  });
  afterEach(() => {
    global.fromUuid = originalFromUuid;
  });

  function makeReactor({ hasPerk = true } = {}) {
    return {
      items: hasPerk ? [{ type: 'perk', flags: { core: { sourceId: RETRIBUTION_ID } } }] : [],
      setFlag: jest.fn(),
    };
  }

  test("banks the bonus, scoped to the attacker, when the reactor holds Retribution", async () => {
    const reactor = makeReactor();
    global.fromUuid = jest.fn(async () => reactor);

    await bankRetributionBonus('Actor.reactor', 'Actor.attacker', 'edge');

    expect(reactor.setFlag).toHaveBeenCalledWith('essence20', RETRIBUTION_PENDING_FLAG, expect.objectContaining({
      targetUuid: 'Actor.attacker', bonusType: 'edge',
    }));
  });

  test("does nothing if the reactor doesn't actually hold Retribution (Defender Step alone isn't enough)", async () => {
    const reactor = makeReactor({ hasPerk: false });
    global.fromUuid = jest.fn(async () => reactor);

    await bankRetributionBonus('Actor.reactor', 'Actor.attacker', 'damage');

    expect(reactor.setFlag).not.toHaveBeenCalled();
  });

  test("does nothing if the reactor actor can no longer be resolved", async () => {
    global.fromUuid = jest.fn(async () => null);

    await expect(bankRetributionBonus('Actor.reactor', 'Actor.attacker', 'damage')).resolves.toBeUndefined();
  });
});
