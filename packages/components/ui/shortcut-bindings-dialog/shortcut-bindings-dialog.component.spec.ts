/* eslint-disable sonarjs/deprecation -- provideNoopAnimations is deprecated in Angular 20.2 but remains the only way to set up noop animations in TestBed; no stable replacement yet. */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ShortcutBindingsDialogComponent } from './shortcut-bindings-dialog.component';
import { ShortcutBindingService } from '../../lib/shortcut-binding.service';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

class ResizeObserverStub {
    observe(): void { /* no-op */ }
    unobserve(): void { /* no-op */ }
    disconnect(): void { /* no-op */ }
}

let savedResizeObserver: typeof ResizeObserver | undefined;

beforeEach(() => {
    savedResizeObserver = globalThis.ResizeObserver;
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
});

afterEach(() => {
    if (savedResizeObserver) {
        globalThis.ResizeObserver = savedResizeObserver;
    } else {
        (globalThis as unknown as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver = undefined;
    }
});

@Component({
    template: `
        <ui-shortcut-bindings-dialog
            [(open)]="open"
            [allowSaveMapping]="allowSaveMapping()"
        />
    `,
    imports: [ShortcutBindingsDialogComponent]
})
class TestHostComponent {
    open = false;
    allowSaveMapping = signal(false);
}

describe('ShortcutBindingsDialogComponent', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let host: TestHostComponent;
    let dialog: ShortcutBindingsDialogComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent],
            providers: [provideNoopAnimations()]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();

        dialog = fixture.debugElement.query(By.directive(ShortcutBindingsDialogComponent)).componentInstance as ShortcutBindingsDialogComponent;
    });

    it('should create', () => {
        expect(fixture.componentInstance).toBeTruthy();
    });

    it('should start with dialog closed', () => {
        expect(host.open).toBe(false);
    });

    it('should accept allowSaveMapping input', async () => {
        host.allowSaveMapping.set(true);
        fixture.detectChanges();
        await fixture.whenStable();
        expect(host.allowSaveMapping()).toBe(true);
    });

    describe('search', () => {
        it('should update search signal via onSearchInput', () => {
            const mockEvent = { target: { value: 'test query' } } as any;
            dialog.onSearchInput(mockEvent);

            expect(dialog.search()).toBe('test query');
        });

        it('should set search to empty string when event target value is empty', () => {
            dialog.search.set('previous value');
            const mockEvent = { target: { value: '' } } as any;
            dialog.onSearchInput(mockEvent);

            expect(dialog.search()).toBe('');
        });

        it('should report searchActive as true when search has content', () => {
            dialog.search.set('test');

            expect(dialog.searchActive()).toBe(true);
        });

        it('should report searchActive as false when search is empty', () => {
            dialog.search.set('');

            expect(dialog.searchActive()).toBe(false);
        });

        it('should report searchActive as false when search is only whitespace', () => {
            dialog.search.set('   ');

            expect(dialog.searchActive()).toBe(false);
        });
    });

    describe('key formatting helpers', () => {
        it('should format actionKey as componentName::actionId', () => {
            expect(dialog.actionKey('toggle', 'dialog')).toBe('dialog::toggle');
        });

        it('should format groupValue as group::componentName', () => {
            expect(dialog.groupValue('dialog')).toBe('group::dialog');
        });

        it('should format actionValue with action:: prefix and actionKey', () => {
            expect(dialog.actionValue('toggle', 'dialog')).toBe('action::dialog::toggle');
        });

        it('should format captureComponentKey as component::componentName::actionId', () => {
            expect(dialog.captureComponentKey('toggle', 'dialog')).toBe('component::dialog::toggle');
        });

        it('should format captureInstanceKey as instance::componentId::actionId', () => {
            expect(dialog.captureInstanceKey('toggle', 'dialog-1')).toBe('instance::dialog-1::toggle');
        });
    });

    describe('capture state management', () => {
        it('should start with capturingActionKey as null', () => {
            expect(dialog.capturingActionKey()).toBeNull();
        });

        it('should set capturingActionKey when startCaptureForComponent is called', () => {
            const mockButton = document.createElement('button');

            dialog.startCaptureForComponent('toggle', 'dialog', mockButton);

            expect(dialog.capturingActionKey()).toBe('component::dialog::toggle');
        });

        it('should set capturingActionKey when startCaptureForInstance is called', () => {
            const mockButton = document.createElement('button');

            dialog.startCaptureForInstance('toggle', 'dialog-1', mockButton);

            expect(dialog.capturingActionKey()).toBe('instance::dialog-1::toggle');
        });

        it('should reset capturingActionKey to null when Escape is pressed during component capture', () => {
            const mockButton = document.createElement('button');
            dialog.startCaptureForComponent('toggle', 'dialog', mockButton);
            expect(dialog.capturingActionKey()).toBe('component::dialog::toggle');

            const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
            dialog.onComponentCaptureKeydown(escapeEvent, 'toggle', 'dialog');

            expect(dialog.capturingActionKey()).toBeNull();
        });

        it('should reset capturingActionKey to null when Escape is pressed during instance capture', () => {
            const mockButton = document.createElement('button');
            dialog.startCaptureForInstance('toggle', 'dialog-1', mockButton);
            expect(dialog.capturingActionKey()).toBe('instance::dialog-1::toggle');

            const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
            dialog.onInstanceCaptureKeydown(escapeEvent, 'toggle', 'dialog-1');

            expect(dialog.capturingActionKey()).toBeNull();
        });

        it('should not reset capturingActionKey on Escape if the capturing key does not match', () => {
            dialog.capturingActionKey.set('component::other::action');

            const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
            dialog.onComponentCaptureKeydown(escapeEvent, 'toggle', 'dialog');

            expect(dialog.capturingActionKey()).toBe('component::other::action');
        });
    });

    describe('format', () => {
        it('should format a simple shortcut key', () => {
            const result = dialog.format('a');
            expect(result).toBeTruthy();
            expect(typeof result).toBe('string');
        });

        it('should return the input when it cannot be parsed', () => {
            const result = dialog.format('');
            expect(result).toBe('');
        });
    });
});

describe('ShortcutBindingsDialogComponent — rebind + grouping with live bindings', () => {
    let fixture: ComponentFixture<ShortcutBindingsDialogComponent>;
    let dialog: ShortcutBindingsDialogComponent;
    let service: ShortcutBindingService;

    async function setupWithBindings(): Promise<void> {
        localStorage.clear();
        TestBed.resetTestingModule();
        await TestBed.configureTestingModule({
            imports: [ShortcutBindingsDialogComponent],
            providers: [provideNoopAnimations()],
        }).compileComponents();

        service = TestBed.inject(ShortcutBindingService);
        service.registerComponent('Editor', [
            { actionId: 'save', description: 'Save document', defaultShortcut: 'ctrl+s', category: 'File', handler: () => undefined },
            { actionId: 'open', description: 'Open document', defaultShortcut: 'ctrl+o', category: 'File', handler: () => undefined },
        ]);
        service.registerComponent('Editor', [
            { actionId: 'save', description: 'Save document', defaultShortcut: 'ctrl+s', category: 'File', handler: () => undefined },
            { actionId: 'open', description: 'Open document', defaultShortcut: 'ctrl+o', category: 'File', handler: () => undefined },
        ]);
        service.registerComponent('Viewer', [
            { actionId: 'find', description: 'Find in page', defaultShortcut: 'ctrl+s', category: 'Search', handler: () => undefined },
        ]);

        fixture = TestBed.createComponent(ShortcutBindingsDialogComponent);
        dialog = fixture.componentInstance;
        fixture.componentRef.setInput('open', true);
        fixture.detectChanges();
    }

    beforeEach(async () => {
        await setupWithBindings();
    });

    it('groups bindings by component name and reports instance counts', () => {
        const groups = dialog.groupedBindings();
        const editor = groups.find(g => g.componentName === 'editor');
        const viewer = groups.find(g => g.componentName === 'viewer');

        expect(editor).toBeDefined();
        expect(viewer).toBeDefined();
        expect(groups.map(g => g.componentName)).toEqual(['editor', 'viewer']);

        const save = editor!.bindings.find(b => b.actionId === 'save');
        expect(save).toBeDefined();
        expect(save!.instances).toHaveLength(2);
        expect(save!.instances.map(i => i.componentId)).toEqual(['editor-1', 'editor-2']);
        expect(save!.instances[0].displayName).toBe('editor #1');
    });

    it('flags actions that share a shortcut as conflicting', () => {
        expect(dialog.conflictActionIds().has('save')).toBe(true);
        expect(dialog.isConflicting('save')).toBe(true);
        expect(dialog.isConflicting('find')).toBe(true);
        expect(dialog.isConflicting('open')).toBe(false);
    });

    it('clears the conflict flag once an action is rebound to a free combo', () => {
        expect(dialog.isConflicting('find')).toBe(true);

        const btn = document.createElement('button');
        dialog.startCaptureForComponent('find', 'viewer', btn);
        dialog.onComponentCaptureKeydown(new KeyboardEvent('keydown', { key: 'g', ctrlKey: true }), 'find', 'viewer');

        expect(dialog.isConflicting('find')).toBe(false);
        expect(dialog.isConflicting('save')).toBe(false);
    });

    it('filters bindings by the search query', () => {
        dialog.search.set('Find in page');
        fixture.detectChanges();

        const filtered = dialog.filteredBindings();
        expect(filtered.map(b => b.actionId)).toEqual(['find']);
        expect(dialog.groupedBindings().map(g => g.componentName)).toEqual(['viewer']);
    });

    it('shows the empty state when no binding matches the search', () => {
        dialog.search.set('zzz-nonexistent');
        fixture.detectChanges();

        expect(dialog.groupedBindings()).toHaveLength(0);
        const empty = fixture.nativeElement.textContent as string;
        expect(empty).toContain('No shortcuts matched your search');
    });

    it('rebinds all instances when a component capture completes', () => {
        const btn = document.createElement('button');
        dialog.startCaptureForComponent('save', 'editor', btn);
        expect(dialog.capturingActionKey()).toBe('component::editor::save');

        const event = new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, shiftKey: true });
        dialog.onComponentCaptureKeydown(event, 'save', 'editor');

        expect(dialog.capturingActionKey()).toBeNull();
        expect(service.getShortcutOverrideForComponent('save', 'editor')).toBe('ctrl+shift+d');
        expect(dialog.isComponentOverridden('save', 'editor')).toBe(true);

        const view = service.getShortcutBindingViews().find(v => v.componentId === 'editor-1' && v.actionId === 'save');
        expect(view!.effectiveShortcut).toBe('ctrl+shift+d');
    });

    it('ignores a capture keydown that is only a bare modifier', () => {
        const btn = document.createElement('button');
        dialog.startCaptureForComponent('save', 'editor', btn);

        const modifierOnly = new KeyboardEvent('keydown', { key: 'Shift', shiftKey: true });
        dialog.onComponentCaptureKeydown(modifierOnly, 'save', 'editor');

        expect(dialog.capturingActionKey()).toBe('component::editor::save');
        expect(dialog.isComponentOverridden('save', 'editor')).toBe(false);
    });

    it('rebinds a single instance independently of its siblings', () => {
        const btn = document.createElement('button');
        dialog.startCaptureForInstance('save', 'editor-1', btn);

        const event = new KeyboardEvent('keydown', { key: 'm', ctrlKey: true });
        dialog.onInstanceCaptureKeydown(event, 'save', 'editor-1');

        expect(dialog.capturingActionKey()).toBeNull();
        expect(dialog.isInstanceOverridden('save', 'editor-1')).toBe(true);
        expect(dialog.isInstanceOverridden('save', 'editor-2')).toBe(false);
        expect(service.getShortcutOverrideForInstance('save', 'editor-1')).toBe('ctrl+m');
    });

    it('ignores an instance capture keydown that is only a bare modifier', () => {
        const btn = document.createElement('button');
        dialog.startCaptureForInstance('save', 'editor-1', btn);

        const modifierOnly = new KeyboardEvent('keydown', { key: 'Control', ctrlKey: true });
        dialog.onInstanceCaptureKeydown(modifierOnly, 'save', 'editor-1');

        expect(dialog.capturingActionKey()).toBe('instance::editor-1::save');
        expect(dialog.isInstanceOverridden('save', 'editor-1')).toBe(false);
    });

    it('falls back to the raw componentId as display name for instances without a numeric suffix', () => {
        service.registerShortcut('freeform', {
            actionId: 'zoom',
            description: 'Zoom in',
            defaultShortcut: 'ctrl+=',
            category: 'View',
            handler: () => undefined,
        });
        fixture.detectChanges();

        const group = dialog.groupedBindings().find(g => g.componentName === 'freeform');
        expect(group).toBeDefined();
        const binding = group!.bindings.find(b => b.actionId === 'zoom');
        expect(binding).toBeDefined();
        expect(binding!.instances).toHaveLength(1);
        expect(binding!.instances[0].componentId).toBe('freeform');
        expect(binding!.instances[0].displayName).toBe('freeform');
    });

    it('does not apply an instance capture when the capturing key does not match', () => {
        dialog.capturingActionKey.set('instance::other-9::save');
        const event = new KeyboardEvent('keydown', { key: 'm', ctrlKey: true });
        dialog.onInstanceCaptureKeydown(event, 'save', 'editor-1');

        expect(dialog.isInstanceOverridden('save', 'editor-1')).toBe(false);
        expect(dialog.capturingActionKey()).toBe('instance::other-9::save');
    });

    it('resets a component override back to default', () => {
        const btn = document.createElement('button');
        dialog.startCaptureForComponent('save', 'editor', btn);
        dialog.onComponentCaptureKeydown(new KeyboardEvent('keydown', { key: 'd', ctrlKey: true }), 'save', 'editor');
        expect(dialog.isComponentOverridden('save', 'editor')).toBe(true);

        dialog.resetComponent('save', 'editor');
        expect(dialog.isComponentOverridden('save', 'editor')).toBe(false);
        expect(dialog.capturingActionKey()).toBeNull();
    });

    it('resets a single instance override', () => {
        const btn = document.createElement('button');
        dialog.startCaptureForInstance('save', 'editor-1', btn);
        dialog.onInstanceCaptureKeydown(new KeyboardEvent('keydown', { key: 'm', ctrlKey: true }), 'save', 'editor-1');
        expect(dialog.isInstanceOverridden('save', 'editor-1')).toBe(true);

        dialog.resetInstance('save', 'editor-1');
        expect(dialog.isInstanceOverridden('save', 'editor-1')).toBe(false);
        expect(dialog.capturingActionKey()).toBeNull();
    });

    it('opens all matching groups + actions when searching', () => {
        dialog.search.set('save');
        fixture.detectChanges();

        expect(dialog.searchActive()).toBe(true);
        expect(dialog.openGroupValues()).toContain('group::editor');
        expect(dialog.openActionValuesForGroup('editor')).toContain('action::editor::save');
        expect(dialog.openActionValuesForGroup('viewer')).toEqual([]);
    });

    it('returns no open group values when search is inactive', () => {
        dialog.search.set('');
        expect(dialog.openGroupValues()).toEqual([]);
        expect(dialog.openActionValuesForGroup('editor')).toEqual([]);
    });

    it('emits the override schema via (mappingSave) when saveMappingSchema is called', () => {
        const btn = document.createElement('button');
        dialog.startCaptureForComponent('open', 'editor', btn);
        dialog.onComponentCaptureKeydown(new KeyboardEvent('keydown', { key: 'p', ctrlKey: true }), 'open', 'editor');

        let emitted: Record<string, string> | undefined;
        dialog.mappingSave.subscribe(schema => { emitted = schema; });
        dialog.saveMappingSchema();

        expect(emitted).toBeDefined();
        expect(emitted!['editor::open']).toBe('ctrl+p');
    });

    it('imports a mapping schema provided via the [mappingSchema] input', async () => {
        fixture.componentRef.setInput('mappingSchema', { 'editor::save': 'ctrl+alt+s' });
        fixture.detectChanges();
        await fixture.whenStable();

        expect(service.getShortcutOverrideForComponent('save', 'editor')).toBe('ctrl+alt+s');
        expect(dialog.isComponentOverridden('save', 'editor')).toBe(true);
    });
});

describe('ShortcutBindingsDialogComponent — i18n integration', () => {
    async function setup(opts: { locale?: string; providerLocale?: string } = {}) {
        const { provideUiLocale } = await import('../../lib/i18n');
        await TestBed.configureTestingModule({
            imports: [ShortcutBindingsDialogComponent],
            providers: [
                provideNoopAnimations(),
                ...(opts.providerLocale ? [provideUiLocale(opts.providerLocale)] : []),
            ],
        }).compileComponents();
        const fixture = TestBed.createComponent(ShortcutBindingsDialogComponent);
        if (opts.locale) fixture.componentRef.setInput('locale', opts.locale);
        fixture.componentRef.setInput('open', true);
        fixture.detectChanges();
        return fixture;
    }

    it('defaults dictionary keys to English', async () => {
        const fixture = await setup();
        const cmp = fixture.componentInstance as unknown as { t: () => { searchPlaceholder: string; conflict: string; rebindAllInstances: string; rebindInstance: string } };
        expect(cmp.t().searchPlaceholder).toContain('Search actions');
        expect(cmp.t().conflict).toBe('Conflict');
        expect(cmp.t().rebindAllInstances).toBe('Rebind all instances of {binding}');
        expect(cmp.t().rebindInstance).toBe('Rebind instance {name} for {binding}');
    });

    it('interpolates rebindAllAriaLabel and rebindInstanceAriaLabel with English template + localised template', async () => {
        const fixture = await setup();
        const cmp = fixture.componentInstance;
        expect(cmp.rebindAllAriaLabel('Open file')).toBe('Rebind all instances of Open file');
        expect(cmp.rebindInstanceAriaLabel('Editor A', 'Save')).toBe('Rebind instance Editor A for Save');

        fixture.componentRef.setInput('locale', 'he');
        fixture.detectChanges();
        expect(cmp.rebindAllAriaLabel('Open file')).toBe('מיפוי מחדש של כל המופעים של Open file');
    });

    it('falls back to UI_LOCALE_ID when no locale input is set', async () => {
        const fixture = await setup({ providerLocale: 'fr' });
        const cmp = fixture.componentInstance as unknown as { t: () => { searchPlaceholder: string } };
        expect(cmp.t().searchPlaceholder).toContain('Rechercher');
    });
});
