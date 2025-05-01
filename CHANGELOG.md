# Changelog

## [1.0.0] - 2024-04-30

### Added
- Initial public release of the Callout Control plugin.
- Toggle all visible callouts between collapsed and expanded.
- Collapse all visible callouts.
- Expand all visible callouts.
- Keyboard-accessible commands with hotkey support.
- DOM-only behavior that visually affects Live Preview without modifying markdown content.

## [1.0.1] - 2024-04-30

### Added
- New commands for toggling, collapsing, and expanding callouts:
  - Supports **current**, **section**, and **all** scopes
  - Available for both **visual Live Preview** and **markdown-synced** modes
- Introduced support for **uniform vs. individual** toggle behavior

### Changed
- Improved command naming and labeling for clarity (e.g., “Toggle All Callouts (Uniform)” vs. “(Individual)”)
- Added utility functions to simplify and optimize callout DOM manipulation
- Centralized command registration using a reusable helper function
- Significantly expanded and refined the README:
  - Added a full command overview table
  - Explained toggle behavior with examples
  - Clarified Live Preview vs. markdown applicability

### Removed
- Inline version comment from `main.js` (now tracked via Git and manifest)

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