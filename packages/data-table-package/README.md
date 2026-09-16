# @gilav21/shadcn-angular-data-table

The shadcn-angular data table, compiled and published as a normal npm package:
the base table plus the context-menu, export and pivot addons.

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
ng add @gilav21/shadcn-angular-data-table
```

That installs the package and registers its stylesheet in `angular.json`.
Nothing else to configure.

Can't run `ng add`? Install with npm and add the stylesheet to the `styles`
array of your app's build target yourself:

```json
"styles": ["@gilav21/shadcn-angular-data-table/styles.css", "src/styles.css"]
```

### What the stylesheet does — and doesn't — touch

`styles.css` styles only the table and its overlays. It does **not** restyle your app:

- Tailwind's reset is scoped to the package's own elements — your `body`,
  headings and buttons keep their styles.
- The design tokens (`--primary`, `--background`, …) are declared at zero
  specificity, so tokens your app already defines — for example from
  `npx shadcn-angular init` — win.
- Apps that run their own Tailwind build are fine: the package's utilities
  coexist with yours.

## Themes

`ui-data-table` takes a `theme` input with the same presets `npx shadcn-angular
change-theme` offers: `zinc`, `slate`, `stone`, `gray`, `neutral`, `red`, `rose`, `orange`, `green`, `blue`, `yellow`, `violet`, `amber`.

```html
<ui-data-table theme="violet" … />
```

The preset applies to that instance only, including its menus, popovers,
tooltips and dialogs, and it follows `.dark` mode. Leave `theme` unset to
use your app's tokens.

## Usage

```ts
import { Component } from '@angular/core';
import {
  DataTableComponent,
  DataTableContextMenuDirective,
  DataTableExportDirective,
  DataTablePivotDirective,
  type ColumnDef,
} from '@gilav21/shadcn-angular-data-table';

interface Row { name: string; team: string; score: number; }

@Component({
  selector: 'app-sales',
  imports: [
    DataTableComponent,
    DataTableContextMenuDirective,
    DataTableExportDirective,
    DataTablePivotDirective,
  ],
  template: `
    <ui-data-table
      uiDtContextMenu uiDtExport uiDtPivot #pv="uiDtPivot"
      [data]="rows" [columns]="columns" />
  `,
})
export class SalesComponent {
  readonly rows: Row[] = [
    { name: 'Alice', team: 'A', score: 50 },
    { name: 'Bob', team: 'B', score: 40 },
    { name: 'Charlie', team: 'A', score: 30 },
  ];
  readonly columns: ColumnDef<Row>[] = [
    { key: 'name', header: 'Name' },
    { key: 'team', header: 'Team' },
    { key: 'score', header: 'Score' },
  ];
}
```

## Addons

| Directive | Attribute | What it adds |
|---|---|---|
| `DataTableContextMenuDirective` | `uiDtContextMenu` | Row action menu (⋮ button, right-click, long-press) |
| `DataTableExportDirective` | `uiDtExport` | CSV / clipboard export of the current view |
| `DataTablePivotDirective` | `uiDtPivot` | Grouping and aggregation (`getPivot()`) |

Each is optional — add only the attributes you want.

## Locale, RTL and density

`[locale]` is set per table instance, and RTL follows the document direction.
Density is driven by CSS custom properties; override
`--density` (or `--density-data-table`) in your own stylesheet to scale row
height and padding.

## Selectors are fixed

The CLI's `--prefix` flag has no equivalent here. Compiled components carry the
selectors they were built with, so the tag is always `ui-data-table` and the
addon attributes are always `uiDt*`.

## Configuration is inputs-only

There is no provider or injection-token configuration API. Everything is
configured through component inputs — the same as the copy model.

## Mixing with CLI-copied components

You can use this package and CLI-copied components in the same app. Selectors
coexist, and both render fine.

One thing to know: the package carries **its own** singletons. A service or
i18n token instance from your copied `src/components/ui/**` is *not* the same
instance the package's table uses, so `[locale]` must be set on the package
table itself rather than inherited from a copied component.

## Troubleshooting

**Nothing is styled.** The stylesheet is not registered. Re-run `ng add @gilav21/shadcn-angular-data-table`,
or check that `"@gilav21/shadcn-angular-data-table/styles.css"` is in your build target's `styles` array.

**A package element looks off in my app.** Global rules your app declares
outside any `@layer` (say `button { padding: 1rem }`) beat the package's
styles, which live in cascade layers. Scope such rules to your own markup, or
put your global stylesheet in a layer. To restyle a package element on purpose,
pass classes through its `class` input.

**`npm install` fails with a peer error on `@angular/core`.** This package
supports Angular 20 and 21. On Angular 19 or older, use the CLI copy model
instead — `npx shadcn-angular add data-table`.

## Versioning

This package versions independently of the `shadcn-angular` CLI. A component fix
reaches CLI users when it lands on `master`, but reaches package users only in
the next package release. Angular major upgrades require a rebuild and a new
major.

## License

MIT
