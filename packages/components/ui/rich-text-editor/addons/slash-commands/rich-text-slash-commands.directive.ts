import {
    ComponentRef,
    DestroyRef,
    Directive,
    ViewContainerRef,
    computed,
    effect,
    inject,
    input,
} from '@angular/core';
import {
    RichTextEditorAddonHost,
    type RichTextSlashCommand,
    type RichTextSlashCommandAvailabilityContext,
    type RichTextSlashCommandContext,
} from '../..';
import { createLocaleBindings, type LocaleInput } from '../../../../lib/i18n';
import { RichTextSlashCommandsMenuComponent } from './rich-text-slash-commands-menu.component';
import { buildDefaultSlashCommands } from './rich-text-slash-commands.defaults';
import {
    RICH_TEXT_SLASH_COMMANDS_LOCALES,
    type RichTextSlashCommandsLocale,
} from './rich-text-slash-commands.locales';
import {
    captureSlashTriggerRange,
    getClosestEditableBlockForSlashCommand,
    getClosestEditableBlockFromSelection,
    isSelectionInsideEditor,
    matchSlashTriggerAtCaret,
    matchSlashTriggerInText,
    matchSlashTriggerWithinCurrentBlock,
    placeCaretAtEndOfBlock,
    removeCaretSentinelAtSelection,
    removeSlashTriggerText,
} from './rich-text-slash-commands.utils';

const SLASH_MENU_KEYS = new Set(['ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'Tab', ' ', 'Spacebar']);
const MAX_SLASH_COMMANDS = 10;
const MENU_CARET_GAP = 4;
/**
 * Approximate menu box size (component `w-72` = 288px; `max-h-56` = 224px plus
 * padding/border) used only to clamp/flip the fixed position within the viewport.
 */
const MENU_WIDTH = 288;
const MENU_MAX_HEIGHT = 240;

/**
 * Opt-in slash-command menu for `<ui-rich-text-editor>`. Attaches via DI to the
 * `RichTextEditorAddonHost` the base provides. Typing `/` opens a filterable
 * command menu at the caret; the base editor ships no slash-command code.
 *
 * The menu merges, in precedence order: this addon's built-in commands (built
 * from `[uiRteSlashCommandsLocale]`), the host's base-owned `builtinCommands`
 * (currently empty — kept as a seam for future base commands), any feature
 * commands other addons register (e.g. the `/outline`, `/ai`, and `/link`
 * commands), any commands registered programmatically through the shared
 * command registry, and the custom commands passed to `[uiRteSlashCommands]`.
 *
 * ```html
 * <ui-rich-text-editor uiRteSlashCommands />
 * <ui-rich-text-editor [uiRteSlashCommands]="myCommands" />
 * ```
 *
 * Unlike the former built-in feature, selecting an `@mention` no longer force-
 * closes an open slash menu: the two triggers are mutually exclusive (a slash
 * menu is only open right after a `/`, never during mention insertion), so the
 * coordination is unnecessary. The menu instead dismisses on the next input
 * that no longer matches a trigger, on outside pointer-down, and on scroll.
 */
@Directive({
    selector: 'ui-rich-text-editor[uiRteSlashCommands], ui-rich-text-editor[uiRteFull]',
    standalone: true,
})
export class RichTextSlashCommandsDirective {
    private readonly host = inject(RichTextEditorAddonHost);
    private readonly vcr = inject(ViewContainerRef);

    /**
     * Custom slash commands merged in after the built-ins, OR a boolean enable
     * flag. Four accepted shapes, matching the uniform addon enable-flag pattern:
     *
     * - bare attribute (`uiRteSlashCommands`, transforms `''`) — enabled, no custom commands.
     * - `[uiRteSlashCommands]="cmds"` — enabled, plus the custom commands.
     * - `[uiRteSlashCommands]="true"` — enabled, no custom commands (explicit form).
     * - `[uiRteSlashCommands]="false"` — disabled (the whole menu is removed live).
     *
     * The value is normalized to `{ enabled, commands }`; read {@link slashEnabled}
     * and {@link customCommands} rather than the raw input.
     */
    readonly uiRteSlashCommands = input<NormalizedSlashCommands, RichTextSlashCommand[] | '' | boolean>(
        { enabled: true, commands: [] },
        { transform: normalizeSlashCommands },
    );
    /** Locale for the menu UI: a registry key (`'en'`/`'he'`/…) or a full dictionary. */
    readonly uiRteSlashCommandsLocale = input<LocaleInput<RichTextSlashCommandsLocale>>();

    private readonly i18n = createLocaleBindings(this.uiRteSlashCommandsLocale, RICH_TEXT_SLASH_COMMANDS_LOCALES);
    private readonly defaultCommands = computed(() => buildDefaultSlashCommands(this.i18n.t()));
    /** Whether the addon is enabled (`false` only when explicitly bound to `false`). */
    private readonly slashEnabled = computed(() => this.uiRteSlashCommands().enabled);
    /** The custom commands to merge in (empty when disabled or none provided). */
    private readonly customCommands = computed<RichTextSlashCommand[]>(() => this.uiRteSlashCommands().commands);

    private open = false;
    private query = '';
    private selectedIndex = 0;
    private anchorBlock: HTMLElement | null = null;
    private triggerRange: Range | null = null;
    private position = { x: 0, y: 0 };

    private menuRef?: ComponentRef<RichTextSlashCommandsMenuComponent>;
    private readonly outsidePointerBound = (event: Event): void => this.onOutsidePointer(event);
    private readonly dismissBound = (event: Event): void => this.onScrollDismiss(event);

    /**
     * Wires the host seams and an effect that re-filters the live menu when the
     * command registry, locale, or custom input changes while it is open.
     * Typing and keyboard navigation refresh the menu imperatively; the effect
     * covers only reactive, signal-driven changes.
     */
    constructor() {
        const offKeydown = this.host.registerKeydownInterceptor((event) => this.handleKeydown(event));
        const offInput = this.host.registerInputObserver((text, caret) => this.onInputObserved(text, caret));
        effect(() => {
            if (!this.slashEnabled()) {
                this.close();
                return;
            }
            const commands = this.computeFilteredCommands();
            if (this.open) {
                this.applyMenuInputs(commands);
            }
        });
        inject(DestroyRef).onDestroy(() => {
            offKeydown();
            offInput();
            this.close();
        });
    }

    private get doc(): Document {
        return this.host.contentRoot.ownerDocument;
    }


    private onInputObserved(text: string, caret: number): void {
        if (!this.slashEnabled() || this.host.disabled() || this.host.readonly()) {
            this.close();
            return;
        }
        const root = this.host.contentRoot;
        const match = matchSlashTriggerInText(text, caret)
            ?? matchSlashTriggerAtCaret(this.doc)
            ?? matchSlashTriggerWithinCurrentBlock(this.doc, root);
        if (!match) {
            this.close();
            return;
        }
        this.triggerRange = captureSlashTriggerRange(this.doc, root);
        this.anchorBlock = getClosestEditableBlockFromSelection(this.doc, root);
        this.query = match[1];
        this.selectedIndex = 0;
        this.updatePosition();
        this.open = true;
        this.applyMenuInputs(this.computeFilteredCommands());
    }


    private computeFilteredCommands(): RichTextSlashCommand[] {
        const availability: RichTextSlashCommandAvailabilityContext = {
            query: this.query,
            disabled: this.host.disabled(),
            readonly: this.host.readonly(),
            hasSelection: this.host.selection().text.length > 0,
        };
        const merged = new Map<string, RichTextSlashCommand>();
        for (const command of this.defaultCommands()) {
            merged.set(command.id, command);
        }
        for (const command of this.host.builtinCommands()) {
            merged.set(command.id, command);
        }
        for (const command of this.host.globalCommands.listCommands()) {
            merged.set(command.id, command);
        }
        for (const command of this.host.commands.listCommands()) {
            merged.set(command.id, command);
        }
        for (const command of this.customCommands()) {
            merged.set(command.id, command);
        }
        const needle = this.query.trim().toLowerCase();
        return Array.from(merged.values())
            .filter(command => !command.when || command.when(availability))
            .filter(command => matchesSlashQuery(command, needle))
            .sort(compareSlashCommands)
            .slice(0, MAX_SLASH_COMMANDS);
    }


    private handleKeydown(event: KeyboardEvent): boolean {
        if (!this.open || !SLASH_MENU_KEYS.has(event.key)) {
            return false;
        }
        event.preventDefault();
        this.onMenuKeydown(event);
        return true;
    }

    private onMenuKeydown(event: KeyboardEvent): void {
        const commands = this.computeFilteredCommands();
        if (commands.length === 0) {
            if (event.key === 'Escape' || event.key === 'Tab') {
                this.close();
            }
            return;
        }
        if (event.key === 'ArrowDown') {
            this.setSelectedIndex(Math.min(this.selectedIndex + 1, commands.length - 1));
            return;
        }
        if (event.key === 'ArrowUp') {
            this.setSelectedIndex(Math.max(this.selectedIndex - 1, 0));
            return;
        }
        if (event.key === 'Escape' || event.key === 'Tab') {
            this.close();
            return;
        }
        void this.select(commands[this.selectedIndex]);
    }

    private setSelectedIndex(index: number): void {
        this.selectedIndex = index;
        this.applyMenuInputs(this.computeFilteredCommands());
    }


    /**
     * Run the chosen command. The trigger-removal DOM edits are committed to the
     * model first — snapshotting them as a discrete history entry — so the
     * command's own mutation lands as a separate, independently undoable step.
     */
    private async select(command: RichTextSlashCommand | undefined): Promise<void> {
        if (!command || this.host.disabled() || this.host.readonly()) {
            return;
        }
        const root = this.host.contentRoot;
        const linkHint = captureCaretHint(this.doc);
        const query = this.query;
        const resolvedBlock = removeSlashTriggerText(this.doc, root, query, this.triggerRange, this.anchorBlock);
        const slashBlock = resolvedBlock
            ?? getClosestEditableBlockForSlashCommand(this.doc, root, this.anchorBlock, this.triggerRange);
        if (resolvedBlock) {
            this.anchorBlock = resolvedBlock;
        }
        if (slashBlock) {
            placeCaretAtEndOfBlock(this.doc, slashBlock);
            removeCaretSentinelAtSelection(this.doc);
        }
        this.host.commitContent();
        this.close();
        await Promise.resolve(command.run(this.buildContext(query, slashBlock, linkHint)));
        if (!isSelectionInsideEditor(this.doc, root)) {
            this.focusEditor();
        }
    }

    private buildContext(
        query: string, slashBlock: HTMLElement | null, linkHint: { x: number; y: number } | null,
    ): RichTextSlashCommandContext {
        return {
            query,
            selectedText: this.host.selection().text,
            executeToolbarCommand: (command) => this.host.executeToolbarCommandOnBlock(command, slashBlock),
            insertText: (text) => this.host.insertTextAtCaret(text),
            insertHtml: (html) => this.host.insertHtmlAtCaret(html),
            showLinkDialog: () => this.host.showLinkDialog(linkHint ?? undefined),
            focusEditor: () => this.focusEditor(),
        };
    }


    /**
     * Push the filtered command list onto the live menu. The highlighted index
     * is clamped first: re-filtering (registry, locale or custom-input changes)
     * can shrink the list below it, and Enter must always have a target.
     */
    private applyMenuInputs(commands: RichTextSlashCommand[]): void {
        this.selectedIndex = commands.length === 0 ? 0 : Math.min(this.selectedIndex, commands.length - 1);
        const menu = this.menuRef ?? this.createMenu();
        const locale = this.i18n.t();
        menu.setInput('commands', commands);
        menu.setInput('selectedIndex', this.selectedIndex);
        menu.setInput('noResultsLabel', locale.noResults);
        menu.setInput('menuAriaLabel', locale.menuAriaLabel);
        this.positionMenu(menu);
    }

    private createMenu(): ComponentRef<RichTextSlashCommandsMenuComponent> {
        const ref = this.vcr.createComponent(RichTextSlashCommandsMenuComponent);
        ref.instance.commandSelect.subscribe((command) => void this.select(command));
        ref.instance.hoverIndex.subscribe((index) => this.setSelectedIndex(index));
        this.doc.addEventListener('mousedown', this.outsidePointerBound, true);
        globalThis.window.addEventListener('scroll', this.dismissBound, { capture: true, passive: true });
        this.menuRef = ref;
        return ref;
    }

    /**
     * Position the menu at the caret. It renders in the native top layer so it
     * sits above any modal the editor lives inside, falling back to a high
     * z-index on engines without the Popover API.
     */
    private positionMenu(ref: ComponentRef<RichTextSlashCommandsMenuComponent>): void {
        const el = ref.location.nativeElement as HTMLElement & { showPopover?: () => void };
        el.style.position = 'fixed';
        el.style.inset = 'auto';
        el.style.margin = '0';
        el.style.left = `${Math.round(this.position.x)}px`;
        el.style.top = `${Math.round(this.position.y)}px`;
        if (typeof el.showPopover === 'function') {
            if (!el.hasAttribute('popover')) {
                el.setAttribute('popover', 'manual');
                el.showPopover();
            }
        } else {
            el.style.zIndex = '9999';
        }
    }

    private updatePosition(): void {
        const selection = this.doc.getSelection();
        if (!selection || selection.rangeCount === 0) {
            return;
        }
        const rect = this.resolveCaretRect(selection.getRangeAt(0));
        if (!rect) {
            return;
        }
        const view = globalThis.window;
        const x = Math.max(8, Math.min(rect.left, view.innerWidth - MENU_WIDTH - 8));
        /**
         * Drop below the caret, or flip above when the menu would overflow the
         * viewport bottom (fixed-positioned, so it can't scroll into view).
         */
        const below = rect.bottom + MENU_CARET_GAP;
        const y = below + MENU_MAX_HEIGHT > view.innerHeight
            ? Math.max(8, rect.top - MENU_MAX_HEIGHT - MENU_CARET_GAP)
            : below;
        this.position = { x, y };
    }

    /**
     * The caret rect for a collapsed range in an empty block can degenerate to
     * `(0,0,0,0)` (notably right after the editor is cleared), which would pin
     * the menu to the viewport's top-left corner. Fall back to the anchor
     * block's rect so the menu still tracks the caret's line.
     */
    private resolveCaretRect(range: Range): DOMRect | null {
        const rect = range.getBoundingClientRect();
        if (rect.width > 0 || rect.height > 0 || rect.top > 0 || rect.left > 0) {
            return rect;
        }
        const blockRect = this.anchorBlock?.getBoundingClientRect();
        return blockRect && (blockRect.width > 0 || blockRect.height > 0) ? blockRect : null;
    }

    private onScrollDismiss(event: Event): void {
        /**
         * Scrolling the menu's own option list must not dismiss it; only close
         * when the surrounding page/editor scrolls out from under the caret.
         */
        const menuEl = this.menuRef?.location.nativeElement as HTMLElement | undefined;
        const target = event.target;
        if (menuEl && target instanceof Node && menuEl.contains(target)) {
            return;
        }
        this.close();
    }

    private onOutsidePointer(event: Event): void {
        if (!this.menuRef) {
            return;
        }
        const node = event.target as Node | null;
        const menuEl = this.menuRef.location.nativeElement as HTMLElement;
        if (node && (menuEl.contains(node) || this.host.contentRoot.contains(node))) {
            return;
        }
        this.close();
    }

    private close(): void {
        this.open = false;
        this.query = '';
        this.selectedIndex = 0;
        this.anchorBlock = null;
        this.triggerRange = null;
        if (!this.menuRef) {
            return;
        }
        this.doc.removeEventListener('mousedown', this.outsidePointerBound, true);
        globalThis.window.removeEventListener('scroll', this.dismissBound, { capture: true });
        this.menuRef.destroy();
        this.menuRef = undefined;
    }

    private focusEditor(): void {
        (this.host.contentRoot as HTMLElement | null)?.focus();
    }
}

/** The normalized `[uiRteSlashCommands]` value: an enable flag plus any custom commands. */
interface NormalizedSlashCommands {
    readonly enabled: boolean;
    readonly commands: RichTextSlashCommand[];
}

/** Normalize the marker input's four accepted shapes to `{ enabled, commands }`. */
function normalizeSlashCommands(value: RichTextSlashCommand[] | '' | boolean): NormalizedSlashCommands {
    if (value === false) {
        return { enabled: false, commands: [] };
    }
    if (value === '' || value === true) {
        return { enabled: true, commands: [] };
    }
    return { enabled: true, commands: value };
}

function matchesSlashQuery(command: RichTextSlashCommand, needle: string): boolean {
    if (!needle) {
        return true;
    }
    const haystack = [
        command.label,
        command.description ?? '',
        ...(command.keywords ?? []),
        ...(command.aliases ?? []),
    ].join(' ').toLowerCase();
    return haystack.includes(needle);
}

function compareSlashCommands(a: RichTextSlashCommand, b: RichTextSlashCommand): number {
    const byOrder = (a.order ?? 9999) - (b.order ?? 9999);
    if (byOrder !== 0) {
        return byOrder;
    }
    return a.label.localeCompare(b.label);
}

function captureCaretHint(doc: Document): { x: number; y: number } | null {
    const selection = doc.getSelection();
    if (!selection || selection.rangeCount === 0) {
        return null;
    }
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    if (rect.width > 0 || rect.height > 0 || rect.top > 0 || rect.left > 0) {
        return { x: rect.left, y: rect.bottom };
    }
    return null;
}
