import { jest } from '@jest/globals';
import { syncAutoImmobilizedStatus } from "./linked-status-sync.mjs";

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
