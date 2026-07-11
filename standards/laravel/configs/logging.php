<?php

declare(strict_types=1);

use Monolog\Handler\NullHandler;
use Monolog\Handler\StreamHandler;
use Monolog\Handler\SyslogUdpHandler;
use Monolog\Processor\PsrLogMessageProcessor;

/*
|--------------------------------------------------------------------------
| Fleet logging config — the golden reference
|--------------------------------------------------------------------------
|
| Standard Laravel logging config, generalized for the fleet. The channels
| are stock; the fleet rule lives in the ENV, not this file:
|
|   PROD (non-local): logs MUST go to stderr as structured JSON.
|     LOG_CHANNEL=stack  LOG_STACK=stderr
|     LOG_STDERR_FORMATTER=Monolog\Formatter\JsonFormatter  LOG_LEVEL=info
|   LOCAL: file logs are fine — LOG_STACK=single, LOG_LEVEL=debug.
|
| File-driver channels (single/daily) are FORBIDDEN in prod: the hardened
| pods run readOnlyRootFilesystem, so storage/logs is not writable and file
| logs are silently dropped (a documented tradeoff). stderr is captured
| by the container runtime → Alloy → Loki, and JSON parses into queryable
| fields. Spec: fleet-app-specification §5; rationale: logging-monitoring-ir.
| See the `.env` values in configs/logging.env.fragment.
|
| App-specific channels (e.g. a redaction/audit channel) MAY be added, but
| MUST use a stderr/monolog handler in prod — never a file path.
|
*/

return [

    'default' => env('LOG_CHANNEL', 'stack'),

    'deprecations' => [
        'channel' => env('LOG_DEPRECATIONS_CHANNEL', 'null'),
        'trace' => env('LOG_DEPRECATIONS_TRACE', false),
    ],

    'channels' => [

        // In prod, LOG_STACK=stderr,discord (file drivers forbidden — see header/a documented tradeoff).
        // Locally it defaults to `single` for a tailable storage/logs/laravel.log.
        // ignore_exceptions: true → WhatFailureGroupHandler: a failing webhook leg
        // (discord) can never take down a request; stderr keeps logging regardless.
        'stack' => [
            'driver' => 'stack',
            'channels' => explode(',', (string) env('LOG_STACK', 'single')),
            'ignore_exceptions' => true,
        ],

        // Local-dev / non-prod only. Never selected in prod (readOnlyRootFilesystem).
        'single' => [
            'driver' => 'single',
            'path' => storage_path('logs/laravel.log'),
            'level' => env('LOG_LEVEL', 'debug'),
            'replace_placeholders' => true,
        ],

        // Local-dev / non-prod only. Never selected in prod (readOnlyRootFilesystem).
        'daily' => [
            'driver' => 'daily',
            'path' => storage_path('logs/laravel.log'),
            'level' => env('LOG_LEVEL', 'debug'),
            'days' => env('LOG_DAILY_DAYS', 14),
            'replace_placeholders' => true,
        ],

        'slack' => [
            'driver' => 'slack',
            'url' => env('LOG_SLACK_WEBHOOK_URL'),
            'username' => env('LOG_SLACK_USERNAME', env('APP_NAME', 'Laravel')),
            'emoji' => env('LOG_SLACK_EMOJI', ':boom:'),
            'level' => env('LOG_LEVEL', 'critical'),
            'replace_placeholders' => true,
        ],

        // Error notifications → your app's private alerts Discord channel
        // (#alerts) (fleet-app-specification §5). NOT the stock `slack` driver: Discord's
        // Slack-compat endpoint 400s monolog's attachment payload (footer_icon)
        // and hard-rejects >2000-char text instead of truncating, silently
        // dropping real exceptions — see App\Logging\DiscordLogHandler (golden
        // copy in standards/laravel/app/Logging/). URL = channel webhook +
        // `/slack`, from the k8s Secret; unset locally = channel inert.
        'discord' => [
            'driver' => 'monolog',
            'handler' => App\Logging\DiscordLogHandler::class,
            'level' => env('LOG_DISCORD_LEVEL', 'error'),
            'with' => [
                'url' => (string) env('LOG_DISCORD_WEBHOOK_URL', ''),
                'username' => (string) env('APP_NAME', 'Laravel'),
            ],
            'processors' => [PsrLogMessageProcessor::class],
        ],

        'papertrail' => [
            'driver' => 'monolog',
            'level' => env('LOG_LEVEL', 'debug'),
            'handler' => env('LOG_PAPERTRAIL_HANDLER', SyslogUdpHandler::class),
            'handler_with' => [
                'host' => env('PAPERTRAIL_URL'),
                'port' => env('PAPERTRAIL_PORT'),
                'connectionString' => 'tls://'.env('PAPERTRAIL_URL').':'.env('PAPERTRAIL_PORT'),
            ],
            'processors' => [PsrLogMessageProcessor::class],
        ],

        // The fleet's prod channel. Set LOG_STDERR_FORMATTER=Monolog\Formatter\JsonFormatter
        // for structured JSON (Loki's json pipeline stage parses it into fields). Left unset,
        // it falls back to Monolog's default LineFormatter (text) — the scrub pipeline works
        // on either, but JSON is the go-forward standard (fleet-app-specification §5).
        'stderr' => [
            'driver' => 'monolog',
            'level' => env('LOG_LEVEL', 'debug'),
            'handler' => StreamHandler::class,
            'handler_with' => [
                'stream' => 'php://stderr',
            ],
            'formatter' => env('LOG_STDERR_FORMATTER'),
            'processors' => [PsrLogMessageProcessor::class],
        ],

        'syslog' => [
            'driver' => 'syslog',
            'level' => env('LOG_LEVEL', 'debug'),
            'facility' => env('LOG_SYSLOG_FACILITY', LOG_USER),
            'replace_placeholders' => true,
        ],

        'errorlog' => [
            'driver' => 'errorlog',
            'level' => env('LOG_LEVEL', 'debug'),
            'replace_placeholders' => true,
        ],

        'null' => [
            'driver' => 'monolog',
            'handler' => NullHandler::class,
        ],

        'emergency' => [
            'path' => storage_path('logs/laravel.log'),
        ],

    ],

];
