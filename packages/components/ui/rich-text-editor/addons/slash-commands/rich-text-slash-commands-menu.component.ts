import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    computed,
    effect,
    input,
    output,
    viewChild,
} from '@angular/core';
import type { RichTextSlashCommand } from '../..';

/**
 * The slash-command menu overlay. Rendered by
 * {@link RichTextSlashCommandsDirective} through a `ViewContainerRef` and
 * positioned at the caret; owns only its markup, hover/select events, and
 * keeping the active option scrolled into view. All filtering, keyboard
 * navigation and execution live in the directive.
 */
@Component({
    selector: 'ui-rich-text-slash-commands-menu',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './rich-text-slash-commands-menu.component.html',
    host: {
        role: 'listbox',
        '[attr.aria-label]': 'menuAriaLabel()',
        '[attr.data-slot]': "'rich-text-slash-commands-menu'",
        class: 'block w-72 max-w-[calc(100vw-2rem)] rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95',
    },
})
export class RichTextSlashCommandsMenuComponent {
    /** The commands to render, already filtered and ordered by the directive. */
    readonly commands = input<RichTextSlashCommand[]>([]);
    /** Index of the highlighted command. */
    readonly selectedIndex = input(0);
    /** Message shown when {@link commands} is empty. */
    readonly noResultsLabel = input('');
    /** aria-label for the listbox host. */
    readonly menuAriaLabel = input('');

    /** Emits the command the user activated (click). */
    readonly commandSelect = output<RichTextSlashCommand>();
    /** Emits the index the pointer moved onto. */
    readonly hoverIndex = output<number>();

    private readonly list = viewChild<ElementRef<HTMLDivElement>>('list');
    private readonly activeIndex = computed(() => this.selectedIndex());

    constructor() {
        effect(() => {
            this.commands();
            const index = this.activeIndex();
            queueMicrotask(() => this.scrollIntoView(index));
        });
    }

    /** Keep focus in the editor: activating a menu item must not blur it. */
    protected onPointerDown(event: Event): void {
        event.preventDefault();
    }

    private scrollIntoView(index: number): void {
        const list = this.list()?.nativeElement;
        if (!list) {
            return;
        }
        const selected = list.querySelector<HTMLElement>(`[data-slash-index="${index}"]`);
        if (!selected) {
            return;
        }
        const listTop = list.scrollTop;
        const listBottom = listTop + list.clientHeight;
        const itemTop = selected.offsetTop;
        const itemBottom = itemTop + selected.offsetHeight;
        if (itemTop < listTop || itemBottom > listBottom) {
            selected.scrollIntoView({ block: 'nearest' });
        }
    }
}
