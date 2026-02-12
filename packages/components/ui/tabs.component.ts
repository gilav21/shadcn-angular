import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
  inject,
  InjectionToken,
  forwardRef,
  TemplateRef,
  Type,
} from '@angular/core';
import { NgTemplateOutlet, NgComponentOutlet } from '@angular/common';
import { cn } from '../lib/utils';

export interface TabConfig {
  value: string;
  label: string;
  content?: string | TemplateRef<unknown> | Type<unknown>;
  contentContext?: Record<string, unknown>;
  disabled?: boolean;
}

export const TABS = new InjectionToken<TabsComponent>('TABS');

let tabsIdCounter = 0;

@Component({
  selector: 'ui-tabs',
  standalone: true,
  imports: [NgTemplateOutlet, NgComponentOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: TABS, useExisting: forwardRef(() => TabsComponent) }],
  template: `
    <div [class]="classes()" [attr.data-slot]="'tabs'">
      @if (tabs().length > 0) {
        <!-- Simple mode: auto-generate tabs -->
        <div class="inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground" role="tablist">
          @for (tab of tabs(); track tab.value) {
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="activeTab() === tab.value"
              [attr.data-state]="activeTab() === tab.value ? 'active' : 'inactive'"
              [attr.tabindex]="activeTab() === tab.value ? 0 : -1"
              [disabled]="tab.disabled"
              [class]="triggerClasses(tab.value)"
              (click)="selectTab(tab.value)"
            >
              {{ tab.label }}
            </button>
          }
        </div>
        @for (tab of tabs(); track tab.value) {
          @if (activeTab() === tab.value && tab.content) {
            <div role="tabpanel" class="mt-2 ring-offset-background focus-visible:outline-none">
              @if (isString(tab.content)) {
                {{ tab.content }}
              } @else if (isTemplateRef(tab.content)) {
                <ng-container *ngTemplateOutlet="$any(tab.content); context: tab.contentContext" />
              } @else {
               <ng-container *ngComponentOutlet="$any(tab.content); inputs: tab.contentContext" />
              }
            </div>
          }
        }
      } @else {
        <!-- Template mode: project content -->
        <ng-content />
      }
    </div>
  `,
  host: { '[class]': '"contents"' },
})
export class TabsComponent {
  defaultValue = input<string>('');
  class = input('');
  tabs = input<TabConfig[]>([]);

  readonly tabsId = `tabs-${++tabsIdCounter}`;
  activeTab = signal<string>('');
  tabChange = output<string>();

  classes = computed(() => cn('w-full', this.class()));

  triggerClasses(value: string) {
    return cn(
      'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
      this.activeTab() === value
        ? 'bg-background text-foreground shadow'
        : 'hover:bg-background/50'
    );
  }

  isString(content: unknown): boolean {
    return typeof content === 'string';
  }

  isTemplateRef(content: unknown): boolean {
    return content instanceof TemplateRef;
  }

  ngOnInit() {
    if (this.defaultValue()) {
      this.activeTab.set(this.defaultValue());
    } else if (this.tabs().length > 0) {
      this.activeTab.set(this.tabs()[0].value);
    }
  }

  selectTab(value: string) {
    this.activeTab.set(value);
    this.tabChange.emit(value);
  }

  getTriggerId(value: string): string {
    return `${this.tabsId}-trigger-${value}`;
  }

  getPanelId(value: string): string {
    return `${this.tabsId}-panel-${value}`;
  }
}


@Component({
  selector: 'ui-tabs-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      role="tablist"
      [class]="classes()"
      [attr.data-slot]="'tabs-list'"
      [attr.aria-label]="ariaLabel()"
    >
      <ng-content />
    </div>
  `,
  host: { '[class]': '"contents"' },
})
export class TabsListComponent {
  class = input('');
  ariaLabel = input<string | undefined>(undefined);

  classes = computed(() =>
    cn(
      'inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground',
      this.class()
    )
  );
}

@Component({
  selector: 'ui-tabs-trigger',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      role="tab"
      [attr.id]="triggerId()"
      [attr.aria-selected]="isActive()"
      [attr.aria-controls]="panelId()"
      [attr.data-state]="isActive() ? 'active' : 'inactive'"
      [attr.tabindex]="isActive() ? 0 : -1"
      [class]="classes()"
      [attr.data-slot]="'tabs-trigger'"
      (click)="select()"
    >
      <ng-content />
    </button>
  `,
  host: { '[class]': '"contents"' },
})
export class TabsTriggerComponent {
  value = input.required<string>();
  class = input('');

  private tabs = inject(TABS, { optional: true });

  isActive = computed(() => this.tabs?.activeTab() === this.value());
  triggerId = computed(() => this.tabs?.getTriggerId(this.value()) ?? '');
  panelId = computed(() => this.tabs?.getPanelId(this.value()) ?? '');

  classes = computed(() =>
    cn(
      'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
      this.isActive()
        ? 'bg-background text-foreground shadow'
        : 'hover:bg-background/50',
      this.class()
    )
  );

  select() {
    if (this.tabs) {
      this.tabs.selectTab(this.value());
    }
  }
}

@Component({
  selector: 'ui-tabs-content',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isActive()) {
      <div
        role="tabpanel"
        [attr.id]="panelId()"
        [attr.aria-labelledby]="triggerId()"
        [attr.tabindex]="0"
        [class]="classes()"
        [attr.data-slot]="'tabs-content'"
      >
        <ng-content />
      </div>
    }
  `,
  host: { '[class]': '"contents"' },
})
export class TabsContentComponent {
  value = input.required<string>();
  class = input('');

  private tabs = inject(TABS, { optional: true });

  isActive = computed(() => this.tabs?.activeTab() === this.value());
  triggerId = computed(() => this.tabs?.getTriggerId(this.value()) ?? '');
  panelId = computed(() => this.tabs?.getPanelId(this.value()) ?? '');

  classes = computed(() =>
    cn(
      'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      this.class()
    )
  );
}

