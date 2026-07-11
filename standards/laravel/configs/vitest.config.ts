import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './resources/js'),
        },
    },
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./tests/js/vitest.setup.ts'],
        include: [
            'resources/js/**/*.{test,spec}.{ts,tsx}',
            'tests/js/**/*.{test,spec}.{ts,tsx}',
        ],
        coverage: {
            provider: 'v8',
            reportsDirectory: './coverage',
            include: ['resources/js/**/*.{ts,tsx}'],
            exclude: [
                'resources/js/components/ui/**',
                'resources/js/types/**',
                'resources/js/routes/**',
                'resources/js/actions/**',
                'resources/js/wayfinder/**',
                '**/*.d.ts',
            ],
        },
    },
});
