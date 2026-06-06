import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs-extra';
import { isFolderized, newEntryFile, legacyEntryFile, detectLayout } from './layout.js';

vi.mock('fs-extra', () => ({ default: { pathExists: vi.fn(), readFile: vi.fn() } }));
const exists = fs.pathExists as unknown as ReturnType<typeof vi.fn>;
const readFile = fs.readFile as unknown as ReturnType<typeof vi.fn>;
const norm = (p: unknown) => String(p).replaceAll('\\', '/');

/** Flat file present (folder absent), with the given file content. */
function flatInstall(content: string): void {
  exists.mockImplementation(async (p) => {
    const s = norm(p);
    return s.endsWith('button.component.ts') && !s.includes('button/button');
  });
  readFile.mockResolvedValue(content);
}

describe('layout helpers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('classifies folderized vs flat registry entries', () => {
    expect(isFolderized('button')).toBe(true);
    expect(isFolderized('ripple')).toBe(false);
    expect(newEntryFile('button')).toBe('button/button.component.ts');
    expect(legacyEntryFile('button')).toBe('button.component.ts');
    expect(newEntryFile('ripple')).toBeNull();
    expect(legacyEntryFile('ripple')).toBeNull();
  });

  it('detects legacy when our flat file (our selector) exists and folder does not', async () => {
    flatInstall(`@Component({ selector: 'ui-button' })`);
    expect(await detectLayout('button', '/ui')).toBe('legacy');
  });

  it('detects legacy with a custom prefix selector', async () => {
    flatInstall(`@Component({ selector: 'acme-button' })`);
    expect(await detectLayout('button', '/ui', 'acme')).toBe('legacy');
  });

  it('does NOT treat a consumer\'s own same-named file (different selector) as legacy', async () => {
    // A user's `button.component.ts` that merely shares the registry name.
    flatInstall(`@Component({ selector: 'app-button' })`);
    expect(await detectLayout('button', '/ui')).toBe('absent');
  });

  it('detects new when folder entry exists', async () => {
    exists.mockImplementation(async (p) => norm(p).includes('button/button.component.ts'));
    expect(await detectLayout('button', '/ui')).toBe('new');
  });

  it('detects absent when neither exists', async () => {
    exists.mockResolvedValue(false);
    expect(await detectLayout('button', '/ui')).toBe('absent');
  });
});
