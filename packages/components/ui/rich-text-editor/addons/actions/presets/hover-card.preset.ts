import { ChangeDetectionStrategy, Component, DestroyRef, type Injector, input } from '@angular/core';
import { anchorOverlay, directionOf, mountTopLayer, type MountedOverlay } from './preset-overlay.utils';
import type { RichTextActionDefinition, RichTextActionField } from '../rich-text-actions.types';
import type { RichTextActionEvent, RichTextActionHandler } from '../actions-runtime';

/** Options for the built-in hover-card preset. */
export interface HoverCardPresetOptions {
    /** Action id (also the serialized attribute value). Default `'preset.hover-card'`. */
    id?: string;
    /** Picker label. Default `'Hover card'`. */
    label?: string;
    /** Extra fields appended after the built-in `title`/`body`. */
    extraFields?: RichTextActionField[];
    /** Delay before the card closes on hover-end, ms. Default 200. */
    closeDelay?: number;
}

const DEFAULT_ID = 'preset.hover-card';

/** A ready-made hover-card action definition (tier-1 `title`/`body` fields). */
export function hoverCardAction(o: HoverCardPresetOptions = {}): RichTextActionDefinition {
    return {
        id: o.id ?? DEFAULT_ID,
        label: o.label ?? 'Hover card',
        icon: 'sparkles',
        triggers: ['hover'],
        fields: [
            { key: 'title', label: 'Title', type: 'text' },
            { key: 'body', label: 'Body', type: 'textarea', required: true },
            ...(o.extraFields ?? []),
        ],
    };
}

/** The card rendered on the published page for the hover-card preset. */
@Component({
    selector: 'ui-preset-hover-card',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div
            class="max-w-[calc(100vw-2rem)] sm:max-w-xs rounded-md border bg-popover p-3 text-popover-foreground shadow-md"
            [attr.dir]="dir()"
        >
            @if (title()) {
                <p class="mb-1 text-sm font-semibold">{{ title() }}</p>
            }
            <p class="text-sm text-muted-foreground">{{ body() }}</p>
        </div>
    `,
    host: { '[attr.data-slot]': "'preset-hover-card'" },
})
export class PresetHoverCardComponent {
    readonly title = input('');
    readonly body = input('');
    /** Text direction, so RTL content (title + body) aligns correctly. */
    readonly dir = input<'ltr' | 'rtl'>('ltr');
}

/**
 * Handlers for the hover-card preset. Spread the returned map into your
 * `[uiRichTextActions]` handler object. Renders a real floating card in the
 * top layer on hover-start, removing it (after `closeDelay`) on hover-end.
 */
export function hoverCardHandlers(
    injector: Injector, o: HoverCardPresetOptions = {},
): Record<string, RichTextActionHandler> {
    const id = o.id ?? DEFAULT_ID;
    const closeDelay = o.closeDelay ?? 200;
    let open: MountedOverlay<PresetHoverCardComponent> | null = null;
    let closeTimer: ReturnType<typeof setTimeout> | null = null;
    let onKeydown: ((e: KeyboardEvent) => void) | null = null;

    const cancelClose = (): void => {
        if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
    };

    const close = (): void => {
        cancelClose();
        if (onKeydown) { document.removeEventListener('keydown', onKeydown); onKeydown = null; }
        open?.destroy();
        open = null;
    };

    const scheduleClose = (): void => {
        cancelClose();
        closeTimer = setTimeout(close, closeDelay);
    };

    const handler: RichTextActionHandler = (event: RichTextActionEvent) => {
        if (event.phase === 'end') {
            scheduleClose();
            return;
        }
        cancelClose();
        close();
        open = mountTopLayer(injector, PresetHoverCardComponent, {
            title: String(event.params['title'] ?? ''),
            body: String(event.params['body'] ?? ''),
            dir: directionOf(event.element),
        });
        anchorOverlay(open.host, event.element);
        // Grace area: keep the card open while the pointer is over it.
        open.host.addEventListener('mouseenter', cancelClose);
        open.host.addEventListener('mouseleave', scheduleClose);
        onKeydown = (e: KeyboardEvent): void => { if (e.key === 'Escape') close(); };
        document.addEventListener('keydown', onKeydown);
    };

    injector.get(DestroyRef, null, { optional: true })?.onDestroy(close);
    return { [id]: handler };
}
