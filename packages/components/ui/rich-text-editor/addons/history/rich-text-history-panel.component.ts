import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    computed,
    inject,
    input,
    output,
    signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RichTextEditorAddonHost } from '../..';
import { interpolate } from '../../../../lib/i18n';
import { ButtonComponent } from '../../../button';
import { PopoverComponent, PopoverTriggerComponent, PopoverContentComponent } from '../../../popover';
import {
    DialogComponent,
    DialogContentComponent,
    DialogHeaderComponent,
    DialogTitleComponent,
    DialogDescriptionComponent,
    DialogFooterComponent,
} from '../../../dialog';
import { ScrollAreaComponent } from '../../../scroll-area';
import { RICH_TEXT_HISTORY_LOCALES, type RichTextHistoryLocale } from './rich-text-history.locales';

type HistoryListType = 'popover' | 'dialog';

/**
 * The revision-history overlay: the corner "Revisions" button + popover panel,
 * the preview dialog, and the browser dialog. Created by
 * {@link RichTextHistoryDirective} into the editor's `overlayAnchor` and driven
 * entirely through the {@link RichTextEditorAddonHost}. Owns only the UI state
 * (open flags, selection, "Applied" marker); the history stack itself lives in
 * the base editor.
 */
@Component({
    selector: 'ui-rich-text-history-panel',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        DatePipe,
        ButtonComponent,
        PopoverComponent,
        PopoverTriggerComponent,
        PopoverContentComponent,
        DialogComponent,
        DialogContentComponent,
        DialogHeaderComponent,
        DialogTitleComponent,
        DialogDescriptionComponent,
        DialogFooterComponent,
        ScrollAreaComponent,
    ],
    templateUrl: './rich-text-history-panel.component.html',
    host: { class: 'contents' },
})
export class RichTextHistoryPanelComponent {
    private readonly host = inject(RichTextEditorAddonHost);
    private readonly el = inject(ElementRef);

    /** Localized strings for the panel UI. */
    readonly locale = input<RichTextHistoryLocale>(RICH_TEXT_HISTORY_LOCALES['en']);
    /** Whether the corner "Revisions" button/popover is shown. */
    readonly showButton = input(true);

    /** Emits the restored entry index after a revision is applied. */
    readonly restore = output<number>();

    protected readonly disabled = this.host.disabled;
    protected readonly readonly = this.host.readonly;

    protected readonly historyPanelOpen = signal(false);
    protected readonly historyPreviewOpen = signal(false);
    protected readonly historyBrowserOpen = signal(false);
    private readonly selectedHistoryIndex = signal<number | null>(null);
    protected readonly lastAppliedHistoryIndex = signal<number | null>(null);

    protected readonly historyTimelineEntries = computed(() => {
        const current = this.host.currentHistoryIndex();
        return this.host.historyEntries()
            .map((entry) => ({ ...entry, active: entry.index === current }))
            .reverse();
    });

    protected readonly historyCount = computed(() => this.host.historyEntries().length);

    protected readonly selectedHistoryEntry = computed(() => {
        this.host.historyVersion();
        const index = this.selectedHistoryIndex();
        if (index === null) {
            return null;
        }
        const reconstructed = this.host.reconstructHistoryEntry(index);
        const entry = this.host.historyEntries()[index];
        if (!reconstructed || !entry) {
            return null;
        }
        return {
            index,
            html: reconstructed.html,
            markdown: reconstructed.markdown,
            timestamp: entry.timestamp,
        };
    });

    protected interpolate(template: string, values: Record<string, string | number>): string {
        return interpolate(template, values);
    }

    protected onHistoryPanelOpenChange(nextOpen: boolean): void {
        if (!nextOpen && this.historyPreviewOpen()) {
            this.historyPanelOpen.set(true);
            return;
        }
        if (nextOpen && (this.disabled() || this.readonly())) {
            this.historyPanelOpen.set(false);
            return;
        }
        if (nextOpen) {
            this.host.flushPendingHistoryPush();
            this.focusFirstHistoryActionSoon('popover');
        }
        this.historyPanelOpen.set(nextOpen);
    }

    /** Open the history UI from the keyboard shortcut: popover when the button is visible, browser dialog otherwise. */
    openFromShortcut(): void {
        if (this.disabled() || this.readonly()) {
            return;
        }
        this.host.flushPendingHistoryPush();
        if (this.showButton()) {
            this.onHistoryPanelOpenChange(true);
            return;
        }
        this.historyBrowserOpen.set(true);
        this.focusFirstHistoryActionSoon('dialog');
    }

    protected openHistoryPreview(entryIndex: number, event?: Event): void {
        event?.stopPropagation();
        if (entryIndex < 0 || entryIndex >= this.historyCount()) {
            return;
        }
        this.selectedHistoryIndex.set(entryIndex);
        this.historyBrowserOpen.set(false);
        this.historyPreviewOpen.set(true);
    }

    protected onQuickApplyFromHistory(entryIndex: number, event: Event): void {
        const target = event.currentTarget as HTMLElement | null;
        const listType = target ? this.getHistoryListType(target) : null;
        this.applyHistoryEntry(entryIndex);
        if (listType) {
            this.focusHistoryEntrySoon(listType, entryIndex);
        }
    }

    protected onHistoryEntryKeydown(event: KeyboardEvent, entryIndex: number): void {
        const current = event.currentTarget as HTMLElement | null;
        if (!current) {
            return;
        }
        const listType = this.getHistoryListType(current);

        if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
            event.preventDefault();
            this.applyHistoryEntry(entryIndex);
            if (listType) {
                this.focusHistoryEntrySoon(listType, entryIndex);
            }
            return;
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            this.handleHistoryEscape(listType);
            return;
        }

        this.handleHistoryArrowKey(event, current);
    }

    private handleHistoryEscape(listType: HistoryListType | null): void {
        if (listType === 'popover') {
            this.historyPanelOpen.set(false);
        } else if (listType === 'dialog') {
            this.historyBrowserOpen.set(false);
        }
    }

    private handleHistoryArrowKey(event: KeyboardEvent, current: HTMLElement): void {
        const entries = this.getHistoryEntryElements(current);
        const currentIndex = entries.indexOf(current);
        if (currentIndex < 0) {
            return;
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            entries[Math.min(entries.length - 1, currentIndex + 1)]?.focus();
            return;
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault();
            entries[Math.max(0, currentIndex - 1)]?.focus();
            return;
        }

        if (event.key === 'Home') {
            event.preventDefault();
            entries[0]?.focus();
            return;
        }

        if (event.key === 'End') {
            event.preventDefault();
            entries.at(-1)?.focus();
        }
    }

    protected restoreFromHistoryPreview(): void {
        const index = this.selectedHistoryIndex();
        if (index === null) {
            return;
        }
        this.applyHistoryEntry(index);
        this.historyPreviewOpen.set(false);
    }

    protected closePanel(): void {
        this.historyPanelOpen.set(false);
    }

    protected closePreview(): void {
        this.historyPreviewOpen.set(false);
    }

    protected closeBrowser(): void {
        this.historyBrowserOpen.set(false);
    }

    private applyHistoryEntry(entryIndex: number): void {
        if (entryIndex < 0 || entryIndex >= this.historyCount()) {
            return;
        }
        this.host.restoreHistoryEntry(entryIndex);
        this.lastAppliedHistoryIndex.set(entryIndex);
        this.restore.emit(entryIndex);
    }

    private focusFirstHistoryActionSoon(preferredList: HistoryListType): void {
        const tryFocus = (attempt: number): void => {
            const root = this.el.nativeElement as HTMLElement;
            const selector = `[data-history-list="${preferredList}"] [data-history-entry-action="true"]`;
            const firstAction = root.querySelector<HTMLElement>(selector);
            if (firstAction) {
                firstAction.focus();
                return;
            }
            if (attempt < 4) {
                setTimeout(() => tryFocus(attempt + 1), 16);
            }
        };

        setTimeout(() => tryFocus(0), 24);
    }

    private getHistoryEntryElements(from: HTMLElement): HTMLElement[] {
        const listContainer = from.closest('[data-history-list]');
        if (!listContainer) {
            return [];
        }
        return Array.from(
            listContainer.querySelectorAll<HTMLElement>('[data-history-entry-action="true"]')
        );
    }

    private getHistoryListType(from: HTMLElement): HistoryListType | null {
        const listContainer = from.closest<HTMLElement>('[data-history-list]');
        const type = listContainer?.dataset['historyList'];
        if (type === 'popover' || type === 'dialog') {
            return type;
        }
        return null;
    }

    private focusHistoryEntrySoon(listType: HistoryListType, entryIndex: number): void {
        setTimeout(() => {
            const root = this.el.nativeElement as HTMLElement;
            const selector = `[data-history-list="${listType}"] [data-history-entry-index="${entryIndex}"]`;
            const target = root.querySelector<HTMLElement>(selector);
            target?.focus();
        }, 0);
    }
}
