import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  ButtonComponent,
  DialogComponent,
  DialogContentComponent,
  DialogDescriptionComponent,
  DialogFooterComponent,
  DialogHeaderComponent,
  DialogTitleComponent,
  DialogTriggerComponent,
  InputComponent,
  LabelComponent,
} from '../../../../../packages/components/ui';

@Component({
  selector: 'app-dialog-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonComponent,
    DialogComponent,
    DialogContentComponent,
    DialogDescriptionComponent,
    DialogFooterComponent,
    DialogHeaderComponent,
    DialogTitleComponent,
    DialogTriggerComponent,
    InputComponent,
    LabelComponent,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="dialog" class="text-2xl font-semibold scroll-m-20">Dialog</h2>
      <p class="text-muted-foreground">Modal dialog with overlay.</p>

      <ui-dialog #uiDialog>
        <ui-dialog-trigger>
          <ui-button>Open Dialog</ui-button>
        </ui-dialog-trigger>
        <ui-dialog-content>
          <ui-dialog-header>
            <ui-dialog-title>Edit Profile</ui-dialog-title>
            <ui-dialog-description>
              Make changes to your profile here. Click save when you're done.
            </ui-dialog-description>
          </ui-dialog-header>
          <div class="grid gap-4 py-4">
            <div class="grid gap-2">
              <ui-label>Name</ui-label>
              <ui-input placeholder="Your name" />
            </div>
            <div class="grid gap-2">
              <ui-label>Email</ui-label>
              <ui-input type="email" placeholder="your@email.com" />
            </div>
          </div>
          <ui-dialog-footer>
            <ui-button (click)="uiDialog.hide()" (keydown.enter)="uiDialog.hide()">Save changes</ui-button>
          </ui-dialog-footer>
        </ui-dialog-content>
      </ui-dialog>
    </section>
  `,
})
export class DialogDemoComponent {}
