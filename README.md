# API Key Manager

A privacy-first, offline-first web application for managing your API keys across multiple providers. Built as a PWA (Progressive Web App) using plain HTML/CSS/JS - no server required, and all data stays locally in your browser.

## Features

- 🔐 **All data stays local** — Nothing is sent to any server. API keys are stored in your browser's IndexedDB.
- 📱 **PWA Support** — Installable on mobile and desktop with offline capability.
- 🔄 **Multi-language & Persian-first** — Full Persian (FA) and English support with RTL layout.
- 📦 **Import/Export** — Backup your data as JSON or download it for safekeeping.
- 🔍 **Search** — Quickly find any provider or API key with global search.
- 🌙 **Dark/Light Theme** — Automatic and manual theme support.

## Supported Providers

### Included by Default

| Provider | Category | Models |
|----------|----------|--------|
| OpenAI | OpenAI | GPT-4o, GPT-4o-mini, GPT-3.5, GPT-4-turbo... |
| Anthropic | Anthropic | Claude 3.5 Sonnet, Claude 3 Haiku, Claude 3 Opus |
| Google AI | Google | Gemini 1.5 Pro, Gemini 1.5 Flash |
| Groq | AI Lab | Llama 3.1, Gemma2, Mixtral |
| DeepSeek | China | DeepSeek Chat, DeepSeek Code |
| Mistral AI | Europe | Mistral Large, Mistral Small |
| OpenRouter | Router | Multi-model aggregator |
| Together AI | Infra | Llama, Mixtral, WizardLM |
| Replicate | Infra | Custom |
| Hugging Face | OSS | Custom |
| Fireworks | Infra | Llama v3, Kimi |
| And more... | — | — |

### Note on API Keys

Keys are stored **in plain text locally** in IndexedDB. You can optionally export them to JSON for safekeeping. For security, always set a strong master password if the encryption option is available.

## Usage

### Running Locally

```bash
# Clone the repo
git clone https://github.com/mohsen-niksirat/API-Key-Manager
cd api-key-manager

# Start a local server (required for ES modules + Service Worker)
python -m http.server 8000

# Open http://localhost:8000 in your browser
```

### Installing as PWA

On mobile/desktop, open the site in Chrome/Safari/Edge and install via the browser's install prompt.

## Project Structure

```
api-key-manager/
├── index.html              # Main application entry
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker
├── css/
│ └── styles.css            # All styling
├── js/
│ ├── app.js                # Main application logic
│ ├── storage.js            # IndexedDB wrapper
│ └── providers.js          # Provider management & utilities
├── data/
│ └── default-providers.json # Default provider list
└── README.md
```

## Data Storage

- All data is stored in IndexedDB under the name `APIKeyManager`
- Providers are stored in the `providers` object store
- API keys are stored in the `api_keys` object store
- Settings (theme, auto-save) stored in the `settings` store

## Export/Import

You can export all your data to a JSON file from Settings, and re-import it later. This is useful for:
- Backing up your keys
- Migrating to a new device
- Restoring after browser reset

## Privacy & Security

This app follows a **zero-trust privacy model**:
- No server-side storage
- No backend required
- No tracking or analytics
- No external network calls except fetching default provider data
- All data remains in your browser

> ⚠️ **Security Notice**: This is a client-side tool. API keys are stored unencrypted locally by default. If your device is compromised or you share it with others, keys could be exposed. Always:
> - Use a separate browser profile for sensitive keys
> - Encrypt your export files with a third-party tool
> - Never commit your data file to public repositories

## Contributing

Contributions are welcome! Feel free to submit issues or pull requests.

## License

MIT License — [mohsen-niksirat](https://github.com/mohsen-niksirat) — Made with ❤️

---

Built with **HTML, CSS, JavaScript** — no frameworks. Just plain, fast, and reliable code.