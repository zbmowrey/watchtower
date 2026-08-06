<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest as BaseFormRequest;

/**
 * The application's base form request.
 *
 * It overrides user() with a concrete `?User` return so controllers can call a
 * bare `$request->user()` and get the app User — no guard name needed. Because
 * user() is now declared OUTSIDE Illuminate\Http\Request, Larastan's
 * union-of-all-providers return-type extension defers to this declared type
 * (with a second provider — the control-plane administrators — a bare user()
 * would otherwise widen to `User|Administrator`). Runtime is unchanged: user()
 * still resolves through the default `web` guard.
 */
abstract class FormRequest extends BaseFormRequest
{
    public function user($guard = null): ?User
    {
        $user = parent::user($guard);

        return $user instanceof User ? $user : null;
    }
}
