import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RichTextLinksButtonComponent } from './rich-text-links-button.component';
import { RICH_TEXT_LINKS_BUTTON_CONTEXT, type RichTextLinksButtonContext } from './rich-text-links.context';
import { RICH_TEXT_LINKS_LOCALES } from './rich-text-links.locales';
import type { RichTextLinkSubmit } from './rich-text-links-form.component';
import { RichTextEditorAddonHost } from '../..';

type ButtonProbe = {
    onOpenChange(next: boolean): void;
    onSubmit(payload: RichTextLinkSubmit): void;
    open: { (): boolean };
    interactionDisabled(): boolean;
};

describe('RichTextLinksButtonComponent', () => {
    const disabled = signal(false);
    const readonly = signal(false);
    const onOpen = vi.fn();
    const onSubmit = vi.fn((_payload: RichTextLinkSubmit) => undefined);
    let fixture: ComponentFixture<RichTextLinksButtonComponent>;
    let probe: ButtonProbe;

    const context: RichTextLinksButtonContext = {
        locale: signal(RICH_TEXT_LINKS_LOCALES['en']),
        seededText: signal('seed'),
        onOpen,
        onSubmit,
    };

    beforeEach(async () => {
        disabled.set(false);
        readonly.set(false);
        onOpen.mockClear();
        onSubmit.mockClear();

        await TestBed.configureTestingModule({
            imports: [RichTextLinksButtonComponent],
            providers: [
                { provide: RichTextEditorAddonHost, useValue: { disabled, readonly } },
                { provide: RICH_TEXT_LINKS_BUTTON_CONTEXT, useValue: context },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(RichTextLinksButtonComponent);
        probe = fixture.componentInstance as unknown as ButtonProbe;
        fixture.detectChanges();
    });

    afterEach(() => {
        fixture.destroy();
    });

    it('renders the trigger button with the localized tooltip', () => {
        const button = (fixture.nativeElement as HTMLElement).querySelector('button');
        expect(button?.getAttribute('title')).toBe(RICH_TEXT_LINKS_LOCALES['en'].tooltip);
    });

    it('seeds the form via onOpen when the popover opens, and tracks open state', () => {
        probe.onOpenChange(true);
        expect(onOpen).toHaveBeenCalledTimes(1);
        expect(probe.open()).toBe(true);

        probe.onOpenChange(false);
        expect(onOpen).toHaveBeenCalledTimes(1);
        expect(probe.open()).toBe(false);
    });

    it('forwards a submit to the context and closes the popover', () => {
        probe.onOpenChange(true);
        const payload: RichTextLinkSubmit = { text: 'Docs', url: 'https://x.test' };
        probe.onSubmit(payload);
        expect(onSubmit).toHaveBeenCalledWith(payload);
        expect(probe.open()).toBe(false);
    });

    it('disables interaction while the editor is disabled or readonly', () => {
        expect(probe.interactionDisabled()).toBe(false);
        readonly.set(true);
        fixture.detectChanges();
        expect(probe.interactionDisabled()).toBe(true);

        readonly.set(false);
        disabled.set(true);
        fixture.detectChanges();
        expect(probe.interactionDisabled()).toBe(true);
        const button = (fixture.nativeElement as HTMLElement).querySelector('button');
        expect(button?.disabled).toBe(true);
    });
});
