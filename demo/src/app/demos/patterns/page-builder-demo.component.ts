import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { PAGE_BUILDER_DEMO_LOCALES } from './page-builder-demo.locales';
import {
  AccordionComponent,
  BadgeComponent,
  ButtonComponent,
  CardComponent,
  CheckboxComponent,
  CodeBlockComponent,
  BreadcrumbComponent,
  ChatListComponent,
  InputComponent,
  PageBuilderComponent,
  ComponentMeta,
  PageBuilderViewMode,
  PageData,
  ProgressComponent,
  RadioGroupComponent,
  RatingComponent,
  SeparatorComponent,
  SliderComponent,
  SparklesButtonComponent,
  SpinnerComponent,
  StreamingTextComponent,
  SwitchComponent,
  TabsComponent,
  TextareaComponent,
  TimelineComponent,
  AvatarComponent,
  AlertComponent,
} from '../../../../../packages/components/ui';
import {
  MetricWidgetComponent,
} from '../../dashboard-widgets';

@Component({
  selector: 'app-page-builder-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageBuilderComponent, CodeBlockComponent],
  template: `
    <ui-page-builder
      [components]="pageBuilderComponents()"
      [enableSave]="true"
      [enableExport]="true"
      (save)="onSave($event)"
      (viewModeChange)="onViewModeChange($event)"
    />

    <aside
      class="fixed left-0 right-0 bottom-0 z-40 bg-card border-t border-border shadow-xl flex flex-col transition-[height,transform] duration-300 ease-out"
      [style.height.px]="panelOpen() ? 288 : 40"
    >
      <button
        type="button"
        (click)="togglePanel()"
        class="h-10 shrink-0 px-4 flex items-center justify-between border-b border-border/60 bg-background/80 backdrop-blur hover:bg-accent hover:text-accent-foreground transition-colors"
        [attr.aria-expanded]="panelOpen()"
      >
        <span class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {{ t().panelLabel }}
          @if (savedAt(); as at) {
            <span class="normal-case tracking-normal font-normal text-[11px] text-muted-foreground/80">
              · {{ t().panelSavedAt }} {{ at }} · {{ t().panelViewMode }} {{ viewMode() }}
            </span>
          }
        </span>
        <span class="text-[11px] text-muted-foreground">
          {{ panelOpen() ? t().panelHide : t().panelShow }}
        </span>
      </button>
      @if (panelOpen()) {
        <div class="flex-1 min-h-0 overflow-auto">
          @if (savedJson(); as json) {
            <ui-code-block [code]="json" language="json" class="block" />
          } @else {
            <div class="h-full flex items-center justify-center text-xs text-muted-foreground px-4 text-center">
              {{ t().panelClickSave }}
            </div>
          }
        </div>
      }
    </aside>
  `,
})
export class PageBuilderDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(
    () => PAGE_BUILDER_DEMO_LOCALES[this.localeId()] ?? PAGE_BUILDER_DEMO_LOCALES['en'],
  );

  readonly savedLayout = signal<PageData | null>(null);
  readonly savedAt = signal<string | null>(null);
  readonly viewMode = signal<PageBuilderViewMode>('edit');
  readonly panelOpen = signal<boolean>(false);

  readonly savedJson = computed(() => {
    const layout = this.savedLayout();
    return layout ? JSON.stringify(layout, null, 2) : '';
  });

  onSave(layout: PageData) {
    this.savedLayout.set(layout);
    this.savedAt.set(new Date().toLocaleTimeString());
    this.panelOpen.set(true);
  }

  onViewModeChange(mode: PageBuilderViewMode) {
    this.viewMode.set(mode);
  }

  togglePanel() {
    this.panelOpen.update(v => !v);
  }

  readonly pageBuilderComponents = signal<ComponentMeta[]>([
    {
      id: 'card',
      name: 'Card',
      category: 'Layout',
      component: CardComponent,
      icon: 'layout',
      defaultInputs: { title: 'New Card', description: 'Card description goes here.' },
    },
    {
      id: 'tabs',
      name: 'Tabs',
      category: 'Layout',
      component: TabsComponent,
      icon: 'panels-top-left',
      defaultInputs: {},
    },
    {
      id: 'accordion',
      name: 'Accordion',
      category: 'Layout',
      component: AccordionComponent,
      icon: 'list-collapse',
      defaultInputs: {},
    },
    {
      id: 'separator',
      name: 'Separator',
      category: 'Layout',
      component: SeparatorComponent,
      icon: 'minus',
      defaultInputs: {},
    },
    {
      id: 'button',
      name: 'Button',
      category: 'Inputs',
      component: ButtonComponent,
      icon: 'box-select',
      defaultInputs: { variant: 'default', size: 'default', label: 'Click Me' },
      inputs: [
        { name: 'variant', type: 'select', options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'] },
        { name: 'size', type: 'select', options: ['default', 'sm', 'lg', 'icon'] },
      ],
    },
    {
      id: 'input',
      name: 'Input',
      category: 'Inputs',
      component: InputComponent,
      icon: 'text-cursor',
      defaultInputs: { placeholder: 'Type something...', value: '' },
    },
    {
      id: 'textarea',
      name: 'Textarea',
      category: 'Inputs',
      component: TextareaComponent,
      icon: 'file-text',
      defaultInputs: { placeholder: 'Start typing...', value: '' },
    },
    {
      id: 'switch',
      name: 'Switch',
      category: 'Inputs',
      component: SwitchComponent,
      icon: 'toggle-right',
      defaultInputs: { checked: false, label: 'Enable setting' },
    },
    {
      id: 'checkbox',
      name: 'Checkbox',
      category: 'Inputs',
      component: CheckboxComponent,
      icon: 'check-square',
      defaultInputs: { checked: false, label: 'Accept terms' },
    },
    {
      id: 'slider',
      name: 'Slider',
      category: 'Inputs',
      component: SliderComponent,
      icon: 'sliders-horizontal',
      defaultInputs: { value: [50], min: 0, max: 100, step: 1 },
    },
    {
      id: 'radio-group',
      name: 'Radio Group',
      category: 'Inputs',
      component: RadioGroupComponent,
      icon: 'circle-dot',
      defaultInputs: { options: ['Option 1', 'Option 2', 'Option 3'] },
    },
    {
      id: 'rating',
      name: 'Rating',
      category: 'Inputs',
      component: RatingComponent,
      icon: 'star',
      defaultInputs: { value: 3 },
    },
    {
      id: 'badge',
      name: 'Badge',
      category: 'Data Display',
      component: BadgeComponent,
      icon: 'tag',
      defaultInputs: { variant: 'default', label: 'New' },
      inputs: [{ name: 'variant', type: 'select', options: ['default', 'secondary', 'destructive', 'outline'] }],
    },
    {
      id: 'avatar',
      name: 'Avatar',
      category: 'Data Display',
      component: AvatarComponent,
      icon: 'user-circle',
      defaultInputs: { src: 'https://github.com/shadcn.png' },
    },
    {
      id: 'timeline',
      name: 'Timeline',
      category: 'Data Display',
      component: TimelineComponent,
      icon: 'clock',
      defaultInputs: {},
    },
    {
      id: 'breadcrumb',
      name: 'Breadcrumb',
      category: 'Data Display',
      component: BreadcrumbComponent,
      icon: 'chevron-right',
      defaultInputs: {},
    },
    {
      id: 'code-block',
      name: 'Code Block',
      category: 'Data Display',
      component: CodeBlockComponent,
      icon: 'code',
      defaultInputs: { code: 'console.log("Hello Page Builder!");', language: 'javascript' },
    },
    {
      id: 'alert',
      name: 'Alert',
      category: 'Feedback',
      component: AlertComponent,
      icon: 'alert-triangle',
      defaultInputs: { variant: 'default', title: 'Attention!', description: 'Something important happened.' },
      inputs: [{ name: 'variant', type: 'select', options: ['default', 'destructive'] }],
    },
    {
      id: 'progress',
      name: 'Progress',
      category: 'Feedback',
      component: ProgressComponent,
      icon: 'loader',
      defaultInputs: { value: 66 },
    },
    {
      id: 'spinner',
      name: 'Spinner',
      category: 'Feedback',
      component: SpinnerComponent,
      icon: 'refresh-cw',
      defaultInputs: { size: 'md' },
    },
    {
      id: 'metric',
      name: 'Metric',
      category: 'Advanced',
      component: MetricWidgetComponent,
      icon: 'bar-chart-2',
      defaultInputs: { title: 'Revenue', value: '$12,842', trend: 12.5 },
    },
    {
      id: 'sparkles',
      name: 'Sparkles Button',
      category: 'Advanced',
      component: SparklesButtonComponent,
      icon: 'sparkles',
      defaultInputs: { label: 'Magic Button' },
    },
    {
      id: 'chat-list',
      name: 'Chat List',
      category: 'Advanced',
      component: ChatListComponent,
      icon: 'message-square',
      defaultInputs: {},
    },
    {
      id: 'streaming-text',
      name: 'Streaming Text',
      category: 'Advanced',
      component: StreamingTextComponent,
      icon: 'type',
      defaultInputs: { text: 'This text is appearing character by character...', speed: 50 },
    },
  ]);
}
