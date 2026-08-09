import { signal, type Provider, type WritableSignal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { ColorPickerComponent } from '../../../color-picker';
import { RichTextColorsButtonComponent } from './rich-text-colors-button.component';
import {
    RICH_TEXT_COLOR_BUTTON_CONTEXT,
    type RichTextColorButtonContext,
    type RichTextColorKind,
} from './rich-text-colors.context';
import { RichTextEditorAddonHost, RichTextToolbarViewContext } from '../..';

interface MockHost {
    disabled: WritableSignal<boolean>;
    readonly: WritableSignal<boolean>;
}

interface ButtonProbe {
    onOpenChange(next: boolean): void;
    onColorChange(color: string): void;
    onUserInteract(): void;
}

function buildContext(kind: RichTextColorKind): RichTextColorButtonContext & {
    activeColor: WritableSignal<string>;
    onOpen: ReturnType<typeof vi.fn>;
    onClose: ReturnType<typeof vi.fn>;
    onSelect: ReturnType<typeof vi.fn>;
} {
    return {
        kind,
        tooltip: signal(kind === 'foreground' ? 'Text Color' : 'Background Color'),
        heading: signal('Pick a colour'),
        presets: signal(['#ff0000', '#00ff00']),
        alpha: signal(kind === 'background'),
        showRecent: signal(false),
        seededColor: signal('#123456'),
        activeColor: signal(''),
        onOpen: vi.fn<() => void>(),
        onClose: vi.fn<() => void>(),
        onSelect: vi.fn<(color: string) => void>(),
    };
}

describe('RichTextColorsButtonComponent', () => {
    let fixture: ComponentFixture<RichTextColorsButtonComponent>;
    let host: MockHost;
    let ctx: ReturnType<typeof buildContext>;

    function render(kind: RichTextColorKind, compact?: boolean): HTMLElement {
        host = { disabled: signal(false), readonly: signal(false) };
        ctx = buildContext(kind);
        const providers: Provider[] = [
            { provide: RichTextEditorAddonHost, useValue: host },
            { provide: RICH_TEXT_COLOR_BUTTON_CONTEXT, useValue: ctx },
        ];
        if (compact !== undefined) {
            providers.push({
                provide: RichTextToolbarViewContext,
                useValue: { compact: signal(compact) },
            });
        }
        TestBed.configureTestingModule({ providers });
        fixture = TestBed.createComponent(RichTextColorsButtonComponent);
        fixture.detectChanges();
        return fixture.nativeElement as HTMLElement;
    }

    function probe(): ButtonProbe {
        return fixture.componentInstance as unknown as ButtonProbe;
    }

    afterEach(() => {
        fixture?.destroy();
    });

    it('renders a toolbar button with the localized tooltip and icon', () => {
        const el = render('foreground');
        const button = el.querySelector('button') as HTMLButtonElement;
        expect(button.title).toBe('Text Color');
        expect(button.querySelector('svg')).toBeTruthy();
        expect(button.className).toContain('p-1.5');
    });

    it('uses compact padding inside a compact toolbar view', () => {
        const el = render('background', true);
        const button = el.querySelector('button') as HTMLButtonElement;
        expect(button.className).toContain('p-1');
        expect(button.className).not.toContain('p-1.5');
    });

    it('disables the button and blocks colour changes while the editor is disabled', () => {
        const el = render('foreground');
        host.disabled.set(true);
        fixture.detectChanges();
        expect((el.querySelector('button') as HTMLButtonElement).disabled).toBe(true);

        probe().onOpenChange(true);
        probe().onUserInteract();
        probe().onColorChange('#ff0000');
        expect(ctx.onSelect).not.toHaveBeenCalled();
    });

    it('seeds the picker on open and forwards a picked colour only while open', () => {
        render('foreground');
        const p = probe();

        p.onColorChange('#abcdef');
        expect(ctx.onSelect).not.toHaveBeenCalled();

        p.onOpenChange(true);
        expect(ctx.onOpen).toHaveBeenCalledTimes(1);
        p.onUserInteract();
        p.onColorChange('#abcdef');
        expect(ctx.onSelect).toHaveBeenCalledWith('#abcdef');

        p.onOpenChange(false);
        p.onUserInteract();
        p.onColorChange('#000000');
        expect(ctx.onSelect).toHaveBeenCalledTimes(1);
    });

    it('restores the pre-open caret when the popover is dismissed', () => {
        render('foreground');
        const p = probe();

        p.onOpenChange(true);
        expect(ctx.onClose).not.toHaveBeenCalled();

        p.onOpenChange(false);
        expect(ctx.onClose).toHaveBeenCalledTimes(1);
    });

    it('ignores colour emissions that arrive as the popover tears down', () => {
        render('foreground');
        const p = probe();
        p.onOpenChange(true);
        ctx.onSelect.mockClear();

        // The picker can emit while unmounting; `open()` is already false by the
        // time onClose runs, so a teardown emission must not reach the editor.
        p.onOpenChange(false);
        p.onUserInteract();
        p.onColorChange('#ff0000');

        expect(ctx.onSelect).not.toHaveBeenCalled();
    });

    it('ignores the picker’s initialisation emission, so opening applies nothing', () => {
        render('background');
        const p = probe();

        // The picker emits its seeded value as it is built. Without the
        // interaction gate this reached the editor and coloured the caret from
        // a mere popover open.
        p.onOpenChange(true);
        p.onColorChange('#000000');

        expect(ctx.onSelect).not.toHaveBeenCalled();
    });

    it('forwards a pick that follows a user interaction', () => {
        render('background');
        const p = probe();

        p.onOpenChange(true);
        p.onUserInteract();
        p.onColorChange('#bbf7d0');

        expect(ctx.onSelect).toHaveBeenCalledWith('#bbf7d0');
    });

    it('requires a fresh interaction after each open', () => {
        render('background');
        const p = probe();
        p.onOpenChange(true);
        p.onUserInteract();
        p.onColorChange('#bbf7d0');
        p.onOpenChange(false);
        ctx.onSelect.mockClear();

        // Reopening must not inherit the previous session's interaction.
        p.onOpenChange(true);
        p.onColorChange('#bbf7d0');

        expect(ctx.onSelect).not.toHaveBeenCalled();
    });

    it('paints the underline indicator with the active colour', () => {
        const el = render('foreground');
        ctx.activeColor.set('#2563eb');
        fixture.detectChanges();

        const bar = el.querySelector('[data-slot="rte-color-indicator"]') as HTMLElement;
        expect(bar.style.backgroundColor).toBe('rgb(37, 99, 235)');
        expect(bar.className).not.toContain('bg-foreground');
    });

    it('keeps the tooltip stable as the active colour changes', () => {
        const el = render('foreground');
        ctx.activeColor.set('#2563eb');
        fixture.detectChanges();
        expect((el.querySelector('button') as HTMLButtonElement).title).toBe('Text Color');
    });

    it('falls back to a muted indicator when no highlight colour is in effect', () => {
        const el = render('background');
        const bar = el.querySelector('[data-slot="rte-color-indicator"]') as HTMLElement;
        expect(bar.style.backgroundColor).toBe('');
        expect(bar.className).toContain('bg-muted-foreground/30');
    });

    it('falls back to the editor foreground when no text colour is in effect', () => {
        const el = render('foreground');
        const bar = el.querySelector('[data-slot="rte-color-indicator"]') as HTMLElement;
        expect(bar.style.backgroundColor).toBe('');
        expect(bar.className).toContain('bg-foreground');
    });

    it('keeps the indicator inside the shared 16px icon box', () => {
        const el = render('foreground');
        const bar = el.querySelector('[data-slot="rte-color-indicator"]') as HTMLElement;
        expect((bar.parentElement as HTMLElement).className).toContain('size-4');
        expect(bar.className).toContain('h-[3px]');
    });

    it('renders the inline colour picker seeded from the context', async () => {
        render('background');
        probe().onOpenChange(true);
        fixture.detectChanges();
        await fixture.whenStable();
        const picker = fixture.debugElement.query(By.directive(ColorPickerComponent));
        expect(picker).toBeTruthy();
    });
});
