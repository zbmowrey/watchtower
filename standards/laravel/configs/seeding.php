<?php

declare(strict_types=1);

return [

    /*
    |--------------------------------------------------------------------------
    | Default seeded users — the three identity planes
    |--------------------------------------------------------------------------
    |
    | One key pair per plane (fleet-app-specification §5). Reading env only here —
    | never in the seeders themselves — keeps `config:cache` safe and passes the
    | "env only via config" arch rule.
    |
    | Each seeder is idempotent (updateOrCreate on email → a re-run converges the
    | account to these values) and INERT when its pair is blank (an unset plane
    | seeds nothing — no phantom account). Locally these ship with a known
    | password; in production, inject a long random via a k8s Secret, so rotating
    | the Secret + re-seeding rotates the login.
    |
    */

    // Administrators — the control plane (`administrators` table / `admin` guard, /control).
    // The provider's (DP) own platform staff. MANDATORY on every app.
    'control' => [
        'name' => env('CONTROL_DEFAULT_NAME', 'Control Admin'),
        'email' => env('CONTROL_DEFAULT_USERNAME'),
        'password' => env('CONTROL_DEFAULT_PASSWORD'),
    ],

    // Operators — the app-admin plane (`operators` table / `operator` guard, /admin).
    // The client's own app staff. Present only where a distinct external client
    // operates the app (leave blank otherwise → seeds nothing).
    'operator' => [
        'name' => env('OPERATOR_DEFAULT_NAME', 'Business Operator'),
        'email' => env('OPERATOR_DEFAULT_USERNAME'),
        'password' => env('OPERATOR_DEFAULT_PASSWORD'),
    ],

    // Application user (the `users` table / default `web` guard). Consumers.
    'app' => [
        'name' => env('APP_DEFAULT_NAME', 'Default Admin'),
        'email' => env('APP_DEFAULT_USERNAME'),
        'password' => env('APP_DEFAULT_PASSWORD'),
    ],

    // Tenant-plane operator (multi-tenant apps only; per-tenant database).
    //
    // BLANK MUST MEAN NO-OP here more strictly than on the central planes: this
    // plane is seeded into EVERY tenant database, so a hardcoded fallback is not
    // one account — it is one per tenant, forever. Multi-tenant apps SHOULD also
    // gate the call on `local`, because real tenants get their owner provisioned
    // by the tenant-creation action, not by a seeder.
    //
    // Use firstOrCreate, NOT updateOrCreate: converging the central admin to env
    // is the rotation contract, but a tenant operator is a real person inside a
    // database whose contents the platform does not own.
    'tenant' => [
        'name' => env('TENANT_DEFAULT_NAME', 'Operator'),
        'email' => env('TENANT_DEFAULT_USERNAME'),
        'password' => env('TENANT_DEFAULT_PASSWORD'),
    ],

];
