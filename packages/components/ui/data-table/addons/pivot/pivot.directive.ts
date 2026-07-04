import { Directive, inject } from '@angular/core';
import { DataTableAddonHost } from '../..';
import { computePivot, type PivotConfig, type PivotResult } from './pivot.utils';

/**
 * Opt-in pivot addon for `<ui-data-table>`. Attaches via DI to the
 * `DataTableAddonHost` the base provides and exposes `getPivot(config)` — a
 * pivot (rows x columns x values) of the table's raw data computed through the
 * base's accessors. Grab a template reference (`#pv="uiDtPivot"`) and bind the
 * result's `columns` / `rows` to another `<ui-data-table>` to render it. The
 * base ships no pivot code; the pure `computePivot` is re-exported for callers
 * that pivot arbitrary data without a table instance.
 */
@Directive({
  selector: '[uiDtPivot]',
  standalone: true,
  exportAs: 'uiDtPivot',
})
export class DataTablePivotDirective<T = unknown> {
  private readonly host = inject<DataTableAddonHost<T>>(DataTableAddonHost);

  /**
   * Compute a pivot of the table's current raw data, using its accessors (so
   * `accessorFn` / dotted keys work). Bind the result's `columns` / `rows` to
   * another `<ui-data-table>` to render the pivot.
   */
  getPivot(config: PivotConfig): PivotResult {
    return computePivot(this.host.getRawRows(), config, (row, key) =>
      this.host.getCellValue(row, key),
    );
  }
}
