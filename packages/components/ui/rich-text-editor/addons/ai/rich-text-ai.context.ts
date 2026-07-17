import { InjectionToken, type Signal } from '@angular/core';
import type { AiTask } from '../../../../lib/ai';
import type { RichTextAiLocale } from './rich-text-ai.locales';

/** Which panel phase is showing: the task menu, the streaming spinner, or the review controls. */
export type RichTextAiPhase = 'menu' | 'loading' | 'review';

/** A built-in AI task paired with its localized label, rendered in the menu. */
export interface RichTextAiTaskOption {
    readonly task: AiTask;
    readonly label: string;
}

/** Viewport coordinates (px) for a fixed-positioned overlay. */
export interface RichTextAiPoint {
    readonly x: number;
    readonly y: number;
}

/**
 * Context the AI directive hands to its chip and panel overlay components. It
 * carries the reactive UI state (locale, tasks, positions, phase, visibility)
 * plus the callbacks the components invoke; the directive owns the selection
 * capture, provider streaming, and content mutation through the editor host.
 */
export interface RichTextAiContext {
    /** Resolved locale strings. */
    readonly locale: Signal<RichTextAiLocale>;
    /** The six built-in tasks with localized labels. */
    readonly tasks: Signal<readonly RichTextAiTaskOption[]>;
    /** Whether the selection chip should show. */
    readonly chipVisible: Signal<boolean>;
    /** Viewport position of the selection chip. */
    readonly chipPosition: Signal<RichTextAiPoint>;
    /** Whether the panel should show. */
    readonly panelOpen: Signal<boolean>;
    /** The panel's current phase. */
    readonly phase: Signal<RichTextAiPhase>;
    /** Viewport position of the panel. */
    readonly panelPosition: Signal<RichTextAiPoint>;
    /** The last provider error, or null. */
    readonly errorMessage: Signal<string | null>;
    /** Open the task menu, capturing the current selection. */
    openPanel(): void;
    /** Run a built-in task on the captured selection. */
    runTask(task: AiTask): void;
    /** Run the user's free-form prompt. */
    runCustom(prompt: string): void;
    /** Keep the generated draft. */
    accept(): void;
    /** Drop the draft and restore the original selection. */
    discard(): void;
    /** Re-run whichever task produced the current draft. */
    retryLast(): void;
}

export const RICH_TEXT_AI_CONTEXT = new InjectionToken<RichTextAiContext>('RICH_TEXT_AI_CONTEXT');
