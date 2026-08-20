import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CommandComponent } from './command.component';
import { CommandInputComponent } from './sub/command-input.component';
import { CommandItemComponent } from './sub/command-item.component';
import { CommandListComponent } from './sub/command-list.component';
import type { CommandResult, CommandSource } from './command.types';
import { readRecentValues, unshiftUniqueValue, writeRecentValues } from './command.utils';

/**
 * Feature specs for the additive command API — async sources, recent items and
 * nested pages. `command.component.spec.ts` is the untouched
 * backward-compatibility gate.
 */

interface Deferred {
    readonly promise: Promise<readonly CommandResult[]>;
    resolve(rows: readonly CommandResult[]): void;
    reject(error: unknown): void;
}

function deferred(): Deferred {
    let resolve!: (rows: readonly CommandResult[]) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<readonly CommandResult[]>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

function row(id: string): CommandResult {
    return { id, value: id };
}

@Component({
    imports: [CommandComponent, CommandInputComponent, CommandListComponent, CommandItemComponent],
    template: `
        <ui-command
            [source]="source()"
            [debounce]="0"
            [recentKey]="recentKey()"
            [recentLimit]="3"
            #cmd
        >
            <ui-command-input />
            <ui-command-list>
                @for (item of staticItems(); track item) {
                    <ui-command-item [value]="item">{{ item }}</ui-command-item>
                }
            </ui-command-list>
        </ui-command>
    `,
})
class CommandFeaturesHostComponent {
    readonly source = signal<CommandSource | null>(null);
    readonly recentKey = signal<string | null>(null);
    readonly staticItems = signal<string[]>(['alpha', 'beta']);
}

function getCommand(fixture: ComponentFixture<unknown>): CommandComponent {
    return fixture.debugElement.query(By.directive(CommandComponent)).componentInstance;
}

function typeQuery(fixture: ComponentFixture<unknown>, value: string): void {
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
}

describe('command.utils', () => {
    beforeEach(() => globalThis.localStorage?.clear());
    afterEach(() => globalThis.localStorage?.clear());

    it('round-trips recents under a namespaced key', () => {
        writeRecentValues('palette', ['a', 'b']);
        expect(globalThis.localStorage.getItem('palette')).toBeNull();
        expect(readRecentValues('palette', 5)).toEqual(['a', 'b']);
    });

    it('caps what it reads back', () => {
        writeRecentValues('palette', ['a', 'b', 'c', 'd']);
        expect(readRecentValues('palette', 2)).toEqual(['a', 'b']);
    });

    it('returns an empty list for a null key, a missing key, or junk', () => {
        expect(readRecentValues(null, 5)).toEqual([]);
        expect(readRecentValues('nothing-here', 5)).toEqual([]);
        globalThis.localStorage.setItem('ui-command:junk', '{"not":"an array"}');
        expect(readRecentValues('junk', 5)).toEqual([]);
    });

    it('degrades instead of throwing when localStorage is unavailable', () => {
        const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
        Object.defineProperty(globalThis, 'localStorage', {
            configurable: true,
            get(): Storage { throw new Error('private mode'); },
        });
        try {
            expect(readRecentValues('palette', 5)).toEqual([]);
            expect(() => writeRecentValues('palette', ['a'])).not.toThrow();
        } finally {
            if (original) Object.defineProperty(globalThis, 'localStorage', original);
        }
    });

    it('unshifts uniquely and caps', () => {
        expect(unshiftUniqueValue(['b', 'c'], 'a', 3)).toEqual(['a', 'b', 'c']);
        expect(unshiftUniqueValue(['a', 'b', 'c'], 'c', 3)).toEqual(['c', 'a', 'b']);
        expect(unshiftUniqueValue(['a', 'b', 'c'], 'd', 2)).toEqual(['d', 'a']);
    });
});

describe('CommandComponent — async source', () => {
    let fixture: ComponentFixture<CommandFeaturesHostComponent>;
    let host: CommandFeaturesHostComponent;
    let cmd: CommandComponent;

    beforeEach(async () => {
        globalThis.localStorage?.clear();
        await TestBed.configureTestingModule({ imports: [CommandFeaturesHostComponent] }).compileComponents();
        fixture = TestBed.createComponent(CommandFeaturesHostComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();
        cmd = getCommand(fixture);
    });

    afterEach(() => {
        globalThis.localStorage?.clear();
        TestBed.resetTestingModule();
    });

    it('starts with no results and no loading state when no source is set', () => {
        expect(cmd.results()).toEqual([]);
        expect(cmd.isLoading()).toBe(false);
    });

    it('shows loading, then populates the results', async () => {
        const pending = deferred();
        host.source.set(() => pending.promise);
        fixture.detectChanges();

        expect(cmd.isLoading()).toBe(true);
        expect(cmd.results()).toEqual([]);

        pending.resolve([row('one'), row('two')]);
        await fixture.whenStable();

        expect(cmd.isLoading()).toBe(false);
        expect(cmd.results().map(r => r.id)).toEqual(['one', 'two']);
    });

    it('passes the current query to the source', async () => {
        const seen: string[] = [];
        host.source.set(query => { seen.push(query); return Promise.resolve([]); });
        fixture.detectChanges();
        await fixture.whenStable();

        typeQuery(fixture, 'hello');
        await fixture.whenStable();

        expect(seen.at(-1)).toBe('hello');
    });

    it('discards an out-of-order response so a stale answer cannot clobber a newer one', async () => {
        const first = deferred();
        const second = deferred();
        const queue = [first, second];
        host.source.set(() => queue.shift()!.promise);
        fixture.detectChanges();

        typeQuery(fixture, 'second');
        await fixture.whenStable();

        second.resolve([row('newer')]);
        await fixture.whenStable();
        expect(cmd.results().map(r => r.id)).toEqual(['newer']);

        first.resolve([row('stale')]);
        await fixture.whenStable();

        expect(cmd.results().map(r => r.id)).toEqual(['newer']);
    });

    it('aborts the superseded call so a stale request is cancelled on the wire', async () => {
        const aborted: boolean[] = [];
        const held = deferred();
        let calls = 0;
        host.source.set((_query, signal) => {
            calls++;
            signal.addEventListener('abort', () => aborted.push(true));
            return calls === 1 ? held.promise : Promise.resolve([]);
        });
        fixture.detectChanges();
        await fixture.whenStable();

        typeQuery(fixture, 'again');
        await fixture.whenStable();

        expect(aborted).toEqual([true]);
        held.resolve([]);
    });

    it('surfaces a throwing source on sourceError and clears the results', async () => {
        host.source.set(() => Promise.resolve([row('kept')]));
        fixture.detectChanges();
        await fixture.whenStable();
        expect(cmd.results()).toHaveLength(1);

        host.source.set(() => Promise.reject(new Error('server exploded')));
        fixture.detectChanges();
        await fixture.whenStable();

        expect(cmd.results()).toEqual([]);
        expect(cmd.isLoading()).toBe(false);
        expect((cmd.sourceError() as Error).message).toBe('server exploded');
    });

    it('clears a previous error once a later call succeeds', async () => {
        host.source.set(() => Promise.reject(new Error('boom')));
        fixture.detectChanges();
        await fixture.whenStable();
        expect(cmd.sourceError()).not.toBeNull();

        host.source.set(() => Promise.resolve([row('ok')]));
        fixture.detectChanges();
        await fixture.whenStable();

        expect(cmd.sourceError()).toBeNull();
    });

    it('tears the pending debounce and controller down on destroy', async () => {
        let aborted = false;
        const held = deferred();
        host.source.set((_query, signal) => {
            signal.addEventListener('abort', () => { aborted = true; });
            return held.promise;
        });
        fixture.detectChanges();
        await fixture.whenStable();

        fixture.destroy();

        expect(aborted).toBe(true);
        held.resolve([]);
    });

    it('resets to empty when the source is removed', async () => {
        host.source.set(() => Promise.resolve([row('one')]));
        fixture.detectChanges();
        await fixture.whenStable();
        expect(cmd.results()).toHaveLength(1);

        host.source.set(null);
        fixture.detectChanges();

        expect(cmd.results()).toEqual([]);
        expect(cmd.isLoading()).toBe(false);
    });
});

describe('CommandComponent — debounce', () => {
    @Component({
        imports: [CommandComponent, CommandInputComponent, CommandListComponent],
        template: `
            <ui-command [source]="source()" [debounce]="200">
                <ui-command-input />
                <ui-command-list />
            </ui-command>
        `,
    })
    class DebounceHostComponent {
        readonly source = signal<CommandSource | null>(null);
    }

    it('waits out the quiet period and issues one call, not one per keystroke', async () => {
        vi.useFakeTimers();
        try {
            TestBed.configureTestingModule({ imports: [DebounceHostComponent] });
            const fixture = TestBed.createComponent(DebounceHostComponent);
            fixture.detectChanges();

            const queries: string[] = [];
            fixture.componentInstance.source.set(query => {
                queries.push(query);
                return Promise.resolve([]);
            });
            fixture.detectChanges();

            const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
            for (const value of ['a', 'ab', 'abc']) {
                input.value = value;
                input.dispatchEvent(new Event('input'));
                fixture.detectChanges();
                vi.advanceTimersByTime(50);
            }

            expect(queries).toEqual([]);
            vi.advanceTimersByTime(200);
            expect(queries).toEqual(['abc']);
        } finally {
            vi.useRealTimers();
            TestBed.resetTestingModule();
        }
    });
});

describe('CommandComponent — recent items', () => {
    let fixture: ComponentFixture<CommandFeaturesHostComponent>;
    let host: CommandFeaturesHostComponent;
    let cmd: CommandComponent;

    beforeEach(async () => {
        globalThis.localStorage?.clear();
        await TestBed.configureTestingModule({ imports: [CommandFeaturesHostComponent] }).compileComponents();
        fixture = TestBed.createComponent(CommandFeaturesHostComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();
        cmd = getCommand(fixture);
    });

    afterEach(() => {
        globalThis.localStorage?.clear();
        TestBed.resetTestingModule();
    });

    it('shows nothing recent before anything is selected', () => {
        expect(cmd.recents()).toEqual([]);
        expect(cmd.showRecents()).toBe(false);
    });

    it('records a selection and offers it while the query is empty', () => {
        const items = fixture.debugElement.queryAll(By.directive(CommandItemComponent));
        items[1].nativeElement.querySelector('[data-slot="command-item"]').click();
        fixture.detectChanges();

        expect(cmd.recents()).toEqual(['beta']);
        expect(cmd.showRecents()).toBe(true);
    });

    it('hides recents as soon as the user types', () => {
        cmd.markRecent('alpha');
        fixture.detectChanges();
        expect(cmd.showRecents()).toBe(true);

        typeQuery(fixture, 'al');
        expect(cmd.showRecents()).toBe(false);
    });

    it('keeps the newest first, de-duplicated and capped at recentLimit', () => {
        ['a', 'b', 'c', 'a', 'd'].forEach(v => cmd.markRecent(v));
        expect(cmd.recents()).toEqual(['d', 'a', 'c']);
    });

    it('ignores an empty value', () => {
        cmd.markRecent('');
        expect(cmd.recents()).toEqual([]);
    });

    it('persists only when a recentKey is supplied', () => {
        cmd.markRecent('alpha');
        expect(globalThis.localStorage).toHaveLength(0);

        host.recentKey.set('palette');
        fixture.detectChanges();
        cmd.markRecent('gamma');

        expect(readRecentValues('palette', 3)).toEqual(['gamma']);
    });

    it('hydrates from storage when a recentKey is set', () => {
        writeRecentValues('palette', ['stored-one', 'stored-two']);
        host.recentKey.set('palette');
        fixture.detectChanges();

        expect(cmd.recents()).toEqual(['stored-one', 'stored-two']);
    });

    it('keeps in-memory recents when recentLimit changes and no key is set', () => {
        cmd.markRecent('alpha');
        expect(cmd.recents()).toEqual(['alpha']);

        fixture.componentRef.setInput('recentKey', null);
        fixture.detectChanges();

        expect(cmd.recents()).toEqual(['alpha']);
    });

    it('clearRecents empties both memory and storage', () => {
        host.recentKey.set('palette');
        fixture.detectChanges();
        cmd.markRecent('alpha');

        cmd.clearRecents();

        expect(cmd.recents()).toEqual([]);
        expect(readRecentValues('palette', 3)).toEqual([]);
    });
});

describe('CommandComponent — nested pages', () => {
    let fixture: ComponentFixture<CommandFeaturesHostComponent>;
    let cmd: CommandComponent;

    function pressKey(key: string): KeyboardEvent {
        const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
        const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
        input.dispatchEvent(event);
        fixture.detectChanges();
        return event;
    }

    beforeEach(async () => {
        globalThis.localStorage?.clear();
        await TestBed.configureTestingModule({ imports: [CommandFeaturesHostComponent] }).compileComponents();
        fixture = TestBed.createComponent(CommandFeaturesHostComponent);
        fixture.detectChanges();
        cmd = getCommand(fixture);
    });

    afterEach(() => TestBed.resetTestingModule());

    it('starts at the top level', () => {
        expect(cmd.page()).toBeNull();
        expect(cmd.pages()).toEqual([]);
    });

    it('opens a nested page and clears the query', () => {
        typeQuery(fixture, 'alp');
        cmd.pushPage({ id: 'themes', label: 'Themes' });
        fixture.detectChanges();

        expect(cmd.page()).toEqual({ id: 'themes', label: 'Themes' });
        expect(fixture.nativeElement.querySelector('input').value).toBe('');
    });

    it('Escape returns to the parent and does not bubble out of the palette', () => {
        cmd.pushPage({ id: 'themes' });
        fixture.detectChanges();

        let reachedHost = false;
        const listener = (): void => { reachedHost = true; };
        fixture.nativeElement.addEventListener('keydown', listener);

        const event = pressKey('Escape');
        fixture.nativeElement.removeEventListener('keydown', listener);

        expect(cmd.page()).toBeNull();
        expect(event.defaultPrevented).toBe(true);
        expect(reachedHost).toBe(false);
    });

    it('Escape at the top level is left alone so the dialog still closes', () => {
        const event = pressKey('Escape');

        expect(event.defaultPrevented).toBe(false);
        expect(cmd.page()).toBeNull();
    });

    it('Backspace on an empty query goes back, but not while the query has text', () => {
        cmd.pushPage({ id: 'themes' });
        fixture.detectChanges();

        typeQuery(fixture, 'dark');
        pressKey('Backspace');
        expect(cmd.page()).not.toBeNull();

        typeQuery(fixture, '');
        pressKey('Backspace');
        expect(cmd.page()).toBeNull();
    });

    it('nests several levels and unwinds one at a time', () => {
        cmd.pushPage({ id: 'settings' });
        cmd.pushPage({ id: 'themes' });
        fixture.detectChanges();

        expect(cmd.pages().map(p => p.id)).toEqual(['settings', 'themes']);
        expect(cmd.popPage()).toBe(true);
        expect(cmd.page()?.id).toBe('settings');
        expect(cmd.popPage()).toBe(true);
        expect(cmd.popPage()).toBe(false);
    });

    it('resetPages jumps straight back to the top level', () => {
        cmd.pushPage({ id: 'a' });
        cmd.pushPage({ id: 'b' });
        cmd.resetPages();
        fixture.detectChanges();

        expect(cmd.pages()).toEqual([]);
        expect(cmd.page()).toBeNull();
    });
});
