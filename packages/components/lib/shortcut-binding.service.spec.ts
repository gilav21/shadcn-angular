import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ShortcutBindingService, ShortcutRegistration } from './shortcut-binding.service';

const STORAGE_KEY = 'ui-shortcut-binding-overrides';

function makeRegistration(overrides: Partial<ShortcutRegistration> & { actionId: string; defaultShortcut: string }): ShortcutRegistration {
    return {
        description: overrides.description ?? overrides.actionId,
        handler: overrides.handler ?? ((): void => undefined),
        ...overrides,
    };
}

function keydown(init: KeyboardEventInit): KeyboardEvent {
    return new KeyboardEvent('keydown', init);
}

describe('ShortcutBindingService', () => {
    let service: ShortcutBindingService;

    beforeEach(() => {
        localStorage.clear();
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({});
        service = TestBed.inject(ShortcutBindingService);
    });

    describe('registration + dispatch', () => {
        it('dispatches a matching shortcut to its handler and marks the event handled', () => {
            let called = 0;
            service.registerShortcut('editor-1', makeRegistration({
                actionId: 'save',
                defaultShortcut: 'ctrl+s',
                scope: 'component',
                handler: () => called++,
            }));

            const event = keydown({ key: 's', ctrlKey: true });
            const handled = service.dispatch(event, { componentId: 'editor-1' });

            expect(handled).toBe(true);
            expect(called).toBe(1);
        });

        it('does not dispatch when modifiers differ', () => {
            let called = 0;
            service.registerShortcut('editor-1', makeRegistration({
                actionId: 'save',
                defaultShortcut: 'ctrl+s',
                handler: () => called++,
            }));

            const noCtrl = keydown({ key: 's' });
            expect(service.dispatch(noCtrl, { componentId: 'editor-1' })).toBe(false);
            expect(called).toBe(0);
        });

        it('does not dispatch the same event twice (handledEvents guard)', () => {
            let called = 0;
            service.registerShortcut('editor-1', makeRegistration({
                actionId: 'save',
                defaultShortcut: 'ctrl+s',
                handler: () => called++,
            }));

            const event = keydown({ key: 's', ctrlKey: true });
            expect(service.dispatch(event, { componentId: 'editor-1' })).toBe(true);
            expect(service.dispatch(event, { componentId: 'editor-1' })).toBe(false);
            expect(called).toBe(1);
        });

        it('requires shift and alt modifiers exactly when specified', () => {
            let called = 0;
            service.registerShortcut('editor-1', makeRegistration({
                actionId: 'special',
                defaultShortcut: 'alt+shift+k',
                handler: () => called++,
            }));

            expect(service.dispatch(keydown({ key: 'k', altKey: true }), { componentId: 'editor-1' })).toBe(false);
            expect(service.dispatch(keydown({ key: 'k', altKey: true, shiftKey: true }), { componentId: 'editor-1' })).toBe(true);
            expect(called).toBe(1);
        });

        it('calls preventDefault by default and respects stopPropagation flag', () => {
            service.registerShortcut('editor-1', makeRegistration({
                actionId: 'save',
                defaultShortcut: 'ctrl+s',
                stopPropagation: true,
            }));

            const event = keydown({ key: 's', ctrlKey: true });
            let prevented = false;
            let stopped = false;
            event.preventDefault = () => { prevented = true; };
            event.stopPropagation = () => { stopped = true; };

            service.dispatch(event, { componentId: 'editor-1' });
            expect(prevented).toBe(true);
            expect(stopped).toBe(true);
        });

        it('does not preventDefault when preventDefault is explicitly false', () => {
            service.registerShortcut('editor-1', makeRegistration({
                actionId: 'save',
                defaultShortcut: 'ctrl+s',
                preventDefault: false,
            }));

            const event = keydown({ key: 's', ctrlKey: true });
            let prevented = false;
            event.preventDefault = () => { prevented = true; };

            expect(service.dispatch(event, { componentId: 'editor-1' })).toBe(true);
            expect(prevented).toBe(false);
        });

        it('skips registrations whose when() guard returns false', () => {
            let called = 0;
            let enabled = false;
            service.registerShortcut('editor-1', makeRegistration({
                actionId: 'save',
                defaultShortcut: 'ctrl+s',
                when: () => enabled,
                handler: () => called++,
            }));

            expect(service.dispatch(keydown({ key: 's', ctrlKey: true }), { componentId: 'editor-1' })).toBe(false);
            enabled = true;
            expect(service.dispatch(keydown({ key: 's', ctrlKey: true }), { componentId: 'editor-1' })).toBe(true);
            expect(called).toBe(1);
        });
    });

    describe('scope + context matching', () => {
        it('matches a global shortcut even without a component context', () => {
            let called = 0;
            service.registerShortcut('app-1', makeRegistration({
                actionId: 'palette',
                defaultShortcut: 'ctrl+k',
                scope: 'global',
                handler: () => called++,
            }));

            expect(service.dispatch(keydown({ key: 'k', ctrlKey: true }))).toBe(true);
            expect(called).toBe(1);
        });

        it('does not match a component-scoped shortcut without a context', () => {
            service.registerShortcut('editor-1', makeRegistration({
                actionId: 'save',
                defaultShortcut: 'ctrl+s',
                scope: 'component',
            }));

            expect(service.dispatch(keydown({ key: 's', ctrlKey: true }))).toBe(false);
        });

        it('does not match a component shortcut belonging to a different componentId', () => {
            let called = 0;
            service.registerShortcut('editor-1', makeRegistration({
                actionId: 'save',
                defaultShortcut: 'ctrl+s',
                handler: () => called++,
            }));

            expect(service.dispatch(keydown({ key: 's', ctrlKey: true }), { componentId: 'other-2' })).toBe(false);
            expect(called).toBe(0);
        });

        it('prefers the in-context component handler over a global one for the same combo', () => {
            const order: string[] = [];
            service.registerShortcut('app-1', makeRegistration({
                actionId: 'global-act',
                defaultShortcut: 'ctrl+e',
                scope: 'global',
                handler: () => order.push('global'),
            }));
            service.registerShortcut('editor-1', makeRegistration({
                actionId: 'component-act',
                defaultShortcut: 'ctrl+e',
                scope: 'component',
                handler: () => order.push('component'),
            }));

            service.dispatch(keydown({ key: 'e', ctrlKey: true }), { componentId: 'editor-1' });
            expect(order).toEqual(['component']);
        });

        it('breaks ties by priority then registration order', () => {
            const order: string[] = [];
            service.registerShortcut('editor-1', makeRegistration({
                actionId: 'low',
                defaultShortcut: 'ctrl+p',
                priority: 1,
                handler: () => order.push('low'),
            }));
            service.registerShortcut('editor-1', makeRegistration({
                actionId: 'high',
                defaultShortcut: 'ctrl+p',
                priority: 5,
                handler: () => order.push('high'),
            }));

            service.dispatch(keydown({ key: 'p', ctrlKey: true }), { componentId: 'editor-1' });
            expect(order).toEqual(['high']);
        });
    });

    describe('registerComponent handle', () => {
        it('returns a handle that dispatches only its own events and can unregister', () => {
            let called = 0;
            const handle = service.registerComponent('Editor', [makeRegistration({
                actionId: 'save',
                defaultShortcut: 'ctrl+s',
                handler: () => called++,
            })]);

            expect(handle.componentId).toBe('editor-1');
            expect(handle.dispatch(keydown({ key: 's', ctrlKey: true }))).toBe(true);
            expect(called).toBe(1);

            handle.unregister();
            expect(handle.dispatch(keydown({ key: 's', ctrlKey: true }))).toBe(false);
            expect(called).toBe(1);
        });

        it('reuses released instance numbers for the same component name', () => {
            const first = service.registerComponent('Panel', [makeRegistration({ actionId: 'a', defaultShortcut: 'ctrl+1' })]);
            const second = service.registerComponent('Panel', [makeRegistration({ actionId: 'a', defaultShortcut: 'ctrl+1' })]);
            expect(first.componentId).toBe('panel-1');
            expect(second.componentId).toBe('panel-2');

            first.unregister();
            const third = service.registerComponent('Panel', [makeRegistration({ actionId: 'a', defaultShortcut: 'ctrl+1' })]);
            expect(third.componentId).toBe('panel-1');
        });

        it('unregisterComponent removes all registrations for that id', () => {
            const handle = service.registerComponent('Editor', [
                makeRegistration({ actionId: 'a', defaultShortcut: 'ctrl+1' }),
                makeRegistration({ actionId: 'b', defaultShortcut: 'ctrl+2' }),
            ]);
            expect(service.getShortcutBindingViews()).toHaveLength(2);

            service.unregisterComponent(handle.componentId);
            expect(service.getShortcutBindingViews()).toHaveLength(0);
        });
    });

    describe('overrides', () => {
        beforeEach(() => {
            service.registerComponent('Editor', [makeRegistration({
                actionId: 'save',
                defaultShortcut: 'ctrl+s',
                handler: () => undefined,
            })]);
        });

        it('component-level override changes the effective shortcut and matching', () => {
            const handle = service.registerComponent('Tool', [makeRegistration({
                actionId: 'run',
                defaultShortcut: 'ctrl+r',
            })]);
            let called = 0;
            service.registerShortcut(handle.componentId, makeRegistration({
                actionId: 'run',
                defaultShortcut: 'ctrl+r',
                handler: () => called++,
            }));

            service.setShortcutOverrideForComponent('run', 'ctrl+shift+r', 'tool');
            expect(service.getShortcutOverrideForComponent('run', 'tool')).toBe('ctrl+shift+r');

            expect(service.dispatch(keydown({ key: 'r', ctrlKey: true }), { componentId: handle.componentId })).toBe(false);
            expect(service.dispatch(keydown({ key: 'r', ctrlKey: true, shiftKey: true }), { componentId: handle.componentId })).toBe(true);
            expect(called).toBe(1);
        });

        it('instance override takes precedence over component override', () => {
            service.setShortcutOverrideForComponent('save', 'ctrl+1', 'editor');
            service.setShortcutOverrideForInstance('save', 'ctrl+2', 'editor-1');

            expect(service.getShortcutOverrideForInstance('save', 'editor-1')).toBe('ctrl+2');
        });

        it('setShortcutOverrideForAllInstances clears per-instance overrides for that action', () => {
            service.setShortcutOverrideForInstance('save', 'ctrl+9', 'editor-1');
            expect(service.hasShortcutOverrideForInstance('save', 'editor-1')).toBe(true);

            service.setShortcutOverrideForAllInstances('save', 'ctrl+8', 'editor');
            expect(service.hasShortcutOverrideForInstance('save', 'editor-1')).toBe(false);
            expect(service.getShortcutOverrideForComponent('save', 'editor')).toBe('ctrl+8');
            expect(service.hasShortcutOverrideForAllInstances('save', 'editor')).toBe(true);
        });

        it('rejects invalid (unnormalizable) shortcut overrides', () => {
            service.setShortcutOverrideForComponent('save', '   ', 'editor');
            expect(service.getShortcutOverrideForComponent('save', 'editor')).toBeNull();
        });

        it('clearShortcutOverrideForComponent removes the override', () => {
            service.setShortcutOverride('save', 'ctrl+1');
            expect(service.getShortcutOverride('save')).toBe('ctrl+1');
            service.clearShortcutOverride('save');
            expect(service.getShortcutOverride('save')).toBeNull();
        });

        it('clearShortcutOverrideForInstance removes only the instance override', () => {
            service.setShortcutOverrideForInstance('save', 'ctrl+2', 'editor-1');
            expect(service.hasShortcutOverrideForInstance('save', 'editor-1')).toBe(true);
            service.clearShortcutOverrideForInstance('save', 'editor-1');
            expect(service.hasShortcutOverrideForInstance('save', 'editor-1')).toBe(false);
        });

        it('clearShortcutOverrideForAllInstances removes both component and instance overrides', () => {
            service.setShortcutOverrideForComponent('save', 'ctrl+1', 'editor');
            service.setShortcutOverrideForInstance('save', 'ctrl+2', 'editor-1');

            service.clearShortcutOverrideForAllInstances('save', 'editor');
            expect(service.hasShortcutOverrideForAllInstances('save', 'editor')).toBe(false);
            expect(service.hasShortcutOverrideForInstance('save', 'editor-1')).toBe(false);
        });

        it('clearAllShortcutOverrides empties everything', () => {
            service.setShortcutOverride('save', 'ctrl+1');
            service.setShortcutOverrideForInstance('save', 'ctrl+2', 'editor-1');
            service.clearAllShortcutOverrides();
            expect(service.exportOverrideSchema()).toEqual({});
        });

        it('clearAllShortcutOverrides is a no-op when there are no overrides', () => {
            expect(() => service.clearAllShortcutOverrides()).not.toThrow();
            expect(service.exportOverrideSchema()).toEqual({});
        });
    });

    describe('persistence', () => {
        it('persists overrides to localStorage', () => {
            service.registerComponent('Editor', [makeRegistration({ actionId: 'save', defaultShortcut: 'ctrl+s' })]);
            service.setShortcutOverride('save', 'ctrl+shift+s');

            const raw = localStorage.getItem(STORAGE_KEY);
            expect(raw).toBeTruthy();
            expect(JSON.parse(raw as string)).toMatchObject({ save: 'ctrl+shift+s' });
        });

        it('restores overrides from localStorage on construction', () => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ save: 'ctrl+alt+s' }));
            TestBed.resetTestingModule();
            TestBed.configureTestingModule({});
            const fresh = TestBed.inject(ShortcutBindingService);
            expect(fresh.getShortcutOverride('save')).toBe('ctrl+alt+s');
        });

        it('recovers from corrupt localStorage data without throwing', () => {
            localStorage.setItem(STORAGE_KEY, '{not valid json');
            TestBed.resetTestingModule();
            TestBed.configureTestingModule({});
            expect(() => TestBed.inject(ShortcutBindingService)).not.toThrow();
        });
    });

    describe('import / export schema', () => {
        it('exports overrides sorted by key', () => {
            service.setShortcutOverride('zebra', 'ctrl+z');
            service.setShortcutOverride('alpha', 'ctrl+a');
            expect(Object.keys(service.exportOverrideSchema())).toEqual(['alpha', 'zebra']);
        });

        it('imports a schema with replace semantics', () => {
            service.setShortcutOverride('save', 'ctrl+1');
            service.importOverrideSchema({ open: 'ctrl+o' }, true);
            expect(service.getShortcutOverride('save')).toBeNull();
            expect(service.getShortcutOverride('open')).toBe('ctrl+o');
        });

        it('imports a schema with merge semantics when replace is false', () => {
            service.setShortcutOverride('save', 'ctrl+1');
            service.importOverrideSchema({ open: 'ctrl+o' }, false);
            expect(service.getShortcutOverride('save')).toBe('ctrl+1');
            expect(service.getShortcutOverride('open')).toBe('ctrl+o');
        });

        it('ignores a non-object schema', () => {
            service.setShortcutOverride('save', 'ctrl+1');
            service.importOverrideSchema(null as unknown as Record<string, string>, true);
            expect(service.getShortcutOverride('save')).toBe('ctrl+1');
        });

        it('is a no-op when replace import equals current overrides', () => {
            service.setShortcutOverride('save', 'ctrl+s');
            const before = service.exportOverrideSchema();
            service.importOverrideSchema({ save: 'ctrl+s' }, true);
            expect(service.exportOverrideSchema()).toEqual(before);
        });
    });

    describe('catalog + conflicts', () => {
        it('builds a catalog entry per defined action with instance counts', () => {
            service.registerComponent('Editor', [
                makeRegistration({ actionId: 'save', defaultShortcut: 'ctrl+s', description: 'Save', category: 'File' }),
            ]);
            service.registerComponent('Editor', [
                makeRegistration({ actionId: 'save', defaultShortcut: 'ctrl+s', description: 'Save', category: 'File' }),
            ]);

            const catalog = service.getShortcutCatalog();
            const save = catalog.find(c => c.actionId === 'save');
            expect(save).toBeDefined();
            expect(save?.activeInstanceCount).toBe(2);
            expect(save?.activeComponentIds).toContain('editor-1');
            expect(save?.activeComponentIds).toContain('editor-2');
        });

        it('detects conflicts when two actions resolve to the same shortcut', () => {
            service.registerComponent('Editor', [makeRegistration({ actionId: 'save', defaultShortcut: 'ctrl+s' })]);
            service.registerComponent('Viewer', [makeRegistration({ actionId: 'search', defaultShortcut: 'ctrl+s' })]);

            const conflicts = service.getConflicts();
            const conflict = conflicts.find(c => c.shortcut === 'ctrl+s');
            expect(conflict).toBeDefined();
            expect(conflict?.actionIds).toEqual(['save', 'search']);
        });

        it('reports no conflict when shortcuts differ', () => {
            service.registerComponent('Editor', [makeRegistration({ actionId: 'save', defaultShortcut: 'ctrl+s' })]);
            service.registerComponent('Viewer', [makeRegistration({ actionId: 'open', defaultShortcut: 'ctrl+o' })]);
            expect(service.getConflicts()).toEqual([]);
        });

        it('binding views reflect overridden effective shortcuts', () => {
            const handle = service.registerComponent('Editor', [makeRegistration({ actionId: 'save', defaultShortcut: 'ctrl+s' })]);
            service.setShortcutOverrideForInstance('save', 'ctrl+shift+s', handle.componentId);

            const view = service.getShortcutBindingViews().find(v => v.actionId === 'save');
            expect(view?.defaultShortcut).toBe('ctrl+s');
            expect(view?.effectiveShortcut).toBe('ctrl+shift+s');
        });
    });

    describe('shortcutFromEvent', () => {
        it('builds a normalized combo string from a keyboard event', () => {
            const event = keydown({ key: 'S', ctrlKey: true, shiftKey: true });
            expect(service.shortcutFromEvent(event)).toBe('ctrl+shift+s');
        });

        it('includes meta and alt modifiers in order', () => {
            const event = keydown({ key: 'k', metaKey: true, altKey: true });
            expect(service.shortcutFromEvent(event)).toBe('meta+alt+k');
        });

        it('returns null for a bare modifier keypress', () => {
            expect(service.shortcutFromEvent(keydown({ key: 'Shift', shiftKey: true }))).toBeNull();
            expect(service.shortcutFromEvent(keydown({ key: 'Control', ctrlKey: true }))).toBeNull();
        });

        it('normalizes the space key', () => {
            expect(service.shortcutFromEvent(keydown({ key: ' ' }))).toBe('space');
        });
    });

    describe('formatShortcutForDisplay', () => {
        it('formats modifiers and capitalizes the key', () => {
            expect(service.formatShortcutForDisplay('ctrl+shift+s')).toBe('Ctrl+Shift+S');
        });

        it('formats alt and space tokens', () => {
            expect(service.formatShortcutForDisplay('alt+space')).toBe('Alt+Space');
        });

        it('formats a mod token as Ctrl on non-mac platforms', () => {
            expect(service.formatShortcutForDisplay('mod+s')).toBe('Ctrl+S');
        });

        it('capitalizes multi-character key names like escape', () => {
            expect(service.formatShortcutForDisplay('escape')).toBe('Escape');
        });

        it('returns the input unchanged when it cannot be parsed', () => {
            expect(service.formatShortcutForDisplay('')).toBe('');
        });
    });

    describe('normalization aliases', () => {
        it('normalizes alias modifiers in the catalog default shortcut', () => {
            service.registerComponent('Editor', [makeRegistration({ actionId: 'save', defaultShortcut: 'control+command+option+s' })]);
            const item = service.getShortcutCatalog().find(c => c.actionId === 'save');
            expect(item?.defaultShortcut).toBe('ctrl+meta+alt+s');
        });

        it('normalizes cmdorctrl to the mod token', () => {
            service.setShortcutOverride('save', 'CmdOrCtrl+s');
            expect(service.getShortcutOverride('save')).toBe('mod+s');
        });

        it('normalizes spacebar and esc key names', () => {
            service.setShortcutOverride('a', 'spacebar');
            service.setShortcutOverride('b', 'esc');
            expect(service.getShortcutOverride('a')).toBe('space');
            expect(service.getShortcutOverride('b')).toBe('escape');
        });
    });
});
