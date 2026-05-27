// demo/src/app/demos/overlay/context-menu-demo.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { ContextMenuDemoComponent } from './context-menu-demo.component';
import { CONTEXT_MENU_DEMO_LOCALES } from './context-menu-demo.locales';

describe('ContextMenuDemoComponent', () => {
  it('renders English title under default locale', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(ContextMenuDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(CONTEXT_MENU_DEMO_LOCALES['en'].title);
  });

  it('renders Hebrew title under provideUiLocale("he")', () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideUiLocale('he')],
    });
    const fixture = TestBed.createComponent(ContextMenuDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(CONTEXT_MENU_DEMO_LOCALES['he'].title);
    expect(fixture.nativeElement.textContent).not.toContain(CONTEXT_MENU_DEMO_LOCALES['en'].title);
  });
});
