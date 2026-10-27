<p align="center">
  <a href="https://github.com/Tiane-ira/my-post">
    <img src="public/icon.png" width="108" height="108" alt="mypost logo">
  </a>
</p>

<h1 align="center">mypost</h1>

<p align="center">
  <strong>A lightweight, local-first, privacy-focused API development and debugging workbench.</strong><br>
  <em>The pure offline Postman & Apifox alternative · No Login · No Cloud Sync · No Telemetry · 100% Local Plaintext JSON</em>
</p>

<p align="center">
  <a href="README.md">简体中文</a> | <a href="README_EN.md">English</a>
</p>

<p align="center">
  <a href="https://github.com/Tiane-ira/my-post/releases"><img src="https://img.shields.io/github/v/release/Tiane-ira/my-post?color=FA8C16&style=flat-square" alt="GitHub release"></a>
  <a href="https://github.com/Tiane-ira/my-post/blob/main/LICENSE"><img src="https://img.shields.io/github/license/Tiane-ira/my-post?style=flat-square&color=blue" alt="License"></a>
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-blue?style=flat-square" alt="Platform">
  <img src="https://img.shields.io/badge/Privacy-100%25%20Local-success?style=flat-square" alt="Privacy">
  <img src="https://img.shields.io/badge/Zero-Telemetry-brightgreen?style=flat-square" alt="Zero Telemetry">
  <a href="https://github.com/Tiane-ira/my-post/stargazers"><img src="https://img.shields.io/github/stars/Tiane-ira/my-post?style=flat-square&color=FA8C16" alt="Stars"></a>
  <a href="https://github.com/Tiane-ira/my-post/network/members"><img src="https://img.shields.io/github/forks/Tiane-ira/my-post?style=flat-square" alt="Forks"></a>
  <a href="https://github.com/Tiane-ira/my-post/issues"><img src="https://img.shields.io/github/issues/Tiane-ira/my-post?style=flat-square" alt="Issues"></a>
</p>

---

## 💡 Why mypost?

Modern API clients are increasingly bloated with mandatory cloud sync, required accounts, and aggressive team subscription paywalls:
- ❌ **Mandatory Account & Internet**: Broken when offline, on planes, or inside air-gapped corporate networks.
- ❌ **Privacy & Security Hazards**: Private endpoints, production tokens, authorization headers, and cookies quietly uploaded to third-party cloud servers.
- ❌ **Bloated & Sluggish**: Annoying popups, high memory footprint, and sluggish startup times.
- ❌ **Proprietary Vendor Lock-in**: Hard to export, impossible to cleanly version-control with standard Git workflows.

> **Our Philosophy:**  
> **mypost** is built to be a fast, modern, and completely local workbench owned 100% by you.  
> **No login, no internet required, zero tracking**, storing all your projects and endpoints directly on your filesystem as **standard, human-readable JSON files**.

---

## ⚡ Feature Comparison

| Features | 🚀 **mypost** | **Postman** | **Apifox** | **Bruno** |
| :--- | :---: | :---: | :---: | :---: |
| **Account / Login** | 🟢 **Never required** | 🔴 Mandatory | 🔴 Mandatory | 🟢 Never required |
| **Data Storage** | 📂 **Standard Plain JSON** | ☁️ Proprietary Cloud DB | ☁️ Proprietary Cloud DB | 📝 Custom `.bru` files |
| **Git Collaboration** | 🟢 **Native (Folders = Projects)** | 🟡 Paid Team plans | 🟡 Cloud team sync | 🟢 Git friendly |
| **Air-gapped / Offline** | 🔒 **100% Offline** | 🔴 Severely limited | 🔴 Not usable offline | 🔒 Offline ready |
| **Telemetry & Privacy** | 🔒 **Zero telemetry** | 🔴 Heavy tracking | 🔴 Heavy tracking | 🔒 Minimal |
| **HTTP / HTTPS Debugging** | 🟢 Full (with raw wire inspector) | 🟢 Supported | 🟢 Supported | 🟢 Supported |
| **SSE Streaming (LLMs)** | 🟢 **Card / Raw Views + Ring Buffer** | 🟡 Basic | 🟡 Basic | 🟡 Basic |
| **WebSocket Workbench** | 🟢 **Split Panel + Auto Ping + Frame Seq** | 🟡 Basic window | 🟡 Basic | 🟡 Plugin needed |
| **OpenAPI / Swagger** | 🟢 **Full parsing with $ref resolving** | 🟢 Supported | 🟢 Supported | 🟡 Partial |
| **Cross-Platform & Linux** | 🟢 **Windows, macOS & Linux (Skia engine)** | 🔴 Dependency crashes | 🟡 Closed binary | 🟡 Generic Linux |
| **Pricing** | 🆓 **100% Free & Open Source (MIT)** | 💰 Expensive per-seat | 💰 Commercial tiers | 🟡 Dual-license |

---

## 📥 Download & Installation

Pre-built binaries are automatically compiled and published through GitHub Actions:

👉 **[Download the Latest Release on GitHub](https://github.com/Tiane-ira/my-post/releases/latest)**

| Platform | Recommended Package | Notes |
| :--- | :--- | :--- |
| **Windows** | `mypost-Setup-x.x.x-win-x64.exe`<br>`mypost-x.x.x-win-x64-portable.exe` | Standard NSIS installer or standalone portable executable (no install needed). |
| **macOS** | `mypost-x.x.x-mac-arm64.dmg`<br>`mypost-x.x.x-mac-arm64.zip` | Optimized for Apple Silicon (M1/M2/M3/M4 chips). |
| **Linux** | `mypost-x.x.x-linux-x64.AppImage`<br>`mypost_x.x.x_amd64.deb` | Skia software rendering by default, zero black screen on Ubuntu, Debian, Arch, and Wayland. |

---

## 🌟 Key Features

### 1. 📂 Pure Local Plaintext JSON Storage
- **Transparent Directory Hierarchy**:
  ```
  ~/.mypost/projects/<project_id>/   (or any directory you choose)
  ├── project.json                   # Project metadata and configurations
  ├── tree.json                      # Folder structure and API tree relationships
  ├── envs.json                      # Environment variables and global values
  └── apis/                          # Plaintext endpoint configurations
      ├── api-1729178000000.json     # Request URL, headers, body, auth & tests
      └── api-1729178000001.json
  ```
- **Git Native**: Initialize the project directory as a Git repository. Commit, branch, merge, and pull request your API specs just like source code.
- **Project Lifecycle Management**: Easily switch between multiple local projects, edit project name and descriptions at any time, and choose between unbinding from mypost or permanently purging project files from local disk.
- **Effortless Migration**: Backup or move to a new machine by simply copying the folder.

### 2. 🚀 Comprehensive HTTP / HTTPS Engine
- **All Methods**: GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS, etc.
- **Flexible Request Bodies**: `none`, `form-data` (with file upload), `x-www-form-urlencoded`, `json` (with syntax highlighting and formatting), `raw` (XML / text), `binary`.
- **Built-in Authentication**: Bearer Token, Basic Auth, API Key (Header or Query param injection).
- **Pre-request Scripts & Test Assertions**: Lightweight, secure sandbox to compute dynamic signatures, extract tokens, or validate response payloads.
- **Raw Wire Request Inspector**: View the actual underlying raw packet sent over the network after redirects, header completion, and variable resolutions.

### 3. 🌊 SSE (Server-Sent Events) Streaming
*Crafted for LLM streaming responses (OpenAI ChatGPT, Anthropic Claude, DeepSeek, etc.)*
- **Card & Raw Dual Views**:
  - **Formatted Card View**: Formatted JSON data blocks, event-type highlighting, filterable badges, expandable payloads.
  - **Raw Protocol View**: Direct line-by-line inspection of `event:`, `data:`, `id:` frames.
- **Ring Buffer Flow Control**: Built-in circular buffer (FIFO discard) prevents UI rendering freezes even under thousands of streaming events.
- **Persistent Background Streaming**: Switching tabs keeps the connection alive; only closing the tab disconnects.

### 4. 🔌 WebSocket Full-Duplex Workbench
- **Broad Protocol Support**: `ws://` and `wss://` encrypted sockets with custom connection headers and subprotocols (`Sec-WebSocket-Protocol`).
- **Draggable Split Screen**: Smoothly resize the handshake and message sending panels with double-click reset.
- **Automated Heartbeat Ping**: Configure auto-ping intervals and payloads to maintain persistent connections.
- **Message Stream Filtering & Search**: Directional badges (Sent vs Received), live keyword search, and JSON beautifier.
- **Frame Sequence Integrity**: Guaranteed `#seq` tracking even when older messages are trimmed by the buffer.

### 5. 🧩 Dynamic Variable Interpolation (`{{variable}}`)
- **Global Availability**: Supported across URLs, Query Params, Headers, Body, and WebSocket targets.
- **Auto-complete Popover**: Typing `{{` triggers instant variable suggestions with keyboard navigation.
- **Hover Evaluation Preview**: Hover over any variable badge to immediately inspect its runtime value and scope.
- **Nested Resolution**: Variables can reference other variables (e.g., `{{baseUrl}}` referencing `{{domain}}:{{port}}`).

### 6. 🔄 Seamless Import, Export & Sharing
- **Versatile Importers**:
  - Import raw **cURL** commands directly.
  - Import **Postman Collection v2 / v2.1** files.
  - Import **Swagger 2.0** and **OpenAPI 3.0 / 3.1** (JSON & YAML) with automatic `$ref` dereferencing.
- **Export & Share**:
  - One-click export to clean **Markdown** documentation.
  - Generate offline API bundles for sharing across engineering teams.

---

## ⌨️ Common Keyboard Shortcuts

| Shortcut | Description |
| :--- | :--- |
| **`Ctrl + Enter`** (Mac: `⌘ + Enter`) | Send current HTTP request / Send WebSocket message |
| **`Ctrl + S`** (Mac: `⌘ + S`) | Save current API configuration (writes directly to local JSON) |
| **`Ctrl + W`** (Mac: `⌘ + W`) | Close current tab (gracefully closes active SSE/WS connections) |

---

## 🐧 Linux & Air-Gapped Environments

mypost is deeply optimized for modern Linux distributions and air-gapped corporate servers:
- **No Black Screen / Skia Engine**: Uses CPU software rendering by default to completely avoid GPU driver crashes on Wayland, virtual machines (VMware, VirtualBox), or proprietary graphics drivers.  
  *(To force GPU hardware acceleration, launch with `./mypost.AppImage --enable-gpu`)*
- **AppImage Execution**:
  ```bash
  chmod +x mypost-*.AppImage
  ./mypost-*.AppImage
  ```
- **Debian / Ubuntu Package**:
  ```bash
  sudo dpkg -i mypost_*_amd64.deb || sudo apt-get install -f
  ```

---

## 🔒 Privacy & Security

- **100% Offline Capability**: Runs seamlessly without any active internet connection.
- **Zero Telemetry**: No tracking, no user analytics, no phone-home mechanisms.
- **Credentials Stay Local**: API keys, Bearer tokens, passwords, and sensitive endpoints are strictly saved on your local drive and nowhere else.

---

## 🛠️ Development & Building

Contributions are welcome!

### Prerequisites
- Node.js >= 24.0.0
- npm >= 9.0.0

### Local Setup
```bash
# Clone the repository
git clone https://github.com/Tiane-ira/my-post.git
cd my-post

# Install dependencies
npm install

# Start local development client
npm run dev

# Run automated tests
npm test
```

### Packaging
```bash
# Package for Windows
npm run package:win

# Package for macOS
npm run package:mac

# Package for Linux
npm run package:linux
```
Output bundles will be generated in the `release/` directory.

---

## ❓ Frequently Asked Questions (FAQ)

<details>
<summary><b>Q1: Why doesn't mypost offer cloud sync?</b></summary>
Most developers and security-conscious companies dislike cloud tools uploading internal credentials and API schemas to third-party servers. mypost's mission is to remain an uncompromisingly pure, local-first client. If you want sync, you can easily use Git, Syncthing, Nextcloud, or Dropbox to sync the plaintext directory with zero vendor lock-in.
</details>

<details>
<summary><b>Q2: How does mypost differ from Bruno?</b></summary>
Bruno uses a proprietary DSL (<code>.bru</code> files), whereas mypost uses <b>standard plaintext JSON files</b>, making it instantly consumable by custom scripts, CI/CD, and external utilities. Furthermore, mypost provides dedicated, first-class experiences for <b>SSE streaming (AI/LLMs)</b> and <b>WebSocket workflows</b> with split-panel ergonomics, auto-heartbeat, and memory-safe ring buffers.
</details>

---

## 🗺️ Roadmap

- [x] Full HTTP/HTTPS methods and dynamic payload configuration
- [x] SSE streaming debugging (dual views + ring buffer flow control)
- [x] WebSocket full-duplex client (auto-heartbeat + sequence tracking)
- [x] OpenAPI / Swagger / cURL lossless import & Markdown export
- [x] Dynamic variable system with `{{variable}}` auto-complete
- [x] Robust Linux support with zero black-screen issues
- [ ] Code generation (cURL, Python, Fetch, Go, Java snippets)
- [ ] gRPC / Protobuf debugging support
- [ ] Automated batch runner and scheduled collection testing
- [ ] Lightweight local Mock Server

---

## 🤝 Community & Contributing

Issues, feature suggestions, and pull requests are warmly welcomed!

If you find **mypost** helpful, please star ⭐️ this repository to support its growth!

<p align="center">
  <a href="https://star-history.com/#Tiane-ira/my-post&Date">
    <img src="https://api.star-history.com/svg?repos=Tiane-ira/my-post&type=Date" alt="Star History Chart">
  </a>
</p>

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
