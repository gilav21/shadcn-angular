import {
    type ComponentRef,
    DestroyRef,
    Directive,
    Injector,
    ViewContainerRef,
    afterNextRender,
    effect,
    inject,
    input,
    output,
    signal,
} from '@angular/core';
import { RichTextEditorAddonHost } from '../..';
import { createLocaleBindings, type LocaleInput } from '../../../../lib/i18n';
import { RichTextHistoryPanelComponent } from './rich-text-history-panel.component';
import { RICH_TEXT_HISTORY_LOCALES, type RichTextHistoryLocale } from './rich-text-history.locales';

const HISTORY_SHORTCUT_ACTION = 'rich-text.history';

/**
 * Opt-in revision-history addon for `<ui-rich-text-editor>`. Attaches via DI to
 * the `RichTextEditorAddonHost` the base provides and renders the "Revisions"
 * corner button + panel, the preview dialog, and the browser dialog. The base
 * editor keeps the undo/redo stack but ships no revision-history UI and no
 * `dialog` dependency.
 *
 * Replaces the former `[showHistoryPanel]` / `[showHistoryButton]` inputs:
 * adding the directive enables the feature, and `[uiRteHistoryButton]` toggles
 * the corner button (false = shortcut-only, opening the browser dialog).
 *
 * The panel's strings resolve from `[uiRteHistoryLocale]` (a registry key or a
 * full dictionary) or the app-wide `UI_LOCALE_ID` token — NOT the editor's own
 * `[locale]` input, which no longer carries the history strings.
 *
 * ```html
 * <ui-rich-text-editor uiRteHistory />
 * <ui-rich-text-editor uiRteHistory [uiRteHistoryButton]="false" />
 * ```
 */
@Directive({
    selector: 'ui-rich-text-editor[uiRteHistory], ui-rich-text-editor[uiRteFull]',
    standalone: true,
})
export class RichTextHistoryDirective {
    private readonly host = inject(RichTextEditorAddonHost);
    private readonly vcr = inject(ViewContainerRef);
    private readonly injector = inject(Injector);

    /** Enable the revision-history addon (the bare `uiRteHistory` attribute). Flip to `false` to remove the button + panel live. */
    readonly uiRteHistory = input(true, { transform: coerceEnabled });
    /** Show the corner "Revisions" button. When `false`, the panel opens only via the keyboard shortcut. */
    readonly uiRteHistoryButton = input(true);
    /** Locale for the panel UI: a registry key (`'en'`/`'he'`/…) or a full dictionary. */
    readonly uiRteHistoryLocale = input<LocaleInput<RichTextHistoryLocale>>();

    /** Emits the restored entry index whenever a revision is applied. */
    readonly historyRestore = output<number>();

    private readonly i18n = createLocaleBindings(this.uiRteHistoryLocale, RICH_TEXT_HISTORY_LOCALES);
    private readonly viewReady = signal(false);
    private readonly panelReady = signal(false);
    private panelRef?: ComponentRef<RichTextHistoryPanelComponent>;

    constructor() {
        const offShortcut = this.host.registerShortcutAction(
            HISTORY_SHORTCUT_ACTION,
            () => this.panelRef?.instance.openFromShortcut(),
        );

        afterNextRender(() => this.viewReady.set(true));

        effect((onCleanup) => {
            if (!this.uiRteHistory() || !this.viewReady()) return;
            this.mountPanel();
            onCleanup(() => this.destroyPanel());
        });

        effect(() => {
            const locale = this.i18n.t();
            const showButton = this.uiRteHistoryButton();
            if (!this.panelReady()) return;
            this.panelRef?.setInput('locale', locale);
            this.panelRef?.setInput('showButton', showButton);
        });

        inject(DestroyRef).onDestroy(() => offShortcut());
    }

    private mountPanel(): void {
        const ref = this.vcr.createComponent(RichTextHistoryPanelComponent, { injector: this.injector });
        this.host.overlayAnchor.appendChild(ref.location.nativeElement as HTMLElement);
        ref.instance.restore.subscribe((index) => this.historyRestore.emit(index));
        this.panelRef = ref;
        this.panelReady.set(true);
    }

    private destroyPanel(): void {
        this.panelReady.set(false);
        const element = this.panelRef?.location.nativeElement as HTMLElement | undefined;
        this.panelRef?.destroy();
        element?.remove();
        this.panelRef = undefined;
    }
}

/** Coerce the bare `uiRteHistory` attribute (empty string) to `true`. */
function coerceEnabled(value: boolean | string | undefined): boolean {
    return value === '' || value === true || value === undefined;
}
