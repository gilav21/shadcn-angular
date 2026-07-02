import { describe, it, expect } from 'vitest';
import { formatAddonMeta } from './why.js';
import { registry } from '../registry/index.js';

describe('formatAddonMeta', () => {
  it('lists a base component\'s opt-in addons', () => {
    const lines = formatAddonMeta(registry['data-table']);
    expect(lines).toContainEqual({ label: 'Addons', value: 'data-table/context-menu' });
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
