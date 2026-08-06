<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Administrator;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/**
 * The control-plane RBAC baseline (guard 'admin') + a default administrator seeded
 * from CONTROL_DEFAULT_USERNAME/PASSWORD (see config/seeding.php). Administrators are
 * the provider's (DP) own platform staff who monitor/operate the app at /control —
 * distinct from the client's operators (/admin; see OperatorSeeder). Control actions
 * gate on PERMISSIONS, never on a role name, so the role→permission map can change
 * without touching route/controller code. Idempotent: safe to re-run, and INERT when
 * the default-administrator credentials are blank. MANDATORY on every app.
 */
class AdministratorSeeder extends Seeder
{
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $permissions = ['platform.manage', 'administrators.manage'];

        foreach ($permissions as $permission) {
            Permission::findOrCreate($permission, 'admin');
        }

        Role::findOrCreate('super-admin', 'admin')->givePermissionTo($permissions);
        Role::findOrCreate('manager', 'admin')->givePermissionTo(['administrators.manage']);
        Role::findOrCreate('support', 'admin');
        Role::findOrCreate('staff', 'admin');

        $this->seedDefaultAdministrator();
    }

    private function seedDefaultAdministrator(): void
    {
        $name = config('seeding.control.name');
        $email = config('seeding.control.email');
        $password = config('seeding.control.password');

        if (blank($name) || blank($email) || blank($password)) {
            return;
        }

        Administrator::query()->updateOrCreate(
            ['email' => $email],
            ['name' => $name, 'password' => $password],
        )->assignRole('super-admin');
    }
}
