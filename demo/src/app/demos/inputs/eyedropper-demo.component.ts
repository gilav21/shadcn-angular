import { ChangeDetectionStrategy, Component, signal, viewChild, ElementRef } from '@angular/core';
import { EyedropperComponent } from '../../../../../packages/components/ui';

@Component({
    selector: 'app-eyedropper-demo',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [EyedropperComponent],
    template: `
    <section class="space-y-6">
      <h2 id="eyedropper" class="text-2xl font-semibold scroll-m-20">Eyedropper</h2>
      <p class="text-muted-foreground">
        Standalone picker that prefers the native <code>window.EyeDropper</code>
        API and falls back to canvas-based sampling on any
        <code>&lt;img&gt;</code>, <code>&lt;canvas&gt;</code>, or
        <code>&lt;video&gt;</code> element you pass via <code>fallbackTarget</code>.
      </p>

      <article class="space-y-2">
        <h3 class="text-lg font-semibold">Native API</h3>
        <p class="text-sm text-muted-foreground">
          Works on Chromium-based browsers. Click the pipette, then click any
          pixel anywhere on screen.
        </p>
        <div class="flex items-center gap-4">
          <ui-eyedropper variant="button" label="Pick a pixel" (colorPick)="nativePicked.set($event)" />
          @if (nativePicked()) {
            <div class="flex items-center gap-2">
              <span class="h-8 w-8 rounded border" [style.backgroundColor]="nativePicked()"></span>
              <code class="text-sm font-mono">{{ nativePicked() }}</code>
            </div>
          }
        </div>
      </article>

      <article class="space-y-2">
        <h3 class="text-lg font-semibold">In-page fallback</h3>
        <p class="text-sm text-muted-foreground">
          Pass a target element via <code>[fallbackTarget]</code>. Works in
          Firefox / Safari where the native API isn't available.
        </p>
        <div class="flex items-start gap-4">
          <img
            #target
            src="https://picsum.photos/seed/eyedropper-demo/320/200"
            alt="Sample"
            crossorigin="anonymous"
            class="rounded-md"
          />
          <div class="flex flex-col gap-3">
            <ui-eyedropper variant="button" label="Sample from image" [fallbackTarget]="target" (colorPick)="fallbackPicked.set($event)" />
            @if (fallbackPicked()) {
              <div class="flex items-center gap-2">
                <span class="h-8 w-8 rounded border" [style.backgroundColor]="fallbackPicked()"></span>
                <code class="text-sm font-mono">{{ fallbackPicked() }}</code>
              </div>
            }
          </div>
        </div>
      </article>

      <article class="space-y-2">
        <h3 class="text-lg font-semibold">Disabled</h3>
        <ui-eyedropper variant="icon" [disabled]="true" />
      </article>
    </section>
  `,
})
export class EyedropperDemoComponent {
    readonly nativePicked = signal<string | null>(null);
    readonly fallbackPicked = signal<string | null>(null);
    readonly target = viewChild<ElementRef<HTMLImageElement>>('target');
}
