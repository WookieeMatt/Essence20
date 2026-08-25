/**
 * Essence20 sheet layout regression test.
 *
 * Neither the Jest unit suite nor macros/smoke-test.js (see docs/QA_PLAN.md) can catch layout
 * bugs - Jest never renders real CSS, and the smoke test only checks "did it render without
 * throwing," not "does it look right." This macro encodes a handful of specific layout bugs
 * that have actually shipped and been fixed on the character sheet, as repeatable assertions,
 * so they can't silently regress again:
 *
 *  - Header row-top (Name/Size/Faction/Level) sharing one line without wrapping or overflowing,
 *    across a range of sheet widths (regressed once: Level got pushed to its own row).
 *  - Header row-bottom (Role/Focus/Origin/Color) sharing one line the same way (regressed once:
 *    Color got pushed to its own row after the row-top fix, since the underlying cause -
 *    Foundry core's .flexrow utility defaulting to flex-wrap: wrap - applies to both rows).
 *  - Every sidebar panel (Resources/Special/Defenses/etc.) having the *same* bottom padding as
 *    every other one (regressed once: an unrelated header-only CSS rule was also matching the
 *    sidebar because both reuse the "sheet-header"/"sliced-border" class names, silently
 *    doubling just the Defenses panel's padding relative to the others).
 *  - The Role Points row's activation checkbox rendering at a real, clickable size, and the
 *    row's height matching the Health/Stun rows (regressed once: a leaked header rule squeezed
 *    the checkbox down to ~4px and inflated the row's own height instead).
 *  - The sidebar's skill list collapsing empty (no-specialization) skill rows tight against
 *    their neighbors, while the *main Skills tab*'s skill rows do NOT collapse the same way
 *    (regressed once: a sidebar-only spacing fix was written too broadly and also collapsed
 *    the main tab's rows, which share the same CSS class).
 *
 * How to run it: same as smoke-test.js - in a scratch world, as a GM, paste into a Script
 * Macro or the browser console. Creates one temporary Player Character (with a bare RolePoints
 * item embedded directly, so the Role Points row renders without needing a real Role/compendium
 * dependency), checks it, and deletes it afterward regardless of outcome. Results print as a
 * console.table and a summary notification.
 */
(async () => {
  const WIDTHS = [860, 1050, 1400]; // 860 is the sheet's own CSS min-width (.actor{min-width}).
  const results = [];
  let actor = null;

  function check(label, condition, detail = "") {
    results.push({ label, status: condition ? "PASS" : "FAIL", detail });
  }

  function skip(label, detail) {
    results.push({ label, status: "SKIP", detail });
  }

  function rowLayout(row) {
    const kids = [...row.children];
    const rects = kids.map((el) => el.getBoundingClientRect());
    const tops = new Set(rects.map((r) => Math.round(r.top)));
    return {
      sameLine: tops.size <= 1,
      overflowing: row.scrollWidth > row.clientWidth + 1,
    };
  }

  try {
    actor = await Actor.create({ name: "[LayoutRegressionTest] PC", type: "playerCharacter" });
    await actor.createEmbeddedDocuments("Item", [{
      name: "Test Role Points",
      type: "rolePoints",
      system: { resource: { max: 2, value: 1 }, isActivatable: true, isActive: false },
    }]);

    await actor.sheet.render({ force: true });
    await new Promise((resolve) => setTimeout(resolve, 400));
    const root = actor.sheet.element;

    // --- Header rows: share one line, no overflow, across a width sweep ---
    for (const width of WIDTHS) {
      actor.sheet.setPosition({ width });
      await new Promise((resolve) => setTimeout(resolve, 250));

      const rowTop = root.querySelector(".header-row-top");
      const rowBottom = root.querySelector(".header-row-bottom");

      if (rowTop) {
        const { sameLine, overflowing } = rowLayout(rowTop);
        check(
          `Header row-top shares one line @ ${width}px`,
          sameLine && !overflowing,
          sameLine ? (overflowing ? "row overflows its container" : "") : "a field wrapped to its own line",
        );
      }

      if (rowBottom) {
        const { sameLine, overflowing } = rowLayout(rowBottom);
        check(
          `Header row-bottom shares one line @ ${width}px`,
          sameLine && !overflowing,
          sameLine ? (overflowing ? "row overflows its container" : "") : "a field wrapped to its own line",
        );
      }
    }

    actor.sheet.setPosition({ width: 1050 });
    await new Promise((resolve) => setTimeout(resolve, 250));

    // --- Sidebar panels: consistent bottom padding across every panel ---
    const panels = [...root.querySelectorAll(".essence20-sidebar-panel")];
    if (panels.length) {
      const paddings = panels.map((p) => getComputedStyle(p).paddingBottom);
      const distinct = new Set(paddings);
      check(
        "Every sidebar panel has the same bottom padding",
        distinct.size === 1,
        distinct.size === 1 ? "" : `saw ${[...distinct].join(", ")} across ${panels.length} panels`,
      );
    } else {
      check("Every sidebar panel has the same bottom padding", false, "no .essence20-sidebar-panel found");
    }

    // --- Role Points row: checkbox visible, row height matches Health/Stun ---
    const rolePointsRow = root.querySelector(".role-points-item");
    const healthRow = root.querySelector(".essence20-sidebar-resources > div");
    if (rolePointsRow && healthRow) {
      const checkbox = rolePointsRow.querySelector('input[type="checkbox"]');
      const checkboxWidth = checkbox ? checkbox.getBoundingClientRect().width : 0;
      check(
        "Role Points checkbox renders at a clickable size",
        checkboxWidth >= 10,
        `rendered width: ${checkboxWidth.toFixed(1)}px`,
      );

      const rolePointsHeight = Math.round(rolePointsRow.getBoundingClientRect().height);
      const healthHeight = Math.round(healthRow.getBoundingClientRect().height);
      check(
        "Role Points row height matches Health/Stun row height",
        rolePointsHeight === healthHeight,
        `Role Points: ${rolePointsHeight}px, Health: ${healthHeight}px`,
      );
    } else {
      check("Role Points checkbox renders at a clickable size", false, "no .role-points-item found");
      check("Role Points row height matches Health/Stun row height", false, "no .role-points-item found");
    }

    // --- Skill body collapse: sidebar collapses empty bodies, main tab does not ---
    // The sidebar skill list only shows "any"-essence skills (Weird, Wealth Die, etc.), which
    // depend on world/game-version config (system.canUseWeird, config.skillsByEssence.any) that
    // a bare scratch world may not have populated - skip rather than fail when that's empty,
    // same as smoke-test.js treats a missing compendium as an environment issue, not a bug.
    const sidebarEmptyBody = root.querySelector(
      ".essence20-sidebar-skill-list .skill-body",
    );
    if (sidebarEmptyBody) {
      check(
        "Sidebar's empty skill body is collapsed",
        getComputedStyle(sidebarEmptyBody).display === "none",
        `computed display: ${getComputedStyle(sidebarEmptyBody).display}`,
      );
    } else {
      skip("Sidebar's empty skill body is collapsed", "no 'any'-essence skills configured in this world - nothing to check");
    }

    const mainTabEmptyBody = [...root.querySelectorAll(".skill-body")].find(
      (el) => !el.closest(".essence20-sidebar"),
    );
    if (mainTabEmptyBody) {
      check(
        "Main Skills tab's empty skill body stays visible (not collapsed)",
        getComputedStyle(mainTabEmptyBody).display !== "none",
        `computed display: ${getComputedStyle(mainTabEmptyBody).display}`,
      );
    } else {
      check("Main Skills tab's empty skill body stays visible (not collapsed)", false, "no main-tab .skill-body found");
    }
  } finally {
    if (actor) {
      if (actor.sheet?.rendered) {
        await actor.sheet.close();
      }

      await actor.delete();
    }
  }

  console.table(results);
  const failures = results.filter((r) => r.status === "FAIL");
  if (failures.length) {
    ui.notifications.error(`Essence20 layout regression test: ${failures.length} failure(s) out of ${results.length} - see console table.`);
  } else {
    ui.notifications.info(`Essence20 layout regression test: all ${results.length} checks passed.`);
  }
})();
