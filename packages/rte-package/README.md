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
- Works in zoneless apps.
- **No Tailwind required.** The package ships its styles precompiled; your app
  does not need Tailwind, PostCSS or any CSS setup of its own.

## Install

```bash
ng add @gilav21/shadcn-angular-rte
```

That installs the package and registers its stylesheet in `angular.json`.
Nothing else to configure.

Can't run `ng add`? Install with npm and add the stylesheet to the `styles`
array of your app's build target yourself:

```json
"styles": ["@gilav21/shadcn-angular-rte/styles.css", "src/styles.css"]
```

### What the stylesheet does — and doesn't — touch

`styles.css` styles only the editor and its overlays. It does **not** restyle your app:

- Tailwind's reset is scoped to the package's own elements — your `body`,
  headings and buttons keep their styles.
- The design tokens (`--primary`, `--background`, …) are declared at zero
  specificity, so tokens your app already defines — for example from
  `npx shadcn-angular init` — win.
- Apps that run their own Tailwind build are fine: the package's utilities
  coexist with yours.
- Text uses **your app's font** — the package sets no `font-family` of its own,
  so it matches your typography. An app with no font set shows the browser
  default (usually a serif); set one on `body` (for example
  `font-family: system-ui, sans-serif`) for the familiar shadcn look.

## Themes

`ui-rich-text-editor` takes a `theme` input with the same presets `npx shadcn-angular
change-theme` offers: `zinc`, `slate`, `stone`, `gray`, `neutral`, `red`, `rose`, `orange`, `green`, `blue`, `yellow`, `violet`, `amber`.

```html
<ui-rich-text-editor theme="violet" … />
```

The preset applies to that instance only, including its menus, popovers,
tooltips and dialogs, and it follows `.dark` mode. Leave `theme` unset to
use your app's tokens.

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
document direction. Density is driven by CSS custom properties; override
`--density` (or `--density-rich-text-editor`) in your own stylesheet to scale
spacing.

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

**Nothing is styled.** The stylesheet is not registered. Re-run `ng add @gilav21/shadcn-angular-rte`,
or check that `"@gilav21/shadcn-angular-rte/styles.css"` is in your build target's `styles` array.

**A package element looks off in my app.** Global rules your app declares
outside any `@layer` (say `button { padding: 1rem }`) beat the package's
styles, which live in cascade layers. Scope such rules to your own markup, or
put your global stylesheet in a layer. To restyle a package element on purpose,
pass classes through its `class` input.

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
