// Normalize coverage lcov source paths to forward slashes so the
// Linux-based sonar-scanner (in Docker) can match them to the analyzed files.
// v8 coverage on Windows emits backslash paths, which SonarQube can't resolve.
// Handles both the component (browser) and CLI (node) coverage reports.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const files = ['coverage/lcov.info', 'coverage-cli/lcov.info'];
let normalized = 0;

for (const file of files) {
  if (!existsSync(file)) continue;
  const fixed = readFileSync(file, 'utf8').replace(/^SF:.*$/gm, (line) => line.replaceAll('\\', '/'));
  writeFileSync(file, fixed);
  normalized += 1;
}

if (normalized === 0) {
  console.error('No lcov reports found — run "npm run coverage" first.');
  process.exit(1);
}
console.log(`Normalized lcov source paths to forward slashes (${normalized} report(s)).`);
