import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChipListComponent, LabelComponent } from '../../../../../packages/components/ui';

@Component({
  selector: 'app-chip-list-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JsonPipe, FormsModule, ChipListComponent, LabelComponent],
  template: `
    <section class="space-y-4">
      <h2 id="chip-list" class="text-2xl font-semibold scroll-m-20">Chip List</h2>
      <p class="text-muted-foreground">Input that converts text to chips.</p>

      <div class="grid gap-4 max-w-sm">
        <div class="space-y-2">
          <ui-label>Default (Outline)</ui-label>
          <ui-chip-list />
        </div>

        <div class="space-y-2">
          <ui-label>Underline</ui-label>
          <ui-chip-list variant="underline" />
        </div>

        <div class="space-y-2">
          <ui-label>Ghost</ui-label>
          <div class="rounded-lg border p-1">
            <ui-chip-list variant="ghost" />
          </div>
        </div>

        <div class="space-y-2">
          <ui-label>With Badge Variant (Secondary)</ui-label>
          <ui-chip-list badgeVariant="secondary" />
        </div>
      </div>
    </section>

    <section class="space-y-4">
      <h2 id="chip-list-secondary" class="text-2xl font-semibold scroll-m-20">Chip List</h2>
      <p class="text-muted-foreground">
        Input that converts text into chips. Type and press Enter to add.
      </p>

      <div class="space-y-6 max-w-md">
        <div class="space-y-2">
          <ui-label>Tags</ui-label>
          <ui-chip-list [(ngModel)]="chipListTags" placeholder="Add a tag..." />
          <p class="text-sm text-muted-foreground">Current: {{ chipListTags() | json }}</p>
        </div>

        <div class="grid gap-4">
          <div class="space-y-2">
            <ui-label>Underline variant</ui-label>
            <ui-chip-list [(ngModel)]="chipListTags" variant="underline" />
          </div>
          <div class="space-y-2">
            <ui-label>Outline variant</ui-label>
            <ui-chip-list [(ngModel)]="chipListTags" variant="outline" />
          </div>
        </div>

        <div class="space-y-2">
          <ui-label>Max 2 rows (scrollable)</ui-label>
          <ui-chip-list [(ngModel)]="chipListFruits" [maxRows]="2" variant="outline" placeholder="Add fruit..." />
        </div>

        <div class="space-y-2">
          <ui-label>Disabled</ui-label>
          <ui-chip-list [(ngModel)]="chipListTags" [disabled]="true" />
        </div>
      </div>
    </section>
  `,
})
export class ChipListDemoComponent {
  readonly chipListTags = signal<string[]>(['Angular', 'TypeScript', 'Signals']);
  readonly chipListFruits = signal<string[]>([
    'Apple',
    'Banana',
    'Cherry',
    'Date',
    'Elderberry',
    'Fig',
    'Grape',
  ]);
}
