import { jest } from '@jest/globals';
import { bankHardCorpsDebt, applyHardCorpsDeferredDefeat } from './hard-corps.mjs';

function makeActor({ health = 5, debt = undefined } = {}) {
  return {
    system: { health: { value: health } },
    getFlag: jest.fn(() => debt),
    setFlag: jest.fn(),
    unsetFlag: jest.fn(),
    toggleStatusEffect: jest.fn(),
  };
}

describe("bankHardCorpsDebt", () => {
  test("banks the combat id and amount", async () => {
    global.game = { combat: { id: 'combat1' } };
    const actor = makeActor();

    await bankHardCorpsDebt(actor, 2);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'hardCorpsIgnoredDamage', { combatId: 'combat1', amount: 2 });
  });
});

describe("applyHardCorpsDeferredDefeat", () => {
  test("Defeats an actor whose current Health can't cover the banked debt", async () => {
    const actor = makeActor({ health: 1, debt: { combatId: 'combat1', amount: 2 } });
    const combat = { id: 'combat1', combatants: [{ actor }] };

    await applyHardCorpsDeferredDefeat(combat);

    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('defeated', { active: true });
    expect(actor.unsetFlag).toHaveBeenCalledWith('essence20', 'hardCorpsIgnoredDamage');
  });

  test("doesn't Defeat when current Health still covers the debt", async () => {
    const actor = makeActor({ health: 5, debt: { combatId: 'combat1', amount: 2 } });
    const combat = { id: 'combat1', combatants: [{ actor }] };

    await applyHardCorpsDeferredDefeat(combat);

    expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
    expect(actor.unsetFlag).toHaveBeenCalledWith('essence20', 'hardCorpsIgnoredDamage');
  });

  test("ignores a combatant with no banked debt, or one from a different (stale) combat", async () => {
    const noDebtActor = makeActor({ health: 1 });
    const staleDebtActor = makeActor({ health: 1, debt: { combatId: 'combat2', amount: 5 } });
    const combat = { id: 'combat1', combatants: [{ actor: noDebtActor }, { actor: staleDebtActor }] };

    await applyHardCorpsDeferredDefeat(combat);

    expect(noDebtActor.toggleStatusEffect).not.toHaveBeenCalled();
    expect(staleDebtActor.toggleStatusEffect).not.toHaveBeenCalled();
    expect(staleDebtActor.unsetFlag).not.toHaveBeenCalled();
  });
});
