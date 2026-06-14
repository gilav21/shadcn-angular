import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ButtonComponent,
  DialogComponent,
  DialogContentComponent,
  DialogDescriptionComponent,
  DialogHeaderComponent,
  DialogTitleComponent,
  DialogTriggerComponent,
  RichTextEditorComponent,
} from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { EDITOR_IN_DIALOG_DEMO_LOCALES } from './editor-in-dialog-demo.locales';

/**
 * Regression demo for toolbar popovers rendering above a modal. The same editor
 * is shown inside our `ui-dialog`, a native `<dialog>` (top layer), and a plain
 * high z-index modal — opening a toolbar popover (color/link/table) must paint
 * above the modal in all three.
 */
@Component({
  selector: 'app-editor-in-dialog-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    ButtonComponent,
    DialogComponent,
    DialogContentComponent,
    DialogDescriptionComponent,
    DialogHeaderComponent,
    DialogTitleComponent,
    DialogTriggerComponent,
    RichTextEditorComponent,
  ],
  template: `
    <section class="space-y-6">
      <h2 id="editor-in-dialog" class="text-2xl font-semibold scroll-m-20">{{ t().title }}</h2>
      <p class="text-muted-foreground max-w-2xl">{{ t().description }}</p>

      <div class="flex flex-wrap gap-3">
        <ui-dialog #uiDialog>
          <ui-dialog-trigger>
            <ui-button>{{ t().openOurLabel }}</ui-button>
          </ui-dialog-trigger>
          <ui-dialog-content class="sm:max-w-2xl">
            <ui-dialog-header>
              <ui-dialog-title>{{ t().ourDialogHeading }}</ui-dialog-title>
              <ui-dialog-description>{{ t().ourDialogHint }}</ui-dialog-description>
            </ui-dialog-header>
            <div class="py-2">
              <ui-rich-text-editor
                mode="markdown"
                toolbar="top"
                minHeight="160px"
                [placeholder]="t().editorPlaceholder"
                [(ngModel)]="content"
              />
            </div>
          </ui-dialog-content>
        </ui-dialog>

        <ui-button (click)="openNative()" (keydown.enter)="openNative()">{{ t().openNativeLabel }}</ui-button>
        <ui-button (click)="openHighZ()" (keydown.enter)="openHighZ()">{{ t().openHighZLabel }}</ui-button>
      </div>

      <!-- Native <dialog> opened via showModal() — the top-layer reproducer. -->
      <dialog
        #nativeDialog
        class="m-auto w-full max-w-[calc(100vw-2rem)] sm:max-w-2xl space-y-4 rounded-lg border bg-background text-foreground p-4 sm:p-6 backdrop:bg-black/50"
      >
        <div class="space-y-1">
          <h3 class="text-lg font-medium">{{ t().nativeDialogHeading }}</h3>
          <p class="text-sm text-muted-foreground">{{ t().nativeDialogHint }}</p>
        </div>
        <ui-rich-text-editor
          mode="markdown"
          toolbar="top"
          minHeight="160px"
          [placeholder]="t().editorPlaceholder"
          [(ngModel)]="content"
        />
        <div class="flex flex-wrap justify-end gap-2">
          <ui-button (click)="closeNative()" (keydown.enter)="closeNative()">{{ t().closeLabel }}</ui-button>
        </div>
      </dialog>

      <!-- Plain high z-index modal (third-party style, normal layer). -->
      @if (highZModalOpen()) {
        <div class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div class="w-full max-w-[calc(100vw-2rem)] sm:max-w-2xl space-y-4 rounded-lg border bg-background p-4 sm:p-6 shadow-lg">
            <div class="space-y-1">
              <h3 class="text-lg font-medium">{{ t().highZHeading }}</h3>
              <p class="text-sm text-muted-foreground">{{ t().highZHint }}</p>
            </div>
            <ui-rich-text-editor
              mode="markdown"
              toolbar="top"
              minHeight="160px"
              [placeholder]="t().editorPlaceholder"
              [(ngModel)]="content"
            />
            <div class="flex flex-wrap justify-end gap-2">
              <ui-button (click)="closeHighZ()" (keydown.enter)="closeHighZ()">{{ t().closeLabel }}</ui-button>
            </div>
          </div>
        </div>
      }
    </section>
  `,
})
export class EditorInDialogDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(
    () => EDITOR_IN_DIALOG_DEMO_LOCALES[this.localeId()] ?? EDITOR_IN_DIALOG_DEMO_LOCALES['en'],
  );

  protected readonly nativeDialog = viewChild<ElementRef<HTMLDialogElement>>('nativeDialog');
  protected readonly highZModalOpen = signal(false);
  protected content = '';

  protected openNative(): void {
    this.nativeDialog()?.nativeElement.showModal();
  }

  protected closeNative(): void {
    this.nativeDialog()?.nativeElement.close();
  }

  protected openHighZ(): void {
    this.highZModalOpen.set(true);
  }

  protected closeHighZ(): void {
    this.highZModalOpen.set(false);
  }
}
