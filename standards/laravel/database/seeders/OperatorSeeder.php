<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Operator;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/**
 * The app-admin plane RBAC baseline (guard 'operator') + a default operator seeded
 * from OPERATOR_DEFAULT_USERNAME/PASSWORD (see config/seeding.php). Operators are the
 * client's OWN app staff (owner → coaches; anyone employed by the client business)
 * who run the business at /admin — distinct from the provider's administrators
 * (/control; see AdministratorSeeder). Present only where a distinct external client
 * operates the app. Gate on PERMISSIONS, never a role name. Idempotent: safe to
 * re-run, and INERT when the default-operator credentials are blank.
 */
class OperatorSeeder extends Seeder
{
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $permissions = ['business.manage', 'operators.manage'];

        foreach ($permissions as $permission) {
            Permission::findOrCreate($permission, 'operator');
        }

        Role::findOrCreate('super-admin', 'operator')->givePermissionTo($permissions);
        Role::findOrCreate('support', 'operator');

        $this->seedDefaultOperator();
    }

    private function seedDefaultOperator(): void
    {
        $name = config('seeding.operator.name');
        $email = config('seeding.operator.email');
        $password = config('seeding.operator.password');

        if (blank($name) || blank($email) || blank($password)) {
            return;
        }

        Operator::query()->updateOrCreate(
            ['email' => $email],
            ['name' => $name, 'password' => $password],
        )->assignRole('super-admin');
    }
}
