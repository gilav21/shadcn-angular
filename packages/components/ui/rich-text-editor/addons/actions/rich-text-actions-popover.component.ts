import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { RichTextActionTrigger } from './rich-text-actions.types';
import { RICH_TEXT_ACTIONS_LOCALES, type RichTextActionsLocale } from './rich-text-actions.locales';

/** One row in the edit popover describing an action on the focused element. */
export interface PopoverActionRow {
    trigger: RichTextActionTrigger;
    id: string;
    label: string;
    /** False when no registered definition matches the id (remove-only). */
    available: boolean;
}

/** Compact editor-side popover listing an element's actions with edit/remove/add. */
@Component({
    selector: 'ui-rich-text-actions-popover',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './rich-text-actions-popover.component.html',
    host: { '[attr.data-slot]': "'rich-text-actions-popover'" },
})
export class RichTextActionsPopoverComponent {
    readonly actions = input<PopoverActionRow[]>([]);
    readonly canAdd = input(true);
    readonly locale = input<RichTextActionsLocale>(RICH_TEXT_ACTIONS_LOCALES['en']);
    readonly dir = computed<'rtl' | null>(() => (this.locale().rtl ? 'rtl' : null));
    readonly edit = output<RichTextActionTrigger>();
    readonly remove = output<RichTextActionTrigger>();
    readonly add = output<void>();

    /** Localized display name for a trigger. */
    triggerLabel(trigger: RichTextActionTrigger): string {
        return this.locale().triggers[trigger];
    }
}
