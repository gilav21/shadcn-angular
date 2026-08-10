import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
  InjectionToken,
  forwardRef,
  TemplateRef,
  Type,
  OnInit,
} from '@angular/core';
import { NgTemplateOutlet, NgComponentOutlet } from '@angular/common';
import { cn } from '../../lib/utils';

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
export class TabsComponent implements OnInit {
  /**
   * Value of the tab selected on init. Read once in `ngOnInit` — changing it later has no
   * effect; call {@link selectTab} instead. Left empty, simple mode falls back to the first
   * entry of {@link tabs}, while template mode starts with no tab active and every
   * `<ui-tabs-content>` hidden.
   */
  defaultValue = input<string>('');
  /** Extra classes merged onto the tabs wrapper, after the base `w-full` — not onto the tab list, which `<ui-tabs-list>` styles. */
  class = input('');
  /**
   * Simple mode — supplying tabs makes the component render its own tab list and panels, and
   * any projected `<ui-tabs-list>` / `<ui-tabs-content>` is ignored entirely. Each entry's
   * `content` may be a plain string, a `TemplateRef`, or a component `Type`; the latter two
   * receive `contentContext` as template context / component inputs. Leave it `[]` (the default)
   * to compose the sub-components yourself.
   */
  tabs = input<TabConfig[]>([]);

  readonly tabsId = `tabs-${++tabsIdCounter}`;
  activeTab = signal<string>('');
  /**
   * Emits the newly selected tab's value on every {@link selectTab} call — from a click in
   * either mode, or programmatically — including when the same tab is re-selected. Not emitted
   * for the initial {@link defaultValue} selection.
   */
  tabChange = output<string>();

  classes = computed(() => cn('w-full', this.class()));

  /**
   * Classes for a simple-mode trigger button, switching between the raised active look and the
   * hover-only inactive one. Template-internal helper for the {@link tabs}-driven list; the
   * projected `<ui-tabs-trigger>` computes its own and honours a `class` input, which this does not.
   */
  triggerClasses(value: string): string {
    return cn(
      'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
      this.activeTab() === value
        ? 'bg-background text-foreground shadow'
        : 'hover:bg-background/50'
    );
  }

  /** Template-internal narrowing helper: whether a {@link TabConfig} `content` is plain text, to be interpolated rather than outlet-rendered. */
  isString(content: unknown): boolean {
    return typeof content === 'string';
  }

  /**
   * Template-internal narrowing helper: whether a {@link TabConfig} `content` should go through
   * `ngTemplateOutlet`. Anything that is neither this nor {@link isString} is treated as a
   * component `Type` and rendered with `ngComponentOutlet`.
   */
  isTemplateRef(content: unknown): boolean {
    return content instanceof TemplateRef;
  }

  ngOnInit(): void {
    if (this.defaultValue()) {
      this.activeTab.set(this.defaultValue());
    } else if (this.tabs().length > 0) {
      this.activeTab.set(this.tabs()[0].value);
    }
  }

  /**
   * Activates the tab with this value and emits {@link tabChange}. The single entry point for
   * both modes' triggers, and safe to call directly to switch tabs from outside. The value is
   * not validated and `disabled` is not re-checked here (the simple-mode button is natively
   * disabled instead), so an unknown value deactivates every panel.
   */
  selectTab(value: string): void {
    this.activeTab.set(value);
    this.tabChange.emit(value);
  }

  /**
   * The `id` given to that tab's trigger button, which its panel points `aria-labelledby` at.
   * Namespaced per `<ui-tabs>` instance so several tab sets can reuse the same values. Used only
   * in template mode — simple-mode buttons and panels are not id-linked.
   */
  getTriggerId(value: string): string {
    return `${this.tabsId}-trigger-${value}`;
  }

  /** Counterpart to {@link getTriggerId} for the panel — the id a `<ui-tabs-trigger>` references via `aria-controls`. */
  getPanelId(value: string): string {
    return `${this.tabsId}-panel-${value}`;
  }
}
