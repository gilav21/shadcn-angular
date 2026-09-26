/**
 * Characters that make Excel, LibreOffice and Google Sheets read a cell as a
 * formula when they lead it (OWASP "CSV Injection"). Tab and CR are on the list
 * because some importers strip them and then see the character behind.
 */
const FORMULA_TRIGGERS = new Set(['=', '+', '-', '@', '\t', '\r']);

/** A whole cell that is a signed decimal number, which a spreadsheet stores as a number, never a formula. */
const PLAIN_NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;

/**
 * Whether a cell must be quoted. A cell that already starts with the quote
 * counts when the text behind it does, so that a genuine `'=x` is quoted to
 * `''=x` and {@link restoreSpreadsheetText} can undo exactly what was added.
 */
function needsFormulaGuard(cell: string): boolean {
  let start = 0;
  while (cell.charAt(start) === "'") start++;
  const text = cell.slice(start);
  return FORMULA_TRIGGERS.has(text.charAt(0)) && !PLAIN_NUMBER.test(text);
}

/**
 * Makes a cell safe to hand to a spreadsheet: a value that starts with `=`,
 * `+`, `-`, `@`, a tab or a carriage return gets a leading single quote, so
 * the spreadsheet stores it as text rather than running it as a formula (for
 * example `=HYPERLINK(...)` or a DDE payload typed by an end user). A cell
 * whose whole text is a plain number, such as `-12`, `+3.5` or `-1e3`, is left
 * alone so it stays numeric.
 *
 * Apply it to every cell of a CSV/TSV export or a clipboard copy, before any
 * CSV quoting. XLSX needs no guard, because it stores strings as typed string
 * cells. {@link restoreSpreadsheetText} is its exact inverse.
 *
 * @example
 * guardSpreadsheetFormula('=SUM(A1:A2)'); // "'=SUM(A1:A2)"
 * guardSpreadsheetFormula('-12');         // "-12"
 */
export function guardSpreadsheetFormula(cell: string): string {
  return needsFormulaGuard(cell) ? `'${cell}` : cell;
}

/**
 * Undoes {@link guardSpreadsheetFormula}: drops the leading single quote
 * only when the rest of the cell is something the guard would have quoted,
 * the way a spreadsheet consumes that quote on paste. Any other text,
 * including an ordinary value that starts with an apostrophe, is returned
 * unchanged, so `restoreSpreadsheetText(guardSpreadsheetFormula(x)) === x`
 * for every string.
 */
export function restoreSpreadsheetText(cell: string): string {
  if (cell.startsWith("'") && needsFormulaGuard(cell.slice(1))) {
    return cell.slice(1);
  }
  return cell;
}
