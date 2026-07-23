import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import {
    CommandComponent,
    CommandInputComponent,
    CommandListComponent,
    CommandItemComponent,
    CommandGroupComponent,
    CommandEmptyComponent,
    CommandSeparatorComponent,
    CommandShortcutComponent,
    CommandDialogComponent,
    CommandService,
    generateId,
    COMMAND_DIALOG_SHORTCUT_DEFINITIONS,
} from '../command';
import { ShortcutBindingService } from '../../lib/shortcut-binding.service';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { By } from '@angular/platform-browser';

type ScrollIntoView = typeof Element.prototype.scrollIntoView;
const scrollProto = Element.prototype as unknown as { scrollIntoView?: ScrollIntoView };
let originalScrollIntoView: ScrollIntoView | undefined;
let hadScrollIntoView = false;

beforeEach(() => {
    hadScrollIntoView = 'scrollIntoView' in scrollProto;
    originalScrollIntoView = scrollProto.scrollIntoView;
    scrollProto.scrollIntoView = vi.fn();
});

afterEach(() => {
    if (hadScrollIntoView) {
        scrollProto.scrollIntoView = originalScrollIntoView;
    } else {
        delete scrollProto.scrollIntoView;
    }
    originalScrollIntoView = undefined;
});

@Component({
    template: `
        <ui-command>
            <ui-command-input placeholder="Type a command..." />
            <ui-command-list>
                <ui-command-empty>No results found.</ui-command-empty>
                <ui-command-group heading="Suggestions">
                    <ui-command-item value="calendar" (selectItem)="onCalendarSelect($event)">
                        Calendar
                        <ui-command-shortcut>Ctrl+C</ui-command-shortcut>
                    </ui-command-item>
                    <ui-command-item value="search" (selectItem)="onSearchSelect($event)">Search</ui-command-item>
                </ui-command-group>
                <ui-command-separator />
                <ui-command-group heading="Settings">
                    <ui-command-item value="profile" (selectItem)="onProfileSelect($event)">Profile</ui-command-item>
                </ui-command-group>
            </ui-command-list>
        </ui-command>
    `,
    imports: [
        CommandComponent,
        CommandInputComponent,
        CommandListComponent,
        CommandItemComponent,
        CommandGroupComponent,
        CommandEmptyComponent,
        CommandSeparatorComponent,
        CommandShortcutComponent,
    ]
})
class TestHostComponent {
    onCalendarSelect = vi.fn();
    onSearchSelect = vi.fn();
    onProfileSelect = vi.fn();
}

describe('CommandComponent', () => {
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();
    });

    // --- Existing creation/structure tests ---

    it('should create CommandComponent', () => {
        const command = fixture.debugElement.query(By.directive(CommandComponent));
        expect(command).toBeTruthy();
    });

    it('should render command container with data-slot', () => {
        const el = fixture.debugElement.query(By.css('[data-slot="command"]'));
        expect(el).toBeTruthy();
    });

    it('should render command input', () => {
        const el = fixture.debugElement.query(By.css('[data-slot="command-input"]'));
        expect(el).toBeTruthy();
    });

    it('should render command list', () => {
        const el = fixture.debugElement.query(By.css('[data-slot="command-list"]'));
        expect(el).toBeTruthy();
    });

    it('should render command items', () => {
        const items = fixture.debugElement.queryAll(By.directive(CommandItemComponent));
        expect(items).toHaveLength(3);
    });

    it('should render command groups', () => {
        const groups = fixture.debugElement.queryAll(By.directive(CommandGroupComponent));
        expect(groups).toHaveLength(2);
    });

    it('should render command separator', () => {
        const separator = fixture.debugElement.query(By.css('[data-slot="command-separator"]'));
        expect(separator).toBeTruthy();
    });

    it('should render command shortcut', () => {
        const shortcut = fixture.debugElement.query(By.css('[data-slot="command-shortcut"]'));
        expect(shortcut).toBeTruthy();
        expect(shortcut.nativeElement.textContent.trim()).toBe('Ctrl+C');
    });

    it('should have input with correct placeholder', () => {
        const input = fixture.debugElement.query(By.css('input'));
        expect(input.nativeElement.placeholder).toBe('Type a command...');
    });

    // --- Filtering tests ---

    describe('filtering', () => {
        it('should show all items when search is empty', () => {
            const itemDivs = fixture.nativeElement.querySelectorAll('[data-slot="command-item"]');
            const hiddenItems = Array.from(itemDivs).filter((el: any) => el.classList.contains('hidden'));
            expect(hiddenItems).toHaveLength(0);
        });

        it('should filter items based on search input', () => {
            const input = fixture.nativeElement.querySelector('input');
            input.value = 'cal';
            input.dispatchEvent(new Event('input'));
            fixture.detectChanges();

            const itemDivs = fixture.nativeElement.querySelectorAll('[data-slot="command-item"]');
            const visibleItems = Array.from(itemDivs).filter((el: any) => !el.classList.contains('hidden'));
            const hiddenItems = Array.from(itemDivs).filter((el: any) => el.classList.contains('hidden'));

            expect(visibleItems).toHaveLength(1);
            expect(hiddenItems).toHaveLength(2);
            expect((visibleItems[0] as HTMLElement).textContent).toContain('Calendar');
        });

        it('should filter items case-insensitively', () => {
            const input = fixture.nativeElement.querySelector('input');
            input.value = 'CAL';
            input.dispatchEvent(new Event('input'));
            fixture.detectChanges();

            const itemDivs = fixture.nativeElement.querySelectorAll('[data-slot="command-item"]');
            const visibleItems = Array.from(itemDivs).filter((el: any) => !el.classList.contains('hidden'));

            expect(visibleItems).toHaveLength(1);
            expect((visibleItems[0] as HTMLElement).textContent).toContain('Calendar');
        });

        it('should show all items again when search is cleared', () => {
            const input = fixture.nativeElement.querySelector('input');

            input.value = 'cal';
            input.dispatchEvent(new Event('input'));
            fixture.detectChanges();

            input.value = '';
            input.dispatchEvent(new Event('input'));
            fixture.detectChanges();

            const itemDivs = fixture.nativeElement.querySelectorAll('[data-slot="command-item"]');
            const hiddenItems = Array.from(itemDivs).filter((el: any) => el.classList.contains('hidden'));
            expect(hiddenItems).toHaveLength(0);
        });

        it('should match partial text in item value', () => {
            const input = fixture.nativeElement.querySelector('input');
            input.value = 'pro';
            input.dispatchEvent(new Event('input'));
            fixture.detectChanges();

            const itemDivs = fixture.nativeElement.querySelectorAll('[data-slot="command-item"]');
            const visibleItems = Array.from(itemDivs).filter((el: any) => !el.classList.contains('hidden'));

            expect(visibleItems).toHaveLength(1);
            expect((visibleItems[0] as HTMLElement).textContent).toContain('Profile');
        });
    });

    // --- Keyboard navigation tests ---

    describe('keyboard navigation', () => {
        it('should activate the first item on ArrowDown', () => {
            const input = fixture.nativeElement.querySelector('input');
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
            fixture.detectChanges();

            const itemDivs = fixture.nativeElement.querySelectorAll('[data-slot="command-item"]');
            const activeItems = Array.from(itemDivs).filter((el: any) => el.classList.contains('bg-accent'));

            expect(activeItems).toHaveLength(1);
        });

        it('should move to the next item on repeated ArrowDown', () => {
            const input = fixture.nativeElement.querySelector('input');
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
            fixture.detectChanges();

            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
            fixture.detectChanges();

            const itemDivs = Array.from(fixture.nativeElement.querySelectorAll('[data-slot="command-item"]')) as HTMLElement[];
            const activeIndex = itemDivs.findIndex(el => el.classList.contains('bg-accent'));

            expect(activeIndex).toBe(1);
        });

        it('should move to the previous item on ArrowUp', () => {
            const input = fixture.nativeElement.querySelector('input');

            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
            fixture.detectChanges();
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
            fixture.detectChanges();
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
            fixture.detectChanges();

            const itemDivs = Array.from(fixture.nativeElement.querySelectorAll('[data-slot="command-item"]')) as HTMLElement[];
            const activeIndex = itemDivs.findIndex(el => el.classList.contains('bg-accent'));

            expect(activeIndex).toBe(0);
        });

        it('should wrap around from last to first on ArrowDown', () => {
            const input = fixture.nativeElement.querySelector('input');

            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
            fixture.detectChanges();
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
            fixture.detectChanges();
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
            fixture.detectChanges();
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
            fixture.detectChanges();

            const itemDivs = Array.from(fixture.nativeElement.querySelectorAll('[data-slot="command-item"]')) as HTMLElement[];
            const activeIndex = itemDivs.findIndex(el => el.classList.contains('bg-accent'));

            expect(activeIndex).toBe(0);
        });

        it('should wrap around from first to last on ArrowUp', () => {
            const input = fixture.nativeElement.querySelector('input');

            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
            fixture.detectChanges();
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
            fixture.detectChanges();

            const itemDivs = Array.from(fixture.nativeElement.querySelectorAll('[data-slot="command-item"]')) as HTMLElement[];
            const activeIndex = itemDivs.findIndex(el => el.classList.contains('bg-accent'));

            expect(activeIndex).toBe(2);
        });
    });

    // --- Enter selects active item ---

    describe('enter selects active item', () => {
        it('should emit select on the active item when Enter is pressed', () => {
            const host = fixture.componentInstance;
            const input = fixture.nativeElement.querySelector('input');

            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
            fixture.detectChanges();

            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
            fixture.detectChanges();

            expect(host.onCalendarSelect).toHaveBeenCalledWith('calendar');
        });

        it('should emit select for the second item after navigating to it', () => {
            const host = fixture.componentInstance;
            const input = fixture.nativeElement.querySelector('input');

            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
            fixture.detectChanges();
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
            fixture.detectChanges();

            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
            fixture.detectChanges();

            expect(host.onSearchSelect).toHaveBeenCalledWith('search');
        });

        it('should not emit select when no active item', () => {
            const host = fixture.componentInstance;
            const input = fixture.nativeElement.querySelector('input');

            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
            fixture.detectChanges();

            expect(host.onCalendarSelect).not.toHaveBeenCalled();
            expect(host.onSearchSelect).not.toHaveBeenCalled();
            expect(host.onProfileSelect).not.toHaveBeenCalled();
        });
    });

    // --- Empty state ---

    describe('empty state', () => {
        it('should not show empty state when items are visible', () => {
            const emptyEl = fixture.nativeElement.querySelector('[data-slot="command-empty"]');
            expect(emptyEl).toBeFalsy();
        });

        it('should show empty state when search matches nothing', () => {
            const input = fixture.nativeElement.querySelector('input');
            input.value = 'zzzzzzz';
            input.dispatchEvent(new Event('input'));
            fixture.detectChanges();

            const emptyEl = fixture.nativeElement.querySelector('[data-slot="command-empty"]');
            expect(emptyEl).toBeTruthy();
            expect(emptyEl.textContent.trim()).toBe('No results found.');
        });

        it('should hide empty state again when search is cleared', () => {
            const input = fixture.nativeElement.querySelector('input');

            input.value = 'zzzzzzz';
            input.dispatchEvent(new Event('input'));
            fixture.detectChanges();

            input.value = '';
            input.dispatchEvent(new Event('input'));
            fixture.detectChanges();

            const emptyEl = fixture.nativeElement.querySelector('[data-slot="command-empty"]');
            expect(emptyEl).toBeFalsy();
        });
    });

    // --- Group visibility ---

    describe('group visibility', () => {
        it('should hide a group when all its items are filtered out', () => {
            const input = fixture.nativeElement.querySelector('input');
            input.value = 'profile';
            input.dispatchEvent(new Event('input'));
            fixture.detectChanges();

            const groupDivs = fixture.nativeElement.querySelectorAll('[data-slot="command-group"]');
            const groupsArray = Array.from(groupDivs) as HTMLElement[];

            const suggestionsGroup = groupsArray.find(g => g.textContent?.includes('Suggestions'));
            const settingsGroup = groupsArray.find(g => g.textContent?.includes('Settings'));

            expect(suggestionsGroup?.classList.contains('hidden')).toBe(true);
            expect(settingsGroup?.classList.contains('hidden')).toBe(false);
        });

        it('should show all groups when search is empty', () => {
            const groupDivs = fixture.nativeElement.querySelectorAll('[data-slot="command-group"]');
            const hiddenGroups = Array.from(groupDivs).filter((el: any) => el.classList.contains('hidden'));
            expect(hiddenGroups).toHaveLength(0);
        });

        it('should hide Settings group when searching for an item only in Suggestions', () => {
            const input = fixture.nativeElement.querySelector('input');
            input.value = 'calendar';
            input.dispatchEvent(new Event('input'));
            fixture.detectChanges();

            const groupDivs = fixture.nativeElement.querySelectorAll('[data-slot="command-group"]');
            const groupsArray = Array.from(groupDivs) as HTMLElement[];

            const suggestionsGroup = groupsArray.find(g => g.textContent?.includes('Suggestions'));
            const settingsGroup = groupsArray.find(g => g.textContent?.includes('Settings'));

            expect(suggestionsGroup?.classList.contains('hidden')).toBe(false);
            expect(settingsGroup?.classList.contains('hidden')).toBe(true);
        });
    });

    // --- Item click emits select ---

    describe('item click', () => {
        it('should emit select when a command-item is clicked', () => {
            const host = fixture.componentInstance;

            const itemDivs = fixture.nativeElement.querySelectorAll('[data-slot="command-item"]');
            (itemDivs[0] as HTMLElement).click();
            fixture.detectChanges();

            expect(host.onCalendarSelect).toHaveBeenCalledWith('calendar');
        });

        it('should emit select for the correct item when clicking the third item', () => {
            const host = fixture.componentInstance;

            const itemDivs = fixture.nativeElement.querySelectorAll('[data-slot="command-item"]');
            (itemDivs[2] as HTMLElement).click();
            fixture.detectChanges();

            expect(host.onProfileSelect).toHaveBeenCalledWith('profile');
        });

        it('should emit select with correct value for the search item', () => {
            const host = fixture.componentInstance;

            const itemDivs = fixture.nativeElement.querySelectorAll('[data-slot="command-item"]');
            (itemDivs[1] as HTMLElement).click();
            fixture.detectChanges();

            expect(host.onSearchSelect).toHaveBeenCalledWith('search');
        });
    });

    // --- Filtering + navigation interaction ---

    describe('filtering and navigation interaction', () => {
        it('should navigate only through filtered items after searching', () => {
            const host = fixture.componentInstance;
            const input = fixture.nativeElement.querySelector('input');

            input.value = 'se';
            input.dispatchEvent(new Event('input'));
            fixture.detectChanges();

            const visibleItems = Array.from(
                fixture.nativeElement.querySelectorAll('[data-slot="command-item"]')
            ).filter((el: any) => !el.classList.contains('hidden')) as HTMLElement[];
            expect(visibleItems).toHaveLength(1);

            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
            fixture.detectChanges();

            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
            fixture.detectChanges();

            expect(host.onSearchSelect).toHaveBeenCalledWith('search');
        });

        it('should auto-set active item to the first filtered result on input', () => {
            const input = fixture.nativeElement.querySelector('input');

            input.value = 'profile';
            input.dispatchEvent(new Event('input'));
            fixture.detectChanges();

            const itemDivs = Array.from(
                fixture.nativeElement.querySelectorAll('[data-slot="command-item"]')
            ).filter((el: any) => !el.classList.contains('hidden')) as HTMLElement[];

            expect(itemDivs).toHaveLength(1);
            expect(itemDivs[0].classList.contains('bg-accent')).toBe(true);
        });
    });
});

describe('CommandInputComponent — i18n integration', () => {
    @Component({
        template: `<ui-command><ui-command-input [locale]="locale"></ui-command-input></ui-command>`,
        imports: [CommandComponent, CommandInputComponent],
    })
    class CommandI18nHost {
        locale: string | undefined = undefined;
    }

    async function setup(locale?: string, providerLocale?: string) {
        const { provideUiLocale } = await import('../../lib/i18n');
        await TestBed.configureTestingModule({
            imports: [CommandI18nHost],
            providers: providerLocale ? [provideUiLocale(providerLocale)] : [],
        }).compileComponents();
        const fixture = TestBed.createComponent(CommandI18nHost);
        if (locale) fixture.componentInstance.locale = locale;
        fixture.detectChanges();
        return fixture;
    }

    it('defaults placeholder + aria-label to English', async () => {
        const fixture = await setup();
        const input = fixture.nativeElement.querySelector('input');
        expect(input.getAttribute('placeholder')).toBe('Search...');
        expect(input.getAttribute('aria-label')).toBe('Search');
    });

    it('localises placeholder + aria-label when locale="he"', async () => {
        const fixture = await setup('he');
        const input = fixture.nativeElement.querySelector('input');
        expect(input.getAttribute('placeholder')).toBe('...חיפוש');
        expect(input.getAttribute('aria-label')).toBe('חיפוש');
    });

    it('falls back to UI_LOCALE_ID when no locale input is set', async () => {
        const fixture = await setup(undefined, 'fr');
        const input = fixture.nativeElement.querySelector('input');
        expect(input.getAttribute('placeholder')).toBe('Rechercher...');
    });
});

describe('CommandComponent service-driven behaviour', () => {
    @Component({
        template: `
            <ui-command>
                <ui-command-input />
                <ui-command-list>
                    <ui-command-item value="calendar" (selectItem)="sel($event)">Calendar</ui-command-item>
                    <ui-command-item value="profile" (selectItem)="sel($event)">Profile</ui-command-item>
                </ui-command-list>
            </ui-command>
        `,
        imports: [CommandComponent, CommandInputComponent, CommandListComponent, CommandItemComponent],
    })
    class DrivenHost {
        sel = vi.fn();
    }

    let fixture: ComponentFixture<DrivenHost>;
    let service: CommandService;
    let command: CommandComponent;
    let itemIds: string[];

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [DrivenHost] }).compileComponents();
        fixture = TestBed.createComponent(DrivenHost);
        fixture.detectChanges();
        const commandDe = fixture.debugElement.query(By.directive(CommandComponent));
        service = commandDe.injector.get(CommandService);
        command = commandDe.componentInstance as CommandComponent;
        itemIds = fixture.debugElement
            .queryAll(By.directive(CommandItemComponent))
            .map(de => (de.componentInstance as CommandItemComponent).id);
    });

    it('resets a filtered-out active item to the first remaining match', () => {
        service.activeItemId.set(itemIds[0]);
        service.search.set('profile');
        fixture.detectChanges();

        expect(service.activeItemId()).toBe(itemIds[1]);
    });

    it('delegates moveNext/movePrev/selectActive to the service', () => {
        command.moveNext();
        fixture.detectChanges();
        expect(service.activeItemId()).toBe(itemIds[0]);

        command.moveNext();
        fixture.detectChanges();
        expect(service.activeItemId()).toBe(itemIds[1]);

        command.movePrev();
        fixture.detectChanges();
        expect(service.activeItemId()).toBe(itemIds[0]);

        command.selectActive();
        expect(fixture.componentInstance.sel).toHaveBeenCalledWith('calendar');
    });

    it('ignores moveNext/movePrev when no items are visible', () => {
        service.search.set('zzz-no-match');
        fixture.detectChanges();
        expect(service.filteredItems()).toHaveLength(0);

        service.activeItemId.set(null);
        command.moveNext();
        command.movePrev();
        expect(service.activeItemId()).toBeNull();
    });

    it('does not select an active item that is no longer visible', () => {
        service.search.set('zzz-no-match');
        fixture.detectChanges();

        service.activeItemId.set(itemIds[0]);
        command.selectActive();
        expect(fixture.componentInstance.sel).not.toHaveBeenCalled();
    });
});

describe('CommandComponent construction inputs', () => {
    @Component({
        template: `
            <ui-command [shouldFilter]="shouldFilter" [search]="search">
                <ui-command-list>
                    <ui-command-item value="calendar">Calendar</ui-command-item>
                    <ui-command-item value="profile">Profile</ui-command-item>
                </ui-command-list>
            </ui-command>
        `,
        imports: [CommandComponent, CommandListComponent, CommandItemComponent],
    })
    class ConfiguredHost {
        shouldFilter = true;
        search: string | null = null;
    }

    function build(configure: (host: ConfiguredHost) => void): CommandService {
        TestBed.configureTestingModule({ imports: [ConfiguredHost] });
        const fixture = TestBed.createComponent(ConfiguredHost);
        configure(fixture.componentInstance);
        fixture.detectChanges();
        return fixture.debugElement.query(By.directive(CommandComponent)).injector.get(CommandService);
    }

    it('mirrors a non-null search input into the service', () => {
        const service = build(host => { host.search = 'calendar'; });
        expect(service.search()).toBe('calendar');
        expect(service.filteredItems()).toHaveLength(1);
    });

    it('returns every registered item when shouldFilter is false', () => {
        const service = build(host => {
            host.shouldFilter = false;
            host.search = 'zzz-no-match';
        });
        expect(service.filteredItems()).toHaveLength(2);
    });
});

describe('CommandInputComponent — focus', () => {
    @Component({
        template: `<ui-command><ui-command-input /></ui-command>`,
        imports: [CommandComponent, CommandInputComponent],
    })
    class FocusHost { }

    it('focuses the native input when focus() is called', () => {
        TestBed.configureTestingModule({ imports: [FocusHost] });
        const fixture = TestBed.createComponent(FocusHost);
        fixture.detectChanges();

        const inputDe = fixture.debugElement.query(By.directive(CommandInputComponent));
        const inputCmp = inputDe.componentInstance as CommandInputComponent;
        const nativeInput = fixture.nativeElement.querySelector('input') as HTMLInputElement;
        const focusSpy = vi.spyOn(nativeInput, 'focus');

        inputCmp.focus();
        expect(focusSpy).toHaveBeenCalled();
    });

    it('seeds the service search from a non-empty value input on init', () => {
        @Component({
            template: `<ui-command><ui-command-input value="hello" /></ui-command>`,
            imports: [CommandComponent, CommandInputComponent],
        })
        class SeededHost { }

        TestBed.configureTestingModule({ imports: [SeededHost] });
        const fixture = TestBed.createComponent(SeededHost);
        fixture.detectChanges();

        const commandDe = fixture.debugElement.query(By.directive(CommandComponent));
        const service = commandDe.injector.get(CommandService);
        expect(service.search()).toBe('hello');
    });
});

describe('command exported helpers', () => {
    it('exposes the default Mod+K toggle shortcut definition', () => {
        const def = COMMAND_DIALOG_SHORTCUT_DEFINITIONS[0];
        expect(def.actionId).toBe('command-dialog.toggle');
        expect(def.defaultShortcut).toBe('Mod+K');
        expect(def.scope).toBe('global');
    });

    it('generateId returns distinct alphanumeric ids', () => {
        const a = generateId();
        const b = generateId();
        expect(a).not.toBe(b);
        expect(a).toMatch(/^[a-z\d]+$/);
    });
});

describe('CommandDialogComponent', () => {
    @Component({
        template: `
            <ui-command-dialog
                [(open)]="open"
                [shortcut]="shortcut"
                [shortcutEnabled]="enabled"
                [shortcutActionId]="actionId"
            >
                <ui-command-input />
                <ui-command-list>
                    <ui-command-item value="alpha">Alpha</ui-command-item>
                </ui-command-list>
            </ui-command-dialog>
        `,
        imports: [CommandDialogComponent, CommandInputComponent, CommandListComponent, CommandItemComponent],
    })
    class DialogHost {
        open = false;
        shortcut = 'Mod+K';
        enabled = true;
        actionId = 'command-dialog.toggle';
    }

    function createDialog(): ComponentFixture<DialogHost> {
        TestBed.configureTestingModule({ imports: [DialogHost] });
        const fixture = TestBed.createComponent(DialogHost);
        fixture.detectChanges();
        return fixture;
    }

    it('toggles open when the registered shortcut is dispatched', () => {
        const fixture = createDialog();
        const shortcuts = TestBed.inject(ShortcutBindingService);

        const handled = shortcuts.dispatch(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
        fixture.detectChanges();

        expect(handled).toBe(true);
        expect(fixture.componentInstance.open).toBe(true);
    });

    it('focuses the command input shortly after opening', () => {
        vi.useFakeTimers();
        const fixture = createDialog();
        const shortcuts = TestBed.inject(ShortcutBindingService);

        shortcuts.dispatch(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
        fixture.detectChanges();

        const inputDe = fixture.debugElement.query(By.directive(CommandInputComponent));
        const inputCmp = inputDe.componentInstance as CommandInputComponent;
        const focusSpy = vi.spyOn(inputCmp, 'focus');

        vi.advanceTimersByTime(0);

        expect(fixture.componentInstance.open).toBe(true);
        expect(focusSpy).toHaveBeenCalled();

        fixture.destroy();
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    it('does not register the shortcut when disabled', () => {
        TestBed.configureTestingModule({ imports: [DialogHost] });
        const fixture = TestBed.createComponent(DialogHost);
        fixture.componentInstance.enabled = false;
        fixture.detectChanges();

        const shortcuts = TestBed.inject(ShortcutBindingService);
        const handled = shortcuts.dispatch(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));

        expect(handled).toBe(false);
        expect(fixture.componentInstance.open).toBe(false);
    });

    it('does not register the shortcut when the shortcut string is blank', () => {
        TestBed.configureTestingModule({ imports: [DialogHost] });
        const fixture = TestBed.createComponent(DialogHost);
        fixture.componentInstance.shortcut = '   ';
        fixture.detectChanges();

        const shortcuts = TestBed.inject(ShortcutBindingService);
        const handled = shortcuts.dispatch(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));

        expect(handled).toBe(false);
    });

    it('unregisters the shortcut on destroy', () => {
        const fixture = createDialog();
        const shortcuts = TestBed.inject(ShortcutBindingService);

        fixture.destroy();

        const handled = shortcuts.dispatch(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
        expect(handled).toBe(false);
    });
});
