import { describe, it, expect, vi, beforeEach } from 'vitest';
import prompts from 'prompts';
import { refreshLib, parseFileList } from './refresh-lib.js';
import { refreshLibCore } from './doctor.js';
import { getConfig, getDefaultConfig } from '../utils/config.js';

vi.mock('prompts', () => ({ default: vi.fn(async () => ({ ok: false })) }));
vi.mock('./doctor.js', () => ({
  refreshLibCore: vi.fn(async () => ({ refreshed: ['utils.ts'], targets: ['utils.ts'], protectedFiles: [], warnings: [] })),
}));
vi.mock('../utils/config.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/config.js')>();
  return { ...actual, getConfig: vi.fn() };
});

const mockCore = vi.mocked(refreshLibCore);
const mockPrompts = vi.mocked(prompts) as unknown as ReturnType<typeof vi.fn>;

describe('parseFileList', () => {
  it('splits and trims a comma-separated list', () => {
    expect(parseFileList('utils.ts, i18n/i18n.token.ts')).toEqual(['utils.ts', 'i18n/i18n.token.ts']);
  });

  it('returns undefined for an absent or empty list (→ core picks the default set)', () => {
    expect(parseFileList(undefined)).toBeUndefined();
    expect(parseFileList(' , ')).toBeUndefined();
  });
});

describe('refreshLib', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getConfig).mockResolvedValue(getDefaultConfig());
  });

  it('calls the same core routine the MCP refresh_lib tool calls', async () => {
    await refreshLib({ branch: 'master' });
    expect(mockCore).toHaveBeenCalledTimes(1);
    expect(mockCore.mock.calls[0][3]).toEqual({ files: undefined, force: undefined, dryRun: undefined });
  });

  it('forwards a non-default branch and custom registry to the core fetch options', async () => {
    await refreshLib({ branch: 'feat/x', registry: 'https://fork.test/components', remote: true });
    const options = mockCore.mock.calls[0][2];
    expect(options.branch).toBe('feat/x');
    expect(options.registry).toBe('https://fork.test/components');
    expect(options.remote).toBe(true);
  });

  it('falls back to the registry recorded in components.json', async () => {
    vi.mocked(getConfig).mockResolvedValue({ ...getDefaultConfig(), registry: 'https://mirror.test/components' });
    await refreshLib({ branch: 'master' });
    expect(mockCore.mock.calls[0][2].registry).toBe('https://mirror.test/components');
  });

  it('passes an explicit --files list through', async () => {
    await refreshLib({ branch: 'master', files: 'utils.ts,touch.ts' });
    expect(mockCore.mock.calls[0][3].files).toEqual(['utils.ts', 'touch.ts']);
  });

  it('confirms before --force overwrites customized lib files, and aborts on a decline', async () => {
    await refreshLib({ branch: 'master', force: true });
    expect(mockPrompts).toHaveBeenCalledTimes(1);
    expect(mockCore).not.toHaveBeenCalled();
  });

  it('skips the confirmation with -y', async () => {
    await refreshLib({ branch: 'master', force: true, yes: true });
    expect(mockPrompts).not.toHaveBeenCalled();
    expect(mockCore.mock.calls[0][3].force).toBe(true);
  });

  it('never prompts on a dry run', async () => {
    await refreshLib({ branch: 'master', force: true, dryRun: true });
    expect(mockPrompts).not.toHaveBeenCalled();
    expect(mockCore.mock.calls[0][3].dryRun).toBe(true);
  });
});
