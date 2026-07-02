import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { hoverCardAction, hoverCardHandlers } from './hover-card.preset';
import type { RichTextActionEvent } from '../actions-runtime';

function hoverEvent(phase: 'start' | 'end', params: Record<string, unknown>): RichTextActionEvent {
    const el = document.createElement('span');
    document.body.appendChild(el);
    return {
        actionId: 'preset.hover-card', trigger: 'hover', params: params as never,
        element: el, domEvent: new Event('mouseover'), phase,
    };
}

describe('hover-card preset', () => {
    it('action definition declares a hover trigger and title/body fields', () => {
        const def = hoverCardAction();
        expect(def.triggers).toEqual(['hover']);
        expect(def.fields?.map((f) => f.key)).toEqual(['title', 'body']);
        expect(def.fields?.find((f) => f.key === 'body')?.required).toBe(true);
    });

    it('custom id/label and extraFields are respected', () => {
        const def = hoverCardAction({
            id: 'hc2', label: 'My Card', extraFields: [{ key: 'k', label: 'K', type: 'text' }],
        });
        expect(def.id).toBe('hc2');
        expect(def.label).toBe('My Card');
        expect(def.fields?.some((f) => f.key === 'k')).toBe(true);
    });

    it('handler renders a card with the authored body on start', () => {
        const injector = TestBed.inject(Injector);
        const handlers = hoverCardHandlers(injector);
        handlers['preset.hover-card'](hoverEvent('start', { title: 'T', body: 'B' }));
        expect(document.body.textContent).toContain('B');
        expect(document.body.textContent).toContain('T');
        handlers['preset.hover-card'](hoverEvent('end', { title: 'T', body: 'B' }));
    });
});
