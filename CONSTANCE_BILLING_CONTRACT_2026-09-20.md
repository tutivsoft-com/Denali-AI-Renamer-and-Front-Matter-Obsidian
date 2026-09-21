# Denali Constance billing contract

Denali source uses the account-linked Constance adapter. The installation ID is
stable, the account token is kept in plugin settings, and billing actions use
the authenticated routes rather than the old unsigned device-spend contract.

The adapter uses `/auth/login` or `/auth/register`, then
`/billing/installations/link`, `/billing/entitlements/me`,
`/billing/free-usage/claim`, and `/billing/credits/spend`. It stores both the
access and refresh tokens and refreshes the access token when needed. The paid
spend request is `{ app_id, installation_id, event_id, amount }`; success reads
`data.credits.balance`. Use `/billing/spend/status` for an unknown event and
reuse the same event ID after a timeout.

Checkout and free usage must be account-linked. Checkout uses
`POST /billing/checkout` with a stable `plan_code` (`standard`, `pro`, or
`ultimate`), the installation ID, and an `Idempotency-Key`; settlement is
polled through `/billing/checkouts/{checkout_id}` before entitlement refresh.
The live one-time tier price IDs remain in `main.ts`. `/buy` is retained only
as the Contract v9 fallback when a successful transaction has no hosted URL.
Keep the stable installation ID across plugin updates, never store the
password, and do not use signed `X-Tutiv-*` callbacks in this backend-less
client; those server-side integration requirements are not applicable here.
Before release, verify source and generated/public bundles use the same adapter
and current app ID.
