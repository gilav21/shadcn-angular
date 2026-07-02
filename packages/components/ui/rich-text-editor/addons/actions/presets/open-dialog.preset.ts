import {
    ChangeDetectionStrategy, Component, DestroyRef, InjectionToken, Injector, input, output, type Type,
} from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { ButtonComponent } from '../../../../button';
import { mountTopLayer, type MountedOverlay } from './preset-overlay.utils';
import type { ActionParams, RichTextActionDefinition, RichTextActionField } from '../rich-text-actions.types';
import type { RichTextActionEvent, RichTextActionHandler } from '../actions-runtime';

/** Injection token exposing the action params to a custom dialog content component. */
export const ACTION_PARAMS = new InjectionToken<ActionParams>('ACTION_PARAMS');

/** Options for the built-in open-dialog preset. */
export interface OpenDialogPresetOptions {
    /** Action id (also the serialized attribute value). Default `'preset.open-dialog'`. */
    id?: string;
    /** Picker label. Default `'Open dialog'`. */
    label?: string;
    /** Extra fields appended after the built-in `title`/`body`/`confirmLabel`. */
    extraFields?: RichTextActionField[];
    /** Render a custom component in the dialog body instead of the authored text. */
    component?: Type<unknown>;
    /** Called when the confirm button is pressed, with the action params. */
    onConfirm?: (params: ActionParams) => void;
}

const DEFAULT_ID = 'preset.open-dialog';

/** A ready-made open-dialog action definition (tier-1 `title`/`body`/`confirmLabel` fields). */
export function openDialogAction(o: OpenDialogPresetOptions = {}): RichTextActionDefinition {
    return {
        id: o.id ?? DEFAULT_ID,
        label: o.label ?? 'Open dialog',
        icon: 'app-window',
        triggers: ['click'],
        fields: [
            { key: 'title', label: 'Title', type: 'text', required: true },
            { key: 'body', label: 'Body', type: 'textarea' },
            { key: 'confirmLabel', label: 'Confirm button label', type: 'text' },
            ...(o.extraFields ?? []),
        ],
    };
}

/** The modal rendered on the published page for the open-dialog preset. */
@Component({
    selector: 'ui-preset-dialog',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [NgComponentOutlet, ButtonComponent],
    template: `
        <div class="fixed inset-0 flex items-center justify-center">
            <button
                type="button" aria-label="Close" class="fixed inset-0 bg-black/50"
                (click)="dismiss.emit()"
            ></button>
            <div
                class="relative max-w-[calc(100vw-2rem)] sm:max-w-md rounded-lg border bg-background p-4 shadow-xl"
                role="dialog" aria-modal="true"
            >
                @if (title()) {
                    <h2 class="mb-2 text-lg font-semibold">{{ title() }}</h2>
                }
                @if (contentComponent()) {
                    <ng-container *ngComponentOutlet="contentComponent()!; injector: contentInjector()" />
                } @else {
                    <p class="text-sm text-muted-foreground">{{ body() }}</p>
                }
                <div class="mt-4 flex flex-wrap justify-end gap-2">
                    <ui-button variant="ghost" (click)="dismiss.emit()">Close</ui-button>
                    <ui-button data-testid="preset-dialog-confirm" (click)="confirm.emit()">
                        {{ confirmLabel() || 'OK' }}
                    </ui-button>
                </div>
            </div>
        </div>
    `,
    host: { '[attr.data-slot]': "'preset-dialog'" },
})
export class PresetDialogComponent {
    readonly title = input('');
    readonly body = input('');
    readonly confirmLabel = input('');
    readonly contentComponent = input<Type<unknown> | null>(null);
    readonly contentInjector = input<Injector | undefined>(undefined);
    readonly confirm = output<void>();
    readonly dismiss = output<void>();
}

/**
 * Handlers for the open-dialog preset. Spread the returned map into your
 * `[uiRichTextActions]` handler object. Opens a real modal on click, showing
 * the authored title/body (or a custom `component`), and fires `onConfirm`.
 */
export function openDialogHandlers(
    injector: Injector, o: OpenDialogPresetOptions = {},
): Record<string, RichTextActionHandler> {
    const id = o.id ?? DEFAULT_ID;
    const openOverlays = new Set<MountedOverlay<PresetDialogComponent>>();

    const teardown = (overlay: MountedOverlay<PresetDialogComponent>): void => {
        openOverlays.delete(overlay);
        overlay.destroy();
    };

    const handler: RichTextActionHandler = (event: RichTextActionEvent) => {
        const params = event.params;
        const contentInjector = o.component
            ? Injector.create({ providers: [{ provide: ACTION_PARAMS, useValue: params }], parent: injector })
            : undefined;
        const overlay: MountedOverlay<PresetDialogComponent> = mountTopLayer(injector, PresetDialogComponent, {
            title: String(params['title'] ?? ''),
            body: String(params['body'] ?? ''),
            confirmLabel: String(params['confirmLabel'] ?? ''),
            contentComponent: o.component ?? null,
            contentInjector,
        });
        overlay.host.style.inset = '0';
        openOverlays.add(overlay);
        const onKeydown = (e: KeyboardEvent): void => { if (e.key === 'Escape') dismiss(); };
        const dismiss = (): void => {
            document.removeEventListener('keydown', onKeydown);
            teardown(overlay);
        };
        document.addEventListener('keydown', onKeydown);
        overlay.instance.confirm.subscribe(() => {
            o.onConfirm?.(params);
            dismiss();
        });
        overlay.instance.dismiss.subscribe(dismiss);
    };

    injector.get(DestroyRef, null, { optional: true })?.onDestroy(() => {
        for (const overlay of openOverlays) overlay.destroy();
        openOverlays.clear();
    });
    return { [id]: handler };
}
