import { Injectable, signal } from '@angular/core';

/**
 * Read-only snapshot of the editor state, passed to the `when` guard on a
 * {@link RichTextSlashCommand} to decide whether the command should appear
 * in the slash command menu.
 */
export interface RichTextSlashCommandAvailabilityContext {
    /** The text typed after `/` in the slash command query. */
    query: string;

    /** Whether the editor is currently disabled. */
    disabled: boolean;

    /** Whether the editor is in read-only mode. */
    readonly: boolean;

    /** Whether the user has an active text selection. */
    hasSelection: boolean;
}

/**
 * Execution context passed to a slash command's `run` function. Provides
 * methods to manipulate the editor content from within the command handler.
 */
export interface RichTextSlashCommandContext {
    /** The text typed after `/` when the command was selected. */
    query: string;

    /** The currently selected text in the editor (empty string if no selection). */
    selectedText: string;

    /**
     * Execute a built-in toolbar formatting command by name.
     *
     * @param command - A {@link ToolbarItem} name such as `'bold'`, `'heading1'`,
     *   `'bulletList'`, `'blockquote'`, etc.
     */
    executeToolbarCommand: (command: string) => void;

    /** Insert plain text at the current cursor position. */
    insertText: (text: string) => void;

    /** Insert raw HTML at the current cursor position. */
    insertHtml: (html: string) => void;

    /** Open the editor's built-in link insertion dialog. */
    showLinkDialog: () => void;

    /** Return focus to the editor's content area. */
    focusEditor: () => void;
}

/**
 * Definition of a custom slash command. Register commands via the
 * `[uiRteSlashCommands]` input on the `rich-text-editor/slash-commands` addon
 * directive, or programmatically through {@link RichTextCommandRegistry}.
 *
 * When the user types `/` in the editor, matching commands appear in a
 * dropdown. The user can filter by typing, and select a command to execute.
 *
 * @example
 * ```ts
 * const commands: RichTextSlashCommand[] = [
 *   {
 *     id: 'insert.date',
 *     label: 'Today\'s Date',
 *     description: 'Insert the current date',
 *     keywords: ['date', 'today', 'now'],
 *     order: 200,
 *     run: (ctx) => ctx.insertText(new Date().toLocaleDateString()),
 *   },
 *   {
 *     id: 'insert.divider',
 *     label: 'Divider',
 *     description: 'Insert a horizontal rule',
 *     keywords: ['hr', 'line', 'separator'],
 *     order: 210,
 *     when: (ctx) => !ctx.hasSelection,
 *     run: (ctx) => ctx.insertHtml('<hr/>'),
 *   },
 * ];
 * ```
 */
export interface RichTextSlashCommand {
    /**
     * Unique identifier for this command. Use dot-separated namespacing
     * (e.g. `'format.heading-1'`, `'insert.date'`, `'custom.myCommand'`).
     */
    id: string;

    /** Display label shown in the slash command menu. */
    label: string;

    /** Short description shown below the label in the menu. */
    description?: string;

    /**
     * Additional search terms that match this command when the user types
     * after `/`. The `label` is always searched; `keywords` expand the matches.
     */
    keywords?: string[];

    /** Alternative names that also trigger this command. */
    aliases?: string[];

    /**
     * Sort order in the command menu. Lower values appear first.
     * Built-in commands use `10`–`120`; use `200+` for custom commands
     * to appear after defaults.
     */
    order?: number;

    /**
     * Optional guard that controls whether this command appears in the menu.
     * Return `false` to hide the command based on editor state.
     *
     * @param context - Current editor state snapshot.
     * @returns `true` to show the command, `false` to hide it.
     */
    when?: (context: RichTextSlashCommandAvailabilityContext) => boolean;

    /**
     * The function executed when the user selects this command.
     * Can be async (return a `Promise`).
     *
     * @param context - Provides methods to manipulate the editor
     *   (`insertText`, `insertHtml`, `executeToolbarCommand`, etc.).
     */
    run: (context: RichTextSlashCommandContext) => void | Promise<void>;
}

/**
 * Keyed store of {@link RichTextSlashCommand}s, keyed by `id` so re-registering
 * an id replaces rather than duplicates it.
 *
 * The token resolves at two levels: the root instance is app-wide (its commands
 * appear in every editor), and `RichTextEditorComponent` provides its own
 * instance so a command registered through an addon directive is scoped to that
 * one editor. The slash-commands menu merges both, with instance commands
 * winning on id collisions.
 */
@Injectable({ providedIn: 'root' })
export class RichTextCommandRegistry {
    private readonly commands = new Map<string, RichTextSlashCommand>();
    private readonly version = signal(0);

    /**
     * Add (or replace, by `id`) a single command and notify readers.
     *
     * @returns A teardown that unregisters this command — call it from the
     *   registering directive's/component's `DestroyRef`. Note it removes
     *   whatever now holds that `id`, so a later registration of the same id
     *   wins and this teardown then removes *that* one.
     */
    registerCommand(command: RichTextSlashCommand): () => void {
        this.commands.set(command.id, command);
        this.bumpVersion();
        return () => this.unregisterCommand(command.id);
    }

    /**
     * Register a batch of commands as one update — readers recompute once
     * rather than once per command.
     *
     * @returns A teardown removing exactly these ids in a single update.
     */
    registerCommands(commands: RichTextSlashCommand[]): () => void {
        commands.forEach(command => this.commands.set(command.id, command));
        this.bumpVersion();
        return () => {
            commands.forEach(command => this.commands.delete(command.id));
            this.bumpVersion();
        };
    }

    /**
     * Remove the command with this `id`. A no-op — including no notification
     * to readers — when nothing is registered under it.
     */
    unregisterCommand(id: string): void {
        if (this.commands.delete(id)) {
            this.bumpVersion();
        }
    }

    /**
     * Drop every command in this registry, notifying readers once (and not at
     * all if it was already empty). Only affects the registry instance it is
     * called on — clearing an editor's own registry leaves the root/global
     * commands, and every other editor's, untouched.
     */
    clear(): void {
        if (this.commands.size === 0) {
            return;
        }
        this.commands.clear();
        this.bumpVersion();
    }

    /**
     * A snapshot of the registered commands in registration order — *not*
     * sorted by `order`, and not filtered by `when`; the slash-commands menu
     * merges the global and instance registries and applies both itself.
     *
     * Reads an internal version signal, so calling it inside a `computed` or
     * effect makes that consumer re-run whenever commands are registered or
     * removed. The array is a fresh copy, but the command objects are the
     * registered ones — do not mutate them.
     */
    listCommands(): RichTextSlashCommand[] {
        this.version();
        return Array.from(this.commands.values());
    }

    private bumpVersion(): void {
        this.version.update(v => v + 1);
    }
}
