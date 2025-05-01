const { Plugin } = require('obsidian');

// Obsidian plugin to toggle, collapse, or expand callouts in Live Preview,
// with optional syncing to Markdown (+/-) indicators.
// Enhanced to work in both Live Preview and Markdown modes.

// Regular expression to identify callout patterns in Markdown
const CALLOUT_REGEX = /^>\s*\[!([\w-]+)\]([+-]?)\s*(.*)/;

/**
 * Obsidian-specific callout detector that handles:
 * - Multi-line callouts
 * - Nested callouts
 * - Standard Obsidian callout format only
 * 
 * Provides utilities for finding, processing, and updating callouts
 * in the Markdown document.
 */
class ObsidianCalloutDetector {
  /**
   * Creates a new callout detector instance
   * 
   * @param {Editor} editor - The Obsidian editor instance to work with
   */
  constructor(editor) {
    this.editor = editor;
    // Standard Obsidian callout format: > [!type]± Title
    this.CALLOUT_REGEX = CALLOUT_REGEX;
  }

  /**
   * Detect all callouts in the document with their full structure
   * 
   * Scans the entire document for callouts, processing each one to determine
   * its structure, content, and state. Handles nested callouts correctly.
   * 
   * @returns {Array<CalloutInfo>} Array of detected callouts with detailed structure
   */
  detectAllCallouts() {
    if (!this.editor) return [];
    
    const content = this.editor.getValue();
    const lines = content.split('\n');
    const callouts = [];
    
    // Process the document line by line
    for (let i = 0; i < lines.length; i++) {
      // If we find a callout start line
      if (this.isCalloutStartLine(lines[i])) {
        const callout = this.processCallout(lines, i);
        if (callout) {
          callouts.push(callout);
          // Skip to the end of this callout
          i = callout.endLine;
        }
      }
    }
    
    return callouts;
  }
  
  /**
   * Determine if a line starts a callout block
   * 
   * Uses the callout regex pattern to identify the starting line of a callout.
   * 
   * @param {string} line - The line to check
   * @returns {boolean} True if this is a callout start line
   */
  isCalloutStartLine(line) {
    return this.CALLOUT_REGEX.test(line);
  }
  
  /**
   * Check if a line continues a callout block
   * 
   * A continuation line starts with '>' but is not a callout start line.
   * 
   * @param {string} line - The line to check
   * @returns {boolean} True if this is a callout continuation line
   */
  isCalloutContinuationLine(line) {
    const trimmed = line.trim();
    // Callout content lines start with >
    return trimmed.startsWith('>') && !this.isCalloutStartLine(line);
  }
  
  /**
   * Process a callout starting at the given line
   * 
   * Extracts callout metadata (type, title, collapse state), determines its
   * boundaries, processes content, and detects nested callouts.
   * 
   * @param {Array<string>} lines - All document lines
   * @param {number} startLineIndex - The line where the callout starts
   * @returns {CalloutInfo|null} The detected callout or null if invalid
   */
  processCallout(lines, startLineIndex) {
    const startLine = lines[startLineIndex];
    
    // Extract callout details
    const match = startLine.match(this.CALLOUT_REGEX);
    if (!match) return null;
    
    const type = match[1];
    const collapseState = match[2] || '';
    const title = match[3].trim();
    
    // Normalize collapse state (default is expanded)
    const isCollapsed = collapseState === '-';
    
    // Find the end of this callout and collect content
    const contentLines = [];
    let currentLine = startLineIndex + 1;
    let endLine = startLineIndex;
    let nesting = 0;
    
    // Process until we find the end of the callout
    while (currentLine < lines.length) {
      const line = lines[currentLine];
      
      if (this.isCalloutStartLine(line)) {
        // Found nested callout
        nesting++;
        contentLines.push(line);
      } 
      else if (this.isCalloutContinuationLine(line)) {
        // Still in the callout
        contentLines.push(line);
      }
      else {
        // Not a callout line - might be the end or a nested callout end
        if (nesting > 0) {
          nesting--;
          contentLines.push(line);
        } else {
          // End of the callout
          endLine = currentLine - 1;
          break;
        }
      }
      
      currentLine++;
    }
    
    // If we reached the end of the document
    if (currentLine >= lines.length) {
      endLine = lines.length - 1;
    }
    
    // Extract clean content (without the > prefix)
    const content = contentLines.map(line => {
      const match = line.match(/^>\s?(.*)/);
      return match ? match[1] : line;
    }).join('\n');
    
    // Detect nested callouts within the content
    const nestedCallouts = [];
    let contentLinesForNested = contentLines.slice();
    let nestedStartLine = 0;
    
    while (nestedStartLine < contentLinesForNested.length) {
      if (this.isCalloutStartLine(contentLinesForNested[nestedStartLine])) {
        // Create a temporary array of lines for the nested callout processing
        const nestedLines = contentLinesForNested.slice(nestedStartLine);
        const nested = this.processCallout(nestedLines, 0);
        
        if (nested) {
          // Adjust line numbers to be relative to the parent document
          nested.startLine += startLineIndex + 1 + nestedStartLine;
          nested.endLine += startLineIndex + 1 + nestedStartLine;
          
          nestedCallouts.push(nested);
          // Skip to after this nested callout
          nestedStartLine += nested.endLine - nested.startLine + 1;
        } else {
          nestedStartLine++;
        }
      } else {
        nestedStartLine++;
      }
    }
    
    return {
      type,
      title,
      isCollapsed,
      content,
      startLine: startLineIndex,
      endLine,
      nestedCallouts,
      rawLine: startLine
    };
  }
  
  /**
   * Update a callout's collapse state in the Markdown
   * 
   * Modifies the callout's opening line to add or remove the collapse indicator
   * (+ or -) based on the desired state.
   * 
   * @param {CalloutInfo} callout - The callout object to update
   * @param {boolean} newCollapsedState - The new collapse state
   * @returns {boolean} True if update was successful
   */
  updateCalloutCollapseState(callout, newCollapsedState) {
    if (!this.editor || callout.startLine === undefined) return false;
    
    const lines = this.editor.getValue().split('\n');
    const startLine = lines[callout.startLine];
    
    // Update collapse state indicator
    const updatedLine = startLine.replace(
      this.CALLOUT_REGEX,
      (_, type, collapse, title) => `> [!${type}]${newCollapsedState ? '-' : '+'} ${title}`
    );
    
    // Apply the change only if something actually changed
    if (updatedLine !== startLine) {
      this.editor.replaceRange(
        updatedLine,
        { line: callout.startLine, ch: 0 },
        { line: callout.startLine, ch: startLine.length }
      );
      return true;
    }
    
    return false;
  }
  
  /**
   * Find the callout that contains the given line
   * 
   * Useful for determining which callout a cursor is inside of.
   * Handles nested callouts correctly by checking the most specific match.
   * 
   * @param {number} lineNumber - The line number to check
   * @returns {CalloutInfo|null} The callout containing this line or null
   */
  findCalloutContainingLine(lineNumber) {
    const allCallouts = this.detectAllCallouts();
    
    // Check direct containment
    for (const callout of allCallouts) {
      if (lineNumber >= callout.startLine && lineNumber <= callout.endLine) {
        // Check if it's a nested callout
        let nestedCallout = this.findNestedCalloutContainingLine(
          callout, 
          lineNumber
        );
        
        return nestedCallout || callout;
      }
    }
    
    return null;
  }
  
  /**
   * Recursively find a nested callout containing the given line
   * 
   * Helper method for findCalloutContainingLine that handles nesting.
   * 
   * @param {CalloutInfo} parentCallout - The parent callout to check within
   * @param {number} lineNumber - The line number to find
   * @returns {CalloutInfo|null} The nested callout or null
   */
  findNestedCalloutContainingLine(parentCallout, lineNumber) {
    for (const nested of parentCallout.nestedCallouts) {
      if (lineNumber >= nested.startLine && lineNumber <= nested.endLine) {
        // Check if there's an even deeper nesting
        const deeperNested = this.findNestedCalloutContainingLine(
          nested, 
          lineNumber
        );
        return deeperNested || nested;
      }
    }
    return null;
  }
  
  /**
   * Get all callouts within a section (between headings)
   * 
   * A section is defined as the content between two headings or 
   * the start/end of the document.
   * 
   * @param {number} cursorLine - The line number to start searching from
   * @returns {Array<CalloutInfo>} Array of callouts in the current section
   */
  getCalloutsInCurrentSection(cursorLine) {
    if (!this.editor) return [];
    
    const lines = this.editor.getValue().split('\n');
    
    // Find section boundaries
    let sectionStart = cursorLine;
    while (sectionStart >= 0 && !lines[sectionStart].startsWith('#')) {
      sectionStart--;
    }
    
    let sectionEnd = cursorLine;
    while (sectionEnd < lines.length && !lines[sectionEnd].startsWith('#')) {
      sectionEnd++;
    }
    
    // If no section was found, use the whole document
    if (sectionStart < 0) sectionStart = 0;
    if (sectionEnd >= lines.length) sectionEnd = lines.length - 1;
    
    // Get all callouts and filter by section
    const allCallouts = this.detectAllCallouts();
    return allCallouts.filter(callout => 
      callout.startLine >= sectionStart && 
      callout.endLine <= sectionEnd
    );
  }
  
  /**
   * Get the closest callout to the cursor position
   * 
   * First checks if the cursor is inside a callout, then finds the
   * nearest callout by line distance.
   * 
   * @param {number} cursorLine - The current cursor line
   * @returns {CalloutInfo|null} The closest callout or null
   */
  getClosestCalloutToCursor(cursorLine) {
    // First check if cursor is inside a callout
    const containingCallout = this.findCalloutContainingLine(cursorLine);
    if (containingCallout) return containingCallout;
    
    // Otherwise find the closest callout declaration
    const allCallouts = this.detectAllCallouts();
    if (!allCallouts.length) return null;
    
    // Sort by distance from cursor to callout start line
    return allCallouts.sort((a, b) => {
      const distA = Math.abs(a.startLine - cursorLine);
      const distB = Math.abs(b.startLine - cursorLine);
      return distA - distB;
    })[0];
  }
  
  /**
   * Scan upward from cursor to find the closest callout
   * 
   * Useful for implementing the toggleCurrentCallout functionality
   * when the cursor is after a callout.
   * 
   * @param {number} cursorLine - The current cursor line
   * @returns {CalloutInfo|null} The closest callout above or null
   */
  findCalloutAboveCursor(cursorLine) {
    if (!this.editor) return null;
    
    const lines = this.editor.getValue().split('\n');
    let lineIndex = cursorLine;
    
    // Scan upward to find the nearest callout start line
    while (lineIndex >= 0) {
      if (this.isCalloutStartLine(lines[lineIndex])) {
        // Found a callout - process it
        return this.processCallout(lines, lineIndex);
      }
      lineIndex--;
    }
    
    return null;
  }
}

/**
 * CalloutMatcher
 * 
 * Bridges DOM elements with their Markdown representation for reliable 
 * syncing between visual changes and Markdown updates.
 * 
 * Maps between the live preview DOM elements and their corresponding
 * Markdown representation for bidirectional updates.
 */
class CalloutMatcher {
  /**
   * Creates a new callout matcher
   * 
   * @param {Editor} editor - The Obsidian editor instance
   * @param {HTMLElement} root - The root DOM element containing callouts
   */
  constructor(editor, root) {
    this.editor = editor;
    this.root = root;
    this.calloutMap = new Map(); // Maps from unique IDs to callout info
    this.detector = new ObsidianCalloutDetector(editor);
    this.refreshCallouts();
  }

  /**
   * Refreshes the callout information map
   * 
   * Scans both the DOM and Markdown to build a mapping between them.
   * Should be called whenever the document changes significantly.
   */
  refreshCallouts() {
    if (!this.editor || !this.root) return;
    
    // Get all callouts from the markdown
    const markdownCallouts = this.detector.detectAllCallouts();
    
    // Get all callouts from the DOM
    const domCallouts = this.root.querySelectorAll('.callout');
    
    this.calloutMap.clear();
    
    // Match DOM callouts with markdown callouts
    domCallouts.forEach((domElement, index) => {
      const titleEl = domElement.querySelector('.callout-title-inner');
      const title = titleEl?.textContent?.trim() || '';
      const type = domElement.getAttribute('data-callout') || '';
      const isCollapsed = domElement.classList.contains('is-collapsed');
      
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
        domElement,
        title,
        type,
        isCollapsed,
        markdownCallout: matchingMarkdownCallout
      });
    });
  }
  
  /**
   * Find the best matching markdown callout for a DOM callout
   * 
   * Uses multiple attributes for more reliable matching, with
   * fallbacks for partial matches.
   * 
   * @param {Array<CalloutInfo>} markdownCallouts - Array of callouts from Markdown
   * @param {string} title - The title from the DOM callout
   * @param {string} type - The callout type from the DOM
   * @param {boolean} isCollapsed - Whether the DOM callout is collapsed
   * @returns {CalloutInfo|undefined} The matching Markdown callout or undefined
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
   * 
   * @returns {Array<CalloutMapInfo>} Array of callout info objects
   */
  getAllCallouts() {
    return Array.from(this.calloutMap.values())
      .filter(info => info.domElement);
  }
  
  /**
   * Get callout element at a specific line number
   * 
   * @param {number} lineNumber - The line number to search for
   * @returns {CalloutMapInfo|undefined} The callout info at that line or undefined
   */
  getCalloutAtLine(lineNumber) {
    return Array.from(this.calloutMap.values())
      .find(info => 
        info.markdownCallout && 
        info.markdownCallout.startLine === lineNumber
      );
  }
  
  /**
   * Get all callouts between startLine and endLine (inclusive)
   * 
   * @param {number} startLine - The starting line number
   * @param {number} endLine - The ending line number
   * @returns {Array<CalloutMapInfo>} Callouts in the range
   */
  getCalloutsInRange(startLine, endLine) {
    return Array.from(this.calloutMap.values())
      .filter(info => 
        info.markdownCallout && 
        info.markdownCallout.startLine >= startLine && 
        info.markdownCallout.startLine <= endLine
      );
  }
  
  /**
   * Update the Markdown representation of a callout
   * 
   * @param {CalloutMapInfo} calloutInfo - The callout info object
   * @param {boolean} newCollapsedState - The new collapse state
   * @returns {boolean} True if update was successful
   */
  updateMarkdownCollapseState(calloutInfo, newCollapsedState) {
    if (!calloutInfo.markdownCallout || !this.editor) return false;
    
    return this.detector.updateCalloutCollapseState(
      calloutInfo.markdownCallout, 
      newCollapsedState
    );
  }
  
  /**
   * Find the callout containing the given line in the document
   * 
   * @param {number} lineNumber - The line number to check
   * @returns {CalloutMapInfo|undefined} The containing callout or undefined
   */
  findCalloutContainingLine(lineNumber) {
    const markdownCallout = this.detector.findCalloutContainingLine(lineNumber);
    if (!markdownCallout) return null;
    
    return Array.from(this.calloutMap.values())
      .find(info => 
        info.markdownCallout && 
        info.markdownCallout.startLine === markdownCallout.startLine
      );
  }
  
  /**
   * Get all callouts in the current section
   * 
   * @param {number} cursorLine - The line to use as reference
   * @returns {Array<CalloutMapInfo>} Callouts in the section
   */
  getCalloutsInCurrentSection(cursorLine) {
    const sectionCallouts = this.detector.getCalloutsInCurrentSection(cursorLine);
    
    return Array.from(this.calloutMap.values())
      .filter(info => 
        info.markdownCallout && 
        sectionCallouts.some(sc => 
          sc.startLine === info.markdownCallout.startLine
        )
      );
  }
  
  /**
   * Get the closest callout to the cursor
   * 
   * @param {number} cursorLine - The current cursor line
   * @returns {CalloutMapInfo|undefined} The closest callout or undefined
   */
  getClosestCalloutToCursor(cursorLine) {
    const closestMarkdownCallout = this.detector.getClosestCalloutToCursor(cursorLine);
    if (!closestMarkdownCallout) return null;
    
    return Array.from(this.calloutMap.values())
      .find(info => 
        info.markdownCallout && 
        info.markdownCallout.startLine === closestMarkdownCallout.startLine
      );
  }
}

/**
 * Apply collapse/expand state to a callout DOM element
 * 
 * Handles the visual toggle of a callout's expanded/collapsed state
 * in the Live Preview mode.
 * 
 * @param {HTMLElement} callout - The callout DOM element
 * @param {boolean} collapsed - Whether to collapse the callout
 */
function applyCalloutCollapseState(callout, collapsed) {
  if (!callout) return;
  
  const content = callout.querySelector('.callout-content');
  const foldIcon = callout.querySelector('.callout-fold');

  const isCurrentlyCollapsed = callout.classList.contains('is-collapsed');
  if (collapsed !== isCurrentlyCollapsed) {
    callout.classList.toggle('is-collapsed', collapsed);
    foldIcon?.classList.toggle('is-collapsed', collapsed);
    content?.setAttribute('style', collapsed ? 'display: none;' : '');
  }
}

/**
 * Detect if the editor is in Markdown source mode rather than Live Preview
 * 
 * @param {App} app - The Obsidian application instance
 * @returns {boolean} True if in Markdown mode
 */
function isInMarkdownMode(app) {
  // Get the current view mode
  const view = app.workspace.activeLeaf?.view;
  if (!view) return false;
  
  // Check if the view has a sourceMode property that's true
  // This is a reliable way to detect Markdown mode vs Live Preview
  return view.getMode() === 'source';
}

/**
 * CalloutControlPlugin
 * 
 * An Obsidian plugin to toggle, collapse, or expand callouts in both
 * Live Preview and Markdown source modes.
 * 
 * Provides commands to manage callouts individually or in groups, with
 * optional syncing to Markdown (+/-) indicators.
 */
module.exports = class CalloutControlPlugin extends Plugin {
  /**
   * Initialize the plugin and register commands
   */
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

    // All Callouts (with Markdown) - Works in both Live Preview and Markdown modes
    this.registerCommand('toggle-all-with-markdown', 'Toggle All Callouts Individually (with Markdown)', () => this.toggleWithMarkdown());
    this.registerCommand('collapse-all-with-markdown', 'Collapse All Callouts (with Markdown)', () => this.processCallouts('collapse', true));
    this.registerCommand('expand-all-with-markdown', 'Expand All Callouts (with Markdown)', () => this.processCallouts('expand', true));

    // Current Callout (Visual Only)
    this.registerCommand('toggle-current', 'Toggle Current Callout (Visual Only)', () => this.toggleCurrentCallout());
    this.registerCommand('collapse-current', 'Collapse Current Callout (Visual Only)', () => this.toggleCurrentCallout('collapse'));
    this.registerCommand('expand-current', 'Expand Current Callout (Visual Only)', () => this.toggleCurrentCallout('expand'));

    // Current Callout (with Markdown) - Works in both Live Preview and Markdown modes
    this.registerCommand('toggle-current-with-markdown', 'Toggle Current Callout (with Markdown)', () => this.toggleCurrentCallout('toggle', true));
    this.registerCommand('collapse-current-with-markdown', 'Collapse Current Callout (with Markdown)', () => this.toggleCurrentCallout('collapse', true));
    this.registerCommand('expand-current-with-markdown', 'Expand Current Callout (with Markdown)', () => this.toggleCurrentCallout('expand', true));

    // Section Callouts (Visual Only)
    this.registerCommand('toggle-section-visual', 'Toggle Section Callouts (Visual Only)', () => this.toggleSectionCallouts('toggle', false));
    this.registerCommand('collapse-section-visual', 'Collapse Section Callouts (Visual Only)', () => this.toggleSectionCallouts('collapse', false));
    this.registerCommand('expand-section-visual', 'Expand Section Callouts (Visual Only)', () => this.toggleSectionCallouts('expand', false));

    // Section Callouts (with Markdown) - Works in both Live Preview and Markdown modes
    this.registerCommand('toggle-section-with-markdown', 'Toggle Section Callouts (with Markdown)', () => this.toggleSectionCallouts());
    this.registerCommand('collapse-section-with-markdown', 'Collapse Section Callouts (with Markdown)', () => this.toggleSectionCallouts('collapse'));
    this.registerCommand('expand-section-with-markdown', 'Expand Section Callouts (with Markdown)', () => this.toggleSectionCallouts('expand'));
  }

  /**
   * Get the editor and detector for the current view
   * 
   * Centralized helper to create editor and detector instances.
   * 
   * @returns {Object|null} Object containing editor and detector, or null
   */
  getEditorAndDetector() {
    const editor = this.app.workspace.activeEditor?.editor;
    if (!editor) return null;
    
    return { 
      editor, 
      detector: new ObsidianCalloutDetector(editor) 
    };
  }
  
  /**
   * Create a fresh callout matcher for the current editor
   * 
   * The matcher bridges between DOM elements and Markdown representation.
   * 
   * @returns {CalloutMatcher|null} A new callout matcher or null
   */
  getCalloutMatcher() {
    const editor = this.app.workspace.activeEditor?.editor;
    const root = this.app.workspace.activeEditor?.containerEl;
    if (!editor || !root) return null;
    
    return new CalloutMatcher(editor, root);
  }
  
  /**
   * Apply a collapse/expand operation to callouts, with optional Markdown syncing
   * 
   * This is the centralized handler for all callout operations. It determines
   * which callouts to modify based on scope, applies the appropriate state change
   * based on mode, and optionally updates the Markdown.
   * 
   * @param {string} scope - 'all', 'current', or 'section' 
   * @param {string} mode - 'toggle', 'collapse', 'expand', or 'toggle-individual'
   * @param {boolean} modifyMarkdown - Whether to update the Markdown
   */
  applyCalloutOperation(scope, mode, modifyMarkdown = false) {
    // Get editor and create detector
    const editorData = this.getEditorAndDetector();
    if (!editorData) return;
    
    const { editor, detector } = editorData;
    const cursor = editor.getCursor();
    
    // Check if we're in markdown mode with markdown modification
    const inMarkdownMode = isInMarkdownMode(this.app);
    
    // If in markdown mode and we're modifying markdown, use direct markdown methods
    if (inMarkdownMode && modifyMarkdown) {
      // Get the relevant callouts based on scope
      let callouts = [];
      if (scope === 'all') {
        callouts = detector.detectAllCallouts();
      } else if (scope === 'current') {
        const callout = detector.findCalloutContainingLine(cursor.line) || 
                        detector.findCalloutAboveCursor(cursor.line);
        if (callout) callouts = [callout];
      } else if (scope === 'section') {
        callouts = detector.getCalloutsInCurrentSection(cursor.line);
      }
      
      if (!callouts.length) return;
      
      // Process callouts in reverse order (to maintain line numbers)
      const sortedCallouts = [...callouts].sort((a, b) => b.startLine - a.startLine);
      
      // Determine collapse state based on mode
      let getNewState;
      if (mode === 'collapse') {
        getNewState = () => true;
      } else if (mode === 'expand') {
        getNewState = () => false;
      } else if (mode === 'toggle-individual') {
        getNewState = (callout) => !callout.isCollapsed;
      } else { // uniform toggle
        // Count current collapse states to determine majority
        const collapsedCount = callouts.filter(c => c.isCollapsed).length;
        const shouldCollapse = collapsedCount < callouts.length / 2;
        getNewState = () => shouldCollapse;
      }
      
      // Update each callout
      sortedCallouts.forEach(callout => {
        detector.updateCalloutCollapseState(callout, getNewState(callout));
      });
      
      return;
    }
    
    // For Live Preview mode or visual-only operations
    
    // Get the callout matcher for DOM operations
    const matcher = this.getCalloutMatcher();
    if (!matcher) return;
    
    // Handle the different scopes
    if (scope === 'all') {
      const callouts = matcher.getAllCallouts();
      if (!callouts.length) return;
      
      try {
        // Determine new state based on mode
        let getNewState;
        if (mode === 'collapse') {
          getNewState = () => true;
        } else if (mode === 'expand') {
          getNewState = () => false;
        } else if (mode === 'toggle-individual') {
          getNewState = (calloutInfo) => 
            !calloutInfo.domElement.classList.contains('is-collapsed');
        } else { // uniform toggle
          const firstState = callouts[0].domElement.classList.contains('is-collapsed');
          getNewState = () => !firstState;
        }
        
        // Apply to all callouts
        callouts.forEach(calloutInfo => {
          const newState = getNewState(calloutInfo);
          
          // Update DOM
          applyCalloutCollapseState(calloutInfo.domElement, newState);
          
          // Update Markdown if requested
          if (modifyMarkdown) {
            matcher.updateMarkdownCollapseState(calloutInfo, newState);
          }
        });
      } catch (err) {
        console.error("Toggle Callouts Plugin error:", err);
      }
    } else if (scope === 'current') {
      // Find the callout containing or near the cursor
      const markdownCallout = detector.findCalloutContainingLine(cursor.line) || 
                              detector.findCalloutAboveCursor(cursor.line);
      
      if (!markdownCallout) return;
      
      // Find the matching DOM element
      let calloutInfo = matcher.getCalloutAtLine(markdownCallout.startLine);
      
      // If no match through the matcher, try direct DOM lookup
      if (!calloutInfo) {
        const root = this.app.workspace.activeEditor?.containerEl;
        if (!root) return;
        
        const calloutElements = root.querySelectorAll('.callout');
        for (const el of calloutElements) {
          const titleEl = el.querySelector('.callout-title-inner');
          const title = titleEl?.textContent?.trim();
          if (title === markdownCallout.title) {
            calloutInfo = {
              domElement: el,
              markdownCallout: markdownCallout
            };
            break;
          }
        }
        
        if (!calloutInfo) return;
      }
      
      // Determine new state based on mode
      let newState;
      if (mode === 'collapse') {
        newState = true;
      } else if (mode === 'expand') {
        newState = false;
      } else { // toggle
        newState = !calloutInfo.domElement.classList.contains('is-collapsed');
      }
      
      // Apply the change
      applyCalloutCollapseState(calloutInfo.domElement, newState);
      
      if (modifyMarkdown) {
        detector.updateCalloutCollapseState(markdownCallout, newState);
      }
    } else if (scope === 'section') {
      // Get all callouts in the current section
      const sectionCallouts = detector.getCalloutsInCurrentSection(cursor.line);
      if (!sectionCallouts.length) return;
      
      try {
        const root = this.app.workspace.activeEditor?.containerEl;
        
        // Process each callout in the section
        sectionCallouts.forEach(markdownCallout => {
          // Find the callout in the DOM
          let calloutInfo = matcher.getCalloutAtLine(markdownCallout.startLine);
          let currentState = false; // Default if DOM element not found
          
          if (calloutInfo && calloutInfo.domElement) {
            currentState = calloutInfo.domElement.classList.contains('is-collapsed');
          } else if (root) {
            // Try direct DOM lookup
            const calloutElements = root.querySelectorAll('.callout');
            for (const el of calloutElements) {
              const titleEl = el.querySelector('.callout-title-inner');
              const title = titleEl?.textContent?.trim();
              if (title === markdownCallout.title) {
                currentState = el.classList.contains('is-collapsed');
                calloutInfo = { domElement: el, markdownCallout };
                break;
              }
            }
          }
          
          // Determine new state based on mode
          let newState;
          if (mode === 'collapse') {
            newState = true;
          } else if (mode === 'expand') {
            newState = false;
          } else { // toggle
            newState = !currentState;
          }
          
          // Update Markdown
          if (modifyMarkdown) {
            detector.updateCalloutCollapseState(markdownCallout, newState);
          }
          
          // Update DOM if element found
          if (calloutInfo && calloutInfo.domElement) {
            applyCalloutCollapseState(calloutInfo.domElement, newState);
          }
        });
      } catch (err) {
        console.error("Toggle Callouts Plugin error:", err);
      }
    }
  }

  /**
   * Process all callouts in the document
   * 
   * Applies a uniform operation to all callouts in the document.
   * In 'toggle' mode, all callouts will be toggled to the same state.
   * 
   * @param {string} mode - 'toggle', 'collapse', or 'expand'
   * @param {boolean} modifyMarkdown - Whether to update the Markdown
   */
  processCallouts(mode, modifyMarkdown = false) {
    this.applyCalloutOperation('all', mode, modifyMarkdown);
  }
  
  /**
   * Toggle each callout individually
   * 
   * Unlike processCallouts with 'toggle', this toggles each callout
   * to its opposite state independently.
   * 
   * @param {boolean} modifyMarkdown - Whether to update the Markdown (default: true)
   */
  toggleWithMarkdown() {
    this.applyCalloutOperation('all', 'toggle-individual', true);
  }
  
  /**
   * Toggle/collapse/expand the current callout
   * 
   * Operates on the callout under the cursor or the closest one above.
   * 
   * @param {string} mode - 'toggle', 'collapse', or 'expand'
   * @param {boolean} modifyMarkdown - Whether to update the Markdown
   */
  toggleCurrentCallout(mode = 'toggle', modifyMarkdown = false) {
    this.applyCalloutOperation('current', mode, modifyMarkdown);
  }
  
  /**
   * Toggle/collapse/expand all callouts in the current section
   * 
   * A section is defined as the content between two heading lines.
   * 
   * @param {string} mode - 'toggle', 'collapse', or 'expand'
   * @param {boolean} modifyMarkdown - Whether to update the Markdown
   */
  toggleSectionCallouts(mode = 'toggle', modifyMarkdown = true) {
    this.applyCalloutOperation('section', mode, modifyMarkdown);
  }
}