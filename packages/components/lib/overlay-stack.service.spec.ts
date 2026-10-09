import { DOCUMENT } from '@angular/common';
import { Injector } from '@angular/core';
import { afterEach, describe, expect, it } from 'vitest';
import { OverlayStackService } from './overlay-stack.service';

/**
 * Task-1 scaffolding: the stack's v2 surface (`register` / `isTopmost` and the
 * `OverlayLayer` shape) lands in Task 2 of
 * specs/overlay-stack-scroll-lock-and-escape-spec.md, which replaces this
 * interface with the real exports.
 */
interface OverlayLayer {
    readonly dismiss: () => void;
    readonly modal: boolean;
}
interface StackV2 {
    register(layer: OverlayLayer): () => void;
    isTopmost(layer: OverlayLayer): boolean;
}

/** A service instance of its own, bound to `doc` — what a second bundled copy of the class amounts to. */
function stackOn(doc: Document): StackV2 {
    const injector = Injector.create({
        providers: [OverlayStackService, { provide: DOCUMENT, useValue: doc }],
    });
    return injector.get(OverlayStackService) as unknown as StackV2;
}

/** A layer that records its own dismissal into `log` under `name`. */
function layer(name: string, modal: boolean, log: string[]): OverlayLayer {
    return { modal, dismiss: () => log.push(name) };
}

function escape(target: EventTarget, init: KeyboardEventInit = {}): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
}

/** The inline body declarations the lock may touch, longhand by longhand. */
function bodyInline(doc: Document): { overflowX: string; overflowY: string; paddingRight: string } {
    const style = doc.body.style;
    return {
        overflowX: style.getPropertyValue('overflow-x'),
        overflowY: style.getPropertyValue('overflow-y'),
        paddingRight: style.getPropertyValue('padding-right'),
    };
}

describe('OverlayStackService — scroll lock', () => {
    const originalBodyStyle = document.body.getAttribute('style');
    afterEach(() => {
        // Restores the consumer styles this file sets as fixture input, not a lock leak.
        if (originalBodyStyle === null) document.body.removeAttribute('style');
        else document.body.setAttribute('style', originalBodyStyle);
    });

    it.fails.each([
        { name: 'consumer inline overflow and padding', inline: 'overflow: clip; padding-right: 12px' },
        { name: 'no inline styles', inline: '' },
    ])('locks the body while any modal layer is registered and restores its prior inline styles after the last ($name)', ({ inline }) => {
        document.body.setAttribute('style', inline);
        const before = bodyInline(document);
        const stack = stackOn(document);
        const log: string[] = [];

        const unregisterAlone = stack.register(layer('menu', false, log));
        expect(bodyInline(document)).toEqual(before);
        unregisterAlone();

        const unregisterA = stack.register(layer('sheet', true, log));
        expect(document.body.style.overflow).toBe('hidden');
        const unregisterP = stack.register(layer('popover', false, log));
        const unregisterB = stack.register(layer('confirm', true, log));

        unregisterA();
        expect(document.body.style.overflow).toBe('hidden');
        unregisterP();
        expect(document.body.style.overflow).toBe('hidden');
        unregisterB();

        expect(bodyInline(document)).toEqual(before);
        expect(log).toEqual([]);
    });

    it.fails.each([
        { name: '17px classic scrollbar', clientWidth: 1263, expected: '33px' },
        { name: 'overlay scrollbar', clientWidth: 1280, expected: '1rem' },
    ])('adds the scrollbar width to the existing right padding, and nothing when there is no scrollbar ($name)', ({ clientWidth, expected }) => {
        const doc = document.implementation.createHTMLDocument('fake');
        doc.body.style.paddingRight = '1rem';
        Object.defineProperty(doc.documentElement, 'clientWidth', { configurable: true, value: clientWidth });
        Object.defineProperty(doc, 'defaultView', {
            configurable: true,
            value: {
                innerWidth: 1280,
                getComputedStyle: () => ({
                    paddingRight: '16px',
                    getPropertyValue: (name: string) => (name === 'padding-right' ? '16px' : ''),
                }),
            },
        });

        const unregister = stackOn(doc).register(layer('dialog', true, []));
        expect(doc.body.style.paddingRight).toBe(expected);
        expect(doc.body.style.overflow).toBe('hidden');

        unregister();
        expect(doc.body.style.paddingRight).toBe('1rem');
        expect(doc.body.style.overflow).toBe('');
    });

    it.fails('locks and unlocks against a document with no defaultView', () => {
        const serverDoc = document.implementation.createHTMLDocument('server');
        expect(serverDoc.defaultView).toBeNull();
        const original = Object.getOwnPropertyDescriptor(globalThis, 'innerWidth');
        let globalReads = 0;
        Object.defineProperty(globalThis, 'innerWidth', {
            configurable: true,
            get: () => {
                globalReads++;
                return 1280;
            },
        });
        try {
            const unregister = stackOn(serverDoc).register(layer('dialog', true, []));
            expect(serverDoc.body.style.overflow).toBe('hidden');
            expect(serverDoc.body.style.paddingRight).toBe('');
            unregister();
            expect(serverDoc.body.style.overflow).toBe('');
        } finally {
            if (original) Object.defineProperty(globalThis, 'innerWidth', original);
        }
        expect(globalReads).toBe(0);
    });
});

describe('OverlayStackService — Escape', () => {
    const fixtures: HTMLElement[] = [];
    afterEach(() => fixtures.splice(0).forEach(el => el.remove()));

    function mount(html: string): HTMLElement {
        const root = document.createElement('div');
        root.innerHTML = html;
        document.body.appendChild(root);
        fixtures.push(root);
        return root;
    }

    it.fails('Escape dismisses exactly the top layer, wherever focus is', () => {
        const root = mount(`
            <section data-layer="dialog"><input aria-label="Name"></section>
            <section data-layer="popover"><button type="button">Details</button></section>
            <section data-layer="confirm"><input aria-label="Type DELETE"></section>
            <p data-outside>Page text</p>
        `);
        const stack = stackOn(document);
        const log: string[] = [];
        const unregister = [
            stack.register(layer('dialog', true, log)),
            stack.register(layer('popover', false, log)),
            stack.register(layer('confirm', true, log)),
        ];

        const inTopLayer = escape(root.querySelector<HTMLElement>('[data-layer="confirm"] input')!);
        expect(log).toEqual(['confirm']);
        expect(inTopLayer.defaultPrevented).toBe(true);

        escape(document.body);
        expect(log).toEqual(['confirm', 'popover']);

        escape(root.querySelector<HTMLElement>('[data-outside]')!);
        expect(log).toEqual(['confirm', 'popover', 'dialog']);

        escape(document.body);
        expect(log).toEqual(['confirm', 'popover', 'dialog']);

        unregister.forEach(fn => fn());
    });

    it.fails('Escape that was preventDefault-ed, or arrives mid-composition, dismisses nothing', () => {
        const root = mount(`<div data-submenu><button type="button">Export as…</button></div>`);
        const submenu = root.querySelector<HTMLElement>('[data-submenu]')!;
        const item = submenu.querySelector('button')!;
        const stack = stackOn(document);
        const log: string[] = [];
        const menu = layer('menu', false, log);
        const unregister = stack.register(menu);

        const consume = (event: KeyboardEvent): void => {
            if (event.key === 'Escape') event.preventDefault();
        };
        submenu.addEventListener('keydown', consume);
        escape(item);
        submenu.removeEventListener('keydown', consume);

        escape(item, { isComposing: true });
        item.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        expect(log).toEqual([]);
        expect(stack.isTopmost(menu)).toBe(true);

        escape(item);
        expect(log).toEqual(['menu']);
        expect(stack.isTopmost(menu)).toBe(false);
        unregister();
    });

    it.fails('two service instances on one document share one stack and one lock', () => {
        const before = bodyInline(document);
        const app = stackOn(document);
        const packaged = stackOn(document);
        const log: string[] = [];
        const editSheet = layer('sheet', true, log);
        const confirm = layer('confirm', true, log);

        const unregisterSheet = app.register(editSheet);
        const unregisterConfirm = packaged.register(confirm);
        expect(app.isTopmost(confirm)).toBe(true);
        expect(packaged.isTopmost(editSheet)).toBe(false);

        // Both layers still open: one listener per document, so one press dismisses one layer.
        escape(document.body);
        expect(log).toEqual(['confirm']);
        expect(document.body.style.overflow).toBe('hidden');

        unregisterSheet();
        expect(bodyInline(document)).toEqual(before);
        unregisterConfirm();
    });
});
