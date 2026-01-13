import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TabsComponent, TabsListComponent, TabsTriggerComponent, TabsContentComponent } from './tabs.component';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Test host component for integration tests
@Component({
    template: `
        <ui-tabs [defaultValue]="defaultValue()" (tabChange)="onTabChange($event)">
            <ui-tabs-list>
                <ui-tabs-trigger value="tab1">Tab 1</ui-tabs-trigger>
                <ui-tabs-trigger value="tab2">Tab 2</ui-tabs-trigger>
                <ui-tabs-trigger value="tab3">Tab 3</ui-tabs-trigger>
            </ui-tabs-list>
            <ui-tabs-content value="tab1">Content 1</ui-tabs-content>
            <ui-tabs-content value="tab2">Content 2</ui-tabs-content>
            <ui-tabs-content value="tab3">Content 3</ui-tabs-content>
        </ui-tabs>
    `,
    imports: [TabsComponent, TabsListComponent, TabsTriggerComponent, TabsContentComponent]
})
class TestHostComponent {
    defaultValue = signal('tab1');
    selectedTab = '';
    onTabChange(value: string) {
        this.selectedTab = value;
    }
}

// RTL Test host
@Component({
    template: `
        <div [dir]="dir()">
            <ui-tabs defaultValue="tab1">
                <ui-tabs-list>
                    <ui-tabs-trigger value="tab1">تبويب 1</ui-tabs-trigger>
                    <ui-tabs-trigger value="tab2">تبويب 2</ui-tabs-trigger>
                </ui-tabs-list>
                <ui-tabs-content value="tab1">محتوى 1</ui-tabs-content>
                <ui-tabs-content value="tab2">محتوى 2</ui-tabs-content>
            </ui-tabs>
        </div>
    `,
    imports: [TabsComponent, TabsListComponent, TabsTriggerComponent, TabsContentComponent]
})
class RTLTestHostComponent {
    dir = signal<'ltr' | 'rtl'>('ltr');
}

describe('TabsComponent', () => {
    let component: TabsComponent;
    let fixture: ComponentFixture<TabsComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TabsComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TabsComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have data-slot="tabs"', () => {
        const div = fixture.debugElement.query(By.css('[data-slot="tabs"]'));
        expect(div).toBeTruthy();
    });

    it('should apply w-full class', () => {
        const div = fixture.debugElement.query(By.css('div'));
        expect(div.nativeElement.className).toContain('w-full');
    });
});

describe('TabsListComponent', () => {
    let fixture: ComponentFixture<TabsListComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TabsListComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TabsListComponent);
        fixture.detectChanges();
    });

    it('should have data-slot="tabs-list"', () => {
        const div = fixture.debugElement.query(By.css('[data-slot="tabs-list"]'));
        expect(div).toBeTruthy();
    });

    it('should have role="tablist"', () => {
        const div = fixture.debugElement.query(By.css('[role="tablist"]'));
        expect(div).toBeTruthy();
    });

    it('should apply muted background', () => {
        const div = fixture.debugElement.query(By.css('div'));
        expect(div.nativeElement.className).toContain('bg-muted');
    });
});

describe('Tabs Integration', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let component: TestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should render tabs with triggers and content', () => {
        const triggers = fixture.debugElement.queryAll(By.css('[data-slot="tabs-trigger"]'));
        expect(triggers.length).toBe(3);
    });

    it('should show default tab content initially', () => {
        const content = fixture.debugElement.query(By.css('[data-slot="tabs-content"]'));
        expect(content).toBeTruthy();
        expect(content.nativeElement.textContent).toContain('Content 1');
    });

    it('should have active trigger marked', () => {
        const triggers = fixture.debugElement.queryAll(By.css('[data-slot="tabs-trigger"]'));
        expect(triggers[0].nativeElement.getAttribute('aria-selected')).toBe('true');
        expect(triggers[0].nativeElement.getAttribute('data-state')).toBe('active');
    });

    it('should switch tabs on trigger click', async () => {
        const triggers = fixture.debugElement.queryAll(By.css('[data-slot="tabs-trigger"]'));
        triggers[1].nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="tabs-content"]'));
        expect(content.nativeElement.textContent).toContain('Content 2');
    });

    it('should emit tabChange on tab switch', async () => {
        const triggers = fixture.debugElement.queryAll(By.css('[data-slot="tabs-trigger"]'));
        triggers[2].nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(component.selectedTab).toBe('tab3');
    });

    it('should update aria-selected on tab switch', async () => {
        const triggers = fixture.debugElement.queryAll(By.css('[data-slot="tabs-trigger"]'));
        triggers[1].nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(triggers[0].nativeElement.getAttribute('aria-selected')).toBe('false');
        expect(triggers[1].nativeElement.getAttribute('aria-selected')).toBe('true');
    });
});

describe('Tabs RTL Support', () => {
    let fixture: ComponentFixture<RTLTestHostComponent>;
    let component: RTLTestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RTLTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(RTLTestHostComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        document.documentElement.removeAttribute('dir');
    });

    it('should render in LTR mode', () => {
        const container = fixture.debugElement.query(By.css('[dir="ltr"]'));
        expect(container).toBeTruthy();
    });

    it('should render in RTL mode', async () => {
        component.dir.set('rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const container = fixture.debugElement.query(By.css('[dir="rtl"]'));
        expect(container).toBeTruthy();
    });

    it('should switch tabs in RTL mode', async () => {
        component.dir.set('rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const triggers = fixture.debugElement.queryAll(By.css('[data-slot="tabs-trigger"]'));
        triggers[1].nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="tabs-content"]'));
        expect(content.nativeElement.textContent).toContain('محتوى 2');
    });
});
