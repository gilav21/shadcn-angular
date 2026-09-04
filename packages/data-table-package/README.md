# @gilav21/shadcn-angular-data-table

The shadcn-angular data table, compiled and published as a normal npm package:
the base table plus the context-menu, export and pivot addons.

Same `ui-*` selectors, the same inputs and the same behaviour as the CLI copy
model — but nothing lands in your source tree, and `npm update` brings the
fixes.

## Requirements

- **Angular ≥ 21** (peer `^21.0.0`). Angular 20 consumers should use the CLI
  copy model instead — `npx shadcn-angular add data-table`.
- **Tailwind CSS v4**.
- Works in zoneless apps.

## Install

```bash
npm install @gilav21/shadcn-angular-data-table
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
@source "../node_modules/@gilav21/shadcn-angular-data-table";
@import "@gilav21/shadcn-angular-data-table/theme.css";
```

- The `@source` line is **required**. Tailwind v4 does not scan `node_modules`
  by default, so without it none of the table's utility classes are generated
  and the table renders unstyled.
- The `theme.css` import ships the design tokens (`:root` / `.dark` custom
  properties, `@theme inline`, base layer). **Skip it if your app is already
  CLI-initialised** (`npx shadcn-angular init` wrote the same tokens into your
  own stylesheet, and importing both duplicates the `:root` block).

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
Density is driven by the CSS custom properties in `theme.css`; override
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

**Nothing is styled.** The `@source` line is missing or points at the wrong
path. It must resolve, from the stylesheet's own location, to this package
inside `node_modules`.

**Colours are missing / everything is transparent.** `theme.css` was not
imported and your app has no shadcn token block of its own. Add the third CSS
line.

**`npm install` fails with a peer error on `@angular/core@"^21.0.0"`.** This
package requires Angular 21. Use the CLI copy model on Angular 20.

## Versioning

This package versions independently of the `shadcn-angular` CLI. A component fix
reaches CLI users when it lands on `master`, but reaches package users only in
the next package release. Angular major upgrades require a rebuild and a new
major.

## License

MIT
