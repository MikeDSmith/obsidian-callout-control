const { Plugin } = require('obsidian');
// Callout Control Plugin v1.0.0

// Obsidian plugin that visually toggles, collapses, or expands callouts in Live Preview.
// Does not modify the actual Markdown content.

module.exports = class CalloutControlPlugin extends Plugin {
  onload() {
    // Register command to toggle visible callouts
    this.addCommand({
      id: 'toggle-callouts.toggle',
      name: 'Toggle',
      callback: () => {
        this.processCallouts('toggle');
      }
    });

    // Register command to collapse visible callouts
    this.addCommand({
      id: 'toggle-callouts.collapse',
      name: 'Collapse',
      callback: () => {
        this.processCallouts('collapse');
      }
    });

    // Register command to expand visible callouts
    this.addCommand({
      id: 'toggle-callouts.expand',
      name: 'Expand',
      callback: () => {
        this.processCallouts('expand');
      }
    });
  }
  // Toggle/collapse/expand callouts currently visible in the DOM (Live Preview only)
  processCallouts(mode) {
    const root = this.app.workspace.activeEditor?.containerEl;
    if (!root) return;

    const callouts = root.querySelectorAll('.callout');
    if (!callouts.length) return;

    // Determine if we should collapse or expand based on mode.
    // For 'toggle', invert the first callout's current state.
    // For 'collapse' and 'expand', return true or false respectively.
    const shouldCollapse =
      mode === 'toggle'
        ? !callouts[0].classList.contains('is-collapsed')
        : mode === 'collapse';

    try {
      // Apply the visual state change to each rendered callout
      callouts.forEach((callout) => {
        const content = callout.querySelector('.callout-content');
        const foldIcon = callout.querySelector('.callout-fold');

        if (shouldCollapse) {
          callout.classList.add('is-collapsed');
          foldIcon?.classList.add('is-collapsed');
          if (content) content.setAttribute('style', 'display: none;');
        } else {
          callout.classList.remove('is-collapsed');
          foldIcon?.classList.remove('is-collapsed');
          if (content) content.setAttribute('style', '');
        }
      });
    } catch (err) {
      // Prevent plugin crashes on unexpected DOM errors
      console.error("Toggle Callouts Plugin error:", err);
    }
  }
};