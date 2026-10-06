import { renderLoyaltyDiscount } from "./loyalty-discount";
import { diagnostics } from "./diagnostics";
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
const diagnosticEnd1 = diagnostics?.start?.("billing-catalog.getData") ?? (() => {});
try {

  const response = await (diagnostics?.request?.("network.billing-catalog.getData", requestUrl, { url, method: "GET", throw: false }) ?? requestUrl({ url, method: "GET", throw: false }));
  if (response.status < 200 || response.status >= 300) {
    const detail = response.json?.detail;
    throw new Error(detail?.message || (typeof detail === "string" ? detail : `Credit packs are temporarily unavailable. Try again shortly.`));
  }
  return await (response.json?.data);

} catch (diagnosticError1) { diagnostics?.failure?.("billing-catalog.getData", diagnosticError1); throw diagnosticError1; } finally { diagnosticEnd1(); }
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
  const section = root.createDiv({ cls: "ui-billing-packs" });
  renderLoyaltyDiscount(section);
  const status = section.createEl("p", { text: "Loading prices…" });
  void diagnostics.guard("billing-catalog.background_1", () => (getData(`${CONSTANCE_ACCOUNT_BASE_URL}/api/v1/billing/public-products?app_id=${encodeURIComponent(host.appId)}`).then(products => {
    const offers = joinPublicPacks(products, host.appId);
    if (!offers.length) throw new Error("No credit packs are currently available.");
    status.setText("Applicable taxes are calculated at checkout.");
    for (const { pack, priceId, units, unit, amount, available } of offers) {
      const description = [pack?.description, Number.isSafeInteger(units) && units > 0 ? `${units.toLocaleString()} ${unit}` : "",
        available ? "" : pack?.availability_reason || "Current price unavailable"].filter(Boolean).join(" · ");
      const row = new Setting(section).setName(pack.price_name || pack.name || pack.code || "Credit pack").setDesc(description);
      row.addButton(button => button.setButtonText(available ? `Buy ${amount}` : "Pricing unavailable")
        .setDisabled(!available)
        .onClick(async () => {
return diagnostics.guard("billing-catalog.control_2", async () => {
const diagnosticEnd2 = diagnostics?.start?.("control.3269.onClick") ?? (() => {});
try {

          button.setDisabled(true);
          try {
            if (!host.state.billingAccountLinked) throw new Error("Connect your account before purchasing.");
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
diagnostics.failure("billing-catalog.caught_3", error);
            new Notice(error instanceof Error ? error.message : "Checkout unavailable.");
          } finally {
            button.setDisabled(!available);
          }

} catch (diagnosticError2) { diagnostics?.failure?.("control.3269.onClick", diagnosticError2); throw diagnosticError2; } finally { diagnosticEnd2(); }

});
}));
    }
  }).catch((rejectedError1) => { diagnostics.failure("billing-catalog.rejected_2", rejectedError1); return (status.setText("Pricing temporarily unavailable. Purchases are disabled until current pricing can be loaded.")); })));
}
