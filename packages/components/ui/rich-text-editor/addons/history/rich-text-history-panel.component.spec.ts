import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { computed, signal, type Signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RichTextHistoryPanelComponent } from './rich-text-history-panel.component';
import { RICH_TEXT_HISTORY_LOCALES } from './rich-text-history.locales';
import { RichTextEditorAddonHost, RichTextHistoryEntrySnapshot } from '../..';

const LOCALE_EN = RICH_TEXT_HISTORY_LOCALES['en'];

// ── jsdom API stubs ────────────────────────────────────────────────────
class ResizeObserverStub {
    observe(): void { /* no-op */ }
    unobserve(): void { /* no-op */ }
    disconnect(): void { /* no-op */ }
}
type Globals = { ResizeObserver?: typeof ResizeObserver };
type PopoverProto = { showPopover?: () => void; hidePopover?: () => void; togglePopover?: () => void };
const proto = HTMLElement.prototype as unknown as PopoverProto;

/**
 * Whether THIS suite added the Popover API, decided at install time rather than
 * at module load. `HTMLElement.prototype` is shared with every other spec file
 * in the run, so a module-load reading can record "absent" while another suite
 * has it temporarily removed — and the teardown would then delete the native
 * implementation for everything that follows. Only remove what we added.
 */
let addedPopoverApi = false;
const originalResizeObserver = (globalThis as Globals).ResizeObserver;

beforeEach(() => {
    (globalThis as Globals).ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    addedPopoverApi = !('showPopover' in proto);
    proto.showPopover ??= (): void => { /* no-op */ };
    proto.hidePopover ??= (): void => { /* no-op */ };
    proto.togglePopover ??= (): void => { /* no-op */ };
});

afterEach(() => {
    if (originalResizeObserver) {
        (globalThis as Globals).ResizeObserver = originalResizeObserver;
    } else {
        delete (globalThis as Globals).ResizeObserver;
    }
    if (addedPopoverApi) {
        delete proto.showPopover;
        delete proto.hidePopover;
        delete proto.togglePopover;
        addedPopoverApi = false;
    }
});

// ── Mock host ──────────────────────────────────────────────────────────
function snapshot(index: number): RichTextHistoryEntrySnapshot {
    return {
        index,
        timestamp: 1_700_000_000_000 + index * 1000,
        preview: `entry ${index}`,
        previewLines: [`entry ${index}`],
        lineCount: 1,
    };
}

interface MockHost {
    disabled: ReturnType<typeof signal<boolean>>;
    isDisabled: Signal<boolean>;
    formDisabled: ReturnType<typeof signal<boolean>>;
    readonly: ReturnType<typeof signal<boolean>>;
    currentHistoryIndex: ReturnType<typeof signal<number>>;
    historyEntries: ReturnType<typeof signal<RichTextHistoryEntrySnapshot[]>>;
    historyVersion: ReturnType<typeof signal<number>>;
    reconstructHistoryEntry: ReturnType<typeof vi.fn>;
    flushPendingHistoryPush: ReturnType<typeof vi.fn>;
    restoreHistoryEntry: ReturnType<typeof vi.fn>;
}

/** Protected/private surface of the panel exercised by the tests. */
interface PanelInternals {
    historyTimelineEntries(): ReadonlyArray<RichTextHistoryEntrySnapshot & { active: boolean }>;
    selectedHistoryEntry(): { index: number; html: string; markdown: string; timestamp: number } | null;
    onHistoryPanelOpenChange(next: boolean): void;
    openHistoryPreview(index: number, event?: Event): void;
    onQuickApplyFromHistory(index: number, event: Event): void;
    onHistoryEntryKeydown(event: Partial<KeyboardEvent>, index: number): void;
    restoreFromHistoryPreview(): void;
    closePanel(): void;
    closePreview(): void;
    closeBrowser(): void;
    focusFirstHistoryActionSoon(list: 'popover' | 'dialog'): void;
    focusHistoryEntrySoon(list: 'popover' | 'dialog', index: number): void;
    historyPanelOpen: ReturnType<typeof signal<boolean>>;
    historyPreviewOpen: ReturnType<typeof signal<boolean>>;
    historyBrowserOpen: ReturnType<typeof signal<boolean>>;
    selectedHistoryIndex: ReturnType<typeof signal<number | null>>;
    lastAppliedHistoryIndex: ReturnType<typeof signal<number | null>>;
}

describe('RichTextHistoryPanelComponent', () => {
    let host: MockHost;
    let fixture: ComponentFixture<RichTextHistoryPanelComponent>;
    let panel: RichTextHistoryPanelComponent;
    let internals: PanelInternals;
    const detachedLists: HTMLElement[] = [];

    async function setup(): Promise<void> {
        // `isDisabled` is the effective state — the `[disabled]` input OR a form
        // having disabled the control — so raising the raw input must raise it
        // too. Two independent signals here would let the panel read the raw
        // input and still look correct; `formDisabled` is the form-only half.
        const inputDisabled = signal(false);
        const formDisabled = signal(false);
        host = {
            disabled: inputDisabled,
            isDisabled: computed(() => inputDisabled() || formDisabled()),
            formDisabled,
            readonly: signal(false),
            currentHistoryIndex: signal(1),
            historyEntries: signal([snapshot(0), snapshot(1), snapshot(2)]),
            historyVersion: signal(0),
            reconstructHistoryEntry: vi.fn((index: number) =>
                index === 0 ? { html: '<p>alpha</p>', markdown: 'alpha' } : null),
            flushPendingHistoryPush: vi.fn(),
            restoreHistoryEntry: vi.fn(),
        };
        await TestBed.configureTestingModule({
            imports: [RichTextHistoryPanelComponent],
            providers: [{ provide: RichTextEditorAddonHost, useValue: host }],
        }).compileComponents();
        fixture = TestBed.createComponent(RichTextHistoryPanelComponent);
        fixture.componentRef.setInput('locale', LOCALE_EN);
        panel = fixture.componentInstance;
        internals = panel as unknown as PanelInternals;
        fixture.detectChanges();
    }

    /** A detached history row inside a `[data-history-list]` container of the given type. */
    function makeRow(listType: 'popover' | 'dialog', index: number): HTMLElement {
        const list = document.createElement('div');
        list.dataset['historyList'] = listType;
        const row = document.createElement('div');
        row.dataset['historyEntryAction'] = 'true';
        row.dataset['historyEntryIndex'] = String(index);
        row.tabIndex = 0;
        list.appendChild(row);
        document.body.appendChild(list);
        detachedLists.push(list);
        return row;
    }

    beforeEach(async () => {
        await setup();
    });

    afterEach(() => {
        while (detachedLists.length > 0) detachedLists.pop()!.remove();
        fixture.destroy();
    });

    it('labels the corner button with the live history count', () => {
        const button = (fixture.nativeElement as HTMLElement).querySelector('ui-button');
        expect(button?.textContent?.trim()).toBe('History (3)');

        host.historyEntries.set([snapshot(0), snapshot(1), snapshot(2), snapshot(3)]);
        fixture.detectChanges();
        expect(button?.textContent?.trim()).toBe('History (4)');
    });

    it('reverses the timeline and marks the active entry', () => {
        const entries = internals.historyTimelineEntries();
        expect(entries).toHaveLength(3);
        expect(entries[0].index).toBe(2);
        expect(entries.find((e) => e.index === 1)?.active).toBe(true);
    });

    describe('rendered preview', () => {
        it('keeps inline colour that Angular would otherwise strip', () => {
            // The preview bound the raw HTML string, so Angular's default
            // sanitizer removed every style attribute and a revision containing
            // coloured or highlighted text previewed as plain black — the panel
            // showed the user something the revision never was.
            const styled = '<span style="color: rgb(255, 0, 0)">red</span>';

            const out = String(
                (internals as unknown as { previewHtml(html: string): unknown }).previewHtml(styled),
            );

            expect(out).toContain('color');
            expect(out).toContain('red');
        });

        it('still drops what the editor itself would never allow', () => {
            const hostile = '<span style="color: red">ok</span>' + '<scr' + 'ipt>alert(1)</scr' + 'ipt>';

            const out = String(
                (internals as unknown as { previewHtml(html: string): unknown }).previewHtml(hostile),
            );

            expect(out).not.toContain('<script');
            expect(out).toContain('ok');
        });
    });

    describe('selectedHistoryEntry', () => {
        it('returns the reconstructed entry for a valid selection', () => {
            internals.openHistoryPreview(0);
            const selected = internals.selectedHistoryEntry();
            expect(selected?.html).toContain('alpha');
            expect(selected?.markdown).toBe('alpha');
            expect(selected?.index).toBe(0);
        });

        it('is null when the entry cannot be reconstructed', () => {
            internals.openHistoryPreview(2);
            expect(internals.selectedHistoryEntry()).toBeNull();
        });
    });

    describe('onHistoryPanelOpenChange', () => {
        it('re-opens the panel when a close arrives while the preview is open', () => {
            internals.historyPreviewOpen.set(true);
            internals.onHistoryPanelOpenChange(false);
            expect(internals.historyPanelOpen()).toBe(true);
        });

        it('refuses to open while disabled by the [disabled] input', () => {
            host.disabled.set(true);
            internals.onHistoryPanelOpenChange(true);
            expect(internals.historyPanelOpen()).toBe(false);
        });

        // The panel must read the editor's EFFECTIVE disabled state, not the raw
        // [disabled] input: a reactive form's control.disable() reaches the host
        // through setDisabledState and never touches that input, so a panel
        // reading the input alone stays live under control.disable().
        it('refuses to open while a reactive form has disabled the control', () => {
            host.formDisabled.set(true);
            expect(host.disabled()).toBe(false);

            internals.onHistoryPanelOpenChange(true);
            expect(internals.historyPanelOpen()).toBe(false);
        });

        it('refuses the keyboard shortcut while a reactive form has disabled the control', () => {
            host.formDisabled.set(true);
            panel.openFromShortcut();
            expect(internals.historyPanelOpen()).toBe(false);
            expect(host.flushPendingHistoryPush).not.toHaveBeenCalled();
        });

        it('flushes pending history and opens', () => {
            internals.onHistoryPanelOpenChange(true);
            expect(host.flushPendingHistoryPush).toHaveBeenCalled();
            expect(internals.historyPanelOpen()).toBe(true);
        });

        it('closes when asked to close with no preview open', () => {
            internals.historyPanelOpen.set(true);
            internals.onHistoryPanelOpenChange(false);
            expect(internals.historyPanelOpen()).toBe(false);
        });
    });

    describe('openFromShortcut', () => {
        it('does nothing while readonly', () => {
            host.readonly.set(true);
            panel.openFromShortcut();
            expect(internals.historyPanelOpen()).toBe(false);
            expect(internals.historyBrowserOpen()).toBe(false);
        });

        it('opens the popover when the button is visible', () => {
            panel.openFromShortcut();
            expect(internals.historyPanelOpen()).toBe(true);
        });

        it('opens the browser dialog when the button is hidden', () => {
            fixture.componentRef.setInput('showButton', false);
            fixture.detectChanges();
            panel.openFromShortcut();
            expect(internals.historyBrowserOpen()).toBe(true);
        });
    });

    describe('openHistoryPreview', () => {
        it('ignores an out-of-range index', () => {
            internals.openHistoryPreview(9);
            expect(internals.historyPreviewOpen()).toBe(false);
        });

        it('opens the preview and stops event propagation', () => {
            const stopPropagation = vi.fn();
            internals.openHistoryPreview(0, { stopPropagation } as unknown as Event);
            expect(stopPropagation).toHaveBeenCalled();
            expect(internals.historyPreviewOpen()).toBe(true);
            expect(internals.historyBrowserOpen()).toBe(false);
        });
    });

    describe('onQuickApplyFromHistory', () => {
        it('applies the entry and returns focus to that row in the list it was clicked in', async () => {
            const root = fixture.nativeElement as HTMLElement;
            const rowIn = (list: 'popover' | 'dialog'): HTMLElement => {
                const container = document.createElement('div');
                container.dataset['historyList'] = list;
                const row = document.createElement('div');
                row.dataset['historyEntryAction'] = 'true';
                row.dataset['historyEntryIndex'] = '1';
                row.tabIndex = 0;
                container.appendChild(row);
                root.appendChild(container);
                return row;
            };
            const dialogRow = rowIn('dialog');
            const popoverRow = rowIn('popover');

            internals.onQuickApplyFromHistory(1, { currentTarget: popoverRow } as unknown as Event);
            await new Promise((r) => setTimeout(r, 0));

            expect(host.restoreHistoryEntry).toHaveBeenCalledWith(1);
            expect(document.activeElement).toBe(popoverRow);
            expect(document.activeElement).not.toBe(dialogRow);
        });

        it('applies even when the event has no current target', () => {
            internals.onQuickApplyFromHistory(1, { currentTarget: null } as unknown as Event);
            expect(host.restoreHistoryEntry).toHaveBeenCalledWith(1);
        });
    });

    describe('onHistoryEntryKeydown', () => {
        it('returns early when there is no current target', () => {
            internals.onHistoryEntryKeydown({ key: 'Enter', currentTarget: null }, 1);
            expect(host.restoreHistoryEntry).not.toHaveBeenCalled();
        });

        it.each(['Enter', ' ', 'Spacebar'])('applies the entry on %s', (key) => {
            const row = makeRow('dialog', 1);
            const preventDefault = vi.fn();
            internals.onHistoryEntryKeydown({ key, currentTarget: row, preventDefault }, 1);
            expect(preventDefault).toHaveBeenCalled();
            expect(host.restoreHistoryEntry).toHaveBeenCalledWith(1);
        });

        it('closes the popover on Escape from a popover row', () => {
            const row = makeRow('popover', 0);
            internals.historyPanelOpen.set(true);
            internals.onHistoryEntryKeydown({ key: 'Escape', currentTarget: row, preventDefault: vi.fn() }, 0);
            expect(internals.historyPanelOpen()).toBe(false);
        });

        it('closes the browser dialog on Escape from a dialog row', () => {
            const row = makeRow('dialog', 0);
            internals.historyBrowserOpen.set(true);
            internals.onHistoryEntryKeydown({ key: 'Escape', currentTarget: row, preventDefault: vi.fn() }, 0);
            expect(internals.historyBrowserOpen()).toBe(false);
        });

        it('leaves state unchanged on Escape from a row with no list type', () => {
            const orphan = document.createElement('div');
            orphan.tabIndex = 0;
            internals.historyPanelOpen.set(true);
            internals.onHistoryEntryKeydown({ key: 'Escape', currentTarget: orphan, preventDefault: vi.fn() }, 0);
            expect(internals.historyPanelOpen()).toBe(true);
        });
    });

    describe('arrow navigation', () => {
        function threeRows(): HTMLElement[] {
            const list = document.createElement('div');
            list.dataset['historyList'] = 'dialog';
            const rows = [0, 1, 2].map((i) => {
                const row = document.createElement('div');
                row.dataset['historyEntryAction'] = 'true';
                row.dataset['historyEntryIndex'] = String(i);
                row.tabIndex = 0;
                list.appendChild(row);
                return row;
            });
            document.body.appendChild(list);
            detachedLists.push(list);
            return rows;
        }

        it('moves focus with ArrowDown, ArrowUp, Home and End', () => {
            const rows = threeRows();
            rows[0].focus();
            internals.onHistoryEntryKeydown({ key: 'ArrowDown', currentTarget: rows[0], preventDefault: vi.fn() }, 0);
            expect(document.activeElement).toBe(rows[1]);
            internals.onHistoryEntryKeydown({ key: 'End', currentTarget: rows[1], preventDefault: vi.fn() }, 1);
            expect(document.activeElement).toBe(rows[2]);
            internals.onHistoryEntryKeydown({ key: 'ArrowUp', currentTarget: rows[2], preventDefault: vi.fn() }, 2);
            expect(document.activeElement).toBe(rows[1]);
            internals.onHistoryEntryKeydown({ key: 'Home', currentTarget: rows[1], preventDefault: vi.fn() }, 1);
            expect(document.activeElement).toBe(rows[0]);
        });

        it('ignores an unmapped key', () => {
            const rows = threeRows();
            rows[0].focus();
            internals.onHistoryEntryKeydown({ key: 'Tab', currentTarget: rows[0], preventDefault: vi.fn() }, 0);
            expect(document.activeElement).toBe(rows[0]);
        });

        it('does nothing when the row is not inside a list container', () => {
            const orphan = document.createElement('div');
            orphan.tabIndex = 0;
            document.body.appendChild(orphan);
            orphan.focus();
            internals.onHistoryEntryKeydown({ key: 'ArrowDown', currentTarget: orphan, preventDefault: vi.fn() }, 0);
            expect(document.activeElement).toBe(orphan);
            orphan.remove();
        });
    });

    describe('restoreFromHistoryPreview', () => {
        it('does nothing when no entry is selected', () => {
            internals.restoreFromHistoryPreview();
            expect(host.restoreHistoryEntry).not.toHaveBeenCalled();
        });

        it('applies the selected entry and closes the preview', () => {
            internals.openHistoryPreview(0);
            internals.restoreFromHistoryPreview();
            expect(host.restoreHistoryEntry).toHaveBeenCalledWith(0);
            expect(internals.historyPreviewOpen()).toBe(false);
        });
    });

    describe('close helpers', () => {
        it('closes the panel, preview, and browser', () => {
            internals.historyPanelOpen.set(true);
            internals.historyPreviewOpen.set(true);
            internals.historyBrowserOpen.set(true);
            internals.closePanel();
            internals.closePreview();
            internals.closeBrowser();
            expect(internals.historyPanelOpen()).toBe(false);
            expect(internals.historyPreviewOpen()).toBe(false);
            expect(internals.historyBrowserOpen()).toBe(false);
        });
    });

    describe('applyHistoryEntry range guard', () => {
        it('ignores an out-of-range quick apply', () => {
            internals.onQuickApplyFromHistory(99, { currentTarget: null } as unknown as Event);
            expect(host.restoreHistoryEntry).not.toHaveBeenCalled();
        });
    });

    describe('focus timers', () => {
        beforeEach(() => { vi.useFakeTimers(); });
        afterEach(() => { vi.useRealTimers(); });

        function seedActionInPanel(list: 'popover' | 'dialog', index: number): HTMLElement {
            const el = fixture.nativeElement as HTMLElement;
            const container = document.createElement('div');
            container.dataset['historyList'] = list;
            const action = document.createElement('button');
            action.dataset['historyEntryAction'] = 'true';
            action.dataset['historyEntryIndex'] = String(index);
            container.appendChild(action);
            el.appendChild(container);
            return action;
        }

        it('focuses the first action once it appears', () => {
            const action = seedActionInPanel('popover', 0);
            const focusSpy = vi.spyOn(action, 'focus');
            internals.focusFirstHistoryActionSoon('popover');
            vi.advanceTimersByTime(24);
            expect(focusSpy).toHaveBeenCalled();
        });

        it('retries until the first action appears, and gives up after the fifth attempt', () => {
            // Attempts run at 24ms, then every 16ms: 24, 40, 56, 72, 88.
            internals.focusFirstHistoryActionSoon('dialog');
            vi.advanceTimersByTime(72);
            const late = seedActionInPanel('dialog', 0);
            vi.advanceTimersByTime(16);
            expect(document.activeElement).toBe(late);

            late.blur();
            late.parentElement!.remove();
            internals.focusFirstHistoryActionSoon('dialog');
            vi.advanceTimersByTime(88);
            const tooLate = seedActionInPanel('dialog', 0);
            vi.advanceTimersByTime(1000);
            expect(document.activeElement).not.toBe(tooLate);
        });

        it('focuses a specific entry by index', () => {
            const action = seedActionInPanel('dialog', 2);
            const focusSpy = vi.spyOn(action, 'focus');
            internals.focusHistoryEntrySoon('dialog', 2);
            vi.advanceTimersByTime(1);
            expect(focusSpy).toHaveBeenCalled();
        });
    });
});
