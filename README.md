# API Key Manager | مدیریت کلیدهای API

[![Tests](https://github.com/mohsen-niksirat/api-key-manager/actions/workflows/test.yml/badge.svg)](https://github.com/mohsen-niksirat/api-key-manager/actions/workflows/test.yml)
[![Deploy](https://github.com/mohsen-niksirat/api-key-manager/actions/workflows/deploy.yml/badge.svg)](https://github.com/mohsen-niksirat/api-key-manager/actions/workflows/deploy.yml)

🌐 **Live app | نسخه آنلاین:** [mohsen-niksirat.github.io/api-key-manager](https://mohsen-niksirat.github.io/api-key-manager/)

A privacy-first, offline-first web application for managing your API keys across multiple providers. Built as a PWA using plain HTML/CSS/JS — no frameworks, no server, no tracking.

اپلیکیشنی حریم‌خصوصی‌محور و آفلاین‌محور برای مدیریت کلیدهای API شما. ساخته‌شده با HTML/CSS/JS خالص — بدون فریمورک، بدون سرور، بدون ردیابی.

---

## ✨ Features | امکانات

| | English | فارسی |
|---|---|---|
| 🔐 | All data stays local (IndexedDB) | همه داده‌ها لوکال می‌مانند |
| 🌍 | Bilingual UI: English + Persian (RTL) | رابط دوزبانه: انگلیسی + فارسی (راست‌به‌چپ) |
| 🔒 | Optional AES-GCM encryption with master password (WebCrypto, PBKDF2 310k) | رمزنگاری اختیاری AES-GCM با رمز اصلی |
| 🔑 | Encrypted backup files + plain JSON export | فایل بکاپ رمزنگاری‌شده + خروجی JSON ساده |
| 👁️ | Per-key show/hide (eye toggle) | نمایش/مخفی‌کردن هر کلید |
| 🧭 | Provider directory with 25+ providers | فهرست بیش از ۲۵ پرووایدر |
| ✏️ | Full provider editing | ویرایش کامل پرووایدر |
| 📱 | Mobile-first: bottom sheets, safe-area, touch targets | بهینه برای موبایل |
| 🌙 | Dark / Light / System themes | تم تیره / روشن / سیستم |
| 📦 | Import / Export, global search | بازیابی/خروجی، جستجوی سراسری |
| 📲 | Installable PWA with offline support | PWA نصب‌شدنی با پشتیبانی آفلاین |
| 📌 | Pin / favourite providers, filter tabs (all · pinned · favourites · no keys), text + key search | پین و ستاره‌دار کردن + تب‌های فیلتر و جستجو |
| 🧪 | Test any key from the provider window — single test or one-click test-all, with latency and model count | تست کلید تکی یا یک‌جا از پنجره پرووایدر، با زمان پاسخ |
| 📋 | One-tap copy of base URL and model names (from the card and inside the key list) | کپی سریع base URL و نام مدل با یک کلیک |
| 🗑️ | Soft delete: providers, keys and deleted settings go to a restoreable trash (30-day retention) | حذف نرم با سطل بازیافت و مهلت ۳۰ روز |
| 🎨 | Animated aurora background, glass panels, spring hover/press micro-interactions | پس‌زمینه متحرک، پنل‌های شیشه‌ای و انیمیشن‌های ظریف |

## 🔐 Security Model | مدل امنیتی

- Keys can be **encrypted at rest** with AES-256-GCM. Each key gets a fresh random salt + IV; the master password is stretched with PBKDF2-HMAC-SHA256 (310,000 iterations) and **never stored** — only a verifier hash is kept.
- Backup files use the same scheme with the format `AKM-ENCRYPTED-BACKUP:v1:<payload>` and can use a separate backup password.
- If you forget the master password, encrypted data **cannot be recovered**. There is no reset — by design.

کلیدها می‌توانند با AES-256-GCM رمزنگاری شوند. هر کلید salt و IV تصادفی خودش را دارد؛ رمز اصلی با PBKDF2 (۳۱۰هزار تکرار) پردازش و **هرگز ذخیره نمی‌شود** — فقط یک hash تأیید نگه داشته می‌شود. اگر رمز را فراموش کنید، داده‌ها **قابل بازیابی نیستند**.

## 🚀 Usage | استفاده

```bash
git clone https://github.com/mohsen-niksirat/api-key-manager
cd api-key-manager

# Local server (required for ES modules + Service Worker)
python -m http.server 8000
# Open http://localhost:8000
```

Or just use the live version: **[mohsen-niksirat.github.io/api-key-manager](https://mohsen-niksirat.github.io/api-key-manager/)**

## 🧪 Tests | تست‌ها

Zero-dependency test runner (Node 18+):

```bash
npm test
```

Covers encryption roundtrips, wrong-password rejection, tampered ciphertexts, provider/key CRUD with cascade deletes, encryption lifecycle, directory dedup, import/export, soft delete + restore/purge, trash retention and quota eviction, pinned-first ordering, and the provider-key HTTP tester against a mock `fetch` — 54 tests.

تست‌ها شامل رفت‌وبرگشت رمزنگاری، رد شدن رمز اشتباه، CRUD پرووایدر/کلید، سطل بازیافت و مهلت ۳۰ روز، ترتیب پین‌شده‌ها و تست‌کننده کلید با `fetch` ساختگی است — ۵۴ تست.

## 📷 Interface Tour | گشتی در رابط

The live app has no screenshots committed (privacy: everything is local), so here is the flow:

1. **Home** — header with search + `EN / فا` + theme, toolbar with *Add provider* and the filter tabs (all · pinned · favourites · no keys · search), then the provider grid. Each card shows name + favicon letter, kind badge (local / cloud / proxy), key and model counts, notes preview, and an inline copy row for the **base URL** and each **model**.
2. **Provider window** (tap a card) — header actions: *Test key*, *Add key*, *Pin*, *Edit*, *Delete*. Below: the key list (masked, per-key eye + copy + test + delete) and the model list (one-click copy). *Test all keys* runs every key in parallel and shows ✓ valid / ✗ invalid with status code, latency and model count.
3. **Directory** (tab) — 25+ providers with category chips + search; *Add* pulls name, base URL and models onto the home screen.
4. **Trash** (tab) — deleted providers, keys and settings with age; Restore / Delete forever / Empty trash. Items expire after 30 days.
5. **Settings** — language, theme, encryption + master password, backup file import/export, plain JSON export/import.

۱) خانه: جستجو، تب‌های فیلتر، کارت‌ها با کپی سریع base URL و مدل‌ها. ۲) پنجره پرووایدر: تست کلید تکی یا «تست همه»، افزودن/مخفی‌کردن/کپی کلید، پین ویرایش و حذف. ۳) فهرست پرووایدرها با فیلتر دسته. ۴) سطل بازیافت با بازگردانی و حذف دائمی. ۵) تنظیمات: زبان، تم، رمزنگاری، بکاپ و Import/Export.

## 🔄 Language | زبان

Switch anytime from the header (`EN / فا`) or Settings. Persian renders the whole UI right-to-left with the Vazirmatn font; the choice persists in IndexedDB. Auto-detected from your browser on first visit.

زبان را از هدر یا تنظیمات عوض کنید. فارسی با فونت وزیرمتن و چیدمان راست‌به‌چپ کامل رندر می‌شود و انتخاب شما ذخیره می‌ماند.

## 📂 Project Structure | ساختار پروژه

```
api-key-manager/
├── index.html                  # App shell (all modals, i18n-marked)
├── manifest.json               # PWA manifest
├── sw.js                       # Service worker (offline cache v5)
├── css/styles.css              # All styling incl. RTL + mobile
├── js/
│   ├── app.js                  # Main application logic
│   ├── storage.js              # IndexedDB wrapper + soft-delete/trash
│   ├── providers.js            # Provider/key management, filter + sort
│   ├── keytester.js            # Live provider-key validation (OpenAI-compatible)
│   ├── crypto.js               # AES-GCM encryption (WebCrypto)
│   └── i18n.js                 # EN/FA translations + RTL
├── data/
│   ├── default-providers.json  # Seeded providers
│   └── provider-directory.json # Browseable directory (25+)
├── icons/icon.svg              # Maskable SVG icon
├── tests/                      # Zero-dependency test suite
└── .github/workflows/          # CI (tests) + Pages deploy
```

## 🤝 Contributing | مشارکت

Contributions welcome! | مشارکت‌ها خوش‌آمدند!

## 📄 License

MIT — [mohsen-niksirat](https://github.com/mohsen-niksirat) — Made with ❤️

---

**All data stays locally in your browser — nothing is sent to any server.**
**همه داده‌ها در مرورگر شما می‌مانند — هیچ چیزی به هیچ سروری ارسال نمی‌شود.**
