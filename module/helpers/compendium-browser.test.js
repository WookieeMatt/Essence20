import { jest } from '@jest/globals';
import {
  getItemPacks,
  getGroupedItemPacks,
  isSourcebookEnabled,
  getVisibleItemPacks,
  syncSourcebookOwnership,
  applyGameLineToSourcebooks,
} from "./compendium-browser.mjs";

function makePack({ id, label, documentName = "Item", folderName = null, ownership = { PLAYER: "OBSERVER", ASSISTANT: "OWNER" }, packageType = "system", packageName = "essence20" }) {
  return {
    documentName,
    metadata: { id, label, packageType, packageName },
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

describe("applyGameLineToSourcebooks", () => {
  let saved;

  beforeEach(() => {
    saved = {};
    global.game.user = { isGM: true };
    global.game.settings.set = jest.fn((scope, key, value) => {
      saved[key] = value;
    });
    global.game.settings.get = jest.fn(() => saved.enabledSourcebooks ?? {});
    global.game.packs = [
      makePack({ id: "gij1", label: "GI Joe CRB", folderName: "GI Joe" }),
      makePack({ id: "gij2", label: "Hawk's Files", folderName: "GI Joe" }),
      makePack({ id: "mlp1", label: "MLP CRB", folderName: "My Little Pony" }),
      makePack({ id: "pr1", label: "PR CRB", folderName: "Power Rangers" }),
      makePack({ id: "tf1", label: "TF CRB", folderName: "Transformers" }),
      makePack({ id: "wtnv1", label: "Citizens' Guide", folderName: "Welcome to Night Vale" }),
      // A system book in no folder: Field Guide to Action and Adventure is the real one.
      makePack({ id: "fieldguide", label: "Field Guide" }),
      // Not ours - a module's own compendium, foldered or not.
      makePack({ id: "modpack", label: "Some Module", folderName: "Third Party Stuff", packageType: "module", packageName: "some-module" }),
      makePack({ id: "worldpack", label: "World Content", packageType: "world", packageName: "my-world" }),
    ];
  });

  afterEach(() => {
    global.game.packs = [];
    delete global.game.user;
  });

  const disabledIds = () => Object.keys(saved.enabledSourcebooks ?? {}).sort();

  test("disables every other line's books and keeps the chosen line's", async () => {
    await applyGameLineToSourcebooks("giJoe");

    expect(disabledIds()).toEqual(["fieldguide", "mlp1", "pr1", "tf1", "wtnv1"]);
    // Every disabled entry is recorded as false - the setting stores only exclusions.
    expect(Object.values(saved.enabledSourcebooks).every(v => v === false)).toBe(true);
  });

  test("never touches packs that are not this system's", async () => {
    await applyGameLineToSourcebooks("myLittlePony");

    // Picking a line must not reach into a module's or the world's own compendiums, however
    // they are foldered.
    expect(disabledIds()).not.toContain("modpack");
    expect(disabledIds()).not.toContain("worldpack");
  });

  test("disables a system book that sits in no line folder", async () => {
    // Field Guide to Action and Adventure is cross-line, so it has no folder. "Not from any
    // one game" is still not "from this game", and it used to stay on under every line.
    await applyGameLineToSourcebooks("myLittlePony");

    expect(disabledIds()).toContain("fieldguide");
    expect(disabledIds()).toEqual(["fieldguide", "gij1", "gij2", "pr1", "tf1", "wtnv1"]);
  });

  test("an empty line re-enables everything", async () => {
    await applyGameLineToSourcebooks("transformers");
    expect(disabledIds().length).toBeGreaterThan(0);

    await applyGameLineToSourcebooks("");
    expect(disabledIds()).toEqual([]);
  });

  test("switching lines replaces the previous selection rather than adding to it", async () => {
    await applyGameLineToSourcebooks("giJoe");
    await applyGameLineToSourcebooks("powerRangers");

    // The GI Joe books are back on and the Power Rangers ones are off - not both sets off.
    expect(disabledIds()).toEqual(["fieldguide", "gij1", "gij2", "mlp1", "tf1", "wtnv1"]);
  });

  test("does nothing for a non-GM: the setting and pack ownership are both world-scoped", async () => {
    global.game.user = { isGM: false };

    await applyGameLineToSourcebooks("giJoe");

    expect(global.game.settings.set).not.toHaveBeenCalled();
  });
});
