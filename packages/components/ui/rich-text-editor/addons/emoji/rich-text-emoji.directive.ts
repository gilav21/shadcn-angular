import {
    Directive,
    Injector,
    computed,
    effect,
    inject,
    input,
    output,
} from '@angular/core';
import { RichTextEditorAddonHost } from '../..';
import { createLocaleBindings, type LocaleInput } from '../../../../lib/i18n';
import { RichTextEmojiButtonComponent } from './rich-text-emoji-button.component';
import {
    RICH_TEXT_EMOJI_CONTEXT,
    type RichTextEmojiContext,
} from './rich-text-emoji.context';
import {
    RICH_TEXT_EMOJI_LOCALES,
    type RichTextEmojiLocale,
} from './rich-text-emoji.locales';

const EMOJI_SLOT_ID = 'emoji.insert';

/**
 * Opt-in emoji addon for `<ui-rich-text-editor>`. Attaches via DI to the
 * `RichTextEditorAddonHost` the base provides and contributes the emoji
 * picker toolbar button as a component slot. The base editor ships no emoji
 * code and no `emoji-picker` dependency.
 *
 * Unlike the former built-in `'emoji'` toolbar item, the picker manages its
 * own open state (outside-click / scroll dismissal) instead of joining the
 * toolbar's single-open-popover coordination, the button renders after the
 * built-in items, and — like every addon slot — it also appears in the
 * floating/bubble toolbar (compact-sized via `RichTextToolbarViewContext`).
 * The tooltip locale resolves from `[uiRteEmojiLocale]` or the app-wide
 * `UI_LOCALE_ID` token — it does not track the editor's own `[locale]`
 * input. Changing `[uiRteEmojiOrder]` re-registers the slot, which remounts
 * the button (an open picker closes) — set it once, not reactively.
 *
 * ```html
 * <ui-rich-text-editor uiRteEmoji />
 * ```
 */
@Directive({
    selector: 'ui-rich-text-editor[uiRteEmoji]',
    standalone: true,
})
export class RichTextEmojiDirective {
    private readonly host = inject(RichTextEditorAddonHost);
    private readonly injector = inject(Injector);

    /** Locale for the addon UI: a registry key (`'en'`/`'he'`/…) or a full dictionary. */
    readonly uiRteEmojiLocale = input<LocaleInput<RichTextEmojiLocale>>();
    /** Sort order of the emoji button among addon toolbar slots; lower first. */
    readonly uiRteEmojiOrder = input(400);

    /** Emits the picked emoji after it has been inserted into the content. */
    readonly emojiInsert = output<string>();

    private readonly i18n = createLocaleBindings(this.uiRteEmojiLocale, RICH_TEXT_EMOJI_LOCALES);

    constructor() {
        const context: RichTextEmojiContext = {
            tooltip: computed(() => this.i18n.t().insertEmoji),
            onInsert: (emoji) => {
                this.host.insertTextFromOverlay(emoji);
                this.emojiInsert.emit(emoji);
            },
        };
        const slotInjector = Injector.create({
            providers: [{ provide: RICH_TEXT_EMOJI_CONTEXT, useValue: context }],
            parent: this.injector,
        });
        effect((onCleanup) => {
            onCleanup(this.host.toolbarSlots.register({
                id: EMOJI_SLOT_ID,
                order: this.uiRteEmojiOrder(),
                component: RichTextEmojiButtonComponent,
                injector: slotInjector,
            }));
        });
    }
}
