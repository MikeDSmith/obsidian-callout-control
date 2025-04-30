# 🔽 Callout Control — Obsidian Plugin

![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)
![Obsidian v1.5+](https://img.shields.io/badge/obsidian-1.5%2B-blueviolet)

**Callout Control** is a lightweight plugin for [Obsidian](https://obsidian.md) that visually toggles, collapses, or expands visible callouts in **Live Preview** mode, allowing you to quickly control all callouts using the keyboard — no mouse clicks required.

---

## ✨ Features

_Note: This plugin is designed for **Live Preview mode** only._

- 🔁 **Toggle** — Toggle all currently visible callouts between expanded and collapsed states.
- 🔽 **Collapse** — Collapse all visible callouts.
- 🔼 **Expand** — Expand all visible callouts.
- 🖼️ Purely visual: DOM manipulation only, with no impact on your note files.

> ⚠️ Only affects callouts currently rendered on screen. Due to Obsidian’s virtual scrolling, off-screen callouts may not be toggled unless scrolled into view.

---

## 🧩 Installation

### Manual

1. Download or clone this repository.
2. Create a folder in your vault's plugin directory:
   ```
   .obsidian/plugins/obsidian-callout-control/
   ```
3. Copy only the following files into that folder:
   ```
   main.js
   manifest.json
   ```
4. In Obsidian:
   - Go to **Settings → Community Plugins**
   - Click **"Reload plugins"** or restart Obsidian
   - Find **Callout Control** in the list and enable it

---

## 🎹 Example Hotkeys

These are the hotkeys used by the author:

- 🔽 Collapse: `Shift` + `Cmd` + `<`
- 🔼 Expand: `Shift` + `Cmd` + `>`
- 🔁 Toggle: `Shift` + `Cmd` + `/`

Set your own under **Settings → Community Plugins → Hotkeys**.

---

## ✅ Compatibility

- Works in **Live Preview** mode (not Reading View).
- Tested with Obsidian v1.5 and higher.

---

## 📘 Learn More

To learn more about installing and managing Obsidian community plugins, see the official documentation:  
[Obsidian Community Plugins Guide](https://help.obsidian.md/Plugins/Community+plugins)

---

## 🤝 Contributing

Feedback, suggestions, and pull requests are welcome! Feel free to open an issue or submit improvements.

---

## 📝 License

[MIT License](LICENSE)

---

## 🙌 Author

Created by **Mike D. Smith**  
With help from ChatGPT
