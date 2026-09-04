import { Directive, effect, inject, input } from '@angular/core';
import { RichTextEditorAddonHost } from '../../../../../packages/components/ui/rich-text-editor';

const ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`;

/**
 * Minimal addon: one toolbar button that inserts today's date at the caret.
 * Attach with `<ui-rich-text-editor uiRteInsertDate />`.
 *
 * This is the worked example from `docs/rich-text-editor.md` — the whole
 * extension contract in one file: inject the host, register a toolbar slot in
 * an `effect`, return the teardown through `onCleanup`, and mutate the document
 * only through a host seam so the edit records history like any other.
 */
@Directive({ selector: 'ui-rich-text-editor[uiRteInsertDate]' })
export class RichTextInsertDateDirective {
  private readonly host = inject(RichTextEditorAddonHost);

  /** `Intl.DateTimeFormat` locale for the inserted text; defaults to the browser's. */
  readonly uiRteInsertDateLocale = input<string>();
  /** Sort order among addon toolbar buttons; lower first. */
  readonly uiRteInsertDateOrder = input(900);

  constructor() {
    effect((onCleanup) => {
      onCleanup(this.host.toolbarSlots.register({
        id: 'insert-date',
        icon: ICON,
        tooltip: "Insert today's date",
        order: this.uiRteInsertDateOrder(),
        isEnabled: () => !this.host.readonly() && !this.host.disabled(),
        onClick: () => this.host.insertTextAtCaret(
          new Intl.DateTimeFormat(this.uiRteInsertDateLocale()).format(new Date()),
        ),
      }));
    });
  }
}
