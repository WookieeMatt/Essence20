import { jest } from '@jest/globals';
import {
  getItemPacks,
  getGroupedItemPacks,
  isSourcebookEnabled,
  getVisibleItemPacks,
  syncSourcebookOwnership,
} from "./compendium-browser.mjs";

function makePack({ id, label, documentName = "Item", folderName = null, ownership = { PLAYER: "OBSERVER", ASSISTANT: "OWNER" } }) {
  return {
    documentName,
    metadata: { id, label },
    folder: folderName ? { name: folderName } : null,
    ownership,
    configure: jest.fn(),
  };
}

describe("getItemPacks", () => {
  afterEach(() => {
    global.game.packs = [];
  });

  test("only returns Item-type packs", () => {
    global.game.packs = [
      makePack({ id: "a", label: "A" }),
      { documentName: "Actor", metadata: { id: "b", label: "B" } },
    ];

    expect(getItemPacks().map(pack => pack.metadata.id)).toEqual(["a"]);
  });
});

describe("getGroupedItemPacks", () => {
  afterEach(() => {
    global.game.packs = [];
  });

  test("groups packs by folder name, sorted, with unfoldered packs under Other last", () => {
    global.game.packs = [
      makePack({ id: "z", label: "Z Book", folderName: "GI Joe" }),
      makePack({ id: "a", label: "A Book", folderName: "GI Joe" }),
      makePack({ id: "orphan", label: "Orphan Book" }),
      makePack({ id: "mlp1", label: "MLP Book", folderName: "My Little Pony" }),
    ];

    const groups = getGroupedItemPacks();

    expect(groups.map(group => group.name)).toEqual(["GI Joe", "My Little Pony", "E20.CompendiumBrowserOtherBooks"]);
    expect(groups[0].packs.map(pack => pack.metadata.id)).toEqual(["a", "z"]);
    expect(groups[2].packs.map(pack => pack.metadata.id)).toEqual(["orphan"]);
  });
});

describe("isSourcebookEnabled", () => {
  test("is enabled by default when absent from the setting", () => {
    global.game.settings.get = jest.fn(() => ({}));
    expect(isSourcebookEnabled("essence20.foo")).toBe(true);
  });

  test("is disabled when explicitly set to false", () => {
    global.game.settings.get = jest.fn(() => ({ "essence20.foo": false }));
    expect(isSourcebookEnabled("essence20.foo")).toBe(false);
  });
});

describe("getVisibleItemPacks", () => {
  afterEach(() => {
    global.game.packs = [];
  });

  test("filters out disabled packs for everyone, GM included", () => {
    global.game.packs = [
      makePack({ id: "enabled", label: "Enabled" }),
      makePack({ id: "disabled", label: "Disabled" }),
    ];
    global.game.settings.get = jest.fn(() => ({ disabled: false }));

    expect(getVisibleItemPacks().map(pack => pack.metadata.id)).toEqual(["enabled"]);
  });
});

describe("syncSourcebookOwnership", () => {
  afterEach(() => {
    global.game.packs = [];
  });

  test("hides a disabled pack from players by setting ownership.PLAYER to NONE", async () => {
    const pack = makePack({ id: "disabled", label: "Disabled" });
    global.game.packs = [pack];
    global.game.settings.get = jest.fn(() => ({ disabled: false }));

    await syncSourcebookOwnership();

    expect(pack.configure).toHaveBeenCalledWith({ ownership: { PLAYER: "NONE", ASSISTANT: "OWNER" } });
  });

  test("restores an enabled pack's ownership.PLAYER to OBSERVER", async () => {
    const pack = makePack({ id: "enabled", label: "Enabled", ownership: { PLAYER: "NONE", ASSISTANT: "OWNER" } });
    global.game.packs = [pack];
    global.game.settings.get = jest.fn(() => ({}));

    await syncSourcebookOwnership();

    expect(pack.configure).toHaveBeenCalledWith({ ownership: { PLAYER: "OBSERVER", ASSISTANT: "OWNER" } });
  });

  test("skips packs whose ownership already matches, to avoid unnecessary writes", async () => {
    const pack = makePack({ id: "enabled", label: "Enabled" });
    global.game.packs = [pack];
    global.game.settings.get = jest.fn(() => ({}));

    await syncSourcebookOwnership();

    expect(pack.configure).not.toHaveBeenCalled();
  });
});
