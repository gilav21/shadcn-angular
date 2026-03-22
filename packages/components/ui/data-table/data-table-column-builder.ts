import { TemplateRef, Type } from '@angular/core';
import { ColumnDef } from './data-table.types';

type AccessorColumnOptions<T> = Omit<ColumnDef<T>, 'accessorKey' | 'header'>;

interface ColumnBuilder<T> {
  select(options?: Partial<ColumnDef<T>>): ColumnBuilder<T>;
  expander(options?: Partial<ColumnDef<T>>): ColumnBuilder<T>;
  actions(options?: Partial<ColumnDef<T>>): ColumnBuilder<T>;
  accessor<K extends keyof T & string>(
    key: K,
    header: string,
    options?: AccessorColumnOptions<T>
  ): ColumnBuilder<T>;
  template(
    key: keyof T & string,
    header: string,
    template: TemplateRef<unknown>,
    options?: AccessorColumnOptions<T>
  ): ColumnBuilder<T>;
  component(
    key: keyof T & string,
    header: string,
    component: Type<unknown>,
    options?: AccessorColumnOptions<T>
  ): ColumnBuilder<T>;
  custom(column: ColumnDef<T>): ColumnBuilder<T>;
  build(): ColumnDef<T>[];
}

export function columnHelper<T>(): ColumnBuilder<T> {
  const columns: ColumnDef<T>[] = [];

  const builder: ColumnBuilder<T> = {
    select(options?: Partial<ColumnDef<T>>): ColumnBuilder<T> {
      columns.push({
        accessorKey: '_selection',
        header: '',
        sticky: true,
        width: '40px',
        enableSorting: false,
        enableHiding: false,
        enableReordering: false,
        ...options,
      });
      return builder;
    },

    expander(options?: Partial<ColumnDef<T>>): ColumnBuilder<T> {
      columns.push({
        accessorKey: '_expander',
        header: '',
        sticky: true,
        width: '40px',
        enableSorting: false,
        enableHiding: false,
        enableReordering: false,
        ...options,
      });
      return builder;
    },

    actions(options?: Partial<ColumnDef<T>>): ColumnBuilder<T> {
      columns.push({
        accessorKey: '_actions',
        header: '',
        width: '50px',
        enableSorting: false,
        enableHiding: false,
        enableReordering: false,
        ...options,
      });
      return builder;
    },

    accessor<K extends keyof T & string>(
      key: K,
      header: string,
      options?: AccessorColumnOptions<T>
    ): ColumnBuilder<T> {
      columns.push({ accessorKey: key, header, ...options });
      return builder;
    },

    template(
      key: keyof T & string,
      header: string,
      template: TemplateRef<unknown>,
      options?: AccessorColumnOptions<T>
    ): ColumnBuilder<T> {
      columns.push({ accessorKey: key, header, template, ...options });
      return builder;
    },

    component(
      key: keyof T & string,
      header: string,
      component: Type<unknown>,
      options?: AccessorColumnOptions<T>
    ): ColumnBuilder<T> {
      columns.push({ accessorKey: key, header, component, ...options });
      return builder;
    },

    custom(column: ColumnDef<T>): ColumnBuilder<T> {
      columns.push(column);
      return builder;
    },

    build(): ColumnDef<T>[] {
      return [...columns];
    },
  };

  return builder;
}
