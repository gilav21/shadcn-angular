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
