# Callout Control for Obsidian

![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)
![Obsidian v1.5+](https://img.shields.io/badge/obsidian-1.5%2B-blueviolet)
![Release v1.0.3](https://img.shields.io/badge/release-v1.0.3-green)

> Toggle, collapse, and expand callouts with keyboard shortcuts in Obsidian

**Callout Control** lets you quickly toggle, collapse, or expand Obsidian callouts using keyboard commands—making your notes cleaner and your workflow faster.

## 🚀 Quick Start

1. Install the plugin from GitHub (see [Installation](#-installation) below)
2. Enable it in Community Plugins
3. Open a note with callouts in Obsidian
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
- [Changelog](#-changelog)

## ✨ Features

**Callout Control** gives you keyboard shortcuts to efficiently work with callouts in Obsidian:

- **Control callouts at different scopes:**
  - Individual callout under your cursor
  - All callouts in the current section
  - All callouts in the entire document

- **Choose between visual-only or Markdown updates:**
  - Visual mode changes appearance without modifying your document
  - Markdown mode syncs the visual state by updating `+`/`-` markers in your document

- **Smart callout identification for visual commands:**
  - Reliably identifies the correct callout even when multiple callouts have identical text
  - Uses precise position tracking to target the intended callout
  - Shows helpful notifications when no callouts are found

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

> **Note:** Only commands that are enabled in the settings panel will appear in the hotkeys list. If you don't see a command you want to assign a hotkey to, make sure it's enabled in **Settings → Community Plugins → Callout Control → Settings**. See the [Configuration](#-configuration) section below for details on how to enable/disable specific commands and understand the command grouping structure (Current/Section/All).

### Using With Custom Callouts

This plugin works with both standard Obsidian callouts and any custom callouts you've added to your vault. As long as the callout follows Obsidian's syntax `> [!type]± Title`, it will be controllable.

### Performance Tips

- For best performance, use Markdown-updating commands when working with large documents
- When working with many callouts, section-based commands can be more efficient than toggling all callouts
- Consider collapsing callouts in sections you're not actively working on to improve editor performance

## 🧮 Commands

Callout Control provides commands that affect callouts at different scopes, with options for both visual-only changes and Markdown updates.

### Command Organization

The plugin organizes commands by two main factors:
1. **Scope** - which callouts are affected (Current, Section, or All)
2. **Modification Type** - how changes are applied:
   - **Markdown commands** - update both the visual state and the underlying Markdown
   - **Visual-only commands** - only change the appearance without altering your document

Each command is available in the Command Palette with a descriptive name indicating its scope and behavior.

### Available Commands

The following commands are available in the plugin:

#### Current Callout (Markdown)
- **Toggle Current**: Toggle the collapse state of the current callout.
- **Collapse Current**: Collapse the current callout.
- **Expand Current**: Expand the current callout.

#### Section Callouts (Markdown)
- **Toggle Section**: Toggle the collapse state of all callouts in the current section.
- **Collapse Section**: Collapse all callouts in the current section.
- **Expand Section**: Expand all callouts in the current section.
- **Flip Section**: Toggle the collapse state of each callout individually in the current section.

#### All Callouts (Markdown)
- **Toggle All**: Toggle the collapse state of all callouts in the document.
- **Collapse All**: Collapse all callouts in the document.
- **Expand All**: Expand all callouts in the document.
- **Flip All**: Toggle the collapse state of each callout individually in the document.

#### Current Callout (Visual Only)
- **Toggle Current (Visual)**: Toggle the collapse state of the current callout (visual mode only).
- **Collapse Current (Visual)**: Collapse the current callout (visual mode only).
- **Expand Current (Visual)**: Expand the current callout (visual mode only).

#### Section Callouts (Visual Only)
- **Toggle Section (Visual)**: Toggle the collapse state of all callouts in the current section (visual mode only).
- **Collapse Section (Visual)**: Collapse all callouts in the current section (visual mode only).
- **Expand Section (Visual)**: Expand all callouts in the current section (visual mode only).
- **Flip Section (Visual)**: Toggle the collapse state of each callout individually in the current section (visual mode only).

#### All Callouts (Visual Only)
- **Toggle All (Visual)**: Toggle the collapse state of all callouts in the document (visual mode only).
- **Collapse All (Visual)**: Collapse all callouts in the document (visual mode only).
- **Expand All (Visual)**: Expand all callouts in the document (visual mode only).
- **Flip All (Visual)**: Toggle the collapse state of each callout individually in the document (visual mode only).

## 🔄 Toggle Behavior

### Uniform Toggle
All affected callouts are set to the same state. For example:
- If the majority of callouts are collapsed, all will be expanded.
- If the majority are expanded, all will be collapsed.

This behavior is used by the **Toggle**, **Collapse**, and **Expand** commands.

### Individual Toggle
Each callout toggles to its opposite state:
- Collapsed callouts are expanded.
- Expanded callouts are collapsed.

This behavior is used by the **Flip** commands.

> **Note:** Use **Flip** commands for individual toggling and **Toggle** commands for uniform behavior.

## 📊 Examples

### Callout Control in Action
![Callout Control Demo](https://github.com/MikeDSmith/obsidian-callout-control/raw/main/demo/toggle-all-uniform.gif)

## ⚙️ Configuration

Callout Control includes a settings panel that allows you to enable or disable specific commands based on your workflow preferences.

### Settings Panel

The settings panel is organized for easy navigation and customization:

1. **Group Structure**:
   - Commands are organized into three expandable groups: Current, Section, and All
   - Each group has a description explaining which callouts will be affected
   - Groups can be enabled/disabled as a whole with a single toggle

2. **Command Toggles**:
   - Within each group, individual commands have their own toggles
   - Commands are separated into Markdown and Visual-only categories 
   - Each command has a description explaining exactly what it does

3. **Interface Features**:
   - Visual grouping with borders to clearly separate different command categories
   - Enable/disable many commands at once with group toggles
   - Changes take effect immediately, updating the Command Palette in real-time

To find the settings panel, go to **Settings → Community Plugins → Callout Control → Settings**.

> **Note for Hotkey Users:** Commands that are disabled in the settings panel will not appear in the Command Palette or in the hotkeys list. When setting up hotkeys (see [Setting Up Hotkeys](#setting-up-hotkeys) above), ensure the commands you want to use are enabled here first.

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

1. **Commands not working in certain modes**
   - Markdown-updating commands work in Live Preview and Source modes
   - Visual toggling works in Live Preview and Reading View modes

2. **Not all callouts are toggled**
   - Due to Obsidian's virtual scrolling, off-screen callouts must be scrolled into view
   - Use Markdown-updating commands to affect all callouts regardless of scroll position

3. **Commands not appearing in Command Palette or Hotkeys**
   - Check that the commands are enabled in the [Configuration](#-configuration) settings panel
   - Try reloading Obsidian if settings changes don't take effect immediately

4. **Multiple callouts with identical text**
   - The plugin's visual commands can now correctly identify callouts even when they have identical text
   - For best results, place your cursor near the specific callout you want to target
   - Note that markdown commands always worked correctly with identical callouts since they operate based on line numbers

5. **Plugin conflicts**
   - If you experience issues, try disabling other callout-related plugins temporarily

## ✅ Compatibility

- Requires Obsidian **v1.5+**
- Markdown-updating functionality works in **Live Preview** and **Source** modes
- Visual toggle functionality works in **Live Preview** and **Reading View** modes

## 🙋 Support

- Submit issues on [GitHub](https://github.com/MikeDSmith/obsidian-callout-control/issues)

## 📝 License

[MIT License](LICENSE)

## 📋 Changelog

See the full [Changelog](CHANGELOG.md) for detailed version history.

---

Developed by **Mike D. Smith** with assistance from ChatGPT and Claude for brainstorming, implementation, and documentation.