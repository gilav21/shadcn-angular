import { describe, it, expect } from 'vitest';
import { parseRegistrySource } from './sync-registry-lib';

describe('parseRegistrySource', () => {
  it('parses a plain component entry', () => {
    const source = `export const registry = {
  button: {
    name: 'button',
    files: ['button/button.component.ts', 'button/index.ts'],
  },
};`;
    const entries = parseRegistrySource(source);
    const button = entries.find((e) => e.name === 'button');
    expect(button).toBeDefined();
    expect(button!.files).toEqual(['button/button.component.ts', 'button/index.ts']);
    expect(button!.isBlock).toBe(false);
  });

  it('parses a slash-keyed addon entry (parent/addon)', () => {
    const source = `export const registry = {
  'data-table': {
    name: 'data-table',
    files: ['data-table/data-table.component.ts', 'data-table/index.ts'],
    addons: ['data-table/context-menu'],
  },
  'data-table/context-menu': {
    name: 'data-table/context-menu',
    type: 'addon',
    parent: 'data-table',
    files: ['data-table/addons/context-menu/index.ts', 'data-table/addons/context-menu/context-menu.directive.ts'],
    dependencies: ['context-menu'],
  },
};`;
    const entries = parseRegistrySource(source);
    const addon = entries.find((e) => e.name === 'data-table/context-menu');
    expect(addon).toBeDefined();
    expect(addon!.files).toContain('data-table/addons/context-menu/context-menu.directive.ts');
    expect(addon!.dependencies).toEqual(['context-menu']);
    // The parent is still parsed as its own entry.
    expect(entries.find((e) => e.name === 'data-table')).toBeDefined();
  });

  it('flags block entries via type', () => {
    const source = `export const registry = {
  login: {
    name: 'login',
    type: 'block',
    files: ['login/login.component.ts'],
  },
};`;
    const entries = parseRegistrySource(source);
    expect(entries.find((e) => e.name === 'login')!.isBlock).toBe(true);
  });
});
