import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs-extra';
import { collectDoctorReport, classifyDrift } from './doctor.js';
import { getDefaultConfig } from '../utils/config.js';

vi.mock('fs-extra', () => ({
  default: { pathExists: vi.fn(), readFile: vi.fn(), readJson: vi.fn(async () => ({})) },
}));
vi.mock('../core/fetch.js', () => ({
  fetchAndTransform: vi.fn(async () => 'REMOTE'),
  normalizeContent: (s: string) => s.replaceAll('\r\n', '\n').trim(),
}));

const cfg = getDefaultConfig();

describe('collectDoctorReport', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reports a clean bill when nothing is installed', async () => {
    (fs.pathExists as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    const report = await collectDoctorReport('/proj', cfg, { branch: 'master' });
    expect(report.missingFiles).toEqual([]);
    expect(report.modified).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it('flags a component whose installed files were modified', async () => {
    // button present but changed: pathExists true, local != remote
    (fs.pathExists as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (p: string) =>
      String(p).includes('button'));
    (fs.readFile as unknown as ReturnType<typeof vi.fn>).mockResolvedValue('LOCAL EDIT');
    const report = await collectDoctorReport('/proj', cfg, { branch: 'master' });
    expect(report.modified).toContain('button');
    expect(report.ok).toBe(false);
  });
});

describe('classifyDrift', () => {
  it('flags user-edited when local differs from the manifest baseline', () => {
    const out = classifyDrift(['button'], { button: 'modified' });
    expect(out.userEdited).toEqual(['button']);
    expect(out.updateAvailable).toEqual([]);
  });

  it('flags update-available when local matches manifest but registry moved on', () => {
    const out = classifyDrift(['button'], { button: 'clean' });
    expect(out.updateAvailable).toEqual(['button']);
    expect(out.userEdited).toEqual([]);
  });

  it('treats untracked (no manifest baseline) drift as update-available', () => {
    const out = classifyDrift(['button'], { button: 'untracked' });
    expect(out.updateAvailable).toEqual(['button']);
    expect(out.userEdited).toEqual([]);
  });
});
