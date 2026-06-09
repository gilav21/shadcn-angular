import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs-extra';
import { collectDoctorReport, classifyDrift, buildFixPlan, doctorFixCore, type DoctorReport } from './doctor.js';
import { getDefaultConfig } from '../utils/config.js';
import { performInstall } from '../core/install.js';
import { installPackages } from '../utils/package-manager.js';

vi.mock('fs-extra', () => ({
  default: { pathExists: vi.fn(), readFile: vi.fn(), readJson: vi.fn(async () => ({})) },
}));
vi.mock('../core/fetch.js', () => ({
  fetchAndTransform: vi.fn(async () => 'REMOTE'),
  normalizeContent: (s: string) => s.replaceAll('\r\n', '\n').trim(),
}));
vi.mock('../core/install.js', () => ({
  performInstall: vi.fn(async () => ({ installed: ['button', 'card'], skipped: [], declined: [], warnings: [] })),
}));
vi.mock('../utils/package-manager.js', () => ({
  installPackages: vi.fn(async () => undefined),
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

function makeReport(partial: Partial<DoctorReport>): DoctorReport {
  return {
    missingFiles: [], modified: [], userEdited: [], updateAvailable: [],
    legacy: [], missingNpmDeps: [], ok: false, ...partial,
  };
}

describe('buildFixPlan', () => {
  it('merges missing-files and update-available into one reinstall list', () => {
    const plan = buildFixPlan(makeReport({
      missingFiles: ['button'], updateAvailable: ['card', 'button'],
    }));
    expect(plan.reinstall).toEqual(['button', 'card']);
    expect(plan.hasActions).toBe(true);
  });

  it('never schedules user-edited components for reinstall', () => {
    const plan = buildFixPlan(makeReport({
      modified: ['badge'], userEdited: ['badge'],
    }));
    expect(plan.reinstall).toEqual([]);
    expect(plan.protected).toEqual(['badge']);
    expect(plan.hasActions).toBe(false);
  });

  it('lists npm deps and legacy components without auto-fixing legacy', () => {
    const plan = buildFixPlan(makeReport({
      missingNpmDeps: ['date-fns'], legacy: ['alert'],
    }));
    expect(plan.npmDeps).toEqual(['date-fns']);
    expect(plan.legacy).toEqual(['alert']);
    expect(plan.hasActions).toBe(true);
  });
});

describe('doctorFixCore', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reinstalls components with overwrite authorization and --yes', async () => {
    const plan = buildFixPlan(makeReport({ missingFiles: ['button'], updateAvailable: ['card'] }));
    const actions = await doctorFixCore('/proj', cfg, { branch: 'master' }, plan);
    expect(performInstall).toHaveBeenCalledWith(expect.objectContaining({
      components: ['button', 'card'],
      overwrite: ['button', 'card'],
      options: expect.objectContaining({ yes: true }),
    }));
    expect(actions.some(a => a.includes('Re-installed 2'))).toBe(true);
  });

  it('installs missing npm dependencies', async () => {
    const plan = buildFixPlan(makeReport({ missingNpmDeps: ['date-fns', 'embla-carousel'] }));
    const actions = await doctorFixCore('/proj', cfg, { branch: 'master' }, plan);
    expect(installPackages).toHaveBeenCalledWith(['date-fns', 'embla-carousel'], { cwd: '/proj' });
    expect(performInstall).not.toHaveBeenCalled();
    expect(actions.some(a => a.includes('date-fns'))).toBe(true);
  });

  it('does nothing when the plan has no actions', async () => {
    const plan = buildFixPlan(makeReport({ userEdited: ['badge'], modified: ['badge'] }));
    const actions = await doctorFixCore('/proj', cfg, { branch: 'master' }, plan);
    expect(performInstall).not.toHaveBeenCalled();
    expect(installPackages).not.toHaveBeenCalled();
    expect(actions).toEqual([]);
  });

  it('surfaces install warnings as actions', async () => {
    (performInstall as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      installed: ['button'], skipped: [], declined: [], warnings: ['peer file skipped'],
    });
    const plan = buildFixPlan(makeReport({ missingFiles: ['button'] }));
    const actions = await doctorFixCore('/proj', cfg, { branch: 'master' }, plan);
    expect(actions.some(a => a.includes('peer file skipped'))).toBe(true);
  });
});
