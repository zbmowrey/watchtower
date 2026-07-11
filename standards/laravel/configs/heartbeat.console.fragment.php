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
 */

// ── routes/console.php ──────────────────────────────────────────────────────
use Illuminate\Support\Facades\Schedule;

Schedule::call(static fn (): bool => true)
    ->name('fleet-heartbeat')
    ->everyFiveMinutes()
    ->thenPingIf(
        (bool) config('services.heartbeat.url'),
        (string) config('services.heartbeat.url'),
    );

// ── config/services.php (add to the returned array) ─────────────────────────
// 'heartbeat' => [
//     'url' => env('SCHEDULE_HEARTBEAT_URL'),
// ],
