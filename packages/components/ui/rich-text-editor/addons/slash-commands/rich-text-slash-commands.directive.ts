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
// Approximate menu box size (component `w-72` = 288px; `max-h-56` = 224px plus
// padding/border) used only to clamp/flip the fixed position within the viewport.
const MENU_WIDTH = 288;
const MENU_MAX_HEIGHT = 240;

/**
 * Opt-in slash-command menu for `<ui-rich-text-editor>`. Attaches via DI to the
 * `RichTextEditorAddonHost` the base provides. Typing `/` opens a filterable
 * command menu at the caret; the base editor ships no slash-command code.
 *
 * The menu merges, in precedence order: this addon's built-in commands (built
 * from `[uiRteSlashCommandsLocale]`), the host's base-owned `builtinCommands`
 * (the outline command, plus the AI command when an `aiProvider` is set), any
 * commands registered programmatically through the shared command registry,
 * and the custom commands passed to `[uiRteSlashCommands]`.
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
    selector: 'ui-rich-text-editor[uiRteSlashCommands]',
    standalone: true,
})
export class RichTextSlashCommandsDirective {
    private readonly host = inject(RichTextEditorAddonHost);
    private readonly vcr = inject(ViewContainerRef);

    /**
     * Custom slash commands merged in after the built-ins. The bare attribute
     * (`uiRteSlashCommands`) just enables the addon; a binding
     * (`[uiRteSlashCommands]="cmds"`) also registers custom commands.
     */
    readonly uiRteSlashCommands = input<RichTextSlashCommand[], RichTextSlashCommand[] | ''>([], {
        transform: (value) => (value === '' ? [] : value),
    });
    /** Locale for the menu UI: a registry key (`'en'`/`'he'`/…) or a full dictionary. */
    readonly uiRteSlashCommandsLocale = input<LocaleInput<RichTextSlashCommandsLocale>>();

    private readonly i18n = createLocaleBindings(this.uiRteSlashCommandsLocale, RICH_TEXT_SLASH_COMMANDS_LOCALES);
    private readonly defaultCommands = computed(() => buildDefaultSlashCommands(this.i18n.t()));

    private open = false;
    private query = '';
    private selectedIndex = 0;
    private anchorBlock: HTMLElement | null = null;
    private triggerRange: Range | null = null;
    private position = { x: 0, y: 0 };

    private menuRef?: ComponentRef<RichTextSlashCommandsMenuComponent>;
    private readonly outsidePointerBound = (event: Event): void => this.onOutsidePointer(event);
    private readonly dismissBound = (): void => this.close();

    constructor() {
        const offKeydown = this.host.registerKeydownInterceptor((event) => this.handleKeydown(event));
        const offInput = this.host.registerInputObserver((text, caret) => this.onInputObserved(text, caret));
        // Re-filter the live menu when the command registry, locale, or custom
        // input changes while it is open. Typing / keyboard nav refresh the menu
        // imperatively; this only covers reactive (signal-driven) changes.
        effect(() => {
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

    // ── Trigger detection ─────────────────────────────────────────────

    private onInputObserved(text: string, caret: number): void {
        if (this.host.disabled() || this.host.readonly()) {
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

    // ── Filtering ─────────────────────────────────────────────────────

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
        for (const command of this.host.commands.listCommands()) {
            merged.set(command.id, command);
        }
        for (const command of this.uiRteSlashCommands()) {
            merged.set(command.id, command);
        }
        const needle = this.query.trim().toLowerCase();
        return Array.from(merged.values())
            .filter(command => !command.when || command.when(availability))
            .filter(command => matchesSlashQuery(command, needle))
            .sort(compareSlashCommands)
            .slice(0, MAX_SLASH_COMMANDS);
    }

    // ── Keyboard ──────────────────────────────────────────────────────

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

    // ── Selection / execution ─────────────────────────────────────────

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
        // Commit the trigger-removal DOM edits to the model (and snapshot them as
        // a discrete history entry) before the command runs its own mutation.
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

    // ── Menu overlay ──────────────────────────────────────────────────

    private applyMenuInputs(commands: RichTextSlashCommand[]): void {
        // Re-filtering (registry/locale/custom changes) can shrink the list below
        // the highlighted index; keep it in range so Enter always has a target.
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

    private positionMenu(ref: ComponentRef<RichTextSlashCommandsMenuComponent>): void {
        const el = ref.location.nativeElement as HTMLElement & { showPopover?: () => void };
        el.style.position = 'fixed';
        el.style.inset = 'auto';
        el.style.margin = '0';
        el.style.left = `${Math.round(this.position.x)}px`;
        el.style.top = `${Math.round(this.position.y)}px`;
        // Render in the native top layer so the menu sits above any modal the
        // editor lives inside; fall back to a high z-index otherwise.
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
        const rect = selection.getRangeAt(0).getBoundingClientRect();
        const view = globalThis.window;
        const x = Math.max(8, Math.min(rect.left, view.innerWidth - MENU_WIDTH - 8));
        // Drop below the caret, or flip above when the menu would overflow the
        // viewport bottom (fixed-positioned, so it can't scroll into view).
        const below = rect.bottom + MENU_CARET_GAP;
        const y = below + MENU_MAX_HEIGHT > view.innerHeight
            ? Math.max(8, rect.top - MENU_MAX_HEIGHT - MENU_CARET_GAP)
            : below;
        this.position = { x, y };
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
