import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AutocompleteComponent } from '../../../../../packages/components/ui';
import { Framework } from '../../demos/shared/types';

@Component({
  selector: 'app-autocomplete-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JsonPipe, FormsModule, AutocompleteComponent],
  template: `
    <section class="space-y-4">
      <h2 id="autocomplete" class="text-2xl font-semibold scroll-m-20">Autocomplete</h2>
      <p class="text-muted-foreground">
        A searchable select component with single and multiple selection modes.
      </p>

      <div class="grid gap-8 max-w-sm">
        <div class="space-y-2">
          <p class="text-sm font-medium">Single Selection</p>
          <ui-autocomplete [options]="frameworks()" [displayWith]="displayFn" placeholder="Select framework..."
            [(ngModel)]="selectedFramework" />
          <p class="text-sm text-muted-foreground">Selected: {{ selectedFramework() | json }}</p>
        </div>

        <div class="space-y-2">
          <p class="text-sm font-medium">Multiple Selection</p>
          <ui-autocomplete [options]="frameworks()" [displayWith]="displayFn" [multiple]="true"
            placeholder="Select frameworks..." [(ngModel)]="selectedFrameworks" />
          <p class="text-sm text-muted-foreground">Selected: {{ selectedFrameworks() | json }}</p>
        </div>

        <div class="space-y-2">
          <p class="text-sm font-medium">Disabled</p>
          <ui-autocomplete [options]="frameworks()" [displayWith]="displayFn" placeholder="Disabled..."
            [disabled]="true" />
        </div>
      </div>
    </section>
  `,
})
export class AutocompleteDemoComponent {
  readonly frameworks = signal<Framework[]>([
    { value: 'next.js', label: 'Next.js' },
    { value: 'sveltekit', label: 'SvelteKit' },
    { value: 'nuxt.js', label: 'Nuxt.js' },
    { value: 'remix', label: 'Remix' },
    { value: 'astro', label: 'Astro' },
    { value: 'angular', label: 'Angular' },
    { value: 'vue', label: 'Vue' },
    { value: 'react', label: 'React' },
  ]);

  readonly selectedFramework = signal<Framework | null>(null);
  readonly selectedFrameworks = signal<Framework[]>([this.frameworks()[0], this.frameworks()[5]]);

  displayFn(option: unknown): string {
    return (option as Framework)?.label || '';
  }
}
