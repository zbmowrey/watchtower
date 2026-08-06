<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * The default application user, seeded from APP_DEFAULT_USERNAME/PASSWORD (see
 * config/seeding.php) as a plain, email-verified end user on the default `web`
 * guard — NOT a platform operator (control plane; see OperatorSeeder) and NOT a
 * business administrator (app-admin plane; see AdministratorSeeder).
 *
 * Idempotent: keyed on email, so re-running converges the account to the current
 * env credentials. INERT (a no-op) when the credentials are blank. Apps that use
 * Spatie for the `users` plane MAY assign an app-context role here; the default
 * ships none, since "admin" now belongs to the /admin plane.
 */
class DefaultAppUserSeeder extends Seeder
{
    public function run(): void
    {
        $name = config('seeding.app.name');
        $email = config('seeding.app.email');
        $password = config('seeding.app.password');

        if (blank($name) || blank($email) || blank($password)) {
            return;
        }

        $user = User::query()->updateOrCreate(
            ['email' => $email],
            ['name' => $name, 'password' => $password],
        );

        if ($user->email_verified_at === null) {
            $user->forceFill(['email_verified_at' => now()])->save();
        }
    }
}
