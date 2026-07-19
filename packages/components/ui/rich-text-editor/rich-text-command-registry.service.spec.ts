import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { RichTextCommandRegistry, RichTextSlashCommand } from './rich-text-command-registry.service';

const makeCommand = (id: string, overrides: Partial<RichTextSlashCommand> = {}): RichTextSlashCommand => ({
    id,
    label: id,
    run: () => undefined,
    ...overrides,
});

describe('RichTextCommandRegistry', () => {
    let registry: RichTextCommandRegistry;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        registry = TestBed.inject(RichTextCommandRegistry);
    });

    it('starts empty', () => {
        expect(registry.listCommands()).toHaveLength(0);
    });

    it('registers a command and lists it', () => {
        registry.registerCommand(makeCommand('insert.date'));
        const commands = registry.listCommands();
        expect(commands).toHaveLength(1);
        expect(commands[0].id).toBe('insert.date');
    });

    it('replaces a command registered under the same id', () => {
        registry.registerCommand(makeCommand('dup', { label: 'first' }));
        registry.registerCommand(makeCommand('dup', { label: 'second' }));
        const commands = registry.listCommands();
        expect(commands).toHaveLength(1);
        expect(commands[0].label).toBe('second');
    });

    it('returns a teardown from registerCommand that removes it', () => {
        const off = registry.registerCommand(makeCommand('temp'));
        expect(registry.listCommands()).toHaveLength(1);
        off();
        expect(registry.listCommands()).toHaveLength(0);
    });

    it('registers several commands at once and tears them all down', () => {
        const off = registry.registerCommands([makeCommand('a'), makeCommand('b'), makeCommand('c')]);
        expect(registry.listCommands()).toHaveLength(3);
        off();
        expect(registry.listCommands()).toHaveLength(0);
    });

    it('unregisterCommand removes a known id and no-ops for an unknown id', () => {
        registry.registerCommand(makeCommand('known'));
        registry.unregisterCommand('unknown');
        expect(registry.listCommands()).toHaveLength(1);
        registry.unregisterCommand('known');
        expect(registry.listCommands()).toHaveLength(0);
    });

    it('clear empties the registry and is a no-op when already empty', () => {
        expect(() => registry.clear()).not.toThrow();
        registry.registerCommand(makeCommand('x'));
        registry.registerCommand(makeCommand('y'));
        registry.clear();
        expect(registry.listCommands()).toHaveLength(0);
    });

    it('preserves the run/when metadata of a registered command', () => {
        let ran = 0;
        const command = makeCommand('meta', {
            keywords: ['k'],
            when: () => true,
            run: () => { ran += 1; },
        });
        registry.registerCommand(command);
        const stored = registry.listCommands()[0];
        stored.run({
            query: '',
            selectedText: '',
            executeToolbarCommand: () => undefined,
            insertText: () => undefined,
            insertHtml: () => undefined,
            showLinkDialog: () => undefined,
            focusEditor: () => undefined,
        });
        expect(ran).toBe(1);
        expect(stored.when?.({ query: '', disabled: false, readonly: false, hasSelection: false })).toBe(true);
    });
});
