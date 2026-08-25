export default {
  transform: {},
  setupFiles: ['<rootDir>/module/jest.setup.js'],
  // Scoped to the parts of module/ that currently have unit tests. Sheets, apps, and most
  // sheet-handlers are still 0%-covered (see docs/QA_PLAN.md) - including them here would
  // just make the "All files" number meaningless until they get their own test files.
  collectCoverageFrom: [
    'module/documents/**/*.mjs',
    'module/helpers/**/*.mjs',
    'module/data/**/*.mjs',
    'module/sheet-handlers/**/*.mjs',
    'module/dice.mjs',
    'module/chat.mjs',
  ],
  // Floors set a bit below current actual coverage so the suite has room to breathe but a
  // real coverage regression still fails CI. module/sheet-handlers/ pulls the aggregate way
  // down (~3700 lines of mostly actor.update()-orchestration code, most of it still untested
  // by design - see docs/QA_PLAN.md's note on preferring Quench for that layer), so this floor
  // is intentionally low; it exists to catch regressions in what IS tested, not to demand
  // blanket coverage.
  coverageThreshold: {
    global: {
      statements: 30,
      branches: 25,
      functions: 30,
      lines: 30,
    },
  },
};
