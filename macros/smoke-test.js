/**
 * Essence20 sheet smoke test.
 *
 * Fills the gap Quench would normally cover (see docs/QA_PLAN.md) without depending on it -
 * Quench's last release (v0.10.0, April 2025) requires Foundry v13+ and hasn't been updated
 * since Foundry v14 shipped, so it isn't verified against this system's target version.
 *
 * What it does: creates one temporary Actor of every actor type and one temporary Item of
 * every item type, opens each one's sheet, and watches for thrown errors, rejected renders,
 * or anything logged via console.error/ui.notifications.error while the sheet renders. Every
 * document it creates is deleted again at the end, whether or not the run succeeded.
 *
 * How to run it: in a scratch world (not a real campaign - see docs/RELEASE_CHECKLIST.md), as
 * a GM, create a new Macro of type "Script", paste this file's contents in, and run it. Or
 * paste it directly into the browser console while the world is loaded. Results print as a
 * console.table and a summary notification; open the browser console to see per-document detail.
 *
 * A FAIL doesn't always mean a code bug - e.g. the Zord actor type fetches a couple of Perks
 * from the pr_crb compendium in its _preCreate hook, so a Zord failure in a world missing that
 * pack is an environment issue, not a regression. Read the detail column before assuming a bug.
 */
(async () => {
  const ACTOR_TYPES = ["companion", "megaform", "npc", "playerCharacter", "vehicle", "zord"];
  const ITEM_TYPES = [
    "altMode", "alteration", "armor", "bond", "classFeature", "equipmentPackage",
    "faction", "feature", "focus", "gear", "hangUp", "influence", "magicBauble",
    "megaformTrait", "origin", "perk", "power", "role", "rolePoints", "shield",
    "specialization", "spell", "trait", "upgrade", "weaponEffect", "weapon",
  ];

  const results = [];
  const createdDocs = [];
  let capturedErrors = [];

  const origConsoleError = console.error;
  const origNotifyError = ui.notifications.error;
  console.error = (...args) => {
    capturedErrors.push(args.map(String).join(" "));
    origConsoleError(...args);
  };

  ui.notifications.error = (msg, opts) => {
    capturedErrors.push(String(msg));
    return origNotifyError.call(ui.notifications, msg, opts);
  };

  async function testDocument(DocumentClass, type, label) {
    capturedErrors = [];
    let doc = null;
    let status = "PASS";
    let detail = "";

    try {
      doc = await DocumentClass.create({ name: `[SmokeTest] ${type}`, type });
      createdDocs.push(doc);
      await doc.sheet.render({ force: true });
      // Some template errors surface as a console.error/notification without rejecting
      // render() - give them a moment to show up before declaring the render clean.
      await new Promise((resolve) => setTimeout(resolve, 300));
      if (capturedErrors.length) {
        status = "FAIL";
        detail = capturedErrors.join(" | ");
      }
    } catch (err) {
      status = "FAIL";
      detail = err?.message ?? String(err);
    } finally {
      if (doc?.sheet?.rendered) {
        await doc.sheet.close();
      }
    }

    results.push({ label, type, status, detail });
  }

  ui.notifications.info("Essence20 smoke test: starting...");

  try {
    for (const type of ACTOR_TYPES) {
      await testDocument(Actor, type, "Actor");
    }

    for (const type of ITEM_TYPES) {
      await testDocument(Item, type, "Item");
    }
  } finally {
    console.error = origConsoleError;
    ui.notifications.error = origNotifyError;

    for (const doc of createdDocs) {
      try {
        await doc.delete();
      } catch (err) {
        console.warn(`Essence20 smoke test: failed to clean up ${doc.documentName} ${doc.id}`, err);
      }
    }
  }

  console.table(results);
  const failures = results.filter((r) => r.status === "FAIL");
  if (failures.length) {
    ui.notifications.error(`Essence20 smoke test: ${failures.length} failure(s) out of ${results.length} - see console table.`);
  } else {
    ui.notifications.info(`Essence20 smoke test: all ${results.length} sheets rendered cleanly.`);
  }
})();
