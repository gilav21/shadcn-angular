import { describe, it, expect } from 'vitest';
import {
    validateActionId, validateActionParams, writeAction, readActions, removeAction, assertFlatParams,
    applyStarterStyle, computeSeedStyleString, stripStyleIfMatches, writeCombined, isCombinedOnElement,
} from './rich-text-actions.serializer';

describe('action serializer', () => {
    it('validates ids', () => {
        expect(validateActionId('open-dialog')).toBe('open-dialog');
        expect(validateActionId('a.b.c')).toBe('a.b.c');
        expect(validateActionId('bad id')).toBeNull();
        expect(validateActionId('')).toBeNull();
        expect(validateActionId('<script>')).toBeNull();
    });

    it('validates + canonicalizes flat params', () => {
        expect(validateActionParams('{"a":1,"b":"x","c":true}')).toBe('{"a":1,"b":"x","c":true}');
        expect(validateActionParams('{"a":{"nested":1}}')).toBeNull();
        expect(validateActionParams('{"a":[1,2]}')).toBeNull();
        expect(validateActionParams('{"a":null}')).toBeNull();
        expect(validateActionParams('not json')).toBeNull();
        expect(validateActionParams('[1,2]')).toBeNull();
        expect(validateActionParams('42')).toBeNull();
        expect(validateActionParams('null')).toBeNull();
    });

    it('rejects params over 4096 serialized chars', () => {
        const big = JSON.stringify({ a: 'x'.repeat(5000) });
        expect(validateActionParams(big)).toBeNull();
    });

    it('canonicalization is idempotent', () => {
        const once = validateActionParams('{"b":2,"a":1}');
        expect(once).not.toBeNull();
        expect(validateActionParams(once as string)).toBe(once);
    });

    it('writes and reads both triggers off one element', () => {
        const el = document.createElement('span');
        writeAction(el, 'click', 'open-dialog', { dialogId: 'pricing' });
        writeAction(el, 'hover', 'term-preview', { termId: 'sla' });
        const actions = readActions(el);
        expect(actions).toEqual([
            { trigger: 'click', id: 'open-dialog', params: { dialogId: 'pricing' } },
            { trigger: 'hover', id: 'term-preview', params: { termId: 'sla' } },
        ]);
    });

    it('reads empty params when the params attribute holds malformed or non-object JSON', () => {
        const malformed = document.createElement('span');
        malformed.setAttribute('data-action-click', 'a');
        malformed.setAttribute('data-action-click-params', '{bad');
        expect(readActions(malformed)).toEqual([{ trigger: 'click', id: 'a', params: {} }]);

        const nonObject = document.createElement('span');
        nonObject.setAttribute('data-action-hover', 'b');
        nonObject.setAttribute('data-action-hover-params', '[1,2]');
        expect(readActions(nonObject)).toEqual([{ trigger: 'hover', id: 'b', params: {} }]);
    });

    it('writes no params attribute for an empty params object', () => {
        const el = document.createElement('span');
        writeAction(el, 'click', 'a', {});
        expect(el.hasAttribute('data-action-click')).toBe(true);
        expect(el.hasAttribute('data-action-click-params')).toBe(false);
    });

    it('removeAction drops one trigger and its params, keeps the other', () => {
        const el = document.createElement('span');
        writeAction(el, 'click', 'a', { x: 1 });
        writeAction(el, 'hover', 'b', { y: 2 });
        removeAction(el, 'click');
        expect(el.hasAttribute('data-action-click')).toBe(false);
        expect(el.hasAttribute('data-action-click-params')).toBe(false);
        expect(el.getAttribute('data-action-hover')).toBe('b');
    });

    it('assertFlatParams throws on nested values', () => {
        expect(() => assertFlatParams({ a: { b: 1 } })).toThrow();
        expect(() => assertFlatParams({ a: 1, b: 'x', c: false })).not.toThrow();
    });
});

describe('starter style helpers', () => {
    it('applyStarterStyle writes camelCase keys as kebab CSS properties', () => {
        const el = document.createElement('span');
        applyStarterStyle(el, { color: '#2563eb', textUnderlineOffset: '3px' });
        expect(el.style.color).toBe('rgb(37, 99, 235)');
        expect(el.style.getPropertyValue('text-underline-offset')).toBe('3px');
    });

    it('computeSeedStyleString is the browser-canonical inline-style string', () => {
        const seed = computeSeedStyleString(document, { color: '#2563eb' });
        const el = document.createElement('span');
        applyStarterStyle(el, { color: '#2563eb' });
        expect(el.getAttribute('style')).toBe(seed);
    });

    it('stripStyleIfMatches removes an unedited seed but keeps an edited style', () => {
        const seed = computeSeedStyleString(document, { color: '#2563eb' });
        const unedited = document.createElement('span');
        applyStarterStyle(unedited, { color: '#2563eb' });
        stripStyleIfMatches(unedited, seed);
        expect(unedited.hasAttribute('style')).toBe(false);

        const edited = document.createElement('span');
        applyStarterStyle(edited, { color: '#2563eb' });
        edited.style.fontWeight = '700';
        stripStyleIfMatches(edited, seed);
        expect(edited.hasAttribute('style')).toBe(true);
    });
});

describe('combined actions', () => {
    it('writeCombined writes the same id on both triggers with per-trigger params', () => {
        const el = document.createElement('span');
        writeCombined(el, 'dictionary', { click: { value: 'sla' }, hover: { value: 'sla' } });
        expect(el.getAttribute('data-action-click')).toBe('dictionary');
        expect(el.getAttribute('data-action-hover')).toBe('dictionary');
        expect(el.getAttribute('data-action-click-params')).toBe('{"value":"sla"}');
        expect(el.getAttribute('data-action-hover-params')).toBe('{"value":"sla"}');
    });

    it('isCombinedOnElement is true only when both triggers carry the same id', () => {
        const combined = document.createElement('span');
        writeCombined(combined, 'dictionary', { click: {}, hover: {} });
        expect(isCombinedOnElement(combined)).toBe(true);

        const split = document.createElement('span');
        writeAction(split, 'click', 'a', {});
        writeAction(split, 'hover', 'b', {});
        expect(isCombinedOnElement(split)).toBe(false);
    });
});
