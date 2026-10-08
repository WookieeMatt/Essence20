import { jest } from '@jest/globals';
import {
  HEALTH_MODES,
  buildSwapUpdate,
  canSwapTokenForm,
  carryOverHealth,
  getLinkCandidates,
  getLinkedForm,
  linkGrownForm,
  unlinkGrownForm,
  swapTokenForm,
} from "./monster-grow-swap.mjs";

const makeActor = (flags = {}, system = {}) => ({
  id: 'actor-1',
  name: 'Polluticorn',
  getFlag: (scope, key) => flags[key],
  system: { size: 'large', health: { value: 7, max: 7 }, ...system },
  prototypeToken: { texture: { src: 'normal.png' } },
});

describe("carryOverHealth", () => {
  test("keeps the same fraction of maximum by default", () => {
    // A Threat worn down to 3/7 grows into 6/13 rather than being handed a fresh health bar.
    expect(carryOverHealth(3, 7, 13)).toBe(6);
    expect(carryOverHealth(7, 7, 13)).toBe(13);
  });

  test("never drops a standing Threat to zero through rounding", () => {
    expect(carryOverHealth(1, 20, 4)).toBe(1);
  });

  test("keeps a Threat at zero if it was already at zero", () => {
    expect(carryOverHealth(0, 7, 13)).toBe(0);
  });

  test("keeps the raw number in absolute mode, capped at the new maximum", () => {
    // Heximas's own stat block describes carrying damage across forms this way.
    expect(carryOverHealth(3, 7, 13, HEALTH_MODES.absolute)).toBe(3);
    expect(carryOverHealth(13, 20, 7, HEALTH_MODES.absolute)).toBe(7);
  });

  test("heals to the new maximum in full mode", () => {
    expect(carryOverHealth(1, 7, 13, HEALTH_MODES.full)).toBe(13);
  });

  test("returns zero when the target form has no Health at all", () => {
    expect(carryOverHealth(5, 7, 0)).toBe(0);
  });

  test("falls back to full when the old maximum is unusable", () => {
    expect(carryOverHealth(5, 0, 13)).toBe(13);
  });
});

describe("getLinkedForm", () => {
  test("finds a Grown form from a Normal one", () => {
    expect(getLinkedForm(makeActor({ grownFormId: 'grown-1' })))
      .toEqual({ id: 'grown-1', direction: 'grow' });
  });

  test("finds a Normal form from a Grown one", () => {
    expect(getLinkedForm(makeActor({ normalFormId: 'normal-1' })))
      .toEqual({ id: 'normal-1', direction: 'shrink' });
  });

  test("prefers the Grown link when an actor somehow carries both", () => {
    expect(getLinkedForm(makeActor({ grownFormId: 'g', normalFormId: 'n' })).direction).toBe('grow');
  });

  test("returns null for an unlinked Threat", () => {
    expect(getLinkedForm(makeActor())).toBeNull();
    expect(getLinkedForm(null)).toBeNull();
  });
});

describe("getLinkCandidates", () => {
  /*
   * The case this exists for: a printed page carries the Normal and Grown blocks together, and the
   * importer's batch mode creates both as separate, unlinked Actors. Without a way to pair them by
   * hand the swap can never be used on them.
   */
  const make = (id, name, type = 'npc', flags = {}) => ({
    id, name, type, getFlag: (scope, key) => flags[key],
  });

  const self = make('a', 'Polluticorn (Normal)');
  const actors = [
    self,
    make('b', 'Polluticorn (grown)'),
    make('c', 'Putty Patroller'),
    make('d', 'Some Vehicle', 'vehicle'),
    make('e', 'Already Paired', 'npc', { normalFormId: 'someone-else' }),
    make('f', 'Paired To Me', 'npc', { normalFormId: 'a' }),
  ];

  test("offers other actors of the same type", () => {
    expect(getLinkCandidates(self, actors).map(a => a.id)).toEqual(expect.arrayContaining(['b', 'c']));
  });

  test("never offers the actor itself", () => {
    expect(getLinkCandidates(self, actors).map(a => a.id)).not.toContain('a');
  });

  test("never offers a different actor type", () => {
    expect(getLinkCandidates(self, actors).map(a => a.id)).not.toContain('d');
  });

  test("never offers an actor already paired with someone else", () => {
    expect(getLinkCandidates(self, actors).map(a => a.id)).not.toContain('e');
  });

  test("still offers the actor already paired with THIS one, so the pairing stays visible", () => {
    expect(getLinkCandidates(self, actors).map(a => a.id)).toContain('f');
  });

  test("copes with no actors at all", () => {
    expect(getLinkCandidates(self, [])).toEqual([]);
    expect(getLinkCandidates(self, null)).toEqual([]);
  });
});

describe("linkGrownForm / unlinkGrownForm", () => {
  const makeLinkable = (id, name, flags = {}) => ({
    id,
    name,
    type: 'npc',
    flags,
    getFlag: (scope, key) => flags[key],
    setFlag: jest.fn(async (scope, key, value) => {
      flags[key] = value;
    }),
    unsetFlag: jest.fn(async (scope, key) => {
      delete flags[key];
    }),
  });

  let normal;
  let grownActor;

  beforeEach(() => {
    normal = makeLinkable('n1', 'Polluticorn (Normal)');
    grownActor = makeLinkable('g1', 'Polluticorn (grown)');
    global.game.actors = { get: (id) => [normal, grownActor].find(a => a.id === id) ?? null };
  });

  afterEach(() => {
    delete global.game.actors;
  });

  test("writes both halves of the pairing", async () => {
    await expect(linkGrownForm(normal, grownActor)).resolves.toBe(true);
    expect(normal.flags.grownFormId).toBe('g1');
    expect(grownActor.flags.normalFormId).toBe('n1');
  });

  test("makes the pairing discoverable from either side", async () => {
    await linkGrownForm(normal, grownActor);
    expect(getLinkedForm(normal)).toEqual({ id: 'g1', direction: 'grow' });
    expect(getLinkedForm(grownActor)).toEqual({ id: 'n1', direction: 'shrink' });
  });

  test("refuses to link an actor to itself", async () => {
    await expect(linkGrownForm(normal, normal)).resolves.toBe(false);
    expect(normal.flags.grownFormId).toBeUndefined();
  });

  test("refuses a missing partner", async () => {
    await expect(linkGrownForm(normal, null)).resolves.toBe(false);
  });

  test("clears both sides on unlink, given either half", async () => {
    await linkGrownForm(normal, grownActor);
    await expect(unlinkGrownForm(grownActor)).resolves.toBe(true);
    expect(normal.flags.grownFormId).toBeUndefined();
    expect(grownActor.flags.normalFormId).toBeUndefined();
  });

  test("reports nothing to do when unlinking an unpaired actor", async () => {
    await expect(unlinkGrownForm(normal)).resolves.toBe(false);
  });

  test("re-linking clears the previous pairing so no actor is claimed twice", async () => {
    const other = makeLinkable('g2', 'A Different Grown Form');
    global.game.actors = { get: (id) => [normal, grownActor, other].find(a => a.id === id) ?? null };

    await linkGrownForm(normal, grownActor);
    await linkGrownForm(normal, other);

    // The first partner must not be left pointing back at a Threat that has moved on.
    expect(grownActor.flags.normalFormId).toBeUndefined();
    expect(normal.flags.grownFormId).toBe('g2');
    expect(other.flags.normalFormId).toBe('n1');
  });
});

describe("canSwapTokenForm", () => {
  test("is true only when the token's actor has a linked form", () => {
    expect(canSwapTokenForm({ actor: makeActor({ grownFormId: 'g' }) })).toBe(true);
    expect(canSwapTokenForm({ actor: makeActor() })).toBe(false);
    expect(canSwapTokenForm(null)).toBe(false);
  });
});

describe("buildSwapUpdate", () => {
  /*
   * The exact payload shape matters and was established by a live v14 spike: the ActorDelta is
   * merged rather than replaced, so carried-over Health has to be written explicitly; and token
   * dimensions do not follow a repointed actorId, so they are set here.
   */
  test("repoints the actor, renames, and resizes in one payload", () => {
    expect(buildSwapUpdate({
      actorId: 'grown-1', name: 'Polluticorn (Grown)',
      tokenSize: { width: 4, height: 4 }, health: 6,
    })).toEqual({
      actorId: 'grown-1',
      name: 'Polluticorn (Grown)',
      width: 4,
      height: 4,
      'delta.system.health.value': 6,
    });
  });

  test("omits the Health write when there is nothing to carry", () => {
    const update = buildSwapUpdate({
      actorId: 'g', name: 'n', tokenSize: { width: 1, height: 1 }, health: null,
    });
    expect(update['delta.system.health.value']).toBeUndefined();
  });

  test("includes a texture only when one is given", () => {
    expect(buildSwapUpdate({
      actorId: 'g', name: 'n', tokenSize: { width: 1, height: 1 }, health: 1, texture: 'grown.png',
    })['texture.src']).toBe('grown.png');
  });
});

describe("swapTokenForm", () => {
  const grown = {
    id: 'grown-1',
    name: 'Polluticorn (Grown)',
    system: { size: 'gigantic', health: { max: 13 } },
    prototypeToken: { texture: { src: 'grown.png' } },
  };

  let update;
  let combatantUpdate;

  beforeEach(() => {
    update = jest.fn();
    combatantUpdate = jest.fn();
    global.game.actors = { get: (id) => (id === 'grown-1' ? grown : null) };
    global.game.combats = [];
    global.game.settings.get = jest.fn(() => 'proportional');
  });

  afterEach(() => {
    delete global.game.actors;
    delete global.game.combats;
  });

  const makeToken = (flags) => ({
    id: 'token-1',
    name: 'Polluticorn',
    actor: makeActor(flags, { health: { value: 3, max: 7 } }),
    update,
  });

  test("returns null and writes nothing for an unlinked Threat", async () => {
    await expect(swapTokenForm(makeToken({}))).resolves.toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  test("repoints the token at the linked form with proportional Health", async () => {
    const result = await swapTokenForm(makeToken({ grownFormId: 'grown-1' }));

    expect(result).toBe(grown);
    expect(update).toHaveBeenCalledWith({
      actorId: 'grown-1',
      name: 'Polluticorn (Grown)',
      width: 4,
      height: 4,
      'delta.system.health.value': 6,
      'texture.src': 'grown.png',
    });
  });

  test("keeps the token's own name when asked to", async () => {
    await swapTokenForm(makeToken({ grownFormId: 'grown-1' }), { keepName: true });
    expect(update.mock.calls[0][0].name).toBe('Polluticorn');
  });

  test("honours an explicit health mode over the world setting", async () => {
    await swapTokenForm(makeToken({ grownFormId: 'grown-1' }), { healthMode: HEALTH_MODES.full });
    expect(update.mock.calls[0][0]['delta.system.health.value']).toBe(13);
  });

  test("updates a Combatant whose actorId would otherwise go stale", async () => {
    // Verified live: a stale actorId silently drops the token out of getCombatantsByActor.
    global.game.combats = [{
      combatants: [{ tokenId: 'token-1', actorId: 'actor-1', update: combatantUpdate }],
    }];
    global.game.combats[0].combatants.find = Array.prototype.find.bind(global.game.combats[0].combatants);

    await swapTokenForm(makeToken({ grownFormId: 'grown-1' }));
    expect(combatantUpdate).toHaveBeenCalledWith({ actorId: 'grown-1' });
  });

  test("warns rather than throwing when the linked form has been deleted", async () => {
    const result = await swapTokenForm(makeToken({ grownFormId: 'missing' }));
    expect(result).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });
});
