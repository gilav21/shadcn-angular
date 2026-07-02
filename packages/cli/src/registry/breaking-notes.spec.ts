import { describe, it, expect } from 'vitest';
import { registry } from './index.js';

describe('registry breaking-change notes', () => {
  it('never invokes the CLI under the unscoped npm name', () => {
    const offenders = Object.entries(registry).flatMap(([name, def]) =>
      (def.breaking ?? [])
        .flatMap(change => [change.note, change.from, change.to])
        .filter(field => field?.includes('npx shadcn-angular'))
        .map(field => `${name}: ${field}`),
    );
    expect(offenders).toEqual([]);
  });
});
