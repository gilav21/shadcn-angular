import { ChangeDetectionStrategy, Component, type Injector, input } from '@angular/core';
import { mountTopLayer, anchorOverlay, type MountedOverlay } from './preset-overlay.utils';
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
        <div class="max-w-[calc(100vw-2rem)] sm:max-w-xs rounded-md border bg-popover p-3 text-popover-foreground shadow-md">
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

    const close = (): void => {
        open?.destroy();
        open = null;
    };

    const handler: RichTextActionHandler = (event: RichTextActionEvent) => {
        if (event.phase === 'start') {
            if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
            close();
            open = mountTopLayer(injector, PresetHoverCardComponent, {
                title: String(event.params['title'] ?? ''),
                body: String(event.params['body'] ?? ''),
            });
            anchorOverlay(open.host, event.element);
        } else {
            closeTimer = setTimeout(close, closeDelay);
        }
    };

    return { [id]: handler };
}
