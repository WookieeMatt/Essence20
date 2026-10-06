import { jest } from '@jest/globals';
import { clearVoiceOfPrimusAssistReady, hasVoiceOfPrimusAssistReady } from './voice-of-primus.mjs';

// The Assist mode's DIF 12 Persuasion success writes the flag through the Perk's own Use rule
// (rules/conv14-banked.test.js); Lend Assistance reads and clears it here.
global.game = { combat: null };

function makeFlaggedActor(flags = {}) {
  return {
    getFlag: jest.fn((scope, key) => flags[key]),
    unsetFlag: jest.fn(async (scope, key) => {
      delete flags[key];
    }),
  };
}

describe("hasVoiceOfPrimusAssistReady / clearVoiceOfPrimusAssistReady", () => {
  test("reads the flag the Use rule writes, clear then reads false", async () => {
    const actor = makeFlaggedActor();
    expect(hasVoiceOfPrimusAssistReady(actor)).toBe(false);

    const ready = makeFlaggedActor({ voiceOfPrimusAssistReady: true });
    expect(hasVoiceOfPrimusAssistReady(ready)).toBe(true);

    await clearVoiceOfPrimusAssistReady(ready);
    expect(hasVoiceOfPrimusAssistReady(ready)).toBe(false);
  });
});
