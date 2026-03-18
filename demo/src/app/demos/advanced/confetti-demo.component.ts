import { ChangeDetectionStrategy, Component, type WritableSignal, signal } from '@angular/core';
import { ButtonComponent } from '../../../../../packages/components/ui';
import { UiConfettiDirective } from '../../../../../packages/components/ui/confetti.directive';

@Component({
  selector: 'app-confetti-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, UiConfettiDirective],
  template: `
    <section class="space-y-4">
      <h2 id="confetti" class="text-2xl font-semibold scroll-m-20">Confetti</h2>
      <p class="text-muted-foreground">
        A canvas-based celebration effect for success states.
      </p>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="space-y-4">
          <h3 class="text-lg font-semibold">Basic Trigger</h3>
          <div
            class="relative h-[200px] w-full border rounded-lg flex items-center justify-center bg-background overflow-hidden"
            uiConfetti [manualTrigger]="confettiTrigger1()"
            [options]="{ spread: 90, particleCount: 100, origin: { x: 0.6, y: 0.6 } }">
            <ui-button (click)="fireConfetti(confettiTrigger1)">Celebrate!</ui-button>
          </div>
        </div>

        <div class="space-y-4">
          <h3 class="text-lg font-semibold">Custom Design</h3>
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
            <ui-button variant="outline" (click)="fireConfetti(confettiTrigger2)">Black & Red</ui-button>
          </div>
        </div>

        <div class="space-y-4 md:col-span-2">
          <h3 class="text-lg font-semibold">Side Cannons</h3>
          <div
            class="relative h-[200px] w-full border rounded-lg flex items-center justify-center bg-background overflow-hidden"
            uiConfetti [manualTrigger]="confettiTrigger3()"
            [options]="{ variant: 'side-cannons', particleCount: 300, ticks: 400, startVelocity: 60 }">
            <ui-button variant="secondary" (click)="fireConfetti(confettiTrigger3)">Fill Container</ui-button>
          </div>
        </div>

        <ui-button variant="secondary" class="w-[200px] p-0 " (click)="fireConfetti(confettiTrigger4)">
          <div class="relative h-full w-full border flex items-center justify-center" uiConfetti
            [manualTrigger]="confettiTrigger4()"
            [options]="{ variant: 'side-cannons', particleCount: 85, ticks: 500, startVelocity: 15, angle: 120, gravity: 0.02 }">
            Fill
            Button</div>
        </ui-button>
      </div>
    </section>
  `,
})
export class ConfettiDemoComponent {
  readonly confettiTrigger1 = signal(false);
  readonly confettiTrigger2 = signal(false);
  readonly confettiTrigger3 = signal(false);
  readonly confettiTrigger4 = signal(false);

  fireConfetti(trigger: WritableSignal<boolean>) {
    trigger.set(false);
    setTimeout(() => trigger.set(true), 0);
  }
}
