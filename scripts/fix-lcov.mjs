// Normalize coverage/lcov.info source paths to forward slashes so the
// Linux-based sonar-scanner (in Docker) can match them to the analyzed files.
// v8 coverage on Windows emits backslash paths, which SonarQube can't resolve.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const file = 'coverage/lcov.info';
if (!existsSync(file)) {
  console.error('No coverage/lcov.info — run "npm run coverage" first.');
  process.exit(1);
}

const fixed = readFileSync(file, 'utf8').replace(/^SF:.*$/gm, (line) => line.replaceAll('\\', '/'));
writeFileSync(file, fixed);
console.log('Normalized lcov source paths to forward slashes.');
