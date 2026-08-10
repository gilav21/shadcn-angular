import {
    Component,
    ChangeDetectionStrategy,
    computed,
    inject,
    signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { cn } from '../../../../lib/utils';
import { RichTextEditorAddonHost, RichTextToolbarViewContext } from '../..';
import {
    PopoverComponent,
    PopoverTriggerComponent,
    PopoverContentComponent,
} from '../../../popover';
import { ColorPickerComponent } from '../../../color-picker';
import { RICH_TEXT_COLOR_BUTTON_CONTEXT } from './rich-text-colors.context';

const FOREGROUND_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="4 2 16 16" fill="none" ' +
    'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="m6 16 6-12 6 12"/><path d="M8 12h8"/></svg>';

const BACKGROUND_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z"/><path d="m5 2 5 5"/>' +
    '<path d="M2 13h15"/><path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z"/></svg>';

/**
 * A colour toolbar button the colors addon contributes as a component slot: a
 * standard toolbar button anchoring a popover with an inline `ui-color-picker`.
 * Reads editor state through {@link RichTextEditorAddonHost} and its per-kind
 * config + apply callback through {@link RICH_TEXT_COLOR_BUTTON_CONTEXT}.
 */
@Component({
    selector: 'ui-rte-colors-button',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule,
        PopoverComponent,
        PopoverTriggerComponent,
        PopoverContentComponent,
        ColorPickerComponent,
    ],
    templateUrl: './rich-text-colors-button.component.html',
    /**
     * Interaction is listened for on the host rather than the popover's
     * container: the container is not a control, and giving it handlers would
     * demand focus semantics it should not have. The popover content lives
     * inside this component's template, so its events bubble here.
     */
    host: {
        'class': 'contents',
        '(pointerdown)': 'onUserInteract()',
        '(keydown)': 'onUserInteract()',
    },
})
export class RichTextColorsButtonComponent {
    private readonly host = inject(RichTextEditorAddonHost);
    private readonly domSanitizer = inject(DomSanitizer);
    private readonly toolbarView = inject(RichTextToolbarViewContext, { optional: true });
    protected readonly context = inject(RICH_TEXT_COLOR_BUTTON_CONTEXT);

    protected readonly open = signal(false);
    /**
     * Whether the user has actually touched the picker since it opened.
     *
     * The picker emits its seeded value as it initialises, which is not a pick —
     * applying it would colour the caret from merely opening the popover. A
     * timing window cannot separate the two reliably (the emission lands
     * whenever change detection runs the new content), but provenance can: a
     * real pick is always preceded by a pointer or key event inside the popover,
     * and a programmatic emission never is.
     */
    private userTouched = false;

    protected readonly icon: SafeHtml = this.domSanitizer.bypassSecurityTrustHtml(
        this.context.kind === 'foreground' ? FOREGROUND_ICON : BACKGROUND_ICON,
    );

    protected readonly interactionDisabled = computed(
        () => this.host.disabled() || this.host.readonly(),
    );

    /**
     * Background of the underline swatch: the colour in effect at the caret, or
     * `null` when there is none so {@link emptyIndicatorClass} shows through
     * (an inline style would otherwise win over the fallback class).
     */
    protected readonly indicatorColor = computed(() => this.context.activeColor() || null);

    /**
     * With no colour in effect the swatch falls back per kind: text defaults to
     * the editor's own foreground (what typing will actually produce), while a
     * highlight genuinely has none and reads as a muted "no colour" bar.
     */
    private readonly emptyIndicatorClass =
        this.context.kind === 'foreground' ? 'bg-foreground' : 'bg-muted-foreground/30';

    protected readonly indicatorClasses = computed(() => cn(
        'h-[3px] w-4 rounded-[1px] ring-1 ring-border',
        this.context.activeColor() ? '' : this.emptyIndicatorClass,
    ));

    protected readonly buttonClasses = computed(() => cn(
        'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        'disabled:pointer-events-none disabled:opacity-50',
        this.toolbarView?.compact() ? 'p-1' : 'p-1.5',
    ));

    /**
     * Track the popover's open state. `onClose` is notified only after
     * `open()` has already gone false, so the picker's teardown emissions are
     * ignored rather than mistaken for a user pick.
     */
    protected onOpenChange(next: boolean): void {
        if (next) {
            this.userTouched = false;
            this.context.onOpen();
        }
        this.open.set(next);
        if (!next) {
            this.context.onClose();
        }
    }

    /** Record that what follows came from the user, not from initialisation. */
    protected onUserInteract(): void {
        this.userTouched = true;
    }

    /**
     * Forward a picked colour to the addon. Gated on `open()` so emissions from a
     * closing picker are ignored, and on {@link userTouched} so the picker's
     * initialisation emission is not mistaken for a pick.
     */
    protected onColorChange(color: string): void {
        if (!this.open() || this.interactionDisabled() || !this.userTouched) return;
        this.context.onSelect(color);
    }
}
