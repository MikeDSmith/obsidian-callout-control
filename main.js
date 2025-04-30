const { Plugin } = require('obsidian');

// Obsidian plugin to toggle, collapse, or expand callouts in Live Preview,
// with optional syncing to Markdown (+/-) indicators.

function getCalloutTitleMap(root) {
  const callouts = root.querySelectorAll('.callout');
  const map = new Map();
  callouts.forEach(callout => {
    const titleEl = callout.querySelector('.callout-title-inner');
    const title = titleEl?.textContent?.trim();
    if (title) map.set(title, callout);
  });
  return map;
}

function applyCalloutCollapseState(callout, collapsed) {
  const content = callout.querySelector('.callout-content');
  const foldIcon = callout.querySelector('.callout-fold');

  const isCurrentlyCollapsed = callout.classList.contains('is-collapsed');
  if (collapsed !== isCurrentlyCollapsed) {
    callout.classList.toggle('is-collapsed', collapsed);
    foldIcon?.classList.toggle('is-collapsed', collapsed);
    content?.setAttribute('style', collapsed ? 'display: none;' : '');
  }
}

module.exports = class CalloutControlPlugin extends Plugin {
  onload() {
    // Helper to register commands with consistent ID prefix
    this.registerCommand = (id, name, callback) => {
      this.addCommand({
        id: `callout-control.${id}`,
        name,
        callback
      });
    };

    // All Callouts (Visual Only)
    this.registerCommand('toggle-all', 'Toggle All Callouts Uniformly (Visual Only)', () => this.processCallouts('toggle'));
    this.registerCommand('collapse-all', 'Collapse All Callouts (Visual Only)', () => this.processCallouts('collapse'));
    this.registerCommand('expand-all', 'Expand All Callouts (Visual Only)', () => this.processCallouts('expand'));

    // All Callouts (with Markdown)
    this.registerCommand('toggle-all-with-markdown', 'Toggle All Callouts Individually (with Markdown)', () => this.toggleWithMarkdown());
    this.registerCommand('collapse-all-with-markdown', 'Collapse All Callouts (with Markdown)', () => this.processCallouts('collapse', true));
    this.registerCommand('expand-all-with-markdown', 'Expand All Callouts (with Markdown)', () => this.processCallouts('expand', true));

    // Current Callout (Visual Only)
    this.registerCommand('toggle-current', 'Toggle Current Callout', () => this.toggleCurrentCallout());
    this.registerCommand('collapse-current', 'Collapse Current Callout', () => this.toggleCurrentCallout('collapse'));
    this.registerCommand('expand-current', 'Expand Current Callout', () => this.toggleCurrentCallout('expand'));

    // Current Callout (with Markdown)
    this.registerCommand('toggle-current-with-markdown', 'Toggle Current Callout (with Markdown)', () => this.toggleCurrentCallout('toggle', true));
    this.registerCommand('collapse-current-with-markdown', 'Collapse Current Callout (with Markdown)', () => this.toggleCurrentCallout('collapse', true));
    this.registerCommand('expand-current-with-markdown', 'Expand Current Callout (with Markdown)', () => this.toggleCurrentCallout('expand', true));

    // Section Callouts (Visual Only)
    this.registerCommand('toggle-section-visual', 'Toggle Section Callouts (Visual Only)', () => this.toggleSectionCallouts('toggle', false));
    this.registerCommand('collapse-section-visual', 'Collapse Section Callouts (Visual Only)', () => this.toggleSectionCallouts('collapse', false));
    this.registerCommand('expand-section-visual', 'Expand Section Callouts (Visual Only)', () => this.toggleSectionCallouts('expand', false));

    // Section Callouts (with Markdown)
    this.registerCommand('toggle-section-with-markdown', 'Toggle Section Callouts (with Markdown)', () => this.toggleSectionCallouts());
    this.registerCommand('collapse-section-with-markdown', 'Collapse Section Callouts (with Markdown)', () => this.toggleSectionCallouts('collapse'));
    this.registerCommand('expand-section-with-markdown', 'Expand Section Callouts (with Markdown)', () => this.toggleSectionCallouts('expand'));
  }
  // Uniformly toggle/collapse/expand all visible callouts in the DOM.
  // Optionally updates Markdown symbols if modifyMarkdown is true.
  processCallouts(mode, modifyMarkdown = false) {
    const root = this.app.workspace.activeEditor?.containerEl;
    if (!root) return;

    const editor = modifyMarkdown ? this.app.workspace.activeEditor?.editor : null;
    const lines = editor ? editor.getValue().split('\n') : [];

    const callouts = root.querySelectorAll('.callout');
    if (!callouts.length) return;

    // Determine uniform collapsed state to apply to all callouts.
    // 'toggle' uses the opposite of the first callout’s state.
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
        if (modifyMarkdown && editor && lines.length) {
          const titleEl = callout.querySelector('.callout-title-inner');
          const title = titleEl?.textContent?.trim();
          if (title) {
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].includes(title)) {
                const updatedLine = lines[i].replace(/\[!([\w-]+)\]([+-])/, (_, type, symbol) =>
                  `[!${type}]${shouldCollapse ? '-' : '+'}`
                );
                editor.replaceRange(updatedLine, { line: i, ch: 0 }, { line: i, ch: lines[i].length });
                break;
              }
            }
          }
        }
      });
    } catch (err) {
      // Prevent plugin crashes on unexpected DOM errors
      console.error("Toggle Callouts Plugin error:", err);
    }
  }

  // Toggle each visible callout independently, both visually and in Markdown.
  toggleWithMarkdown() {
    const editor = this.app.workspace.activeEditor?.editor;
    const root = this.app.workspace.activeEditor?.containerEl;
    if (!editor || !root) return;

    const callouts = root.querySelectorAll('.callout');
    try {
      callouts.forEach(callout => {
        const isCollapsed = callout.classList.contains('is-collapsed');
        const newCollapsedState = !isCollapsed;

        // Toggle DOM state
        applyCalloutCollapseState(callout, newCollapsedState);

        // Attempt to match the markdown line by callout title text
        const titleEl = callout.querySelector('.callout-title-inner');
        const title = titleEl?.textContent?.trim();
        if (!title) return;

        const lines = editor.getValue().split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(title)) {
            const updatedLine = lines[i].replace(/\[!([\w-]+)\]([+-])/, (_, type, symbol) =>
              `[!${type}]${symbol === '+' ? '-' : '+'}`
            );
            editor.replaceRange(updatedLine, { line: i, ch: 0 }, { line: i, ch: lines[i].length });
            break;
          }
        }
      });
    } catch (err) {
      // Prevent plugin crashes on unexpected DOM errors
      console.error("Toggle Callouts Plugin error in toggleWithMarkdown:", err);
    }
  }

  // Toggle/collapse/expand the callout under the cursor. Optionally syncs to Markdown.
  toggleCurrentCallout(mode = 'toggle', modifyMarkdown = true) {
    const editor = this.app.workspace.activeEditor?.editor;
    const root = this.app.workspace.activeEditor?.containerEl;
    if (!editor || !root) return;

    // Cache callouts and their titles to minimize DOM reads
    const calloutTitleMap = getCalloutTitleMap(root);

    const cursor = editor.getCursor();
    let lineIndex = cursor.line;
    const lines = editor.getValue().split('\n');

    // Check if this line is a callout line with a [+] or [-] indicator
    while (lineIndex >= 0) {
      const line = lines[lineIndex];
      // Check if line looks like a callout start line
      if (line.trim().startsWith('> [!') && /[+-]/.test(line)) {
        // Determine new collapsed state based on mode
        let newCollapsedState;
        if (mode === 'collapse') {
          newCollapsedState = true;
        } else if (mode === 'expand') {
          newCollapsedState = false;
        } else {
          newCollapsedState = !line.includes('-');
        }

        if (modifyMarkdown) {
          // Update the markdown line with the new collapsed state symbol
          const updatedLine = line.replace(/\[!([\w-]+)\]([+-])/, (_, type, symbol) => {
            if (mode === 'collapse') return `[!${type}]-`;
            if (mode === 'expand') return `[!${type}]+`;
            return `[!${type}]${symbol === '+' ? '-' : '+'}`;
          });
          editor.replaceRange(updatedLine, { line: lineIndex, ch: 0 }, { line: lineIndex, ch: line.length });
        }

        // Also update DOM if visible
        const titleMatch = [...calloutTitleMap.keys()].find(title => line.includes(title));
        if (titleMatch) {
          const callout = calloutTitleMap.get(titleMatch);
          applyCalloutCollapseState(callout, newCollapsedState);
        }
        break;
      }
      lineIndex--;
    }
  }
  // Toggle/collapse/expand all callouts within the current Markdown section.
  // Optionally updates the corresponding Markdown lines.
  toggleSectionCallouts(mode = 'toggle', modifyMarkdown = true) {
    const editor = this.app.workspace.activeEditor?.editor;
    const root = this.app.workspace.activeEditor?.containerEl;
    if (!editor || !root) return;

    try {
      // Cache callouts and their titles to minimize DOM reads
      const calloutTitleMap = getCalloutTitleMap(root);

      const cursor = editor.getCursor();
      const lines = editor.getValue().split('\n');
      let startLine = cursor.line;

      // Scan upward to find the nearest section heading
      while (startLine >= 0 && !lines[startLine].startsWith('#')) {
        startLine--;
      }

      // Scan downward to find the next section heading (or end of file)
      let endLine = cursor.line + 1;
      while (endLine < lines.length && !lines[endLine].startsWith('#')) {
        endLine++;
      }

      const calloutLines = [];
      // Collect all callout start lines within the section
      for (let i = startLine + 1; i < endLine; i++) {
        if (lines[i].trim().startsWith('> [!') && /[+-]/.test(lines[i])) {
          calloutLines.push(i);
        }
      }

      calloutLines.forEach(i => {
        if (modifyMarkdown) {
          // Update the markdown line with the new collapsed state symbol
          const updatedLine = lines[i].replace(/\[!([\w-]+)\]([+-])/, (_, type, symbol) => {
            if (mode === 'collapse') return `[!${type}]-`;
            if (mode === 'expand') return `[!${type}]+`;
            return `[!${type}]${symbol === '+' ? '-' : '+'}`;
          });
          editor.replaceRange(updatedLine, { line: i, ch: 0 }, { line: i, ch: lines[i].length });
        }

        // Also update DOM if visible
        const matchedTitle = [...calloutTitleMap.keys()].find(title => lines[i].includes(title));
        if (matchedTitle) {
          const callout = calloutTitleMap.get(matchedTitle);
          const isCollapsed = callout.classList.contains('is-collapsed');
          const newCollapsedState = mode === 'collapse'
            ? true
            : mode === 'expand'
            ? false
            : !isCollapsed;
          applyCalloutCollapseState(callout, newCollapsedState);
        }
      });
    } catch (err) {
      // Prevent plugin crashes on unexpected DOM errors
      console.error("Toggle Callouts Plugin error in toggleSectionCallouts:", err);
    }
  }
}