import {
    ChangeDetectionStrategy, Component, DestroyRef, InjectionToken, Injector, input, output, type Type,
} from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { ButtonComponent } from '../../../../button';
import { directionOf, mountTopLayer, type MountedOverlay } from './preset-overlay.utils';
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
                role="dialog" aria-modal="true" [attr.dir]="dir()"
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
    /** Dialog heading; the `<h2>` is omitted entirely when empty. Fed from the action's required `title` param. */
    readonly title = input('');
    /** Body text, rendered only when {@link contentComponent} is null. Fed from the action's `body` param. */
    readonly body = input('');
    /** Label of the confirm button; falls back to `'OK'` when empty. The Close button's label is fixed. */
    readonly confirmLabel = input('');
    /**
     * Custom component rendered in the dialog body instead of {@link body}.
     * Set by {@link openDialogHandlers} from `OpenDialogPresetOptions.component`.
     */
    readonly contentComponent = input<Type<unknown> | null>(null);
    /**
     * Injector for {@link contentComponent} — the handlers pass one providing
     * {@link ACTION_PARAMS} so the custom component can read the action params.
     */
    readonly contentInjector = input<Injector | undefined>(undefined);
    /** Text direction, so RTL content aligns correctly in the detached top layer. */
    readonly dir = input<'ltr' | 'rtl'>('ltr');
    /** Confirm button pressed. {@link openDialogHandlers} calls `onConfirm` with the params, then dismisses. */
    readonly confirm = output<void>();
    /** Close button, backdrop click or `Escape`. The handlers tear the overlay down on this — nothing else does. */
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
    const openDismissers = new Set<() => void>();

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
            dir: directionOf(event.element),
        });
        overlay.host.style.inset = '0';
        const onKeydown = (e: KeyboardEvent): void => { if (e.key === 'Escape') dismiss(); };
        const dismiss = (): void => {
            document.removeEventListener('keydown', onKeydown);
            openDismissers.delete(dismiss);
            overlay.destroy();
        };
        openDismissers.add(dismiss);
        document.addEventListener('keydown', onKeydown);
        overlay.instance.confirm.subscribe(() => {
            o.onConfirm?.(params);
            dismiss();
        });
        overlay.instance.dismiss.subscribe(dismiss);
    };

    injector.get(DestroyRef, null, { optional: true })?.onDestroy(() => {
        // Each dismiss() removes only itself from the set; deleting the current
        // element during Set iteration is well-defined, so no snapshot is needed.
        for (const dismiss of openDismissers) dismiss();
    });
    return { [id]: handler };
}
