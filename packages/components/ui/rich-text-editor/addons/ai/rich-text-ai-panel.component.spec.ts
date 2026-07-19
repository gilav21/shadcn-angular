import { signal, type WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { RichTextAiPanelComponent } from './rich-text-ai-panel.component';
import {
    RICH_TEXT_AI_CONTEXT,
    type RichTextAiContext,
    type RichTextAiPhase,
    type RichTextAiPoint,
    type RichTextAiTaskOption,
} from './rich-text-ai.context';
import { RICH_TEXT_AI_LOCALES } from './rich-text-ai.locales';

interface MockContext extends RichTextAiContext {
    tasks: WritableSignal<readonly RichTextAiTaskOption[]>;
    panelOpen: WritableSignal<boolean>;
    phase: WritableSignal<RichTextAiPhase>;
    errorMessage: WritableSignal<string | null>;
    runTask: ReturnType<typeof vi.fn>;
    runCustom: ReturnType<typeof vi.fn>;
    accept: ReturnType<typeof vi.fn>;
    discard: ReturnType<typeof vi.fn>;
    retryLast: ReturnType<typeof vi.fn>;
}

const TASKS: readonly RichTextAiTaskOption[] = [
    { task: 'rewrite', label: 'Improve writing' },
    { task: 'summarize', label: 'Summarize' },
];

function buildContext(): MockContext {
    return {
        locale: signal(RICH_TEXT_AI_LOCALES.en),
        tasks: signal(TASKS),
        chipVisible: signal(false),
        chipPosition: signal<RichTextAiPoint>({ x: 0, y: 0 }),
        panelOpen: signal(true),
        phase: signal<RichTextAiPhase>('menu'),
        panelPosition: signal<RichTextAiPoint>({ x: 5, y: 6 }),
        errorMessage: signal<string | null>(null),
        openPanel: vi.fn(),
        runTask: vi.fn(),
        runCustom: vi.fn(),
        accept: vi.fn(),
        discard: vi.fn(),
        retryLast: vi.fn(),
    };
}

describe('RichTextAiPanelComponent', () => {
    let fixture: ComponentFixture<RichTextAiPanelComponent>;
    let ctx: MockContext;

    function render(): HTMLElement {
        ctx = buildContext();
        TestBed.configureTestingModule({
            providers: [{ provide: RICH_TEXT_AI_CONTEXT, useValue: ctx }],
        });
        fixture = TestBed.createComponent(RichTextAiPanelComponent);
        fixture.detectChanges();
        return fixture.nativeElement as HTMLElement;
    }

    afterEach(() => {
        fixture?.destroy();
    });

    function slot(host: HTMLElement, name: string): HTMLElement | null {
        return host.querySelector(`[data-slot="${name}"]`);
    }

    it('lists the menu task buttons and runs one on click', () => {
        const host = render();
        const menu = slot(host, 'rich-text-ai-menu')!;
        const taskButtons = menu.querySelectorAll(':scope > button');
        expect(taskButtons).toHaveLength(2);
        taskButtons[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(ctx.runTask).toHaveBeenCalledWith('summarize');
    });

    it('forwards a typed custom prompt through runCustom and ignores blank input', () => {
        const host = render();
        const input = slot(host, 'rich-text-ai-menu')!.querySelector('input') as HTMLInputElement;
        const go = () => {
            const buttons = slot(host, 'rich-text-ai-menu')!.querySelectorAll('button');
            buttons[buttons.length - 1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
        };

        go();
        expect(ctx.runCustom).not.toHaveBeenCalled();

        input.value = '  make it formal  ';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        fixture.detectChanges();
        go();
        expect(ctx.runCustom).toHaveBeenCalledWith('make it formal');
    });

    it('clears the custom prompt when the panel returns to the menu phase', () => {
        const host = render();
        const input = slot(host, 'rich-text-ai-menu')!.querySelector('input') as HTMLInputElement;
        input.value = 'draft';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        fixture.detectChanges();
        expect(input.value).toBe('draft');

        ctx.phase.set('loading');
        fixture.detectChanges();
        ctx.phase.set('menu');
        fixture.detectChanges();
        const reopened = slot(host, 'rich-text-ai-menu')!.querySelector('input') as HTMLInputElement;
        expect(reopened.value).toBe('');
    });

    it('shows the streaming status while loading and disables Accept', () => {
        const host = render();
        ctx.phase.set('loading');
        fixture.detectChanges();
        expect(slot(host, 'rich-text-ai-loading')?.textContent).toContain('Generating');
        const accept = slot(host, 'rich-text-ai-review')!.querySelector('button') as HTMLButtonElement;
        expect(accept.disabled).toBe(true);
    });

    it('renders the error and wires the review controls', () => {
        const host = render();
        ctx.phase.set('review');
        ctx.errorMessage.set('boom');
        fixture.detectChanges();
        expect(slot(host, 'rich-text-ai-error')?.textContent).toContain('boom');

        const buttons = slot(host, 'rich-text-ai-review')!.querySelectorAll('button');
        buttons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
        buttons[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
        buttons[2].dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(ctx.accept).toHaveBeenCalledTimes(1);
        expect(ctx.discard).toHaveBeenCalledTimes(1);
        expect(ctx.retryLast).toHaveBeenCalledTimes(1);
    });

    it('does not render when the panel is closed', () => {
        const host = render();
        ctx.panelOpen.set(false);
        fixture.detectChanges();
        expect(slot(host, 'rich-text-ai-panel')).toBeNull();
    });
});
