import { Injectable, signal } from '@angular/core';

export interface RichTextSlashCommandAvailabilityContext {
    query: string;
    disabled: boolean;
    readonly: boolean;
    hasSelection: boolean;
}

export interface RichTextSlashCommandContext {
    query: string;
    selectedText: string;
    executeToolbarCommand: (command: string) => void;
    insertText: (text: string) => void;
    insertHtml: (html: string) => void;
    showLinkDialog: () => void;
    focusEditor: () => void;
}

export interface RichTextSlashCommand {
    id: string;
    label: string;
    description?: string;
    keywords?: string[];
    aliases?: string[];
    order?: number;
    when?: (context: RichTextSlashCommandAvailabilityContext) => boolean;
    run: (context: RichTextSlashCommandContext) => void | Promise<void>;
}

@Injectable({ providedIn: 'root' })
export class RichTextCommandRegistry {
    private readonly commands = new Map<string, RichTextSlashCommand>();
    private readonly version = signal(0);

    registerCommand(command: RichTextSlashCommand): () => void {
        this.commands.set(command.id, command);
        this.bumpVersion();
        return () => this.unregisterCommand(command.id);
    }

    registerCommands(commands: RichTextSlashCommand[]): () => void {
        commands.forEach(command => this.commands.set(command.id, command));
        this.bumpVersion();
        return () => {
            commands.forEach(command => this.commands.delete(command.id));
            this.bumpVersion();
        };
    }

    unregisterCommand(id: string): void {
        if (this.commands.delete(id)) {
            this.bumpVersion();
        }
    }

    clear(): void {
        if (this.commands.size === 0) {
            return;
        }
        this.commands.clear();
        this.bumpVersion();
    }

    listCommands(): RichTextSlashCommand[] {
        this.version();
        return Array.from(this.commands.values());
    }

    private bumpVersion(): void {
        this.version.update(v => v + 1);
    }
}
