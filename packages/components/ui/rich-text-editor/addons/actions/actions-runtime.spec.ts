import { describe, it, expect, vi } from 'vitest';
import { bindRichTextActions, type RichTextActionEvent } from './actions-runtime';

function container(html: string): HTMLElement {
    const el = document.createElement('div');
    el.innerHTML = html;
    document.body.appendChild(el);
    return el;
}

describe('bindRichTextActions', () => {
    it('fires the click handler with id, params, element', () => {
        const el = container('<span data-action-click="open-dialog" data-action-click-params=\'{"dialogId":"p"}\'>t</span>');
        const seen: RichTextActionEvent[] = [];
        const off = bindRichTextActions(el, { handlers: { 'open-dialog': (e) => seen.push(e) } });
        (el.querySelector('span') as HTMLElement).click();
        expect(seen[0].actionId).toBe('open-dialog');
        expect(seen[0].params).toEqual({ dialogId: 'p' });
        expect(seen[0].trigger).toBe('click');
        expect(seen[0].phase).toBe('start');
        off(); el.remove();
    });

    it('fires innermost only for nested action spans', () => {
        const el = container('<span data-action-click="outer"><span data-action-click="inner">t</span></span>');
        const ids: string[] = [];
        const off = bindRichTextActions(el, { handlers: { '*': (e) => ids.push(e.actionId) } });
        (el.querySelector('span span') as HTMLElement).click();
        expect(ids).toEqual(['inner']);
        off(); el.remove();
    });

    it('delivers hover start/end pairs', () => {
        const el = container('<span data-action-hover="term">t</span>');
        const phases: string[] = [];
        const off = bindRichTextActions(el, { handlers: { term: (e) => phases.push(e.phase) } });
        const span = el.querySelector('span') as HTMLElement;
        span.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: el }));
        span.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: el }));
        expect(phases).toEqual(['start', 'end']);
        off(); el.remove();
    });

    it('does not re-fire hover when moving between child nodes of the same span', () => {
        const el = container('<span data-action-hover="term"><b>a</b><i>b</i></span>');
        const phases: string[] = [];
        const off = bindRichTextActions(el, { handlers: { term: (e) => phases.push(e.phase) } });
        const b = el.querySelector('b') as HTMLElement;
        const i = el.querySelector('i') as HTMLElement;
        b.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: el }));
        b.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: i }));
        expect(phases).toEqual(['start']);
        off(); el.remove();
    });

    it('fires specific handler before catch-all', () => {
        const el = container('<span data-action-click="a">t</span>');
        const order: string[] = [];
        const off = bindRichTextActions(el, {
            handlers: { a: () => order.push('specific'), '*': () => order.push('catchall') },
        });
        (el.querySelector('span') as HTMLElement).click();
        expect(order).toEqual(['specific', 'catchall']);
        off(); el.remove();
    });

    it('gives handler {} for malformed params', () => {
        const el = container('<span data-action-click="a" data-action-click-params="{bad">t</span>');
        let params: unknown = null;
        const off = bindRichTextActions(el, { handlers: { a: (e) => (params = e.params) } });
        (el.querySelector('span') as HTMLElement).click();
        expect(params).toEqual({});
        off(); el.remove();
    });

    it('applies a11y affordances and reverts them on unbind', () => {
        const el = container('<span data-action-click="a">t</span>');
        const off = bindRichTextActions(el, { handlers: { a: () => undefined } });
        const span = el.querySelector('span') as HTMLElement;
        expect(span.getAttribute('tabindex')).toBe('0');
        expect(span.getAttribute('role')).toBe('button');
        expect(span.classList.contains('rte-action-click')).toBe(true);
        off();
        expect(span.hasAttribute('tabindex')).toBe(false);
        expect(span.hasAttribute('role')).toBe(false);
        expect(span.classList.contains('rte-action-click')).toBe(false);
        el.remove();
    });

    it('stops delivering after unbind', () => {
        const el = container('<span data-action-click="a">t</span>');
        const fn = vi.fn();
        const off = bindRichTextActions(el, { handlers: { a: fn } });
        off();
        (el.querySelector('span') as HTMLElement).click();
        expect(fn).not.toHaveBeenCalled();
        el.remove();
    });

    it('adds no classes when decorateClass is null', () => {
        const el = container('<span data-action-click="a">t</span>');
        const off = bindRichTextActions(el, { handlers: { a: () => undefined }, decorateClass: null });
        expect(el.querySelector('span')!.className).toBe('');
        off(); el.remove();
    });

    it('Enter activates a click action for keyboard users', () => {
        const el = container('<span data-action-click="a">t</span>');
        const fn = vi.fn();
        const off = bindRichTextActions(el, { handlers: { a: fn } });
        const span = el.querySelector('span') as HTMLElement;
        span.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(fn).toHaveBeenCalledTimes(1);
        off(); el.remove();
    });

    it('focusin/focusout deliver hover start/end for keyboard', () => {
        const el = container('<span data-action-hover="term">t</span>');
        const phases: string[] = [];
        const off = bindRichTextActions(el, { handlers: { term: (e) => phases.push(e.phase) } });
        const span = el.querySelector('span') as HTMLElement;
        span.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        span.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        expect(phases).toEqual(['start', 'end']);
        off(); el.remove();
    });

    it('tap-to-hover: first tap shows hover + suppresses click; second tap fires click', () => {
        const el = container('<span data-action-hover="h" data-action-click="c">t</span>');
        const events: string[] = [];
        const off = bindRichTextActions(el, {
            handlers: { h: (e) => events.push('hover:' + e.phase), c: () => events.push('click') },
            touchHoverBehavior: 'tap-to-hover',
        });
        const span = el.querySelector('span') as HTMLElement;
        const firstTap = new Event('touchend', { bubbles: true, cancelable: true });
        span.dispatchEvent(firstTap);
        expect(events).toEqual(['hover:start']);
        expect(firstTap.defaultPrevented).toBe(true);
        span.dispatchEvent(new Event('touchend', { bubbles: true, cancelable: true }));
        expect(events).toContain('click');
        off(); el.remove();
    });

    it('tap-to-hover: tapping outside the held element delivers hover end', () => {
        const el = container('<span data-action-hover="h">t</span><em>outside</em>');
        const phases: string[] = [];
        const off = bindRichTextActions(el, {
            handlers: { h: (e) => phases.push(e.phase) }, touchHoverBehavior: 'tap-to-hover',
        });
        (el.querySelector('span') as HTMLElement).dispatchEvent(new Event('touchend', { bubbles: true, cancelable: true }));
        (el.querySelector('em') as HTMLElement).dispatchEvent(new Event('touchend', { bubbles: true, cancelable: true }));
        expect(phases).toEqual(['start', 'end']);
        off(); el.remove();
    });

    it('touchHoverBehavior off delivers nothing on touch', () => {
        const el = container('<span data-action-hover="h">t</span>');
        const events: string[] = [];
        const off = bindRichTextActions(el, {
            handlers: { h: (e) => events.push(e.phase) }, touchHoverBehavior: 'off',
        });
        const span = el.querySelector('span') as HTMLElement;
        span.dispatchEvent(new Event('touchend', { bubbles: true }));
        expect(events).toEqual([]);
        off(); el.remove();
    });

    it('delivers nothing when the click attribute is present but empty', () => {
        const el = container('<span data-action-click="">t</span>');
        const fn = vi.fn();
        const off = bindRichTextActions(el, { handlers: { '*': fn } });
        (el.querySelector('span') as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(fn).not.toHaveBeenCalled();
        off(); el.remove();
    });

    it('ignores keydown for keys other than Enter or Space', () => {
        const el = container('<span data-action-click="a">t</span>');
        const fn = vi.fn();
        const off = bindRichTextActions(el, { handlers: { a: fn } });
        const span = el.querySelector('span') as HTMLElement;
        span.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
        expect(fn).not.toHaveBeenCalled();
        off(); el.remove();
    });

    it('ignores Enter keydown when the target is not an actioned element', () => {
        const el = container('<span data-action-click="a">t</span><em>plain</em>');
        const fn = vi.fn();
        const off = bindRichTextActions(el, { handlers: { a: fn } });
        const em = el.querySelector('em') as HTMLElement;
        em.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(fn).not.toHaveBeenCalled();
        off(); el.remove();
    });

    it('ignores hover over a non-actioned element', () => {
        const el = container('<span data-action-hover="h">t</span><em>plain</em>');
        const fn = vi.fn();
        const off = bindRichTextActions(el, { handlers: { h: fn } });
        const em = el.querySelector('em') as HTMLElement;
        em.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        expect(fn).not.toHaveBeenCalled();
        off(); el.remove();
    });

    it('delivers hover when the mouseover carries no related target', () => {
        const el = container('<span data-action-hover="term">t</span>');
        const phases: string[] = [];
        const off = bindRichTextActions(el, { handlers: { term: (e) => phases.push(e.phase) } });
        (el.querySelector('span') as HTMLElement).dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        expect(phases).toEqual(['start']);
        off(); el.remove();
    });
});

