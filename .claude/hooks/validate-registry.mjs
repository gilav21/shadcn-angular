import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');

let input = '';
try {
  input = readFileSync(0, 'utf-8');
} catch {
  // no stdin
}

const filePath = (() => {
  try {
    const parsed = JSON.parse(input);
    return parsed?.tool_input?.file_path ?? parsed?.tool_response?.filePath ?? '';
  } catch {
    return '';
  }
})();

const normalizedPath = filePath.replaceAll('\\', '/');
const isRelevant =
  normalizedPath.includes('packages/components/ui/') ||
  normalizedPath.includes('packages/components/lib/');

if (!isRelevant) process.exit(0);

try {
  const result = execSync('npx tsx packages/cli/scripts/sync-registry.ts --fix', {
    cwd: ROOT,
    timeout: 30000,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const output = result.toString().trim();
  if (output.includes('Registry updated')) {
    const msg = JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: 'The sync-registry hook detected and auto-fixed registry changes. The registry file has been updated on disk — no action needed.',
      },
    });
    process.stdout.write(msg);
  }
} catch (err) {
  const stderr = err.stderr?.toString() ?? '';
  if (stderr) process.stderr.write(stderr);
}
