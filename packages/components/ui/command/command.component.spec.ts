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
} from '../command';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { By } from '@angular/platform-browser';

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
