import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import {
  FieldMapperComponent,
  FieldMapperItemDirective,
  FieldMapperLinkLabelDirective,
  type FieldMapperItem,
  type FieldMapperLink,
  type FieldMapperLinkTone,
} from '../../../../../packages/components/ui/field-mapper';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { FIELD_MAPPER_DEMO_LOCALES } from './field-mapper-demo.locales';

interface Column extends FieldMapperItem {
  readonly samples: string;
}

const ORDERS: Column[] = [
  { id: 'customer_id', label: 'customer_id', samples: '1042, 1043, 977' },
  { id: 'region', label: 'region', samples: 'North, South, West' },
  { id: 'order_id', label: 'order_id', samples: '1, 2, 3' },
  { id: 'placed_at', label: 'placed_at', samples: '2026-09-30, 2026-10-01' },
  { id: 'total', label: 'total', samples: '19.90, 7.50, 120.00' },
];

const CUSTOMERS: Column[] = [
  { id: 'segment', label: 'segment', samples: 'Retail, Trade' },
  { id: 'id', label: 'id', samples: '1042, 977, 15' },
  { id: 'name', label: 'name', samples: 'Dana, יעל, Omar' },
  { id: 'area', label: 'area', samples: 'North, East' },
  { id: 'legacy_code', label: 'legacy_code', samples: 'A-1, B-7', disabled: true },
];

const COVERAGE: Record<string, number> = { 'customer_id>id': 94, 'region>area': 61, 'placed_at>name': 3 };

const FILE_COLUMNS: FieldMapperItem[] = ['E-mail', 'First name', 'Surname', 'Phone (mobile)', 'שם החברה'].map(label => ({ id: label, label }));
const CONTACT_FIELDS: FieldMapperItem[] = ['email', 'firstName', 'lastName', 'phone', 'company', 'notes'].map(label => ({ id: label, label }));

const WIDE_START: FieldMapperItem[] = Array.from({ length: 40 }, (_, i) => ({ id: `src_${i}`, label: `source_column_${String(i + 1).padStart(2, '0')}` }));
const WIDE_END: FieldMapperItem[] = Array.from({ length: 40 }, (_, i) => ({ id: `dst_${i}`, label: `target_field_${String(i + 1).padStart(2, '0')}` }));

@Component({
  selector: 'app-field-mapper-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JsonPipe, FieldMapperComponent, FieldMapperItemDirective, FieldMapperLinkLabelDirective],
  template: `
    <section class="max-w-4xl space-y-12">
      <div>
        <h2 id="field-mapper" class="scroll-m-20 text-2xl font-semibold">{{ t().title }}</h2>
        <p class="text-muted-foreground mt-1">{{ t().description }}</p>
      </div>

      <div class="space-y-3">
        <h3 class="text-lg font-medium">{{ t().importHeading }}</h3>
        <p class="text-muted-foreground text-sm">{{ t().importDescription }}</p>
        <ui-field-mapper
          [start]="orders"
          [end]="customers"
          [(links)]="matchLinks"
          [startHeading]="t().ordersHeading"
          [endHeading]="t().customersHeading"
          [linkTone]="coverageTone"
          (linkSelect)="selectedLink.set($event)"
        >
          <ng-template uiFieldMapperItem let-item>
            <span class="block truncate font-medium" dir="auto">{{ item.label }}</span>
            <span class="text-muted-foreground block truncate text-xs" dir="auto">{{ samplesOf(item) }}</span>
          </ng-template>
          <ng-template uiFieldMapperLinkLabel let-link>{{ coverageLabel(link) }}</ng-template>
        </ui-field-mapper>
        <p class="text-sm">
          <span class="text-muted-foreground">{{ t().selected }}</span>
          {{ selectedLink() ? selectedLink()!.startId + ' → ' + selectedLink()!.endId : t().nothingSelected }}
        </p>
        <pre class="bg-muted overflow-x-auto rounded-md p-3 text-xs" dir="ltr">{{ matchLinks() | json }}</pre>
      </div>

      <div class="space-y-3">
        <h3 class="text-lg font-medium">{{ t().simpleHeading }}</h3>
        <p class="text-muted-foreground text-sm">{{ t().simpleDescription }}</p>
        <ui-field-mapper
          [start]="fileColumns"
          [end]="contactFields"
          [(links)]="importLinks"
          [align]="false"
          [startHeading]="t().fileHeading"
          [endHeading]="t().fieldsHeading"
        />
      </div>

      <div class="space-y-3">
        <h3 class="text-lg font-medium">{{ t().manyHeading }}</h3>
        <p class="text-muted-foreground text-sm">{{ t().manyDescription }}</p>
        <ui-field-mapper
          [start]="orders"
          [end]="customers"
          [(links)]="manyLinks"
          [maxLinks]="{ start: infinity, end: infinity }"
          [linkTone]="manyTone"
          [startHeading]="t().ordersHeading"
          [endHeading]="t().customersHeading"
        />
      </div>

      <div class="space-y-3">
        <h3 class="text-lg font-medium">{{ t().searchHeading }}</h3>
        <p class="text-muted-foreground text-sm">{{ t().searchDescription }}</p>
        <ui-field-mapper [start]="wideStart" [end]="wideEnd" [(links)]="wideLinks" [searchable]="true" />
      </div>

      <div class="space-y-3">
        <h3 class="text-lg font-medium">{{ t().narrowHeading }}</h3>
        <p class="text-muted-foreground text-sm">{{ t().narrowDescription }}</p>
        <div class="w-full max-w-[20rem] rounded-lg border p-2">
          <ui-field-mapper
            [start]="fileColumns"
            [end]="contactFields"
            [(links)]="importLinks"
            [startHeading]="t().fileHeading"
            [endHeading]="t().fieldsHeading"
          />
        </div>
      </div>
    </section>
  `,
})
export class FieldMapperDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(() => FIELD_MAPPER_DEMO_LOCALES[this.localeId()] ?? FIELD_MAPPER_DEMO_LOCALES['en']);

  protected readonly infinity = Infinity;
  protected readonly orders = ORDERS;
  protected readonly customers = CUSTOMERS;
  protected readonly fileColumns = FILE_COLUMNS;
  protected readonly contactFields = CONTACT_FIELDS;
  protected readonly wideStart = WIDE_START;
  protected readonly wideEnd = WIDE_END;

  protected readonly matchLinks = signal<readonly FieldMapperLink[]>([
    { startId: 'customer_id', endId: 'id' },
    { startId: 'region', endId: 'area' },
    { startId: 'placed_at', endId: 'name' },
  ]);
  protected readonly importLinks = signal<readonly FieldMapperLink[]>([{ startId: 'E-mail', endId: 'email' }]);
  protected readonly manyLinks = signal<readonly FieldMapperLink[]>([
    { startId: 'customer_id', endId: 'id' },
    { startId: 'customer_id', endId: 'name' },
    { startId: 'region', endId: 'area' },
    { startId: 'order_id', endId: 'id' },
  ]);
  protected readonly wideLinks = signal<readonly FieldMapperLink[]>([
    { startId: 'src_0', endId: 'dst_3' },
    { startId: 'src_7', endId: 'dst_7' },
    { startId: 'src_22', endId: 'dst_30' },
  ]);
  protected readonly selectedLink = signal<FieldMapperLink | null>(null);

  protected samplesOf(item: FieldMapperItem): string {
    return [...ORDERS, ...CUSTOMERS].find(column => column.id === item.id)?.samples ?? '';
  }

  protected coverageLabel(link: FieldMapperLink): string {
    const key = `${link.startId}>${link.endId}`;
    return key in COVERAGE ? this.t().found(COVERAGE[key]) : '';
  }

  /** Weak evidence draws as a muted (dashed) line, strong as a heavy one. */
  protected readonly coverageTone = (link: FieldMapperLink): FieldMapperLinkTone => {
    const percent = COVERAGE[`${link.startId}>${link.endId}`] ?? 0;
    if (percent >= 90) return 'strong';
    return percent < 50 ? 'muted' : 'default';
  };

  protected readonly manyTone = (link: FieldMapperLink): FieldMapperLinkTone =>
    link.startId === 'order_id' ? 'muted' : 'default';
}
