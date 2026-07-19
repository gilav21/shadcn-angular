import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RichTextSlashCommandsMenuComponent } from './rich-text-slash-commands-menu.component';
import { RichTextSlashCommand } from '../..';

type WithScroll = { scrollIntoView?: (arg?: unknown) => void };

const CMDS: RichTextSlashCommand[] = [
    { id: 'a', label: 'Alpha', description: 'first', run: () => undefined },
    { id: 'b', label: 'Beta', run: () => undefined },
    { id: 'c', label: 'Gamma', description: 'third', run: () => undefined },
];

describe('RichTextSlashCommandsMenuComponent', () => {
    let fixture: ComponentFixture<RichTextSlashCommandsMenuComponent>;

    function create(commands: RichTextSlashCommand[], selectedIndex = 0): void {
        fixture = TestBed.createComponent(RichTextSlashCommandsMenuComponent);
        fixture.componentRef.setInput('commands', commands);
        fixture.componentRef.setInput('selectedIndex', selectedIndex);
        fixture.componentRef.setInput('noResultsLabel', 'No commands found');
        fixture.componentRef.setInput('menuAriaLabel', 'Slash command menu');
        fixture.detectChanges();
    }

    function options(): HTMLElement[] {
        return Array.from(fixture.nativeElement.querySelectorAll('[data-slash-index]'));
    }

    const flush = (): Promise<void> => Promise.resolve().then(() => Promise.resolve());

    let hadScroll = false;
    beforeEach(() => {
        hadScroll = 'scrollIntoView' in HTMLElement.prototype;
        if (!hadScroll) {
            (HTMLElement.prototype as WithScroll).scrollIntoView = () => undefined;
        }
    });

    afterEach(() => {
        fixture?.destroy();
        if (!hadScroll) {
            delete (HTMLElement.prototype as WithScroll).scrollIntoView;
        }
    });

    it('exposes the aria-label and listbox role on the host', () => {
        create(CMDS);
        const host = fixture.nativeElement as HTMLElement;
        expect(host.getAttribute('role')).toBe('listbox');
        expect(host.getAttribute('aria-label')).toBe('Slash command menu');
        expect(host.getAttribute('data-slot')).toBe('rich-text-slash-commands-menu');
    });

    it('renders one option per command, with descriptions where present', () => {
        create(CMDS);
        const opts = options();
        expect(opts).toHaveLength(3);
        expect(opts[0].textContent).toContain('Alpha');
        expect(opts[0].textContent).toContain('first');
        expect(opts[1].textContent).toContain('Beta');
        expect(opts[1].textContent).not.toContain('first');
    });

    it('marks the selected option with aria-selected', () => {
        create(CMDS, 1);
        const opts = options();
        expect(opts[1].getAttribute('aria-selected')).toBe('true');
        expect(opts[0].getAttribute('aria-selected')).toBe('false');
    });

    it('shows the no-results label when there are no commands', () => {
        create([]);
        expect(options()).toHaveLength(0);
        expect((fixture.nativeElement as HTMLElement).textContent).toContain('No commands found');
    });

    it('emits commandSelect on click', () => {
        create(CMDS);
        let selected: RichTextSlashCommand | undefined;
        fixture.componentInstance.commandSelect.subscribe((c) => (selected = c));
        options()[2].dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(selected?.id).toBe('c');
    });

    it('emits hoverIndex on mouseenter', () => {
        create(CMDS);
        let hovered = -1;
        fixture.componentInstance.hoverIndex.subscribe((i) => (hovered = i));
        options()[1].dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        expect(hovered).toBe(1);
    });

    it('prevents default on option mousedown to keep the editor focused', () => {
        create(CMDS);
        const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
        options()[0].dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
    });

    it('scrolls the active option into view when it sits outside the list viewport', async () => {
        const scrollSpy = vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => undefined);
        create(CMDS, 2);
        const list = fixture.nativeElement.querySelector('.overflow-y-auto') as HTMLElement;
        const selected = options()[2];
        Object.defineProperty(list, 'clientHeight', { value: 40, configurable: true });
        Object.defineProperty(list, 'scrollTop', { value: 0, configurable: true });
        Object.defineProperty(selected, 'offsetTop', { value: 200, configurable: true });
        Object.defineProperty(selected, 'offsetHeight', { value: 30, configurable: true });

        fixture.componentRef.setInput('selectedIndex', 2);
        fixture.componentRef.setInput('commands', [...CMDS]);
        fixture.detectChanges();
        await flush();

        expect(scrollSpy).toHaveBeenCalled();
    });

    it('does not scroll when the active option is already visible', async () => {
        const scrollSpy = vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => undefined);
        create(CMDS, 0);
        await flush();
        expect(scrollSpy).not.toHaveBeenCalled();
    });

    it('no-ops the scroll effect when the selected index has no option', async () => {
        const scrollSpy = vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => undefined);
        create(CMDS, 0);
        fixture.componentRef.setInput('selectedIndex', 99);
        fixture.detectChanges();
        await flush();
        expect(scrollSpy).not.toHaveBeenCalled();
    });
});
