import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  ResizableHandleComponent,
  ResizablePanelComponent,
  ResizablePanelGroupComponent,
} from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { RESIZABLE_DEMO_LOCALES } from './resizable-demo.locales';

@Component({
  selector: 'app-resizable-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ResizablePanelGroupComponent,
    ResizablePanelComponent,
    ResizableHandleComponent,
  ],
  template: `
    <section class="space-y-6">
      <h2 id="resizable" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="space-y-2">
        <h3 class="text-lg font-medium">{{ t().horizontalHeading }}</h3>
        <ui-resizable-panel-group direction="horizontal" class="min-h-[200px] max-w-md rounded-lg border">
          <ui-resizable-panel [defaultSize]="30">
            <div class="flex h-full items-center justify-center bg-muted/30 p-6">
              <span class="font-semibold">{{ t().leftPanel }} (30%)</span>
            </div>
          </ui-resizable-panel>
          <ui-resizable-handle [withHandle]="false" [handleSize]="2" />
          <ui-resizable-panel [defaultSize]="70">
            <div class="flex h-full items-center justify-center p-6">
              <span class="font-semibold">{{ t().rightPanel }} (70%)</span>
            </div>
          </ui-resizable-panel>
        </ui-resizable-panel-group>
      </div>

      <div class="space-y-2">
        <h3 class="text-lg font-medium">{{ t().verticalHeading }}</h3>
        <ui-resizable-panel-group direction="vertical" class="h-[300px] max-w-md rounded-lg border">
          <ui-resizable-panel [defaultSize]="40">
            <div class="flex h-full items-center justify-center bg-muted/30 p-6">
              <span class="font-semibold">{{ t().topPanel }} ({{ verticalTopSize() }}%)</span>
            </div>
          </ui-resizable-panel>
          <ui-resizable-handle [withHandle]="false" [handleSize]="2" (resized)="onVerticalResize($event)" />
          <ui-resizable-panel [defaultSize]="60">
            <div class="flex h-full items-center justify-center p-6">
              <span class="font-semibold">{{ t().bottomPanel }} ({{ verticalBottomSize() }}%)</span>
            </div>
          </ui-resizable-panel>
        </ui-resizable-panel-group>
      </div>
    </section>
  `,
})
export class ResizableDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(() => RESIZABLE_DEMO_LOCALES[this.localeId()] ?? RESIZABLE_DEMO_LOCALES['en']);

  readonly verticalTopSize = signal(40);
  readonly verticalBottomSize = signal(60);

  onVerticalResize(event: { delta: number; sizes: number[] }) {
    this.verticalTopSize.set(event.sizes[0]);
    this.verticalBottomSize.set(event.sizes[1]);
  }
}
