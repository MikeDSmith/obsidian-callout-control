# 🔽 Callout Control — Obsidian Plugin

![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)
![Obsidian v1.5+](https://img.shields.io/badge/obsidian-1.5%2B-blueviolet)

**Callout Control** is a lightweight plugin for [Obsidian](https://obsidian.md) that lets you quickly **toggle, collapse, or expand** callouts directly in **Live Preview** — all using keyboard commands.

Control can be applied:
- 🎯 **Uniformly** — All callouts follow the same state (e.g., expand all)
- 🎛️ **Individually** — Each callout is toggled based on its own current state

---

## ✨ Features

> ✅ Visual toggling works in **Live Preview** mode only.  
> ✏️ Markdown-updating commands work in **any editing mode**, including Source Mode.

- Toggle, collapse, or expand:
  - All visible callouts
  - Only the callout under your cursor
  - All callouts in the current section
- Use different commands to apply:
  - 🎯 **Uniform behavior** — All callouts follow the same state
  - 🎛️ **Individual behavior** — Each callout toggles independently based on its current state
- Optional: sync visual state to Markdown by updating `+` / `-` after the callout tag
- Purely visual (DOM-based), unless you choose to update the Markdown

> ⚠️ **Visual commands** only affect callouts currently rendered on screen.  
> Off-screen callouts must be scrolled into view due to Obsidian’s virtual scrolling.  
> ✏️ **Markdown commands** update the entire file and work regardless of scroll position.

---

## 🧮 Command Overview

| Scope   | Action   | Visual Only                      | With Markdown                              |
|---------|----------|----------------------------------|---------------------------------------------|
| All     | Toggle   | Toggle All Callouts (Uniform)    | Toggle All Callouts (Individually)          |
| All     | Collapse | Collapse All Callouts (Uniform)  | Collapse All Callouts (Uniform)             |
| All     | Expand   | Expand All Callouts (Uniform)    | Expand All Callouts (Uniform)               |
| Current | Toggle   | Toggle Current Callout           | Toggle Current Callout (with Markdown)      |
| Current | Collapse | Collapse Current Callout         | Collapse Current Callout (with Markdown)    |
| Current | Expand   | Expand Current Callout           | Expand Current Callout (with Markdown)      |
| Section | Toggle   | Toggle Section Callouts          | Toggle Section Callouts (with Markdown)     |
| Section | Collapse | Collapse Section Callouts        | Collapse Section Callouts (with Markdown)   |
| Section | Expand   | Expand Section Callouts          | Expand Section Callouts (with Markdown)     |

---

## 🔄 Toggle Behavior

| Mode              | Description                                                                |
|-------------------|----------------------------------------------------------------------------|
| 🎯 **Uniform**     | All affected callouts are set to the same state (e.g., all collapsed)      |
| 🎛️ **Individual** | Each callout toggles based on its current state (expanded ↔ collapsed)     |

> 🔍 **Note on Toggle All (with Markdown):**  
> Unlike the visual toggle (which applies a uniform state), the markdown version toggles each callout based on its own current state (`+` or `-`).  
> This allows for fine-grained toggling but can result in a mix of expanded and collapsed callouts.  
> This is the current behavior and may be refined in future updates based on user feedback.

Uniform behavior is ideal for quickly resetting or focusing; individual is ideal for browsing and interaction.

---

## 🎹 Example Hotkeys

These are the hotkeys used by the author:

- 🔽 Collapse: `Shift` + `Cmd` + `<`
- 🔼 Expand: `Shift` + `Cmd` + `>`
- 🔁 Toggle: `Shift` + `Cmd` + `/`

You can customize hotkeys under  
**Settings → Community Plugins → Hotkeys → Callout Control**

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

## ✅ Compatibility

- Requires Obsidian **v1.5+**
- Supports **Live Preview** mode only

---

## 📘 Learn More

To learn more about installing and managing Obsidian community plugins, see the official docs:  
[Obsidian Community Plugins Guide](https://help.obsidian.md/Plugins/Community+plugins)

---

## 🙌 Author

Created by **Mike D. Smith**

---

## 🤝 Acknowledgements

- Built with the assistance of **ChatGPT** for brainstorming, implementation, and documentation refinement.

---

## 📝 License

[MIT License](LICENSE)
