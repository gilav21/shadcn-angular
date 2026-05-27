// demo/src/app/demos/introduction.component.ts
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { UI_LOCALE_ID } from '../../../../packages/components/lib/i18n';
import { INTRODUCTION_LOCALES } from './introduction.locales';

@Component({
  selector: 'app-introduction',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center justify-center py-20 text-center">
      <h1 class="text-4xl font-bold mb-4">{{ t().heading }}</h1>
      <p class="text-muted-foreground text-lg max-w-md">{{ t().body }}</p>
    </div>
  `,
})
export class IntroductionComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(
    () => INTRODUCTION_LOCALES[this.localeId()] ?? INTRODUCTION_LOCALES['en'],
  );
}
