# Changelog

## [1.0.3] - 2025-05-05

### Added
- New settings panel to enable/disable specific commands
- Command registry system for better organization
- Data attributes to callout DOM elements for more reliable operation
- New `Callout` class with improved object model
- Factory function for callout operations
- Structured error handling and logging

### Changed
- Major code refactoring into modular classes:
  - `CalloutParser` for improved markdown callout detection
  - `CalloutMarkdownService` for document manipulation
  - `DOMCalloutService` for visual changes
  - `PluginSettings` for settings management
  - `CommandRegistry` for command registration
  - `ErrorHandler` for consistent error handling
- Improved detection and handling of nested callouts
- Enhanced matching between DOM elements and Markdown callouts 
- Better section detection with more accurate boundaries
- Renamed commands for better clarity:
  - "Toggle All Callouts (Individually)" is now "Flip All"
  - Added consistent naming across all command groups
- Optimized DOM operations for better performance

### Removed
- Visual-only commands for current callout scope:
  - "Toggle Current Callout (Visual Only)"
  - "Collapse Current Callout (Visual Only)" 
  - "Expand Current Callout (Visual Only)"
- These were consolidated into the Markdown versions which provide both visual and Markdown updates

### Fixed
- More reliable correlation between markdown and visual elements
- Better handling of edge cases with off-screen callouts
- Improved error handling to prevent crashes

## [1.0.2] - 2024-05-01

### Added
- Comprehensive code refactoring with new classes:
  - `ObsidianCalloutDetector` for markdown callout parsing
  - `CalloutMatcher` to bridge DOM elements with markdown
- Support for nested callouts detection and handling
- Improved callout targeting with precise cursor positioning
- Demonstration GIFs in README showing plugin functionality
- Expanded documentation with:
  - Quick start guide
  - Table of contents
  - Installation instructions
  - Usage examples and recommended hotkeys
  - FAQ and troubleshooting sections
  - Compatibility information

### Changed
- Extensively improved callout detection algorithm
- Enhanced section detection for more accurate scoping
- Refined command labels for clarity (e.g., "Toggle Current Callout (Visual Only)")
- Optimized DOM operations for better performance
- Updated README with clearer organization and visual examples
- Improved error handling for more robust operation

## [1.0.1] - 2024-04-30

### Added
- New commands for toggling, collapsing, and expanding callouts:
  - Supports **current**, **section**, and **all** scopes
  - Available for both **visual Live Preview** and **markdown-synced** modes
- Introduced support for **uniform vs. individual** toggle behavior

### Changed
- Improved command naming and labeling for clarity (e.g., "Toggle All Callouts (Uniform)" vs. "(Individual)")
- Added utility functions to simplify and optimize callout DOM manipulation
- Centralized command registration using a reusable helper function
- Significantly expanded and refined the README:
  - Added a full command overview table
  - Explained toggle behavior with examples
  - Clarified Live Preview vs. markdown applicability

### Removed
- Inline version comment from `main.js` (now tracked via Git and manifest)

## [1.0.0] - 2024-04-30

### Added
- Initial public release of the Callout Control plugin.
- Toggle all visible callouts between collapsed and expanded.
- Collapse all visible callouts.
- Expand all visible callouts.
- Keyboard-accessible commands with hotkey support.
- DOM-only behavior that visually affects Live Preview without modifying markdown content.