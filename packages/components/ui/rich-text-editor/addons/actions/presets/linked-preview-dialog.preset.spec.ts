import { TestBed } from '@angular/core/testing';
import { Injector } from '@angular/core';
import { describe, it, expect } from 'vitest';
import { linkedPreviewDialogAction, linkedPreviewDialogHandlers } from './linked-preview-dialog.preset';

describe('linked-preview-dialog preset', () => {
    it('hover start renders a preview card; click opens a dialog', () => {
        const injector = TestBed.inject(Injector);
        const handlers = linkedPreviewDialogHandlers(injector);
        const id = linkedPreviewDialogAction().id;
        expect(Object.keys(handlers)).toEqual([id]);
        const el = document.createElement('span');
        el.textContent = 'SLA';
        document.body.appendChild(el);
        handlers[id]({ actionId: id, trigger: 'hover', params: { title: 'SLA', body: 'Service level' },
            element: el, domEvent: new MouseEvent('mouseover'), phase: 'start' });
        expect(document.querySelector('[data-slot="preset-hover-card"]')).not.toBeNull();
        handlers[id]({ actionId: id, trigger: 'click', params: { title: 'SLA', body: 'Service level' },
            element: el, domEvent: new MouseEvent('click'), phase: 'start' });
        expect(document.querySelector('[data-slot="preset-dialog"]')).not.toBeNull();
        el.remove();
    });

    it('reuses hover-card Esc-close logic (delegates, does not reimplement)', async () => {
        const injector = TestBed.inject(Injector);
        const handlers = linkedPreviewDialogHandlers(injector, { closeDelay: 20 });
        const id = linkedPreviewDialogAction().id;
        const el = document.createElement('span');
        document.body.appendChild(el);
        handlers[id]({ actionId: id, trigger: 'hover', params: { title: 'T', body: 'B' },
            element: el, domEvent: new MouseEvent('mouseover'), phase: 'start' });
        expect(document.querySelector('[data-slot="preset-hover-card"]')).not.toBeNull();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(document.querySelector('[data-slot="preset-hover-card"]')).toBeNull();
        el.remove();
    });

    it('reuses open-dialog Esc-to-dismiss logic (delegates, does not reimplement)', () => {
        const injector = TestBed.inject(Injector);
        const handlers = linkedPreviewDialogHandlers(injector);
        const id = linkedPreviewDialogAction().id;
        const el = document.createElement('span');
        document.body.appendChild(el);
        handlers[id]({ actionId: id, trigger: 'click', params: { title: 'T', body: 'B' },
            element: el, domEvent: new MouseEvent('click'), phase: 'start' });
        expect(document.querySelector('[data-slot="preset-dialog"]')).not.toBeNull();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(document.querySelector('[data-slot="preset-dialog"]')).toBeNull();
        el.remove();
    });
});
