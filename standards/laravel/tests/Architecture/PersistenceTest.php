<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Tier 2 — Persistence / Infrastructure  (OPT-IN: app has App\Infrastructure)
|--------------------------------------------------------------------------
| Qualifies: any app that has an App\Infrastructure namespace. The outward
| layer that talks to Eloquent, the filesystem, queues, mail, third-party
| SDKs — concrete, final, and HTTP-unaware. It implements the domain's
| contracts; it never reaches back up into HTTP.
|
| Abstract infrastructure base classes can't be final — carve them out by
| name with a one-line reason, same as the domain tier.
*/

arch('infrastructure does not depend on the HTTP layer')
    ->expect('App\Infrastructure')
    ->not->toUse(['App\Http', 'Illuminate\Http\Request']);

arch('infrastructure implementations are concrete and final')
    ->expect('App\Infrastructure')
    ->classes()
    ->toBeFinal();
