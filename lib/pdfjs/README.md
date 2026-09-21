# pdf.js

Vendored from `@foundryvtt/pdfjs` 4.0.379-1, Apache-2.0 (Mozilla Foundation).
Upstream: https://github.com/mozilla/pdf.js

Only `pdf.mjs` and `pdf.worker.mjs` are kept - the sandbox build is for form scripting, which
nothing here uses.

Why vendored: Foundry bundles pdf.js server-side but does not serve it to the browser (checked
against v14.364 - `/pdfjs/build/pdf.mjs` 404s), so a client-side reader has to bring its own.

Nothing imports this at startup. `apps/book-description-importer.mjs` loads it with a dynamic
import the first time a GM actually opens the importer, so the 2.4MB costs nothing at runtime
for the overwhelming majority of sessions that never use it.
