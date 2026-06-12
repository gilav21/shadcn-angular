/* eslint-disable sonarjs/deprecation -- provideNoopAnimations is deprecated in Angular 20.2 but remains the only way to set up noop animations in TestBed; no stable replacement yet. */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ShortcutBindingsDialogComponent } from './shortcut-bindings-dialog.component';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { describe, it, expect, beforeEach } from 'vitest';

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
