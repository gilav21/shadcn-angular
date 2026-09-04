#!/usr/bin/env tsx
/**
 * `npm run build:package -- <rte|data-table>` — the CLI entry for the package
 * build (stage → ng build → structural gates → npm pack).
 *
 * A separate file from `package-build.ts` on purpose. The orchestrator IMPORTS
 * that module for `buildPackageTarball`, and tsx transforms an import through
 * esbuild's cjs output, which rejects top-level await ("Top-level await is
 * currently not supported with the cjs output format"). Keeping the awaiting
 * entry point in its own never-imported file lets the module stay a clean
 * import target and lets this file use the top-level await it should.
 */
import { runPackageBuildCli } from './package-build.js';

process.exit(await runPackageBuildCli());
