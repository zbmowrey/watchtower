<?php

/*
 * Fleet scheduler dead-man switch — fleet-app-specification §5.
 * MERGE the Schedule block below into the app's routes/console.php, and the
 * 'heartbeat' entry into config/services.php (env() may only be read in
 * config files — spec §5 / HygieneTest).
 *
 * How it works: the scheduler pod pings the app's healthchecks.io check
 * every five minutes; if pings stop (crashed scheduler, wedged cron, dead
 * node), healthchecks.io alerts the #alerts Discord channel + email
 * after the 15-minute grace. The URL comes from the k8s chart
 * (SCHEDULE_HEARTBEAT_URL in infra/<app>/values.yaml); locally it is unset
 * and the ping is skipped — the task itself is a no-op either way.
 *
 * Why the hand-rolled ping and NOT ->thenPingIf(): Laravel's built-in
 * scheduler ping REPORTS a failed ping through the exception handler
 * (Illuminate\Console\Scheduling\Event::pingCallback), so a transient cURL
 * timeout reaching hc-ping.com surfaces as a production.ERROR in the app's
 * #<app>-errors Discord channel. But failing to REACH the dead-man monitor
 * is not an application fault — it is the exact condition healthchecks.io
 * itself detects and alerts on (#fleet-alerts) when pings stop. So we own
 * the ping and swallow its transport error at debug level; healthchecks.io
 * stays the single source of truth for "the scheduler stopped pinging".
 * Do NOT "simplify" this back to ->thenPingIf() — that reintroduces the
 * redundant, mis-routed error noise this replaces.
 */

// ── routes/console.php ──────────────────────────────────────────────────────
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schedule;

Schedule::call(static fn (): bool => true)
    ->name('fleet-heartbeat')
    ->everyFiveMinutes()
    ->then(static function (): void {
        $url = (string) config('services.heartbeat.url');

        if ($url === '') {
            return; // unset locally — skip the ping, as before
        }

        try {
            Http::timeout(10)->get($url);
        } catch (Throwable $e) {
            // A missed heartbeat is the dead-man switch's job to detect
            // (healthchecks.io → #fleet-alerts after the 15-min grace).
            // Failing to reach the monitor is not an application error.
            Log::debug('fleet-heartbeat ping failed: '.$e->getMessage());
        }
    });

// ── config/services.php (add to the returned array) ─────────────────────────
// 'heartbeat' => [
//     'url' => env('SCHEDULE_HEARTBEAT_URL'),
// ],
