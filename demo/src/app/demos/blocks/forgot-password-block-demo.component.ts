import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  ForgotPasswordBlockComponent,
  ForgotPasswordSubmit,
} from '../../../../../packages/blocks/forgot-password';

@Component({
  selector: 'app-forgot-password-block-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ForgotPasswordBlockComponent],
  template: `
    <section class="space-y-6">
      <div>
        <h2 id="forgot-password-block" class="text-2xl font-semibold scroll-m-20">Forgot Password</h2>
        <p class="text-muted-foreground mt-1">
          A password-reset request page with an email field and a back-to-sign-in
          link. Composed from <code>card</code>, <code>input</code>,
          <code>label</code> and <code>button</code>.
        </p>
        <code class="mt-3 inline-block rounded bg-muted px-2 py-1 text-xs">npx shadcn-angular add forgot-password</code>
      </div>

      <div class="rounded-lg border overflow-hidden bg-background">
        <div class="flex items-center gap-1.5 border-b bg-muted/40 px-4 py-2.5">
          <span class="h-3 w-3 rounded-full bg-red-400/70"></span>
          <span class="h-3 w-3 rounded-full bg-yellow-400/70"></span>
          <span class="h-3 w-3 rounded-full bg-green-400/70"></span>
        </div>
        <div class="bg-muted/20 p-4 sm:p-8">
          <ui-forgot-password-block class="min-h-0" (submitted)="onSubmit($event)" />
        </div>
      </div>

      @if (lastSubmit(); as value) {
        <p class="text-sm text-muted-foreground">
          Reset link requested for <span class="font-medium text-foreground">{{ value.email }}</span>.
        </p>
      }
    </section>
  `,
})
export class ForgotPasswordBlockDemoComponent {
  readonly lastSubmit = signal<ForgotPasswordSubmit | null>(null);

  onSubmit(value: ForgotPasswordSubmit): void {
    this.lastSubmit.set(value);
  }
}
