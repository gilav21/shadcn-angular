import { ChangeDetectionStrategy, Component, computed, inject, type WritableSignal, signal } from '@angular/core';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { ButtonComponent } from '../../../../../packages/components/ui';
import { UiConfettiDirective } from '../../../../../packages/components/ui/confetti.directive';
import { CONFETTI_DEMO_LOCALES } from './confetti-demo.locales';

@Component({
  selector: 'app-confetti-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, UiConfettiDirective],
  template: `
    <section class="space-y-4">
      <h2 id="confetti" class="text-2xl font-semibold scroll-m-20">{{ t().title }}</h2>
      <p class="text-muted-foreground">
        {{ t().description }}
      </p>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="space-y-4">
          <h3 class="text-lg font-semibold">{{ t().basicTriggerHeading }}</h3>
          <div
            class="relative h-[200px] w-full border rounded-lg flex items-center justify-center bg-background overflow-hidden"
            uiConfetti [manualTrigger]="confettiTrigger1()"
            [options]="{ spread: 90, particleCount: 100, origin: { x: 0.6, y: 0.6 } }">
            <ui-button (click)="fireConfetti(confettiTrigger1)" [label]="t().basicButton" />
          </div>
        </div>

        <div class="space-y-4">
          <h3 class="text-lg font-semibold">{{ t().customDesignHeading }}</h3>
          <div
            class="relative h-[200px] w-full border rounded-lg flex items-center justify-center bg-background overflow-hidden"
            uiConfetti [manualTrigger]="confettiTrigger2()" [options]="{
                colors: ['#000000', '#E11D48'],
                shapes: ['square'],
                spread: 90,
                scalar: 1,
                startVelocity: 50,
                gravity: 0.1
             }">
            <ui-button variant="outline" (click)="fireConfetti(confettiTrigger2)" [label]="t().customButton" />
          </div>
        </div>

        <div class="space-y-4 md:col-span-2">
          <h3 class="text-lg font-semibold">{{ t().sideCannonsHeading }}</h3>
          <div
            class="relative h-[200px] w-full border rounded-lg flex items-center justify-center bg-background overflow-hidden"
            uiConfetti [manualTrigger]="confettiTrigger3()"
            [options]="{ variant: 'side-cannons', particleCount: 300, ticks: 400, startVelocity: 60 }">
            <ui-button variant="secondary" (click)="fireConfetti(confettiTrigger3)" [label]="t().sideCannonsButton" />
          </div>
        </div>

        <ui-button variant="secondary" class="w-[200px] p-0 " (click)="fireConfetti(confettiTrigger4)">
          <div class="relative h-full w-full border flex items-center justify-center" uiConfetti
            [manualTrigger]="confettiTrigger4()"
            [options]="{ variant: 'side-cannons', particleCount: 85, ticks: 500, startVelocity: 15, angle: 120, gravity: 0.02 }">
            {{ t().fillButton }}</div>
        </ui-button>
      </div>
    </section>
  `,
})
export class ConfettiDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(
    () => CONFETTI_DEMO_LOCALES[this.localeId()] ?? CONFETTI_DEMO_LOCALES['en'],
  );

  readonly confettiTrigger1 = signal(false);
  readonly confettiTrigger2 = signal(false);
  readonly confettiTrigger3 = signal(false);
  readonly confettiTrigger4 = signal(false);

  fireConfetti(trigger: WritableSignal<boolean>) {
    trigger.set(false);
    setTimeout(() => trigger.set(true), 0);
  }
}
