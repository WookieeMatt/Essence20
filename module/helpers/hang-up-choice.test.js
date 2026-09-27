import { jest } from '@jest/globals';
import { applyHangUpChoice, pickHangUpDamageType } from './hang-up-choice.mjs';

function makeHangUp({ hasChoice = true, choiceType = 'damageType' } = {}) {
  return {
    type: 'hangUp',
    system: { hasChoice, choiceType, choice: null },
    update: jest.fn(),
  };
}

beforeEach(() => {
  global.game = { i18n: { localize: (k) => k } };
  global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } } };
});

afterEach(() => {
  global.game = undefined;
  global.foundry = undefined;
});

describe("pickHangUpDamageType", () => {
  test("offers the full damage type list, not just the Element sub-types", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('fire');

    await pickHangUpDamageType();

    const { content } = foundry.applications.api.DialogV2.wait.mock.calls[0][0];
    // Element sub-types AND types outside that set (RAW points at the core rulebook's full table).
    expect(content).toContain('value="fire"');
    expect(content).toContain('value="blunt"');
    expect(content).toContain('value="psychic"');
  });

  test("returns null when the picker is cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    expect(await pickHangUpDamageType()).toBe(null);
  });
});

describe("applyHangUpChoice", () => {
  test("records the chosen damage type on the Hang-Up", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cold');
    const hangUp = makeHangUp();

    await applyHangUpChoice(hangUp);

    expect(hangUp.update).toHaveBeenCalledWith({ 'system.choice': 'cold' });
  });

  test("is a no-op for a Hang-Up that declares no choice", async () => {
    const hangUp = makeHangUp({ hasChoice: false });

    await applyHangUpChoice(hangUp);

    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
    expect(hangUp.update).not.toHaveBeenCalled();
  });

  test("is a no-op for an unrecognized choiceType", async () => {
    const hangUp = makeHangUp({ choiceType: 'skills' });

    await applyHangUpChoice(hangUp);

    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
  });

  // The Hang-Up is mandatory, so a dismissed picker must still leave it granted, just unconfigured.
  test("still leaves the Hang-Up in place when the picker is cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const hangUp = makeHangUp();

    await applyHangUpChoice(hangUp);

    expect(hangUp.update).not.toHaveBeenCalled();
  });
});
