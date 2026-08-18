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

      <div class="space-y-2">
        <h3 class="text-lg font-medium">{{ t().limitsHeading }}</h3>
        <p class="text-muted-foreground text-sm">{{ t().limitsCaption }}</p>
        <ui-resizable-panel-group direction="horizontal" class="min-h-[200px] max-w-md rounded-lg border">
          <ui-resizable-panel [defaultSize]="30" [minSize]="20" [maxSize]="60"
            (sizeChange)="onLimitsStartSize($event)">
            <div class="flex h-full flex-col items-center justify-center gap-1 bg-muted/30 p-4 sm:p-6 text-center">
              <span class="font-semibold">{{ t().leftPanel }} ({{ limitsStartSize() }}%)</span>
              <span class="text-xs text-muted-foreground">{{ t().limitsRange }} 20–60%</span>
            </div>
          </ui-resizable-panel>
          <ui-resizable-handle [withHandle]="true" [handleSize]="8" />
          <ui-resizable-panel [defaultSize]="70" [minSize]="40" [maxSize]="80"
            (sizeChange)="onLimitsEndSize($event)">
            <div class="flex h-full flex-col items-center justify-center gap-1 p-4 sm:p-6 text-center">
              <span class="font-semibold">{{ t().rightPanel }} ({{ limitsEndSize() }}%)</span>
              <span class="text-xs text-muted-foreground">{{ t().limitsRange }} 40–80%</span>
            </div>
          </ui-resizable-panel>
        </ui-resizable-panel-group>
        <p class="text-sm text-muted-foreground">
          {{ t().liveSizes }}: {{ limitsStartSize() }}% / {{ limitsEndSize() }}%
        </p>
      </div>

      <div class="space-y-2">
        <h3 class="text-lg font-medium">{{ t().keyboardHeading }}</h3>
        <p class="text-muted-foreground text-sm">{{ t().keyboardCaption }}</p>
        <ui-resizable-panel-group direction="horizontal" class="min-h-[160px] max-w-md rounded-lg border">
          <ui-resizable-panel [defaultSize]="50" [minSize]="20" [maxSize]="80"
            (sizeChange)="onKeyboardStartSize($event)">
            <div class="flex h-full items-center justify-center bg-muted/30 p-4 sm:p-6">
              <span class="font-semibold">{{ t().leftPanel }} ({{ keyboardStartSize() }}%)</span>
            </div>
          </ui-resizable-panel>
          <ui-resizable-handle [withHandle]="true" [handleSize]="8" [ariaLabel]="t().keyboardHandleLabel" />
          <ui-resizable-panel [defaultSize]="50" [minSize]="20" [maxSize]="80"
            (sizeChange)="onKeyboardEndSize($event)">
            <div class="flex h-full items-center justify-center p-4 sm:p-6">
              <span class="font-semibold">{{ t().rightPanel }} ({{ keyboardEndSize() }}%)</span>
            </div>
          </ui-resizable-panel>
        </ui-resizable-panel-group>
        <p class="text-sm text-muted-foreground">
          {{ t().liveSizes }}: {{ keyboardStartSize() }}% / {{ keyboardEndSize() }}%
        </p>
      </div>
    </section>
  `,
})
export class ResizableDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(() => RESIZABLE_DEMO_LOCALES[this.localeId()] ?? RESIZABLE_DEMO_LOCALES['en']);

  readonly verticalTopSize = signal(40);
  readonly verticalBottomSize = signal(60);

  readonly limitsStartSize = signal(30);
  readonly limitsEndSize = signal(70);
  readonly keyboardStartSize = signal(50);
  readonly keyboardEndSize = signal(50);

  onVerticalResize(event: { delta: number; sizes: number[] }) {
    this.verticalTopSize.set(event.sizes[0]);
    this.verticalBottomSize.set(event.sizes[1]);
  }

  onLimitsStartSize(size: number) {
    this.limitsStartSize.set(Math.round(size));
  }

  onLimitsEndSize(size: number) {
    this.limitsEndSize.set(Math.round(size));
  }

  onKeyboardStartSize(size: number) {
    this.keyboardStartSize.set(Math.round(size));
  }

  onKeyboardEndSize(size: number) {
    this.keyboardEndSize.set(Math.round(size));
  }
}
