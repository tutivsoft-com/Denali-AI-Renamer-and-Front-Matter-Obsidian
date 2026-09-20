// Denali AI File Renamer Documentation
//
// This plugin automatically renames files and inriches their frontmatter using AI.
//
// * Customization: Easily change the AI model from the `OPENROUTER_MODELS` array. You can also edit the prompts for the AI, located in the `PROMPT_STYLES` and `DEFAULT_SETTINGS` constants.
// * Settings: Key configurations are managed in the `DenaliSettings` interface and `DEFAULT_SETTINGS` object, including API keys, file naming styles, and frontmatter properties.
// * Workflow: The program starts with `onload()`, which registers commands and events. User actions trigger the `DenaliAIOptionsModal`, which then uses the `FileRenamer` class to handle core logic: fetching AI suggestions, updating frontmatter, and renaming the file.
// * Future: All UI settings can be hidden or shown via a boolean flag in the `DenaliSettings` interface.


import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, TFolder } from 'obsidian';
import { requestUrl, RequestUrlParam, RequestUrlResponse } from 'obsidian'; // Import RequestUrlParam and RequestUrlResponse
import { addBillingAccountSettings, claimAccountFreeUsage, spendAccountCredits } from './constance-account';
import { PluginSupport } from './plugin-support';

// --- Pattern B remote key manifest (TutivSoft.OpenAiKeyManifest port) ---
// Fetches this app's own encrypted OpenRouter key from a GitHub-hosted manifest
// instead of requiring the user to paste one. Same algorithm as the C# reference
// (desktop-app-Windows-Kest-LLM-Chat-AI/.../RemoteOpenAiKeyManifest.cs), the
// verified Python port (tool-python-openrouter-manifest-crypto), and the
// sibling Obsidian plugin Culebra-Obsidian-AI-Auto-Correct-Spelling's main.ts.
// The manual "OpenRouter API Key" setting remains as a user override that
// takes priority when set (see DenaliAIFileRenamer.resolveApiKey() below).
const REMOTE_MANIFEST_PASSPHRASE = "Kivu.RemoteKeyManifest.v1.2026D";
const REMOTE_MANIFEST_URL =
    "https://raw.githubusercontent.com/tutivsoft-com/Resources/main/desktop-python-JavaScript-Denali-AI-Renamer-and-Front-Matter.txt";

interface DenaliEncryptedSecretEnvelope {
    q: number;
    x: string;
    w: string;
    n: number;
    a: string;
    b: string;
    c: string;
    d: string;
}

interface DenaliRemoteKeySlot {
    i: string;
    ii?: string;
    s: string;
    v: DenaliEncryptedSecretEnvelope;
}

interface DenaliRemoteKeyManifest {
    m: number;
    n?: string; // next manifest URL (decoy-adjacent field, same shape as the live ai1.txt)
    r: DenaliRemoteKeySlot[];
}

function denaliBase64ToBytes(b64: string): Uint8Array {
    const binary = atob(b64);
    const bytes = new Uint8Array(new ArrayBuffer(binary.length));
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

async function denaliDecryptSecretEnvelope(envelope: DenaliEncryptedSecretEnvelope, passphrase: string): Promise<string> {
    if (envelope.x !== "AES-256-GCM" || envelope.w !== "PBKDF2-HMAC-SHA256") {
        throw new Error(`Unsupported manifest envelope algorithm/kdf: ${envelope.x} / ${envelope.w}`);
    }

    const keyMaterial = await window.crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(passphrase),
        { name: "PBKDF2" },
        false,
        ["deriveKey"],
    );

    const key = await window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: denaliBase64ToBytes(envelope.a),
            iterations: envelope.n,
            hash: "SHA-256",
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"],
    );

    const ciphertext = denaliBase64ToBytes(envelope.c);
    const tag = denaliBase64ToBytes(envelope.d);
    const ciphertextAndTag = new Uint8Array(new ArrayBuffer(ciphertext.length + tag.length));
    ciphertextAndTag.set(ciphertext, 0);
    ciphertextAndTag.set(tag, ciphertext.length);

    const plaintext = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: denaliBase64ToBytes(envelope.b) },
        key,
        ciphertextAndTag,
    );

    return new TextDecoder().decode(plaintext);
}

function denaliSelectSlot(manifest: DenaliRemoteKeyManifest, wantState: "active" | "next"): DenaliRemoteKeySlot | null {
    const byMarker = manifest.r.find((slot) => slot.ii === wantState);
    if (byMarker) {
        return byMarker;
    }
    // Fallback for manifests without the "ii" marker (matches the C# lib's
    // ActiveKeyId/State-based selection): active = state "0", next = state "1".
    const fallbackState = wantState === "active" ? "0" : "1";
    return manifest.r.find((slot) => slot.s === fallbackState) ?? null;
}

async function denaliFetchRemoteManifest(url: string): Promise<DenaliRemoteKeyManifest> {
    const response = await requestUrl({ url, method: "GET", throw: false });
    if (response.status < 200 || response.status >= 300) {
        throw new Error(`Manifest fetch failed: HTTP ${response.status}`);
    }
    return response.json as DenaliRemoteKeyManifest;
}

async function denaliTryDecryptManifestKey(manifest: DenaliRemoteKeyManifest, source: string): Promise<string> {
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

/**
 * Fetches and decrypts this app's own OpenRouter key from its GitHub manifest,
 * falling back to the manifest's NextManifestUrl if the primary one is
 * unreachable or fails to decrypt (key rotation / relocation support).
 */
async function fetchRemoteApiKey(): Promise<string> {
    try {
        const manifest = await denaliFetchRemoteManifest(REMOTE_MANIFEST_URL);
        return await denaliTryDecryptManifestKey(manifest, REMOTE_MANIFEST_URL);
    } catch (primaryError) {
        console.warn("Denali: primary manifest failed, trying next-manifest fallback", primaryError);
        const primaryManifest = await denaliFetchRemoteManifest(REMOTE_MANIFEST_URL).catch(() => null);
        const nextUrl = primaryManifest?.n;
        if (nextUrl && nextUrl !== REMOTE_MANIFEST_URL) {
            const nextManifest = await denaliFetchRemoteManifest(nextUrl);
            return await denaliTryDecryptManifestKey(nextManifest, nextUrl);
        }
        throw primaryError;
    }
}
// --- END Pattern B remote key manifest ---

// --- CONSTANCE (TutivSoft central billing) ---
// Unsigned public browser-relay integration. This plugin's main.js is a
// locally-readable bundle (same trust model as a browser extension), so it
// cannot hold a real HMAC shared secret. Constance's public browser-relay
// endpoints exist specifically for this trust model. See
// CONSTANCE_BILLING_MIGRATION_ANALYSIS.md and BROWSER_CREDIT_SPEND_PLAN.md
// in the Constance repo for the full design (built for the sibling app,
// Antero AI Auto Spell Correct, and reused here unmodified).
const CONSTANCE_BASE_URL = "https://app.tutivsoft.com";
const CONSTANCE_APP_ID = "denali-ai-file-renamer-front-matter";

// One-time credit tiers, matching the catalog row already added to
// map_product_price_paddle.csv. The Pdl_price_id_OneTime* values are real
// live Paddle ids (provisioned 2026-08-19, App_Environment=live).
interface DenaliCreditTier {
    label: string;
    amountUsd: number;
    credits: number;
    priceId: string;
}
const DENALI_CREDIT_TIERS: DenaliCreditTier[] = [
    { label: "$1 → 50 credits", amountUsd: 1, credits: 50, priceId: "pri_01m0b7gtqfncsz7sc4fc3aejpc" },
    { label: "$5 → 400 credits", amountUsd: 5, credits: 400, priceId: "pri_01m0b7gvay5f3xmb80jd99ehzk" },
    { label: "$15 → 1600 credits", amountUsd: 15, credits: 1600, priceId: "pri_01m0b7gvymzrp8b0jy32xsj7q2" },
];

/**
 * Generates a stable per-install device id using a real CSPRNG
 * (crypto.getRandomValues, not Math.random). Doubles as
 * external_customer_id/machine_id for every Constance call.
 */
function generateConstanceDeviceId(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Builds the unauthenticated Constance checkout redirect URL for a given
 * one-time credit tier. Opened with window.open(url, "_blank") rather than
 * Electron's shell.openExternal, since this plugin's manifest declares
 * isDesktopOnly: false and must also work in mobile webviews.
 */
function buildDenaliBuyUrl(priceId: string, email: string, deviceId: string): string {
    const params = new URLSearchParams({
        app_id: CONSTANCE_APP_ID,
        price_id: priceId,
        email: email,
        external_customer_id: deviceId,
    });
    return `${CONSTANCE_BASE_URL}/buy?${params.toString()}`;
}
// --- END CONSTANCE ---

// A simple utility to format dates without a heavy library
function formatDate(date: Date, formatStr: string): string {
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hour = date.getHours().toString().padStart(2, '0');
    const minute = date.getMinutes().toString().padStart(2, '0');
    const second = date.getSeconds().toString().padStart(2, '0');

    return formatStr
        .replace(/YYYY/g, year)
        .replace(/MM/g, month)
        .replace(/DD/g, day)
        .replace(/HH/g, hour)
        .replace(/mm/g, minute)
        .replace(/ss/g, second);
}

// --- SAAS: Define User Plan and Limits ---
type UserPlan = 'free' | 'pro' | 'ultimate';
type PaymentType = 'subscription' | 'one-time'; // New payment type

// Manually set the current user plan for testing. This will later be determined by payment status.
const CURRENT_USER_PLAN: UserPlan = 'free';

interface PlanLimits {
    maxFilesPerMonth: number;
    dailyFileLimit: number;
    batchRenameLimit: number;
    maxInputLength: number;
    maxOutputLength: number;
}

function getPlanLimits(plan: UserPlan): PlanLimits {
    switch (plan) {
        case 'free':
            return {
                maxFilesPerMonth: 10,
                dailyFileLimit: 3,
                batchRenameLimit: 3,
                maxInputLength: 1000,
                maxOutputLength: 50,
            };
        case 'pro':
            return {
                maxFilesPerMonth: 1000,
                dailyFileLimit: 300,
                batchRenameLimit: 300,
                maxInputLength: 3000,
                maxOutputLength: 500, // Corrected from 100 to 500
            };
        case 'ultimate':
            return {
                maxFilesPerMonth: 8000,
                dailyFileLimit: 300,
                batchRenameLimit: 3000,
                maxInputLength: 10000,
                maxOutputLength: 1000, // Corrected from 100 to 1000
            };
        default:
            // Fallback to free plan if somehow an invalid plan is set
            console.warn(`Denali AI: Unknown user plan '${plan}'. Defaulting to 'free'.`);
            return getPlanLimits('free');
    }
}
// --- END SAAS: Define User Plan and Limits ---


interface DenaliSettings {
    openRouterApiKey: string;
    customPrompt: string;
    aiModel: string;
    untitledKeywords: string;
    renameOnCreation: boolean;
    useFrontmatter: boolean;
    lookForUntitled: boolean;
    maxInputLength: number;
    maxOutputLength: number;
    backupEnabled: boolean;
    backupFolder: string;
    timestampFormat: 'prefix' | 'suffix' | 'none';
    fileNameCase: 'kebab' | 'camel' | 'lowercase' | 'original';
    addAlias: boolean;
    showRenameModal: boolean;
    modalCloseDelay: number;
    aiNameStyle: 'balanced' | 'keywordFilled' | 'nicheWordsOnly';
    stopWords: string;
    characterReplacement: string;
    autoSubfolder: boolean;
    logEnabled: boolean;
    renameTimestampFormat: 'prefix' | 'suffix' | 'none';
    logFileEnabled: boolean;
    renameChoice: 'automatic' | 'interactive';
    // New frontmatter settings
    addTitle: boolean;
    titlePrompt: string;
    addCreatedDate: boolean;
    createdDateFormat: string;
    addModifiedDate: boolean;
    modifiedDateFormat: string;
    addAuthor: boolean;
    authorPrompt: string;
    addStatus: boolean;
    statusDefaultValue: string;
    addProject: boolean;
    projectPrompt: string;
    addTopic: boolean;
    topicPrompt: string;

    // --- SAAS: New Plan-based Settings ---
    userPlan: UserPlan;
    maxFilesPerMonth: number;
    dailyFileLimit: number;
    batchRenameLimit: number;
    // --- END SAAS: New Plan-based Settings ---

    // GUI display settings for individual fields
    showAdvancedSettings: boolean;
    displayRenameProcessChoice: boolean;
    displayRenameOnCreation: boolean;
    displayUntitledKeywords: boolean;
    displayLookForUntitled: boolean;
    displayAutoSubfolder: boolean;
    displayOpenRouterApiKey: boolean;
    displayAiModel: boolean;
    displayAiNameStyle: boolean;
    displayCustomPrompt: boolean;
    displayMaxInputLength: boolean;
    displayMaxOutputLength: boolean;
    displayFileNameCase: boolean;
    displayRenameTimestampFormat: boolean;
    displayStopWords: boolean; // Changed from string to boolean
    displayCharacterReplacement: boolean; // Changed from string to boolean
    displayUseFrontmatter: boolean;
    displayAddAlias: boolean;
    displayAddTitle: boolean;
    displayTitlePrompt: boolean; // Changed from string to boolean
    displayAddCreatedDate: boolean;
    displayCreatedDateFormat: boolean; // Changed from string to boolean
    displayAddModifiedDate: boolean;
    displayModifiedDateFormat: boolean; // Changed from string to boolean
    displayAddAuthor: boolean;
    displayAuthorPrompt: boolean; // Changed from string to boolean
    displayAddStatus: boolean;
    displayStatusDefaultValue: boolean; // Changed from string to boolean
    displayAddProject: boolean;
    displayProjectPrompt: boolean; // Changed from string to boolean
    displayAddTopic: boolean;
    displayTopicPrompt: boolean; // Changed from string to boolean
    displayBackupEnabled: boolean;
    displayBackupFolder: boolean;
    displayBackupTimestampFormat: boolean;
    displayLogEnabled: boolean;
    displayLogFileEnabled: boolean;
    displayModalCloseDelay: boolean;
    displayResetSettings: boolean;
    displayDeleteDenaliFolderButton: boolean; // New setting for the delete button

    // New GUI display settings for headers
    displayMainWorkflowHeader: boolean;
    displayAiApiHeader: boolean;
    displayFileNamingHeader: boolean;
    displayFrontmatterHeader: boolean;
    displayBackupLogHeader: boolean;
    displayResetHeader: boolean;
    resetSettings: boolean; // Add this key for the reset button

    // --- SAAS: New Display Settings for Plan-based Features ---
    displayUserPlan: boolean;
    displayMaxFilesPerMonth: boolean;
    displayDailyFileLimit: boolean;
    displayBatchRenameLimit: boolean;
    // --- END SAAS: New Display Settings for Plan-based Features ---

    // --- NEW: Credit System Settings ---
    paymentType: PaymentType; // 'subscription' or 'one-time'
    availableCredits: number; // Free/local starter pool, spent first, never touches Constance
    initialFreeCreditsGranted: boolean;
    displayPaymentType: boolean;
    displayAvailableCredits: boolean;
    // --- END NEW ---

    // --- CONSTANCE: Central billing (replaces the old local license-key system) ---
    purchasedCredits: number; // Local mirror of the real Constance CreditBalance
    constanceDeviceId: string; // Stable per-install id; doubles as external_customer_id/machine_id
    billingEmail: string; // Entered by the user, sent to Constance's checkout only
    billingAccessToken: string;
    billingAccountLinked: boolean;
    pendingSpendEvents: Array<{ eventId: string; amount: number }>;
    // --- END CONSTANCE ---
}

const PROMPT_STYLES = {
    'keywordFilled': 'Based on the following text, generate a good and useful filename. The filename should be a healthy mixture of context, breadth, and depth, similar to the style of "Code Python Tensorflow Johsnson AI Project memory second fix". The filename must not exceed {max_output_length} characters. Dont send any extra text - just give back one simple line of text ONLY',
    'balanced': 'Based on the following text, generate a concise, human-readable filename that uses a title case style, similar to the example "Apple Inc Annual Report for 2025". The filename must not exceed {max_output_length} characters. Respond with only the filename and nothing else.',
    'nicheWordsOnly': 'Based on the following text, extract only the most specific, niche keywords and terms, similar to the example "apple report 2025 john reviewed approved emergency fix2". The filename must not exceed {max_output_length} characters. Respond with only the filename and nothing else.',
}

// --- SAAS: Initialize default plan limits ---
const defaultPlanLimits = getPlanLimits(CURRENT_USER_PLAN);
// --- END SAAS ---

const DEFAULT_SETTINGS: DenaliSettings = {
    openRouterApiKey: '',
    customPrompt: PROMPT_STYLES.balanced,
    aiModel: '~deepseek/deepseek-v4-flash-latest',
    untitledKeywords: 'Untitled,New Text Document',
    renameOnCreation: false,
    useFrontmatter: true,
    lookForUntitled: false,
    maxInputLength: defaultPlanLimits.maxInputLength, // SAAS: Derived from plan
    maxOutputLength: defaultPlanLimits.maxOutputLength, // SAAS: Derived from plan
    backupEnabled: false,
    backupFolder: 'Denali-Backup',
    timestampFormat: 'none',
    fileNameCase: 'original',
    addAlias: false,
    showRenameModal: true,
    modalCloseDelay: 1,
    aiNameStyle: 'balanced',
    stopWords: 'a, an, the, and, but, or, for, nor, so, yet, at, by, from, in, into, of, off, on, onto, to, with',
    characterReplacement: '-',
    autoSubfolder: false,
    logEnabled: true,
    renameTimestampFormat: 'none',
    logFileEnabled: true,
    renameChoice: 'automatic',
    // New frontmatter settings
    addTitle: true,
    titlePrompt: 'Based on the following note content, generate a concise, human-readable title for the note. Respond with only the title and nothing else.',
    addCreatedDate: true,
    createdDateFormat: 'YYYY-MM-DD HH:mm',
    addModifiedDate: true,
    modifiedDateFormat: 'YYYY-MM-DD HH:mm',
    addAuthor: false,
    authorPrompt: 'Based on the following note, guess the author or source name. Respond with only the author name and nothing else.',
    addStatus: true,
    statusDefaultValue: 'draft',
    addProject: false,
    projectPrompt: 'Based on the following note content, suggest a project name. Respond with only the name of the project and nothing else.',
    addTopic: false,
    topicPrompt: 'Based on the following note content, suggest a single, broad topic or category. Respond with only the topic and nothing else.',

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
    displayDeleteDenaliFolderButton: true, // Default to show the delete button

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
    paymentType: 'one-time', // Default to one-time payment
    availableCredits: 0,
    initialFreeCreditsGranted: true,
    displayPaymentType: true,
    displayAvailableCredits: true,
    // --- END NEW ---

    // --- CONSTANCE: Central billing defaults ---
    purchasedCredits: 0,
    pendingSpendEvents: [],
    constanceDeviceId: '', // Generated on first onload() via crypto.getRandomValues
    billingEmail: '',
    billingAccessToken: '',
    billingAccountLinked: false,
    // --- END CONSTANCE ---
};

const OPENROUTER_MODELS = [
    'openai/gpt-5-mini',
    'google/gemini-2.5-flash-lite',
    'mistralai/mistral-7b-instruct',
    'openai/gpt-3.5-turbo',
    'google/gemma-7b-it',
    'google/gemma-7b',
    'nousresearch/nous-hermes-2-mixtral-8x7b-dpo',
];

/**
 * A simple confirmation modal for user actions.
 */
class ConfirmationModal extends Modal {
    message: string;
    onConfirm: () => void;
    onCancel: () => void;

    constructor(app: App, title: string, message: string, onConfirm: () => void, onCancel: () => void = () => {}) {
        super(app);
        this.titleEl.setText(title);
        this.message = message;
        this.onConfirm = onConfirm;
        this.onCancel = onCancel;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('p', { text: this.message });

        new Setting(contentEl)
            .addButton((button) => {
                button
                    .setButtonText('Confirm')
                    .setCta()
                    .onClick(() => {
                        this.close();
                        this.onConfirm();
                    });
            })
            .addButton((button) => {
                button
                    .setButtonText('Cancel')
                    .onClick(() => {
                        this.close();
                        this.onCancel();
                    });
            });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

/**
 * Owns Denali's note-organization workflow: gather suggestions, show the
 * proposed filename/frontmatter changes, and commit a safe rename with backup
 * and credit accounting handled in one place.
 */
export default class DenaliAIFileRenamer extends Plugin {
    settings: DenaliSettings;
    support!: PluginSupport;
    renameModal: DenaliAIOptionsModal | null = null;

    public static readonly DENALI_FOLDER = 'Denali AI';
    public static readonly BACKUP_SUBFOLDER = `${DenaliAIFileRenamer.DENALI_FOLDER}/Backups`;
    public static readonly LOGS_SUBFOLDER = `${DenaliAIFileRenamer.DENALI_FOLDER}/Logs`;

    // Pattern B: cached once resolved so every AI call doesn't re-fetch the
    // manifest; cleared implicitly on plugin reload in case the key was
    // rotated mid-session (a fresh resolveApiKey() call after that just
    // re-fetches).
    private remoteApiKeyCache: string | null = null;

    /**
     * Resolves the OpenRouter API key to use for AI calls: the manual
     * "OpenRouter API Key" setting always wins when set (existing user
     * override behavior, unchanged); otherwise falls back to this app's own
     * Pattern B remote key manifest (see fetchRemoteApiKey() above).
     */
    async resolveApiKey(): Promise<string | null> {
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
            console.error('Denali AI: remote key manifest fetch/decrypt failed:', error);
            return null;
        }
    }

    async onload() {
        this.support = new PluginSupport(this, { name: 'Denali AI Renamer', summary: 'Generate safer filenames and searchable frontmatter from note content.', quickStart: ['Sign in to billing in Settings.', 'Open a Markdown note.', 'Run the Denali rename command and approve the preview.'], commands: ['Rename current note', 'Open Denali options', 'Copy debug log'], troubleshooting: ['Use Copy debug log before reporting a problem.', 'Check that the note is writable and has enough content to name.'] });
        this.support.start();
        await this.loadSettings();

        // --- CONSTANCE: Ensure a stable device id exists, created once and reused forever ---
        if (!this.settings.constanceDeviceId) {
            this.settings.constanceDeviceId = generateConstanceDeviceId();
            await this.saveSettings();
        }
        // Sync the local purchased-credit mirror from Constance in the background.
        // Fire-and-forget: does not block plugin startup, and errors are handled internally.
        this.settings.pendingSpendEvents = Array.isArray(this.settings.pendingSpendEvents) ? this.settings.pendingSpendEvents.filter(item => item && typeof item.eventId === 'string' && Number.isInteger(item.amount) && item.amount > 0) : [];
        await this.saveSettings();
        void this.syncPurchasedCreditsFromConstance().then(() => this.retryPendingSpendEvents());
        // --- END CONSTANCE ---

        // Set the backup folder path to the new structure
        this.settings.backupFolder = DenaliAIFileRenamer.BACKUP_SUBFOLDER;

        // Migrate away from the reinstallable local starter grant. Constance now
        // owns the account-scoped lifetime allowance and returns the remaining value.
        if (!this.settings.initialFreeCreditsGranted) {
            this.settings.initialFreeCreditsGranted = true;
            this.settings.availableCredits = 0;
            await this.saveSettings();
        }

        // --- NEW: Perform initial API validation ---
        const apiValidationSuccess = await this.performInitialApiValidation();
        if (!apiValidationSuccess) {
            // If validation failed, the performInitialApiValidation function already showed a notice
            // and instructed to contact support. The plugin will continue to load, but AI features
            // will likely fail due to an invalid API key, which is handled by existing error logic.
        }
        // --- END NEW ---

        this.addSettingTab(new DenaliSettingTab(this.app, this));

        this.addCommand({
            id: 'open-denali-ai-options',
            name: 'Denali AI: Open options for current note',
            callback: () => {
                const activeFile = this.app.workspace.getActiveFile();
                if (!activeFile || activeFile.extension !== 'md') {
                    new Notice('Open a Markdown note before using Denali AI.', 4000);
                    return;
                }
                if (this.renameModal) this.renameModal.close();
                this.renameModal = new DenaliAIOptionsModal(this.app, this, activeFile);
                this.renameModal.open();
            }
        });

        this.addCommand({
            id: 'rename-current-file-denali-ai',
            name: 'Denali AI: Rename current note',
            checkCallback: (checking: boolean) => {
                const activeFile = this.app.workspace.getActiveFile();
                if (activeFile && activeFile.extension === 'md') {
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

        // Existing event listener for file-menu
        this.registerEvent(
            this.app.workspace.on('file-menu', (menu, file) => {
                if (file instanceof TFile && file.extension === 'md') {
                    menu.addItem((item) => {
                        item.setTitle('Denali AI: Rename note')
                            .setIcon('pencil-ruler')
                            .onClick(() => {
                                if (this.renameModal) this.renameModal.close();
                                this.renameModal = new DenaliAIOptionsModal(this.app, this, file);
                                this.renameModal.open();
                            });
                    });
                } else if (file instanceof TFolder) {
                    menu.addItem((item) => {
                        item.setTitle('Denali AI: Batch rename folder')
                            .setIcon('folder-edit')
                            .onClick(() => {
                                if (this.renameModal) this.renameModal.close();
                                this.renameModal = new DenaliAIOptionsModal(this.app, this, file);
                                this.renameModal.open();
                            });
                    });
                }
            })
        );

        // NEW event listener for editor-menu
        this.registerEvent(
            this.app.workspace.on('editor-menu', (menu, editor, view) => {
                const activeFile = this.app.workspace.getActiveFile();
                if (activeFile && activeFile.extension === 'md') {
                    menu.addItem((item) => {
                        item.setTitle('Denali AI: Rename note')
                            .setIcon('pencil-ruler')
                            .onClick(() => {
                                if (this.renameModal) this.renameModal.close();
                                this.renameModal = new DenaliAIOptionsModal(this.app, this, activeFile);
                                this.renameModal.open();
                            });
                    });
                }
            })
        );

        this.registerEvent(
            this.app.vault.on('create', (file) => {
                if (this.settings.renameOnCreation && file instanceof TFile && file.extension === 'md') {
                    const untitledKeywords = this.settings.untitledKeywords.split(',').map(k => k.trim());
                    if (untitledKeywords.some(keyword => file.name.startsWith(keyword))) {
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
        // Removed the automatic deletion of the Denali folder on unload.
        // Deletion is now an explicit user action via the settings tab.
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
        this.settings.billingAccessToken = typeof this.settings.billingAccessToken === 'string' ? this.settings.billingAccessToken : '';
        this.settings.billingAccountLinked = this.settings.billingAccountLinked === true && Boolean(this.settings.billingAccessToken);
        const planLimits = getPlanLimits(this.settings.userPlan);

        // Ensure maxInputLength does not exceed plan limits
        if (this.settings.maxInputLength > planLimits.maxInputLength) {
            this.settings.maxInputLength = planLimits.maxInputLength;
        }
        // Ensure maxOutputLength does not exceed plan limits
        if (this.settings.maxOutputLength > planLimits.maxOutputLength) {
            this.settings.maxOutputLength = planLimits.maxOutputLength;
        }

        // Only apply subscription-specific limits if paymentType is 'subscription'
        if (this.settings.paymentType === 'subscription') {
            this.settings.maxFilesPerMonth = planLimits.maxFilesPerMonth;
            this.settings.dailyFileLimit = planLimits.dailyFileLimit;
            this.settings.batchRenameLimit = planLimits.batchRenameLimit;
        } else {
            // For one-time payment, these limits are not used, so set to 0 or default if needed.
            this.settings.maxFilesPerMonth = 0; // Explicitly set to 0 for one-time
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
        const folder = this.app.vault.getAbstractFileByPath(DenaliAIFileRenamer.DENALI_FOLDER);
        if (folder instanceof TFolder) {
            await this.app.vault.delete(folder, true);
            // Notice is handled by the calling context (settings tab)
        } else {
            throw new Error(`The folder "${DenaliAIFileRenamer.DENALI_FOLDER}" does not exist or is not a folder.`);
        }
    }

    // --- CONSTANCE: Central billing client (replaces the old local license-key system) ---
    /**
     * Reads the current entitlement/credit balance from Constance via the
     * unsigned same-install lookup (external_customer_id == machine_id, no
     * license_key, no subscription_id) and updates the local purchasedCredits
     * mirror. Called on plugin onload() and whenever the settings tab opens.
     * @param showNotice Whether to surface a user-visible Notice with the result (used by the manual "Refresh balance" button).
     */
    async syncPurchasedCreditsFromConstance(showNotice: boolean = false): Promise<void> {
        const deviceId = this.settings.constanceDeviceId;
        if (!deviceId || !this.settings.billingAccessToken || !this.settings.billingAccountLinked) {
            return;
        }
        try {
            const response = await requestUrl({
                url: `${CONSTANCE_BASE_URL}/api/v1/billing/entitlements/me?${new URLSearchParams({ app_id: CONSTANCE_APP_ID, installation_id: deviceId }).toString()}`,
                method: 'GET',
                headers: { Authorization: `Bearer ${this.settings.billingAccessToken}` },
                throw: false,
            });

            if (response.status === 200) {
                const balance = response.json?.data?.credits?.balance;
                if (typeof balance === 'number') {
                    this.settings.purchasedCredits = balance;
                    await this.saveSettings();
                }
                if (showNotice) {
                    new Notice(`Denali AI: Balance refreshed. Purchased credits: ${this.settings.purchasedCredits}`, 4000);
                }
            } else {
                console.warn(`Denali AI: Constance entitlement sync failed with status ${response.status}.`, response.json);
                if (showNotice) {
                    new Notice(`Denali AI: Could not refresh balance (status ${response.status}). Please try again later.`, 5000);
                }
            }
        } catch (error) {
            console.error('Denali AI: Constance entitlement sync request failed:', error);
            if (showNotice) {
                new Notice('Denali AI: Could not reach the billing server to refresh balance.', 5000);
            }
        }
    }

    /**
     * Spends `amount` credits against the real Constance CreditBalance via the
     * unsigned public browser credit-spend endpoint (gated server-side by this
     * app's App_Allow_Unsigned_Browser_Credit_Spend catalog flag).
     * @param amount Credits to spend. Must be > 0 (callers should skip calling this for 0).
     * @returns 'success' with the server's authoritative new balance, 'insufficient'
     *          on a confirmed 402 (caller must block and never retry), or 'error' on
     *          any other failure (network/5xx) — caller should fail OPEN and let the
     *          next sync correct the local mirror, per this app's agreed policy.
     */
    async retryPendingSpendEvents(): Promise<void> {
        for (const pending of [...this.settings.pendingSpendEvents]) {
            const result = await this.spendConstanceCredits(pending.amount, pending.eventId);
            if (result.outcome === 'error') break;
            this.settings.pendingSpendEvents = this.settings.pendingSpendEvents.filter(item => item.eventId !== pending.eventId);
            this.settings.purchasedCredits = result.outcome === 'success' ? (result.newPurchasedBalance ?? 0) : 0;
            await this.saveSettings();
        }
    }

    async spendConstanceCredits(amount: number, stableEventId: string = `denali-spend-${this.settings.constanceDeviceId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`): Promise<{ outcome: 'success' | 'insufficient' | 'error'; newPurchasedBalance?: number }> {
        const deviceId = this.settings.constanceDeviceId;
        if (!deviceId || amount <= 0) {
            return { outcome: 'error' };
        }
        const result = await spendAccountCredits(this.settings, CONSTANCE_APP_ID, deviceId, stableEventId, amount);
        if (result.kind === 'ok') return { outcome: 'success', newPurchasedBalance: result.balance };
        if (result.kind === 'insufficient') return { outcome: 'insufficient' };
        if (result.kind === 'auth-required') {
            this.settings.billingAccessToken = '';
            this.settings.billingAccountLinked = false;
            await this.saveSettings();
        }
        return { outcome: 'error' };
    }
    // --- END CONSTANCE ---

    // --- NEW: API Validation Logic ---

    /**
     * Tests if a given OpenRouter API key is functional by making a simple request.
     * @param apiKey The decrypted API key to test.
     * @param model The model to use for the test (e.g., 'google/gemini-2.5-flash-lite').
     * @returns {Promise<boolean>} True if the API key works, false otherwise.
     */
    private async testOpenRouterConnection(apiKey: string, model: string): Promise<boolean> {
        if (!apiKey) {
            console.warn("Denali AI: No API key provided for connection test.");
            return false;
        }

        const requestBody = {
            model: model,
            messages: [{ "role": "user", "content": "Hello" }],
            temperature: 0.01,
            max_tokens: 10, // Keep response small
        };

        try {
            const response = await requestUrl({
                url: 'https://openrouter.ai/api/v1/chat/completions',
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody),
                // No retries or long timeouts for this initial check
            });

            if (response.status === 200 && response.json && response.json.choices && response.json.choices.length > 0) {
                // REMOVED: console.log(`Denali AI: API connection test successful with model ${model}.`);
                return true;
            } else {
                console.warn(`Denali AI: API connection test failed with status ${response.status}. Response:`, response.json);
                return false;
            }
        } catch (error: any) {
            console.error(`Denali AI: API connection test encountered an error: ${error.message}`, error);
            return false;
        }
    }

    /**
     * Performs the initial API validation using the primary key, and then backup keys if needed.
     * Updates the plugin settings with a working key if found.
     * @returns {Promise<boolean>} True if a working API key is found and set, false otherwise.
     */
    private async performInitialApiValidation(): Promise<boolean> {
        new Notice("Denali AI: Checking API connection...", 3000);
        // REMOVED: console.log("Denali AI: Starting initial API validation.");

        const validationModel = 'google/gemini-2.5-flash-lite'; // As requested

        // 1. Try the manual key from settings, else Pattern B's remote key manifest.
        const apiKey = await this.resolveApiKey();
        if (!apiKey) {
            new Notice("Denali AI: No OpenRouter API key configured and the remote key manifest could not be reached.", 5000);
            return false;
        }
        new Notice("Denali AI: Validating API key...", 2000);
        const valid = await this.testOpenRouterConnection(apiKey, validationModel);
        new Notice(valid ? "Denali AI: API key validated successfully." : "Denali AI: API key validation failed.", 4000);
        return valid;
    }
    // --- END NEW ---
}

class FileRenamer {
    app: App;
    plugin: DenaliAIFileRenamer;
    log: (message: string, isError?: boolean) => void; // This is the modal's logStatus
    cancelCheck?: () => boolean;

    private readonly MAX_RETRIES = 5;
    private readonly INITIAL_BACKOFF_DELAY_MS = 1000; // 1 second
    private readonly TIMEOUT_MS = 30000; // 30 seconds

    constructor(app: App, plugin: DenaliAIFileRenamer, logFunc?: (message: string, isError?: boolean) => void, cancelCheck?: () => boolean) {
        this.app = app;
        this.plugin = plugin;
        this.log = logFunc || this.defaultLogHandler.bind(this);
        this.cancelCheck = cancelCheck;
    }

    private async defaultLogHandler(message: string, isError: boolean = false) {
        if (!this.plugin.settings.logEnabled) {
            return;
        }

        // Only log to console if it's an error or if logFileEnabled is false (meaning no file log)
        // Otherwise, the modal's logStatus will handle the console.log if it's passed.
        // For FileRenamer, this.log is always the modal's logStatus.
        // So, this defaultLogHandler is effectively unused when called from the modal.
        // If it were used, it would log to console and conditionally show a notice.
        // The current setup passes the modal's logStatus, which already handles console.log and modal display.
        // So, this method is mostly for fallback or if FileRenamer was used outside the modal.
        console.log(`Denali AI (FileRenamer Log): ${message}`); // Keep for general debugging if not handled by modal's logStatus

        if (isError) {
            new Notice(message, 5000);
        }

        if (this.plugin.settings.logFileEnabled) {
            await this.writeLogToFile(message);
        }
    }

    private async writeLogToFile(message: string) {
        const logFolderPath = DenaliAIFileRenamer.LOGS_SUBFOLDER;
        const logFilePath = `${logFolderPath}/denali-ai-log.md`;

        try {
            // Ensure the log folder exists
            await this.app.vault.createFolder(logFolderPath).catch(() => { });

            // Check if the log file exists, if not, create it with a header
            const logFile = this.app.vault.getAbstractFileByPath(logFilePath);
            if (!logFile) {
                await this.app.vault.create(logFilePath, `# Denali AI Logs\n\n`);
            }

            const timestamp = new Date().toLocaleString();
            const logMessage = `[${timestamp}] ${message}\n`;

            await this.app.vault.adapter.append(logFilePath, logMessage);

        } catch (error) {
            console.error('Failed to write to log file:', error);
            new Notice(`Failed to write to Denali AI log file: ${error.message}`, 5000);
        }
    }

    /**
     * Handles network requests to OpenRouter with exponential backoff, retries, and timeout.
     * Surfaces friendly errors to the user.
     */
    private async makeOpenRouterRequestWithRetries(
        params: Omit<RequestUrlParam, 'headers'> & { headers?: Record<string, string> }, // Allow headers to be optional in input
        promptType: string // e.g., "filename generation", "frontmatter suggestion"
    ): Promise<RequestUrlResponse> {
        // Pattern B: manual settings key (if set) wins, else this app's own
        // remote key manifest is fetched + decrypted automatically.
        const apiKey = await this.plugin.resolveApiKey();

        if (!apiKey) {
            this.log(`OpenRouter API Key is missing and the remote key manifest could not be resolved. Please configure a key in plugin settings or check your connection.`, true);
            throw new Error('OpenRouter API Key is not configured or invalid.');
        }

        params.headers = {
            ...params.headers,
            'Authorization': `Bearer ${apiKey}`, // Use the decrypted key
            'Content-Type': 'application/json'
        };

        for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
            let delay = this.INITIAL_BACKOFF_DELAY_MS * Math.pow(2, attempt);
            if (attempt > 0) {
                // REMOVED from modal log: this.log(`Retrying OpenRouter request for ${promptType} (attempt ${attempt + 1}/${this.MAX_RETRIES}) after ${delay / 1000}s delay...`);
                console.log(`Denali AI: Retrying OpenRouter request for ${promptType} (attempt ${attempt + 1}/${this.MAX_RETRIES}) after ${delay / 1000}s delay...`); // Keep in console for debugging
                await new Promise(resolve => setTimeout(resolve, delay));
            }

            try {
                const timeoutPromise = new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('Request timed out')), this.TIMEOUT_MS)
                );

                const response = await Promise.race([
                    requestUrl(params),
                    timeoutPromise
                ]);

                // OpenRouter's API might return 200 OK even with an error in the JSON body
                if (response.status === 200 && response.json && response.json.error) {
                    const errorMessage = response.json.error.message || 'Unknown AI error';
                    this.log(`OpenRouter AI returned an error for ${promptType}: ${errorMessage}`, true);
                    throw new Error(`AI Error: ${errorMessage}`);
                }

                return response as RequestUrlResponse;
            } catch (error: any) {
                const errorMessage = error.message || 'Unknown network error';
                const status = error.status; // requestUrl error object has a status property

                if (status === 401) {
                    this.log(`OpenRouter API Key is invalid or unauthorized for ${promptType}. Please check your settings.`, true);
                    throw new Error('Invalid OpenRouter API Key. Please check your plugin settings.');
                } else if (status === 429) {
                    const retryAfter = error.headers?.['Retry-After'];
                    if (retryAfter) {
                        delay = parseInt(retryAfter, 10) * 1000;
                        this.log(`Rate limit hit for ${promptType}. Retrying after ${delay / 1000}s as per server instruction.`, true);
                    } else {
                        this.log(`Rate limit hit for ${promptType}. Retrying with exponential backoff.`, true);
                    }
                } else if (status >= 500) {
                    this.log(`OpenRouter server error (${status}) for ${promptType}: ${errorMessage}. Retrying with exponential backoff.`, true);
                } else if (status >= 400 && status < 500) {
                    this.log(`Client error (${status}) for ${promptType}: ${errorMessage}. Not retrying.`, true);
                    throw new Error(`OpenRouter API Error: ${errorMessage} (Status: ${status})`);
                } else if (errorMessage === 'Request timed out') {
                    this.log(`OpenRouter request for ${promptType} timed out after ${this.TIMEOUT_MS / 1000}s. Retrying...`, true);
                } else {
                    this.log(`Network error for ${promptType}: ${errorMessage}. Retrying...`, true);
                }

                if (attempt === this.MAX_RETRIES - 1) {
                    this.log(`OpenRouter request for ${promptType} failed after ${this.MAX_RETRIES} attempts. Last error: ${errorMessage}`, true);
                    throw new Error(`Failed to communicate with OpenRouter API for ${promptType} after multiple retries. Last error: ${errorMessage}`);
                }
            }
        }
        throw new Error('Unexpected error: makeOpenRouterRequestWithRetries completed without returning or throwing.');
    }

    /**
     * Calculates the credit cost for a single file operation.
     * @param settings The plugin settings.
     * @param isRenameOperation True if a file rename is intended.
     * @param isFrontmatterOperation True if frontmatter changes are intended.
     * @returns The total credit cost.
     */
    calculateCreditCost(settings: DenaliSettings, isRenameOperation: boolean, isFrontmatterOperation: boolean): number {
        let cost = 0;
        if (isRenameOperation) {
            cost += 1; // 1 credit for file rename
        }
        if (isFrontmatterOperation) {
            // Count each enabled frontmatter property that would be added/modified
            if (settings.addTitle) cost += 1;
            if (settings.addCreatedDate) cost += 1;
            if (settings.addModifiedDate) cost += 1;
            if (settings.addAuthor) cost += 1;
            if (settings.addStatus) cost += 1;
            if (settings.addProject) cost += 1;
            if (settings.addTopic) cost += 1;
            // AddAlias is a frontmatter change, but it's a special case that adds the old name.
            // For simplicity, we'll count it as 1 credit if enabled.
            if (settings.addAlias) cost += 1;
            // AI-generated tags are also frontmatter changes
            // We'll count this as 1 credit if tags are requested from AI and useFrontmatter is true
            // This is a bit tricky to pre-calculate perfectly, so we'll assume 1 credit if useFrontmatter is true and tags are requested.
            // A more precise way would be to count actual tags added, but that's post-AI.
            // For now, let's count it as 1 if useFrontmatter is true and any of the AI-driven frontmatter fields are true.
            // Or, simply count it as 1 if useFrontmatter is true and AI is called for suggestions.
            // Let's simplify: if useFrontmatter is true, and AI is called, count 1 credit for "general frontmatter enrichment".
            // The prompt says "each frontmatter change will take 1 credit".
            // Let's count each *enabled* frontmatter setting as 1 credit.
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
    async deductCredits(cost: number): Promise<boolean> {
        if (this.plugin.settings.paymentType !== 'one-time') {
            return true; // For subscription model, always return true
        }

        const settings = this.plugin.settings;
        if (!settings.billingAccessToken || !settings.billingAccountLinked) {
            new Notice('Denali AI: sign in or create a billing account in Settings before using AI features.', 6000);
            return false;
        }

        const freeEventId = `denali-free-${settings.constanceDeviceId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        const freeResult = await claimAccountFreeUsage(settings, CONSTANCE_APP_ID, settings.constanceDeviceId, freeEventId, cost);
        if (freeResult.kind === 'ok') {
            settings.availableCredits = freeResult.remaining;
            await this.plugin.saveSettings();
            new Notice(`Used ${cost} credits. Free credits remaining: ${freeResult.remaining}`, 2500);
            return true;
        }
        if (freeResult.kind === 'auth-required') {
            settings.billingAccessToken = '';
            settings.billingAccountLinked = false;
            await this.plugin.saveSettings();
            new Notice('Denali AI: your billing session expired. Sign in again in Settings.', 6000);
            return false;
        }
        if (freeResult.kind === 'error') {
            new Notice('Denali AI: the account allowance could not be verified. Try again when Constance is reachable.', 6000);
            return false;
        }

        const remainder = cost;

        await this.plugin.retryPendingSpendEvents();
        if (this.plugin.settings.pendingSpendEvents.length > 0) {
            new Notice('Denali AI: a previous credit spend is still being reconciled. Try again when the connection is restored.', 5000);
            return false;
        }
        const stableEventId = `denali-spend-${this.plugin.settings.constanceDeviceId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        this.plugin.settings.pendingSpendEvents.push({ eventId: stableEventId, amount: remainder });
        await this.plugin.saveSettings();
        const spendResult = await this.plugin.spendConstanceCredits(remainder, stableEventId);

        if (spendResult.outcome === 'insufficient') {
            this.plugin.settings.pendingSpendEvents = this.plugin.settings.pendingSpendEvents.filter(item => item.eventId !== stableEventId);
            await this.plugin.saveSettings();
            this.log(`Not enough purchased credits to cover ${remainder}.`, true);
            new Notice(`Not enough credits! Required: ${cost}. Buy more credits in Settings.`, 7000);
            return false;
        }

        if (spendResult.outcome === 'success' && typeof spendResult.newPurchasedBalance === 'number') {
            settings.purchasedCredits = spendResult.newPurchasedBalance;
            this.plugin.settings.pendingSpendEvents = this.plugin.settings.pendingSpendEvents.filter(item => item.eventId !== stableEventId);
        } else {
            new Notice('Denali AI: the credit spend could not be verified. Try again when Constance is reachable.', 6000);
            return false;
        }
        await this.plugin.saveSettings();
        const remaining = settings.availableCredits + settings.purchasedCredits;
        this.log(`Deducted ${cost} purchased credits. Remaining: **${remaining}**`);
        new Notice(`Used ${cost} credits. Remaining: ${remaining}`, 2000);
        return true;
    }

    /** Apply one approved rename, frontmatter update, and optional folder move. */
    async processRename(file: TFile, suggestedName?: string, initialAiSuggestions?: {
        filename: string | null;
        title: string | null;
        author: string | null;
        project: string | null;
        topic: string | null;
        tags: string[];
        folder: string | null;
    } | null): Promise<boolean> { // Added '| null' here
        this.log(`--- Starting rename process for **${file.name}** ---`);
        const oldName = file.name;
        const {
            backupEnabled, useFrontmatter,
            maxInputLength, aiNameStyle, maxOutputLength,
            fileNameCase, addAlias, stopWords, characterReplacement, autoSubfolder, renameTimestampFormat,
            addTitle, addAuthor, addProject, addTopic,
            paymentType
        } = this.plugin.settings;

        const isRenameOperation = true; // A rename is always intended here
        const isFrontmatterOperation = useFrontmatter && (addTitle || addAuthor || addProject || addTopic || addAlias || this.plugin.settings.addCreatedDate || this.plugin.settings.addModifiedDate || this.plugin.settings.addStatus);
        const cost = this.calculateCreditCost(this.plugin.settings, isRenameOperation, isFrontmatterOperation);

        let originalContent = '';
        let frontmatterChanged = false;
        try {
            let newName: string | null = null;
            let titleSuggestion: string | null = null; // This will be null if addTitle is true, as we derive it from filename
            let authorSuggestion: string | null = null;
            let projectSuggestion: string | null = null;
            let topicSuggestion: string | null = null;
            let tags: string[] = [];
            let folderSuggestion: string | null = null;

            this.log(`Reading file content for AI analysis...`);
            let fileContent = await this.app.vault.read(file);
            originalContent = fileContent;
            let textToSend = fileContent;
            // REMOVED: this.log(`File content read. Length: **${fileContent.length}** characters.`);

            if (useFrontmatter) {
                const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
                if (frontmatter) {
                    // REMOVED: this.log(`Including existing frontmatter in content sent to AI.`);
                    textToSend = `---\n${Object.keys(frontmatter).map(key => `${key}: ${frontmatter[key]}`).join('\n')}\n---\n${fileContent}`;
                } else {
                    // REMOVED: this.log(`No existing frontmatter found.`);
                }
            }

            if (textToSend.length > maxInputLength) {
                this.log(`Truncating file content from **${textToSend.length}** to **${maxInputLength}** characters (plan limit).`);
                textToSend = textToSend.substring(0, maxInputLength);
            }

            // REMOVED: const contentSnippetStart = textToSend.substring(0, Math.min(textToSend.length, 50));
            // REMOVED: const contentSnippetEnd = textToSend.substring(Math.max(0, textToSend.length - 50));
            // REMOVED: this.log(`Preparing API request with content snippet: "**${contentSnippetStart}**...**${contentSnippetEnd}**"`);
            this.log(`Preparing AI request...`);


            // Determine if we need to call the AI for suggestions
            // If suggestedName is provided AND initialAiSuggestions are provided, it means we are in interactive mode
            // and the user has already seen/edited the filename. We use the provided suggestedName for the filename,
            // and the initialAiSuggestions for frontmatter.
            // Otherwise, we make a combined AI call to get all suggestions.
            if (suggestedName && initialAiSuggestions) {
                newName = suggestedName;
                // If addTitle is true, titleSuggestion will be null from initialAiSuggestions,
                // and we will derive it from newName in updateFrontmatter.
                titleSuggestion = initialAiSuggestions.title;
                authorSuggestion = initialAiSuggestions.author;
                projectSuggestion = initialAiSuggestions.project;
                topicSuggestion = initialAiSuggestions.topic;
                tags = initialAiSuggestions.tags;
                folderSuggestion = initialAiSuggestions.folder;
                this.log(`Using user-suggested name: **${newName}** and pre-generated AI frontmatter suggestions.`);
            } else {
                // This is the "first time" AI call for this file (automatic mode or initial interactive suggestion)
                const aiCombinedSuggestions = await this.getCombinedAiSuggestions(textToSend);
                newName = aiCombinedSuggestions.filename;
                // If addTitle is true, aiCombinedSuggestions.title will be null, as we don't ask the AI for it.
                titleSuggestion = aiCombinedSuggestions.title;
                authorSuggestion = aiCombinedSuggestions.author;
                projectSuggestion = aiCombinedSuggestions.project;
                topicSuggestion = aiCombinedSuggestions.topic;
                tags = aiCombinedSuggestions.tags;
                folderSuggestion = aiCombinedSuggestions.folder;

                if (suggestedName) { // If suggestedName was passed, it means it's an override for the filename
                    newName = suggestedName;
                    this.log(`Overriding AI-generated filename with user-suggested name: **${newName}**`);
                }
            }

            if (newName) {
                newName = newName
                    .replace(/[\\/:*?"<>|]/g, ' ')
                    .replace(/\s+/g, ' ')
                    .replace(/^\.+|\.+$/g, '')
                    .trim();
                if (!newName) {
                    throw new Error('The suggested filename was empty after removing invalid characters.');
                }

                let newFolderPath = file.parent ? file.parent.path : '';
                if (autoSubfolder && folderSuggestion) {
                    newFolderPath = folderSuggestion;
                    this.log(`Moving file to suggested subfolder: **${newFolderPath}**`);
                }

                // ONLY apply stop words and character replacement if not using the original case style
                if (fileNameCase !== 'original') {
                    this.log(`Applying stop words and character replacement to AI-generated name.`);
                    const stopWordList = stopWords.split(',').map(w => w.trim().toLowerCase());
                    newName = newName.split(/\s+/).filter(word => !stopWordList.includes(word.toLowerCase())).join(' ');

                    if (characterReplacement) {
                        newName = newName.replace(/\s/g, characterReplacement);
                    }
                } else {
                    // REMOVED: this.log(`Using AI-generated name in its original case style.`);
                }

                const parentPath = newFolderPath ? newFolderPath + '/' : '';
                let finalName = this.applyCaseStyle(newName);

                // Apply timestamp format to the new filename
                const timestamp = file.stat.mtime;
                const date = new Date(timestamp);
                const formattedTimestamp = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}-${date.getMinutes().toString().padStart(2, '0')}-${date.getSeconds().toString().padStart(2, '0')}`;

                if (renameTimestampFormat === 'prefix') {
                    finalName = `${formattedTimestamp} ${finalName}`;
                    this.log(`Adding timestamp prefix to filename.`);
                } else if (renameTimestampFormat === 'suffix') {
                    finalName = `${finalName} ${formattedTimestamp}`;
                    this.log(`Adding timestamp suffix to filename.`);
                }

                let newPath = parentPath + finalName + '.md';
                let suffix = 1;

                let existingFile = this.app.vault.getAbstractFileByPath(newPath);
                while (existingFile && existingFile !== file) {
                    this.log(`File with name "**${finalName}.md**" already exists. Renaming to "**${finalName}-${suffix}.md**"`, true);
                    finalName = `${finalName}-${suffix}`;
                    newPath = parentPath + finalName + '.md';
                    suffix++;
                    existingFile = this.app.vault.getAbstractFileByPath(newPath);
                }

                // Charge only after AI work and target-path validation succeed.
                if (paymentType === 'one-time' && !(await this.deductCredits(cost))) {
                    this.log(`Operation aborted due to insufficient credits.`, true);
                    return false;
                }
                if (backupEnabled) {
                    await this.createBackup(file);
                }

                // Update frontmatter before the rename, but restore the exact original content if the rename fails.
                await this.updateFrontmatter(file, oldName, textToSend, newName, tags, newFolderPath, titleSuggestion, authorSuggestion, projectSuggestion, topicSuggestion);
                frontmatterChanged = true;
                await this.app.vault.rename(file, newPath);
                this.log(`File renamed from "**${oldName}**" to "**${finalName}.md**"`, false);
                new Notice(`File renamed from "${oldName}" to "${finalName}.md"`);
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
                    console.error('Denali AI Frontmatter Rollback Error:', rollbackError);
                    this.log(`Rename failed and the original note could not be restored automatically.`, true);
                }
            }
            this.log(`Error: Failed to rename file **${oldName}**. Details: ${error.message}`, true);
            console.error('Denali AI Rename Error:', error);
            return false;
        }
        this.log(`--- Rename process for **${oldName}** completed ---`);
        return false;
    }

    // Removed processBatchRename from FileRenamer. It now resides only in DenaliAIOptionsModal.

    applyCaseStyle(name: string): string {
        switch (this.plugin.settings.fileNameCase) {
            case 'kebab':
                return name.toLowerCase().replace(/\s/g, '-').replace(/--+/g, '-');
            case 'camel':
                return name.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
                    return index === 0 ? word.toLowerCase() : word.toUpperCase();
                }).replace(/\s+/g, '');
            case 'lowercase':
                return name.toLowerCase().replace(/\s/g, '');
            case 'original':
            default:
                return name;
        }
    }

    async createBackup(file: TFile) {
        this.log(`Creating backup of original file...`);
        const backupFolderPath = DenaliAIFileRenamer.BACKUP_SUBFOLDER;
        await this.app.vault.createFolder(backupFolderPath).catch(() => {
            this.log(`Backup folder already exists or could not be created.`, false);
        });

        const timestamp = new Date().getTime(); // Use current time for backup to prevent conflicts
        const date = new Date(timestamp);
        const formattedDate = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
        const formattedTime = `${date.getHours().toString().padStart(2, '0')}-${date.getMinutes().toString().padStart(2, '0')}-${date.getSeconds().toString().padStart(2, '0')}`;

        const nameWithoutExt = file.basename;
        const timestampString = this.plugin.settings.timestampFormat === 'suffix' ? `-${formattedDate}-${formattedTime}` : '';

        let backupFileName = `${nameWithoutExt}${timestampString}.${file.extension}`;

        const backupPath = `${backupFolderPath}/${backupFileName}`;
        await this.app.vault.copy(file, backupPath);
        this.log(`Backed up file to **${backupPath}**`);
    }

    getMarkdownFiles(folder: TFolder): TFile[] {
        let files: TFile[] = [];
        const untitledKeywords = this.plugin.settings.untitledKeywords.split(',').map(k => k.trim().toLowerCase());

        for (const item of folder.children) {
            if (item instanceof TFile && item.extension === 'md') {
                const isUntitled = this.plugin.settings.lookForUntitled && untitledKeywords.some(keyword => item.name.toLowerCase().startsWith(keyword));
                if (isUntitled || !this.plugin.settings.lookForUntitled) {
                    files.push(item);
                }
            } else if (item instanceof TFolder) {
                files = files.concat(this.getMarkdownFiles(item));
            }
        }
        return files;
    }

    /** Produce all note-organization suggestions in one provider request. */
    async getCombinedAiSuggestions(content: string): Promise<{
        filename: string | null;
        title: string | null; // This will be null if addTitle is true
        author: string | null;
        project: string | null;
        topic: string | null;
        tags: string[];
        folder: string | null;
    }> {
        const {
            aiModel, maxInputLength, maxOutputLength,
            aiNameStyle, addTitle, titlePrompt, addAuthor, authorPrompt,
            addProject, projectPrompt, addTopic, topicPrompt, autoSubfolder, useFrontmatter // Added useFrontmatter here
        } = this.plugin.settings;

        const textToSend = content.length > maxInputLength ? content.substring(0, maxInputLength) : content;

        let systemPromptParts: string[] = [
            "You are an AI assistant that generates file names and frontmatter properties based on text content. Respond ONLY with a JSON object. If a property is not requested (e.g., if 'addTitle' is false), do not include it in the JSON. Ensure all string values are properly escaped for JSON. Do not include any other text outside the JSON object."
        ];

        // Filename instruction
        let filenamePromptToUse = this.plugin.settings.customPrompt;
        if (filenamePromptToUse === PROMPT_STYLES.balanced ||
            filenamePromptToUse === PROMPT_STYLES.keywordFilled ||
            filenamePromptToUse === PROMPT_STYLES.nicheWordsOnly) {
            // If customPrompt is one of the defaults, use the selected aiNameStyle
            filenamePromptToUse = PROMPT_STYLES[aiNameStyle];
        }
        filenamePromptToUse = filenamePromptToUse
            .replace('{max_output_length}', maxOutputLength.toString())
            .replace('{max_input_length}', maxInputLength.toString());

        systemPromptParts.push(`- Generate a filename based on the following instruction: "${filenamePromptToUse}". Store this in the 'filename' key.`);

        // Frontmatter instructions
        // MODIFICATION START: Do not ask AI for title if addTitle is true, as we derive it from filename.
        if (addTitle) {
            // We are intentionally NOT asking the AI for a 'title' here.
            // The 'title' will be derived from the 'filename' in updateFrontmatter.
            // REMOVED: this.log(`'Add Title' is enabled, so AI will NOT be prompted for a separate title. It will be derived from the filename.`);
        }
        // MODIFICATION END

        if (addAuthor) {
            systemPromptParts.push(`- Generate an author name based on the following instruction: "${authorPrompt}". Store this in the 'author' key.`);
        }
        if (addProject) {
            systemPromptParts.push(`- Generate a project name based on the following instruction: "${projectPrompt}". Store this in the 'project' key.`);
        }
        if (addTopic) {
            systemPromptParts.push(`- Generate a single, broad topic or category based on the following instruction: "${topicPrompt}". Store this in the 'topic' key.`);
        }

        // --- REVISED TAGS AND FOLDER PROMPT LOGIC ---
        // Request tags if frontmatter is generally enabled OR if topic is specifically requested
        const shouldRequestTags = useFrontmatter || addTopic; 
        // Request folder only if autoSubfolder is enabled
        const shouldRequestFolder = autoSubfolder; 

        if (shouldRequestTags) {
            systemPromptParts.push(`- Extract up to 5 relevant keywords/tags. Store these in a 'tags' array (e.g., ["tag1", "tag2"]).`);
        }
        if (shouldRequestFolder) {
            systemPromptParts.push(`- Suggest a single subfolder path. Store this in a 'folder' key (e.g., "Ideas/AI-Notes").`);
        }
        // --- END REVISED LOGIC ---

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

        const systemPrompt = systemPromptParts.join('\n');

        const requestBody = {
            model: aiModel,
            messages: [
                { "role": "system", "content": systemPrompt },
                { "role": "user", "content": textToSend }
            ],
            temperature: 0.01,
            response_format: { type: "json_object" } // Explicitly request JSON
        };

        try {
            // REMOVED: this.log(`AI Combined Suggestions API Call: Sending request to OpenRouter.`);
            this.log(`Requesting AI suggestions...`);
            const response = await this.makeOpenRouterRequestWithRetries(
                { url: 'https://openrouter.ai/api/v1/chat/completions', method: 'POST', body: JSON.stringify(requestBody) },
                'combined filename and frontmatter suggestions'
            );

            const responseData = response.json;
            if (!responseData || !responseData.choices || responseData.choices.length === 0) {
                this.log(`AI Combined Suggestions API Call: Invalid response received.`, true);
                throw new Error('Invalid API response format.');
            }

            const resultString = responseData.choices[0].message.content.trim();
            // REMOVED: this.log(`AI Combined Suggestions API Call: Raw AI response received: "${resultString.substring(0, Math.min(resultString.length, 200))}..."`);
            console.log(`Denali AI: Raw AI response received: "${resultString.substring(0, Math.min(resultString.length, 200))}..."`); // Keep in console for debugging

            let parsedResult: any;
            try {
                parsedResult = JSON.parse(resultString);
            } catch (jsonError) {
                this.log(`AI Combined Suggestions API Call: Failed to parse JSON from AI response. Raw response: "${resultString}"`, true);
                console.error('JSON Parse Error:', jsonError);
                return { filename: null, title: null, author: null, project: null, topic: null, tags: [], folder: null };
            }

            let filename = typeof parsedResult.filename === 'string' ? parsedResult.filename.trim() : null;
            // MODIFICATION START: title will be null from AI if addTitle is true, as we didn't ask for it.
            let title = typeof parsedResult.title === 'string' ? parsedResult.title.trim() : null;
            // MODIFICATION END
            let author = typeof parsedResult.author === 'string' ? parsedResult.author.trim() : null;
            let project = typeof parsedResult.project === 'string' ? parsedResult.project.trim() : null;
            let topic = typeof parsedResult.topic === 'string' ? parsedResult.topic.trim() : null;
            let tags = Array.isArray(parsedResult.tags) ? parsedResult.tags.map((t: string) => this.sanitizeTag(t)) : [];
            let folder = typeof parsedResult.folder === 'string' ? parsedResult.folder.trim() : null;

            // Sanitize filename
            if (filename) {
                if (filename.length > maxOutputLength) {
                    filename = filename.substring(0, maxOutputLength);
                    this.log(`AI Combined Suggestions API Call: Truncated AI's filename response to **${maxOutputLength}** characters (plan limit).`);
                }
                filename = filename
                    .replace(/[\\/:*?"<>|]/g, ' ') // Remove characters invalid for filenames
                    .replace(/\s+/g, '-')
                    .replace(/^-+|-+$/g, '');
            }

            this.log(`AI suggested filename: **${filename}**`);
            // MODIFICATION START: Log title only if it was actually suggested by AI (i.e., addTitle was false)
            if (addTitle) {
                // REMOVED: this.log(`'Add Title' is enabled. Title will be derived from filename in frontmatter update.`);
            } else if (title) { // Only log if addTitle is false AND AI provided a title (shouldn't happen with current logic)
                // REMOVED: this.log(`AI suggested title: **${title}**`);
            }
            // MODIFICATION END
            if (addAuthor) this.log(`AI suggested author: **${author}**`);
            if (addProject) this.log(`AI suggested project: **${project}**`);
            if (addTopic) this.log(`AI suggested topic: **${topic}**`);
            if (shouldRequestTags) { // Log tags if they were requested
                this.log(`AI suggested tags: **${tags.join(', ')}**`);
            }
            if (shouldRequestFolder) { // Log folder if it was requested
                this.log(`AI suggested folder: **${folder}**`);
            }

            return { filename, title, author, project, topic, tags, folder };

        } catch (error) {
            this.log(`OpenRouter API request for combined suggestions failed: ${error.message}`, true);
            console.error('OpenRouter API request failed:', error);
            return { filename: null, title: null, author: null, project: null, topic: null, tags: [], folder: null };
        }
    }

    private sanitizeTag(tag: string): string {
        // Replace spaces with hyphens
        let sanitizedTag = tag.replace(/\s+/g, '-');
        // Replace all special characters with hyphens, except for letters, numbers, and hyphens/underscores
        sanitizedTag = sanitizedTag.replace(/[^\w-]/g, '-');
        // Remove leading and trailing hyphens/underscores
        sanitizedTag = sanitizedTag.replace(/^[_-]+|[_-]+$/g, '');
        // Replace multiple consecutive hyphens/underscores with a single hyphen
        sanitizedTag = sanitizedTag.replace(/[-_]+/g, '-');
        return sanitizedTag;
    }

    /** Update only the frontmatter fields enabled in settings, preserving user data. */
    async updateFrontmatter(file: TFile, oldName: string, content: string, newName: string, aiTags: string[], newFolderPath: string, titleSuggestion: string | null, authorSuggestion: string | null, projectSuggestion: string | null, topicSuggestion: string | null) {
        this.log(`Starting frontmatter update...`);
        await this.app.fileManager.processFrontMatter(file, async (frontmatter) => {
            const {
                addAlias, addTitle, addCreatedDate, createdDateFormat,
                addModifiedDate, modifiedDateFormat, addAuthor,
                addStatus, statusDefaultValue, addProject,
                addTopic
            } = this.plugin.settings;

            // REMOVED: this.log(`Checking 'Add Alias' setting...`);
            if (addAlias) {
                if (!frontmatter.aliases) frontmatter.aliases = [];
                if (typeof frontmatter.aliases === 'string') frontmatter.aliases = [frontmatter.aliases];
                if (!Array.isArray(frontmatter.aliases)) frontmatter.aliases = [];
                if (!frontmatter.aliases.includes(oldName)) {
                    frontmatter.aliases.push(oldName);
                    this.log(`Added old filename '${oldName}' as an alias.`);
                } else {
                    this.log(`Old filename '${oldName}' is already an alias. Skipping.`);
                }
            }

            // REMOVED: this.log(`Checking for AI-generated tags...`);
            if (aiTags && aiTags.length > 0) {
                // Ensure frontmatter.tags is an array before pushing to it
                if (!frontmatter.tags) {
                    frontmatter.tags = [];
                } else if (typeof frontmatter.tags === 'string') {
                    frontmatter.tags = [frontmatter.tags];
                } else if (!Array.isArray(frontmatter.tags)) {
                    // If it exists but is neither string nor array, reset it to an empty array
                    this.log(`Warning: 'tags' property in frontmatter was not an array or string. Resetting to empty array.`, true);
                    frontmatter.tags = [];
                }

                aiTags.forEach(tag => {
                    if (!frontmatter.tags.includes(tag)) {
                        frontmatter.tags.push(tag);
                    }
                });
                this.log(`Added AI-generated tags: **${aiTags.join(', ')}**`);
            } else {
                this.log(`No AI-generated tags to add.`);
            }

            // REMOVED: this.log(`Checking 'Add Title' setting...`);
            if (addTitle) {
                // MODIFICATION START: Derive title from newName (AI-generated filename)
                const derivedTitle = newName
                    .replace(/[-_]/g, ' ') // Replace hyphens/underscores with spaces
                    .replace(/\b\w/g, char => char.toUpperCase()); // Capitalize first letter of each word (simple title case)

                frontmatter.title = derivedTitle;
                this.log(`Set 'title' property to derived from filename: **${derivedTitle}**`);
                // MODIFICATION END
            } else {
                this.log(`'Add Title' is disabled. Skipping.`);
            }

            // REMOVED: this.log(`Checking 'Add Created Date' setting...`);
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

            // REMOVED: this.log(`Checking 'Add Modified Date' setting...`);
            if (addModifiedDate) {
                const mtime = file.stat.mtime;
                frontmatter.modified = formatDate(new Date(mtime), modifiedDateFormat);
                this.log(`Set 'modified' property to: **${frontmatter.modified}**`);
            } else {
                this.log(`'Add Modified Date' is disabled. Skipping.`);
            }

            // REMOVED: this.log(`Checking 'Add Author' setting...`);
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

            // REMOVED: this.log(`Checking 'Add Status' setting...`);
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

            // REMOVED: this.log(`Checking 'Add Project' setting...`);
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

            // REMOVED: this.log(`Checking 'Add Topic' setting...`);
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
        this.log('Frontmatter update completed.');
    }
}

class DenaliAIOptionsModal extends Modal {
    plugin: DenaliAIFileRenamer;
    file: TFile | TFolder | null;
    statusContainer: HTMLElement;
    progressBar: HTMLElement;
    filesToProcess: TFile[] = [];
    processedCount: number = 0;
    isCancelled: boolean = false;
    cancelButton: HTMLButtonElement;
    fileRenamer: FileRenamer; // Instance of FileRenamer for single file operations

    private suggestedName: string = '';
    private nameInput: HTMLInputElement;
    private editContainer: HTMLElement;
    private initialRenameDone: boolean = false;
    private initialAiSuggestions: {
        filename: string | null;
        title: string | null;
        author: string | null;
        project: string | null;
        topic: string | null;
        tags: string[];
        folder: string | null;
    } | null = null; // Store combined AI suggestions

    constructor(app: App, plugin: DenaliAIFileRenamer, file: TFile | TFolder | null) {
        super(app);
        this.plugin = plugin;
        // Pass this modal's logStatus and cancelCheck to the FileRenamer instance
        this.fileRenamer = new FileRenamer(this.app, this.plugin, this.logStatus.bind(this), () => this.isCancelled);
        this.file = file;
    }

    onOpen() {
        const { contentEl, modalEl } = this;
        contentEl.empty();

        this.contentEl.createEl('h2', { text: 'Denali AI File Renamer' });
        this.statusContainer = this.contentEl.createEl('div', { cls: 'denali-status-container' });

        if (!this.file) {
            this.logStatus('No file or folder selected. Please select a file or folder to rename.', true);
            setTimeout(() => this.close(), this.plugin.settings.modalCloseDelay * 1000);
            return;
        }

        const encryptedKey = this.plugin.settings.openRouterApiKey;
        // Display only a short suffix so the full key is not shown in settings.
        const keyDisplay = encryptedKey ? `Configured (ends with ...${encryptedKey.substring(encryptedKey.length - 4)})` : 'Not set; managed connection will be tried';
        this.logStatus(`Manual API Key: **${keyDisplay}**`);
        this.logStatus(`Current Plan: **${this.plugin.settings.userPlan.toUpperCase()}**`);

        if (this.plugin.settings.paymentType === 'one-time') {
            this.logStatus(`Available Credits: **${this.plugin.settings.availableCredits + this.plugin.settings.purchasedCredits}** (${this.plugin.settings.availableCredits} free + ${this.plugin.settings.purchasedCredits} purchased)`);
            this.logStatus(`Max Input Length: **${this.plugin.settings.maxInputLength}** chars`);
            this.logStatus(`Max Output Length: **${this.plugin.settings.maxOutputLength}** chars`);
        } else { // subscription
            this.logStatus(`Max Input Length: **${this.plugin.settings.maxInputLength}** chars`);
            this.logStatus(`Max Output Length: **${this.plugin.settings.maxOutputLength}** chars`);
            this.logStatus(`Batch Rename Limit: **${this.plugin.settings.batchRenameLimit}** files`);
            this.logStatus(`Daily File Limit: **${this.plugin.settings.dailyFileLimit}** files`);
            this.logStatus(`Monthly File Limit: **${this.plugin.settings.maxFilesPerMonth}** files`);
        }


        if (this.plugin.settings.renameChoice === 'interactive') {
            if (this.file instanceof TFile) {
                const untitledKeywords = this.plugin.settings.untitledKeywords.split(',').map(k => k.trim().toLowerCase());
                const isUntitled = untitledKeywords.some(keyword => this.file!.name.toLowerCase().startsWith(keyword));
                if (this.plugin.settings.lookForUntitled && !isUntitled) {
                    this.logStatus(`File "${this.file.name}" is not an "untitled" file, so it will not be renamed.`, true);
                    setTimeout(() => this.close(), this.plugin.settings.modalCloseDelay * 1000);
                    return;
                }
                // --- SAAS: Daily/Monthly Limit Check (Placeholder) ---
                // if (this.hasExceededDailyLimit() || this.hasExceededMonthlyLimit()) {
                //     this.logStatus(`Daily or monthly file processing limit exceeded for your plan. Cannot rename file.`, true);
                //     setTimeout(() => this.close(), this.plugin.settings.modalCloseDelay * 1000);
                //     return;
                // }
                // --- END SAAS ---
                this.logStatus(`Starting interactive rename process for file: **${this.file.name}**`);
                this.showInteractiveModal(this.file);
            } else if (this.file instanceof TFolder) {
                this.logStatus(`Starting interactive batch rename for folder: **${this.file.path}**`);
                this.processBatchRename(this.file);
            } else {
                this.logStatus('No file or folder selected. Please select a file or folder to rename.');
            }
        } else { // Automatic Mode
            if (this.file instanceof TFile) {
                const untitledKeywords = this.plugin.settings.untitledKeywords.split(',').map(k => k.trim().toLowerCase());
                const isUntitled = untitledKeywords.some(keyword => this.file!.name.toLowerCase().startsWith(keyword));
                if (this.plugin.settings.lookForUntitled && !isUntitled) {
                    this.logStatus(`File "${this.file.name}" is not an "untitled" file, so it will not be renamed.`, true);
                    setTimeout(() => this.close(), this.plugin.settings.modalCloseDelay * 1000);
                    return;
                }
                // --- SAAS: Daily/Monthly Limit Check (Placeholder) ---
                // if (this.hasExceededDailyLimit() || this.hasExceededMonthlyLimit()) {
                //     this.logStatus(`Daily or monthly file processing limit exceeded for your plan. Cannot rename file.`, true);
                //     setTimeout(() => this.close(), this.plugin.settings.modalCloseDelay * 1000);
                //     return;
                // }
                // --- END SAAS ---
                this.logStatus(`Starting automatic rename process for file: **${this.file.name}**`);
                this.processAutomaticRename(this.file);
            } else if (this.file instanceof TFolder) {
                this.logStatus(`Starting automatic batch rename for folder: **${this.file.path}**`);
                this.processBatchRename(this.file);
            }
        }

        if (this.file instanceof TFolder || this.plugin.settings.renameChoice === 'automatic') {
            if (this.file instanceof TFolder) {
                this.progressBar = this.contentEl.createEl('div', { cls: 'denali-progress-bar-container' });
                this.progressBar.createEl('div', { cls: 'denali-progress-bar' });
            }
            this.cancelButton = modalEl.createEl('button', { text: 'Cancel', cls: 'mod-warning' });
            this.cancelButton.onclick = () => {
                this.isCancelled = true;
                this.logStatus('Rename cancelled by user.');
            };
        }
    }

    async showInteractiveModal(file: TFile) {
        this.logStatus('Generating name and frontmatter suggestions...');
        try {
            const fileContent = await this.app.vault.read(file);
            // Call the combined AI function to get all initial suggestions
            const aiSuggestions = await this.fileRenamer.getCombinedAiSuggestions(fileContent);

            this.suggestedName = aiSuggestions.filename || file.basename; // Use AI filename or original basename
            // Store all AI suggestions for later use in processRename
            this.initialAiSuggestions = aiSuggestions;

            this.editContainer = this.contentEl.createEl('div', { cls: 'denali-edit-container' });
            this.editContainer.createEl('label', { text: 'Suggested Filename:', cls: 'denali-label' });
            this.nameInput = this.editContainer.createEl('input', { type: 'text', cls: 'denali-input' });
            this.nameInput.value = this.suggestedName;

            const buttonContainer = this.editContainer.createEl('div', { cls: 'denali-button-container' });
            const acceptButton = buttonContainer.createEl('button', { text: 'Rename', cls: 'mod-cta' });
            const cancelButton = buttonContainer.createEl('button', { text: 'Cancel', cls: 'mod-warning' });

            acceptButton.onclick = async () => {
                if (this.initialRenameDone) return;
                this.initialRenameDone = true;
                this.editContainer.style.display = 'none'; // Hide the input and buttons
                this.logStatus(`User accepted new name: **${this.nameInput.value}**`);
                this.logStatus('Starting rename...');
                // Pass the user-edited name AND the initial AI suggestions for frontmatter
                await this.fileRenamer.processRename(file, this.nameInput.value, this.initialAiSuggestions);
                this.close();
            };

            cancelButton.onclick = () => {
                this.logStatus('User cancelled rename process.');
                this.close();
            };
        } catch (error) {
            this.logStatus(`Failed to generate name suggestion: ${error.message}`, true);
            setTimeout(() => this.close(), this.plugin.settings.modalCloseDelay * 1000);
        }
    }

    async processAutomaticRename(file: TFile) {
        await this.fileRenamer.processRename(file);
        this.logStatus('Automatic rename process completed.', false);
        setTimeout(() => this.close(), this.plugin.settings.modalCloseDelay * 1000);
    }

    logStatus(message: string, isError: boolean = false) {
        if (!this.plugin.settings.logEnabled) {
            return;
        }
        const timestamp = new Date().toLocaleTimeString();
        const logLine = this.statusContainer.createEl('div', { cls: 'denali-log-line' });
        logLine.createSpan({ text: `[${timestamp}] `, cls: 'denali-log-timestamp' });

        const messageSpan = logLine.createSpan({ cls: isError ? 'denali-log-error' : 'denali-log-message' });
        messageSpan.innerHTML = message;

        this.statusContainer.scrollTop = this.statusContainer.scrollHeight;
        console.log(`Denali AI (Modal Log): ${message}`); // Always log to console for debugging
    }

    /** Process the Markdown files in a folder with progress and the configured batch limit. */
    async processBatchRename(folder: TFolder) {
        this.filesToProcess = this.fileRenamer.getMarkdownFiles(folder); // Use FileRenamer's utility method
        this.processedCount = 0;

        // --- SAAS: Batch Limit Check (Subscription) ---
        if (this.plugin.settings.paymentType === 'subscription') {
            const batchLimit = this.plugin.settings.batchRenameLimit;
            if (this.filesToProcess.length > batchLimit) {
                this.logStatus(`Batch rename limited to ${batchLimit} files for your current plan (${this.plugin.settings.userPlan.toUpperCase()}). Found ${this.filesToProcess.length} files. Processing first ${batchLimit}.`, true);
                this.filesToProcess = this.filesToProcess.slice(0, batchLimit); // Truncate the list
            }
        }
        // --- END SAAS ---

        if (this.filesToProcess.length === 0) {
            this.logStatus('No markdown files found in the selected folder.', true);
            if (this.progressBar) {
                this.progressBar.style.display = 'none';
            }
            setTimeout(() => this.close(), this.plugin.settings.modalCloseDelay * 1000);
            return;
        }

        this.logStatus(`Starting batch rename for ${this.filesToProcess.length} files...`);

        for (const file of this.filesToProcess) {
            if (this.isCancelled) {
                this.logStatus(`Batch rename cancelled by user.`);
                break;
            }
            
            // processRename owns credit deduction so single-file and batch operations are charged once.
            const renamed = await this.fileRenamer.processRename(file);
            if (renamed) {
                this.processedCount++;
                this.updateProgressBar();
            }
        }

        this.logStatus('Batch rename process completed.', false);
        if (this.progressBar) {
            this.progressBar.style.display = 'none';
        }
        if (this.cancelButton) {
            this.cancelButton.remove();
        }
        setTimeout(() => this.close(), this.plugin.settings.modalCloseDelay * 1000);
    }

    updateProgressBar() {
        const progress = this.filesToProcess.length > 0 ? (this.processedCount / this.filesToProcess.length) * 100 : 0;
        if (this.progressBar) {
            const progressBar = this.progressBar.querySelector('.denali-progress-bar') as HTMLElement;
            progressBar.style.width = `${progress}%`;
            this.progressBar.title = `${this.processedCount} of ${this.filesToProcess.length} files processed.`;
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class DenaliSettingTab extends PluginSettingTab {
    plugin: DenaliAIFileRenamer;

    constructor(app: App, plugin: DenaliAIFileRenamer) {
        super(app, plugin);
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        const addSetting = (name: string, desc: string, settingKey: keyof DenaliSettings, type: 'toggle' | 'text' | 'dropdown' | 'textarea' | 'button', options?: { [key: string]: string }) => {
            let displayKey: keyof DenaliSettings;

            // Determine the correct displayKey based on the settingKey
            switch (settingKey) {
                case 'renameChoice':
                    displayKey = 'displayRenameProcessChoice';
                    break;
                case 'timestampFormat':
                    displayKey = 'displayBackupTimestampFormat';
                    break;
                case 'lookForUntitled':
                    displayKey = 'displayLookForUntitled';
                    break;
                case 'customPrompt':
                    displayKey = 'displayCustomPrompt';
                    break;
                case 'maxInputLength':
                    displayKey = 'displayMaxInputLength';
                    break;
                case 'maxOutputLength':
                    displayKey = 'displayMaxOutputLength';
                    break;
                case 'renameTimestampFormat':
                    displayKey = 'displayRenameTimestampFormat';
                    break;
                case 'useFrontmatter':
                    displayKey = 'displayUseFrontmatter';
                    break;
                case 'backupEnabled':
                    displayKey = 'displayBackupEnabled';
                    break;
                case 'logEnabled':
                    displayKey = 'displayLogEnabled';
                    break;
                case 'logFileEnabled':
                    displayKey = 'displayLogFileEnabled';
                    break;
                case 'modalCloseDelay':
                    displayKey = 'displayModalCloseDelay';
                    break;
                case 'resetSettings':
                    displayKey = 'displayResetSettings';
                    break;
                case 'openRouterApiKey':
                    displayKey = 'displayOpenRouterApiKey';
                    break;
                case 'aiModel':
                    displayKey = 'displayAiModel';
                    break;
                case 'aiNameStyle':
                    displayKey = 'displayAiNameStyle';
                    break;
                case 'fileNameCase':
                    displayKey = 'displayFileNameCase';
                    break;
                case 'stopWords':
                    displayKey = 'displayStopWords';
                    break;
                case 'characterReplacement':
                    displayKey = 'displayCharacterReplacement';
                    break;
                case 'addAlias':
                    displayKey = 'displayAddAlias';
                    break;
                case 'renameOnCreation':
                    displayKey = 'displayRenameOnCreation';
                    break;
                case 'untitledKeywords':
                    displayKey = 'displayUntitledKeywords';
                    break;
                case 'autoSubfolder':
                    displayKey = 'displayAutoSubfolder';
                    break;
                case 'backupFolder':
                    displayKey = 'displayBackupFolder';
                    break;
                case 'displayDeleteDenaliFolderButton': // Handle the new button's display setting
                    displayKey = 'displayDeleteDenaliFolderButton';
                    break;
                // --- SAAS: New display keys for plan-based settings ---
                case 'userPlan':
                    displayKey = 'displayUserPlan';
                    break;
                case 'maxFilesPerMonth':
                    displayKey = 'displayMaxFilesPerMonth';
                    break;
                case 'dailyFileLimit':
                    displayKey = 'displayDailyFileLimit';
                    break;
                case 'batchRenameLimit':
                    displayKey = 'displayBatchRenameLimit';
                    break;
                // --- NEW: Credit System Display Settings ---
                case 'paymentType':
                    displayKey = 'displayPaymentType';
                    break;
                case 'availableCredits':
                    displayKey = 'displayAvailableCredits';
                    break;
                // --- END NEW ---
                default:
                    // Fallback to derive displayKey from settingKey
                    const capitalizedSettingKey = (settingKey as string).charAt(0).toUpperCase() + (settingKey as string).slice(1);
                    displayKey = `display${capitalizedSettingKey}` as keyof DenaliSettings;
                    break;
            }
            
            // Check if the setting should be displayed based on its displayKey
            if (!(this.plugin.settings[displayKey] as boolean) && !this.plugin.settings.showAdvancedSettings) {
                return; // If the display setting is false, don't render this setting.
            }

            // Special case for "Reset to Defaults" button
            if (settingKey === 'resetSettings') {
                new Setting(containerEl)
                    .setName(name)
                    .setDesc(desc)
                    .addButton(button => button
                        .setButtonText(options?.buttonText || '')
                        .setWarning()
                        .onClick(async () => {
                            new ConfirmationModal(this.app,
                                'Confirm Reset',
                                'Are you sure you want to reset all Denali AI settings to their default values? This action cannot be undone.',
                                async () => {
                                    // Preserve the Constance device id across a reset — it must be
                                    // created once and reused forever, or the user loses the link
                                    // to any credits already purchased under it.
                                    const preservedDeviceId = this.plugin.settings.constanceDeviceId;
                                    this.plugin.settings = Object.assign({}, DEFAULT_SETTINGS);
                                    this.plugin.settings.constanceDeviceId = preservedDeviceId;
                                    await this.plugin.saveSettings();
                                    this.display();
                                    new Notice('Settings have been reset to default.', 3000);
                                }
                            ).open();
                        }));
                return; // Exit early as the button is directly added
            }
            
            // For all other settings, proceed with standard rendering
            const setting = new Setting(containerEl)
                .setName(name)
                .setDesc(desc);

            switch (type) {
                case 'toggle':
                    setting.addToggle(toggle => toggle
                        .setValue(this.plugin.settings[settingKey] as boolean)
                        .onChange(async (value) => {
                            (this.plugin.settings[settingKey] as boolean) = value;
                            await this.plugin.saveSettings();
                            this.display();
                        }));
                    break;
                case 'text':
                    setting.addText(text => {
                        // --- SAAS: Make plan-derived limits read-only ---
                        // Removed 'maxInputLength' and 'maxOutputLength' from this list
                        const isPlanDerivedAndShouldBeDisabled = ['maxFilesPerMonth', 'dailyFileLimit', 'batchRenameLimit', 'availableCredits'].includes(settingKey as string);
                        if (isPlanDerivedAndShouldBeDisabled) {
                            text.setDisabled(true); // Make it read-only
                        }
                        // --- END SAAS ---
                        text
                        .setPlaceholder(options?.placeholder || '')
                        .setValue(String(this.plugin.settings[settingKey])); // Ensure it's a string for the input field
                        if (settingKey === 'openRouterApiKey') text.inputEl.type = 'password';
                        text.onChange(async (value) => {
                            if (isPlanDerivedAndShouldBeDisabled) return; // Do not allow manual changes if derived from plan and disabled

                            // Check if the settingKey corresponds to a number type and parse it
                            if (settingKey === 'maxInputLength' || settingKey === 'maxOutputLength') {
                                const numValue = parseInt(value, 10);
                                const planLimits = getPlanLimits(this.plugin.settings.userPlan);
                                let maxAllowed: number;
                                let settingName: string;

                                if (settingKey === 'maxInputLength') {
                                    maxAllowed = planLimits.maxInputLength;
                                    settingName = 'Max AI Input Length';
                                } else { // maxOutputLength
                                    maxAllowed = planLimits.maxOutputLength;
                                    settingName = 'Max AI Output Length';
                                }

                                if (!isNaN(numValue) && numValue > 0 && numValue <= maxAllowed) {
                                    (this.plugin.settings[settingKey] as number) = numValue;
                                } else {
                                    new Notice(`Invalid value for '${settingName}'. Must be a positive number up to ${maxAllowed}. Reverting.`, 4000);
                                    text.setValue(String(this.plugin.settings[settingKey])); // Revert input field
                                    return; // Do not save invalid setting
                                }
                            } else if (settingKey === 'modalCloseDelay' || settingKey === 'availableCredits') {
                                const numValue = parseInt(value, 10);
                                if (!isNaN(numValue)) {
                                    (this.plugin.settings[settingKey] as number) = numValue;
                                } else {
                                    // Optionally, provide feedback for invalid input
                                    new Notice(`Invalid number for '${name}'. Reverting to previous value.`, 2000);
                                    text.setValue(String(this.plugin.settings[settingKey])); // Revert input field to last valid value
                                }
                            } else {
                                // For other text settings (which are strings)
                                (this.plugin.settings[settingKey] as string) = value;
                            }
                            await this.plugin.saveSettings();
                            // No need to re-display here unless a toggle affects visibility of other settings
                        })});
                    break;
                case 'textarea':
                    setting.addTextArea(text => text
                        .setPlaceholder(options?.placeholder || '')
                        .setValue(this.plugin.settings[settingKey] as string)
                        .onChange(async (value) => {
                            (this.plugin.settings[settingKey] as string) = value;
                            await this.plugin.saveSettings();
                            // No need to re-display here
                        }));
                    break;
                case 'dropdown':
                    setting.addDropdown(dropdown => {
                        if (options) {
                            for (const key in options) {
                                dropdown.addOption(key, options[key]);
                            }
                        }
                        dropdown
                            .setValue(this.plugin.settings[settingKey] as string)
                            .onChange(async (value: string) => {
                                (this.plugin.settings[settingKey] as string) = value;
                                
                                // --- SAAS: Update plan-based limits when userPlan changes ---
                                if (settingKey === 'userPlan') {
                                    const newPlan = value as UserPlan;
                                    const planLimits = getPlanLimits(newPlan);
                                    
                                    // Cap maxInputLength and maxOutputLength at new plan's limits
                                    if (this.plugin.settings.maxInputLength > planLimits.maxInputLength) {
                                        this.plugin.settings.maxInputLength = planLimits.maxInputLength;
                                    }
                                    if (this.plugin.settings.maxOutputLength > planLimits.maxOutputLength) {
                                        this.plugin.settings.maxOutputLength = planLimits.maxOutputLength;
                                    }

                                    // Only update subscription-specific limits if paymentType is subscription
                                    if (this.plugin.settings.paymentType === 'subscription') {
                                        this.plugin.settings.maxFilesPerMonth = planLimits.maxFilesPerMonth;
                                        this.plugin.settings.dailyFileLimit = planLimits.dailyFileLimit;
                                        this.plugin.settings.batchRenameLimit = planLimits.batchRenameLimit;
                                    }
                                } else if (settingKey === 'paymentType') {
                                    // When payment type changes, re-apply plan limits to ensure consistency
                                    const newPaymentType = value as PaymentType;
                                    const planLimits = getPlanLimits(this.plugin.settings.userPlan);
                                    
                                    // Cap maxInputLength and maxOutputLength at current plan's limits
                                    if (this.plugin.settings.maxInputLength > planLimits.maxInputLength) {
                                        this.plugin.settings.maxInputLength = planLimits.maxInputLength;
                                    }
                                    if (this.plugin.settings.maxOutputLength > planLimits.maxOutputLength) {
                                        this.plugin.settings.maxOutputLength = planLimits.maxOutputLength;
                                    }

                                    if (newPaymentType === 'subscription') {
                                        this.plugin.settings.maxFilesPerMonth = planLimits.maxFilesPerMonth;
                                        this.plugin.settings.dailyFileLimit = planLimits.dailyFileLimit;
                                        this.plugin.settings.batchRenameLimit = planLimits.batchRenameLimit;
                                    } else { // one-time
                                        // Reset subscription-specific limits if switching to one-time
                                        this.plugin.settings.maxFilesPerMonth = 0;
                                        this.plugin.settings.dailyFileLimit = 0;
                                        this.plugin.settings.batchRenameLimit = 0;
                                    }
                                }
                                // --- END SAAS ---

                                await this.plugin.saveSettings();
                                this.display(); // Re-display to update derived values and potentially other settings' visibility
                            });
                    });
                    break;
            }
        }; // Correct closing for addSetting arrow function.

        const addHeader = (headerText: string, headerKey: keyof DenaliSettings) => {
            if (this.plugin.settings[headerKey] as boolean) {
                containerEl.createEl('h3', { text: headerText });
            }
        };
        
        containerEl.createEl('h2', { text: 'Denali AI File Renamer Settings' });
        containerEl.createEl('p', { text: 'Start with a Markdown note, then use the command palette or the note/folder context menu to run Denali AI.' });
        containerEl.createEl('p', { text: 'Denali includes a free starter allowance. An OpenRouter API key is optional when the managed connection is available; add your own key below if you prefer.' });
        new Setting(containerEl)
            .setName('Show advanced settings')
            .setDesc('Reveal model, prompt, naming, frontmatter, backup, and logging controls.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showAdvancedSettings)
                .onChange(async (value) => {
                    this.plugin.settings.showAdvancedSettings = value;
                    await this.plugin.saveSettings();
                    this.display();
                }));
        
        // --- Payment Type Selection ---
        addHeader('Payment & Plan Settings', 'displayPaymentType'); // General header for payment
        // DO NOT DELETE COMMENT - For Future Code - addSetting('Payment Type', 'Choose type of purchase.', 'paymentType', 'dropdown', { 'one-time': 'One-Time Credits', 'subscription': 'Subscription Plan' });
        addSetting('Payment Type', 'Choose type of purchase.', 'paymentType', 'dropdown', { 'one-time': 'One-Time Credits'});

        // --- CONSTANCE: Central billing UI (replaces the old local license-key system) ---
        // Keep the local purchased-credit mirror fresh whenever this tab is opened.
        void this.plugin.syncPurchasedCreditsFromConstance();

        // Conditionally display plan-specific settings based on paymentType
        if (this.plugin.settings.paymentType === 'subscription') {
            addSetting('User Plan', 'The current subscription plan.', 'userPlan', 'dropdown', { 'free': 'Free', 'pro': 'Pro', 'ultimate': 'Ultimate' });
            addSetting('Max Files Per Month', 'Maximum number of files a user can process per month based on their plan.', 'maxFilesPerMonth', 'text');
            addSetting('Daily File Limit', 'Maximum number of files a user can process per day based on their plan.', 'dailyFileLimit', 'text');
            addSetting('Batch Rename Limit', 'Maximum number of files that can be processed in a single batch rename operation.', 'batchRenameLimit', 'text');
        } else { // one-time
            const totalCredits = this.plugin.settings.availableCredits + this.plugin.settings.purchasedCredits;
            new Setting(containerEl)
                .setName('Credit Balance')
                .setDesc(`Total available: ${totalCredits} credits (${this.plugin.settings.availableCredits} free + ${this.plugin.settings.purchasedCredits} purchased). Each file rename costs 1 credit, and each frontmatter change costs 1 credit.`);

            addBillingAccountSettings(containerEl, {
                state: this.plugin.settings,
                appId: CONSTANCE_APP_ID,
                installationId: this.plugin.settings.constanceDeviceId,
                appVersion: this.plugin.manifest.version,
                persist: () => this.plugin.saveSettings(),
                syncBalance: () => this.plugin.syncPurchasedCreditsFromConstance(),
                refresh: () => this.display(),
            });

            const buyCreditsSetting = new Setting(containerEl)
                .setName('Buy More Credits')
                .setDesc('Opens Constance secure checkout (app.tutivsoft.com) in your browser. Purchased credits appear automatically within a minute of payment, or use "Refresh Balance" below.');
            for (const tier of DENALI_CREDIT_TIERS) {
                buyCreditsSetting.addButton(button => button
                    .setButtonText(tier.label)
                    .onClick(() => {
                        const email = this.plugin.settings.billingEmail.trim();
                        if (!email || !email.includes('@')) {
                            new Notice('Please enter a valid billing email above before purchasing.', 5000);
                            return;
                        }
                        if (!tier.priceId || tier.priceId === 'PENDING_PROVISIONING') {
                            new Notice('Denali billing is not available yet because Paddle prices are still being provisioned.', 5000);
                            return;
                        }
                        const url = buildDenaliBuyUrl(tier.priceId, email, this.plugin.settings.constanceDeviceId);
                        window.open(url, '_blank');
                        new Notice(`Opening checkout for ${tier.label}...`, 3000);
                        // Re-sync shortly after checkout opens, so a fast payment shows up without a manual refresh.
                        setTimeout(() => { void this.plugin.syncPurchasedCreditsFromConstance(); }, 15000);
                        setTimeout(() => { void this.plugin.syncPurchasedCreditsFromConstance(); }, 45000);
                    }));
            }

            new Setting(containerEl)
                .setName('Refresh Balance')
                .setDesc('Manually re-sync your purchased credit balance from Constance.')
                .addButton(button => button
                    .setButtonText('Refresh Balance')
                    .setCta()
                    .onClick(async () => {
                        button.setDisabled(true);
                        await this.plugin.syncPurchasedCreditsFromConstance(true);
                        button.setDisabled(false);
                        this.display();
                    }));

            // --- START: Credit Tier Comparison Table ---
            containerEl.createEl('h3', { text: 'Denali AI Credit Tiers' });
            containerEl.createEl('p', { text: 'Every file rename and frontmatter change costs 1 credit each. Purchased credits never expire and are tied to this device via Constance (app.tutivsoft.com).' });

            const comparisonContainer = containerEl.createEl('div', {
                attr: { style: 'margin-top: 20px; border: 1px solid var(--background-modifier-border); border-radius: 4px; overflow: hidden; font-size: 0.85em;' }
            });

            const headerRow = comparisonContainer.createEl('div', {
                attr: { style: 'display: flex; font-weight: bold; background-color: var(--background-secondary); padding: 10px; border-bottom: 1px solid var(--background-modifier-border);' }
            });
            headerRow.createEl('div', { text: 'Tier', attr: { style: 'flex: 1; padding-right: 10px;' } });
            headerRow.createEl('div', { text: 'Price', attr: { style: 'flex: 1; text-align: center;' } });
            headerRow.createEl('div', { text: 'Credits', attr: { style: 'flex: 1; text-align: center;' } });

            const tierRows: { tier: string; price: string; credits: string }[] = [
                { tier: 'Free Starter (one-time)', price: 'Free', credits: '10 credits' },
                ...DENALI_CREDIT_TIERS.map(t => ({ tier: `$${t.amountUsd} Credit Pack`, price: `${t.amountUsd} USD`, credits: `${t.credits} credits` })),
            ];

            tierRows.forEach((data, index) => {
                const row = comparisonContainer.createEl('div', {
                    attr: {
                        style: `display: flex; padding: 10px; ${index % 2 === 0 ? 'background-color: var(--background-primary);' : 'background-color: var(--background-secondary-alt);'} ${index < tierRows.length - 1 ? 'border-bottom: 1px solid var(--background-modifier-border);' : ''}`
                    }
                });
                row.createEl('div', { text: data.tier, attr: { style: 'flex: 1; padding-right: 10px;' } });
                row.createEl('div', { text: data.price, attr: { style: 'flex: 1; text-align: center;' } });
                row.createEl('div', { text: data.credits, attr: { style: 'flex: 1; text-align: center;' } });
            });
            // --- END: Credit Tier Comparison Table ---
        }
        // --- END CONSTANCE ---

        addHeader('Main Workflow Settings', 'displayMainWorkflowHeader');
        addSetting('Rename Process Choice', 'Choose between automatic renaming without user interaction or an interactive modal that allows the user to approve/edit the name.', 'renameChoice', 'dropdown', { 'automatic': 'Automatic', 'interactive': 'Interactive' });
        addSetting('Rename on Creation', 'Automatically trigger renaming when a new file is created.', 'renameOnCreation', 'toggle');
        addSetting('Only Rename Untitled Files', 'If enabled, renaming on creation and batch renaming will only apply to files with names matching the keywords below.', 'lookForUntitled', 'toggle');
        addSetting('Untitled Keywords', 'A comma-separated list of keywords (case-insensitive) that identify untitled files.', 'untitledKeywords', 'text');
        addSetting('Auto Subfolder', 'Automatically move the file to a subfolder suggested by the AI based on its content.', 'autoSubfolder', 'toggle');

        addHeader('AI & API Settings', 'displayAiApiHeader');
        addSetting('OpenRouter API Key', 'Enter your OpenRouter API key. It is stored locally and sent only to OpenRouter.', 'openRouterApiKey', 'text');
        addSetting('AI Model', 'Choose the AI model from OpenRouter to use for renaming.', 'aiModel', 'dropdown', OPENROUTER_MODELS.reduce((acc, curr) => ({ ...acc, [curr]: curr }), {}));
        addSetting('AI Name Style', 'Choose the type of filename the AI should generate based on different priorities.', 'aiNameStyle', 'dropdown', { 'balanced': 'Balanced (e.g., Apple Inc Annual Report for 2025)', 'keywordFilled': 'Keyword-Filled (e.g., Code Python Tensorflow Johsnson AI Project memory second fix)', 'nicheWordsOnly': 'Niche Words Only (e.g., apple report 2025 john reviewed approved emergency fix2)' });
        addSetting('Custom AI Prompt', 'Customize the prompt sent to the AI. Use `{content}` as a placeholder for the file content, `{max_input_length}` for the input character limit, and `{max_output_length}` for the output character limit.', 'customPrompt', 'textarea');
        addSetting('Max Input Length (characters)', 'The maximum number of characters from the file to send to the AI. This value can be customized, but cannot exceed your plan\'s limit.', 'maxInputLength', 'text');
        addSetting('Max Output Length (characters)', 'The maximum number of characters for the final file name. This value can be customized, but cannot exceed your plan\'s limit.', 'maxOutputLength', 'text');

        addHeader('File Naming & Structure', 'displayFileNamingHeader');
        addSetting('File Name Case', 'Choose the case style for the new file name.', 'fileNameCase', 'dropdown', { 'kebab': 'kebab-case (my-file-name)', 'camel': 'camelCase (myFileName)', 'lowercase': 'lowercase (myfilename)', 'original': 'Original (AI\'s suggestion)' });
        addSetting('Add Timestamp to New File', 'Add the file\'s modification date (YYYY-MM-DD HH-MM-SS) as a prefix or suffix to the new filename.', 'renameTimestampFormat', 'dropdown', { 'none': 'None', 'prefix': 'Prefix', 'suffix': 'Suffix' });
        addSetting('Stop Words', 'A comma-separated list of words to remove from the generated filename.', 'stopWords', 'text');
        addSetting('Character Replacement', 'A single character to replace spaces in the generated filename (e.g., "_" or "-"). Leave blank to use hyphens by default.', 'characterReplacement', 'text');

        addHeader('Frontmatter Automation', 'displayFrontmatterHeader');
        addSetting('Include Frontmatter', 'Include the note\'s frontmatter (YAML) in the content sent to the AI for better context.', 'useFrontmatter', 'toggle');
        addSetting('Add Alias', 'Adds the old file name to the new note\'s frontmatter as an alias, preserving links.', 'addAlias', 'toggle');
        
        this.createFrontmatterSetting(containerEl, 'addTitle', 'title', 'Title');
        this.createFrontmatterSetting(containerEl, 'addCreatedDate', 'created', 'Created Date');
        this.createFrontmatterSetting(containerEl, 'addModifiedDate', 'modified', 'Modified Date');
        this.createFrontmatterSetting(containerEl, 'addAuthor', 'author', 'Author');
        this.createFrontmatterSetting(containerEl, 'addStatus', 'status', 'Status');
        this.createFrontmatterSetting(containerEl, 'addProject', 'project', 'Project');
        this.createFrontmatterSetting(containerEl, 'addTopic', 'topic', 'Topic');

        addHeader('Backup & Log Settings', 'displayBackupLogHeader');
        addSetting('Create Backups', 'Create a copy of the original file before renaming it.', 'backupEnabled', 'toggle');
        addSetting('Backup Folder', 'The path to the folder where backups will be stored. It will be created if it does not exist.', 'backupFolder', 'text');
        addSetting('Backup Timestamp Format', 'Choose where to place the timestamp on the backup file name.', 'timestampFormat', 'dropdown', { 'none': 'None', 'suffix': 'Suffix (filename-YYYY-MM-DD-HH-MM-SS)' });
        addSetting('Enable Logs', 'Turn on or off the logging messages in the console and rename modal.', 'logEnabled', 'toggle');
        addSetting('Save Logs to File', 'If enabled, a log file will be created in the backup folder to record all renaming actions.', 'logFileEnabled', 'toggle');
        addSetting('Log Window Close Delay (seconds)', 'The time to wait before the log window closes automatically after a successful rename or batch job completion. This applies to both automatic and interactive modes.', 'modalCloseDelay', 'text');

        addHeader('Reset Settings', 'displayResetHeader');
        addSetting('Reset to Defaults', 'Reset all settings to their default values.', 'resetSettings', 'button', { 'buttonText': 'Reset' });

        // Explicit user action for deleting the Denali AI folder
        if (this.plugin.settings.displayDeleteDenaliFolderButton) {
            new Setting(containerEl)
                .setName('Delete Denali AI Folder')
                .setDesc('Permanently delete the "Denali AI" folder, including all backups and logs. This action cannot be undone.')
                .addButton(button => button
                    .setButtonText('Delete Folder')
                    .setWarning()
                    .onClick(async () => {
                        const folder = this.app.vault.getAbstractFileByPath(DenaliAIFileRenamer.DENALI_FOLDER);
                        if (!folder) {
                            new Notice(`The "${DenaliAIFileRenamer.DENALI_FOLDER}" folder does not exist.`, 3000);
                            return;
                        }

                        new ConfirmationModal(this.app,
                            'Confirm Deletion',
                            `Are you sure you want to permanently delete the "${DenaliAIFileRenamer.DENALI_FOLDER}" folder and all its contents (backups, logs)? This action cannot be undone.`,
                            async () => {
                                try {
                                    await this.plugin.deleteDenaliFolder();
                                    new Notice(`Successfully deleted the "${DenaliAIFileRenamer.DENALI_FOLDER}" folder.`, 5000);
                                } catch (error) {
                                    new Notice(`Failed to delete the "${DenaliAIFileRenamer.DENALI_FOLDER}" folder: ${error.message}`, 5000);
                                    console.error('Denali Folder Deletion Error:', error);
                                }
                                this.display(); // Re-display settings to reflect changes if any
                            }
                        ).open();
                    }));
        }
    }

    private createFrontmatterSetting(containerEl: HTMLElement, settingKey: keyof DenaliSettings, propertyName: string, name: string) {
        // Dynamically construct the display key name, e.g., 'addTitle' -> 'displayAddTitle'
        const displayKey = `displayAdd${propertyName.charAt(0).toUpperCase() + propertyName.slice(1)}` as keyof DenaliSettings;
        const promptDisplayKey = `display${propertyName.charAt(0).toUpperCase() + propertyName.slice(1)}Prompt` as keyof DenaliSettings;
        const valueDisplayKey = `display${propertyName.charAt(0).toUpperCase() + propertyName.slice(1)}DefaultValue` as keyof DenaliSettings;
        const formatDisplayKey = `display${propertyName.charAt(0).toUpperCase() + propertyName.slice(1)}DateFormat` as keyof DenaliSettings;

        if (this.plugin.settings[displayKey] as boolean) {
            new Setting(containerEl)
                .setName(`Add '${propertyName}'`)
                .setDesc(`Automatically add a '${propertyName}' property to the note's frontmatter.`)
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings[settingKey] as boolean)
                    .onChange(async (value) => {
                        (this.plugin.settings[settingKey] as boolean) = value;
                        await this.plugin.saveSettings();
                        this.display();
                    }));

            // MODIFICATION START: Only show prompt/value/format settings if it's NOT 'addTitle' OR if 'addTitle' is false.
            // If 'addTitle' is true, we don't need a prompt for it, as it's derived from the filename.
            if (this.plugin.settings[settingKey] && propertyName !== 'title') {
                const subSetting = new Setting(containerEl);
                let desc = '';
                let placeholder = '';
                let value = '';
                let settingField: keyof DenaliSettings | null = null;
                
                if (['author', 'project', 'topic'].includes(propertyName)) { // 'title' removed from here
                    desc = 'The AI prompt to generate this property. The AI will respond with only the value for the property.';
                    settingField = propertyName + 'Prompt' as keyof DenaliSettings;
                    placeholder = DEFAULT_SETTINGS[settingField] as string;
                    value = this.plugin.settings[settingField] as string;

                    if (this.plugin.settings[promptDisplayKey] as boolean) {
                        subSetting.setName(`${name} Value/Prompt`).setDesc(desc);
                        subSetting.addTextArea(text => text
                            .setPlaceholder(placeholder)
                            .setValue(value)
                            .onChange(async (val) => {
                                (this.plugin.settings[settingField!] as string) = val;
                                await this.plugin.saveSettings();
                            }));
                    }
                } else if (propertyName === 'status') {
                    desc = 'The default value for the status property.';
                    settingField = propertyName + 'DefaultValue' as keyof DenaliSettings;
                    placeholder = DEFAULT_SETTINGS[settingField] as string;
                    value = this.plugin.settings[settingField] as string;

                    if (this.plugin.settings[valueDisplayKey] as boolean) {
                        subSetting.setName(`${name} Value/Prompt`).setDesc(desc);
                        subSetting.addText(text => text
                            .setPlaceholder(placeholder)
                            .setValue(value)
                            .onChange(async (val) => {
                                (this.plugin.settings[settingField!] as string) = val;
                                await this.plugin.saveSettings();
                            }));
                    }
                } else if (['created', 'modified'].includes(propertyName)) {
                    desc = 'The date format for the date. Use YYYY, MM, DD, HH, mm, ss.';
                    settingField = propertyName + 'DateFormat' as keyof DenaliSettings;
                    placeholder = DEFAULT_SETTINGS[settingField] as string;
                    value = this.plugin.settings[settingField] as string;

                    if (this.plugin.settings[formatDisplayKey] as boolean) {
                        subSetting.setName(`${name} Date Format`).setDesc(desc);
                        subSetting.addText(text => text
                            .setPlaceholder(placeholder)
                            .setValue(value)
                            .onChange(async (val) => {
                                (this.plugin.settings[settingField!] as string) = val;
                                await this.plugin.saveSettings();
                            }));
                    }
                }
            }
            // MODIFICATION END
        }
    }
}
