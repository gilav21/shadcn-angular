import { describe, it, expect } from 'vitest';
import { toFetchOptions, sourceInputSchema } from './options.js';
import { getDefaultConfig } from '../../utils/config.js';
import { DEFAULT_BRANCH } from '../../utils/paths.js';

describe('toFetchOptions', () => {
  it('defaults the branch to the same default the CLI uses', () => {
    expect(toFetchOptions({}).branch).toBe(DEFAULT_BRANCH);
  });

  it('passes an explicit branch through', () => {
    expect(toFetchOptions({ branch: 'feat/x' }).branch).toBe('feat/x');
  });

  it('falls back to the project registry from components.json', () => {
    const config = { ...getDefaultConfig(), registry: 'https://mirror.test/components' };
    expect(toFetchOptions({}, config).registry).toBe('https://mirror.test/components');
  });

  it('lets an explicit registry argument win over components.json (CLI precedence)', () => {
    const config = { ...getDefaultConfig(), registry: 'https://mirror.test/components' };
    expect(toFetchOptions({ registry: 'https://fork.test/components' }, config).registry)
      .toBe('https://fork.test/components');
  });

  it('leaves registry/remote undefined when neither args nor config set them', () => {
    const options = toFetchOptions({}, getDefaultConfig());
    expect(options.registry).toBeUndefined();
    expect(options.remote).toBeUndefined();
  });

  it('forwards remote', () => {
    expect(toFetchOptions({ remote: true }).remote).toBe(true);
  });

  it('exposes branch/registry/remote as optional schema fields', () => {
    expect(Object.keys(sourceInputSchema)).toEqual(['branch', 'registry', 'remote']);
    for (const field of Object.values(sourceInputSchema)) {
      expect(field.isOptional()).toBe(true);
    }
  });
});
