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
}

function buildContext(kind: RichTextColorKind): RichTextColorButtonContext & {
    onOpen: ReturnType<typeof vi.fn>;
    onSelect: ReturnType<typeof vi.fn>;
} {
    return {
        kind,
        tooltip: signal(kind === 'foreground' ? 'Text Color' : 'Background Color'),
        heading: signal('Pick a colour'),
        presets: signal(['#ff0000', '#00ff00']),
        alpha: kind === 'background',
        seededColor: signal('#123456'),
        onOpen: vi.fn(),
        onSelect: vi.fn(),
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
        p.onColorChange('#abcdef');
        expect(ctx.onSelect).toHaveBeenCalledWith('#abcdef');

        p.onOpenChange(false);
        p.onColorChange('#000000');
        expect(ctx.onSelect).toHaveBeenCalledTimes(1);
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
