import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { cn } from '../../components/lib/utils';
import { ButtonComponent } from '../../components/ui/button';
import { InputComponent } from '../../components/ui/input';
import { LabelComponent } from '../../components/ui/label';
import {
  CardComponent,
  CardHeaderComponent,
  CardTitleComponent,
  CardDescriptionComponent,
  CardContentComponent,
  CardFooterComponent,
} from '../../components/ui/card';

export interface ForgotPasswordSubmit {
  readonly email: string;
}

@Component({
  selector: 'ui-forgot-password-block',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    ButtonComponent,
    InputComponent,
    LabelComponent,
    CardComponent,
    CardHeaderComponent,
    CardTitleComponent,
    CardDescriptionComponent,
    CardContentComponent,
    CardFooterComponent,
  ],
  templateUrl: './forgot-password.component.html',
  host: { class: 'block' },
})
export class ForgotPasswordBlockComponent {
  readonly class = input('');
  readonly email = signal('');
  readonly submitted = output<ForgotPasswordSubmit>();

  readonly classes = computed(() =>
    cn('flex min-h-svh items-center justify-center p-4 sm:p-6', this.class()),
  );

  onSubmit(): void {
    this.submitted.emit({
      email: this.email(),
    });
  }
}
