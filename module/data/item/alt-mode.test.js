import { AltModeItemData } from "./alt-mode.mjs";

describe("AltModeItemData - each Mode's sizes, set with one trait selector", () => {
  test("an item with just its size lists that one size; one with a list keeps it", () => {
    const source = { altModesize: 'long', botModeSize: 'large' };
    AltModeItemData.migrateData(source);
    expect(source).toMatchObject({ altModeSizeOptions: ['long'], botModeSizeOptions: ['large'] });

    const chooses = { altModesize: 'large', altModeSizeOptions: ['large', 'huge'] };
    AltModeItemData.migrateData(chooses);
    expect(chooses.altModeSizeOptions).toEqual(['large', 'huge']);
  });

  test("a partial update without the size itself is left alone", () => {
    const partial = { altModeSizeOptions: [] };
    AltModeItemData.migrateData(partial);
    expect(partial).toEqual({ altModeSizeOptions: [] });
  });

  test("the size follows the list: a size no longer in it becomes the first that is", async () => {
    const model = Object.create(AltModeItemData.prototype);
    Object.assign(model, { altModesize: 'common', botModeSize: 'large' });
    const changes = { system: { altModeSizeOptions: ['huge', 'extended'], botModeSizeOptions: ['common', 'large'] } };
    await model._preUpdate(changes, {}, null);
    expect(changes.system.altModesize).toBe('huge');
    expect(changes.system.botModeSize).toBeUndefined();

    const cleared = { system: { altModeSizeOptions: [] } };
    await model._preUpdate(cleared, {}, null);
    expect(cleared.system.altModesize).toBeUndefined();
    const elsewhere = { name: 'Renamed' };
    await model._preUpdate(elsewhere, {}, null);
    expect(elsewhere).toEqual({ name: 'Renamed' });
  });
});
