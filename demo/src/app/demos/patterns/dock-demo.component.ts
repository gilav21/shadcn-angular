import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import {
  DockComponent,
  DockIconComponent,
  DockItemData,
  DockItemComponent,
  DockLabelComponent,
  IconComponent,
  LabelComponent,
  SliderComponent,
} from '../../../../../packages/components/ui';
import { DOCK_DEMO_LOCALES } from './dock-demo.locales';

@Component({
  selector: 'app-dock-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DockComponent,
    DockIconComponent,
    DockItemComponent,
    DockLabelComponent,
    IconComponent,
    LabelComponent,
    SliderComponent,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="dock" class="text-2xl font-semibold scroll-m-20">{{ t().title }}</h2>
      <p class="text-muted-foreground">
        {{ t().description }}
      </p>

      <div class="flex items-center gap-8 p-4 border rounded-lg">
        <div class="space-y-2 w-full max-w-xs">
          <div class="flex justify-between">
            <ui-label>{{ t().magnificationLabel }} ({{ dockMagnification() }}px)</ui-label>
          </div>
          <ui-slider [min]="40" [max]="100" [step]="1" [defaultValue]="dockMagnification()"
            (valueChange)="dockMagnification.set($event)" />
        </div>
        <div class="space-y-2 w-full max-w-xs">
          <div class="flex justify-between">
            <ui-label>{{ t().distanceLabel }} ({{ dockDistance() }}px)</ui-label>
          </div>
          <ui-slider [min]="0" [max]="300" [step]="10" [defaultValue]="dockDistance()"
            (valueChange)="dockDistance.set($event)" />
        </div>
      </div>

      <h3 class="text-lg font-medium mt-8">{{ t().simpleModeHeading }}</h3>
      <p class="text-muted-foreground text-sm mb-4">{{ t().simpleModeDescription }}</p>
      <div
        class="relative h-[200px] w-full border rounded-lg overflow-hidden bg-muted/20 flex flex-col items-center justify-center">
        <div class="absolute inset-x-0 bottom-4">
          <ui-dock [items]="dockItems()" [magnification]="50" [distance]="80">
            <ng-template #itemTemplate let-item let-index="index">
              <ui-dock-item [class]="item.class || ''" [active]="item.active" (click)="toggleDockItem(index)" (keydown.enter)="toggleDockItem(index)">
                @if (item.label) { <ui-dock-label>{{ item.label }}</ui-dock-label> }
                @if (item.icon) { <ui-dock-icon>{{ item.icon }}</ui-dock-icon> }
              </ui-dock-item>
            </ng-template>
          </ui-dock>
        </div>
      </div>

      <div
        class="relative h-[400px] w-full border rounded-lg overflow-hidden bg-background flex flex-col items-center justify-center dots-pattern">
        <div class="absolute inset-0 bg-linear-to-t from-background/80 to-background/0 pointer-events-none"></div>

        <div class="absolute inset-x-0 bottom-8">
          <ui-dock [magnification]="dockMagnification()" [distance]="dockDistance()">

            <ui-dock-item #finder [active]="true" (click)="finder.startBounce();" (keydown.enter)="finder.startBounce();">
              <ui-dock-label>Finder</ui-dock-label>
              <ui-dock-icon
                class="bg-gradient-to-b from-sky-400 to-sky-600 border border-sky-400/30 text-white rounded-xl shadow-lg shadow-sky-500/20">
                <ui-icon name="search" />
              </ui-dock-icon>
            </ui-dock-item>

            <ui-dock-item #launchpad (click)="launchpad.startBounce()" (keydown.enter)="launchpad.startBounce()">
              <ui-dock-label>Launchpad</ui-dock-label>
              <ui-dock-icon
                class="bg-gradient-to-br from-indigo-400 via-purple-500 to-pink-500 border border-white/20 text-white rounded-xl shadow-lg shadow-purple-500/20">
                <ui-icon name="grid-2x2" />
              </ui-dock-icon>
            </ui-dock-item>

            <ui-dock-item #safari [active]="true" (click)="safari.startBounce()" (keydown.enter)="safari.startBounce()">
              <ui-dock-label>Safari</ui-dock-label>
              <ui-dock-icon class="bg-white text-blue-500 rounded-xl shadow-lg border-2 border-slate-100">
                <ui-icon name="compass" />
              </ui-dock-icon>
            </ui-dock-item>

            <ui-dock-item #messages (click)="messages.startBounce()" (keydown.enter)="messages.startBounce()">
              <ui-dock-label>Messages</ui-dock-label>
              <ui-dock-icon
                class="bg-gradient-to-b from-green-400 to-green-600 border border-green-400/30 text-white rounded-xl shadow-lg shadow-green-500/20">
                <ui-icon name="message-square" />
              </ui-dock-icon>
            </ui-dock-item>

            <ui-dock-item #mail (click)="mail.startBounce()" (keydown.enter)="mail.startBounce()">
              <ui-dock-label>Mail</ui-dock-label>
              <ui-dock-icon
                class="bg-gradient-to-b from-sky-400 to-blue-600 border border-blue-400/30 text-white rounded-xl shadow-lg shadow-blue-500/20">
                <ui-icon name="mail" />
              </ui-dock-icon>
            </ui-dock-item>

            <ui-dock-item #photos [active]="true" (click)="photos.startBounce()" (keydown.enter)="photos.startBounce()">
              <ui-dock-label>Photos</ui-dock-label>
              <ui-dock-icon class="bg-white text-black rounded-xl border-2 border-slate-100 shadow-lg">
                <ui-icon name="image" />
              </ui-dock-icon>
            </ui-dock-item>

            <ui-dock-item #cal (click)="cal.startBounce()" (keydown.enter)="cal.startBounce()">
              <ui-dock-label>Calendar</ui-dock-label>
              <ui-dock-icon class="bg-white rounded-xl border shadow-lg overflow-hidden group/cal relative">
                <div class="absolute top-0 inset-x-0 h-3 bg-red-500"></div>
                <span class="mt-2 text-xs font-bold font-mono">FEB</span>
                <span class="text-xl font-bold -mt-1 font-mono">24</span>
              </ui-dock-icon>
            </ui-dock-item>

            <div class="h-8 w-px bg-border mx-1 my-auto"></div>

            <ui-dock-item>
              <ui-dock-label>Downloads</ui-dock-label>
              <ui-dock-icon class="bg-blue-100 text-blue-600 border-2 border-blue-200 rounded-full shadow-inner">
                <ui-icon name="download" />
              </ui-dock-icon>
            </ui-dock-item>

            <ui-dock-item>
              <ui-dock-label>Trash</ui-dock-label>
              <ui-dock-icon
                class="bg-white text-slate-500 border border-slate-200 rounded-xl shadow-lg group-hover:rotate-12 transition-transform duration-300">
                <ui-icon name="trash" />
              </ui-dock-icon>
            </ui-dock-item>

          </ui-dock>
        </div>
      </div>

      <h3 class="text-lg font-medium mt-8">{{ t().verticalHeading }}</h3>
      <p class="text-muted-foreground text-sm mb-4">{{ t().verticalCaption }}</p>
      <div class="relative h-[280px] sm:h-[340px] w-full border rounded-lg overflow-hidden bg-muted/20">
        <div class="absolute inset-y-0 start-4 flex items-center">
          <ui-dock position="left" [items]="verticalItems()" [magnification]="72" [distance]="120" />
        </div>
        <div class="absolute inset-x-0 bottom-4 flex flex-wrap justify-center gap-2 px-4 text-sm text-muted-foreground">
          <span>{{ t().lastActivatedLabel }}: {{ lastActivated() ?? t().noneLabel }}</span>
        </div>
      </div>
    </section>
  `,
})
export class DockDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(
    () => DOCK_DEMO_LOCALES[this.localeId()] ?? DOCK_DEMO_LOCALES['en'],
  );

  readonly dockMagnification = signal(60);
  readonly dockDistance = signal(100);
  readonly dockItems = signal([...this.t().dockItems]);
  readonly lastActivated = signal<string | null>(null);

  readonly verticalItems = computed<DockItemData[]>(() => {
    const loc = this.t();
    return [
      { label: loc.verticalItemHome, icon: '🏠', href: '#dock', active: true },
      { label: loc.verticalItemFiles, icon: '📁', href: '#dock' },
      { label: loc.verticalItemSearch, icon: '🔍', onClick: () => this.lastActivated.set(loc.verticalItemSearch) },
      { label: loc.verticalItemTrash, icon: '🗑️', onClick: () => this.lastActivated.set(loc.verticalItemTrash) },
    ];
  });

  constructor() {
    let prev = this.t();
    effect(() => {
      const next = this.t();
      if (next !== prev) {
        this.dockItems.set([...next.dockItems]);
        prev = next;
      }
    });
  }

  toggleDockItem(index: number) {
    this.dockItems.update(items => items.map((item, i) =>
      i === index ? { ...item, active: !item.active } : item
    ));
  }
}
