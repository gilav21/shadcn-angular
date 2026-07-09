import type { Injector } from '@angular/core';
import { hoverCardHandlers, type HoverCardPresetOptions } from './hover-card.preset';
import { openDialogHandlers, type OpenDialogPresetOptions } from './open-dialog.preset';
import type { ActionParamsMode, RichTextActionDefinition, RichTextActionField } from '../rich-text-actions.types';
import type { RichTextActionHandler } from '../actions-runtime';

/** Options for the combined hover-preview + click-dialog preset. */
export interface LinkedPreviewDialogOptions {
    /** Action id (serialized). Default `'preset.linked-preview-dialog'`. */
    id?: string;
    /** Picker label. Default `'Preview + dialog'`. */
    label?: string;
    /** `'shared'` (default) or `'separate'`. */
    paramsMode?: ActionParamsMode;
    /** Extra fields appended after the built-in `title`/`body`. */
    extraFields?: RichTextActionField[];
    /** Close delay for the hover preview, ms. Default 200 (from the hover-card preset). */
    closeDelay?: number;
    /** Forwarded to the hover-card preset's rendering (grace-area/Esc logic reused as-is). */
    hover?: HoverCardPresetOptions;
    /** Forwarded to the open-dialog preset's rendering (Esc-to-dismiss logic reused as-is). */
    dialog?: OpenDialogPresetOptions;
}

const DEFAULT_ID = 'preset.linked-preview-dialog';

/** A ready-made combined action: hover shows a preview card, click opens a dialog. */
export function linkedPreviewDialogAction(o: LinkedPreviewDialogOptions = {}): RichTextActionDefinition {
    return {
        id: o.id ?? DEFAULT_ID,
        label: o.label ?? 'Preview + dialog',
        icon: 'book-open',
        triggers: ['click', 'hover'],
        combined: true,
        paramsMode: o.paramsMode ?? 'shared',
        fields: [
            { key: 'title', label: 'Title', type: 'text' },
            { key: 'body', label: 'Body', type: 'textarea', required: true },
            ...(o.extraFields ?? []),
        ],
    };
}

/**
 * Handlers for the combined preset — a single `{ [id]: handler }` entry whose
 * handler branches on `event.trigger`, delegating to the hover-card preset's
 * handler for `hover` events and the open-dialog preset's handler for
 * `click` events (both re-keyed onto the combined id). This reuses the
 * hover-card grace-area/Esc-to-close logic and the open-dialog Esc-to-dismiss
 * logic verbatim, plus their own `DestroyRef` teardown, instead of
 * reimplementing overlay lifecycle here.
 */
export function linkedPreviewDialogHandlers(
    injector: Injector, o: LinkedPreviewDialogOptions = {},
): Record<string, RichTextActionHandler> {
    const id = o.id ?? DEFAULT_ID;
    const hoverHandlers = hoverCardHandlers(injector, {
        ...o.hover, id, closeDelay: o.hover?.closeDelay ?? o.closeDelay,
    });
    const dialogHandlers = openDialogHandlers(injector, { ...o.dialog, id });

    const handler: RichTextActionHandler = (event) =>
        (event.trigger === 'hover' ? hoverHandlers[id](event) : dialogHandlers[id](event));

    return { [id]: handler };
}
