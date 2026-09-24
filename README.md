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

Covers encryption roundtrips, wrong-password rejection, tampered ciphertexts, provider/key CRUD with cascade deletes, encryption lifecycle, directory dedup, import/export — 32 tests.

## 🔄 Language | زبان

Switch anytime from the header (`EN / فا`) or Settings. Persian renders the whole UI right-to-left with the Vazirmatn font; the choice persists in IndexedDB. Auto-detected from your browser on first visit.

زبان را از هدر یا تنظیمات عوض کنید. فارسی با فونت وزیرمتن و چیدمان راست‌به‌چپ کامل رندر می‌شود و انتخاب شما ذخیره می‌ماند.

## 📂 Project Structure | ساختار پروژه

```
api-key-manager/
├── index.html                  # App shell (all modals, i18n-marked)
├── manifest.json               # PWA manifest
├── sw.js                       # Service worker (offline cache v4)
├── css/styles.css              # All styling incl. RTL + mobile
├── js/
│   ├── app.js                  # Main application logic
│   ├── storage.js              # IndexedDB wrapper
│   ├── providers.js            # Provider/key management
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
