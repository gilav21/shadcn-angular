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
    /** True when this row represents a combined action occupying both triggers. */
    combined?: boolean;
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
    /**
     * The rows to list, tracked by `trigger` — so at most one click row and one
     * hover row, or a single row for a combined action covering both. A row
     * with `available: false` (its definition is no longer registered) renders
     * an "unavailable" note and drops the Edit button, keeping Remove as the
     * only way out.
     */
    readonly actions = input<PopoverActionRow[]>([]);
    /**
     * Whether to offer the "add action" row. The addon passes `false` once both
     * triggers are taken, since there is nothing left to attach.
     */
    readonly canAdd = input(true);
    /**
     * Translation bundle for the row labels and buttons, and the source of the
     * `dir="rtl"` flip on the popover container. Defaults to English.
     */
    readonly locale = input<RichTextActionsLocale>(RICH_TEXT_ACTIONS_LOCALES['en']);
    readonly dir = computed<'rtl' | null>(() => (this.locale().rtl ? 'rtl' : null));
    /**
     * Edit the action on this trigger — the addon reopens the attach dialog
     * prefilled from the element. Only emitted for an `available` row, and for a
     * combined row it carries `'click'`, the trigger that row is keyed by.
     */
    readonly edit = output<RichTextActionTrigger>();
    /**
     * Detach this row's action. Emits the whole row, not just the trigger,
     * because the addon needs `combined` to know whether to strip both
     * attributes and `id` to look the definition's seed styles back up.
     */
    readonly remove = output<PopoverActionRow>();
    /**
     * Attach another action to the same element. Emitted only while
     * {@link canAdd}; the addon closes the popover and opens the attach dialog.
     */
    readonly add = output<void>();

    /** Localized display name for a trigger. */
    triggerLabel(trigger: RichTextActionTrigger): string {
        return this.locale().triggers[trigger];
    }

    /** Localized display name(s) for a row — both triggers when the row is combined. */
    rowTriggerLabel(row: PopoverActionRow): string {
        if (!row.combined) return this.triggerLabel(row.trigger);
        return `${this.triggerLabel('click')} / ${this.triggerLabel('hover')}`;
    }
}
