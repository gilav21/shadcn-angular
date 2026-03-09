import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  ButtonComponent,
  InputComponent,
  LabelComponent,
  SheetCloseComponent,
  SheetComponent,
  SheetContentComponent,
  SheetDescriptionComponent,
  SheetFooterComponent,
  SheetHeaderComponent,
  SheetTitleComponent,
  SheetTriggerComponent,
} from '../../../../../packages/components/ui';

@Component({
  selector: 'app-sheet-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonComponent,
    InputComponent,
    LabelComponent,
    SheetCloseComponent,
    SheetComponent,
    SheetContentComponent,
    SheetDescriptionComponent,
    SheetFooterComponent,
    SheetHeaderComponent,
    SheetTitleComponent,
    SheetTriggerComponent,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="sheet" class="text-2xl font-semibold scroll-m-20">Sheet</h2>
      <p class="text-muted-foreground">Slide-out panel from the edge of the screen.</p>

      <div class="flex gap-2">
        <ui-sheet #sheetRight>
          <ui-sheet-trigger>
            <ui-button variant="outline">Open Right</ui-button>
          </ui-sheet-trigger>
          <ui-sheet-content side="right">
            <ui-sheet-header>
              <ui-sheet-title>Edit Profile</ui-sheet-title>
              <ui-sheet-description>
                Make changes to your profile here. Click save when you're done.
              </ui-sheet-description>
            </ui-sheet-header>
            <div class="grid gap-4 py-4">
              <div class="grid gap-2">
                <ui-label>Name</ui-label>
                <ui-input placeholder="Your name" />
              </div>
            </div>
            <ui-sheet-footer>
              <ui-sheet-close>
                <ui-button>Save changes</ui-button>
              </ui-sheet-close>
            </ui-sheet-footer>
          </ui-sheet-content>
        </ui-sheet>

        <ui-sheet #sheetLeft>
          <ui-sheet-trigger>
            <ui-button variant="outline">Open Left</ui-button>
          </ui-sheet-trigger>
          <ui-sheet-content side="left">
            <ui-sheet-header>
              <ui-sheet-title>Left Panel</ui-sheet-title>
              <ui-sheet-description>This panel slides in from the left.</ui-sheet-description>
            </ui-sheet-header>
          </ui-sheet-content>
        </ui-sheet>
      </div>
    </section>
  `,
})
export class SheetDemoComponent {}
