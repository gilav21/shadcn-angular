import { FieldContext } from './field.component';

export function registerFieldDescribedBy(context: FieldContext | null, id: string, suffix: string): string {
  if (!context) return '';
  const generatedId = id || `${context.fieldId}-${suffix}`;
  context.registerDescribedBy(generatedId);
  return generatedId;
}

export function unregisterFieldDescribedBy(context: FieldContext | null, generatedId: string): void {
  if (context && generatedId) {
    context.unregisterDescribedBy(generatedId);
  }
}
