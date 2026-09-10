---
name: pdf-parse v2 + esbuild server bundling
description: Why pdf-parse must be lazy-imported and externalized in the api-server esbuild bundle
---

When extracting text from PDFs in `artifacts/api-server`, the installed `pdf-parse` is v2.x — an ESM-first rewrite with a completely different API than v1 (no default-export function, no `pdf-parse/lib/pdf-parse.js` subpath). Use `const { PDFParse } = await import("pdf-parse"); new PDFParse({ data }).getText()` and call `parser.destroy()` after.

**Why:** v2 statically pulls in `pdfjs-dist` display/canvas code that evaluates `new DOMMatrix()` at module load and needs `@napi-rs/canvas` for DOM polyfills. A top-level `import` bundled by esbuild evaluates this at server startup and crashes with `DOMMatrix is not defined`. Its `exports` map also blocks the old v1 subpath, so esbuild can't resolve it.

**How to apply:** (1) import `pdf-parse` lazily/dynamically inside the handler so startup never evaluates pdf.js; (2) add `pdf-parse`, `pdfjs-dist`, `@napi-rs/canvas` to the `external` list in `build.mjs`; (3) install `@napi-rs/canvas` so the polyfill works. The `@types/pdf-parse` (v1) package is obsolete — v2 ships its own types via its exports map.
