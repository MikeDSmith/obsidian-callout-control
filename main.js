const { Plugin } = require('obsidian');

// Obsidian plugin to toggle, collapse, or expand callouts in Live Preview,
// with optional syncing to Markdown (+/-) indicators.

// Regular expression to identify callout patterns in Markdown
const CALLOUT_REGEX = />\s*\[!([\w-]+)\]([+-])\s*(.*)/;

/**
 * Callout matcher that stores information about both DOM and Markdown representation
 * of callouts to enable more reliable syncing between them.
 */
class CalloutMatcher {
  constructor(editor, root) {
    this.editor = editor;
    this.root = root;
    this.calloutMap = new Map(); // Maps from unique IDs to callout info
    this.refreshCallouts();
  }

  /**
   * Refreshes the callout information map by scanning both DOM and Markdown
   */
  refreshCallouts() {
    if (!this.editor || !this.root) return;
    
    const lines = this.editor.getValue().split('\n');
    const callouts = this.root.querySelectorAll('.callout');
    this.calloutMap.clear();
    
    // First pass: collect all markdown callouts with their line numbers and titles
    const markdownCallouts = [];
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(CALLOUT_REGEX);
      if (match) {
        const type = match[1]; // callout type (note, info, warning, etc.)
        const collapseState = match[2]; // + or -
        const title = match[3].trim(); // title text
        
        markdownCallouts.push({
          lineIndex: i,
          type,
          isCollapsed: collapseState === '-',
          title,
          fullLine: lines[i]
        });
      }
    }
    
    // Second pass: match DOM callouts with markdown callouts
    callouts.forEach((callout, index) => {
      const titleEl = callout.querySelector('.callout-title-inner');
      const title = titleEl?.textContent?.trim() || '';
      const type = callout.getAttribute('data-callout') || '';
      const isCollapsed = callout.classList.contains('is-collapsed');
      
      // Generate a unique ID for this callout
      const uniqueId = `callout-${index}`;
      
      // Try to find a corresponding markdown callout
      const matchingMarkdownCallout = this.findMatchingMarkdownCallout(
        markdownCallouts, 
        title, 
        type, 
        isCollapsed
      );
      
      // Store information about this callout for later use
      this.calloutMap.set(uniqueId, {
        domElement: callout,
        title,
        type,
        isCollapsed,
        markdownLineIndex: matchingMarkdownCallout?.lineIndex,
        fullLine: matchingMarkdownCallout?.fullLine
      });
    });
  }
  
  /**
   * Find the best matching markdown callout for a DOM callout
   * using multiple attributes for more reliable matching
   */
  findMatchingMarkdownCallout(markdownCallouts, title, type, isCollapsed) {
    // First try: exact match on title and type and collapse state
    let match = markdownCallouts.find(c => 
      c.title === title && 
      c.type === type && 
      c.isCollapsed === isCollapsed
    );
    
    if (match) return match;
    
    // Second try: match on title and type only
    match = markdownCallouts.find(c => 
      c.title === title && 
      c.type === type
    );
    
    if (match) return match;
    
    // Third try: match on title only (less reliable)
    match = markdownCallouts.find(c => c.title === title);
    
    if (match) return match;
    
    // Fourth try: fuzzy title match as last resort
    // This helps with titles that might have slight formatting differences
    return markdownCallouts.find(c => 
      title.includes(c.title) || 
      c.title.includes(title)
    );
  }
  
  /**
   * Get all callout elements that have been matched
   */
  getAllCallouts() {
    return Array.from(this.calloutMap.values())
      .filter(info => info.domElement);
  }
  
  /**
   * Get callout element at a specific line number
   */
  getCalloutAtLine(lineNumber) {
    return Array.from(this.calloutMap.values())
      .find(info => info.markdownLineIndex === lineNumber);
  }
  
  /**
   * Get all callouts between startLine and endLine (inclusive)
   */
  getCalloutsInRange(startLine, endLine) {
    return Array.from(this.calloutMap.values())
      .filter(info => 
        info.markdownLineIndex !== undefined && 
        info.markdownLineIndex >= startLine && 
        info.markdownLineIndex <= endLine
      );
  }
  
  /**
   * Update the Markdown representation of a callout
   */
  updateMarkdownCollapseState(calloutInfo, newCollapsedState) {
    if (calloutInfo.markdownLineIndex === undefined || !this.editor) return false;
    
    const lines = this.editor.getValue().split('\n');
    const line = lines[calloutInfo.markdownLineIndex];
    
    // Replace the collapse indicator (+ or -) with the new state
    const updatedLine = line.replace(
      CALLOUT_REGEX, 
      (_, type, symbol, title) => `> [!${type}]${newCollapsedState ? '-' : '+'} ${title}`
    );
    
    if (updatedLine !== line) {
      this.editor.replaceRange(
        updatedLine, 
        { line: calloutInfo.markdownLineIndex, ch: 0 }, 
        { line: calloutInfo.markdownLineIndex, ch: line.length }
      );
      // Update our stored information
      calloutInfo.fullLine = updatedLine;
      calloutInfo.isCollapsed = newCollapsedState;
      return true;
    }
    
    return false;
  }
}

/**
 * Apply collapse/expand state to a callout DOM element
 */
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
    this.registerCommand('toggle-current', 'Toggle Current Callout (Visual Only)', () => this.toggleCurrentCallout());
    this.registerCommand('collapse-current', 'Collapse Current Callout (Visual Only)', () => this.toggleCurrentCallout('collapse'));
    this.registerCommand('expand-current', 'Expand Current Callout (Visual Only)', () => this.toggleCurrentCallout('expand'));

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

  // Create a fresh callout matcher for the current editor
  getCalloutMatcher() {
    const editor = this.app.workspace.activeEditor?.editor;
    const root = this.app.workspace.activeEditor?.containerEl;
    if (!editor || !root) return null;
    
    return new CalloutMatcher(editor, root);
  }

  // Uniformly toggle/collapse/expand all visible callouts in the DOM.
  // Optionally updates Markdown symbols if modifyMarkdown is true.
  processCallouts(mode, modifyMarkdown = false) {
    const matcher = this.getCalloutMatcher();
    if (!matcher) return;

    const callouts = matcher.getAllCallouts();
    if (!callouts.length) return;

    // Determine uniform collapsed state to apply to all callouts.
    // 'toggle' uses the opposite of the first callout's state.
    const shouldCollapse =
      mode === 'toggle'
        ? !callouts[0].domElement.classList.contains('is-collapsed')
        : mode === 'collapse';

    try {
      // Apply the visual state change to each rendered callout
      callouts.forEach(calloutInfo => {
        // Apply the determined uniform state visually
        applyCalloutCollapseState(calloutInfo.domElement, shouldCollapse);

        if (modifyMarkdown) {
          // Update Markdown representation
          matcher.updateMarkdownCollapseState(calloutInfo, shouldCollapse);
        }
      });
    } catch (err) {
      // Prevent plugin crashes on unexpected DOM errors
      console.error("Toggle Callouts Plugin error:", err);
    }
  }

  // Toggle each visible callout independently, both visually and in Markdown.
  toggleWithMarkdown() {
    const matcher = this.getCalloutMatcher();
    if (!matcher) return;

    try {
      matcher.getAllCallouts().forEach(calloutInfo => {
        const isCollapsed = calloutInfo.domElement.classList.contains('is-collapsed');
        const newCollapsedState = !isCollapsed;

        // Toggle DOM state
        applyCalloutCollapseState(calloutInfo.domElement, newCollapsedState);

        // Update Markdown representation
        matcher.updateMarkdownCollapseState(calloutInfo, newCollapsedState);
      });
    } catch (err) {
      // Prevent plugin crashes on unexpected DOM errors
      console.error("Toggle Callouts Plugin error in toggleWithMarkdown:", err);
    }
  }

  // Toggle/collapse/expand the callout under the cursor. Optionally syncs to Markdown.
  toggleCurrentCallout(mode = 'toggle', modifyMarkdown = true) {
    const editor = this.app.workspace.activeEditor?.editor;
    if (!editor) return;

    const matcher = this.getCalloutMatcher();
    if (!matcher) return;

    const cursor = editor.getCursor();
    let lineIndex = cursor.line;
    const lines = editor.getValue().split('\n');

    // Find the closest callout line from current cursor position (going upward)
    while (lineIndex >= 0) {
      const calloutInfo = matcher.getCalloutAtLine(lineIndex);
      if (calloutInfo) {
        // Determine new collapsed state based on mode
        let newCollapsedState;
        if (mode === 'collapse') {
          newCollapsedState = true;
        } else if (mode === 'expand') {
          newCollapsedState = false;
        } else { // toggle
          newCollapsedState = !calloutInfo.domElement.classList.contains('is-collapsed');
        }

        // Update DOM state
        applyCalloutCollapseState(calloutInfo.domElement, newCollapsedState);
        
        // Optionally update Markdown
        if (modifyMarkdown) {
          matcher.updateMarkdownCollapseState(calloutInfo, newCollapsedState);
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
    if (!editor) return;

    const matcher = this.getCalloutMatcher();
    if (!matcher) return;

    try {
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

      // Get all callouts within this section
      const sectionCallouts = matcher.getCalloutsInRange(startLine, endLine - 1);
      
      // No action if no callouts found
      if (!sectionCallouts.length) return;
      
      // Determine the action based on mode
      sectionCallouts.forEach(calloutInfo => {
        const isCollapsed = calloutInfo.domElement.classList.contains('is-collapsed');
        const newCollapsedState = mode === 'collapse'
          ? true
          : mode === 'expand'
          ? false
          : !isCollapsed;
        
        // Update DOM state
        applyCalloutCollapseState(calloutInfo.domElement, newCollapsedState);
        
        // Optionally update Markdown
        if (modifyMarkdown) {
          matcher.updateMarkdownCollapseState(calloutInfo, newCollapsedState);
        }
      });
    } catch (err) {
      // Prevent plugin crashes on unexpected DOM errors
      console.error("Toggle Callouts Plugin error in toggleSectionCallouts:", err);
    }
  }
}