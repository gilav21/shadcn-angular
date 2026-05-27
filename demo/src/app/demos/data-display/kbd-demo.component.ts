import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { KbdComponent } from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { KBD_DEMO_LOCALES } from './kbd-demo.locales';

@Component({
  selector: 'app-kbd-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [KbdComponent],
  template: `
    <section class="space-y-4">
      <h2 id="kbd" class="text-2xl font-semibold scroll-m-20">{{ t().title }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="flex flex-col gap-4">
        <div class="flex items-center gap-2">
          <span>{{ t().pressPrefix }}</span>
          <ui-kbd>Ctrl</ui-kbd>
          <span>+</span>
          <ui-kbd>K</ui-kbd>
          <span>{{ t().toSearch }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span>{{ t().pressPrefix }}</span>
          <ui-kbd>&#8984;</ui-kbd>
          <ui-kbd>&#8679;</ui-kbd>
          <ui-kbd>P</ui-kbd>
          <span>{{ t().toOpenCommandPalette }}</span>
        </div>
      </div>
    </section>
  `,
})
export class KbdDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(() => KBD_DEMO_LOCALES[this.localeId()] ?? KBD_DEMO_LOCALES['en']);
}
