import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-introduction',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center justify-center py-20 text-center">
      <h1 class="text-4xl font-bold mb-4">shadcn-angular</h1>
      <p class="text-muted-foreground text-lg max-w-md">
        Select a component from the sidebar to explore demos and examples.
      </p>
    </div>
  `,
})
export class IntroductionComponent {}
