import { Notice, Setting, requestUrl } from "obsidian";
import { billingRequest, CONSTANCE_ACCOUNT_BASE_URL, ConstanceAccountAdapter, ConstanceAccountState } from "./constance-account";

type PendingPriceCheckout = { price_id?: string; checkout_id?: string; idempotency_key: string; owner?: string };
type BillingCatalogState = ConstanceAccountState & {
  pendingPriceCheckout?: PendingPriceCheckout;
  previewPendingCheckout?: PendingPriceCheckout;
};

interface BillingCatalogHost {
  state: BillingCatalogState;
  appId: string;
  installationId: string;
  persist(): Promise<void>;
  syncBalance(): Promise<void>;
  resumeCheckout?(): void;
}

function accountAdapter(host: BillingCatalogHost): ConstanceAccountAdapter {
  return { state: host.state, appId: host.appId, installationId: host.installationId, persist: host.persist, syncBalance: host.syncBalance };
}

async function getData(url: string): Promise<any> {
  const response = await requestUrl({ url, method: "GET", throw: false });
  if (response.status < 200 || response.status >= 300) {
    const detail = response.json?.detail;
    throw new Error(detail?.message || (typeof detail === "string" ? detail : `Billing catalog unavailable (HTTP ${response.status}).`));
  }
  return response.json?.data;
}

export function joinPublicPacks(products: any, appId: string): any[] {
  if (products?.app_id !== appId || !Array.isArray(products?.packs)) return [];
  return products.packs.map((pack: any) => {
    const priceId = typeof pack?.price_id === "string" ? pack.price_id : "";
    const units = Number(pack?.native_units);
    const unit = typeof pack?.unit === "string" && pack.unit.trim() ? pack.unit.trim() : "credits";
    const amount = typeof pack?.formatted_total === "string" ? pack.formatted_total : "";
    const available = pack?.available === true && !!priceId && Number.isSafeInteger(units) && units > 0 && !!amount;
    return { pack, priceId, units, unit, amount, available };
  });
}

/** Show Paddle's current catalog and submit checkout with its exact configured price ID. */
export function addLivePacks(root: HTMLElement, host: BillingCatalogHost): void {
  host.resumeCheckout?.();
  const section = root.createDiv();
  const status = section.createEl("p", { text: "Loading current Paddle prices…" });
  void getData(`${CONSTANCE_ACCOUNT_BASE_URL}/api/v1/billing/public-products?app_id=${encodeURIComponent(host.appId)}`).then(products => {
    const offers = joinPublicPacks(products, host.appId);
    if (!offers.length) throw new Error("No current one-time offers are available.");
    status.setText("Current Paddle pricing. Final checkout calculates applicable tax.");
    for (const { pack, priceId, units, unit, amount, available } of offers) {
      const description = [pack?.description, Number.isSafeInteger(units) && units > 0 ? `${units.toLocaleString()} ${unit}` : "",
        available ? "" : pack?.availability_reason || "Current price unavailable"].filter(Boolean).join(" · ");
      const row = new Setting(section).setName(pack.price_name || pack.name || pack.code || "One-time offer").setDesc(description);
      row.addButton(button => button.setButtonText(available ? `Buy ${amount}` : "Pricing unavailable")
        .setDisabled(!available)
        .onClick(async () => {
          button.setDisabled(true);
          try {
            if (!host.state.billingAccountLinked) throw new Error("Connect your billing account before purchasing.");
            if (!host.state.pendingPriceCheckout && host.state.previewPendingCheckout) {
              host.state.pendingPriceCheckout = host.state.previewPendingCheckout;
              host.state.previewPendingCheckout = undefined;
              await host.persist();
            }
            let pending = host.state.pendingPriceCheckout;
            if (pending?.owner && pending.owner !== host.state.billingEmail) throw new Error("Sign in to the account that started the pending purchase.");
            if (pending?.checkout_id) {
              const result = await billingRequest(accountAdapter(host), {
                url: `${CONSTANCE_ACCOUNT_BASE_URL}/api/v1/billing/checkouts/${encodeURIComponent(pending.checkout_id)}`,
                method: "GET", throw: false,
              });
              if (result.status >= 200 && result.status < 300 && (result.json?.data?.settled === true ||
                ["completed", "fulfilled", "canceled", "cancelled", "failed", "expired", "voided", "rejected"].includes(result.json?.data?.status))) {
                host.state.pendingPriceCheckout = undefined;
                await host.persist();
                await host.syncBalance();
                return;
              }
            }
            if (pending?.price_id && pending.price_id !== priceId) throw new Error("A purchase is pending. Resolve it before starting another purchase.");
            const request: PendingPriceCheckout = pending || { price_id: priceId, idempotency_key: `checkout_${crypto.randomUUID()}`, owner: host.state.billingEmail };
            host.state.pendingPriceCheckout = request;
            await host.persist();
            const response = await billingRequest(accountAdapter(host), {
              url: `${CONSTANCE_ACCOUNT_BASE_URL}/api/v1/billing/checkout-price`,
              method: "POST",
              headers: { "Content-Type": "application/json", "Idempotency-Key": request.idempotency_key },
              body: JSON.stringify({ app_id: host.appId, installation_id: host.installationId, price_id: request.price_id, quantity: 1 }),
              throw: false,
            });
            if (response.status < 200 || response.status >= 300) {
              const detail = response.json?.detail;
              throw new Error(detail?.message || (typeof detail === "string" ? detail : "Checkout unavailable; refresh current prices."));
            }
            const checkout = response.json?.data;
            if (!checkout?.checkout_id) throw new Error("Checkout is being confirmed. Retry this purchase to recover it safely.");
            request.checkout_id = String(checkout.checkout_id);
            await host.persist();
            await host.syncBalance();
            host.resumeCheckout?.();
            if (typeof checkout.checkout_url === "string" && checkout.checkout_url) window.open(checkout.checkout_url, "_blank", "noopener");
            else new Notice("Checkout is being confirmed. Its status will refresh when you return.");
          } catch (error) {
            new Notice(error instanceof Error ? error.message : "Checkout unavailable.");
          } finally {
            button.setDisabled(!available);
          }
        }));
    }
  }).catch(() => status.setText("Pricing temporarily unavailable. Purchases are disabled until current pricing can be loaded."));
}
