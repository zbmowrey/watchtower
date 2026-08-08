<?php

declare(strict_types=1);

namespace App\Providers;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;
use RuntimeException;

/**
 * Fleet-standard provider — implements fleet-app-specification §5.
 *
 * This file is BYTE-IDENTICAL across every app and locked by `bin/arch-drift`:
 * it does nothing but install the fleet runtime guardrails. App-specific
 * container bindings, model observers, and rate limiting live in a separate,
 * per-domain provider (e.g. RepositoryServiceProvider, ContentServiceProvider)
 * registered in bootstrap/providers.php — never here.
 */
class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    #[\Override]
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();
    }

    /**
     * The fleet runtime guardrails — identical on every app (spec §5).
     */
    protected function configureDefaults(): void
    {
        // All environments
        Date::use(CarbonImmutable::class);

        // An unmapped polymorphic relation stores the model's FQCN in the type
        // column — latent data corruption plus a refactor landmine. Apps define
        // their morph map in the per-domain provider; with no polymorphics this
        // guard is inert.
        Relation::requireMorphMap();

        // Auto-batch relationship access on a collection into a single eager
        // load — the fix-side companion to shouldBeStrict's preventLazyLoading.
        Model::automaticallyEagerLoadRelationships();

        // Per-request CSP nonce: Vite stamps it on the tags it emits and the
        // SecurityHeaders middleware reads it into script-src, letting us drop
        // 'unsafe-inline' from scripts (a documented tradeoff). style-src
        // keeps 'unsafe-inline' (a documented tradeoff — Radix/@dnd-kit inline style attributes).
        Vite::useCspNonce();

        // Prefetch a page's manifest assets (incl. its lazy chunks) after load,
        // 3 at a time — instant navigation without an all-at-once request burst.
        // 'waterfall' over 'aggressive' so chunk-heavy public pages don't fan out
        // the whole manifest on first load.
        Vite::prefetch(concurrency: 3);

        // Behind a TLS-terminating proxy (Cloudflare → ingress) the pod sees
        // plain HTTP, so url()/route()/redirects would emit http:// links on an
        // https page (mixed content, blocked on form POST). Pin generated URLs to
        // the canonical origin whenever APP_URL is https — covers staging, not
        // just prod; local http://localhost is left untouched.
        if (str_starts_with((string) config('app.url'), 'https://')) {
            URL::forceScheme('https');
            URL::useOrigin((string) config('app.url'));
        }

        // Production
        if (app()->isProduction()) {
            // Fail closed if a production image ships with debug rendering on —
            // Ignition error pages leak APP_KEY, DB credentials, etc.
            if (config('app.debug') === true) {
                throw new RuntimeException('APP_DEBUG must be false in production.');
            }

            DB::prohibitDestructiveCommands();

            Password::defaults(fn (): Password => Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised());

            // The two CORRECTNESS strictness flags stay on in production — a
            // silently discarded attribute or a missing-attribute read is a data
            // bug wherever it happens. Violations report() to Sentry instead of
            // throwing, so the request survives (the performance flag,
            // preventLazyLoading, stays off: automaticallyEagerLoadRelationships
            // degrades that miss gracefully).
            Model::preventSilentlyDiscardingAttributes();
            Model::preventAccessingMissingAttributes();
            Model::handleDiscardedAttributeViolationUsing(
                function (Model $model, array $keys): void {
                    report(new RuntimeException(sprintf(
                        'Silently discarded attributes [%s] on %s.',
                        implode(', ', $keys),
                        $model::class,
                    )));
                },
            );
            Model::handleMissingAttributeViolationUsing(
                function (Model $model, string $key): void {
                    report(new RuntimeException(sprintf(
                        'Accessed missing attribute [%s] on %s.',
                        $key,
                        $model::class,
                    )));
                },
            );

            return;
        }

        // Non-production: strict mode flags N+1, mass-assignment drift, and
        // accidental missing-attribute reads loudly (throwing). The lazy-load
        // flag stays dev-only; the two correctness flags carry into production
        // above in report() form.
        Model::shouldBeStrict();

        // Non-production mail sink: a staging box with real SMTP credentials
        // must never mail a real customer. Inert when the config key is unset
        // (the same pattern as the scheduler heartbeat).
        $mailRedirect = config('mail.dev_redirect');

        if (is_string($mailRedirect) && $mailRedirect !== '') {
            Mail::alwaysTo($mailRedirect);
        }
    }
}
