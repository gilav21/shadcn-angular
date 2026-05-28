import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { cn } from '../../components/lib/utils';
import { ButtonComponent } from '../../components/ui/button';
import { InputComponent } from '../../components/ui/input';
import { LabelComponent } from '../../components/ui/label';
import { CheckboxComponent } from '../../components/ui/checkbox';
import {
  CardComponent,
  CardHeaderComponent,
  CardTitleComponent,
  CardDescriptionComponent,
  CardContentComponent,
  CardFooterComponent,
} from '../../components/ui/card';

export interface SignupSubmit {
  readonly name: string;
  readonly email: string;
  readonly password: string;
  readonly acceptTerms: boolean;
}

@Component({
  selector: 'ui-signup-block',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    ButtonComponent,
    InputComponent,
    LabelComponent,
    CheckboxComponent,
    CardComponent,
    CardHeaderComponent,
    CardTitleComponent,
    CardDescriptionComponent,
    CardContentComponent,
    CardFooterComponent,
  ],
  templateUrl: './signup.component.html',
  host: { class: 'block' },
})
export class SignupBlockComponent {
  readonly class = input('');
  readonly name = signal('');
  readonly email = signal('');
  readonly password = signal('');
  readonly confirmPassword = signal('');
  readonly acceptTerms = signal(false);
  readonly submitted = output<SignupSubmit>();

  readonly classes = computed(() =>
    cn('flex min-h-svh items-center justify-center p-4 sm:p-6', this.class()),
  );

  onSubmit(): void {
    this.submitted.emit({
      name: this.name(),
      email: this.email(),
      password: this.password(),
      acceptTerms: this.acceptTerms(),
    });
  }
}
