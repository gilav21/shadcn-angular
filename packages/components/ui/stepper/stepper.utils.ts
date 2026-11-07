import { cn } from '../../lib/utils';

/**
 * Classes for the bar joining two consecutive steps, shared by the simple-mode
 * connector, the template-mode auto connector and the projected separator so
 * all three draw the same line.
 *
 * Vertical: the bar's centre must sit on the 2rem indicator's centre, so the
 * inline-start margin is half the indicator (16px) minus half the bar (1px).
 * `horizontalPlacement` is the only part that differs by host (a flex-1 row
 * item vs a full-width bar inside a column item).
 */
export function stepperConnectorClasses(
  orientation: 'horizontal' | 'vertical',
  complete: boolean,
  horizontalPlacement: string,
): string {
  return cn(
    'transition-colors',
    orientation === 'vertical' ? 'ms-[15px] mt-2 mb-2 w-0.5 h-8' : `mx-2 h-0.5 ${horizontalPlacement}`,
    complete ? 'bg-primary' : 'bg-border',
  );
}
