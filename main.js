const { Plugin } = require('obsidian');

// Obsidian plugin to toggle, collapse, or expand callouts in Live Preview,
// with optional syncing to Markdown (+/-) indicators.

// Regular expression to identify callout patterns in Markdown
const CALLOUT_REGEX = /^>\s*\[!([\w-]+)\]([+-]?)\s*(.*)/;

/**
 * Obsidian-specific callout detector that handles:
 * - Multi-line callouts
 * - Nested callouts
 * - Standard Obsidian callout format only
 */
class ObsidianCalloutDetector {
  constructor(editor) {
    this.editor = editor;
    // Standard Obsidian callout format: > [!type]± Title
    this.CALLOUT_REGEX = CALLOUT_REGEX;
  }

  /**
   * Detect all callouts in the document with their full structure
   * @returns {Array} Array of detected callouts with detailed structure
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
   * @param {string} line - The line to check
   * @returns {boolean} True if this is a callout start line
   */
  isCalloutStartLine(line) {
    return this.CALLOUT_REGEX.test(line);
  }
  
  /**
   * Check if a line continues a callout block
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
   * @param {Array} lines - All document lines
   * @param {number} startLineIndex - The line where the callout starts
   * @returns {Object|null} The detected callout or null if invalid
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
   * Update a callout's collapse state
   * @param {Object} callout - The callout object to update
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
   * @param {number} lineNumber - The line number to check
   * @returns {Object|null} The callout containing this line or null
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
   * @param {Object} parentCallout - The parent callout to check within
   * @param {number} lineNumber - The line number to find
   * @returns {Object|null} The nested callout or null
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
   * @param {number} cursorLine - The line number to start searching from
   * @returns {Array} Array of callouts in the current section
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
   * This finds the callout declaration line closest to the cursor,
   * which is useful for implementing the "current callout" commands
   * @param {number} cursorLine - The current cursor line
   * @returns {Object|null} The closest callout or null
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
   * This is helpful for the toggleCurrentCallout implementation
   * @param {number} cursorLine - The current cursor line
   * @returns {Object|null} The closest callout above or null
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
 * Callout matcher that bridges DOM elements with their Markdown representation
 * for reliable syncing between visual changes and Markdown updates.
 */
class CalloutMatcher {
  constructor(editor, root) {
    this.editor = editor;
    this.root = root;
    this.calloutMap = new Map(); // Maps from unique IDs to callout info
    this.detector = new ObsidianCalloutDetector(editor);
    this.refreshCallouts();
  }

  /**
   * Refreshes the callout information map by scanning both DOM and Markdown
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
      .find(info => 
        info.markdownCallout && 
        info.markdownCallout.startLine === lineNumber
      );
  }
  
  /**
   * Get all callouts between startLine and endLine (inclusive)
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

    try {
      // Determine uniform collapsed state to apply to all callouts.
      // 'toggle' uses the opposite of the first callout's state.
      const shouldCollapse =
        mode === 'toggle'
          ? !callouts[0].isCollapsed
          : mode === 'collapse';

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
    
    // Try to find a callout containing or near the cursor
    const detector = new ObsidianCalloutDetector(editor);
    const markdownCallout = detector.findCalloutContainingLine(cursor.line) || 
                            detector.findCalloutAboveCursor(cursor.line);
    
    if (!markdownCallout) return;
    
    // Find the matching DOM element
    let calloutInfo = matcher.getCalloutAtLine(markdownCallout.startLine);
    
    // If no match found through the matcher, try to find it directly in the DOM
    if (!calloutInfo) {
      const root = this.app.workspace.activeEditor?.containerEl;
      if (!root) return;
      
      const calloutElements = root.querySelectorAll('.callout');
      for (const el of calloutElements) {
        const titleEl = el.querySelector('.callout-title-inner');
        const title = titleEl?.textContent?.trim();
        if (title === markdownCallout.title) {
          // Create a temporary callout info object
          calloutInfo = {
            domElement: el,
            markdownCallout: markdownCallout
          };
          break;
        }
      }
      
      if (!calloutInfo) return;
    }
    
    // Determine new collapsed state based on mode
    let newCollapsedState;
    if (mode === 'collapse') {
      newCollapsedState = true;
    } else if (mode === 'expand') {
      newCollapsedState = false;
    } else { // toggle
      newCollapsedState = !calloutInfo.domElement.classList.contains('is-collapsed');
    }
    
    // Apply the visual change
    applyCalloutCollapseState(calloutInfo.domElement, newCollapsedState);
    
    // Update the Markdown if requested
    if (modifyMarkdown) {
      detector.updateCalloutCollapseState(markdownCallout, newCollapsedState);
    }
  }

  // Toggle/collapse/expand all callouts within the current Markdown section.
  // Optionally updates the corresponding Markdown lines.
  toggleSectionCallouts(mode = 'toggle', modifyMarkdown = true) {
    const editor = this.app.workspace.activeEditor?.editor;
    if (!editor) return;

    try {
      const detector = new ObsidianCalloutDetector(editor);
      const cursor = editor.getCursor();
      const sectionCallouts = detector.getCalloutsInCurrentSection(cursor.line);
      
      if (!sectionCallouts.length) return;
      
      const matcher = this.getCalloutMatcher();
      const root = this.app.workspace.activeEditor?.containerEl;
      
      sectionCallouts.forEach(markdownCallout => {
        // Find the callout in the DOM first to determine its current visual state
        let calloutInfo = matcher?.getCalloutAtLine(markdownCallout.startLine);
        let currentVisualState = false; // Default if DOM element not found
        
        if (calloutInfo && calloutInfo.domElement) {
          currentVisualState = calloutInfo.domElement.classList.contains('is-collapsed');
        } else if (root) {
          // Fallback: try to find it directly in DOM by title
          const calloutElements = root.querySelectorAll('.callout');
          for (const el of calloutElements) {
            const titleEl = el.querySelector('.callout-title-inner');
            const title = titleEl?.textContent?.trim();
            if (title === markdownCallout.title) {
              currentVisualState = el.classList.contains('is-collapsed');
              break;
            }
          }
        }
        
        // Determine the action based on mode
        let newCollapsedState;
        if (mode === 'collapse') {
          newCollapsedState = true;
        } else if (mode === 'expand') {
          newCollapsedState = false;
        } else { // toggle mode
          // For visual-only mode, use the current DOM state
          // For markdown mode, use the markdown state
          newCollapsedState = modifyMarkdown ? !markdownCallout.isCollapsed : !currentVisualState;
        }
        
        // Update Markdown representation
        if (modifyMarkdown) {
          detector.updateCalloutCollapseState(markdownCallout, newCollapsedState);
        }
        
        // Find and update the DOM element
        if (root) {
          // Try to find it through the matcher first
          if (calloutInfo) {
            applyCalloutCollapseState(calloutInfo.domElement, newCollapsedState);
          } else {
            // Fallback: try to find it directly in the DOM by title
            const calloutElements = root.querySelectorAll('.callout');
            for (const el of calloutElements) {
              const titleEl = el.querySelector('.callout-title-inner');
              const title = titleEl?.textContent?.trim();
              if (title === markdownCallout.title) {
                applyCalloutCollapseState(el, newCollapsedState);
                break;
              }
            }
          }
        }
      });
    } catch (err) {
      // Prevent plugin crashes on unexpected DOM errors
      console.error("Toggle Callouts Plugin error in toggleSectionCallouts:", err);
    }
  }
}