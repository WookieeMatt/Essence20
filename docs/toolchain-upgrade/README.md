# Toolchain upgrade (planned for v6.1 or v7)

Status: **ready, not applied.** Everything here was built and verified on 2026-10-23, then held back so it lands in a
planned release rather than mid-cycle. Nothing in it changes what players download - the release zip has never
contained `node_modules`. It changes the tools developers and CI use to build, lint and test.

- [What changes](#what-changes)
- [Landing it (one maintainer, once)](#landing-it-one-maintainer-once)
- [Updating your environment (every developer)](#updating-your-environment-every-developer)
- [Troubleshooting](#troubleshooting)
- [Later: the major upgrades](#later-the-major-upgrades)
- [Rolling back](#rolling-back)

## What changes

| | Before | After | Why |
| --- | --- | --- | --- |
| Node.js (CI) | 17.9 | **22 LTS** | 17 has been end-of-life since 2022; jest 30 and ESLint 9 need 18+ |
| Node.js (you) | anything that worked | **22 LTS** (24 also works) | Match CI so "passes locally" means "passes in CI" |
| `npm run build` | compressed CSS (one line) | **expanded CSS** | The committed `css/essence20.css` is expanded; building compressed rewrote the whole file in every diff |
| Sass (npm) | `^1.54.3` (floats to 1.106) | **`1.83.4`, pinned** | Sass 1.92+ orders some declarations differently, which can change which CSS rule wins. 1.83.4 reproduces the committed CSS byte for byte |
| `dependencies` | jest, the Foundry CLI, 3 gulp plugins | **none** | Nothing ships; everything moves to `devDependencies` |
| `gulp-less`, `gulp-sourcemaps`, `gulp-autoprefixer`, `gulp-sass` | installed | **removed** | Nothing imports them; `gulp-autoprefixer` was the source of the postcss/autoprefixer security alerts |
| `fancy-log` | used by `gulpfile.mjs` but undeclared | **declared** | It only worked because gulp 4 happened to install it |
| `package-lock.json` | 2022-era transitive versions | **refreshed** (`npm audit fix`, no forced majors) | Clears the critical Dependabot alerts (Babel, form-data) and lodash, js-yaml, semver, ws, json5 |

Unchanged: jest 27, gulp 4, ESLint 8, `@foundryvtt/foundryvtt-cli` 1.0.2 (the pack format Foundry v14 reads). The
security findings left after this are all inside those four and are build-time only - see
[Later](#later-the-major-upgrades).

`package-and-ci.patch` (beside this file) holds the `package.json` and workflow edits. The lockfile is deliberately
**not** in the patch - it goes stale within weeks; it is regenerated when this lands.

## Landing it (one maintainer, once)

On a branch off the release's integration branch, with Node 22 installed:

```bash
git apply docs/toolchain-upgrade/package-and-ci.patch
rm -rf node_modules
npm install          # regenerates package-lock.json for the new package.json
npm audit fix        # NOT --force: that would take the major upgrades too
npm ls sass          # must say sass@1.83.4 - audit fix must not have moved it
```

Then verify, in this order:

```bash
npm run lint
npm test -- --coverage           # also checks the coverage floor - read the end of the output
npm run build                    # css/essence20.css must show NO diff afterwards
git diff --stat css/
npx gulp --tasks                 # compile + extract are listed
node scripts/check-rules.mjs     # 0 errors
```

And with Foundry **closed**: `npm run build:db`, start Foundry, open a few compendiums.

Commit `package.json`, `package-lock.json` and `.github/workflows/*.yml` together, delete this folder's patch (keep
this README until everyone has updated), and announce it with the next section.

In the same pull request, bring the setup docs in line:

- `docs/DEVELOPER_BIBLE.md` §2 (Day one): `npm install` → `npm ci`, and name Node 22 LTS.
- The wiki's **Development Environment** page: the updated version is drafted (uncommitted) in the wiki clone. Push it
  to the wiki's `master` once the release is out - the wiki is live for everyone, so not before.

Expect the lockfile diff to be large (about 140 package versions on 2026-10-23). That is normal.

## Updating your environment (every developer)

Do this once, after pulling the commit that lands the upgrade. Allow about 10 minutes.

### 1. Install Node.js 22 LTS

Check what you have:

```bash
node --version
```

`v22.x` (or `v24.x`) is fine - skip to step 2. Otherwise install 22 LTS:

- **Windows**: the LTS installer from <https://nodejs.org>, or with [nvm-windows](https://github.com/coreybutler/nvm-windows):
  `nvm install 22` then `nvm use 22`. Close and reopen every terminal and VS Code afterwards.
- **macOS / Linux**: with [nvm](https://github.com/nvm-sh/nvm): `nvm install 22` then `nvm use 22`
  (`nvm alias default 22` to keep it). Homebrew: `brew install node@22`.

Confirm `node --version` shows 22 and `npm --version` shows 10 or later.

> **Foundry's own Node is separate.** Foundry bundles its own runtime; changing your system Node does not affect the
> Foundry app.

### 2. Pull and reinstall

From the `essence20` folder (your clone inside Foundry's `Data/systems`):

```bash
git pull
rm -rf node_modules        # PowerShell: Remove-Item -Recurse -Force node_modules
npm ci
```

Use **`npm ci`**, not `npm install`: it installs exactly what `package-lock.json` says and never rewrites it. If you
run `npm install` and `package-lock.json` changes, do not commit that - `git checkout package-lock.json` and run
`npm ci`.

### 3. Check it

```bash
npm ls sass            # sass@1.83.4
npm run lint           # no errors
npm test               # all suites pass
npm run build          # then:
git status             # css/essence20.css must NOT be modified
```

If `css/essence20.css` shows as modified after `npm run build`, something is wrong - see
[Troubleshooting](#troubleshooting). Do not commit it.

### 4. Your editor

- **VS Code**: reload the window (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> → *Developer: Reload Window*) so
  the ESLint extension picks up the reinstalled ESLint.
- If you use a Sass extension that compiles on save (Live Sass Compiler and similar), **turn it off for this
  repository** or set it to expanded output - its bundled Sass version is not 1.83.4.

### 5. Pack tooling

Nothing to do. `npm run build:db` / `build:json` use the same Foundry CLI as before. If you also installed the CLI
globally (`npm install -g @foundryvtt/foundryvtt-cli`), it is unaffected by the Node change but must be reinstalled
under the new Node if your Node manager keeps separate global folders per version (nvm does):
`npm install -g @foundryvtt/foundryvtt-cli`, then `fvtt configure view` to check your paths survived.

### Branches made before the upgrade

A feature branch started before the upgrade still has the old `package.json`. When you merge or rebase it onto the
upgraded branch and `package-lock.json` conflicts, take the upgraded side and reinstall:

```bash
git checkout --theirs package-lock.json   # when merging the upgraded branch INTO yours
# (rebasing onto it: --ours means the upgraded side)
npm ci
```

## Troubleshooting

**`npm ci` says the lockfile is out of sync.** Your `package.json` and `package-lock.json` disagree - usually a
half-finished merge. `git checkout package.json package-lock.json` (back to the branch's committed versions), then
`npm ci`.

**`EBADENGINE` warnings during install.** Some old packages declare engine ranges that do not mention Node 22. They
are warnings, not errors; the install still succeeds. Only worry if a command then actually fails.

**`npm run build` changed `css/essence20.css`.**
- `npm ls sass` must say `1.83.4`. If it does not, `rm -rf node_modules && npm ci`.
- The diff is the whole file on one line: an old `package.json` (compressed build) - pull again.
- The diff is only line endings: harmless; `git checkout css/essence20.css`. (Windows with
  `core.autocrlf=true` converts on checkout; that is expected.)

**`npm test` fails immediately on Windows with `SyntaxError: missing ) after argument list`.** That is the npm script
calling the shell shim in `node_modules/.bin`. Run Jest directly:

```bash
node --experimental-vm-modules node_modules/jest/bin/jest.js
```

**Every file shows `linebreak-style` lint errors on Windows.** Git converted line endings on checkout
(`core.autocrlf=true`). CI runs on Linux and does not see this. Check a real problem with
`npx eslint module/ --ext .js,.mjs --rule "linebreak-style: off"`.

**npm itself crashes (`Class extends value undefined is not a constructor`).** The npm that came with your Node
install is damaged. Reinstall Node 22 from nodejs.org (or `nvm uninstall 22 && nvm install 22`). On Windows you can also use the portable Node 22 in `.dev-node/` - setup steps are in `scripts/test.ps1`'s header, and `scripts/test.ps1` / `scripts/test.sh` run the tests with it.

**Tests pass alone but one suite times out in a full run.** The suite is under load (a pack build or another heavy
process running alongside). Rerun; if it repeats, report it.

## Later: the major upgrades

What the security scan still reports after this is entirely in four build-time tools. Each is its own piece of work:

| Upgrade | Clears | Work |
| --- | --- | --- |
| jest 27 → 30 | most remaining findings (micromatch, braces, jsdom chain) | Test behaviour changes; the `--experimental-vm-modules` setup and some mocks need updating |
| gulp 4 → 5 | chokidar, glob-watcher, anymatch | `gulpfile.mjs` is small; check `build:db` / `build:json` still compile and extract every pack |
| ESLint 8 → 9 | (none currently, but 8 is end-of-life) | `.eslintrc.cjs` becomes `eslint.config.mjs` (flat config); VS Code's ESLint extension needs v3+ |
| Sass 1.83 → current | (none) | Only together with a full CSS review - newer Sass reorders some declarations |

Do them one at a time, each in its own pull request, after this upgrade has been through a release. Each one will need
its own short "update your environment" note - almost always just `npm ci` again.

## Rolling back

Revert the commit that landed it, then on every machine: `rm -rf node_modules && npm ci`. Node 22 can stay installed;
the old toolchain runs on it.
