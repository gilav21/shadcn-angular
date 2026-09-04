# @gilav21/shadcn-angular-rte

The shadcn-angular rich-text editor, compiled and published as a normal npm
package: the base editor plus all 13 addons (`RTE_FULL`).

Same `ui-*` selectors, the same inputs and the same behaviour as the CLI copy
model — but nothing lands in your source tree, and `npm update` brings the
fixes.

## Requirements

- **Angular 20 or 21** (peer `>=20.0.0 <22.0.0`). Both majors are covered by
  the e2e suite, which installs this package's real tarball into a pristine
  Angular 20 app and a pristine Angular 21 app and builds both.
- **Tailwind CSS v4**.
- Works in zoneless apps.

## Install

```bash
npm install @gilav21/shadcn-angular-rte
npm install -D tailwindcss @tailwindcss/postcss postcss
```

If you do not already have Tailwind wired up, add `.postcssrc.json`:

```json
{ "plugins": { "@tailwindcss/postcss": {} } }
```

## Styles

Add these three lines to your global stylesheet:

```css
@import "tailwindcss";
@source "../node_modules/@gilav21/shadcn-angular-rte";
@import "@gilav21/shadcn-angular-rte/theme.css";
```

- The `@source` line is **required**. Tailwind v4 does not scan `node_modules`
  by default, so without it none of the editor's utility classes are generated
  and the editor renders unstyled.
- The `theme.css` import ships the design tokens (`:root` / `.dark` custom
  properties, `@theme inline`, base layer). **Skip it if your app is already
  CLI-initialised** (`npx shadcn-angular init` wrote the same tokens into your
  own stylesheet, and importing both duplicates the `:root` block).

## Usage

### Simple — everything on

```ts
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RichTextEditorComponent, RTE_FULL } from '@gilav21/shadcn-angular-rte';

@Component({
  selector: 'app-root',
  imports: [FormsModule, RichTextEditorComponent, RTE_FULL],
  template: `<ui-rich-text-editor uiRteFull mode="html" [(ngModel)]="html" />`,
})
export class AppComponent {
  html = signal('<p>Hello</p>');
}
```

### Custom — pick the addons you want

```ts
import {
  RichTextEditorComponent,
  RichTextMentionsDirective,
  RichTextActionsDirective,
  type MentionItem,
  type RichTextEntitySearchFn,
  type RichTextActionDefinition,
} from '@gilav21/shadcn-angular-rte';

@Component({
  imports: [RichTextEditorComponent, RichTextMentionsDirective, RichTextActionsDirective],
  template: `
    <ui-rich-text-editor
      uiRteMentions [uiRteMentionsSearch]="search"
      uiRteActions  [uiRteActions]="actions"
      locale="he" />
  `,
})
export class DocComponent {
  readonly search: RichTextEntitySearchFn<MentionItem> =
    q => [{ id: '1', value: 'ann', label: `Ann ${q}` }];
  readonly actions: RichTextActionDefinition[] = [/* … */];
}
```

## Addons

`RTE_FULL` turns on all 13. To pick individually, import the directive and add
its attribute to `<ui-rich-text-editor>`:

| Directive | Attribute |
|---|---|
| `RichTextActionsDirective` | `uiRteActions` |
| `RichTextAiDirective` | `uiRteAi` |
| `RichTextColorsDirective` | `uiRteColors` |
| `RichTextEmojiDirective` | `uiRteEmoji` |
| `RichTextFileImportDirective` | `uiRteFileImport` |
| `RichTextHistoryDirective` | `uiRteHistory` |
| `RichTextImagesDirective` | `uiRteImages` |
| `RichTextLinksDirective` | `uiRteLinks` |
| `RichTextMentionsDirective` | `uiRteMentions` |
| `RichTextOutlineDirective` | `uiRteOutline` |
| `RichTextSlashCommandsDirective` | `uiRteSlashCommands` |
| `RichTextTablesDirective` | `uiRteTables` |
| `RichTextTypographyDirective` | `uiRteTypography` |

The document parsers behind `uiRteFileImport` (PDF, DOCX) are **lazy** — they
download only when a user actually imports a file.

## Locale, RTL and density

`[locale]` is set per editor instance (`locale="he"`), and RTL follows the
document direction. Density is driven by the CSS custom properties in
`theme.css`; override `--density` (or `--density-rich-text-editor`) in your own
stylesheet to scale spacing.

## Selectors are fixed

The CLI's `--prefix` flag has no equivalent here. Compiled components carry the
selectors they were built with, so the tags are always `ui-*` and the addon
attributes always `uiRte*`.

## Configuration is inputs-only

There is no provider or injection-token configuration API. Everything is
configured through component inputs — the same as the copy model.

## Mixing with CLI-copied components

You can use this package and CLI-copied components in the same app. Selectors
coexist, and both render fine.

One thing to know: the package carries **its own** singletons. A
`ShortcutBindingService`, i18n token or `AddonSlotRegistry` instance from your
copied `src/components/ui/**` is *not* the same instance the package's editor
uses. In practice:

- A shortcut registered on the copied service is invisible to the package
  editor, and vice versa.
- `[locale]` must be set on the package editor itself; setting it on a copied
  component does not carry over.

## Troubleshooting

**Nothing is styled.** The `@source` line is missing or points at the wrong
path. It must resolve, from the stylesheet's own location, to this package
inside `node_modules`.

**Colours are missing / everything is transparent.** `theme.css` was not
imported and your app has no shadcn token block of its own. Add the third CSS
line.

**`npm install` fails with a peer error on `@angular/core`.** This package
supports Angular 20 and 21. On Angular 19 or older, use the CLI copy model
instead — `npx shadcn-angular add rich-text-editor/full`.

## Versioning

This package versions independently of the `shadcn-angular` CLI. A component fix
reaches CLI users when it lands on `master`, but reaches package users only in
the next package release. Angular major upgrades require a rebuild and a new
major.

## License

MIT
