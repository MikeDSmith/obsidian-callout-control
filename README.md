# Callout Control for Obsidian

![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)
![Obsidian v1.5+](https://img.shields.io/badge/obsidian-1.5%2B-blueviolet)
![Release v1.0.1](https://img.shields.io/badge/release-v1.0.1-green)

> Control callouts with keyboard shortcuts in Obsidian's Live Preview mode

**Callout Control** lets you quickly toggle, collapse, or expand Obsidian callouts using keyboard commands—making your notes cleaner and your workflow faster.

## 🚀 Quick Start

1. Install the plugin and enable it in Community Plugins
2. Open a note with callouts in Live Preview mode
3. Use the Command Palette (`Ctrl/Cmd+P`) and search for "Callout Control"
4. Try the "Toggle Current Callout" command when your cursor is near a callout

## 📋 Table of Contents

- [Features](#-features)
- [Installation](#-installation)
- [Usage](#-usage)
- [Commands](#-commands)
- [Toggle Behavior](#-toggle-behavior)
- [Examples](#-examples)
- [Configuration](#-configuration)
- [FAQ](#-faq)
- [Troubleshooting](#-troubleshooting)
- [Compatibility](#-compatibility)
- [Support](#-support)
- [License](#-license)

## ✨ Features

- **Toggle, collapse, or expand callouts** with keyboard shortcuts:
  - All visible callouts at once
  - Only the callout under your cursor
  - All callouts in the current section

- **Command behaviors:**
  - **Uniform behavior:** Commands that apply the same state to all affected callouts
  - **Individual behavior:** Commands that toggle each callout based on its current state
  
- **Visual or Markdown updates:**
  - Visual-only changes (appearance only)
  - Markdown updates (sync visual state by updating `+`/`-` markers)

> **Note:** Visual commands affect only callouts currently rendered on screen due to Obsidian's virtual scrolling. Markdown commands work regardless of scroll position.

## 🔌 Installation

The plugin is currently in development and not yet available in the Obsidian Community Plugins browser.

### From GitHub

1. Download the [latest release](https://github.com/MikeDSmith/obsidian-callout-control/releases) or download directly: [v1.0.1](https://github.com/MikeDSmith/obsidian-callout-control/releases/download/v1.0.1/obsidian-callout-control-v1.0.1.zip)
2. Create a folder in your vault's plugin directory: `.obsidian/plugins/obsidian-callout-control/`
3. Extract `main.js` and `manifest.json` into that folder
4. In Obsidian, go to **Settings → Community Plugins**, click **Reload plugins** and enable **Callout Control**

> **Note:** This plugin is not yet available in the Obsidian Community Plugins browser. Once approved, you'll be able to install it directly from within Obsidian.

## 🚀 Usage

After installation, you can:

1. Use the Command Palette (`Ctrl/Cmd+P`) and search for "Callout Control" commands
2. Set up keyboard shortcuts in **Settings → Hotkeys → Callout Control**

### Recommended Hotkeys

Consider setting up these keyboard shortcuts for efficient workflow:
- **Collapse:** `Shift` + `Cmd` + `<`
- **Expand:** `Shift` + `Cmd` + `>`
- **Toggle:** `Shift` + `Cmd` + `/`

### Using With Custom Callouts

This plugin works with both standard Obsidian callouts and any custom callouts you've added to your vault. As long as the callout follows Obsidian's syntax `> [!type]± Title`, it will be controllable.

### Performance Tips

- For best performance, use Markdown-updating commands when working with large documents
- When working with many callouts, section-based commands can be more efficient than toggling all callouts
- Consider collapsing callouts in sections you're not actively working on to improve editor performance

## 🧮 Commands

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

## 🔄 Toggle Behavior

| Behavior Type | Description                                                   |
|---------------|---------------------------------------------------------------|
| **Uniform**   | All affected callouts are set to the same state (used by most commands) |
| **Individual** | Each callout toggles based on its current state (`+` or `-`) (used only by "Toggle All Callouts (Individually)" command) |

> **Note on Toggle All (with Markdown):** Unlike the visual toggle (which applies a uniform state), the markdown version toggles each callout based on its own current state. This allows for more nuanced control but can result in a mix of expanded and collapsed callouts.

## 📊 Examples

### Toggle All Callouts (Uniform)
![Toggle All Callouts Uniform](https://github.com/MikeDSmith/obsidian-callout-control/raw/main/demo/toggle-all-uniform.gif)

### Toggle All Callouts (Individual)
![Toggle All Callouts Individual](https://github.com/MikeDSmith/obsidian-callout-control/raw/main/demo/toggle-all-individual.gif)

### Toggle Current Callout
![Toggle Current Callout](https://github.com/MikeDSmith/obsidian-callout-control/raw/main/demo/toggle-current.gif)

### Toggle Section Callouts
![Toggle Section Callouts](https://github.com/MikeDSmith/obsidian-callout-control/raw/main/demo/toggle-section.gif)

## ⚙️ Configuration

Currently, Callout Control has no configuration settings. All functionality is accessible through commands.

## ❓ FAQ

### How does "Section" mode work?
The section mode affects all callouts between the current heading and the next heading of the same or higher level. If there are no headings in your document, it affects all callouts.

### Do I need to restart Obsidian after installation?
No, just enable the plugin in the Community Plugins settings.

### Will this plugin work with other callout-related plugins?
Yes, in most cases. Callout Control operates on the standard callout formatting in Obsidian.

### Does this plugin support nested callouts?
The plugin works with nested callouts by operating on the parent callout only. When you toggle, collapse, or expand a callout that contains nested callouts inside it, the command applies to the entire parent callout structure in both visual and markdown modes.

## ❓ Troubleshooting

### Common Issues

1. **Commands not working in Source mode**
   - Visual toggling works only in Live Preview mode
   - Markdown-updating commands work in any editing mode

2. **Not all callouts are toggled**
   - Due to Obsidian's virtual scrolling, off-screen callouts must be scrolled into view
   - Use Markdown-updating commands to affect all callouts regardless of scroll position

3. **Plugin conflicts**
   - If you experience issues, try disabling other callout-related plugins temporarily

## ✅ Compatibility

- Requires Obsidian **v1.5+**
- Visual toggle functionality works in **Live Preview** mode only
- Markdown-updating functionality works in all editing modes

## 🙋 Support

- Submit issues on [GitHub](https://github.com/MikeDSmith/obsidian-callout-control/issues)

## 📝 License

[MIT License](LICENSE)

---

Developed by **Mike D. Smith** with assistance from ChatGPT and Claude for brainstorming, implementation, and documentation.