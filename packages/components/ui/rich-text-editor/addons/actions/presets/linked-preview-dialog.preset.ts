import { DestroyRef, type Injector } from '@angular/core';
import { anchorOverlay, directionOf, mountTopLayer, type MountedOverlay } from './preset-overlay.utils';
import { PresetHoverCardComponent, type HoverCardPresetOptions } from './hover-card.preset';
import { PresetDialogComponent, type OpenDialogPresetOptions } from './open-dialog.preset';
import type { ActionParamsMode, RichTextActionDefinition, RichTextActionField } from '../rich-text-actions.types';
import type { RichTextActionEvent, RichTextActionHandler } from '../actions-runtime';

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
    /** Close delay for the hover preview, ms. Default 200. */
    closeDelay?: number;
    hover?: HoverCardPresetOptions;
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

/** Handlers for the combined preset — one id, branching on `event.trigger`. */
export function linkedPreviewDialogHandlers(
    injector: Injector, o: LinkedPreviewDialogOptions = {},
): Record<string, RichTextActionHandler> {
    const id = o.id ?? DEFAULT_ID;
    const closeDelay = o.closeDelay ?? 200;
    let card: MountedOverlay<PresetHoverCardComponent> | null = null;
    let closeTimer: ReturnType<typeof setTimeout> | null = null;
    const openDialogs = new Set<() => void>();

    const closeCard = (): void => {
        if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
        card?.destroy();
        card = null;
    };

    const onHover = (event: RichTextActionEvent): void => {
        if (event.phase === 'end') { closeTimer = setTimeout(closeCard, closeDelay); return; }
        closeCard();
        card = mountTopLayer(injector, PresetHoverCardComponent, {
            title: String(event.params['title'] ?? ''),
            body: String(event.params['body'] ?? ''),
            dir: directionOf(event.element),
        });
        anchorOverlay(card.host, event.element);
    };

    const onClick = (event: RichTextActionEvent): void => {
        const overlay: MountedOverlay<PresetDialogComponent> = mountTopLayer(injector, PresetDialogComponent, {
            title: String(event.params['title'] ?? ''),
            body: String(event.params['body'] ?? ''),
            confirmLabel: String(event.params['confirmLabel'] ?? ''),
            contentComponent: null, contentInjector: undefined,
            dir: directionOf(event.element),
        });
        overlay.host.style.inset = '0';
        const dismiss = (): void => { openDialogs.delete(dismiss); overlay.destroy(); };
        openDialogs.add(dismiss);
        overlay.instance.confirm.subscribe(dismiss);
        overlay.instance.dismiss.subscribe(dismiss);
    };

    const handler: RichTextActionHandler = (event) =>
        (event.trigger === 'hover' ? onHover(event) : onClick(event));

    injector.get(DestroyRef, null, { optional: true })?.onDestroy(() => {
        closeCard();
        for (const dismiss of openDialogs) dismiss();
    });
    return { [id]: handler };
}
