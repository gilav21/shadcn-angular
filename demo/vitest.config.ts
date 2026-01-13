import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => ({
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['src/test-setup.ts'],
        include: ['**/*.spec.ts', '../../packages/**/*.spec.ts'],
        reporters: ['default'],
    },
    define: {
        'import.meta.vitest': mode !== 'production',
    },
}));
