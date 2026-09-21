var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => DenaliAIFileRenamer
});
module.exports = __toCommonJS(main_exports);
var import_obsidian3 = require("obsidian");
var import_obsidian4 = require("obsidian");

// constance-account.ts
var import_obsidian = require("obsidian");
var CONSTANCE_ACCOUNT_BASE_URL = "https://app.tutivsoft.com";
function errorDetail(response, fallback) {
  var _a, _b;
  return String(((_a = response.json) == null ? void 0 : _a.detail) || ((_b = response.json) == null ? void 0 : _b.message) || response.text || fallback);
}
async function authenticate(mode, email, password, installationId) {
  var _a, _b, _c;
  const body = mode === "register" ? { email, password, external_customer_id: installationId } : { email, password };
  const response = await (0, import_obsidian.requestUrl)({
    url: `${CONSTANCE_ACCOUNT_BASE_URL}/api/v1/auth/${mode}`,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    throw: false
  });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(errorDetail(response, `Billing ${mode} failed (HTTP ${response.status})`));
  }
  if ((_a = response.json) == null ? void 0 : _a.verification_required) {
    throw new Error("Billing account created. Verify your email, then sign in.");
  }
  const token = String(((_b = response.json) == null ? void 0 : _b.access_token) || "");
  if (!token) throw new Error("Constance did not return an account token.");
  return {
    accessToken: token,
    refreshToken: String(((_c = response.json) == null ? void 0 : _c.refresh_token) || "")
  };
}
async function refreshAccessToken(state, persist) {
  var _a;
  if (!state.billingRefreshToken) return false;
  const response = await (0, import_obsidian.requestUrl)({
    url: `${CONSTANCE_ACCOUNT_BASE_URL}/api/v1/auth/refresh`,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: state.billingRefreshToken }),
    throw: false
  });
  if (response.status < 200 || response.status >= 300 || !((_a = response.json) == null ? void 0 : _a.access_token)) {
    return false;
  }
  state.billingAccessToken = String(response.json.access_token);
  state.billingRefreshToken = String(response.json.refresh_token || state.billingRefreshToken);
  await (persist == null ? void 0 : persist());
  return true;
}
async function accountRequest(state, persist, options) {
  const makeRequest = () => (0, import_obsidian.requestUrl)({
    url: options.url,
    method: options.method,
    headers: {
      ...options.method === "POST" ? { "Content-Type": "application/json" } : {},
      Authorization: `Bearer ${state.billingAccessToken}`,
      ...options.headers || {}
    },
    ...options.body ? { body: options.body } : {},
    throw: false
  });
  let response = await makeRequest();
  if ((response.status === 401 || response.status === 403) && await refreshAccessToken(state, persist)) {
    response = await makeRequest();
  }
  return response;
}
async function linkInstallation(adapter, token) {
  const response = await (0, import_obsidian.requestUrl)({
    url: `${CONSTANCE_ACCOUNT_BASE_URL}/api/v1/billing/installations/link`,
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      app_id: adapter.appId,
      installation_id: adapter.installationId,
      legacy_external_customer_id: adapter.installationId,
      platform: "obsidian",
      app_version: adapter.appVersion || void 0
    }),
    throw: false
  });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(errorDetail(response, `Installation link failed (HTTP ${response.status})`));
  }
}
async function signInBillingAccount(adapter, password, mode) {
  const email = adapter.state.billingEmail.trim().toLowerCase();
  if (!email || !email.includes("@")) throw new Error("Enter a valid billing email.");
  if (password.length < 8) throw new Error("Password must contain at least 8 characters.");
  if (!adapter.installationId) throw new Error("The plugin installation ID is not ready.");
  const tokens = await authenticate(mode, email, password, adapter.installationId);
  await linkInstallation(adapter, tokens.accessToken);
  adapter.state.billingEmail = email;
  adapter.state.billingAccessToken = tokens.accessToken;
  adapter.state.billingRefreshToken = tokens.refreshToken;
  adapter.state.billingAccountLinked = true;
  await adapter.persist();
  await adapter.syncBalance();
}
async function claimAccountFreeUsage(state, appId, installationId, eventId, amount, persist) {
  var _a, _b;
  if (!state.billingAccessToken || !state.billingAccountLinked) return { kind: "auth-required" };
  try {
    const response = await accountRequest(state, persist, {
      url: `${CONSTANCE_ACCOUNT_BASE_URL}/api/v1/billing/free-usage/claim`,
      method: "POST",
      body: JSON.stringify({ app_id: appId, installation_id: installationId, event_id: eventId, amount })
    });
    if (response.status === 402) return { kind: "insufficient" };
    if (response.status === 401 || response.status === 403 || response.status === 404) return { kind: "auth-required" };
    if (response.status < 200 || response.status >= 300) return { kind: "error" };
    return { kind: "ok", remaining: Math.max(0, Number((_b = (_a = response.json) == null ? void 0 : _a.data) == null ? void 0 : _b.remaining) || 0) };
  } catch (error) {
    console.error("Constance account free-usage claim failed", error);
    return { kind: "error" };
  }
}
async function spendAccountCredits(state, appId, installationId, eventId, amount, persist) {
  var _a, _b, _c;
  if (!state.billingAccessToken || !state.billingAccountLinked) return { kind: "auth-required" };
  try {
    const response = await accountRequest(state, persist, {
      url: `${CONSTANCE_ACCOUNT_BASE_URL}/api/v1/billing/credits/spend`,
      method: "POST",
      body: JSON.stringify({ app_id: appId, installation_id: installationId, event_id: eventId, amount })
    });
    if (response.status === 402) return { kind: "insufficient" };
    if (response.status === 401 || response.status === 403 || response.status === 404) return { kind: "auth-required" };
    if (response.status < 200 || response.status >= 300) return { kind: "error" };
    const balance = Number((_c = (_b = (_a = response.json) == null ? void 0 : _a.data) == null ? void 0 : _b.credits) == null ? void 0 : _c.balance);
    return Number.isFinite(balance) ? { kind: "ok", balance: Math.max(0, balance) } : { kind: "error" };
  } catch (error) {
    console.error("Constance authenticated credit spend failed", error);
    return { kind: "error" };
  }
}
async function createAuthenticatedCheckout(state, appId, installationId, planCode, idempotencyKey, persist) {
  var _a;
  if (!state.billingAccessToken || !state.billingAccountLinked) return { kind: "auth-required" };
  try {
    const response = await accountRequest(state, persist, {
      url: `${CONSTANCE_ACCOUNT_BASE_URL}/api/v1/billing/checkout`,
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ app_id: appId, plan_code: planCode, installation_id: installationId, quantity: 1, coupon_code: null })
    });
    if (response.status === 401 || response.status === 403 || response.status === 404) return { kind: "auth-required" };
    if (response.status < 200 || response.status >= 300) {
      return { kind: "unavailable", status: response.status, message: errorDetail(response, `Checkout failed (HTTP ${response.status})`) };
    }
    const data = ((_a = response.json) == null ? void 0 : _a.data) || {};
    const checkoutUrl = String(data.checkout_url || "").trim();
    const checkoutId = String(data.checkout_id || data.id || data.paddle_transaction_id || "").trim();
    if (!checkoutUrl && !checkoutId) {
      return { kind: "unavailable", status: response.status, message: "Constance did not return a checkout URL or checkout id." };
    }
    return {
      kind: "ok",
      checkoutUrl,
      checkoutId
    };
  } catch (error) {
    console.error("Constance authenticated checkout failed", error);
    return { kind: "error" };
  }
}
async function pollAuthenticatedCheckout(state, checkoutId, persist) {
  var _a, _b;
  if (!state.billingAccessToken || !state.billingAccountLinked) return { kind: "auth-required" };
  try {
    const response = await accountRequest(state, persist, {
      url: `${CONSTANCE_ACCOUNT_BASE_URL}/api/v1/billing/checkouts/${encodeURIComponent(checkoutId)}`,
      method: "GET"
    });
    if (response.status === 401 || response.status === 403 || response.status === 404) return { kind: "auth-required" };
    if (response.status < 200 || response.status >= 300) return { kind: "error" };
    return ((_b = (_a = response.json) == null ? void 0 : _a.data) == null ? void 0 : _b.settled) === true ? { kind: "settled" } : { kind: "pending" };
  } catch (error) {
    console.error("Constance checkout status poll failed", error);
    return { kind: "error" };
  }
}
function addBillingAccountSettings(containerEl, adapter) {
  let password = "";
  new import_obsidian.Setting(containerEl).setName("Billing account email").setDesc("Used for sign-in, purchase restore, and checkout. Reinstalling no longer creates a new free allowance.").addText((text) => text.setPlaceholder("you@example.com").setValue(adapter.state.billingEmail).onChange(async (value) => {
    adapter.state.billingEmail = value.trim();
    await adapter.persist();
  }));
  new import_obsidian.Setting(containerEl).setName("Billing account password").setDesc("Used only for this sign-in request. The password is never saved by the plugin.").addText((text) => {
    text.inputEl.type = "password";
    text.setPlaceholder("At least 8 characters").onChange((value) => {
      password = value;
    });
  });
  const status = adapter.state.billingAccountLinked ? "Signed in and linked" : "Not signed in";
  new import_obsidian.Setting(containerEl).setName("Billing account").setDesc(`${status}. The saved bearer session can restore purchases; your password is not stored.`).addButton((button) => button.setButtonText("Sign in").onClick(async () => {
    var _a;
    button.setDisabled(true);
    try {
      await signInBillingAccount(adapter, password, "login");
      new import_obsidian.Notice("Billing account signed in and this installation was linked.");
      (_a = adapter.refresh) == null ? void 0 : _a.call(adapter);
    } catch (error) {
      new import_obsidian.Notice(error instanceof Error ? error.message : "Billing sign-in failed.");
    } finally {
      button.setDisabled(false);
    }
  })).addButton((button) => button.setButtonText("Create account").onClick(async () => {
    var _a;
    button.setDisabled(true);
    try {
      await signInBillingAccount(adapter, password, "register");
      new import_obsidian.Notice("Billing account created and this installation was linked.");
      (_a = adapter.refresh) == null ? void 0 : _a.call(adapter);
    } catch (error) {
      new import_obsidian.Notice(error instanceof Error ? error.message : "Billing account creation failed.");
    } finally {
      button.setDisabled(false);
    }
  })).addButton((button) => button.setButtonText("Sign out").setDisabled(!adapter.state.billingAccessToken).onClick(async () => {
    var _a;
    adapter.state.billingAccessToken = "";
    adapter.state.billingRefreshToken = "";
    adapter.state.billingAccountLinked = false;
    await adapter.persist();
    new import_obsidian.Notice("Billing account signed out on this installation.");
    (_a = adapter.refresh) == null ? void 0 : _a.call(adapter);
  }));
}

// plugin-support.ts
var import_obsidian2 = require("obsidian");
function safeDetail(value) {
  if (value instanceof Error) return value.stack || value.message;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch (e) {
    return String(value);
  }
}
var DocumentationModal = class extends import_obsidian2.Modal {
  constructor(app, docs) {
    super(app);
    __publicField(this, "docs", docs);
  }
  onOpen() {
    this.titleEl.setText(`${this.docs.name} documentation`);
    this.contentEl.createEl("p", { text: this.docs.summary });
    const addSection = (title, items) => {
      this.contentEl.createEl("h3", { text: title });
      const list = this.contentEl.createEl("ol");
      for (const item of items) list.createEl("li", { text: item });
    };
    addSection("Quick start", this.docs.quickStart);
    addSection("Useful commands", this.docs.commands);
    addSection("Troubleshooting", this.docs.troubleshooting);
  }
  onClose() {
    this.contentEl.empty();
  }
};
var PluginSupport = class {
  constructor(plugin, docs) {
    __publicField(this, "plugin", plugin);
    __publicField(this, "docs", docs);
    __publicField(this, "entries", []);
    __publicField(this, "maxEntries", 250);
  }
  start() {
    this.info("plugin.loaded", `version=${this.plugin.manifest.version}`);
    this.plugin.registerDomEvent(window, "error", (event) => {
      this.error("runtime.error", event.error || event.message);
    });
    this.plugin.registerDomEvent(window, "unhandledrejection", (event) => {
      this.error("runtime.unhandled_rejection", event.reason);
    });
    this.plugin.addCommand({
      id: "open-documentation",
      name: "Open documentation",
      callback: () => new DocumentationModal(this.plugin.app, this.docs).open()
    });
    this.plugin.addCommand({
      id: "copy-debug-log",
      name: "Copy debug log",
      callback: () => {
        void this.copyDiagnostics();
      }
    });
    this.plugin.addCommand({
      id: "open-plugin-settings",
      name: "Open plugin settings",
      callback: () => {
        const setting = this.plugin.app.setting;
        setting == null ? void 0 : setting.open();
        setting == null ? void 0 : setting.openTabById(this.plugin.manifest.id);
      }
    });
  }
  info(event, detail) {
    this.record("info", event, detail);
  }
  warn(event, detail) {
    this.record("warn", event, detail);
  }
  error(event, detail) {
    this.record("error", event, detail);
  }
  record(level, event, detail) {
    const entry = { at: (/* @__PURE__ */ new Date()).toISOString(), level, event };
    if (detail !== void 0) entry.detail = safeDetail(detail).slice(0, 4e3);
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) this.entries.splice(0, this.entries.length - this.maxEntries);
    const method = level === "error" ? console.error : level === "warn" ? console.warn : console.info;
    method.call(console, `[${this.docs.name}] ${event}`, detail != null ? detail : "");
  }
  async copyDiagnostics() {
    const header = [
      `Plugin: ${this.docs.name}`,
      `Plugin ID: ${this.plugin.manifest.id}`,
      `Version: ${this.plugin.manifest.version}`,
      `Captured: ${(/* @__PURE__ */ new Date()).toISOString()}`,
      `User agent: ${navigator.userAgent}`,
      ""
    ];
    try {
      await navigator.clipboard.writeText(header.concat(this.entries.map(
        (entry) => `${entry.at} [${entry.level.toUpperCase()}] ${entry.event}${entry.detail ? ` \u2014 ${entry.detail}` : ""}`
      )).join("\n"));
      new import_obsidian2.Notice(`${this.docs.name}: debug log copied. Secrets and note contents are not included.`);
    } catch (error) {
      this.error("diagnostics.copy_failed", error);
      new import_obsidian2.Notice(`${this.docs.name}: could not copy the debug log.`);
    }
  }
};

// main.ts
var REMOTE_MANIFEST_PASSPHRASE = "Kivu.RemoteKeyManifest.v1.2026D";
var REMOTE_MANIFEST_URL = "https://raw.githubusercontent.com/tutivsoft-com/Resources/main/desktop-python-JavaScript-Denali-AI-Renamer-and-Front-Matter.txt";
function denaliBase64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
async function denaliDecryptSecretEnvelope(envelope, passphrase) {
  if (envelope.x !== "AES-256-GCM" || envelope.w !== "PBKDF2-HMAC-SHA256") {
    throw new Error(`Unsupported manifest envelope algorithm/kdf: ${envelope.x} / ${envelope.w}`);
  }
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  const key = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: denaliBase64ToBytes(envelope.a),
      iterations: envelope.n,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
  const ciphertext = denaliBase64ToBytes(envelope.c);
  const tag = denaliBase64ToBytes(envelope.d);
  const ciphertextAndTag = new Uint8Array(new ArrayBuffer(ciphertext.length + tag.length));
  ciphertextAndTag.set(ciphertext, 0);
  ciphertextAndTag.set(tag, ciphertext.length);
  const plaintext = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: denaliBase64ToBytes(envelope.b) },
    key,
    ciphertextAndTag
  );
  return new TextDecoder().decode(plaintext);
}
function denaliSelectSlot(manifest, wantState) {
  var _a;
  const byMarker = manifest.r.find((slot) => slot.ii === wantState);
  if (byMarker) {
    return byMarker;
  }
  const fallbackState = wantState === "active" ? "0" : "1";
  return (_a = manifest.r.find((slot) => slot.s === fallbackState)) != null ? _a : null;
}
async function denaliFetchRemoteManifest(url) {
  const response = await (0, import_obsidian4.requestUrl)({ url, method: "GET", throw: false });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Manifest fetch failed: HTTP ${response.status}`);
  }
  return response.json;
}
async function denaliTryDecryptManifestKey(manifest, source) {
  const active = denaliSelectSlot(manifest, "active");
  if (active) {
    try {
      const key = (await denaliDecryptSecretEnvelope(active.v, REMOTE_MANIFEST_PASSPHRASE)).trim();
      if (key) return key;
    } catch (error) {
      console.warn("Denali: active manifest slot failed to decrypt", source, error);
    }
  }
  const next = denaliSelectSlot(manifest, "next");
  if (next) {
    try {
      const key = (await denaliDecryptSecretEnvelope(next.v, REMOTE_MANIFEST_PASSPHRASE)).trim();
      if (key) return key;
    } catch (error) {
      console.warn("Denali: next manifest slot failed to decrypt", source, error);
    }
  }
  throw new Error("Remote key manifest did not decrypt to a usable key.");
}
async function fetchRemoteApiKey() {
  try {
    const manifest = await denaliFetchRemoteManifest(REMOTE_MANIFEST_URL);
    return await denaliTryDecryptManifestKey(manifest, REMOTE_MANIFEST_URL);
  } catch (primaryError) {
    console.warn("Denali: primary manifest failed, trying next-manifest fallback", primaryError);
    const primaryManifest = await denaliFetchRemoteManifest(REMOTE_MANIFEST_URL).catch(() => null);
    const nextUrl = primaryManifest == null ? void 0 : primaryManifest.n;
    if (nextUrl && nextUrl !== REMOTE_MANIFEST_URL) {
      const nextManifest = await denaliFetchRemoteManifest(nextUrl);
      return await denaliTryDecryptManifestKey(nextManifest, nextUrl);
    }
    throw primaryError;
  }
}
var CONSTANCE_BASE_URL = "https://app.tutivsoft.com";
var CONSTANCE_APP_ID = "denali-ai-file-renamer-front-matter";
var DENALI_CREDIT_TIERS = [
  { label: "$1 \u2192 50 credits", amountUsd: 1, credits: 50, priceId: "pri_01m0b7gtqfncsz7sc4fc3aejpc", planCode: "standard" },
  { label: "$5 \u2192 400 credits", amountUsd: 5, credits: 400, priceId: "pri_01m0b7gvay5f3xmb80jd99ehzk", planCode: "pro" },
  { label: "$15 \u2192 1600 credits", amountUsd: 15, credits: 1600, priceId: "pri_01m0b7gvymzrp8b0jy32xsj7q2", planCode: "ultimate" }
];
function generateConstanceEventId() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `evt_${Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}
function generateConstanceDeviceId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function buildDenaliBuyUrl(priceId, email, deviceId) {
  const params = new URLSearchParams({
    app_id: CONSTANCE_APP_ID,
    price_id: priceId,
    email,
    external_customer_id: deviceId
  });
  return `${CONSTANCE_BASE_URL}/buy?${params.toString()}`;
}
function formatDate(date, formatStr) {
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const hour = date.getHours().toString().padStart(2, "0");
  const minute = date.getMinutes().toString().padStart(2, "0");
  const second = date.getSeconds().toString().padStart(2, "0");
  return formatStr.replace(/YYYY/g, year).replace(/MM/g, month).replace(/DD/g, day).replace(/HH/g, hour).replace(/mm/g, minute).replace(/ss/g, second);
}
var CURRENT_USER_PLAN = "free";
function getPlanLimits(plan) {
  switch (plan) {
    case "free":
      return {
        maxFilesPerMonth: 10,
        dailyFileLimit: 3,
        batchRenameLimit: 3,
        maxInputLength: 1e3,
        maxOutputLength: 50
      };
    case "pro":
      return {
        maxFilesPerMonth: 1e3,
        dailyFileLimit: 300,
        batchRenameLimit: 300,
        maxInputLength: 3e3,
        maxOutputLength: 500
        // Corrected from 100 to 500
      };
    case "ultimate":
      return {
        maxFilesPerMonth: 8e3,
        dailyFileLimit: 300,
        batchRenameLimit: 3e3,
        maxInputLength: 1e4,
        maxOutputLength: 1e3
        // Corrected from 100 to 1000
      };
    default:
      console.warn(`Denali AI: Unknown user plan '${plan}'. Defaulting to 'free'.`);
      return getPlanLimits("free");
  }
}
var PROMPT_STYLES = {
  "keywordFilled": 'Based on the following text, generate a good and useful filename. The filename should be a healthy mixture of context, breadth, and depth, similar to the style of "Code Python Tensorflow Johsnson AI Project memory second fix". The filename must not exceed {max_output_length} characters. Dont send any extra text - just give back one simple line of text ONLY',
  "balanced": 'Based on the following text, generate a concise, human-readable filename that uses a title case style, similar to the example "Apple Inc Annual Report for 2025". The filename must not exceed {max_output_length} characters. Respond with only the filename and nothing else.',
  "nicheWordsOnly": 'Based on the following text, extract only the most specific, niche keywords and terms, similar to the example "apple report 2025 john reviewed approved emergency fix2". The filename must not exceed {max_output_length} characters. Respond with only the filename and nothing else.'
};
var defaultPlanLimits = getPlanLimits(CURRENT_USER_PLAN);
var DEFAULT_SETTINGS = {
  openRouterApiKey: "",
  customPrompt: PROMPT_STYLES.balanced,
  aiModel: "~deepseek/deepseek-v4-flash-latest",
  untitledKeywords: "Untitled,New Text Document",
  renameOnCreation: false,
  useFrontmatter: true,
  lookForUntitled: false,
  maxInputLength: defaultPlanLimits.maxInputLength,
  // SAAS: Derived from plan
  maxOutputLength: defaultPlanLimits.maxOutputLength,
  // SAAS: Derived from plan
  backupEnabled: false,
  backupFolder: "Denali-Backup",
  timestampFormat: "none",
  fileNameCase: "original",
  addAlias: false,
  showRenameModal: true,
  modalCloseDelay: 1,
  aiNameStyle: "balanced",
  stopWords: "a, an, the, and, but, or, for, nor, so, yet, at, by, from, in, into, of, off, on, onto, to, with",
  characterReplacement: "-",
  autoSubfolder: false,
  logEnabled: true,
  renameTimestampFormat: "none",
  logFileEnabled: true,
  renameChoice: "automatic",
  // New frontmatter settings
  addTitle: true,
  titlePrompt: "Based on the following note content, generate a concise, human-readable title for the note. Respond with only the title and nothing else.",
  addCreatedDate: true,
  createdDateFormat: "YYYY-MM-DD HH:mm",
  addModifiedDate: true,
  modifiedDateFormat: "YYYY-MM-DD HH:mm",
  addAuthor: false,
  authorPrompt: "Based on the following note, guess the author or source name. Respond with only the author name and nothing else.",
  addStatus: true,
  statusDefaultValue: "draft",
  addProject: false,
  projectPrompt: "Based on the following note content, suggest a project name. Respond with only the name of the project and nothing else.",
  addTopic: false,
  topicPrompt: "Based on the following note content, suggest a single, broad topic or category. Respond with only the topic and nothing else.",
  // --- SAAS: Default Plan-based Settings ---
  userPlan: CURRENT_USER_PLAN,
  maxFilesPerMonth: defaultPlanLimits.maxFilesPerMonth,
  dailyFileLimit: defaultPlanLimits.dailyFileLimit,
  batchRenameLimit: defaultPlanLimits.batchRenameLimit,
  // --- END SAAS: Default Plan-based Settings ---
  // Default GUI display settings to match user's intent
  showAdvancedSettings: false,
  displayRenameProcessChoice: true,
  displayRenameOnCreation: false,
  displayUntitledKeywords: true,
  displayLookForUntitled: true,
  displayAutoSubfolder: false,
  displayOpenRouterApiKey: true,
  displayAiModel: false,
  displayAiNameStyle: false,
  displayCustomPrompt: false,
  displayMaxInputLength: true,
  displayMaxOutputLength: true,
  displayFileNameCase: true,
  displayRenameTimestampFormat: true,
  displayStopWords: true,
  displayCharacterReplacement: true,
  displayUseFrontmatter: true,
  displayAddAlias: true,
  displayAddTitle: true,
  displayTitlePrompt: true,
  displayAddCreatedDate: true,
  displayCreatedDateFormat: true,
  displayAddModifiedDate: true,
  displayModifiedDateFormat: true,
  displayAddAuthor: false,
  displayAuthorPrompt: false,
  displayAddStatus: true,
  displayStatusDefaultValue: true,
  displayAddProject: false,
  displayProjectPrompt: false,
  displayAddTopic: false,
  displayTopicPrompt: false,
  displayBackupEnabled: false,
  displayBackupFolder: false,
  displayBackupTimestampFormat: false,
  displayLogEnabled: true,
  displayLogFileEnabled: false,
  displayModalCloseDelay: true,
  displayResetSettings: true,
  displayDeleteDenaliFolderButton: true,
  // Default to show the delete button
  // Default header display settings
  displayMainWorkflowHeader: true,
  displayAiApiHeader: true,
  displayFileNamingHeader: true,
  displayFrontmatterHeader: true,
  displayBackupLogHeader: true,
  displayResetHeader: true,
  resetSettings: true,
  // --- SAAS: Default Display Settings for Plan-based Features ---
  displayUserPlan: true,
  displayMaxFilesPerMonth: true,
  displayDailyFileLimit: true,
  displayBatchRenameLimit: true,
  // --- END SAAS: Default Display Settings for Plan-based Features ---
  // --- NEW: Credit System Defaults ---
  paymentType: "one-time",
  // Default to one-time payment
  availableCredits: 0,
  initialFreeCreditsGranted: true,
  displayPaymentType: true,
  displayAvailableCredits: true,
  // --- END NEW ---
  // --- CONSTANCE: Central billing defaults ---
  purchasedCredits: 0,
  pendingSpendEvents: [],
  pendingCheckout: null,
  constanceDeviceId: "",
  // Generated on first onload() via crypto.getRandomValues
  billingEmail: "",
  billingAccessToken: "",
  billingRefreshToken: "",
  billingAccountLinked: false
  // --- END CONSTANCE ---
};
var OPENROUTER_MODELS = [
  "openai/gpt-5-mini",
  "google/gemini-2.5-flash-lite",
  "mistralai/mistral-7b-instruct",
  "openai/gpt-3.5-turbo",
  "google/gemma-7b-it",
  "google/gemma-7b",
  "nousresearch/nous-hermes-2-mixtral-8x7b-dpo"
];
var ConfirmationModal = class extends import_obsidian3.Modal {
  constructor(app, title, message, onConfirm, onCancel = () => {
  }) {
    super(app);
    __publicField(this, "message");
    __publicField(this, "onConfirm");
    __publicField(this, "onCancel");
    this.titleEl.setText(title);
    this.message = message;
    this.onConfirm = onConfirm;
    this.onCancel = onCancel;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("p", { text: this.message });
    new import_obsidian3.Setting(contentEl).addButton((button) => {
      button.setButtonText("Confirm").setCta().onClick(() => {
        this.close();
        this.onConfirm();
      });
    }).addButton((button) => {
      button.setButtonText("Cancel").onClick(() => {
        this.close();
        this.onCancel();
      });
    });
  }
  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
};
var _DenaliAIFileRenamer = class _DenaliAIFileRenamer extends import_obsidian3.Plugin {
  constructor() {
    super(...arguments);
    __publicField(this, "settings");
    __publicField(this, "support");
    __publicField(this, "renameModal", null);
    // Pattern B: cached once resolved so every AI call doesn't re-fetch the
    // manifest; cleared implicitly on plugin reload in case the key was
    // rotated mid-session (a fresh resolveApiKey() call after that just
    // re-fetches).
    __publicField(this, "remoteApiKeyCache", null);
  }
  /**
   * Resolves the OpenRouter API key to use for AI calls: the manual
   * "OpenRouter API Key" setting always wins when set (existing user
   * override behavior, unchanged); otherwise falls back to this app's own
   * Pattern B remote key manifest (see fetchRemoteApiKey() above).
   */
  async resolveApiKey() {
    const manualKey = this.settings.openRouterApiKey.trim();
    if (manualKey) {
      return manualKey;
    }
    if (this.remoteApiKeyCache) {
      return this.remoteApiKeyCache;
    }
    try {
      const key = await fetchRemoteApiKey();
      this.remoteApiKeyCache = key;
      return key;
    } catch (error) {
      console.error("Denali AI: remote key manifest fetch/decrypt failed:", error);
      return null;
    }
  }
  async onload() {
    this.support = new PluginSupport(this, { name: "Denali AI Renamer", summary: "Generate safer filenames and searchable frontmatter from note content.", quickStart: ["Sign in to billing in Settings.", "Open a Markdown note.", "Run the Denali rename command and approve the preview."], commands: ["Rename current note", "Open Denali options", "Copy debug log"], troubleshooting: ["Use Copy debug log before reporting a problem.", "Check that the note is writable and has enough content to name."] });
    this.support.start();
    await this.loadSettings();
    if (!this.settings.constanceDeviceId) {
      this.settings.constanceDeviceId = generateConstanceDeviceId();
      await this.saveSettings();
    }
    this.settings.pendingSpendEvents = Array.isArray(this.settings.pendingSpendEvents) ? this.settings.pendingSpendEvents.filter((item) => item && typeof item.eventId === "string" && Number.isInteger(item.amount) && item.amount > 0) : [];
    const pendingCheckout = this.settings.pendingCheckout;
    this.settings.pendingCheckout = pendingCheckout && typeof pendingCheckout.idempotencyKey === "string" && typeof pendingCheckout.planCode === "string" && typeof pendingCheckout.priceId === "string" ? pendingCheckout : null;
    this.settings.billingAccessToken = typeof this.settings.billingAccessToken === "string" ? this.settings.billingAccessToken : "";
    this.settings.billingRefreshToken = typeof this.settings.billingRefreshToken === "string" ? this.settings.billingRefreshToken : "";
    this.settings.billingAccountLinked = this.settings.billingAccountLinked === true && Boolean(this.settings.billingAccessToken);
    await this.saveSettings();
    void this.syncPurchasedCreditsFromConstance().then(() => this.retryPendingSpendEvents());
    this.settings.backupFolder = _DenaliAIFileRenamer.BACKUP_SUBFOLDER;
    if (!this.settings.initialFreeCreditsGranted) {
      this.settings.initialFreeCreditsGranted = true;
    }
    this.settings.availableCredits = 0;
    await this.saveSettings();
    this.addSettingTab(new DenaliSettingTab(this.app, this));
    this.addCommand({
      id: "open-denali-ai-options",
      name: "Denali AI: Open options for current note",
      callback: () => {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile || activeFile.extension !== "md") {
          new import_obsidian3.Notice("Open a Markdown note before using Denali AI.", 4e3);
          return;
        }
        if (this.renameModal) this.renameModal.close();
        this.renameModal = new DenaliAIOptionsModal(this.app, this, activeFile);
        this.renameModal.open();
      }
    });
    this.addCommand({
      id: "rename-current-file-denali-ai",
      name: "Denali AI: Rename current note",
      checkCallback: (checking) => {
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile && activeFile.extension === "md") {
          if (!checking) {
            if (this.renameModal) this.renameModal.close();
            this.renameModal = new DenaliAIOptionsModal(this.app, this, activeFile);
            this.renameModal.open();
          }
          return true;
        }
        return false;
      }
    });
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (file instanceof import_obsidian3.TFile && file.extension === "md") {
          menu.addItem((item) => {
            item.setTitle("Denali AI: Rename note").setIcon("pencil-ruler").onClick(() => {
              if (this.renameModal) this.renameModal.close();
              this.renameModal = new DenaliAIOptionsModal(this.app, this, file);
              this.renameModal.open();
            });
          });
        } else if (file instanceof import_obsidian3.TFolder) {
          menu.addItem((item) => {
            item.setTitle("Denali AI: Batch rename folder").setIcon("folder-edit").onClick(() => {
              if (this.renameModal) this.renameModal.close();
              this.renameModal = new DenaliAIOptionsModal(this.app, this, file);
              this.renameModal.open();
            });
          });
        }
      })
    );
    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor, view) => {
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile && activeFile.extension === "md") {
          menu.addItem((item) => {
            item.setTitle("Denali AI: Rename note").setIcon("pencil-ruler").onClick(() => {
              if (this.renameModal) this.renameModal.close();
              this.renameModal = new DenaliAIOptionsModal(this.app, this, activeFile);
              this.renameModal.open();
            });
          });
        }
      })
    );
    this.registerEvent(
      this.app.vault.on("create", (file) => {
        if (this.settings.renameOnCreation && file instanceof import_obsidian3.TFile && file.extension === "md") {
          const untitledKeywords = this.settings.untitledKeywords.split(",").map((k) => k.trim());
          if (untitledKeywords.some((keyword) => file.name.startsWith(keyword))) {
            if (this.renameModal) {
              this.renameModal.close();
            }
            this.renameModal = new DenaliAIOptionsModal(this.app, this, file);
            this.renameModal.open();
          }
        }
      })
    );
  }
  onunload() {
    if (this.renameModal) {
      this.renameModal.close();
    }
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.settings.billingAccessToken = typeof this.settings.billingAccessToken === "string" ? this.settings.billingAccessToken : "";
    this.settings.billingAccountLinked = this.settings.billingAccountLinked === true && Boolean(this.settings.billingAccessToken);
    const planLimits = getPlanLimits(this.settings.userPlan);
    if (this.settings.maxInputLength > planLimits.maxInputLength) {
      this.settings.maxInputLength = planLimits.maxInputLength;
    }
    if (this.settings.maxOutputLength > planLimits.maxOutputLength) {
      this.settings.maxOutputLength = planLimits.maxOutputLength;
    }
    if (this.settings.paymentType === "subscription") {
      this.settings.maxFilesPerMonth = planLimits.maxFilesPerMonth;
      this.settings.dailyFileLimit = planLimits.dailyFileLimit;
      this.settings.batchRenameLimit = planLimits.batchRenameLimit;
    } else {
      this.settings.maxFilesPerMonth = 0;
      this.settings.dailyFileLimit = 0;
      this.settings.batchRenameLimit = 0;
    }
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  /**
   * Deletes the Denali AI folder and its contents.
   * This method is now only called explicitly from the settings tab.
   */
  async deleteDenaliFolder() {
    const folder = this.app.vault.getAbstractFileByPath(_DenaliAIFileRenamer.DENALI_FOLDER);
    if (folder instanceof import_obsidian3.TFolder) {
      await this.app.vault.delete(folder, true);
    } else {
      throw new Error(`The folder "${_DenaliAIFileRenamer.DENALI_FOLDER}" does not exist or is not a folder.`);
    }
  }
  async openDenaliCheckout(tier) {
    if (!this.settings.billingAccessToken || !this.settings.billingAccountLinked) {
      new import_obsidian3.Notice("Denali AI: sign in or create a billing account before purchasing credits.", 5e3);
      return;
    }
    if (!tier.priceId || tier.priceId === "PENDING_PROVISIONING") {
      new import_obsidian3.Notice("Denali billing is not available yet because Paddle prices are still being provisioned.", 5e3);
      return;
    }
    const pending = this.settings.pendingCheckout;
    if (pending && (pending.planCode !== tier.planCode || pending.priceId !== tier.priceId)) {
      new import_obsidian3.Notice("Denali AI: finish or retry the pending checkout before starting another purchase.", 5e3);
      return;
    }
    const checkout = pending || { idempotencyKey: generateConstanceEventId(), planCode: tier.planCode, priceId: tier.priceId };
    if (!pending) {
      this.settings.pendingCheckout = checkout;
      await this.saveSettings();
    }
    const result = await createAuthenticatedCheckout(this.settings, CONSTANCE_APP_ID, this.settings.constanceDeviceId, checkout.planCode, checkout.idempotencyKey, () => this.saveSettings());
    if (result.kind === "auth-required") {
      this.settings.billingAccessToken = "";
      this.settings.billingRefreshToken = "";
      this.settings.billingAccountLinked = false;
      await this.saveSettings();
      new import_obsidian3.Notice("Denali AI: your billing session expired. Sign in again before purchasing.", 6e3);
      return;
    }
    if (result.kind !== "ok") {
      new import_obsidian3.Notice(result.kind === "unavailable" ? `Denali checkout unavailable (HTTP ${result.status}). Retry when Constance is reachable.` : "Denali checkout could not be started. Retry when Constance is reachable.", 6e3);
      return;
    }
    const email = this.settings.billingEmail.trim().toLowerCase();
    if (!result.checkoutUrl && (!email || !email.includes("@"))) {
      new import_obsidian3.Notice("Enter a valid billing email before using the checkout fallback.", 5e3);
      return;
    }
    this.settings.pendingCheckout = null;
    await this.saveSettings();
    const checkoutUrl = result.checkoutUrl || buildDenaliBuyUrl(tier.priceId, email, this.settings.constanceDeviceId);
    window.open(checkoutUrl, "_blank");
    new import_obsidian3.Notice(`Opening checkout for ${tier.label}...`, 3e3);
    this.pollAfterCheckout(result.checkoutId || void 0);
  }
  pollAfterCheckout(checkoutId) {
    let attempts = 0;
    let running = false;
    let intervalId = null;
    const poll = async () => {
      if (running) return;
      running = true;
      attempts += 1;
      try {
        if (checkoutId) {
          const status = await pollAuthenticatedCheckout(this.settings, checkoutId, () => this.saveSettings());
          if (status.kind === "auth-required") {
            this.settings.billingAccessToken = "";
            this.settings.billingRefreshToken = "";
            this.settings.billingAccountLinked = false;
            await this.saveSettings();
            if (intervalId !== null) window.clearInterval(intervalId);
            return;
          }
          if (status.kind === "settled") {
            await this.syncPurchasedCreditsFromConstance();
            if (intervalId !== null) window.clearInterval(intervalId);
            return;
          }
        }
        await this.syncPurchasedCreditsFromConstance();
      } finally {
        running = false;
      }
      if (attempts >= 6 && intervalId !== null) window.clearInterval(intervalId);
    };
    void poll();
    intervalId = window.setInterval(() => {
      void poll();
    }, 15e3);
  }
  // --- CONSTANCE: Central billing client (replaces the old local license-key system) ---
  /** Reads the account-linked entitlement snapshot and updates the local mirror. */
  async syncPurchasedCreditsFromConstance(showNotice = false) {
    var _a, _b, _c;
    const deviceId = this.settings.constanceDeviceId;
    if (!deviceId || !this.settings.billingAccessToken || !this.settings.billingAccountLinked) {
      return;
    }
    try {
      const response = await (0, import_obsidian4.requestUrl)({
        url: `${CONSTANCE_BASE_URL}/api/v1/billing/entitlements/me?${new URLSearchParams({ app_id: CONSTANCE_APP_ID, installation_id: deviceId }).toString()}`,
        method: "GET",
        headers: { Authorization: `Bearer ${this.settings.billingAccessToken}` },
        throw: false
      });
      if (response.status === 200) {
        const balance = (_c = (_b = (_a = response.json) == null ? void 0 : _a.data) == null ? void 0 : _b.credits) == null ? void 0 : _c.balance;
        if (typeof balance === "number") {
          this.settings.purchasedCredits = balance;
          await this.saveSettings();
        }
        if (showNotice) {
          new import_obsidian3.Notice(`Denali AI: Balance refreshed. Purchased credits: ${this.settings.purchasedCredits}`, 4e3);
        }
      } else {
        console.warn(`Denali AI: Constance entitlement sync failed with status ${response.status}.`, response.json);
        if (showNotice) {
          new import_obsidian3.Notice(`Denali AI: Could not refresh balance (status ${response.status}). Please try again later.`, 5e3);
        }
      }
    } catch (error) {
      console.error("Denali AI: Constance entitlement sync request failed:", error);
      if (showNotice) {
        new import_obsidian3.Notice("Denali AI: Could not reach the billing server to refresh balance.", 5e3);
      }
    }
  }
  /**
   * Spends `amount` credits against the account-linked Constance CreditBalance.
   * @param amount Credits to spend. Must be > 0 (callers should skip calling this for 0).
   * @returns 'success' with the server's authoritative new balance, 'insufficient'
   *          on a confirmed 402 (caller must block and never retry), or 'error' on
   *          any other failure. Callers block AI work until the spend is authoritative.
   */
  async retryPendingSpendEvents() {
    var _a;
    for (const pending of [...this.settings.pendingSpendEvents]) {
      const result = await this.spendConstanceCredits(pending.amount, pending.eventId);
      if (result.outcome === "error") break;
      this.settings.pendingSpendEvents = this.settings.pendingSpendEvents.filter((item) => item.eventId !== pending.eventId);
      this.settings.purchasedCredits = result.outcome === "success" ? (_a = result.newPurchasedBalance) != null ? _a : 0 : 0;
      await this.saveSettings();
    }
  }
  async spendConstanceCredits(amount, stableEventId = generateConstanceEventId()) {
    const deviceId = this.settings.constanceDeviceId;
    if (!deviceId || amount <= 0) {
      return { outcome: "error" };
    }
    const result = await spendAccountCredits(this.settings, CONSTANCE_APP_ID, deviceId, stableEventId, amount, () => this.saveSettings());
    if (result.kind === "ok") return { outcome: "success", newPurchasedBalance: result.balance };
    if (result.kind === "insufficient") return { outcome: "insufficient" };
    if (result.kind === "auth-required") {
      this.settings.billingAccessToken = "";
      this.settings.billingRefreshToken = "";
      this.settings.billingAccountLinked = false;
      await this.saveSettings();
    }
    return { outcome: "error" };
  }
  // --- END CONSTANCE ---
};
__publicField(_DenaliAIFileRenamer, "DENALI_FOLDER", "Denali AI");
__publicField(_DenaliAIFileRenamer, "BACKUP_SUBFOLDER", `${_DenaliAIFileRenamer.DENALI_FOLDER}/Backups`);
__publicField(_DenaliAIFileRenamer, "LOGS_SUBFOLDER", `${_DenaliAIFileRenamer.DENALI_FOLDER}/Logs`);
var DenaliAIFileRenamer = _DenaliAIFileRenamer;
var FileRenamer = class {
  // 30 seconds
  constructor(app, plugin, logFunc, cancelCheck) {
    __publicField(this, "app");
    __publicField(this, "plugin");
    __publicField(this, "log");
    // This is the modal's logStatus
    __publicField(this, "cancelCheck");
    __publicField(this, "MAX_RETRIES", 5);
    __publicField(this, "INITIAL_BACKOFF_DELAY_MS", 1e3);
    // 1 second
    __publicField(this, "TIMEOUT_MS", 3e4);
    this.app = app;
    this.plugin = plugin;
    this.log = logFunc || this.defaultLogHandler.bind(this);
    this.cancelCheck = cancelCheck;
  }
  async defaultLogHandler(message, isError = false) {
    if (!this.plugin.settings.logEnabled) {
      return;
    }
    console.log(`Denali AI (FileRenamer Log): ${message}`);
    if (isError) {
      new import_obsidian3.Notice(message, 5e3);
    }
    if (this.plugin.settings.logFileEnabled) {
      await this.writeLogToFile(message);
    }
  }
  async writeLogToFile(message) {
    const logFolderPath = DenaliAIFileRenamer.LOGS_SUBFOLDER;
    const logFilePath = `${logFolderPath}/denali-ai-log.md`;
    try {
      await this.app.vault.createFolder(logFolderPath).catch(() => {
      });
      const logFile = this.app.vault.getAbstractFileByPath(logFilePath);
      if (!logFile) {
        await this.app.vault.create(logFilePath, `# Denali AI Logs

`);
      }
      const timestamp = (/* @__PURE__ */ new Date()).toLocaleString();
      const logMessage = `[${timestamp}] ${message}
`;
      await this.app.vault.adapter.append(logFilePath, logMessage);
    } catch (error) {
      console.error("Failed to write to log file:", error);
      new import_obsidian3.Notice(`Failed to write to Denali AI log file: ${error.message}`, 5e3);
    }
  }
  /**
   * Handles network requests to OpenRouter with exponential backoff, retries, and timeout.
   * Surfaces friendly errors to the user.
   */
  async makeOpenRouterRequestWithRetries(params, promptType) {
    var _a;
    const apiKey = await this.plugin.resolveApiKey();
    if (!apiKey) {
      this.log(`OpenRouter API Key is missing and the remote key manifest could not be resolved. Please configure a key in plugin settings or check your connection.`, true);
      throw new Error("OpenRouter API Key is not configured or invalid.");
    }
    params.headers = {
      ...params.headers,
      "Authorization": `Bearer ${apiKey}`,
      // Use the decrypted key
      "Content-Type": "application/json"
    };
    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      let delay = this.INITIAL_BACKOFF_DELAY_MS * Math.pow(2, attempt);
      if (attempt > 0) {
        console.log(`Denali AI: Retrying OpenRouter request for ${promptType} (attempt ${attempt + 1}/${this.MAX_RETRIES}) after ${delay / 1e3}s delay...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      try {
        const timeoutPromise = new Promise(
          (_, reject) => setTimeout(() => reject(new Error("Request timed out")), this.TIMEOUT_MS)
        );
        const response = await Promise.race([
          (0, import_obsidian4.requestUrl)(params),
          timeoutPromise
        ]);
        if (response.status === 200 && response.json && response.json.error) {
          const errorMessage = response.json.error.message || "Unknown AI error";
          this.log(`OpenRouter AI returned an error for ${promptType}: ${errorMessage}`, true);
          throw new Error(`AI Error: ${errorMessage}`);
        }
        return response;
      } catch (error) {
        const errorMessage = error.message || "Unknown network error";
        const status = error.status;
        if (status === 401) {
          this.log(`OpenRouter API Key is invalid or unauthorized for ${promptType}. Please check your settings.`, true);
          throw new Error("Invalid OpenRouter API Key. Please check your plugin settings.");
        } else if (status === 429) {
          const retryAfter = (_a = error.headers) == null ? void 0 : _a["Retry-After"];
          if (retryAfter) {
            delay = parseInt(retryAfter, 10) * 1e3;
            this.log(`Rate limit hit for ${promptType}. Retrying after ${delay / 1e3}s as per server instruction.`, true);
          } else {
            this.log(`Rate limit hit for ${promptType}. Retrying with exponential backoff.`, true);
          }
        } else if (status >= 500) {
          this.log(`OpenRouter server error (${status}) for ${promptType}: ${errorMessage}. Retrying with exponential backoff.`, true);
        } else if (status >= 400 && status < 500) {
          this.log(`Client error (${status}) for ${promptType}: ${errorMessage}. Not retrying.`, true);
          throw new Error(`OpenRouter API Error: ${errorMessage} (Status: ${status})`);
        } else if (errorMessage === "Request timed out") {
          this.log(`OpenRouter request for ${promptType} timed out after ${this.TIMEOUT_MS / 1e3}s. Retrying...`, true);
        } else {
          this.log(`Network error for ${promptType}: ${errorMessage}. Retrying...`, true);
        }
        if (attempt === this.MAX_RETRIES - 1) {
          this.log(`OpenRouter request for ${promptType} failed after ${this.MAX_RETRIES} attempts. Last error: ${errorMessage}`, true);
          throw new Error(`Failed to communicate with OpenRouter API for ${promptType} after multiple retries. Last error: ${errorMessage}`);
        }
      }
    }
    throw new Error("Unexpected error: makeOpenRouterRequestWithRetries completed without returning or throwing.");
  }
  /**
   * Calculates the credit cost for a single file operation.
   * @param settings The plugin settings.
   * @param isRenameOperation True if a file rename is intended.
   * @param isFrontmatterOperation True if frontmatter changes are intended.
   * @returns The total credit cost.
   */
  calculateCreditCost(settings, isRenameOperation, isFrontmatterOperation) {
    let cost = 0;
    if (isRenameOperation) {
      cost += 1;
    }
    if (isFrontmatterOperation) {
      if (settings.addTitle) cost += 1;
      if (settings.addCreatedDate) cost += 1;
      if (settings.addModifiedDate) cost += 1;
      if (settings.addAuthor) cost += 1;
      if (settings.addStatus) cost += 1;
      if (settings.addProject) cost += 1;
      if (settings.addTopic) cost += 1;
      if (settings.addAlias) cost += 1;
    }
    return cost;
  }
  /**
   * Deducts credits from the user's balance. Spends the free/local pool
   * (availableCredits) first; once that would go negative, spends the
   * remainder from purchasedCredits via Constance's real credit-spend
   * endpoint (the local mirror of the server's authoritative CreditBalance).
   *
   * Failure policy: confirmed insufficient-credit, authentication, and
   * transport failures all block the operation. A charge is never assumed
   * successful until Constance returns an authoritative result.
   * @param cost The number of credits to deduct.
   * @returns True if credits were successfully deducted (or the plan is subscription-based), false if blocked by insufficient credits.
   */
  async deductCredits(cost) {
    if (this.plugin.settings.paymentType !== "one-time") {
      return true;
    }
    const settings = this.plugin.settings;
    if (!settings.billingAccessToken || !settings.billingAccountLinked) {
      new import_obsidian3.Notice("Denali AI: sign in or create a billing account in Settings before using AI features.", 6e3);
      return false;
    }
    const freeEventId = `free_${generateConstanceEventId()}`;
    const freeResult = await claimAccountFreeUsage(settings, CONSTANCE_APP_ID, settings.constanceDeviceId, freeEventId, cost, () => this.plugin.saveSettings());
    if (freeResult.kind === "ok") {
      settings.availableCredits = freeResult.remaining;
      await this.plugin.saveSettings();
      new import_obsidian3.Notice(`Used ${cost} credits. Free credits remaining: ${freeResult.remaining}`, 2500);
      return true;
    }
    if (freeResult.kind === "auth-required") {
      settings.billingAccessToken = "";
      settings.billingRefreshToken = "";
      settings.billingAccountLinked = false;
      await this.plugin.saveSettings();
      new import_obsidian3.Notice("Denali AI: your billing session expired. Sign in again in Settings.", 6e3);
      return false;
    }
    if (freeResult.kind === "error") {
      new import_obsidian3.Notice("Denali AI: the account allowance could not be verified. Try again when Constance is reachable.", 6e3);
      return false;
    }
    const remainder = cost;
    await this.plugin.retryPendingSpendEvents();
    if (this.plugin.settings.pendingSpendEvents.length > 0) {
      new import_obsidian3.Notice("Denali AI: a previous credit spend is still being reconciled. Try again when the connection is restored.", 5e3);
      return false;
    }
    const stableEventId = generateConstanceEventId();
    this.plugin.settings.pendingSpendEvents.push({ eventId: stableEventId, amount: remainder });
    await this.plugin.saveSettings();
    const spendResult = await this.plugin.spendConstanceCredits(remainder, stableEventId);
    if (spendResult.outcome === "insufficient") {
      this.plugin.settings.pendingSpendEvents = this.plugin.settings.pendingSpendEvents.filter((item) => item.eventId !== stableEventId);
      await this.plugin.saveSettings();
      this.log(`Not enough purchased credits to cover ${remainder}.`, true);
      new import_obsidian3.Notice(`Not enough credits! Required: ${cost}. Buy more credits in Settings.`, 7e3);
      return false;
    }
    if (spendResult.outcome === "success" && typeof spendResult.newPurchasedBalance === "number") {
      settings.purchasedCredits = spendResult.newPurchasedBalance;
      this.plugin.settings.pendingSpendEvents = this.plugin.settings.pendingSpendEvents.filter((item) => item.eventId !== stableEventId);
    } else {
      new import_obsidian3.Notice("Denali AI: the credit spend could not be verified. Try again when Constance is reachable.", 6e3);
      return false;
    }
    await this.plugin.saveSettings();
    const remaining = settings.availableCredits + settings.purchasedCredits;
    this.log(`Deducted ${cost} purchased credits. Remaining: **${remaining}**`);
    new import_obsidian3.Notice(`Used ${cost} credits. Remaining: ${remaining}`, 2e3);
    return true;
  }
  /** Apply one approved rename, frontmatter update, and optional folder move. */
  async processRename(file, suggestedName, initialAiSuggestions) {
    var _a;
    this.log(`--- Starting rename process for **${file.name}** ---`);
    const oldName = file.name;
    const {
      backupEnabled,
      useFrontmatter,
      maxInputLength,
      aiNameStyle,
      maxOutputLength,
      fileNameCase,
      addAlias,
      stopWords,
      characterReplacement,
      autoSubfolder,
      renameTimestampFormat,
      addTitle,
      addAuthor,
      addProject,
      addTopic,
      paymentType
    } = this.plugin.settings;
    const isRenameOperation = true;
    const isFrontmatterOperation = useFrontmatter && (addTitle || addAuthor || addProject || addTopic || addAlias || this.plugin.settings.addCreatedDate || this.plugin.settings.addModifiedDate || this.plugin.settings.addStatus);
    const cost = this.calculateCreditCost(this.plugin.settings, isRenameOperation, isFrontmatterOperation);
    let originalContent = "";
    let frontmatterChanged = false;
    try {
      let newName = null;
      let titleSuggestion = null;
      let authorSuggestion = null;
      let projectSuggestion = null;
      let topicSuggestion = null;
      let tags = [];
      let folderSuggestion = null;
      this.log(`Reading file content for AI analysis...`);
      let fileContent = await this.app.vault.read(file);
      originalContent = fileContent;
      let textToSend = fileContent;
      if (useFrontmatter) {
        const frontmatter = (_a = this.app.metadataCache.getFileCache(file)) == null ? void 0 : _a.frontmatter;
        if (frontmatter) {
          textToSend = `---
${Object.keys(frontmatter).map((key) => `${key}: ${frontmatter[key]}`).join("\n")}
---
${fileContent}`;
        } else {
        }
      }
      if (textToSend.length > maxInputLength) {
        this.log(`Truncating file content from **${textToSend.length}** to **${maxInputLength}** characters (plan limit).`);
        textToSend = textToSend.substring(0, maxInputLength);
      }
      this.log(`Preparing AI request...`);
      if (suggestedName && initialAiSuggestions) {
        newName = suggestedName;
        titleSuggestion = initialAiSuggestions.title;
        authorSuggestion = initialAiSuggestions.author;
        projectSuggestion = initialAiSuggestions.project;
        topicSuggestion = initialAiSuggestions.topic;
        tags = initialAiSuggestions.tags;
        folderSuggestion = initialAiSuggestions.folder;
        this.log(`Using user-suggested name: **${newName}** and pre-generated AI frontmatter suggestions.`);
      } else {
        const aiCombinedSuggestions = await this.getCombinedAiSuggestions(textToSend);
        newName = aiCombinedSuggestions.filename;
        titleSuggestion = aiCombinedSuggestions.title;
        authorSuggestion = aiCombinedSuggestions.author;
        projectSuggestion = aiCombinedSuggestions.project;
        topicSuggestion = aiCombinedSuggestions.topic;
        tags = aiCombinedSuggestions.tags;
        folderSuggestion = aiCombinedSuggestions.folder;
        if (suggestedName) {
          newName = suggestedName;
          this.log(`Overriding AI-generated filename with user-suggested name: **${newName}**`);
        }
      }
      if (newName) {
        newName = newName.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").replace(/^\.+|\.+$/g, "").trim();
        if (!newName) {
          throw new Error("The suggested filename was empty after removing invalid characters.");
        }
        let newFolderPath = file.parent ? file.parent.path : "";
        if (autoSubfolder && folderSuggestion) {
          newFolderPath = folderSuggestion;
          this.log(`Moving file to suggested subfolder: **${newFolderPath}**`);
        }
        if (fileNameCase !== "original") {
          this.log(`Applying stop words and character replacement to AI-generated name.`);
          const stopWordList = stopWords.split(",").map((w) => w.trim().toLowerCase());
          newName = newName.split(/\s+/).filter((word) => !stopWordList.includes(word.toLowerCase())).join(" ");
          if (characterReplacement) {
            newName = newName.replace(/\s/g, characterReplacement);
          }
        } else {
        }
        const parentPath = newFolderPath ? newFolderPath + "/" : "";
        let finalName = this.applyCaseStyle(newName);
        const timestamp = file.stat.mtime;
        const date = new Date(timestamp);
        const formattedTimestamp = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")} ${date.getHours().toString().padStart(2, "0")}-${date.getMinutes().toString().padStart(2, "0")}-${date.getSeconds().toString().padStart(2, "0")}`;
        if (renameTimestampFormat === "prefix") {
          finalName = `${formattedTimestamp} ${finalName}`;
          this.log(`Adding timestamp prefix to filename.`);
        } else if (renameTimestampFormat === "suffix") {
          finalName = `${finalName} ${formattedTimestamp}`;
          this.log(`Adding timestamp suffix to filename.`);
        }
        let newPath = parentPath + finalName + ".md";
        let suffix = 1;
        let existingFile = this.app.vault.getAbstractFileByPath(newPath);
        while (existingFile && existingFile !== file) {
          this.log(`File with name "**${finalName}.md**" already exists. Renaming to "**${finalName}-${suffix}.md**"`, true);
          finalName = `${finalName}-${suffix}`;
          newPath = parentPath + finalName + ".md";
          suffix++;
          existingFile = this.app.vault.getAbstractFileByPath(newPath);
        }
        if (paymentType === "one-time" && !await this.deductCredits(cost)) {
          this.log(`Operation aborted due to insufficient credits.`, true);
          return false;
        }
        if (backupEnabled) {
          await this.createBackup(file);
        }
        await this.updateFrontmatter(file, oldName, textToSend, newName, tags, newFolderPath, titleSuggestion, authorSuggestion, projectSuggestion, topicSuggestion);
        frontmatterChanged = true;
        await this.app.vault.rename(file, newPath);
        this.log(`File renamed from "**${oldName}**" to "**${finalName}.md**"`, false);
        new import_obsidian3.Notice(`File renamed from "${oldName}" to "${finalName}.md"`);
        return true;
      } else {
        this.log(`Error: Denali AI could not suggest a new name for **${oldName}**`, true);
        return false;
      }
    } catch (error) {
      if (frontmatterChanged) {
        try {
          await this.app.vault.modify(file, originalContent);
          this.log(`Rename failed; restored the original frontmatter and note content.`, true);
        } catch (rollbackError) {
          console.error("Denali AI Frontmatter Rollback Error:", rollbackError);
          this.log(`Rename failed and the original note could not be restored automatically.`, true);
        }
      }
      this.log(`Error: Failed to rename file **${oldName}**. Details: ${error.message}`, true);
      console.error("Denali AI Rename Error:", error);
      return false;
    }
    this.log(`--- Rename process for **${oldName}** completed ---`);
    return false;
  }
  // Removed processBatchRename from FileRenamer. It now resides only in DenaliAIOptionsModal.
  applyCaseStyle(name) {
    switch (this.plugin.settings.fileNameCase) {
      case "kebab":
        return name.toLowerCase().replace(/\s/g, "-").replace(/--+/g, "-");
      case "camel":
        return name.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
          return index === 0 ? word.toLowerCase() : word.toUpperCase();
        }).replace(/\s+/g, "");
      case "lowercase":
        return name.toLowerCase().replace(/\s/g, "");
      case "original":
      default:
        return name;
    }
  }
  async createBackup(file) {
    this.log(`Creating backup of original file...`);
    const backupFolderPath = DenaliAIFileRenamer.BACKUP_SUBFOLDER;
    await this.app.vault.createFolder(backupFolderPath).catch(() => {
      this.log(`Backup folder already exists or could not be created.`, false);
    });
    const timestamp = (/* @__PURE__ */ new Date()).getTime();
    const date = new Date(timestamp);
    const formattedDate = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`;
    const formattedTime = `${date.getHours().toString().padStart(2, "0")}-${date.getMinutes().toString().padStart(2, "0")}-${date.getSeconds().toString().padStart(2, "0")}`;
    const nameWithoutExt = file.basename;
    const timestampString = this.plugin.settings.timestampFormat === "suffix" ? `-${formattedDate}-${formattedTime}` : "";
    let backupFileName = `${nameWithoutExt}${timestampString}.${file.extension}`;
    const backupPath = `${backupFolderPath}/${backupFileName}`;
    await this.app.vault.copy(file, backupPath);
    this.log(`Backed up file to **${backupPath}**`);
  }
  getMarkdownFiles(folder) {
    let files = [];
    const untitledKeywords = this.plugin.settings.untitledKeywords.split(",").map((k) => k.trim().toLowerCase());
    for (const item of folder.children) {
      if (item instanceof import_obsidian3.TFile && item.extension === "md") {
        const isUntitled = this.plugin.settings.lookForUntitled && untitledKeywords.some((keyword) => item.name.toLowerCase().startsWith(keyword));
        if (isUntitled || !this.plugin.settings.lookForUntitled) {
          files.push(item);
        }
      } else if (item instanceof import_obsidian3.TFolder) {
        files = files.concat(this.getMarkdownFiles(item));
      }
    }
    return files;
  }
  /** Produce all note-organization suggestions in one provider request. */
  async getCombinedAiSuggestions(content) {
    const {
      aiModel,
      maxInputLength,
      maxOutputLength,
      aiNameStyle,
      addTitle,
      titlePrompt,
      addAuthor,
      authorPrompt,
      addProject,
      projectPrompt,
      addTopic,
      topicPrompt,
      autoSubfolder,
      useFrontmatter
      // Added useFrontmatter here
    } = this.plugin.settings;
    const textToSend = content.length > maxInputLength ? content.substring(0, maxInputLength) : content;
    let systemPromptParts = [
      "You are an AI assistant that generates file names and frontmatter properties based on text content. Respond ONLY with a JSON object. If a property is not requested (e.g., if 'addTitle' is false), do not include it in the JSON. Ensure all string values are properly escaped for JSON. Do not include any other text outside the JSON object."
    ];
    let filenamePromptToUse = this.plugin.settings.customPrompt;
    if (filenamePromptToUse === PROMPT_STYLES.balanced || filenamePromptToUse === PROMPT_STYLES.keywordFilled || filenamePromptToUse === PROMPT_STYLES.nicheWordsOnly) {
      filenamePromptToUse = PROMPT_STYLES[aiNameStyle];
    }
    filenamePromptToUse = filenamePromptToUse.replace("{max_output_length}", maxOutputLength.toString()).replace("{max_input_length}", maxInputLength.toString());
    systemPromptParts.push(`- Generate a filename based on the following instruction: "${filenamePromptToUse}". Store this in the 'filename' key.`);
    if (addTitle) {
    }
    if (addAuthor) {
      systemPromptParts.push(`- Generate an author name based on the following instruction: "${authorPrompt}". Store this in the 'author' key.`);
    }
    if (addProject) {
      systemPromptParts.push(`- Generate a project name based on the following instruction: "${projectPrompt}". Store this in the 'project' key.`);
    }
    if (addTopic) {
      systemPromptParts.push(`- Generate a single, broad topic or category based on the following instruction: "${topicPrompt}". Store this in the 'topic' key.`);
    }
    const shouldRequestTags = useFrontmatter || addTopic;
    const shouldRequestFolder = autoSubfolder;
    if (shouldRequestTags) {
      systemPromptParts.push(`- Extract up to 5 relevant keywords/tags. Store these in a 'tags' array (e.g., ["tag1", "tag2"]).`);
    }
    if (shouldRequestFolder) {
      systemPromptParts.push(`- Suggest a single subfolder path. Store this in a 'folder' key (e.g., "Ideas/AI-Notes").`);
    }
    systemPromptParts.push("\nExample JSON response (only include requested fields):");
    systemPromptParts.push("```json");
    systemPromptParts.push(`{
            "filename": "Example File Name",
            "title": "Example Title",
            "author": "Example Author",
            "project": "Example Project",
            "topic": "Example Topic",
            "tags": ["tag1", "tag2"],
            "folder": "Example/Folder"
        }`);
    systemPromptParts.push("```");
    const systemPrompt = systemPromptParts.join("\n");
    const requestBody = {
      model: aiModel,
      messages: [
        { "role": "system", "content": systemPrompt },
        { "role": "user", "content": textToSend }
      ],
      temperature: 0.01,
      response_format: { type: "json_object" }
      // Explicitly request JSON
    };
    try {
      this.log(`Requesting AI suggestions...`);
      const response = await this.makeOpenRouterRequestWithRetries(
        { url: "https://openrouter.ai/api/v1/chat/completions", method: "POST", body: JSON.stringify(requestBody) },
        "combined filename and frontmatter suggestions"
      );
      const responseData = response.json;
      if (!responseData || !responseData.choices || responseData.choices.length === 0) {
        this.log(`AI Combined Suggestions API Call: Invalid response received.`, true);
        throw new Error("Invalid API response format.");
      }
      const resultString = responseData.choices[0].message.content.trim();
      console.log(`Denali AI: Raw AI response received: "${resultString.substring(0, Math.min(resultString.length, 200))}..."`);
      let parsedResult;
      try {
        parsedResult = JSON.parse(resultString);
      } catch (jsonError) {
        this.log(`AI Combined Suggestions API Call: Failed to parse JSON from AI response. Raw response: "${resultString}"`, true);
        console.error("JSON Parse Error:", jsonError);
        return { filename: null, title: null, author: null, project: null, topic: null, tags: [], folder: null };
      }
      let filename = typeof parsedResult.filename === "string" ? parsedResult.filename.trim() : null;
      let title = typeof parsedResult.title === "string" ? parsedResult.title.trim() : null;
      let author = typeof parsedResult.author === "string" ? parsedResult.author.trim() : null;
      let project = typeof parsedResult.project === "string" ? parsedResult.project.trim() : null;
      let topic = typeof parsedResult.topic === "string" ? parsedResult.topic.trim() : null;
      let tags = Array.isArray(parsedResult.tags) ? parsedResult.tags.map((t) => this.sanitizeTag(t)) : [];
      let folder = typeof parsedResult.folder === "string" ? parsedResult.folder.trim() : null;
      if (filename) {
        if (filename.length > maxOutputLength) {
          filename = filename.substring(0, maxOutputLength);
          this.log(`AI Combined Suggestions API Call: Truncated AI's filename response to **${maxOutputLength}** characters (plan limit).`);
        }
        filename = filename.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, "-").replace(/^-+|-+$/g, "");
      }
      this.log(`AI suggested filename: **${filename}**`);
      if (addTitle) {
      } else if (title) {
      }
      if (addAuthor) this.log(`AI suggested author: **${author}**`);
      if (addProject) this.log(`AI suggested project: **${project}**`);
      if (addTopic) this.log(`AI suggested topic: **${topic}**`);
      if (shouldRequestTags) {
        this.log(`AI suggested tags: **${tags.join(", ")}**`);
      }
      if (shouldRequestFolder) {
        this.log(`AI suggested folder: **${folder}**`);
      }
      return { filename, title, author, project, topic, tags, folder };
    } catch (error) {
      this.log(`OpenRouter API request for combined suggestions failed: ${error.message}`, true);
      console.error("OpenRouter API request failed:", error);
      return { filename: null, title: null, author: null, project: null, topic: null, tags: [], folder: null };
    }
  }
  sanitizeTag(tag) {
    let sanitizedTag = tag.replace(/\s+/g, "-");
    sanitizedTag = sanitizedTag.replace(/[^\w-]/g, "-");
    sanitizedTag = sanitizedTag.replace(/^[_-]+|[_-]+$/g, "");
    sanitizedTag = sanitizedTag.replace(/[-_]+/g, "-");
    return sanitizedTag;
  }
  /** Update only the frontmatter fields enabled in settings, preserving user data. */
  async updateFrontmatter(file, oldName, content, newName, aiTags, newFolderPath, titleSuggestion, authorSuggestion, projectSuggestion, topicSuggestion) {
    this.log(`Starting frontmatter update...`);
    await this.app.fileManager.processFrontMatter(file, async (frontmatter) => {
      const {
        addAlias,
        addTitle,
        addCreatedDate,
        createdDateFormat,
        addModifiedDate,
        modifiedDateFormat,
        addAuthor,
        addStatus,
        statusDefaultValue,
        addProject,
        addTopic
      } = this.plugin.settings;
      if (addAlias) {
        if (!frontmatter.aliases) frontmatter.aliases = [];
        if (typeof frontmatter.aliases === "string") frontmatter.aliases = [frontmatter.aliases];
        if (!Array.isArray(frontmatter.aliases)) frontmatter.aliases = [];
        if (!frontmatter.aliases.includes(oldName)) {
          frontmatter.aliases.push(oldName);
          this.log(`Added old filename '${oldName}' as an alias.`);
        } else {
          this.log(`Old filename '${oldName}' is already an alias. Skipping.`);
        }
      }
      if (aiTags && aiTags.length > 0) {
        if (!frontmatter.tags) {
          frontmatter.tags = [];
        } else if (typeof frontmatter.tags === "string") {
          frontmatter.tags = [frontmatter.tags];
        } else if (!Array.isArray(frontmatter.tags)) {
          this.log(`Warning: 'tags' property in frontmatter was not an array or string. Resetting to empty array.`, true);
          frontmatter.tags = [];
        }
        aiTags.forEach((tag) => {
          if (!frontmatter.tags.includes(tag)) {
            frontmatter.tags.push(tag);
          }
        });
        this.log(`Added AI-generated tags: **${aiTags.join(", ")}**`);
      } else {
        this.log(`No AI-generated tags to add.`);
      }
      if (addTitle) {
        const derivedTitle = newName.replace(/[-_]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
        frontmatter.title = derivedTitle;
        this.log(`Set 'title' property to derived from filename: **${derivedTitle}**`);
      } else {
        this.log(`'Add Title' is disabled. Skipping.`);
      }
      if (addCreatedDate) {
        if (!frontmatter.created) {
          const ctime = file.stat.ctime;
          frontmatter.created = formatDate(new Date(ctime), createdDateFormat);
          this.log(`Set 'created' property to: **${frontmatter.created}**`);
        } else {
          this.log(`'created' property already exists. Skipping.`);
        }
      } else {
        this.log(`'Add Created Date' is disabled. Skipping.`);
      }
      if (addModifiedDate) {
        const mtime = file.stat.mtime;
        frontmatter.modified = formatDate(new Date(mtime), modifiedDateFormat);
        this.log(`Set 'modified' property to: **${frontmatter.modified}**`);
      } else {
        this.log(`'Add Modified Date' is disabled. Skipping.`);
      }
      if (addAuthor) {
        if (authorSuggestion) {
          frontmatter.author = authorSuggestion;
          this.log(`Set 'author' property to: **${authorSuggestion}**`);
        } else {
          this.log(`'author' suggestion failed.`);
        }
      } else {
        this.log(`'Add Author' is disabled. Skipping.`);
      }
      if (addStatus) {
        if (!frontmatter.status) {
          frontmatter.status = statusDefaultValue;
          this.log(`Set 'status' property to default value: **${statusDefaultValue}**`);
        } else {
          this.log(`'status' property already exists. Skipping.`);
        }
      } else {
        this.log(`'Add Status' is disabled. Skipping.`);
      }
      if (addProject) {
        if (projectSuggestion) {
          frontmatter.project = projectSuggestion;
          this.log(`Set 'project' property to: **${projectSuggestion}**`);
        } else {
          this.log(`'project' suggestion failed.`);
        }
      } else {
        this.log(`'Add Project' is disabled. Skipping.`);
      }
      if (addTopic) {
        if (topicSuggestion) {
          frontmatter.topic = topicSuggestion;
          this.log(`Set 'topic' property to: **${topicSuggestion}**`);
        } else {
          this.log(`'topic' suggestion failed.`);
        }
      } else {
        this.log(`'Add Topic' is disabled. Skipping.`);
      }
    });
    this.log("Frontmatter update completed.");
  }
};
var DenaliAIOptionsModal = class extends import_obsidian3.Modal {
  // Store combined AI suggestions
  constructor(app, plugin, file) {
    super(app);
    __publicField(this, "plugin");
    __publicField(this, "file");
    __publicField(this, "statusContainer");
    __publicField(this, "progressBar");
    __publicField(this, "filesToProcess", []);
    __publicField(this, "processedCount", 0);
    __publicField(this, "isCancelled", false);
    __publicField(this, "cancelButton");
    __publicField(this, "fileRenamer");
    // Instance of FileRenamer for single file operations
    __publicField(this, "suggestedName", "");
    __publicField(this, "nameInput");
    __publicField(this, "editContainer");
    __publicField(this, "initialRenameDone", false);
    __publicField(this, "initialAiSuggestions", null);
    this.plugin = plugin;
    this.fileRenamer = new FileRenamer(this.app, this.plugin, this.logStatus.bind(this), () => this.isCancelled);
    this.file = file;
  }
  onOpen() {
    const { contentEl, modalEl } = this;
    contentEl.empty();
    this.contentEl.createEl("h2", { text: "Denali AI File Renamer" });
    this.statusContainer = this.contentEl.createEl("div", { cls: "denali-status-container" });
    if (!this.file) {
      this.logStatus("No file or folder selected. Please select a file or folder to rename.", true);
      setTimeout(() => this.close(), this.plugin.settings.modalCloseDelay * 1e3);
      return;
    }
    const encryptedKey = this.plugin.settings.openRouterApiKey;
    const keyDisplay = encryptedKey ? `Configured (ends with ...${encryptedKey.substring(encryptedKey.length - 4)})` : "Not set; managed connection will be tried";
    this.logStatus(`Manual API Key: **${keyDisplay}**`);
    this.logStatus(`Current Plan: **${this.plugin.settings.userPlan.toUpperCase()}**`);
    if (this.plugin.settings.paymentType === "one-time") {
      this.logStatus(`Available Credits: **${this.plugin.settings.availableCredits + this.plugin.settings.purchasedCredits}** (${this.plugin.settings.availableCredits} free + ${this.plugin.settings.purchasedCredits} purchased)`);
      this.logStatus(`Max Input Length: **${this.plugin.settings.maxInputLength}** chars`);
      this.logStatus(`Max Output Length: **${this.plugin.settings.maxOutputLength}** chars`);
    } else {
      this.logStatus(`Max Input Length: **${this.plugin.settings.maxInputLength}** chars`);
      this.logStatus(`Max Output Length: **${this.plugin.settings.maxOutputLength}** chars`);
      this.logStatus(`Batch Rename Limit: **${this.plugin.settings.batchRenameLimit}** files`);
      this.logStatus(`Daily File Limit: **${this.plugin.settings.dailyFileLimit}** files`);
      this.logStatus(`Monthly File Limit: **${this.plugin.settings.maxFilesPerMonth}** files`);
    }
    if (this.plugin.settings.renameChoice === "interactive") {
      if (this.file instanceof import_obsidian3.TFile) {
        const untitledKeywords = this.plugin.settings.untitledKeywords.split(",").map((k) => k.trim().toLowerCase());
        const isUntitled = untitledKeywords.some((keyword) => this.file.name.toLowerCase().startsWith(keyword));
        if (this.plugin.settings.lookForUntitled && !isUntitled) {
          this.logStatus(`File "${this.file.name}" is not an "untitled" file, so it will not be renamed.`, true);
          setTimeout(() => this.close(), this.plugin.settings.modalCloseDelay * 1e3);
          return;
        }
        this.logStatus(`Starting interactive rename process for file: **${this.file.name}**`);
        this.showInteractiveModal(this.file);
      } else if (this.file instanceof import_obsidian3.TFolder) {
        this.logStatus(`Starting interactive batch rename for folder: **${this.file.path}**`);
        this.processBatchRename(this.file);
      } else {
        this.logStatus("No file or folder selected. Please select a file or folder to rename.");
      }
    } else {
      if (this.file instanceof import_obsidian3.TFile) {
        const untitledKeywords = this.plugin.settings.untitledKeywords.split(",").map((k) => k.trim().toLowerCase());
        const isUntitled = untitledKeywords.some((keyword) => this.file.name.toLowerCase().startsWith(keyword));
        if (this.plugin.settings.lookForUntitled && !isUntitled) {
          this.logStatus(`File "${this.file.name}" is not an "untitled" file, so it will not be renamed.`, true);
          setTimeout(() => this.close(), this.plugin.settings.modalCloseDelay * 1e3);
          return;
        }
        this.logStatus(`Starting automatic rename process for file: **${this.file.name}**`);
        this.processAutomaticRename(this.file);
      } else if (this.file instanceof import_obsidian3.TFolder) {
        this.logStatus(`Starting automatic batch rename for folder: **${this.file.path}**`);
        this.processBatchRename(this.file);
      }
    }
    if (this.file instanceof import_obsidian3.TFolder || this.plugin.settings.renameChoice === "automatic") {
      if (this.file instanceof import_obsidian3.TFolder) {
        this.progressBar = this.contentEl.createEl("div", { cls: "denali-progress-bar-container" });
        this.progressBar.createEl("div", { cls: "denali-progress-bar" });
      }
      this.cancelButton = modalEl.createEl("button", { text: "Cancel", cls: "mod-warning" });
      this.cancelButton.onclick = () => {
        this.isCancelled = true;
        this.logStatus("Rename cancelled by user.");
      };
    }
  }
  async showInteractiveModal(file) {
    this.logStatus("Generating name and frontmatter suggestions...");
    try {
      const fileContent = await this.app.vault.read(file);
      const aiSuggestions = await this.fileRenamer.getCombinedAiSuggestions(fileContent);
      this.suggestedName = aiSuggestions.filename || file.basename;
      this.initialAiSuggestions = aiSuggestions;
      this.editContainer = this.contentEl.createEl("div", { cls: "denali-edit-container" });
      this.editContainer.createEl("label", { text: "Suggested Filename:", cls: "denali-label" });
      this.nameInput = this.editContainer.createEl("input", { type: "text", cls: "denali-input" });
      this.nameInput.value = this.suggestedName;
      const buttonContainer = this.editContainer.createEl("div", { cls: "denali-button-container" });
      const acceptButton = buttonContainer.createEl("button", { text: "Rename", cls: "mod-cta" });
      const cancelButton = buttonContainer.createEl("button", { text: "Cancel", cls: "mod-warning" });
      acceptButton.onclick = async () => {
        if (this.initialRenameDone) return;
        this.initialRenameDone = true;
        this.editContainer.style.display = "none";
        this.logStatus(`User accepted new name: **${this.nameInput.value}**`);
        this.logStatus("Starting rename...");
        await this.fileRenamer.processRename(file, this.nameInput.value, this.initialAiSuggestions);
        this.close();
      };
      cancelButton.onclick = () => {
        this.logStatus("User cancelled rename process.");
        this.close();
      };
    } catch (error) {
      this.logStatus(`Failed to generate name suggestion: ${error.message}`, true);
      setTimeout(() => this.close(), this.plugin.settings.modalCloseDelay * 1e3);
    }
  }
  async processAutomaticRename(file) {
    await this.fileRenamer.processRename(file);
    this.logStatus("Automatic rename process completed.", false);
    setTimeout(() => this.close(), this.plugin.settings.modalCloseDelay * 1e3);
  }
  logStatus(message, isError = false) {
    if (!this.plugin.settings.logEnabled) {
      return;
    }
    const timestamp = (/* @__PURE__ */ new Date()).toLocaleTimeString();
    const logLine = this.statusContainer.createEl("div", { cls: "denali-log-line" });
    logLine.createSpan({ text: `[${timestamp}] `, cls: "denali-log-timestamp" });
    const messageSpan = logLine.createSpan({ cls: isError ? "denali-log-error" : "denali-log-message" });
    messageSpan.innerHTML = message;
    this.statusContainer.scrollTop = this.statusContainer.scrollHeight;
    console.log(`Denali AI (Modal Log): ${message}`);
  }
  /** Process the Markdown files in a folder with progress and the configured batch limit. */
  async processBatchRename(folder) {
    this.filesToProcess = this.fileRenamer.getMarkdownFiles(folder);
    this.processedCount = 0;
    if (this.plugin.settings.paymentType === "subscription") {
      const batchLimit = this.plugin.settings.batchRenameLimit;
      if (this.filesToProcess.length > batchLimit) {
        this.logStatus(`Batch rename limited to ${batchLimit} files for your current plan (${this.plugin.settings.userPlan.toUpperCase()}). Found ${this.filesToProcess.length} files. Processing first ${batchLimit}.`, true);
        this.filesToProcess = this.filesToProcess.slice(0, batchLimit);
      }
    }
    if (this.filesToProcess.length === 0) {
      this.logStatus("No markdown files found in the selected folder.", true);
      if (this.progressBar) {
        this.progressBar.style.display = "none";
      }
      setTimeout(() => this.close(), this.plugin.settings.modalCloseDelay * 1e3);
      return;
    }
    this.logStatus(`Starting batch rename for ${this.filesToProcess.length} files...`);
    for (const file of this.filesToProcess) {
      if (this.isCancelled) {
        this.logStatus(`Batch rename cancelled by user.`);
        break;
      }
      const renamed = await this.fileRenamer.processRename(file);
      if (renamed) {
        this.processedCount++;
        this.updateProgressBar();
      }
    }
    this.logStatus("Batch rename process completed.", false);
    if (this.progressBar) {
      this.progressBar.style.display = "none";
    }
    if (this.cancelButton) {
      this.cancelButton.remove();
    }
    setTimeout(() => this.close(), this.plugin.settings.modalCloseDelay * 1e3);
  }
  updateProgressBar() {
    const progress = this.filesToProcess.length > 0 ? this.processedCount / this.filesToProcess.length * 100 : 0;
    if (this.progressBar) {
      const progressBar = this.progressBar.querySelector(".denali-progress-bar");
      progressBar.style.width = `${progress}%`;
      this.progressBar.title = `${this.processedCount} of ${this.filesToProcess.length} files processed.`;
    }
  }
  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
};
var DenaliSettingTab = class extends import_obsidian3.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    __publicField(this, "plugin");
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    const addSetting = (name, desc, settingKey, type, options) => {
      let displayKey;
      switch (settingKey) {
        case "renameChoice":
          displayKey = "displayRenameProcessChoice";
          break;
        case "timestampFormat":
          displayKey = "displayBackupTimestampFormat";
          break;
        case "lookForUntitled":
          displayKey = "displayLookForUntitled";
          break;
        case "customPrompt":
          displayKey = "displayCustomPrompt";
          break;
        case "maxInputLength":
          displayKey = "displayMaxInputLength";
          break;
        case "maxOutputLength":
          displayKey = "displayMaxOutputLength";
          break;
        case "renameTimestampFormat":
          displayKey = "displayRenameTimestampFormat";
          break;
        case "useFrontmatter":
          displayKey = "displayUseFrontmatter";
          break;
        case "backupEnabled":
          displayKey = "displayBackupEnabled";
          break;
        case "logEnabled":
          displayKey = "displayLogEnabled";
          break;
        case "logFileEnabled":
          displayKey = "displayLogFileEnabled";
          break;
        case "modalCloseDelay":
          displayKey = "displayModalCloseDelay";
          break;
        case "resetSettings":
          displayKey = "displayResetSettings";
          break;
        case "openRouterApiKey":
          displayKey = "displayOpenRouterApiKey";
          break;
        case "aiModel":
          displayKey = "displayAiModel";
          break;
        case "aiNameStyle":
          displayKey = "displayAiNameStyle";
          break;
        case "fileNameCase":
          displayKey = "displayFileNameCase";
          break;
        case "stopWords":
          displayKey = "displayStopWords";
          break;
        case "characterReplacement":
          displayKey = "displayCharacterReplacement";
          break;
        case "addAlias":
          displayKey = "displayAddAlias";
          break;
        case "renameOnCreation":
          displayKey = "displayRenameOnCreation";
          break;
        case "untitledKeywords":
          displayKey = "displayUntitledKeywords";
          break;
        case "autoSubfolder":
          displayKey = "displayAutoSubfolder";
          break;
        case "backupFolder":
          displayKey = "displayBackupFolder";
          break;
        case "displayDeleteDenaliFolderButton":
          displayKey = "displayDeleteDenaliFolderButton";
          break;
        // --- SAAS: New display keys for plan-based settings ---
        case "userPlan":
          displayKey = "displayUserPlan";
          break;
        case "maxFilesPerMonth":
          displayKey = "displayMaxFilesPerMonth";
          break;
        case "dailyFileLimit":
          displayKey = "displayDailyFileLimit";
          break;
        case "batchRenameLimit":
          displayKey = "displayBatchRenameLimit";
          break;
        // --- NEW: Credit System Display Settings ---
        case "paymentType":
          displayKey = "displayPaymentType";
          break;
        case "availableCredits":
          displayKey = "displayAvailableCredits";
          break;
        // --- END NEW ---
        default:
          const capitalizedSettingKey = settingKey.charAt(0).toUpperCase() + settingKey.slice(1);
          displayKey = `display${capitalizedSettingKey}`;
          break;
      }
      if (!this.plugin.settings[displayKey] && !this.plugin.settings.showAdvancedSettings) {
        return;
      }
      if (settingKey === "resetSettings") {
        new import_obsidian3.Setting(containerEl).setName(name).setDesc(desc).addButton((button) => button.setButtonText((options == null ? void 0 : options.buttonText) || "").setWarning().onClick(async () => {
          new ConfirmationModal(
            this.app,
            "Confirm Reset",
            "Are you sure you want to reset all Denali AI settings to their default values? This action cannot be undone.",
            async () => {
              const preservedDeviceId = this.plugin.settings.constanceDeviceId;
              this.plugin.settings = Object.assign({}, DEFAULT_SETTINGS);
              this.plugin.settings.constanceDeviceId = preservedDeviceId;
              await this.plugin.saveSettings();
              this.display();
              new import_obsidian3.Notice("Settings have been reset to default.", 3e3);
            }
          ).open();
        }));
        return;
      }
      const setting = new import_obsidian3.Setting(containerEl).setName(name).setDesc(desc);
      switch (type) {
        case "toggle":
          setting.addToggle((toggle) => toggle.setValue(this.plugin.settings[settingKey]).onChange(async (value) => {
            this.plugin.settings[settingKey] = value;
            await this.plugin.saveSettings();
            this.display();
          }));
          break;
        case "text":
          setting.addText((text) => {
            const isPlanDerivedAndShouldBeDisabled = ["maxFilesPerMonth", "dailyFileLimit", "batchRenameLimit", "availableCredits"].includes(settingKey);
            if (isPlanDerivedAndShouldBeDisabled) {
              text.setDisabled(true);
            }
            text.setPlaceholder((options == null ? void 0 : options.placeholder) || "").setValue(String(this.plugin.settings[settingKey]));
            if (settingKey === "openRouterApiKey") text.inputEl.type = "password";
            text.onChange(async (value) => {
              if (isPlanDerivedAndShouldBeDisabled) return;
              if (settingKey === "maxInputLength" || settingKey === "maxOutputLength") {
                const numValue = parseInt(value, 10);
                const planLimits = getPlanLimits(this.plugin.settings.userPlan);
                let maxAllowed;
                let settingName;
                if (settingKey === "maxInputLength") {
                  maxAllowed = planLimits.maxInputLength;
                  settingName = "Max AI Input Length";
                } else {
                  maxAllowed = planLimits.maxOutputLength;
                  settingName = "Max AI Output Length";
                }
                if (!isNaN(numValue) && numValue > 0 && numValue <= maxAllowed) {
                  this.plugin.settings[settingKey] = numValue;
                } else {
                  new import_obsidian3.Notice(`Invalid value for '${settingName}'. Must be a positive number up to ${maxAllowed}. Reverting.`, 4e3);
                  text.setValue(String(this.plugin.settings[settingKey]));
                  return;
                }
              } else if (settingKey === "modalCloseDelay" || settingKey === "availableCredits") {
                const numValue = parseInt(value, 10);
                if (!isNaN(numValue)) {
                  this.plugin.settings[settingKey] = numValue;
                } else {
                  new import_obsidian3.Notice(`Invalid number for '${name}'. Reverting to previous value.`, 2e3);
                  text.setValue(String(this.plugin.settings[settingKey]));
                }
              } else {
                this.plugin.settings[settingKey] = value;
              }
              await this.plugin.saveSettings();
            });
          });
          break;
        case "textarea":
          setting.addTextArea((text) => text.setPlaceholder((options == null ? void 0 : options.placeholder) || "").setValue(this.plugin.settings[settingKey]).onChange(async (value) => {
            this.plugin.settings[settingKey] = value;
            await this.plugin.saveSettings();
          }));
          break;
        case "dropdown":
          setting.addDropdown((dropdown) => {
            if (options) {
              for (const key in options) {
                dropdown.addOption(key, options[key]);
              }
            }
            dropdown.setValue(this.plugin.settings[settingKey]).onChange(async (value) => {
              this.plugin.settings[settingKey] = value;
              if (settingKey === "userPlan") {
                const newPlan = value;
                const planLimits = getPlanLimits(newPlan);
                if (this.plugin.settings.maxInputLength > planLimits.maxInputLength) {
                  this.plugin.settings.maxInputLength = planLimits.maxInputLength;
                }
                if (this.plugin.settings.maxOutputLength > planLimits.maxOutputLength) {
                  this.plugin.settings.maxOutputLength = planLimits.maxOutputLength;
                }
                if (this.plugin.settings.paymentType === "subscription") {
                  this.plugin.settings.maxFilesPerMonth = planLimits.maxFilesPerMonth;
                  this.plugin.settings.dailyFileLimit = planLimits.dailyFileLimit;
                  this.plugin.settings.batchRenameLimit = planLimits.batchRenameLimit;
                }
              } else if (settingKey === "paymentType") {
                const newPaymentType = value;
                const planLimits = getPlanLimits(this.plugin.settings.userPlan);
                if (this.plugin.settings.maxInputLength > planLimits.maxInputLength) {
                  this.plugin.settings.maxInputLength = planLimits.maxInputLength;
                }
                if (this.plugin.settings.maxOutputLength > planLimits.maxOutputLength) {
                  this.plugin.settings.maxOutputLength = planLimits.maxOutputLength;
                }
                if (newPaymentType === "subscription") {
                  this.plugin.settings.maxFilesPerMonth = planLimits.maxFilesPerMonth;
                  this.plugin.settings.dailyFileLimit = planLimits.dailyFileLimit;
                  this.plugin.settings.batchRenameLimit = planLimits.batchRenameLimit;
                } else {
                  this.plugin.settings.maxFilesPerMonth = 0;
                  this.plugin.settings.dailyFileLimit = 0;
                  this.plugin.settings.batchRenameLimit = 0;
                }
              }
              await this.plugin.saveSettings();
              this.display();
            });
          });
          break;
      }
    };
    const addHeader = (headerText, headerKey) => {
      if (this.plugin.settings[headerKey]) {
        containerEl.createEl("h3", { text: headerText });
      }
    };
    containerEl.createEl("h2", { text: "Denali AI File Renamer Settings" });
    containerEl.createEl("p", { text: "Start with a Markdown note, then use the command palette or the note/folder context menu to run Denali AI." });
    containerEl.createEl("p", { text: "Denali includes a free starter allowance. An OpenRouter API key is optional when the managed connection is available; add your own key below if you prefer." });
    new import_obsidian3.Setting(containerEl).setName("Show advanced settings").setDesc("Reveal model, prompt, naming, frontmatter, backup, and logging controls.").addToggle((toggle) => toggle.setValue(this.plugin.settings.showAdvancedSettings).onChange(async (value) => {
      this.plugin.settings.showAdvancedSettings = value;
      await this.plugin.saveSettings();
      this.display();
    }));
    addHeader("Payment & Plan Settings", "displayPaymentType");
    addSetting("Payment Type", "Choose type of purchase.", "paymentType", "dropdown", { "one-time": "One-Time Credits" });
    void this.plugin.syncPurchasedCreditsFromConstance();
    if (this.plugin.settings.paymentType === "subscription") {
      addSetting("User Plan", "The current subscription plan.", "userPlan", "dropdown", { "free": "Free", "pro": "Pro", "ultimate": "Ultimate" });
      addSetting("Max Files Per Month", "Maximum number of files a user can process per month based on their plan.", "maxFilesPerMonth", "text");
      addSetting("Daily File Limit", "Maximum number of files a user can process per day based on their plan.", "dailyFileLimit", "text");
      addSetting("Batch Rename Limit", "Maximum number of files that can be processed in a single batch rename operation.", "batchRenameLimit", "text");
    } else {
      const totalCredits = this.plugin.settings.availableCredits + this.plugin.settings.purchasedCredits;
      new import_obsidian3.Setting(containerEl).setName("Credit Balance").setDesc(`Total available: ${totalCredits} credits (${this.plugin.settings.availableCredits} free + ${this.plugin.settings.purchasedCredits} purchased). Each file rename costs 1 credit, and each frontmatter change costs 1 credit.`);
      addBillingAccountSettings(containerEl, {
        state: this.plugin.settings,
        appId: CONSTANCE_APP_ID,
        installationId: this.plugin.settings.constanceDeviceId,
        appVersion: this.plugin.manifest.version,
        persist: () => this.plugin.saveSettings(),
        syncBalance: () => this.plugin.syncPurchasedCreditsFromConstance(),
        refresh: () => this.display()
      });
      const buyCreditsSetting = new import_obsidian3.Setting(containerEl).setName("Buy More Credits").setDesc('Opens authenticated Constance checkout (app.tutivsoft.com) in your browser. Purchased credits appear automatically after payment, or use "Refresh Balance" below.');
      for (const tier of DENALI_CREDIT_TIERS) {
        buyCreditsSetting.addButton((button) => button.setButtonText(tier.label).onClick(() => {
          void this.plugin.openDenaliCheckout(tier);
        }));
      }
      new import_obsidian3.Setting(containerEl).setName("Refresh Balance").setDesc("Manually re-sync your purchased credit balance from Constance.").addButton((button) => button.setButtonText("Refresh Balance").setCta().onClick(async () => {
        button.setDisabled(true);
        await this.plugin.syncPurchasedCreditsFromConstance(true);
        button.setDisabled(false);
        this.display();
      }));
      containerEl.createEl("h3", { text: "Denali AI Credit Tiers" });
      containerEl.createEl("p", { text: "Every file rename and frontmatter change costs 1 credit each. Purchased credits never expire and are tied to this device via Constance (app.tutivsoft.com)." });
      const comparisonContainer = containerEl.createEl("div", {
        attr: { style: "margin-top: 20px; border: 1px solid var(--background-modifier-border); border-radius: 4px; overflow: hidden; font-size: 0.85em;" }
      });
      const headerRow = comparisonContainer.createEl("div", {
        attr: { style: "display: flex; font-weight: bold; background-color: var(--background-secondary); padding: 10px; border-bottom: 1px solid var(--background-modifier-border);" }
      });
      headerRow.createEl("div", { text: "Tier", attr: { style: "flex: 1; padding-right: 10px;" } });
      headerRow.createEl("div", { text: "Price", attr: { style: "flex: 1; text-align: center;" } });
      headerRow.createEl("div", { text: "Credits", attr: { style: "flex: 1; text-align: center;" } });
      const tierRows = [
        { tier: "Free Starter (one-time)", price: "Free", credits: "10 credits" },
        ...DENALI_CREDIT_TIERS.map((t) => ({ tier: `$${t.amountUsd} Credit Pack`, price: `${t.amountUsd} USD`, credits: `${t.credits} credits` }))
      ];
      tierRows.forEach((data, index) => {
        const row = comparisonContainer.createEl("div", {
          attr: {
            style: `display: flex; padding: 10px; ${index % 2 === 0 ? "background-color: var(--background-primary);" : "background-color: var(--background-secondary-alt);"} ${index < tierRows.length - 1 ? "border-bottom: 1px solid var(--background-modifier-border);" : ""}`
          }
        });
        row.createEl("div", { text: data.tier, attr: { style: "flex: 1; padding-right: 10px;" } });
        row.createEl("div", { text: data.price, attr: { style: "flex: 1; text-align: center;" } });
        row.createEl("div", { text: data.credits, attr: { style: "flex: 1; text-align: center;" } });
      });
    }
    addHeader("Main Workflow Settings", "displayMainWorkflowHeader");
    addSetting("Rename Process Choice", "Choose between automatic renaming without user interaction or an interactive modal that allows the user to approve/edit the name.", "renameChoice", "dropdown", { "automatic": "Automatic", "interactive": "Interactive" });
    addSetting("Rename on Creation", "Automatically trigger renaming when a new file is created.", "renameOnCreation", "toggle");
    addSetting("Only Rename Untitled Files", "If enabled, renaming on creation and batch renaming will only apply to files with names matching the keywords below.", "lookForUntitled", "toggle");
    addSetting("Untitled Keywords", "A comma-separated list of keywords (case-insensitive) that identify untitled files.", "untitledKeywords", "text");
    addSetting("Auto Subfolder", "Automatically move the file to a subfolder suggested by the AI based on its content.", "autoSubfolder", "toggle");
    addHeader("AI & API Settings", "displayAiApiHeader");
    addSetting("OpenRouter API Key", "Enter your OpenRouter API key. It is stored locally and sent only to OpenRouter.", "openRouterApiKey", "text");
    addSetting("AI Model", "Choose the AI model from OpenRouter to use for renaming.", "aiModel", "dropdown", OPENROUTER_MODELS.reduce((acc, curr) => ({ ...acc, [curr]: curr }), {}));
    addSetting("AI Name Style", "Choose the type of filename the AI should generate based on different priorities.", "aiNameStyle", "dropdown", { "balanced": "Balanced (e.g., Apple Inc Annual Report for 2025)", "keywordFilled": "Keyword-Filled (e.g., Code Python Tensorflow Johsnson AI Project memory second fix)", "nicheWordsOnly": "Niche Words Only (e.g., apple report 2025 john reviewed approved emergency fix2)" });
    addSetting("Custom AI Prompt", "Customize the prompt sent to the AI. Use `{content}` as a placeholder for the file content, `{max_input_length}` for the input character limit, and `{max_output_length}` for the output character limit.", "customPrompt", "textarea");
    addSetting("Max Input Length (characters)", "The maximum number of characters from the file to send to the AI. This value can be customized, but cannot exceed your plan's limit.", "maxInputLength", "text");
    addSetting("Max Output Length (characters)", "The maximum number of characters for the final file name. This value can be customized, but cannot exceed your plan's limit.", "maxOutputLength", "text");
    addHeader("File Naming & Structure", "displayFileNamingHeader");
    addSetting("File Name Case", "Choose the case style for the new file name.", "fileNameCase", "dropdown", { "kebab": "kebab-case (my-file-name)", "camel": "camelCase (myFileName)", "lowercase": "lowercase (myfilename)", "original": "Original (AI's suggestion)" });
    addSetting("Add Timestamp to New File", "Add the file's modification date (YYYY-MM-DD HH-MM-SS) as a prefix or suffix to the new filename.", "renameTimestampFormat", "dropdown", { "none": "None", "prefix": "Prefix", "suffix": "Suffix" });
    addSetting("Stop Words", "A comma-separated list of words to remove from the generated filename.", "stopWords", "text");
    addSetting("Character Replacement", 'A single character to replace spaces in the generated filename (e.g., "_" or "-"). Leave blank to use hyphens by default.', "characterReplacement", "text");
    addHeader("Frontmatter Automation", "displayFrontmatterHeader");
    addSetting("Include Frontmatter", "Include the note's frontmatter (YAML) in the content sent to the AI for better context.", "useFrontmatter", "toggle");
    addSetting("Add Alias", "Adds the old file name to the new note's frontmatter as an alias, preserving links.", "addAlias", "toggle");
    this.createFrontmatterSetting(containerEl, "addTitle", "title", "Title");
    this.createFrontmatterSetting(containerEl, "addCreatedDate", "created", "Created Date");
    this.createFrontmatterSetting(containerEl, "addModifiedDate", "modified", "Modified Date");
    this.createFrontmatterSetting(containerEl, "addAuthor", "author", "Author");
    this.createFrontmatterSetting(containerEl, "addStatus", "status", "Status");
    this.createFrontmatterSetting(containerEl, "addProject", "project", "Project");
    this.createFrontmatterSetting(containerEl, "addTopic", "topic", "Topic");
    addHeader("Backup & Log Settings", "displayBackupLogHeader");
    addSetting("Create Backups", "Create a copy of the original file before renaming it.", "backupEnabled", "toggle");
    addSetting("Backup Folder", "The path to the folder where backups will be stored. It will be created if it does not exist.", "backupFolder", "text");
    addSetting("Backup Timestamp Format", "Choose where to place the timestamp on the backup file name.", "timestampFormat", "dropdown", { "none": "None", "suffix": "Suffix (filename-YYYY-MM-DD-HH-MM-SS)" });
    addSetting("Enable Logs", "Turn on or off the logging messages in the console and rename modal.", "logEnabled", "toggle");
    addSetting("Save Logs to File", "If enabled, a log file will be created in the backup folder to record all renaming actions.", "logFileEnabled", "toggle");
    addSetting("Log Window Close Delay (seconds)", "The time to wait before the log window closes automatically after a successful rename or batch job completion. This applies to both automatic and interactive modes.", "modalCloseDelay", "text");
    addHeader("Reset Settings", "displayResetHeader");
    addSetting("Reset to Defaults", "Reset all settings to their default values.", "resetSettings", "button", { "buttonText": "Reset" });
    if (this.plugin.settings.displayDeleteDenaliFolderButton) {
      new import_obsidian3.Setting(containerEl).setName("Delete Denali AI Folder").setDesc('Permanently delete the "Denali AI" folder, including all backups and logs. This action cannot be undone.').addButton((button) => button.setButtonText("Delete Folder").setWarning().onClick(async () => {
        const folder = this.app.vault.getAbstractFileByPath(DenaliAIFileRenamer.DENALI_FOLDER);
        if (!folder) {
          new import_obsidian3.Notice(`The "${DenaliAIFileRenamer.DENALI_FOLDER}" folder does not exist.`, 3e3);
          return;
        }
        new ConfirmationModal(
          this.app,
          "Confirm Deletion",
          `Are you sure you want to permanently delete the "${DenaliAIFileRenamer.DENALI_FOLDER}" folder and all its contents (backups, logs)? This action cannot be undone.`,
          async () => {
            try {
              await this.plugin.deleteDenaliFolder();
              new import_obsidian3.Notice(`Successfully deleted the "${DenaliAIFileRenamer.DENALI_FOLDER}" folder.`, 5e3);
            } catch (error) {
              new import_obsidian3.Notice(`Failed to delete the "${DenaliAIFileRenamer.DENALI_FOLDER}" folder: ${error.message}`, 5e3);
              console.error("Denali Folder Deletion Error:", error);
            }
            this.display();
          }
        ).open();
      }));
    }
  }
  createFrontmatterSetting(containerEl, settingKey, propertyName, name) {
    const displayKey = `displayAdd${propertyName.charAt(0).toUpperCase() + propertyName.slice(1)}`;
    const promptDisplayKey = `display${propertyName.charAt(0).toUpperCase() + propertyName.slice(1)}Prompt`;
    const valueDisplayKey = `display${propertyName.charAt(0).toUpperCase() + propertyName.slice(1)}DefaultValue`;
    const formatDisplayKey = `display${propertyName.charAt(0).toUpperCase() + propertyName.slice(1)}DateFormat`;
    if (this.plugin.settings[displayKey]) {
      new import_obsidian3.Setting(containerEl).setName(`Add '${propertyName}'`).setDesc(`Automatically add a '${propertyName}' property to the note's frontmatter.`).addToggle((toggle) => toggle.setValue(this.plugin.settings[settingKey]).onChange(async (value) => {
        this.plugin.settings[settingKey] = value;
        await this.plugin.saveSettings();
        this.display();
      }));
      if (this.plugin.settings[settingKey] && propertyName !== "title") {
        const subSetting = new import_obsidian3.Setting(containerEl);
        let desc = "";
        let placeholder = "";
        let value = "";
        let settingField = null;
        if (["author", "project", "topic"].includes(propertyName)) {
          desc = "The AI prompt to generate this property. The AI will respond with only the value for the property.";
          settingField = propertyName + "Prompt";
          placeholder = DEFAULT_SETTINGS[settingField];
          value = this.plugin.settings[settingField];
          if (this.plugin.settings[promptDisplayKey]) {
            subSetting.setName(`${name} Value/Prompt`).setDesc(desc);
            subSetting.addTextArea((text) => text.setPlaceholder(placeholder).setValue(value).onChange(async (val) => {
              this.plugin.settings[settingField] = val;
              await this.plugin.saveSettings();
            }));
          }
        } else if (propertyName === "status") {
          desc = "The default value for the status property.";
          settingField = propertyName + "DefaultValue";
          placeholder = DEFAULT_SETTINGS[settingField];
          value = this.plugin.settings[settingField];
          if (this.plugin.settings[valueDisplayKey]) {
            subSetting.setName(`${name} Value/Prompt`).setDesc(desc);
            subSetting.addText((text) => text.setPlaceholder(placeholder).setValue(value).onChange(async (val) => {
              this.plugin.settings[settingField] = val;
              await this.plugin.saveSettings();
            }));
          }
        } else if (["created", "modified"].includes(propertyName)) {
          desc = "The date format for the date. Use YYYY, MM, DD, HH, mm, ss.";
          settingField = propertyName + "DateFormat";
          placeholder = DEFAULT_SETTINGS[settingField];
          value = this.plugin.settings[settingField];
          if (this.plugin.settings[formatDisplayKey]) {
            subSetting.setName(`${name} Date Format`).setDesc(desc);
            subSetting.addText((text) => text.setPlaceholder(placeholder).setValue(value).onChange(async (val) => {
              this.plugin.settings[settingField] = val;
              await this.plugin.saveSettings();
            }));
          }
        }
      }
    }
  }
};
