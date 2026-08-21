import { afterEach, describe, it, expect, vi } from 'vitest';
import { formatAddonMeta, formatInstallSize, why } from './why.js';
import { registry } from '../registry/index.js';
import { __resetFileSizesCache, type FileSizes } from '../core/sizes.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const committedSizes = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, 'packages/components/file-sizes.json'), 'utf-8'),
) as FileSizes;

describe('formatAddonMeta', () => {
  it('lists a base component\'s opt-in addons', () => {
    const lines = formatAddonMeta(registry['data-table']);
    expect(lines).toContainEqual({ label: 'Addons', value: 'data-table/context-menu, data-table/export, data-table/pivot' });
    // A base is not itself an addon — no "Addon of" / "Attach" lines.
    expect(lines.some(l => l.label === 'Addon of')).toBe(false);
  });

  it('shows an addon\'s parent and how it attaches (mirrors MCP get_component)', () => {
    const lines = formatAddonMeta(registry['data-table/context-menu']);
    expect(lines).toContainEqual({ label: 'Addon of', value: 'data-table' });
    expect(lines).toContainEqual({
      label: 'Attach',
      value: 'uiDtContextMenu (import DataTableContextMenuDirective)',
    });
  });

  it('returns nothing for a plain component with no addons', () => {
    expect(formatAddonMeta(registry['button'])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// T-9 / T-10 — install size (UC-7)
// ---------------------------------------------------------------------------

const ESC = String.fromCodePoint(27);
const ANSI = new RegExp(`${ESC}\\[[\\d;]*m`, 'g');

/**
 * Strip chalk's escape codes so assertions read the text a user sees. Built
 * from a `String.fromCodePoint` escape rather than a literal control character
 * in the source, which lint rightly rejects.
 */
function plain(text: string): string {
  return text.replaceAll(ANSI, '');
}

/** Capture everything `why` writes, uncolored, as one string. */
async function capture(names: string[]): Promise<string> {
  const lines: string[] = [];
  const spy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
  });
  await why(names);
  spy.mockRestore();
  return plain(lines.join('\n'));
}

const SIZE_LINE = /^ {2}Install size: ([^\n]*)$/m;

afterEach(() => {
  vi.restoreAllMocks();
  __resetFileSizesCache();
});

describe('T-9: why prints size for a component and its dependencies', () => {
  it('prints an install size for a plain component', async () => {
    const output = await capture(['button']);
    expect(SIZE_LINE.test(output)).toBe(true);
  });

  it('reports more than the component\'s own files, because deps are installed too', async () => {
    const output = await capture(['button']);
    const files = /(\d{1,6}) files, including dependencies/.exec(output);
    expect(files).not.toBeNull();
    expect(Number(files?.[1])).toBeGreaterThan(registry['button'].files.length);
  });

  it('reports bytes and lines, not just a file count', async () => {
    const line = SIZE_LINE.exec(await capture(['button']))?.[1] ?? '';
    expect(line).toMatch(/\d{1,6}(\.\d)? (B|KB|MB)/);
    expect(line).toMatch(/\d[\d,]{0,12} lines/);
  });

  it('reports a bigger size for a component with a bigger closure', async () => {
    const sizeOf = async (name: string): Promise<number> => {
      const line = SIZE_LINE.exec(await capture([name]))?.[1] ?? '';
      return Number(/(\d{1,6}) files/.exec(line)?.[1] ?? '0');
    };
    expect(await sizeOf('data-table')).toBeGreaterThan(await sizeOf('separator'));
  });

  it('prints a size for every name when several are asked about', async () => {
    const output = await capture(['button', 'card']);
    expect([...output.matchAll(/Install size:/g)]).toHaveLength(2);
  });

  it('prints a size for a block, whose sources live outside packages/components', async () => {
    expect(SIZE_LINE.test(await capture(['login']))).toBe(true);
  });
});

describe('T-10: why output stays parseable', () => {
  it('keeps every section as a two-space-indented "Label:" line', async () => {
    const output = await capture(['button']);
    for (const label of ['Files (', 'Install size:', 'Direct dependencies:', 'Reverse dependents (']) {
      expect(output).toContain(`  ${label}`);
    }
  });

  it('puts the size directly after the file list, before the dependencies', async () => {
    const output = await capture(['button']);
    expect(output.indexOf('Files (')).toBeLessThan(output.indexOf('Install size:'));
    expect(output.indexOf('Install size:')).toBeLessThan(output.indexOf('Direct dependencies:'));
  });

  it('does not change the pre-existing sections', async () => {
    const output = await capture(['button']);
    expect(output).toContain('  Files (6):');
    expect(output).toContain('  Direct dependencies: alert-dialog, ripple, skeleton, spinner');
  });

  it('is stable across runs', async () => {
    expect(await capture(['button'])).toBe(await capture(['button']));
  });

  it('drops only the size line when no manifest can be loaded', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    const lines: string[] = [];
    const log = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      lines.push(args.map(String).join(' '));
    });
    // `remote: true` bypasses the local monorepo manifest, so the mocked
    // failing fetch is the only source — the offline case a consumer hits.
    await why(['button'], { remote: true });
    log.mockRestore();
    spy.mockRestore();

    const output = plain(lines.join('\n'));
    expect(output).not.toContain('Install size:');
    expect(output).toContain('  Files (6):');
    expect(output).toContain('  Direct dependencies:');
  });
});

describe('formatInstallSize', () => {
  /** Measures one real button file and nothing else, so the closure has gaps. */
  const partial: FileSizes = {
    version: 1,
    ui: { 'button/button.component.ts': { bytes: 2048, lines: 40 } },
    lib: {},
    blocks: {},
  };

  /** Measures nothing at all. */
  const empty: FileSizes = { version: 1, ui: {}, lib: {}, blocks: {} };

  it('returns null when no manifest was loaded', () => {
    expect(formatInstallSize('button', null)).toBeNull();
  });

  it('returns null rather than reporting 0 B when nothing could be measured', () => {
    expect(formatInstallSize('button', empty)).toBeNull();
  });

  it('says the number is a floor when the manifest has gaps', () => {
    const line = formatInstallSize('button', partial);
    expect(line).toContain('2.0 KB');
    expect(line).toContain('unmeasured — this is a floor');
  });

  it('omits the caveat when every file is measured', () => {
    const line = formatInstallSize('button', committedSizes);
    expect(line).not.toBeNull();
    expect(line).not.toContain('unmeasured');
  });
});
