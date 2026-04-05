import { describe, it, expect } from 'vitest';
import { columnHelper } from './data-table-column-builder';

interface TestRow {
    id: string;
    name: string;
    email: string;
    status: string;
}

describe('columnHelper', () => {
    it('should build empty column list', () => {
        const columns = columnHelper<TestRow>().build();
        expect(columns).toEqual([]);
    });

    it('should create accessor columns', () => {
        const columns = columnHelper<TestRow>()
            .accessor('name', 'Name')
            .accessor('email', 'Email')
            .build();

        expect(columns).toHaveLength(2);
        expect(columns[0].accessorKey).toBe('name');
        expect(columns[0].header).toBe('Name');
        expect(columns[1].accessorKey).toBe('email');
        expect(columns[1].header).toBe('Email');
    });

    it('should create selection column with defaults', () => {
        const columns = columnHelper<TestRow>()
            .select()
            .accessor('name', 'Name')
            .build();

        expect(columns[0].accessorKey).toBe('_selection');
        expect(columns[0].sticky).toBe(true);
        expect(columns[0].width).toBe('40px');
        expect(columns[0].enableSorting).toBe(false);
        expect(columns[0].enableHiding).toBe(false);
    });

    it('should create expander column', () => {
        const columns = columnHelper<TestRow>()
            .expander()
            .build();

        expect(columns[0].accessorKey).toBe('_expander');
        expect(columns[0].sticky).toBe(true);
        expect(columns[0].width).toBe('40px');
    });

    it('should create actions column', () => {
        const columns = columnHelper<TestRow>()
            .actions()
            .build();

        expect(columns[0].accessorKey).toBe('_actions');
        expect(columns[0].width).toBe('50px');
        expect(columns[0].enableReordering).toBe(false);
    });

    it('should support accessor options', () => {
        const sortFn = (a: TestRow, b: TestRow) => a.name.localeCompare(b.name);
        const columns = columnHelper<TestRow>()
            .accessor('name', 'Name', {
                enableSorting: true,
                sortFn,
                width: '200px',
                pin: 'left',
            })
            .build();

        expect(columns[0].enableSorting).toBe(true);
        expect(columns[0].sortFn).toBe(sortFn);
        expect(columns[0].width).toBe('200px');
        expect(columns[0].pin).toBe('left');
    });

    it('should support custom columns', () => {
        const columns = columnHelper<TestRow>()
            .custom({ accessorKey: 'custom', header: 'Custom', width: '100px' })
            .build();

        expect(columns[0].accessorKey).toBe('custom');
        expect(columns[0].header).toBe('Custom');
    });

    it('should support chaining all column types', () => {
        const columns = columnHelper<TestRow>()
            .select()
            .expander()
            .accessor('name', 'Name')
            .accessor('email', 'Email')
            .accessor('status', 'Status')
            .actions()
            .build();

        expect(columns).toHaveLength(6);
        expect(columns.map(c => c.accessorKey)).toEqual([
            '_selection', '_expander', 'name', 'email', 'status', '_actions'
        ]);
    });

    it('should return a copy of columns array', () => {
        const builder = columnHelper<TestRow>().accessor('name', 'Name');
        const cols1 = builder.build();
        const cols2 = builder.build();
        expect(cols1).toEqual(cols2);
        expect(cols1).not.toBe(cols2);
    });
});
