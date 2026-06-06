import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs-extra';
import { isFolderized, newEntryFile, legacyEntryFile, detectLayout, declaresOurSelector } from './layout.js';

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

describe('declaresOurSelector', () => {
  it('matches our selector in the selector: metadata', () => {
    expect(declaresOurSelector(`@Component({ selector: 'ui-card' })`, 'ui', 'card')).toBe(true);
  });

  it('matches a superstring selector (chat -> ui-chat-message)', () => {
    expect(declaresOurSelector(`@Component({ selector: 'ui-chat-message' })`, 'ui', 'chat')).toBe(true);
  });

  it('matches a custom prefix', () => {
    expect(declaresOurSelector(`@Component({ selector: 'acme-card' })`, 'acme', 'card')).toBe(true);
  });

  it('does NOT match a consumer file that merely RENDERS <ui-card> in its template', () => {
    const userCard = `@Component({ selector: 'app-card', template: '<ui-card></ui-card>' })`;
    expect(declaresOurSelector(userCard, 'ui', 'card')).toBe(false);
  });

  it('does NOT match a mention of ui-card in a comment or string', () => {
    expect(declaresOurSelector(`// wraps ui-card\nconst x = 'ui-card';`, 'ui', 'card')).toBe(false);
  });
});
