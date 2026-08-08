import { router } from '@inertiajs/react';
import { useEffect } from 'react';

/**
 * M-1 SPA-navigation a11y (fleet-frontend-specification §3). An Inertia visit
 * moves neither focus nor a screen-reader announcement — the classic SPA
 * regression vs server-rendered pages, invisible to vitest-axe. Mount once in
 * the root layout. On each completed visit (the initial load is skipped) this
 * moves focus to the <main> landmark and announces document.title via a
 * polite live region.
 */
export function useRouteAnnouncer(): void {
    useEffect(() => {
        const region = document.createElement('div');

        region.setAttribute('role', 'status');
        region.setAttribute('aria-live', 'polite');
        // Visually hidden WITHOUT display:none — display:none mutes live regions.
        region.style.cssText =
            'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap';
        document.body.append(region);

        let initialLoad = true;
        let announceTimer = 0;

        const unsubscribe = router.on('navigate', () => {
            if (initialLoad) {
                initialLoad = false;

                return;
            }

            const main =
                document.querySelector<HTMLElement>('main') ?? document.body;

            // tabIndex -1 makes the landmark programmatically focusable without
            // joining the tab order; dropped again on blur so the DOM stays clean.
            main.tabIndex = -1;
            // preventScroll — Inertia owns scroll position (restoration + reset).
            main.focus({ preventScroll: true });
            main.addEventListener(
                'blur',
                () => main.removeAttribute('tabindex'),
                { once: true },
            );

            // Inertia's <Head> commits the new title in an effect after the swap;
            // a macrotask later it is settled.
            window.clearTimeout(announceTimer);
            announceTimer = window.setTimeout(() => {
                region.textContent = document.title;
            }, 0);
        });

        return () => {
            unsubscribe();
            window.clearTimeout(announceTimer);
            region.remove();
        };
    }, []);
}
