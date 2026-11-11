import { jest } from '@jest/globals';
import { isAutoBlindEnabled, isLinkedStatusClient, resyncAutoBlindEverywhere, syncAutoBlindStatus, syncAutoImmobilizedStatus } from "./linked-status-sync.mjs";

describe("syncAutoBlindStatus", () => {
  const blinded = () => ({ statuses: new Set(['blinded']), getFlag: () => true, delete: jest.fn() });

  // Defeated adds several statuses at once; each fired a sync before the first one's Blinded had landed.
  test("syncs fired together add one Blinded, not one each", async () => {
    const effects = [];
    const actor = {
      uuid: 'Actor.together',
      statuses: new Set(['unconscious']),
      effects,
      createEmbeddedDocuments: jest.fn(async () => {
        await Promise.resolve();
        effects.push(blinded());
      }),
    };
    await Promise.all([syncAutoBlindStatus(actor), syncAutoBlindStatus(actor), syncAutoBlindStatus(actor)]);
    expect(actor.createEmbeddedDocuments).toHaveBeenCalledTimes(1);
  });

  test("clears the extra auto-applied copies left by older versions", async () => {
    const [first, second, third] = [blinded(), blinded(), blinded()];
    const actor = { uuid: 'Actor.extras', statuses: new Set(['unconscious']), effects: [first, second, third], createEmbeddedDocuments: jest.fn() };
    await syncAutoBlindStatus(actor);
    expect(first.delete).not.toHaveBeenCalled();
    expect(second.delete).toHaveBeenCalled();
    expect(third.delete).toHaveBeenCalled();
  });
});

describe("the auto-blind setting", () => {
  const blinded = flag => ({ statuses: new Set(['blinded']), getFlag: () => flag, delete: jest.fn() });

  afterEach(() => {
    delete global.game.settings;
    delete global.game.actors;
    delete global.game.scenes;
  });

  test("off: an Unconscious actor loses the auto Blinded and gets no new one; a hand-applied one stays", async () => {
    global.game.settings = { get: () => false };
    const [auto, manual] = [blinded(true), blinded(false)];
    const actor = { uuid: 'Actor.off', statuses: new Set(['unconscious']), effects: [auto, manual], createEmbeddedDocuments: jest.fn() };
    await syncAutoBlindStatus(actor);
    expect(auto.delete).toHaveBeenCalled();
    expect(manual.delete).not.toHaveBeenCalled();

    const fresh = { uuid: 'Actor.off2', statuses: new Set(['asleep']), effects: [], createEmbeddedDocuments: jest.fn() };
    await syncAutoBlindStatus(fresh);
    expect(fresh.createEmbeddedDocuments).not.toHaveBeenCalled();
  });

  test("defaults to on when the setting can't be read", () => {
    global.game.settings = { get: () => {
      throw new Error('not registered'); 
    } };
    expect(isAutoBlindEnabled()).toBe(true);
  });

  test("changing it re-checks world actors and unlinked token actors, on the active GM only", async () => {
    global.game.settings = { get: () => false };
    const make = id => ({ uuid: id, statuses: new Set(['unconscious']), effects: [blinded(true)], createEmbeddedDocuments: jest.fn() });
    const [world, synthetic, linked] = [make('Actor.w'), make('Token.t.Actor.s'), make('Actor.linked')];
    global.game.actors = [world];
    global.game.scenes = [{ tokens: [{ actorLink: false, actor: synthetic }, { actorLink: true, actor: linked }] }];

    global.game.user = { id: 'player', isActiveGM: false };
    await resyncAutoBlindEverywhere();
    expect(world.effects[0].delete).not.toHaveBeenCalled();

    global.game.user = { id: 'gm', isActiveGM: true };
    await resyncAutoBlindEverywhere();
    expect(world.effects[0].delete).toHaveBeenCalled();
    expect(synthetic.effects[0].delete).toHaveBeenCalled();
    expect(linked.effects[0].delete).not.toHaveBeenCalled();
  });
});

describe("isLinkedStatusClient", () => {
  afterEach(() => {
    delete global.game.users;
  });

  test("the active GM does it; with no GM on, whoever made the change", () => {
    global.game.user = { id: 'me' };
    global.game.users = { activeGM: { id: 'gm' } };
    expect(isLinkedStatusClient('me')).toBe(false);
    global.game.users = { activeGM: { id: 'me' } };
    expect(isLinkedStatusClient('player')).toBe(true);
    global.game.users = { activeGM: null };
    expect(isLinkedStatusClient('me')).toBe(true);
    expect(isLinkedStatusClient('player')).toBe(false);
  });
});

describe("syncAutoImmobilizedStatus", () => {
  function makeActor({ restrained, immobilizedEffect } = {}) {
    const effects = immobilizedEffect ? [immobilizedEffect] : [];
    return {
      statuses: new Set(restrained ? ['restrained'] : []),
      effects,
      createEmbeddedDocuments: jest.fn(),
    };
  }

  test("does nothing when not Restrained and no auto-Immobilized effect exists", async () => {
    const actor = makeActor({});
    await syncAutoImmobilizedStatus(actor);
    expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
  });

  test("adds an auto-flagged Immobilized effect when Restrained and none exists yet", async () => {
    const actor = makeActor({ restrained: true });
    await syncAutoImmobilizedStatus(actor);
    expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', [expect.objectContaining({
      updateSource: expect.any(Function),
    })]);
  });

  test("doesn't add a second effect when one already exists", async () => {
    const existing = { statuses: new Set(['immobilized']), getFlag: () => true, delete: jest.fn() };
    const actor = makeActor({ restrained: true, immobilizedEffect: existing });
    await syncAutoImmobilizedStatus(actor);
    expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
  });

  test("removes the auto-applied Immobilized effect once no longer Restrained", async () => {
    const existing = { statuses: new Set(['immobilized']), getFlag: () => true, delete: jest.fn() };
    const actor = makeActor({ restrained: false, immobilizedEffect: existing });
    await syncAutoImmobilizedStatus(actor);
    expect(existing.delete).toHaveBeenCalled();
  });

  test("leaves a manually-applied Immobilized effect alone when Restrained ends", async () => {
    const existing = { statuses: new Set(['immobilized']), getFlag: () => false, delete: jest.fn() };
    const actor = makeActor({ restrained: false, immobilizedEffect: existing });
    await syncAutoImmobilizedStatus(actor);
    expect(existing.delete).not.toHaveBeenCalled();
  });

  test("no-ops for a null actor", async () => {
    await expect(syncAutoImmobilizedStatus(null)).resolves.toBeUndefined();
  });
});
