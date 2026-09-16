import { afterEach, describe, expect, it } from 'vitest';
import { inheritThemeTokens, THEME_TOKENS } from './theme-presets';

describe('inheritThemeTokens', () => {
    const isJsdom = navigator.userAgent.includes('jsdom');
    const made: HTMLElement[] = [];

    function themedHost(name: string, primary: string, parent: HTMLElement = document.body): HTMLElement {
        const el = document.createElement('div');
        el.dataset['uiTheme'] = name;
        el.style.setProperty('--primary', primary);
        el.style.setProperty('--primary-foreground', `${primary}-fg`);
        el.style.setProperty('--ring', `${primary}-ring`);
        parent.appendChild(el);
        if (parent === document.body) made.push(el);
        return el;
    }

    function overlay(): HTMLElement {
        const el = document.createElement('div');
        document.body.appendChild(el);
        made.push(el);
        return el;
    }

    afterEach(() => {
        made.splice(0).forEach(el => el.remove());
    });

    it('leaves an overlay opened outside any themed host untouched', () => {
        const origin = overlay();
        const target = overlay();
        inheritThemeTokens(origin, target);
        for (const token of THEME_TOKENS) expect(target.style.getPropertyValue(token)).toBe('');
        expect(target.hasAttribute('data-ui-theme')).toBe(false);
    });

    it('copies every preset token from the NEAREST themed ancestor', (ctx) => {
        if (isJsdom) return ctx.skip();
        const outer = themedHost('red', 'red');
        const inner = themedHost('blue', 'blue', outer);
        const origin = document.createElement('button');
        inner.appendChild(origin);
        const target = overlay();

        inheritThemeTokens(origin, target);

        expect(target.style.getPropertyValue('--primary')).toBe('blue');
        expect(target.style.getPropertyValue('--primary-foreground')).toBe('blue-fg');
        expect(target.style.getPropertyValue('--ring')).toBe('blue-ring');
        expect(target.dataset['uiTheme']).toBe('blue');
    });

    it('leaves a real descendant to inherit live instead of freezing a copy', (ctx) => {
        if (isJsdom) return ctx.skip();
        const host = themedHost('rose', 'rose');
        const inner = document.createElement('div');
        host.appendChild(inner);

        inheritThemeTokens(host, inner);

        expect(inner.style.getPropertyValue('--primary')).toBe('');
        expect(inner.hasAttribute('data-ui-theme')).toBe(false);
    });

    it('clears copies on a reused overlay once its origin is no longer themed', (ctx) => {
        if (isJsdom) return ctx.skip();
        const host = themedHost('amber', 'amber');
        const reused = overlay();
        inheritThemeTokens(host, reused);
        expect(reused.style.getPropertyValue('--ring')).toBe('amber-ring');

        delete host.dataset['uiTheme'];
        inheritThemeTokens(host, reused);

        for (const token of THEME_TOKENS) expect(reused.style.getPropertyValue(token)).toBe('');
        expect(reused.hasAttribute('data-ui-theme')).toBe(false);
    });

    it('lets an overlay opened from a themed overlay inherit in turn', (ctx) => {
        if (isJsdom) return ctx.skip();
        const host = themedHost('green', 'green');
        const menu = overlay();
        inheritThemeTokens(host, menu);

        const submenuTrigger = document.createElement('button');
        menu.appendChild(submenuTrigger);
        const submenu = overlay();
        inheritThemeTokens(submenuTrigger, submenu);

        expect(submenu.style.getPropertyValue('--ring')).toBe('green-ring');
        expect(submenu.dataset['uiTheme']).toBe('green');
    });
});
