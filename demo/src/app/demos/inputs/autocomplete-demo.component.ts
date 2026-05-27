import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { AutocompleteComponent } from '../../../../../packages/components/ui';
import { Framework } from '../../demos/shared/types';
import { AUTOCOMPLETE_DEMO_LOCALES } from './autocomplete-demo.locales';

@Component({
  selector: 'app-autocomplete-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JsonPipe, FormsModule, AutocompleteComponent],
  template: `
    <section class="space-y-4">
      <h2 id="autocomplete" class="text-2xl font-semibold scroll-m-20">{{ t().title }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="grid gap-8 max-w-sm">
        <div class="space-y-2">
          <p class="text-sm font-medium">{{ t().sections.singleSelection }}</p>
          <ui-autocomplete [options]="frameworks" [displayWith]="displayFn" [placeholder]="t().placeholders.single"
            [(ngModel)]="selectedFramework" />
          <p class="text-sm text-muted-foreground">{{ t().selected }} {{ selectedFramework() | json }}</p>
        </div>

        <div class="space-y-2">
          <p class="text-sm font-medium">{{ t().sections.multipleSelection }}</p>
          <ui-autocomplete [options]="frameworks" [displayWith]="displayFn" [multiple]="true"
            [placeholder]="t().placeholders.multiple" [(ngModel)]="selectedFrameworks" />
          <p class="text-sm text-muted-foreground">{{ t().selected }} {{ selectedFrameworks() | json }}</p>
        </div>

        <div class="space-y-2">
          <p class="text-sm font-medium">{{ t().sections.disabled }}</p>
          <ui-autocomplete [options]="frameworks" [displayWith]="displayFn" [placeholder]="t().placeholders.disabled"
            [disabled]="true" />
        </div>
      </div>
    </section>
  `,
})
export class AutocompleteDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(() => AUTOCOMPLETE_DEMO_LOCALES[this.localeId()] ?? AUTOCOMPLETE_DEMO_LOCALES['en']);

  readonly frameworks: Framework[] = [
    { value: 'next.js', label: 'Next.js' },
    { value: 'sveltekit', label: 'SvelteKit' },
    { value: 'nuxt.js', label: 'Nuxt.js' },
    { value: 'remix', label: 'Remix' },
    { value: 'astro', label: 'Astro' },
    { value: 'angular', label: 'Angular' },
    { value: 'vue', label: 'Vue' },
    { value: 'react', label: 'React' },
  ];

  readonly selectedFramework = signal<Framework | null>(null);
  readonly selectedFrameworks = signal<Framework[]>([this.frameworks[0], this.frameworks[5]]);

  displayFn(option: unknown): string {
    return (option as Framework)?.label ?? '';
  }
}
