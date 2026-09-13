import { jest } from '@jest/globals';
import {
  activateTechSpecs, buildTechSpecsResult, checkTechSpecsEdge, checkTechSpecsShiftUp, getHighestDefenseType,
  markTechSpecsTarget,
} from './tech-specs.mjs';

const TECHNICAL_MASTERY_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.QKlXoVgNMq7Kv58L";

global.game = {
  combat: { id: 'combat1', round: 2 },
  i18n: {
    localize: (key) => key,
    format: (key, vars) => `${key}:${JSON.stringify(vars)}`,
  },
  user: { targets: { first: jest.fn(() => undefined) } },
  actors: { get: jest.fn(() => undefined) },
};

global.ui = { notifications: { warn: jest.fn() } };

function makeTargetActor({ id = 'target1', defenses = {}, hangUps = [] } = {}) {
  const defaults = { toughness: 10, evasion: 10, willpower: 10, cleverness: 10 };
  const merged = { ...defaults, ...defenses };
  return {
    id,
    name: 'Target',
    system: {
      defenses: Object.fromEntries(Object.entries(merged).map(([type, value]) => [type, { total: value }])),
    },
    items: hangUps.map(name => ({ type: 'hangUp', name })),
    getFlag: jest.fn(),
    setFlag: jest.fn(),
  };
}

function makeActor({ id = 'actor1', disposition = 1 } = {}) {
  return {
    id,
    getActiveTokens: jest.fn(() => [{ document: { disposition } }]),
    _dice: { rollSkill: jest.fn() },
  };
}

describe("getHighestDefenseType", () => {
  test("returns the defenseType with the highest total", () => {
    const target = makeTargetActor({ defenses: { toughness: 8, evasion: 15, willpower: 10, cleverness: 12 } });
    expect(getHighestDefenseType(target)).toBe('evasion');
  });

  test("breaks ties by DEFENSE_TYPES' own listed order", () => {
    const target = makeTargetActor({ defenses: { toughness: 10, evasion: 10, willpower: 10, cleverness: 10 } });
    expect(getHighestDefenseType(target)).toBe('toughness');
  });
});

describe("activateTechSpecs", () => {
  beforeEach(() => {
    ui.notifications.warn.mockClear();
  });

  test("triggers a Technology roll against the target's highest Defense", async () => {
    const actor = makeActor();
    const target = makeTargetActor({ defenses: { toughness: 8, evasion: 15, willpower: 10, cleverness: 12 } });
    game.user.targets.first.mockReturnValue({ actor: target });

    await activateTechSpecs(actor);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'technology', essence: 'smarts', defenseType: 'evasion', isTechSpecs: true }),
      actor,
    );
  });

  test("warns and does nothing without a target", async () => {
    const actor = makeActor();
    game.user.targets.first.mockReturnValue(undefined);

    await activateTechSpecs(actor);

    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
    expect(ui.notifications.warn).toHaveBeenCalled();
  });
});

describe("buildTechSpecsResult", () => {
  test("includes all 4 Defense scores and any Hang-Ups", () => {
    const target = makeTargetActor({
      defenses: { toughness: 8, evasion: 15, willpower: 10, cleverness: 12 }, hangUps: ['Overheats'],
    });

    const result = buildTechSpecsResult(target);

    expect(result).toContain('E20.TechSpecsResult');
    expect(result).toContain('Overheats');
  });

  test("falls back to 'none known' with no Hang-Ups", () => {
    const target = makeTargetActor();
    expect(buildTechSpecsResult(target)).toContain('E20.ChronoFileAccessNoHangUps');
  });
});

describe("markTechSpecsTarget / checkTechSpecsShiftUp", () => {
  test("marks the target with the actor's disposition, round, and id", async () => {
    const actor = makeActor({ id: 'caster1', disposition: 1 });
    const target = makeTargetActor();

    await markTechSpecsTarget(actor, target);

    expect(target.setFlag).toHaveBeenCalledWith('essence20', 'techSpecsMarked', {
      combatId: 'combat1', round: 2, disposition: 1, casterId: 'caster1',
    });
  });

  test("no-ops outside of combat", async () => {
    game.combat = null;
    const actor = makeActor();
    const target = makeTargetActor();

    await markTechSpecsTarget(actor, target);

    expect(target.setFlag).not.toHaveBeenCalled();
    game.combat = { id: 'combat1', round: 2 };
  });

  test("grants the shiftUp this round and the following round, to the marking actor's own allies", () => {
    const target = makeTargetActor();
    target.getFlag = jest.fn(() => ({ combatId: 'combat1', round: 2, disposition: 1 }));

    const sameRoundAlly = makeActor({ id: 'ally1', disposition: 1 });
    expect(checkTechSpecsShiftUp(sameRoundAlly, target)).toBe(true);

    game.combat.round = 3;
    expect(checkTechSpecsShiftUp(sameRoundAlly, target)).toBe(true);
    game.combat.round = 2;
  });

  test("doesn't apply for an opposing-disposition attacker", () => {
    const target = makeTargetActor();
    target.getFlag = jest.fn(() => ({ combatId: 'combat1', round: 2, disposition: 1 }));
    const enemy = makeActor({ id: 'enemy1', disposition: -1 });

    expect(checkTechSpecsShiftUp(enemy, target)).toBe(false);
  });

  test("doesn't apply once the window has fully expired (2+ rounds later)", () => {
    const target = makeTargetActor();
    target.getFlag = jest.fn(() => ({ combatId: 'combat1', round: 1, disposition: 1 }));
    const ally = makeActor({ id: 'ally1', disposition: 1 });

    game.combat.round = 3;
    expect(checkTechSpecsShiftUp(ally, target)).toBe(false);
    game.combat.round = 2;
  });

  test("doesn't apply without a mark, or outside of combat", () => {
    const target = makeTargetActor();
    const ally = makeActor({ id: 'ally1', disposition: 1 });
    expect(checkTechSpecsShiftUp(ally, target)).toBe(false);

    target.getFlag = jest.fn(() => ({ combatId: 'combat1', round: 2, disposition: 1 }));
    game.combat = null;
    expect(checkTechSpecsShiftUp(ally, target)).toBe(false);
    game.combat = { id: 'combat1', round: 2 };
  });
});

describe("checkTechSpecsEdge", () => {
  afterEach(() => {
    game.actors.get.mockReturnValue(undefined);
  });

  test("true when the marked-window is active and the original caster holds Technical Mastery", () => {
    const target = makeTargetActor();
    target.getFlag = jest.fn(() => ({ combatId: 'combat1', round: 2, disposition: 1, casterId: 'caster1' }));
    const caster = { items: [{ type: 'perk', flags: { core: { sourceId: TECHNICAL_MASTERY_ID } } }] };
    game.actors.get.mockReturnValue(caster);
    const ally = makeActor({ id: 'ally1', disposition: 1 });

    expect(checkTechSpecsEdge(ally, target)).toBe(true);
  });

  test("false when the caster doesn't hold Technical Mastery", () => {
    const target = makeTargetActor();
    target.getFlag = jest.fn(() => ({ combatId: 'combat1', round: 2, disposition: 1, casterId: 'caster1' }));
    game.actors.get.mockReturnValue({ items: [] });
    const ally = makeActor({ id: 'ally1', disposition: 1 });

    expect(checkTechSpecsEdge(ally, target)).toBe(false);
  });

  test("false when checkTechSpecsShiftUp itself wouldn't apply (e.g. opposing disposition)", () => {
    const target = makeTargetActor();
    target.getFlag = jest.fn(() => ({ combatId: 'combat1', round: 2, disposition: 1, casterId: 'caster1' }));
    const caster = { items: [{ type: 'perk', flags: { core: { sourceId: TECHNICAL_MASTERY_ID } } }] };
    game.actors.get.mockReturnValue(caster);
    const enemy = makeActor({ id: 'enemy1', disposition: -1 });

    expect(checkTechSpecsEdge(enemy, target)).toBe(false);
  });
});
