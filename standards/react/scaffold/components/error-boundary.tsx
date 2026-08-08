import { router } from '@inertiajs/react';
import { Component, type ReactNode } from 'react';

interface ErrorBoundaryProps {
    children: ReactNode;
    /**
     * Crash UI. The look is expressive-tier — each app supplies its own via
     * this prop; the boundary itself never renders styled markup.
     */
    fallback: (error: Error, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
    error: Error | null;
}

/**
 * M-1 recovery primitive (fleet-frontend-specification §5). Reporting is NOT
 * done here — createRoot's onCaughtError/onUncaughtError own that centrally in
 * app.tsx, so a boundary never double-reports. This component owns recovery UX
 * only: render the fallback, and reset on the next successful Inertia
 * navigation so a crashed page never outlives the visit that caused it.
 * Placement: one at the root (MUST), one around each heavy bespoke surface
 * (SHOULD).
 */
export class ErrorBoundary extends Component<
    ErrorBoundaryProps,
    ErrorBoundaryState
> {
    override state: ErrorBoundaryState = { error: null };
    private unsubscribe: VoidFunction | null = null;

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { error };
    }

    override componentDidMount(): void {
        this.unsubscribe = router.on('navigate', () => {
            if (this.state.error) {
                this.setState({ error: null });
            }
        });
    }

    override componentWillUnmount(): void {
        this.unsubscribe?.();
    }

    override render(): ReactNode {
        if (this.state.error) {
            return this.props.fallback(this.state.error, () => {
                this.setState({ error: null });
            });
        }

        return this.props.children;
    }
}
