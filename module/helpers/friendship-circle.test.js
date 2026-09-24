import {
  BEST_FRIENDSHIP_CIRCLE_ID, circleLimit, newCircle, joinCircle, drawFromPool, isCircleOver, endsAtTurnEnd,
} from './friendship-circle.mjs';

const pony = (id, perks = []) => ({
  uuid: `Actor.${id}`,
  items: perks.map(perkId => ({ type: 'perk', flags: { core: { sourceId: perkId } } })),
});

describe("circleLimit", () => {
  test("one Circle a scene", () => {
    expect(circleLimit([pony('a'), pony('b')])).toBe(1);
  });

  // "your group can form a Friendship Circle twice per scene" - the upgrade is the group's.
  test("two once anypony in the group has Best Friendship Circle", () => {
    expect(circleLimit([pony('a'), pony('b', [BEST_FRIENDSHIP_CIRCLE_ID])])).toBe(2);
  });

  test("an empty group forms one", () => {
    expect(circleLimit([])).toBe(1);
  });
});

describe("newCircle / joinCircle", () => {
  const combat = { id: 'c1', round: 2, turn: 1 };

  test("a new Circle is the former alone, with one of everything", () => {
    expect(newCircle('Actor.r', { epoch: 4, combat })).toEqual({
      formerUuid: 'Actor.r', members: ['Actor.r'], upshifts: 1, healing: 1, assists: 1,
      epoch: 4, combatId: 'c1', round: 2, turn: 1,
    });
  });

  test("out of combat the position is null", () => {
    expect(newCircle('Actor.r', { epoch: 4, combat: null })).toMatchObject({ combatId: null, round: null, turn: null });
  });

  // The book's own example: Rarity forms, Fluttershy and Rainbow Dash join - a pool of three.
  test("each pony who joins adds one to every pool", () => {
    let circle = newCircle('Actor.rarity', { epoch: 4, combat });
    circle = joinCircle(circle, 'Actor.fluttershy');
    circle = joinCircle(circle, 'Actor.rainbow');
    expect(circle).toMatchObject({ members: ['Actor.rarity', 'Actor.fluttershy', 'Actor.rainbow'], upshifts: 3, healing: 3, assists: 3 });
  });

  test("joining twice changes nothing", () => {
    const circle = joinCircle(newCircle('Actor.r', { epoch: 4, combat }), 'Actor.r');
    expect(circle.members).toEqual(['Actor.r']);
    expect(circle.upshifts).toBe(1);
  });
});

describe("drawFromPool", () => {
  const circle = () => joinCircle(newCircle('Actor.r', { epoch: 4, combat: null }), 'Actor.f');

  // "the bonuses can be split unevenly": Rarity takes all three upshifts.
  test("any member may draw, down to nothing", () => {
    let c = circle();
    c = drawFromPool(c, 'upshifts', 'Actor.r');
    c = drawFromPool(c, 'upshifts', 'Actor.r');
    expect(c).toMatchObject({ upshifts: 0, healing: 2, assists: 2 });
    expect(drawFromPool(c, 'upshifts', 'Actor.r')).toBeNull();
  });

  test("a pony outside the Circle draws nothing", () => {
    expect(drawFromPool(circle(), 'healing', 'Actor.stranger')).toBeNull();
  });

  test("an unknown pool, or no Circle, is nothing", () => {
    expect(drawFromPool(circle(), 'cupcakes', 'Actor.r')).toBeNull();
    expect(drawFromPool(null, 'healing', 'Actor.r')).toBeNull();
  });
});

describe("isCircleOver", () => {
  test("a Circle from an earlier scene is over", () => {
    expect(isCircleOver(newCircle('Actor.r', { epoch: 3, combat: null }), { epoch: 4, combat: null })).toBe(true);
  });

  test("a Circle formed in a combat that has ended is over", () => {
    const circle = newCircle('Actor.r', { epoch: 4, combat: { id: 'c1', round: 1, turn: 0 } });
    expect(isCircleOver(circle, { epoch: 4, combat: null })).toBe(true);
    expect(isCircleOver(circle, { epoch: 4, combat: { id: 'c2' } })).toBe(true);
    expect(isCircleOver(circle, { epoch: 4, combat: { id: 'c1' } })).toBe(false);
  });

  test("a Circle formed out of combat lasts the scene, combat or not", () => {
    const circle = newCircle('Actor.r', { epoch: 4, combat: null });
    expect(isCircleOver(circle, { epoch: 4, combat: { id: 'c1' } })).toBe(false);
  });

  test("no Circle is over", () => {
    expect(isCircleOver(null, { epoch: 4, combat: null })).toBe(true);
  });
});

describe("endsAtTurnEnd", () => {
  const circle = newCircle('Actor.r', { epoch: 4, combat: { id: 'c1', round: 2, turn: 1 } });

  // Formed as a Standard action on Rarity's turn in round 2; it lasts until the end of her NEXT
  // turn, in round 3 - not the end of the turn she formed it in.
  test("not at the end of the turn it was formed in", () => {
    expect(endsAtTurnEnd(circle, 'Actor.r', { id: 'c1', round: 2, turn: 1 })).toBe(false);
  });

  test("at the end of the former's next turn", () => {
    expect(endsAtTurnEnd(circle, 'Actor.r', { id: 'c1', round: 3, turn: 1 })).toBe(true);
  });

  test("not at the end of anypony else's turn", () => {
    expect(endsAtTurnEnd(circle, 'Actor.f', { id: 'c1', round: 3, turn: 2 })).toBe(false);
  });

  test("not in some other combat, or with no Circle", () => {
    expect(endsAtTurnEnd(circle, 'Actor.r', { id: 'c2', round: 3, turn: 1 })).toBe(false);
    expect(endsAtTurnEnd(null, 'Actor.r', { id: 'c1', round: 3, turn: 1 })).toBe(false);
  });
});

