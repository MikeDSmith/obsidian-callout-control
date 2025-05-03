# Callout Control for Obsidian

![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)
![Obsidian v1.5+](https://img.shields.io/badge/obsidian-1.5%2B-blueviolet)
![Release v1.0.2](https://img.shields.io/badge/release-v1.0.2-green)

> Control callouts with keyboard shortcuts in Obsidian's Live Preview mode

**Callout Control** lets you quickly toggle, collapse, or expand Obsidian callouts using keyboard commands—making your notes cleaner and your workflow faster.

## 🚀 Quick Start

1. Install the plugin from GitHub (see [Installation](#-installation) below)
2. Enable it in Community Plugins
3. Open a note with callouts in Live Preview mode
4. Use the Command Palette (`Ctrl/Cmd+P`) and search for "Callout Control"
5. Try the "Toggle Current Callout" command when your cursor is near a callout

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

**Callout Control** gives you keyboard shortcuts to efficiently work with callouts in Obsidian:

- **Control callouts at different scopes:**
  - Individual callout under your cursor
  - All callouts in the current section
  - All callouts in the entire document

- **Choose between visual-only or Markdown updates:**
  - Visual mode changes appearance without modifying your document
  - Markdown mode syncs the visual state by updating `+`/`-` markers in your document

> **Note:** Visual commands affect only callouts currently rendered on screen due to Obsidian's virtual scrolling. Markdown commands work regardless of scroll position.

## 🔌 Installation

### Manual Installation (GitHub)

1. Download the [latest release](https://github.com/MikeDSmith/obsidian-callout-control/releases)
2. Create a folder in your vault's plugin directory: `.obsidian/plugins/obsidian-callout-control/`
3. Extract `main.js` and `manifest.json` into that folder
4. In Obsidian, go to **Settings → Community Plugins**, click **Reload plugins** and enable **Callout Control**

> **Note:** This plugin is currently in development and has not yet been submitted for inclusion in the Obsidian Community Plugins browser. Once development is complete and the plugin is approved, you'll be able to install it directly from within Obsidian.

## 🚀 Usage

After installation, you can:

1. Use the Command Palette (`Ctrl/Cmd+P`) and search for "Callout Control" commands
2. Set up keyboard shortcuts in **Settings → Hotkeys → Callout Control**

### Setting Up Hotkeys

For a more efficient workflow, consider assigning keyboard shortcuts to the commands you use most frequently:

1. Go to **Settings → Hotkeys**
2. Search for "Callout Control"
3. Click the plus icon next to any command to assign a hotkey

Choose hotkeys that feel intuitive to you and don't conflict with other commands you use regularly. Consider which callout operations you perform most often in your workflow and prioritize those for hotkey assignments.

> **Note:** Only commands that are enabled in the settings panel will appear in the hotkeys list. If you don't see a command you want to assign a hotkey to, make sure it's enabled in **Settings → Community Plugins → Callout Control → Settings**.

### Using With Custom Callouts

This plugin works with both standard Obsidian callouts and any custom callouts you've added to your vault. As long as the callout follows Obsidian's syntax `> [!type]± Title`, it will be controllable.

### Performance Tips

- For best performance, use Markdown-updating commands when working with large documents
- When working with many callouts, section-based commands can be more efficient than toggling all callouts
- Consider collapsing callouts in sections you're not actively working on to improve editor performance

## 🧮 Commands

Callout Control provides commands that affect callouts at different scopes, with options for both visual-only changes and Markdown updates.

### Command Types

- **Visual-only commands**: Change the appearance without updating the Markdown
- **Markdown commands**: Update the `+`/`-` markers in your document and change the appearance

### Command Actions

- **Toggle Uniformly**: Sets all affected callouts to the same state (based on the majority state)
- **Collapse/Expand**: Sets all affected callouts to collapsed or expanded state
- **Flip Individually**: Toggles each callout to its opposite state (expanded becomes collapsed, and vice versa)

### Available Commands

| Scope   | Action   | Visual Only Command                          | Markdown Command                             |
|---------|----------|----------------------------------------------|---------------------------------------------|
| All     | Toggle   | Toggle All Callouts Uniformly (Visual Only)  | Toggle All Callouts Uniformly (Markdown)    |
| All     | Collapse | Collapse All Callouts (Visual Only)          | Collapse All Callouts (Markdown)            |
| All     | Expand   | Expand All Callouts (Visual Only)            | Expand All Callouts (Markdown)              |
| All     | Flip     | Flip All Callouts Individually (Visual Only) | Flip All Callouts Individually (Markdown)   |
| Current | Toggle   | Toggle Current Callout (Visual Only)         | Toggle Current Callout (Markdown)           |
| Current | Collapse | Collapse Current Callout (Visual Only)       | Collapse Current Callout (Markdown)         |
| Current | Expand   | Expand Current Callout (Visual Only)         | Expand Current Callout (Markdown)           |
| Section | Toggle   | Toggle Section Callouts Uniformly (Visual Only) | Toggle Section Callouts Uniformly (Markdown) |
| Section | Collapse | Collapse Section Callouts (Visual Only)      | Collapse Section Callouts (Markdown)        |
| Section | Expand   | Expand Section Callouts (Visual Only)        | Expand Section Callouts (Markdown)          |
| Section | Flip     | Flip Section Callouts Individually (Visual Only) | Flip Section Callouts Individually (Markdown) |

## 🔄 Toggle Behavior

| Behavior Type | Description                                                   |
|---------------|---------------------------------------------------------------|
| **Uniform**   | All affected callouts are set to the same state (used by Toggle, Collapse, and Expand commands) |
| **Individual** | Each callout toggles based on its current state (`+` or `-`) (used by Flip commands) |

> **Note on Toggle Behavior:** Toggle commands now apply a uniform state to all affected callouts, meaning all callouts will end up in the same state (all expanded or all collapsed). For individual toggling (where each callout flips to its opposite state), use the new Flip commands.

## 📊 Examples

### Toggle All Callouts Uniformly
![Toggle All Callouts Uniform](https://github.com/MikeDSmith/obsidian-callout-control/raw/main/demo/toggle-all-uniform.gif)

### Flip All Callouts Individually
![Flip All Callouts Individual](https://github.com/MikeDSmith/obsidian-callout-control/raw/main/demo/toggle-all-individual.gif)

### Toggle Current Callout
![Toggle Current Callout](https://github.com/MikeDSmith/obsidian-callout-control/raw/main/demo/toggle-current.gif)

### Toggle Section Callouts
![Toggle Section Callouts](https://github.com/MikeDSmith/obsidian-callout-control/raw/main/demo/toggle-section.gif)

## ⚙️ Configuration

Callout Control includes a settings panel that allows you to enable or disable specific commands based on your workflow preferences.

### Settings Panel

To access the settings panel:
1. Go to **Settings → Community Plugins → Callout Control → Settings**
2. Use the toggles to enable or disable specific commands or entire command groups

The settings panel organizes commands into three main groups:
- **Current:** Commands that affect the callout under your cursor
- **Section:** Commands that affect callouts in the current section  
- **All:** Commands that affect all callouts in the document

Each group has toggles for both Visual and Markdown commands, allowing you to customize exactly which commands appear in your Command Palette.

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