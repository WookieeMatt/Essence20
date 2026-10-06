import { jest } from '@jest/globals';
import { pickMindBeamEffect } from './mind-beam.mjs';

describe("pickMindBeamEffect", () => {
  let waitMock;

  beforeEach(() => {
    waitMock = jest.fn();
    global.foundry = { applications: { api: { DialogV2: { wait: waitMock } } } };
    global.game = { i18n: { localize: jest.fn((key) => key) } };
  });

  test("returns the chosen effect on confirm", async () => {
    waitMock.mockResolvedValue('stunned');
    expect(await pickMindBeamEffect()).toBe('stunned');
  });

  test("returns null when cancelled", async () => {
    waitMock.mockResolvedValue('cancel');
    expect(await pickMindBeamEffect()).toBeNull();
  });
});
