import { signal, type WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { RichTextAiChipComponent } from './rich-text-ai-chip.component';
import {
    RICH_TEXT_AI_CONTEXT,
    type RichTextAiContext,
    type RichTextAiPoint,
} from './rich-text-ai.context';
import { RICH_TEXT_AI_LOCALES } from './rich-text-ai.locales';

interface MockContext extends RichTextAiContext {
    chipVisible: WritableSignal<boolean>;
    chipPosition: WritableSignal<RichTextAiPoint>;
    openPanel: (() => void) & ReturnType<typeof vi.fn>;
}

function buildContext(): MockContext {
    return {
        locale: signal(RICH_TEXT_AI_LOCALES['en']),
        tasks: signal([]),
        chipVisible: signal(true),
        chipPosition: signal<RichTextAiPoint>({ x: 12, y: 34 }),
        panelOpen: signal(false),
        phase: signal('menu'),
        panelPosition: signal<RichTextAiPoint>({ x: 0, y: 0 }),
        errorMessage: signal<string | null>(null),
        openPanel: vi.fn<() => void>(),
        runTask: vi.fn(),
        runCustom: vi.fn(),
        accept: vi.fn(),
        discard: vi.fn(),
        retryLast: vi.fn(),
    };
}

describe('RichTextAiChipComponent', () => {
    let fixture: ComponentFixture<RichTextAiChipComponent>;
    let ctx: MockContext;

    function render(): HTMLElement {
        ctx = buildContext();
        TestBed.configureTestingModule({
            providers: [{ provide: RICH_TEXT_AI_CONTEXT, useValue: ctx }],
        });
        fixture = TestBed.createComponent(RichTextAiChipComponent);
        fixture.detectChanges();
        return fixture.nativeElement as HTMLElement;
    }

    afterEach(() => {
        fixture?.destroy();
    });

    function trigger(host: HTMLElement): HTMLButtonElement | null {
        return host.querySelector('[data-slot="rich-text-ai-trigger"]');
    }

    it('renders the localized trigger at the chip position when visible', () => {
        const host = render();
        const button = trigger(host)!;
        expect(button.textContent).toContain('Ask AI');
        expect(button.style.left).toBe('12px');
        expect(button.style.top).toBe('34px');
    });

    it('opens the panel when the trigger is clicked', () => {
        const host = render();
        trigger(host)!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(ctx.openPanel).toHaveBeenCalledTimes(1);
    });

    it('hides the trigger when the chip is not visible', () => {
        const host = render();
        ctx.chipVisible.set(false);
        fixture.detectChanges();
        expect(trigger(host)).toBeNull();
    });
});
