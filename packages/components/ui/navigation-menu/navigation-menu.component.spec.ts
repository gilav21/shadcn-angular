import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
    NavigationMenuComponent,
    NavigationMenuListComponent,
    NavigationMenuItemComponent,
    NavigationMenuTriggerComponent,
    NavigationMenuContentComponent,
    NavigationMenuLinkComponent,
    NavigationMenuIndicatorComponent,
    NavigationMenuService,
    NavigationMenuItem,
} from './index';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type MatchMediaFn = (query: string) => MediaQueryList;

/**
 * Install a save/restore matchMedia stub. `coarse` drives whether the
 * `(pointer: coarse)` query reports a touch device, letting tests flip the
 * touch/mouse code paths in NavigationMenuItemComponent deterministically.
 */
function installMatchMedia(coarse: () => boolean): MatchMediaFn | undefined {
    const original = globalThis.window.matchMedia as MatchMediaFn | undefined;
    globalThis.window.matchMedia = ((query: string) => ({
        matches: query.includes('coarse') ? coarse() : false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
    })) as unknown as MatchMediaFn;
    return original;
}

function restoreMatchMedia(original: MatchMediaFn | undefined): void {
    if (original) {
        globalThis.window.matchMedia = original;
    } else {
        delete (globalThis.window as unknown as { matchMedia?: MatchMediaFn }).matchMedia;
    }
}

@Component({
    template: `
        <ui-navigation-menu [class]="menuClass()">
            <ui-navigation-menu-list>
                <ui-navigation-menu-item>
                    <ui-navigation-menu-trigger>Getting Started</ui-navigation-menu-trigger>
                    <ui-navigation-menu-content>
                        <ui-navigation-menu-link href="/docs" [active]="true">
                            <div class="font-medium">Documentation</div>
                        </ui-navigation-menu-link>
                        <ui-navigation-menu-link href="/docs/components">
                            <div class="font-medium">Components</div>
                        </ui-navigation-menu-link>
                    </ui-navigation-menu-content>
                </ui-navigation-menu-item>
                <ui-navigation-menu-item>
                    <ui-navigation-menu-trigger>Resources</ui-navigation-menu-trigger>
                    <ui-navigation-menu-content>
                        <ui-navigation-menu-link href="/blog">Blog</ui-navigation-menu-link>
                    </ui-navigation-menu-content>
                </ui-navigation-menu-item>
            </ui-navigation-menu-list>
            <ui-navigation-menu-indicator />
        </ui-navigation-menu>
    `,
    imports: [
        NavigationMenuComponent,
        NavigationMenuListComponent,
        NavigationMenuItemComponent,
        NavigationMenuTriggerComponent,
        NavigationMenuContentComponent,
        NavigationMenuLinkComponent,
        NavigationMenuIndicatorComponent,
    ],
})
class TestHostComponent {
    menuClass = signal('');
}

describe('NavigationMenuComponent', () => {
    let component: NavigationMenuComponent;
    let fixture: ComponentFixture<NavigationMenuComponent>;
    let originalMatchMedia: MatchMediaFn | undefined;

    beforeEach(async () => {
        originalMatchMedia = installMatchMedia(() => false);
        await TestBed.configureTestingModule({
            imports: [NavigationMenuComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(NavigationMenuComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        fixture.destroy();
        restoreMatchMedia(originalMatchMedia);
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should render nav with role and data-slot', () => {
        const nav = fixture.nativeElement.querySelector('[data-slot="navigation-menu"]');
        expect(nav.getAttribute('role')).toBe('navigation');
    });

    it('should default to custom content mode when no items and no list', () => {
        expect(component.hasCustomContent()).toBe(true);
    });

    it('should apply the class input to the nav element', () => {
        fixture.componentRef.setInput('class', 'my-custom-nav');
        fixture.detectChanges();
        const nav = fixture.nativeElement.querySelector('[data-slot="navigation-menu"]');
        expect(nav.getAttribute('class')).toContain('my-custom-nav');
    });
});

describe('NavigationMenu Integration', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let originalMatchMedia: MatchMediaFn | undefined;

    beforeEach(async () => {
        originalMatchMedia = installMatchMedia(() => false);
        await TestBed.configureTestingModule({
            imports: [TestHostComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();
    });

    afterEach(() => {
        fixture.destroy();
        restoreMatchMedia(originalMatchMedia);
    });

    it('should render list, items, triggers and indicator', () => {
        expect(fixture.debugElement.query(By.css('[data-slot="navigation-menu-list"]'))).toBeTruthy();
        expect(fixture.debugElement.query(By.css('[role="menubar"]'))).toBeTruthy();
        expect(fixture.debugElement.queryAll(By.css('[data-slot="navigation-menu-item"]'))).toHaveLength(2);
        expect(fixture.debugElement.queryAll(By.css('[data-slot="navigation-menu-trigger"]'))).toHaveLength(2);
        expect(fixture.debugElement.query(By.css('[data-slot="navigation-menu-indicator"]'))).toBeTruthy();
    });

    it('should start closed with aria-expanded false and no content', () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="navigation-menu-trigger"]'));
        expect(trigger.nativeElement.getAttribute('aria-expanded')).toBe('false');
        expect(trigger.nativeElement.getAttribute('data-state')).toBe('closed');
        expect(fixture.debugElement.query(By.css('[data-slot="navigation-menu-content"]'))).toBeNull();
    });

    it('should open on trigger click and expose menu content', () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="navigation-menu-trigger"]'));
        trigger.nativeElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        fixture.detectChanges();

        const content = fixture.debugElement.query(By.css('[data-slot="navigation-menu-content"]'));
        expect(content).toBeTruthy();
        expect(content.nativeElement.getAttribute('role')).toBe('menu');
        expect(content.nativeElement.getAttribute('data-state')).toBe('open');
        expect(trigger.nativeElement.getAttribute('aria-expanded')).toBe('true');
        expect(trigger.nativeElement.getAttribute('aria-haspopup')).toBe('menu');
    });

    it('should close on a second trigger click', () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="navigation-menu-trigger"]'));
        trigger.nativeElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        fixture.detectChanges();
        trigger.nativeElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        fixture.detectChanges();

        const itemComp = fixture.debugElement.query(By.directive(NavigationMenuItemComponent));
        expect(itemComp.componentInstance.isOpen()).toBe(false);
    });

    it('should render child links and marks active link', () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="navigation-menu-trigger"]'));
        trigger.nativeElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        fixture.detectChanges();

        const links = fixture.debugElement.queryAll(By.css('[data-slot="navigation-menu-link"]'));
        expect(links).toHaveLength(2);
        expect(links[0].nativeElement.getAttribute('href')).toBe('/docs');
        expect(links[0].nativeElement.getAttribute('role')).toBe('menuitem');
        expect(links[0].nativeElement.getAttribute('class')).toContain('bg-accent/50');
        expect(links[1].nativeElement.getAttribute('class')).not.toContain('bg-accent/50');
    });

    it('should open on mouse enter and switch items on hovering another', () => {
        const items = fixture.debugElement.queryAll(By.directive(NavigationMenuItemComponent));
        const first = items[0].query(By.css('[data-slot="navigation-menu-item"]'));
        const second = items[1].query(By.css('[data-slot="navigation-menu-item"]'));

        first.nativeElement.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        fixture.detectChanges();
        expect(items[0].componentInstance.isOpen()).toBe(true);

        second.nativeElement.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        fixture.detectChanges();
        expect(items[1].componentInstance.isOpen()).toBe(true);
        expect(items[0].componentInstance.isOpen()).toBe(false);
    });

    it('should close when clicking outside the menu', () => {
        const item = fixture.debugElement.query(By.directive(NavigationMenuItemComponent));
        item.componentInstance.open();
        fixture.detectChanges();
        expect(item.componentInstance.isOpen()).toBe(true);

        document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        fixture.detectChanges();
        expect(item.componentInstance.isOpen()).toBe(false);
    });

    it('should not close when clicking inside the menu', () => {
        const item = fixture.debugElement.query(By.directive(NavigationMenuItemComponent));
        item.componentInstance.open();
        fixture.detectChanges();

        const trigger = fixture.debugElement.query(By.css('[data-slot="navigation-menu-trigger"]'));
        trigger.nativeElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        fixture.detectChanges();
        // Trigger toggle closed it; re-open then click inside a non-toggle element.
        item.componentInstance.open();
        fixture.detectChanges();

        const list = fixture.debugElement.query(By.css('[data-slot="navigation-menu-list"]'));
        list.nativeElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        fixture.detectChanges();
        expect(item.componentInstance.isOpen()).toBe(true);
    });

    it('should ignore outside click when nothing is active', () => {
        const menu = fixture.debugElement.query(By.directive(NavigationMenuComponent));
        document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        fixture.detectChanges();
        expect(menu.componentInstance.service.activeItem()).toBeNull();
    });
});

describe('NavigationMenu Hover Delay Timers', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let originalMatchMedia: MatchMediaFn | undefined;

    beforeEach(async () => {
        vi.useFakeTimers();
        originalMatchMedia = installMatchMedia(() => false);
        await TestBed.configureTestingModule({
            imports: [TestHostComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();
    });

    afterEach(() => {
        fixture.destroy();
        vi.clearAllTimers();
        vi.useRealTimers();
        restoreMatchMedia(originalMatchMedia);
    });

    it('should keep the menu open immediately after mouse leave (delayed close)', () => {
        const item = fixture.debugElement.query(By.directive(NavigationMenuItemComponent));
        item.componentInstance.open();
        fixture.detectChanges();

        item.componentInstance.onMouseLeave();
        expect(item.componentInstance.isOpen()).toBe(true);
    });

    it('should close after the 150ms hover delay expires', () => {
        const item = fixture.debugElement.query(By.directive(NavigationMenuItemComponent));
        item.componentInstance.open();
        fixture.detectChanges();

        item.componentInstance.onMouseLeave();
        vi.advanceTimersByTime(150);
        fixture.detectChanges();
        expect(item.componentInstance.isOpen()).toBe(false);
    });

    it('should cancel the scheduled close on mouse re-enter', () => {
        const item = fixture.debugElement.query(By.directive(NavigationMenuItemComponent));
        item.componentInstance.open();
        fixture.detectChanges();

        item.componentInstance.onMouseLeave();
        item.componentInstance.onMouseEnter();
        vi.advanceTimersByTime(300);
        fixture.detectChanges();
        expect(item.componentInstance.isOpen()).toBe(true);
    });
});

describe('NavigationMenu Touch Behavior', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let originalMatchMedia: MatchMediaFn | undefined;
    let coarse = false;

    beforeEach(async () => {
        coarse = true;
        originalMatchMedia = installMatchMedia(() => coarse);
        await TestBed.configureTestingModule({
            imports: [TestHostComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();
    });

    afterEach(() => {
        fixture.destroy();
        restoreMatchMedia(originalMatchMedia);
    });

    it('should ignore hover enter/leave on touch devices', () => {
        const item = fixture.debugElement.query(By.directive(NavigationMenuItemComponent));
        item.componentInstance.onMouseEnter();
        expect(item.componentInstance.isOpen()).toBe(false);

        item.componentInstance.open();
        fixture.detectChanges();
        item.componentInstance.onMouseLeave();
        expect(item.componentInstance.isOpen()).toBe(true);
    });

    it('should still toggle open via trigger tap on touch devices', () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="navigation-menu-trigger"]'));
        trigger.nativeElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        fixture.detectChanges();
        const item = fixture.debugElement.query(By.directive(NavigationMenuItemComponent));
        expect(item.componentInstance.isOpen()).toBe(true);
    });
});

describe('NavigationMenuService', () => {
    let service: NavigationMenuService;

    beforeEach(() => {
        vi.useFakeTimers();
        service = new NavigationMenuService();
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    it('should report the active item via isActive', () => {
        service.setActive('a');
        expect(service.isActive('a')).toBe(true);
        expect(service.isActive('b')).toBe(false);
    });

    it('should clear the active item on setActive(null)', () => {
        service.setActive('a');
        service.setActive(null);
        expect(service.activeItem()).toBeNull();
    });

    it('should close after scheduleClose delay and be cancellable', () => {
        service.setActive('a');
        service.scheduleClose();
        service.cancelClose();
        vi.advanceTimersByTime(150);
        expect(service.activeItem()).toBe('a');

        service.scheduleClose();
        vi.advanceTimersByTime(150);
        expect(service.activeItem()).toBeNull();
    });
});

@Component({
    template: `<ui-navigation-menu [items]="items()" />`,
    imports: [NavigationMenuComponent],
})
class SimpleTestHostComponent {
    items = signal<NavigationMenuItem[]>([
        {
            label: 'Getting Started',
            children: [
                { title: 'Documentation', description: 'Learn the basics', href: '/docs' },
                { title: 'Components', description: 'Explore components', href: '/docs/components' },
            ],
        },
        {
            label: 'Resources',
            children: [{ title: 'Blog', href: '/blog' }],
        },
        { label: 'About', href: '/about' },
    ]);
}

describe('NavigationMenu Simple Mode', () => {
    let fixture: ComponentFixture<SimpleTestHostComponent>;
    let originalMatchMedia: MatchMediaFn | undefined;

    beforeEach(async () => {
        originalMatchMedia = installMatchMedia(() => false);
        await TestBed.configureTestingModule({
            imports: [SimpleTestHostComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(SimpleTestHostComponent);
        fixture.detectChanges();
    });

    afterEach(() => {
        fixture.destroy();
        restoreMatchMedia(originalMatchMedia);
    });

    it('should render list, items and triggers from the items input', () => {
        expect(fixture.debugElement.query(By.css('[data-slot="navigation-menu-list"]'))).toBeTruthy();
        expect(fixture.debugElement.queryAll(By.css('[data-slot="navigation-menu-item"]'))).toHaveLength(3);
        const triggers = fixture.debugElement.queryAll(By.css('[data-slot="navigation-menu-trigger"]'));
        expect(triggers).toHaveLength(2);
        expect(triggers[0].nativeElement.textContent).toContain('Getting Started');
        expect(triggers[1].nativeElement.textContent).toContain('Resources');
    });

    it('should render a plain link for items without children', () => {
        const links = fixture.debugElement.queryAll(By.css('[data-slot="navigation-menu-link"]'));
        const aboutLink = links.find((l) => l.nativeElement.textContent.includes('About'));
        expect(aboutLink!.nativeElement.getAttribute('href')).toBe('/about');
    });

    it('should open a dropdown and render child titles and descriptions', () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="navigation-menu-trigger"]'));
        trigger.nativeElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        fixture.detectChanges();

        const content = fixture.debugElement.query(By.css('[data-slot="navigation-menu-content"]'));
        const links = content.queryAll(By.css('[data-slot="navigation-menu-link"]'));
        expect(links).toHaveLength(2);
        expect(links[0].nativeElement.getAttribute('href')).toBe('/docs');
        expect(content.nativeElement.textContent).toContain('Documentation');
        expect(content.nativeElement.textContent).toContain('Learn the basics');
    });

    it('should render a child without description when none is provided', () => {
        const triggers = fixture.debugElement.queryAll(By.css('[data-slot="navigation-menu-trigger"]'));
        triggers[1].nativeElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        fixture.detectChanges();

        const content = fixture.debugElement.query(By.css('[data-slot="navigation-menu-content"]'));
        expect(content.nativeElement.textContent).toContain('Blog');
        expect(content.queryAll(By.css('p'))).toHaveLength(0);
    });

    it('should fall back to custom mode when content is projected', () => {
        @Component({
            template: `
                <ui-navigation-menu [items]="items()">
                    <ui-navigation-menu-list>
                        <ui-navigation-menu-item>
                            <ui-navigation-menu-link href="/custom">
                                <span>Custom Link</span>
                            </ui-navigation-menu-link>
                        </ui-navigation-menu-item>
                    </ui-navigation-menu-list>
                </ui-navigation-menu>
            `,
            imports: [
                NavigationMenuComponent,
                NavigationMenuListComponent,
                NavigationMenuItemComponent,
                NavigationMenuLinkComponent,
            ],
        })
        class MixedTestHostComponent {
            items = signal<NavigationMenuItem[]>([{ label: 'Ignored', href: '/ignored' }]);
        }

        const mixedFixture = TestBed.createComponent(MixedTestHostComponent);
        mixedFixture.detectChanges();

        const links = mixedFixture.debugElement.queryAll(By.css('[data-slot="navigation-menu-link"]'));
        expect(links).toHaveLength(1);
        expect(links[0].nativeElement.getAttribute('href')).toBe('/custom');
        mixedFixture.destroy();
    });
});
