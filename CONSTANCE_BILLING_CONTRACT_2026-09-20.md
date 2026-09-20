# Denali Constance billing contract

Denali source uses the account-linked Constance adapter. The installation ID is
stable, the account token is kept in plugin settings, and billing actions use
the authenticated routes rather than the old unsigned device-spend contract.

The adapter uses `/auth/login` or `/auth/register`, then
`/billing/installations/link`, `/billing/entitlements/me`,
`/billing/free-usage/claim`, and `/billing/credits/spend`. The paid spend
request is `{ app_id, installation_id, event_id, amount }`; success reads
`data.credits.balance`. Use `/billing/spend/status` for an unknown event and
reuse the same event ID after a timeout.

Checkout and free usage must be account-linked. Keep the stable installation ID
across plugin updates, never store the password, and do not reintroduce public
email/customer-ID checkout. Legacy same-install routes are compatibility-only.
Before release, verify source and generated/public bundles use the same adapter
and current app ID.
