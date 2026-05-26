// demo/src/app/demos/patterns/kanban-demo.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { KanbanDemoComponent } from './kanban-demo.component';
import { KANBAN_DEMO_LOCALES } from './kanban-demo.locales';

describe('KanbanDemoComponent', () => {
  it('renders English title and a sample card under default locale', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(KanbanDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(KANBAN_DEMO_LOCALES['en'].title);
    expect(fixture.nativeElement.textContent).toContain('Research competitors');
  });

  it('renders Hebrew title and a Hebrew sample card under provideUiLocale("he")', () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideUiLocale('he')],
    });
    const fixture = TestBed.createComponent(KanbanDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(KANBAN_DEMO_LOCALES['he'].title);
    expect(fixture.nativeElement.textContent).toContain('מחקר מתחרים');
  });
});
