// demo/src/app/demos/overlay/editor-in-dialog-demo.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { EditorInDialogDemoComponent } from './editor-in-dialog-demo.component';
import { EDITOR_IN_DIALOG_DEMO_LOCALES } from './editor-in-dialog-demo.locales';

describe('EditorInDialogDemoComponent', () => {
  it('renders English title under default locale', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(EditorInDialogDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(EDITOR_IN_DIALOG_DEMO_LOCALES['en'].title);
  });

  it('renders Hebrew title under provideUiLocale("he")', () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideUiLocale('he')],
    });
    const fixture = TestBed.createComponent(EditorInDialogDemoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(EDITOR_IN_DIALOG_DEMO_LOCALES['he'].title);
    expect(fixture.nativeElement.textContent).not.toContain(EDITOR_IN_DIALOG_DEMO_LOCALES['en'].title);
  });
});
