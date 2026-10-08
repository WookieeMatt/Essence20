import { jest } from '@jest/globals';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { isImmuneToCondition } from './condition-immunity.mjs';
import { rebuildIndex } from '../../rules/index.mjs';

// Most immunities are ConditionImmunity rules on the items now: a test character's copy carries its
// pack item's rules, the way a real copy inherits them.
const PACK_RULES = new Map();
for (const dir of readdirSync('packs')) {
  const src = `packs/${dir}/_source`;
  if (!existsSync(src)) {
    continue;
  }

  for (const file of readdirSync(src).filter(name => name.endsWith('.json'))) {
    const id = file.slice(-21, -5);
    if (['pJcXVybdqjcWHpJq', 'UYaPTaAQH5SDXxnz', 'Um9sT730VGgHPxLh', 'CXnb6i4d7XhkhFNr', '566NsnD5dccg9uVo', 'mOgEBZIbiaT07eAq', 'edU8dyL3poLU6IuM', '6r0sYiTEtGsge6cB', 'Vo5IeXooKE9OBoJH', 'oXyaZOw6L1AXiyCj', 'ZBOmQradsrZi9sc5', 'LXK3ATRjFLfPg4mb', 'pQvXMpk7uAvfuGMl', 'LtUei3Rd9ygf2dQa', 'AbKqzmAMQZsetwY0', 'rEoZEFQR2puQxpIW', 'xsFS0pGQFx1w2qTd'].includes(id)) {
      PACK_RULES.set(id, JSON.parse(readFileSync(`${src}/${file}`, 'utf8')).system?.rules ?? []);
    }
  }
}

let nextActor = 1;
function withRules(actor) {
  actor.id ??= `ci${nextActor++}`;
  actor.statuses ??= new Set();
  actor.system ??= {};
  for (const item of actor.items) {
    const uuid = item.flags?.core?.sourceId ?? '';
    item.id ??= `i${nextActor++}`;
    item.system ??= {};
    item.system.rules ??= PACK_RULES.get(uuid.split('.').pop()) ?? [];
    item.parent = actor;
  }

  rebuildIndex(actor);
  return actor;
}

const CAUTION_ID = "Compendium.essence20.gi_joe_crb.Item.pJcXVybdqjcWHpJq";
const AMBUSH_MASTER_ID = "Compendium.essence20.gi_joe_crb.Item.UYaPTaAQH5SDXxnz";
const BATTLEFIELD_TITAN_ID = "Compendium.essence20.gi_joe_crb.Item.xsFS0pGQFx1w2qTd";
const SHAPE_SHIFTER_ID = "Compendium.essence20.tf_crb.Item.Um9sT730VGgHPxLh";
const INDOMITABLE_ID = "Compendium.essence20.tf_crb.Item.CXnb6i4d7XhkhFNr";
const RIGHTEOUS_HEART_ID = "Compendium.essence20.pr_crb.Item.mOgEBZIbiaT07eAq";
const MIND_OF_NO_MIND_ID = "Compendium.essence20.intercontinental_adventures.Item.edU8dyL3poLU6IuM";
const GET_LOW_ID = "Compendium.essence20.technorganic_secrets.Item.rEoZEFQR2puQxpIW";
const TRUE_SELF_ID = "Compendium.essence20.mlp_crb.Item.LtUei3Rd9ygf2dQa";
const POWER_FROM_LOSS_ID = "Compendium.essence20.through_the_shattered_grid.Item.AbKqzmAMQZsetwY0";
const ALWAYS_ALERT_ID = "Compendium.essence20.tf_crb.Item.6r0sYiTEtGsge6cB";

global.canvas = {
  tokens: { placeables: [] },
  grid: { measurePath: jest.fn(() => ({ distance: 0 })) },
};

function makeActor(perkIds = []) {
  const items = perkIds.map(perkId => ({ type: 'perk', flags: { core: { sourceId: perkId } } }));
  return withRules({ items });
}

describe("isImmuneToCondition (Caution, Bodyguard Focus, 17th level)", () => {
  test.each(['blinded', 'deafened', 'frightened', 'immobilized', 'restrained', 'stunned'])(
    "true for %s with the Perk", (statusId) => {
      expect(isImmuneToCondition(makeActor([CAUTION_ID]), statusId)).toBe(true);
    },
  );

  test("false for a Condition not covered by Caution", () => {
    expect(isImmuneToCondition(makeActor([CAUTION_ID]), 'prone')).toBe(false);
  });

  test("false without the Perk", () => {
    expect(isImmuneToCondition(makeActor(), 'frightened')).toBe(false);
  });

  test("false for an actor with unrelated Perks", () => {
    expect(isImmuneToCondition(makeActor(["Compendium.essence20.gi_joe_crb.Item.other"]), 'frightened')).toBe(false);
  });
});

describe("isImmuneToCondition (Ambush Master, Door-Kicker Focus, 10th level)", () => {
  test.each(['blinded', 'deafened'])("true for %s with the Perk", (statusId) => {
    expect(isImmuneToCondition(makeActor([AMBUSH_MASTER_ID]), statusId)).toBe(true);
  });

  test("false for a Condition not covered by Ambush Master", () => {
    expect(isImmuneToCondition(makeActor([AMBUSH_MASTER_ID]), 'frightened')).toBe(false);
  });

  test("false without the Perk", () => {
    expect(isImmuneToCondition(makeActor(), 'blinded')).toBe(false);
  });
});

describe("isImmuneToCondition (Shape Shifter, Transformers CRB Triple Changer Focus, 6th level)", () => {
  test("true for prone with the Perk", () => {
    expect(isImmuneToCondition(makeActor([SHAPE_SHIFTER_ID]), 'prone')).toBe(true);
  });

  test("false for a Condition not covered by Shape Shifter (the Maneuver half is a damageType, handled elsewhere)", () => {
    expect(isImmuneToCondition(makeActor([SHAPE_SHIFTER_ID]), 'frightened')).toBe(false);
  });

  test("false without the Perk", () => {
    expect(isImmuneToCondition(makeActor(), 'prone')).toBe(false);
  });
});

describe("isImmuneToCondition (Indomitable, Transformers CRB Wrecker Focus, 17th level)", () => {
  test("true for frightened with the Perk", () => {
    expect(isImmuneToCondition(makeActor([INDOMITABLE_ID]), 'frightened')).toBe(true);
  });

  test("false for a Condition not covered by Indomitable (the Snag-on-Intimidation half is handled in dice.mjs)", () => {
    expect(isImmuneToCondition(makeActor([INDOMITABLE_ID]), 'stunned')).toBe(false);
  });

  test("false without the Perk", () => {
    expect(isImmuneToCondition(makeActor(), 'frightened')).toBe(false);
  });
});

describe("isImmuneToCondition (Keep Your Cool, A Jump Through Time General Perk, p.53)", () => {
  const KEEP_YOUR_COOL_ID = "Compendium.essence20.jump_through_time.Item.566NsnD5dccg9uVo";

  test("true for frightened with the Perk", () => {
    expect(isImmuneToCondition(makeActor([KEEP_YOUR_COOL_ID]), 'frightened')).toBe(true);
  });

  test("false for a Condition not covered by Keep Your Cool (the Snag-on-Intimidation half is handled in dice.mjs)", () => {
    expect(isImmuneToCondition(makeActor([KEEP_YOUR_COOL_ID]), 'stunned')).toBe(false);
  });

  test("false without the Perk", () => {
    expect(isImmuneToCondition(makeActor(), 'frightened')).toBe(false);
  });
});

describe("isImmuneToCondition (Righteous Heart, PR CRB General Perk, p.98)", () => {
  test("true for frightened with the Perk", () => {
    expect(isImmuneToCondition(makeActor([RIGHTEOUS_HEART_ID]), 'frightened')).toBe(true);
  });

  test("false for a Condition not covered by Righteous Heart (the Resistance-toggle half isn't built)", () => {
    expect(isImmuneToCondition(makeActor([RIGHTEOUS_HEART_ID]), 'stunned')).toBe(false);
  });

  test("false without the Perk", () => {
    expect(isImmuneToCondition(makeActor(), 'frightened')).toBe(false);
  });
});

describe("isImmuneToCondition (Mind of No Mind, Factions in Action Vol. 2 Arashikage General Perk, p.9)", () => {
  test("true for frightened with the Perk", () => {
    expect(isImmuneToCondition(makeActor([MIND_OF_NO_MIND_ID]), 'frightened')).toBe(true);
  });

  test("false for a Condition not covered by Mind of No Mind (the Willpower/Alertness halves are handled elsewhere)", () => {
    expect(isImmuneToCondition(makeActor([MIND_OF_NO_MIND_ID]), 'stunned')).toBe(false);
  });

  test("false without the Perk", () => {
    expect(isImmuneToCondition(makeActor(), 'frightened')).toBe(false);
  });
});

describe("isImmuneToCondition (True Self, MLP CRB Spirit of Honesty, 17th level, p.79)", () => {
  test("true for frightened and mesmerized with the Perk", () => {
    expect(isImmuneToCondition(makeActor([TRUE_SELF_ID]), 'frightened')).toBe(true);
    expect(isImmuneToCondition(makeActor([TRUE_SELF_ID]), 'mesmerized')).toBe(true);
  });

  test("false for a Condition not related to behavior compulsion", () => {
    expect(isImmuneToCondition(makeActor([TRUE_SELF_ID]), 'stunned')).toBe(false);
  });

  test("false without the Perk", () => {
    expect(isImmuneToCondition(makeActor(), 'frightened')).toBe(false);
    expect(isImmuneToCondition(makeActor(), 'mesmerized')).toBe(false);
  });
});

describe("isImmuneToCondition (Power From Loss, Through the Shattered Grid, General Perk, p.115)", () => {
  test("true for mesmerized with the Perk", () => {
    expect(isImmuneToCondition(makeActor([POWER_FROM_LOSS_ID]), 'mesmerized')).toBe(true);
  });

  test("grants nothing else - only Mesmerized", () => {
    expect(isImmuneToCondition(makeActor([POWER_FROM_LOSS_ID]), 'frightened')).toBe(false);
  });

  test("false without the Perk", () => {
    expect(isImmuneToCondition(makeActor(), 'mesmerized')).toBe(false);
  });
});

describe("isImmuneToCondition (Always Alert, Transformers CRB, General Perk, p.108)", () => {
  test("true for surprised with the Perk", () => {
    expect(isImmuneToCondition(makeActor([ALWAYS_ALERT_ID]), 'surprised')).toBe(true);
  });

  test("grants nothing else - only Surprised", () => {
    expect(isImmuneToCondition(makeActor([ALWAYS_ALERT_ID]), 'frightened')).toBe(false);
  });

  test("false without the Perk", () => {
    expect(isImmuneToCondition(makeActor(), 'surprised')).toBe(false);
  });

  test.each([
    ["GI Joe CRB", "Compendium.essence20.gi_joe_crb.Item.Vo5IeXooKE9OBoJH"],
    ["PR CRB", "Compendium.essence20.pr_crb.Item.oXyaZOw6L1AXiyCj"],
    ["MLP CRB", "Compendium.essence20.mlp_crb.Item.ZBOmQradsrZi9sc5"],
    ["WTNV Citizens' Guide", "Compendium.essence20.wtnv_citizens_guide.Item.LXK3ATRjFLfPg4mb"],
  ])("the %s printing grants the same Surprised immunity", (book, id) => {
    expect(isImmuneToCondition(makeActor([id]), 'surprised')).toBe(true);
    expect(isImmuneToCondition(makeActor([id]), 'frightened')).toBe(false);
  });
});

describe("isImmuneToCondition (Rapid Deployment Drills, Ferocious Fighters Force Recon Focus, 3rd level)", () => {
  const RAPID_DEPLOYMENT_DRILLS_ID = "Compendium.essence20.ferocious_fighters.Item.pQvXMpk7uAvfuGMl";

  test("true for surprised with the Perk, nothing else", () => {
    expect(isImmuneToCondition(makeActor([RAPID_DEPLOYMENT_DRILLS_ID]), 'surprised')).toBe(true);
    expect(isImmuneToCondition(makeActor([RAPID_DEPLOYMENT_DRILLS_ID]), 'frightened')).toBe(false);
  });
});

describe("isImmuneToCondition (Get Low, Technorganic Secrets Slitherer Origin Benefit, p.43) - gated on Alt Mode", () => {
  function makeGetLowActor({ perkIds = [], isTransformed = false } = {}) {
    const actor = makeActor(perkIds);
    actor.system = { isTransformed };
    return actor;
  }

  test("true for prone while holding the Perk AND in Alt Mode", () => {
    expect(isImmuneToCondition(makeGetLowActor({ perkIds: [GET_LOW_ID], isTransformed: true }), 'prone')).toBe(true);
  });

  test("false for prone while holding the Perk but NOT in Alt Mode", () => {
    expect(isImmuneToCondition(makeGetLowActor({ perkIds: [GET_LOW_ID], isTransformed: false }), 'prone')).toBe(false);
  });

  test("false without the Perk, even in Alt Mode", () => {
    expect(isImmuneToCondition(makeGetLowActor({ isTransformed: true }), 'prone')).toBe(false);
  });

  test("false for a Condition not covered by Get Low, even in Alt Mode", () => {
    expect(isImmuneToCondition(makeGetLowActor({ perkIds: [GET_LOW_ID], isTransformed: true }), 'frightened')).toBe(false);
  });
});

describe("isImmuneToCondition (Greased Lightning, Knights of Canterlot spell, p.43) - checkFn, not a held Perk", () => {
  function makeGreasedLightningActor({ active = false } = {}) {
    const actor = makeActor();
    const flagStore = { greasedLightningActive: active ? { epoch: 1, window: 'scene', count: 1 } : undefined };
    actor.getFlag = jest.fn((scope, key) => flagStore[key]);
    return actor;
  }

  test.each(['restrained', 'grappled'])("true for %s while the spell is active", (statusId) => {
    expect(isImmuneToCondition(makeGreasedLightningActor({ active: true }), statusId)).toBe(true);
  });

  test("false while inactive, even for a covered Condition", () => {
    expect(isImmuneToCondition(makeGreasedLightningActor({ active: false }), 'restrained')).toBe(false);
  });

  test("false for a Condition not covered by Greased Lightning, even while active", () => {
    expect(isImmuneToCondition(makeGreasedLightningActor({ active: true }), 'prone')).toBe(false);
  });
});

describe("isImmuneToCondition (Calming Words, Enigma of Combination, Counselor Focus, 3rd level) - checkFn, not a held Perk", () => {
  function makeCalmingWordsActor({ active = false } = {}) {
    const actor = makeActor();
    const flagStore = { calmingWordsBuffActive: active };
    actor.getFlag = jest.fn((scope, key) => flagStore[key]);
    return actor;
  }

  test.each(['frightened', 'mesmerized'])("true for %s while the buff is active", (statusId) => {
    expect(isImmuneToCondition(makeCalmingWordsActor({ active: true }), statusId)).toBe(true);
  });

  test("false while inactive, even for a covered Condition", () => {
    expect(isImmuneToCondition(makeCalmingWordsActor({ active: false }), 'frightened')).toBe(false);
  });

  test("false for a Condition not covered by Calming Words, even while active", () => {
    expect(isImmuneToCondition(makeCalmingWordsActor({ active: true }), 'prone')).toBe(false);
  });
});

describe("isImmuneToCondition (Battlefield Titan, Vanguard Focus, 9th level) - aura", () => {
  function makeToken({ actor, disposition = 1 } = {}) {
    return { actor, document: { disposition }, center: {} };
  }

  function makeActorWithToken({ perkIds = [], disposition = 1 } = {}) {
    const actor = makeActor(perkIds);
    const token = makeToken({ actor, disposition });
    actor.getActiveTokens = jest.fn(() => [token]);
    return { actor, token };
  }

  beforeEach(() => {
    canvas.tokens.placeables = [];
    canvas.grid.measurePath.mockReset();
    canvas.grid.measurePath.mockReturnValue({ distance: 0 });
  });

  test.each(['mesmerized', 'frightened'])("the holder is immune to %s themselves", (statusId) => {
    const { actor } = makeActorWithToken({ perkIds: [BATTLEFIELD_TITAN_ID] });
    expect(isImmuneToCondition(actor, statusId)).toBe(true);
  });

  test("an ally within 10 feet of the holder is also immune", () => {
    const { token: titanToken } = makeActorWithToken({ perkIds: [BATTLEFIELD_TITAN_ID] });
    const { actor: allyActor, token: allyToken } = makeActorWithToken();
    canvas.tokens.placeables = [titanToken, allyToken];
    canvas.grid.measurePath.mockReturnValue({ distance: 5 });

    expect(isImmuneToCondition(allyActor, 'frightened')).toBe(true);
  });

  test("doesn't apply beyond 10 feet", () => {
    const { token: titanToken } = makeActorWithToken({ perkIds: [BATTLEFIELD_TITAN_ID] });
    const { actor: allyActor, token: allyToken } = makeActorWithToken();
    canvas.tokens.placeables = [titanToken, allyToken];
    canvas.grid.measurePath.mockReturnValue({ distance: 15 });

    expect(isImmuneToCondition(allyActor, 'frightened')).toBe(false);
  });

  test("doesn't apply to a hostile token (not an ally)", () => {
    const { token: titanToken } = makeActorWithToken({ perkIds: [BATTLEFIELD_TITAN_ID], disposition: 1 });
    const { actor: enemyActor, token: enemyToken } = makeActorWithToken({ disposition: -1 });
    canvas.tokens.placeables = [titanToken, enemyToken];
    canvas.grid.measurePath.mockReturnValue({ distance: 5 });

    expect(isImmuneToCondition(enemyActor, 'frightened')).toBe(false);
  });

  test("doesn't cover a Condition outside its own list (e.g. Stunned)", () => {
    const { actor } = makeActorWithToken({ perkIds: [BATTLEFIELD_TITAN_ID] });
    expect(isImmuneToCondition(actor, 'stunned')).toBe(false);
  });

  test("an ally with no nearby Battlefield Titan holder is unaffected", () => {
    const { actor: allyActor, token: allyToken } = makeActorWithToken();
    canvas.tokens.placeables = [allyToken];

    expect(isImmuneToCondition(allyActor, 'frightened')).toBe(false);
  });
});
