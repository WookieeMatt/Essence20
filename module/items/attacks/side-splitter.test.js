import { jest } from '@jest/globals';
import { activateSideSplitter, applySideSplitterDamage, pickSideSplitterDefense } from './side-splitter.mjs';

global.game = { user: { targets: { first: jest.fn() } }, i18n: { localize: jest.fn((key) => key) } };
global.ui = { notifications: { warn: jest.fn() } };

function makeActor() {
  return { _dice: { rollSkill: jest.fn() } };
}

function makeTargetActor() {
  return { uuid: 'Actor.target1', system: { health: { value: 5, max: 10 }, immunities: {} }, update: jest.fn() };
}

describe("pickSideSplitterDefense", () => {
  let waitMock;

  beforeEach(() => {
    waitMock = jest.fn();
    global.foundry = { applications: { api: { DialogV2: { wait: waitMock } } } };
  });

  test("returns the chosen Defense on confirm", async () => {
    waitMock.mockResolvedValue('cleverness');
    expect(await pickSideSplitterDefense()).toBe('cleverness');
  });

  test("returns null when cancelled", async () => {
    waitMock.mockResolvedValue('cancel');
    expect(await pickSideSplitterDefense()).toBeNull();
  });
});

describe("activateSideSplitter", () => {
  beforeEach(() => {
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } } };
  });

  afterEach(() => {
    game.user.targets.first.mockReset();
  });

  test("rolls Performance vs the chosen Defense against the currently-targeted actor", async () => {
    const target = makeTargetActor();
    game.user.targets.first.mockReturnValue({ actor: target });
    foundry.applications.api.DialogV2.wait.mockResolvedValue('willpower');
    const actor = makeActor();

    const result = await activateSideSplitter(actor);

    expect(result).toBe(target);
    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        skill: 'performance', defenseType: 'willpower', isSideSplitterAttempt: true, sideSplitterTargetUuid: 'Actor.target1',
      }),
      actor,
    );
  });

  test("warns and does nothing without a target", async () => {
    game.user.targets.first.mockReturnValue(undefined);
    const result = await activateSideSplitter(makeActor());
    expect(result).toBeNull();
    expect(ui.notifications.warn).toHaveBeenCalled();
  });

  test("does nothing if the Defense picker is cancelled", async () => {
    game.user.targets.first.mockReturnValue({ actor: makeTargetActor() });
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const actor = makeActor();

    const result = await activateSideSplitter(actor);

    expect(result).toBe(false);
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });
});

describe("applySideSplitterDamage", () => {
  test("applies 1 damage to the target", async () => {
    const target = makeTargetActor();
    await applySideSplitterDamage(target);
    expect(target.update).toHaveBeenCalledWith(expect.objectContaining({ 'system.health.value': 4 }));
  });
});
