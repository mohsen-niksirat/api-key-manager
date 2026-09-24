// i18n.js - Multi-language support (English + Persian with RTL)

export const TRANSLATIONS = {
  en: {
    // Header
    appTitle: 'API Key Manager',
    searchPlaceholder: 'Search keys or providers...',
    themeToggle: 'Toggle theme',
    download: 'Download JSON',
    importBackup: 'Import backup',
    exportJson: 'Export JSON',
    settings: 'Settings',

    // Main
    yourProviders: 'Your API Providers',
    addProvider: '+ Add Provider',
    browseDirectory: '🧭 Browse directory',
    noProviders: 'No providers. Add one to get started!',
    loading: 'Loading...',

    // Provider card
    noKeysYet: 'No keys yet →',
    active: 'active',
    total: 'Total',
    more: 'more',

    // Provider detail
    providerDetails: 'Provider Details',
    edit: '✏️ Edit',
    apiKeys: 'API Keys',
    addKey: '+ Add Key',
    deleteProvider: '🗑️ Delete Provider',
    noKeysForProvider: 'No keys for this provider',
    models: 'Models',
    copyBaseUrl: '📋 Copy Base URL',
    website: '🔗 Website',
    copyKey: 'Copy key',
    deleteKey: 'Delete key',
    expires: 'Expires',
    unnamedKey: 'Unnamed Key',
    encryptedAtRest: 'Encrypted at rest',
    showKey: 'Show key',
    hideKey: 'Hide key',

    // Modals
    addProviderTitle: 'Add Provider',
    providerName: 'Provider Name *',
    providerNamePh: 'e.g., My Custom API',
    baseUrl: 'Base URL *',
    baseUrlPh: 'https://api.example.com/v1',
    modelsLabel: 'Models (comma-separated)',
    modelsPh: 'gpt-4, gpt-3.5-turbo, ...',
    websiteLabel: 'Website',
    websitePh: 'https://example.com',
    logoUrl: 'Logo URL',
    logoPh: 'https://example.com/logo.png',
    cancel: 'Cancel',
    saveProvider: 'Save Provider',

    addKeyTitle: 'Add API Key',
    keyName: 'Key Name *',
    keyNamePh: 'Production, Testing, etc.',
    apiKey: 'API Key *',
    apiKeyPh: 'sk-...',
    expiryDate: 'Expiry Date',
    saveKey: 'Save Key',

    editProviderTitle: 'Edit Provider',
    saveChanges: 'Save Changes',

    exportTitle: 'Export Data',
    exportedJson: 'Exported JSON',
    close: 'Close',
    copyToClipboard: 'Copy to clipboard',

    directoryTitle: '🧭 Provider Directory',
    filterDirectory: 'Filter directory...',
    loadingDirectory: 'Loading directory...',
    noMatch: 'No providers match your filter.',
    added: '✓ Added',
    addAction: '+ Add',

    settingsTitle: 'Settings',
    theme: 'Theme',
    language: 'Language',
    themeDark: 'Dark',
    themeLight: 'Light',
    themeSystem: 'System',
    autoSave: 'Auto-save on changes',
    encryptKeys: '🔒 Encrypt API keys (master password)',
    save: 'Save',

    encryptionTitle: '🔒 Encryption',
    masterPassword: 'Master password *',
    masterPasswordPh: 'Min 8 characters',
    confirmPassword: 'Confirm password *',
    confirmPasswordPh: 'Repeat password',
    warningNoReset: '⚠️ If you forget this password, encrypted keys cannot be recovered. There is no reset.',
    enableEncryption: 'Enable encryption',
    unlock: 'Unlock',
    disableEncryption: 'Disable encryption',
    encryptStatusOff: '○ Encryption is off — keys are stored in plain text.',
    encryptStatusUnlocked: '● Unlocked — {n}/{t} keys encrypted.',
    encryptStatusLocked: '🔒 Locked — {n}/{t} keys encrypted. Enter password to unlock.',

    // Backup encryption
    backupTitle: 'Encrypted Backup',
    backupPassword: 'Backup password *',
    backupPasswordHint: 'Used to encrypt the backup file. The master password is used by default.',
    downloadEncrypted: '🔒 Download encrypted backup',
    downloadPlain: 'Download plain JSON',
    importEncrypted: 'Encrypted backup file — enter its password:',

    // Toasts
    toastLoaded: 'API Key Manager loaded',
    toastKeyAdded: 'Key added',
    toastKeyDeleted: 'Key deleted',
    toastProviderAdded: 'Provider added',
    toastProviderUpdated: 'Provider updated',
    toastProviderDeleted: 'Provider deleted',
    toastCopied: 'Copied to clipboard',
    toastCopyFailed: 'Copy failed',
    toastSettingsSaved: 'Settings saved',
    toastBackupDownloaded: 'Backup downloaded',
    toastEncryptedBackup: 'Encrypted backup downloaded',
    toastImported: 'Data imported successfully',
    toastInvalidFile: 'Invalid file format',
    toastEnterKey: 'Please enter a key',
    toastFillRequired: 'Please fill in required fields',
    toastPwShort: 'Password must be at least 8 characters',
    toastPwMismatch: 'Passwords do not match',
    toastWrongPw: 'Wrong password',
    toastEncrypting: 'Encrypting keys…',
    toastEncEnabled: 'Encryption enabled — {n} key(s) encrypted',
    toastEncDisabled: 'Encryption disabled — {n} key(s) decrypted',
    toastEncUnlocked: 'Encryption unlocked',
    toastEncFail: 'Failed to enable encryption',
    toastDecryptFail: 'Failed to decrypt',
    toastBackupEncrypted: 'Backup encrypted',
    toastBackupDecrypted: 'Backup decrypted',
    toastAddedProvider: '{name} added',
    toastAlreadyExists: 'Provider already exists',

    // Confirms
    confirmDeleteKey: 'Delete this key?',
    confirmDeleteProvider: 'Delete provider "{name}" and all its keys?',
    confirmImport: 'Import {n} providers? This will overwrite existing data.',
    confirmDisableEnc: 'Disable encryption and store all keys in plain text?'
  },

  fa: {
    appTitle: 'مدیریت کلید API',
    searchPlaceholder: 'جستجوی کلید یا پرووایدر...',
    themeToggle: 'تغییر تم',
    download: 'دانلود JSON',
    importBackup: 'بازیابی بکاپ',
    exportJson: 'خروجی JSON',
    settings: 'تنظیمات',

    yourProviders: 'پرووایدرهای شما',
    addProvider: '+ افزودن پرووایدر',
    browseDirectory: '🧭 فهرست پرووایدرها',
    noProviders: 'هنوز پرووایدری نیست. یکی اضافه کنید!',
    loading: 'در حال بارگذاری...',

    noKeysYet: 'هنوز کلیدی نیست →',
    active: 'فعال',
    total: 'کل',
    more: 'بیشتر',

    providerDetails: 'جزئیات پرووایدر',
    edit: '✏️ ویرایش',
    apiKeys: 'کلیدهای API',
    addKey: '+ افزودن کلید',
    deleteProvider: '🗑️ حذف پرووایدر',
    noKeysForProvider: 'کلیدی برای این پرووایدر نیست',
    models: 'مدل‌ها',
    copyBaseUrl: '📋 کپی Base URL',
    website: '🔗 وب‌سایت',
    copyKey: 'کپی کلید',
    deleteKey: 'حذف کلید',
    expires: 'انقضا',
    unnamedKey: 'کلید بی‌نام',
    encryptedAtRest: 'رمزنگاری‌شده',
    showKey: 'نمایش کلید',
    hideKey: 'مخفی کردن کلید',

    addProviderTitle: 'افزودن پرووایدر',
    providerName: 'نام پرووایدر *',
    providerNamePh: 'مثلاً: API سفارشی من',
    baseUrl: 'آدرس پایه *',
    baseUrlPh: 'https://api.example.com/v1',
    modelsLabel: 'مدل‌ها (با کاما جدا کنید)',
    modelsPh: 'gpt-4, gpt-3.5-turbo, ...',
    websiteLabel: 'وب‌سایت',
    websitePh: 'https://example.com',
    logoUrl: 'آدرس لوگو',
    logoPh: 'https://example.com/logo.png',
    cancel: 'انصراف',
    saveProvider: 'ذخیره پرووایدر',

    addKeyTitle: 'افزودن کلید API',
    keyName: 'نام کلید *',
    keyNamePh: 'تولید، تست و ...',
    apiKey: 'کلید API *',
    apiKeyPh: 'sk-...',
    expiryDate: 'تاریخ انقضا',
    saveKey: 'ذخیره کلید',

    editProviderTitle: 'ویرایش پرووایدر',
    saveChanges: 'ذخیره تغییرات',

    exportTitle: 'خروجی داده',
    exportedJson: 'JSON خروجی',
    close: 'بستن',
    copyToClipboard: 'کپی به کلیپ‌بورد',

    directoryTitle: '🧭 فهرست پرووایدرها',
    filterDirectory: 'فیلتر فهرست...',
    loadingDirectory: 'در حال بارگذاری فهرست...',
    noMatch: 'پرووایدری با این فیلتر پیدا نشد.',
    added: '✓ اضافه شد',
    addAction: '+ افزودن',

    settingsTitle: 'تنظیمات',
    theme: 'تم',
    language: 'زبان',
    themeDark: 'تیره',
    themeLight: 'روشن',
    themeSystem: 'سیستم',
    autoSave: 'ذخیره خودکار تغییرات',
    encryptKeys: '🔒 رمزنگاری کلیدها (رمز اصلی)',
    save: 'ذخیره',

    encryptionTitle: '🔒 رمزنگاری',
    masterPassword: 'رمز اصلی *',
    masterPasswordPh: 'حداقل ۸ کاراکتر',
    confirmPassword: 'تکرار رمز *',
    confirmPasswordPh: 'رمز را دوباره وارد کنید',
    warningNoReset: '⚠️ اگر این رمز را فراموش کنید، کلیدهای رمزنگاری‌شده قابل بازیابی نیستند. راه بازیابی وجود ندارد.',
    enableEncryption: 'فعال‌سازی رمزنگاری',
    unlock: 'باز کردن قفل',
    disableEncryption: 'غیرفعال‌سازی رمزنگاری',
    encryptStatusOff: '○ رمزنگاری خاموش است — کلیدها به‌صورت متن ساده ذخیره می‌شوند.',
    encryptStatusUnlocked: '● باز شده — {n}/{t} کلید رمزنگاری شده.',
    encryptStatusLocked: '🔒 قفل — {n}/{t} کلید رمزنگاری شده. رمز را وارد کنید.',

    backupTitle: 'بکاپ رمزنگاری‌شده',
    backupPassword: 'رمز بکاپ *',
    backupPasswordHint: 'برای رمزنگاری فایل بکاپ استفاده می‌شود. به‌طور پیش‌فرض رمز اصلی به‌کار می‌رود.',
    downloadEncrypted: '🔒 دانلود بکاپ رمزنگاری‌شده',
    downloadPlain: 'دانلود JSON ساده',
    importEncrypted: 'فایل بکاپ رمزنگاری‌شده — رمز آن را وارد کنید:',

    toastLoaded: 'مدیریت کلید API بارگذاری شد',
    toastKeyAdded: 'کلید اضافه شد',
    toastKeyDeleted: 'کلید حذف شد',
    toastProviderAdded: 'پرووایدر اضافه شد',
    toastProviderUpdated: 'پرووایدر به‌روزرسانی شد',
    toastProviderDeleted: 'پرووایدر حذف شد',
    toastCopied: 'در کلیپ‌بورد کپی شد',
    toastCopyFailed: 'کپی ناموفق بود',
    toastSettingsSaved: 'تنظیمات ذخیره شد',
    toastBackupDownloaded: 'بکاپ دانلود شد',
    toastEncryptedBackup: 'بکاپ رمزنگاری‌شده دانلود شد',
    toastImported: 'داده‌ها با موفقیت بازیابی شد',
    toastInvalidFile: 'فرمت فایل نامعتبر است',
    toastEnterKey: 'لطفاً کلید را وارد کنید',
    toastFillRequired: 'لطفاً فیلدهای الزامی را پر کنید',
    toastPwShort: 'رمز باید حداقل ۸ کاراکتر باشد',
    toastPwMismatch: 'رمزها یکسان نیستند',
    toastWrongPw: 'رمز اشتباه است',
    toastEncrypting: 'در حال رمزنگاری کلیدها…',
    toastEncEnabled: 'رمزنگاری فعال شد — {n} کلید رمزنگاری شد',
    toastEncDisabled: 'رمزنگاری غیرفعال شد — {n} کلید رمزگشایی شد',
    toastEncUnlocked: 'قفل رمزنگاری باز شد',
    toastEncFail: 'فعال‌سازی رمزنگاری ناموفق بود',
    toastDecryptFail: 'رمزگشایی ناموفق بود',
    toastBackupEncrypted: 'بکاپ رمزنگاری شد',
    toastBackupDecrypted: 'بکاپ رمزگشایی شد',
    toastAddedProvider: '{name} اضافه شد',
    toastAlreadyExists: 'پرووایدر از قبل وجود دارد',

    confirmDeleteKey: 'این کلید حذف شود؟',
    confirmDeleteProvider: 'پرووایدر «{name}» و همه کلیدهایش حذف شود؟',
    confirmImport: '{n} پرووایدر بازیابی شود؟ داده‌های فعلی بازنویسی می‌شوند.',
    confirmDisableEnc: 'رمزنگاری غیرفعال و همه کلیدها به‌صورت متن ساده ذخیره شوند؟'
  }
};

const RTL_LANGS = new Set(['fa', 'ar', 'he', 'ur']);

export class I18n {
  constructor(lang = 'en') {
    this.lang = lang;
    this.listeners = new Set();
  }

  setLang(lang) {
    if (!TRANSLATIONS[lang]) lang = 'en';
    this.lang = lang;
    this.listeners.forEach(fn => fn(lang));
  }

  getLang() {
    return this.lang;
  }

  isRTL() {
    return RTL_LANGS.has(this.lang);
  }

  /** Translate a key, interpolating {placeholders}. Falls back to English then the key itself. */
  t(key, params = {}) {
    const dict = TRANSLATIONS[this.lang] || TRANSLATIONS.en;
    let text = dict[key] ?? TRANSLATIONS.en[key] ?? key;
    for (const [k, v] of Object.entries(params)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
    return text;
  }

  /** Detect browser language; only picks langs we support. */
  static detectLang() {
    const langs = navigator.languages || [navigator.language || 'en'];
    for (const l of langs) {
      const code = (l || '').toLowerCase().split('-')[0];
      if (TRANSLATIONS[code]) return code;
    }
    return 'en';
  }

  /** Apply dir/lang to <html> and translate all elements carrying data-i18n attributes. */
  applyToDOM(root = document) {
    document.documentElement.lang = this.lang;
    document.documentElement.dir = this.isRTL() ? 'rtl' : 'ltr';

    root.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = this.t(el.dataset.i18n);
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.placeholder = this.t(el.dataset.i18nPlaceholder);
    });
    root.querySelectorAll('[data-i18n-title]').forEach(el => {
      el.title = this.t(el.dataset.i18nTitle);
    });
  }

  onChange(fn) {
    this.listeners.add(fn);
  }
}
