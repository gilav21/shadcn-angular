import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
  contentChildren,
  AfterContentInit,
  inject,
  InjectionToken,
} from '@angular/core';
import { cn } from '../lib/utils';

export const TABS = new InjectionToken<TabsComponent>('TABS');

@Component({
  selector: 'ui-tabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: TABS, useExisting: TabsComponent }],
  template: `
    <div [class]="classes()" [attr.data-slot]="'tabs'">
      <ng-content />
    </div>
  `,
  host: { '[class]': '"contents"' },
})
export class TabsComponent {
  defaultValue = input<string>('');
  class = input('');

  activeTab = signal<string>('');
  tabChange = output<string>();

  classes = computed(() => cn('w-full', this.class()));

  ngOnInit() {
    if (this.defaultValue()) {
      this.activeTab.set(this.defaultValue());
    }
  }

  selectTab(value: string) {
    this.activeTab.set(value);
    this.tabChange.emit(value);
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
    >
      <ng-content />
    </div>
  `,
  host: { '[class]': '"contents"' },
})
export class TabsListComponent {
  class = input('');

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
      [attr.aria-selected]="isActive()"
      [attr.data-state]="isActive() ? 'active' : 'inactive'"
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

  classes = computed(() =>
    cn(
      'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      this.class()
    )
  );
}
