<?php

declare(strict_types=1);

namespace App\Logging;

use Illuminate\Support\Facades\Http;
use Monolog\Handler\AbstractProcessingHandler;
use Monolog\Level;
use Monolog\LogRecord;

/**
 * Posts ERROR+ records to the app's private alerts Discord channel (#alerts)
 * (fleet-app-specification §5 "Error notification").
 *
 * Deliberately NOT Monolog's SlackWebhookHandler: Discord's Slack-compat
 * endpoint 400s that handler's attachment payload (its footer_icon carries an
 * emoji name where a URL belongs) and it hard-rejects >2000-char text instead
 * of truncating — so real exceptions would be dropped silently. This handler
 * sends the slack-simple {username, text} shape, truncated with headroom, to
 * the same `<webhook>/slack` URL. Detail lives in Loki (and Sentry, once
 * wired); this is only the human-notification leg.
 */
final class DiscordLogHandler extends AbstractProcessingHandler
{
    private const int MAX_TEXT = 1900; // Discord rejects at 2000; keep headroom

    public function __construct(
        private readonly string $url,
        private readonly string $username = 'Laravel',
        int|string|Level $level = Level::Error,
        bool $bubble = true,
    ) {
        parent::__construct($level, $bubble);
    }

    protected function write(LogRecord $record): void
    {
        if ($this->url === '') {
            return; // env unset (local dev) — channel is inert
        }

        Http::asJson()->timeout(5)->post($this->url, [
            'username' => $this->username,
            'text' => mb_substr(
                sprintf('**%s.%s** — %s', $record->channel, $record->level->getName(), $record->message),
                0,
                self::MAX_TEXT,
            ),
        ]);
    }
}
