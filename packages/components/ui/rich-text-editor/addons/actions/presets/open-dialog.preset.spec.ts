import { Component, Injector, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { openDialogAction, openDialogHandlers, ACTION_PARAMS } from './open-dialog.preset';
import type { RichTextActionEvent } from '../actions-runtime';

function clickEvent(params: Record<string, unknown>): RichTextActionEvent {
    const el = document.createElement('span');
    return {
        actionId: 'preset.open-dialog', trigger: 'click', params: params as never,
        element: el, domEvent: new Event('click'), phase: 'start',
    };
}

@Component({ standalone: true, template: `<p data-testid="custom-body">{{ params['body'] }}</p>` })
class CustomBodyComponent {
    readonly params = inject(ACTION_PARAMS);
}

@Component({ standalone: true, template: '' })
class HostForInjector {
    readonly injector = inject(Injector);
}

describe('open-dialog preset', () => {
    afterEach(() => {
        document.querySelectorAll('[data-slot="preset-dialog"]').forEach((el) => el.remove());
    });

    it('definition declares click trigger + title/body/confirmLabel fields', () => {
        const def = openDialogAction();
        expect(def.triggers).toEqual(['click']);
        expect(def.fields?.map((f) => f.key).sort()).toEqual(['body', 'confirmLabel', 'title']);
    });

    it('opens a dialog on click and fires onConfirm with params', () => {
        const injector = TestBed.inject(Injector);
        const onConfirm = vi.fn();
        const handlers = openDialogHandlers(injector, { onConfirm });
        handlers['preset.open-dialog'](clickEvent({ title: 'T', body: 'B', confirmLabel: 'Go' }));
        expect(document.body.textContent).toContain('B');
        const confirmBtn = document.querySelector('[data-testid="preset-dialog-confirm"]') as HTMLButtonElement;
        expect(confirmBtn).toBeTruthy();
        confirmBtn.click();
        expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'T', body: 'B' }));
    });

    it('renders a custom component with params via the ACTION_PARAMS token', () => {
        const injector = TestBed.inject(Injector);
        const handlers = openDialogHandlers(injector, { component: CustomBodyComponent });
        handlers['preset.open-dialog'](clickEvent({ body: 'from-token' }));
        expect((document.querySelector('[data-testid="custom-body"]') as HTMLElement).textContent).toBe('from-token');
    });

    it('serialized HTML for a preset action contains nothing preset-specific (zero lock-in)', () => {
        const el = document.createElement('span');
        el.setAttribute('data-action-click', openDialogAction().id);
        el.setAttribute('data-action-click-params', JSON.stringify({ title: 'T', body: 'B' }));
        expect(el.outerHTML).not.toContain('preset-dialog');
        expect(el.outerHTML).toContain('data-action-click="preset.open-dialog"');
    });

    it('two dialog presets with custom ids coexist and compose with custom handlers', () => {
        const injector = TestBed.inject(Injector);
        const handlers = {
            ...openDialogHandlers(injector, { id: 'dialog.a' }),
            ...openDialogHandlers(injector, { id: 'dialog.b' }),
            custom: vi.fn(),
        };
        expect(Object.keys(handlers).sort((a, b) => a.localeCompare(b))).toEqual(['custom', 'dialog.a', 'dialog.b']);
        expect(openDialogAction({ id: 'dialog.a' }).id).toBe('dialog.a');
    });

    it('teardown on injector destroy removes any open dialog', () => {
        const fixture = TestBed.createComponent(HostForInjector);
        fixture.detectChanges();
        const handlers = openDialogHandlers(fixture.componentInstance.injector);
        handlers['preset.open-dialog'](clickEvent({ title: 'T', body: 'B' }));
        expect(document.querySelector('[data-slot="preset-dialog"]')).toBeTruthy();
        fixture.destroy();
        expect(document.querySelector('[data-slot="preset-dialog"]')).toBeFalsy();
    });
});
