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
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M4 20h16"/><path d="m6 16 6-12 6 12"/><path d="M8 12h8"/></svg>';

const BACKGROUND_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
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
    host: { class: 'contents' },
})
export class RichTextColorsButtonComponent {
    private readonly host = inject(RichTextEditorAddonHost);
    private readonly domSanitizer = inject(DomSanitizer);
    private readonly toolbarView = inject(RichTextToolbarViewContext, { optional: true });
    protected readonly context = inject(RICH_TEXT_COLOR_BUTTON_CONTEXT);

    protected readonly open = signal(false);

    protected readonly icon: SafeHtml = this.domSanitizer.bypassSecurityTrustHtml(
        this.context.kind === 'foreground' ? FOREGROUND_ICON : BACKGROUND_ICON,
    );

    protected readonly interactionDisabled = computed(
        () => this.host.disabled() || this.host.readonly(),
    );

    protected readonly buttonClasses = computed(() => cn(
        'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        'disabled:pointer-events-none disabled:opacity-50',
        this.toolbarView?.compact() ? 'p-1' : 'p-1.5',
    ));

    protected onOpenChange(next: boolean): void {
        if (next) {
            this.context.onOpen();
        }
        this.open.set(next);
    }

    /**
     * Forward a picked colour to the addon. Gated on `open()` because the inline
     * picker emits a `colorChange` on init (and when re-seeded) that must not
     * reach the editor while the popover is closed.
     */
    protected onColorChange(color: string): void {
        if (!this.open() || this.interactionDisabled()) return;
        this.context.onSelect(color);
    }
}
