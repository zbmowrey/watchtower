<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Http\Responses\ApiProblem;
use App\Support\Auth\CurrentOperator;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

/**
 * `Idempotency-Key` for unsafe writes (fleet-api-specification API-307,
 * draft-ietf-httpapi-idempotency-key-header semantics): a client retrying a
 * timed-out POST replays the stored outcome instead of running the domain
 * work twice. Route-scoped on the endpoints where a duplicate is costly —
 * sends and payments.
 *
 * The contract: first sight runs normally and the 2xx outcome is stored for
 * 24 hours (documented retention; after pruning, a reused key is a new
 * request), keyed by (operator, key) in the tenant-prefixed cache. A retry
 * replays the stored status+body with `Idempotency-Replayed: true` and does
 * no domain work; the same key with a different payload is a 422; a retry
 * while the original is still in flight is a 409. The header is optional —
 * no key, no ceremony — and meaningless on safe/idempotent methods, where
 * it is ignored per the draft.
 *
 * Deliberate v1 subset: only 2xx outcomes are stored. An exception unwinds to
 * the handler (which must keep reporting it), so nothing is persisted and a
 * retry re-executes — safe here because every guarded endpoint fails before
 * commit. Full error-replay à la Stripe needs capture at the exception-
 * renderer seam and rides the contract-chain step.
 *
 * GOLDEN REFERENCE, not byte-identical (contract: wiki [[idempotency-keys]]).
 * ONE per-app tune point: the acting-principal resolution below (a multi-tenant
 * app resolves the tenant operator via its own current-operator resolver; a
 * single-plane app uses its token user). ApiProblem is the §6 renderer every
 * API-bearing app already carries.
 */
final class IdempotencyKey
{
    private const int TTL_SECONDS = 86_400;

    public function handle(Request $request, Closure $next): Response
    {
        $header = $request->headers->get('Idempotency-Key');

        if ($header === null || $request->method() !== 'POST') {
            return $next($request);
        }

        $key = self::parse($header);

        if ($key === null) {
            return ApiProblem::response(
                $request,
                Response::HTTP_BAD_REQUEST,
                'The Idempotency-Key header must be a string of at most 255 characters.',
                type: ApiProblem::type('idempotency-key-invalid'),
            );
        }

        $store = sprintf('idem:%d:%s', CurrentOperator::get()->id ?? 0, $key);
        $fingerprint = hash('sha256', $request->method().'|'.$request->getPathInfo().'|'.$request->getContent());

        /** @var array{status: int, body: string, fingerprint: string}|null $stored */
        $stored = Cache::get($store);

        if ($stored !== null) {
            return self::settle($request, $stored, $fingerprint);
        }

        $lock = Cache::lock('lock:'.$store, 30);

        if ($lock->get() !== true) {
            return ApiProblem::response(
                $request,
                Response::HTTP_CONFLICT,
                'A request with this Idempotency-Key is still being processed.',
                type: ApiProblem::type('idempotency-key-in-flight'),
            );
        }

        try {
            $response = $next($request);

            if ($response->isSuccessful() && $response instanceof JsonResponse) {
                Cache::put($store, [
                    'status' => $response->getStatusCode(),
                    'body' => (string) $response->getContent(),
                    'fingerprint' => $fingerprint,
                ], self::TTL_SECONDS);
            }

            return $response;
        } finally {
            $lock->release();
        }
    }

    /**
     * The header value is a Structured-Field String (quoted); bare values are
     * accepted leniently. Empty or oversized keys are refused, not truncated.
     */
    private static function parse(string $header): ?string
    {
        $key = $header;

        if (str_starts_with($key, '"') && str_ends_with($key, '"') && strlen($key) >= 2) {
            $key = stripslashes(substr($key, 1, -1));
        }

        return ($key === '' || strlen($key) > 255) ? null : $key;
    }

    /**
     * The stored outcome for this key: an identical retry replays it byte for
     * byte (marked, costing one cache read and no domain work); the same key
     * on a different payload is refused — a key names one operation.
     *
     * @param  array{status: int, body: string, fingerprint: string}  $stored
     */
    private static function settle(Request $request, array $stored, string $fingerprint): Response
    {
        if ($stored['fingerprint'] !== $fingerprint) {
            return ApiProblem::response(
                $request,
                Response::HTTP_UNPROCESSABLE_ENTITY,
                'This Idempotency-Key was already used with a different payload.',
                type: ApiProblem::type('idempotency-key-payload-mismatch'),
            );
        }

        return new JsonResponse($stored['body'], $stored['status'], [
            'Idempotency-Replayed' => 'true',
            'Cache-Control' => 'no-cache, private',
        ], json: true);
    }
}
