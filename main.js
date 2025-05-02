const { Plugin } = require('obsidian');

// Regular expression to identify callout patterns in Markdown
const CALLOUT_REGEX = /^>\s*\[!([\w-]+)\]([+-]?)\s*(.*)/;

/**
 * Core CalloutService that handles the Markdown parsing and manipulation
 * This class is responsible for all Markdown-related operations
 */
class CalloutMarkdownService {
  /**
   * Creates a new callout markdown service
   * 
   * @param {Editor} editor - The Obsidian editor instance to work with
   */
  constructor(editor) {
    this.editor = editor;
    this.CALLOUT_REGEX = CALLOUT_REGEX;
  }

  /**
   * Detect all callouts in the document with their full structure
   * 
   * @returns {Array<CalloutInfo>} Array of detected callouts with detailed structure
   */
  detectAllCallouts() {
    if (!this.editor) return [];
    
    const content = this.editor.getValue();
    const lines = content.split('\n');
    const callouts = [];
    
    for (let i = 0; i < lines.length; i++) {
      if (this.isCalloutStartLine(lines[i])) {
        const callout = this.processCallout(lines, i);
        if (callout) {
          callouts.push(callout);
          i = callout.endLine;
        }
      }
    }
    
    return callouts;
  }
  
  /**
   * Determine if a line starts a callout block
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
   * @param {string} line - The line to check
   * @returns {boolean} True if this is a callout continuation line
   */
  isCalloutContinuationLine(line) {
    const trimmed = line.trim();
    return trimmed.startsWith('>') && !this.isCalloutStartLine(line);
  }
  
  /**
   * Process a callout starting at the given line
   * 
   * @param {Array<string>} lines - All document lines
   * @param {number} startLineIndex - The line where the callout starts
   * @returns {CalloutInfo|null} The detected callout or null if invalid
   */
  processCallout(lines, startLineIndex) {
    const startLine = lines[startLineIndex];
    
    const match = startLine.match(this.CALLOUT_REGEX);
    if (!match) return null;
    
    const type = match[1];
    const collapseState = match[2] || '';
    const title = match[3].trim();
    
    const isCollapsed = collapseState === '-';
    
    const contentLines = [];
    let currentLine = startLineIndex + 1;
    let endLine = startLineIndex;
    let nesting = 0;
    
    while (currentLine < lines.length) {
      const line = lines[currentLine];
      
      if (this.isCalloutStartLine(line)) {
        nesting++;
        contentLines.push(line);
      } 
      else if (this.isCalloutContinuationLine(line)) {
        contentLines.push(line);
      }
      else {
        if (nesting > 0) {
          nesting--;
          contentLines.push(line);
        } else {
          endLine = currentLine - 1;
          break;
        }
      }
      
      currentLine++;
    }
    
    if (currentLine >= lines.length) {
      endLine = lines.length - 1;
    }
    
    const content = contentLines.map(line => {
      const match = line.match(/^>\s?(.*)/);
      return match ? match[1] : line;
    }).join('\n');
    
    const nestedCallouts = [];
    let contentLinesForNested = contentLines.slice();
    let nestedStartLine = 0;
    
    while (nestedStartLine < contentLinesForNested.length) {
      if (this.isCalloutStartLine(contentLinesForNested[nestedStartLine])) {
        const nestedLines = contentLinesForNested.slice(nestedStartLine);
        const nested = this.processCallout(nestedLines, 0);
        
        if (nested) {
          nested.startLine += startLineIndex + 1 + nestedStartLine;
          nested.endLine += startLineIndex + 1 + nestedStartLine;
          
          nestedCallouts.push(nested);
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
   * @param {CalloutInfo} callout - The callout object to update
   * @param {boolean} newCollapsedState - The new collapse state
   * @returns {boolean} True if update was successful
   */
  updateCalloutCollapseState(callout, newCollapsedState) {
    if (!this.editor || callout.startLine === undefined) return false;
    
    const lines = this.editor.getValue().split('\n');
    const startLine = lines[callout.startLine];
    
    const updatedLine = startLine.replace(
      this.CALLOUT_REGEX,
      (_, type, collapse, title) => `> [!${type}]${newCollapsedState ? '-' : '+'} ${title}`
    );
    
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
   * @param {number} lineNumber - The line number to check
   * @returns {CalloutInfo|null} The callout containing this line or null
   */
  findCalloutContainingLine(lineNumber) {
    const allCallouts = this.detectAllCallouts();
    
    for (const callout of allCallouts) {
      if (lineNumber >= callout.startLine && lineNumber <= callout.endLine) {
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
   * @param {CalloutInfo} parentCallout - The parent callout to check within
   * @param {number} lineNumber - The line number to find
   * @returns {CalloutInfo|null} The nested callout or null
   */
  findNestedCalloutContainingLine(parentCallout, lineNumber) {
    for (const nested of parentCallout.nestedCallouts) {
      if (lineNumber >= nested.startLine && lineNumber <= nested.endLine) {
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
   * @param {number} cursorLine - The line number to start searching from
   * @returns {Array<CalloutInfo>} Array of callouts in the current section
   */
  getCalloutsInCurrentSection(cursorLine) {
    if (!this.editor) return [];
    
    const lines = this.editor.getValue().split('\n');
    
    let sectionStart = cursorLine;
    while (sectionStart >= 0 && !lines[sectionStart].startsWith('#')) {
      sectionStart--;
    }
    
    let sectionEnd = cursorLine;
    while (sectionEnd < lines.length && !lines[sectionEnd].startsWith('#')) {
      sectionEnd++;
    }
    
    if (sectionStart < 0) sectionStart = 0;
    if (sectionEnd >= lines.length) sectionEnd = lines.length - 1;
    
    const allCallouts = this.detectAllCallouts();
    return allCallouts.filter(callout => 
      callout.startLine >= sectionStart && 
      callout.endLine <= sectionEnd
    );
  }
  
  /**
   * Get the closest callout to the cursor position
   * 
   * @param {number} cursorLine - The current cursor line
   * @returns {CalloutInfo|null} The closest callout or null
   */
  getClosestCalloutToCursor(cursorLine) {
    const containingCallout = this.findCalloutContainingLine(cursorLine);
    if (containingCallout) return containingCallout;
    
    const allCallouts = this.detectAllCallouts();
    if (!allCallouts.length) return null;
    
    return allCallouts.sort((a, b) => {
      const distA = Math.abs(a.startLine - cursorLine);
      const distB = Math.abs(b.startLine - cursorLine);
      return distA - distB;
    })[0];
  }
  
  /**
   * Scan upward from cursor to find the closest callout
   * 
   * @param {number} cursorLine - The current cursor line
   * @returns {CalloutInfo|null} The closest callout above or null
   */
  findCalloutAboveCursor(cursorLine) {
    if (!this.editor) return null;
    
    const lines = this.editor.getValue().split('\n');
    let lineIndex = cursorLine;
    
    while (lineIndex >= 0) {
      if (this.isCalloutStartLine(lines[lineIndex])) {
        return this.processCallout(lines, lineIndex);
      }
      lineIndex--;
    }
    
    return null;
  }
}

/**
 * DOMCalloutService for handling visual callouts in the preview mode
 * This class is responsible for manipulating the DOM callout elements
 */
class DOMCalloutService {
  /**
   * Creates a new DOM callout service
   * 
   * @param {HTMLElement} root - The root DOM element containing callouts
   */
  constructor(root) {
    this.root = root;
  }

  /**
   * Get all callout DOM elements in the document
   * 
   * @returns {Array<HTMLElement>} Array of callout DOM elements
   */
  getAllCalloutElements() {
    if (!this.root) return [];
    return Array.from(this.root.querySelectorAll('.callout'));
  }
  
  /**
   * Apply collapse/expand state to a callout DOM element
   * 
   * @param {HTMLElement} callout - The callout DOM element
   * @param {boolean} collapsed - Whether to collapse the callout
   */
  applyCalloutCollapseState(callout, collapsed) {
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
   * Apply collapse/expand state to all callout DOM elements
   * 
   * @param {boolean} collapsed - Whether to collapse all callouts
   */
  applyToAllCallouts(collapsed) {
    const callouts = this.getAllCalloutElements();
    callouts.forEach(callout => {
      this.applyCalloutCollapseState(callout, collapsed);
    });
  }
  
  /**
   * Get callout info from a DOM element
   * 
   * @param {HTMLElement} element - The callout DOM element
   * @returns {Object} Basic info about the callout
   */
  getCalloutInfoFromElement(element) {
    const titleEl = element.querySelector('.callout-title-inner');
    const title = titleEl?.textContent?.trim() || '';
    const type = element.getAttribute('data-callout') || '';
    const isCollapsed = element.classList.contains('is-collapsed');
    
    return { title, type, isCollapsed };
  }
  
  /**
   * Find callout element by title
   * 
   * @param {string} title - The callout title to find
   * @returns {HTMLElement|null} The found callout or null
   */
  findCalloutElementByTitle(title) {
    if (!this.root) return null;
    
    const calloutElements = this.root.querySelectorAll('.callout');
    for (const el of calloutElements) {
      const titleEl = el.querySelector('.callout-title-inner');
      const elTitle = titleEl?.textContent?.trim();
      if (elTitle === title) {
        return el;
      }
    }
    
    return null;
  }
}

/**
 * EditorModeService detects and provides information about the current editor mode
 */
class EditorModeService {
  /**
   * Creates a new editor mode service
   * 
   * @param {App} app - The Obsidian application instance
   */
  constructor(app) {
    this.app = app;
  }

  /**
   * Detect if the editor is in Markdown source mode rather than Live Preview
   * 
   * @returns {boolean} True if in Markdown mode
   */
  isInMarkdownMode() {
    // Get the current view mode
    const view = this.app.workspace.activeLeaf?.view;
    if (!view) return false;
    
    // Check if the view has a sourceMode property that's true
    return view.getMode() === 'source';
  }
}

/**
 * CalloutControlPlugin
 * 
 * The main plugin class that coordinates the services and provides
 * commands to the Obsidian interface.
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
    this.registerCommand('toggle-all-with-markdown', 'Toggle All Callouts Uniformly (with Markdown)', () => this.processCallouts('toggle', true));
    this.registerCommand('collapse-all-with-markdown', 'Collapse All Callouts (with Markdown)', () => this.processCallouts('collapse', true));
    this.registerCommand('expand-all-with-markdown', 'Expand All Callouts (with Markdown)', () => this.processCallouts('expand', true));

    // New "Flip" commands for toggling callouts individually
    this.registerCommand('flip-all', 'Flip All Callouts Individually (Visual Only)', () => this.processCallouts('toggle-individual'));
    this.registerCommand('flip-all-with-markdown', 'Flip All Callouts Individually (with Markdown)', () => this.processCallouts('toggle-individual', true));

    // Current Callout (Visual Only)
    this.registerCommand('toggle-current', 'Toggle Current Callout (Visual Only)', () => this.toggleCurrentCallout());
    this.registerCommand('collapse-current', 'Collapse Current Callout (Visual Only)', () => this.toggleCurrentCallout('collapse'));
    this.registerCommand('expand-current', 'Expand Current Callout (Visual Only)', () => this.toggleCurrentCallout('expand'));

    // Current Callout (with Markdown) - Works in both Live Preview and Markdown modes
    this.registerCommand('toggle-current-with-markdown', 'Toggle Current Callout (with Markdown)', () => this.toggleCurrentCallout('toggle', true));
    this.registerCommand('collapse-current-with-markdown', 'Collapse Current Callout (with Markdown)', () => this.toggleCurrentCallout('collapse', true));
    this.registerCommand('expand-current-with-markdown', 'Expand Current Callout (with Markdown)', () => this.toggleCurrentCallout('expand', true));

    // Section Callouts (Visual Only)
    this.registerCommand('toggle-section-visual', 'Toggle Section Callouts Uniformly (Visual Only)', () => this.toggleSectionCallouts('toggle'));
    this.registerCommand('collapse-section-visual', 'Collapse Section Callouts (Visual Only)', () => this.toggleSectionCallouts('collapse'));
    this.registerCommand('expand-section-visual', 'Expand Section Callouts (Visual Only)', () => this.toggleSectionCallouts('expand'));

    // Section Callouts (with Markdown) - Works in both Live Preview and Markdown modes
    this.registerCommand('toggle-section-with-markdown', 'Toggle Section Callouts Uniformly (with Markdown)', () => this.toggleSectionCallouts());
    this.registerCommand('collapse-section-with-markdown', 'Collapse Section Callouts (with Markdown)', () => this.toggleSectionCallouts('collapse'));
    this.registerCommand('expand-section-with-markdown', 'Expand Section Callouts (with Markdown)', () => this.toggleSectionCallouts('expand'));
    
    // Add new Flip commands for sections
    this.registerCommand('flip-section-visual', 'Flip Section Callouts Individually (Visual Only)', () => this.toggleSectionCallouts('toggle-individual'));
    this.registerCommand('flip-section-with-markdown', 'Flip Section Callouts Individually (with Markdown)', () => this.toggleSectionCallouts('toggle-individual'));
  }

  /**
   * Get the service instances for the current editor context
   * 
   * @returns {Object|null} Object containing the service instances, or null
   */
  getServices() {
    const editor = this.app.workspace.activeEditor?.editor;
    const root = this.app.workspace.activeEditor?.containerEl;
    if (!editor || !root) return null;
    
    const modeService = new EditorModeService(this.app);
    const markdownService = new CalloutMarkdownService(editor);
    const domService = new DOMCalloutService(root);
    
    return {
      editor,
      modeService,
      markdownService,
      domService
    };
  }
  
  /**
   * Apply a collapse/expand operation to callouts, with optional Markdown syncing
   * 
   * @param {string} scope - 'all', 'current', or 'section' 
   * @param {string} mode - 'toggle', 'collapse', 'expand', or 'toggle-individual'
   * @param {boolean} modifyMarkdown - Whether to update the Markdown
   */
  applyCalloutOperation(scope, mode, modifyMarkdown = false) {
    // Get services
    const services = this.getServices();
    if (!services) return;
    
    const { 
      editor, 
      modeService, 
      markdownService,
      domService
    } = services;
    
    const cursor = editor.getCursor();
    
    // Check if we're in markdown mode
    const inMarkdownMode = modeService.isInMarkdownMode();
    
    // If we're modifying markdown (for "with markdown" commands)
    if (modifyMarkdown) {
      // Determine which callouts to modify based on scope
      let callouts = [];
      if (scope === 'all') {
        callouts = markdownService.detectAllCallouts();
      } else if (scope === 'current') {
        const callout = markdownService.findCalloutContainingLine(cursor.line) || 
                       markdownService.findCalloutAboveCursor(cursor.line);
        if (callout) callouts = [callout];
      } else if (scope === 'section') {
        callouts = markdownService.getCalloutsInCurrentSection(cursor.line);
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
      
      // Update each callout in the Markdown
      sortedCallouts.forEach(callout => {
        markdownService.updateCalloutCollapseState(callout, getNewState(callout));
      });
      
      // No need to update DOM - Obsidian will handle that
      return;
    }
    
    // For Visual-only operations (no Markdown modification)
    
    // Handle the different scopes
    if (scope === 'all') {
      // For visual-only operations, just update all DOM elements
      const allCallouts = domService.getAllCalloutElements();
      if (!allCallouts.length) return;
      
      // Determine new state based on mode
      if (mode === 'collapse') {
        // All callouts get collapsed
        domService.applyToAllCallouts(true);
      } else if (mode === 'expand') {
        // All callouts get expanded
        domService.applyToAllCallouts(false);
      } else if (mode === 'toggle-individual') {
        // Each callout gets toggled individually
        allCallouts.forEach(element => {
          const currentState = element.classList.contains('is-collapsed');
          domService.applyCalloutCollapseState(element, !currentState);
        });
      } else { // uniform toggle
        // Base the toggle on the first callout's state
        const newState = !allCallouts[0].classList.contains('is-collapsed');
        domService.applyToAllCallouts(newState);
      }
    } else if (scope === 'current') {
      // Find the callout containing the cursor
      const calloutElements = domService.getAllCalloutElements();
      if (!calloutElements.length) return;
      
      // For visual operations, just use the DOM elements
      // Find the callout that contains the cursor or is closest
      const markdownCallout = markdownService.findCalloutContainingLine(cursor.line) || 
                            markdownService.findCalloutAboveCursor(cursor.line);
      if (!markdownCallout) return;
      
      // Go through callout elements to find one that matches (approximately)
      // This is a simplified approach without the sync service mapping
      let targetElement = null;
      
      calloutElements.forEach(element => {
        const titleElement = element.querySelector('.callout-title-inner');
        if (titleElement && titleElement.textContent.trim() === markdownCallout.title) {
          targetElement = element;
        }
      });
      
      if (!targetElement && calloutElements.length > 0) {
        // Fallback: just use the first callout if we can't find a match
        targetElement = calloutElements[0];
      }
      
      if (targetElement) {
        let newState;
        if (mode === 'collapse') {
          newState = true;
        } else if (mode === 'expand') {
          newState = false;
        } else { // toggle
          newState = !targetElement.classList.contains('is-collapsed');
        }
        
        domService.applyCalloutCollapseState(targetElement, newState);
      }
    } else if (scope === 'section') {
      // Get all callouts in the current section
      const sectionCallouts = markdownService.getCalloutsInCurrentSection(cursor.line);
      if (!sectionCallouts.length) return;
      
      // Visual-only operation - find matching DOM elements
      const calloutElements = domService.getAllCalloutElements();
      const matchingElements = [];
      
      // Match section callouts with DOM elements (simplified approach)
      calloutElements.forEach(element => {
        const titleElement = element.querySelector('.callout-title-inner');
        if (titleElement) {
          const title = titleElement.textContent.trim();
          if (sectionCallouts.some(callout => callout.title === title)) {
            matchingElements.push(element);
          }
        }
      });
      
      if (matchingElements.length) {
        // Determine new state based on mode
        if (mode === 'collapse') {
          // All section callouts get collapsed
          matchingElements.forEach(element => {
            domService.applyCalloutCollapseState(element, true);
          });
        } else if (mode === 'expand') {
          // All section callouts get expanded
          matchingElements.forEach(element => {
            domService.applyCalloutCollapseState(element, false);
          });
        } else if (mode === 'toggle-individual') {
          // Each section callout gets toggled individually
          matchingElements.forEach(element => {
            const currentState = element.classList.contains('is-collapsed');
            domService.applyCalloutCollapseState(element, !currentState);
          });
        } else { // uniform toggle
          // Count current collapsed elements to determine majority
          const collapsedCount = matchingElements.filter(element => 
            element.classList.contains('is-collapsed')
          ).length;
          
          const newState = collapsedCount < matchingElements.length / 2;
          
          // Apply to all matching elements
          matchingElements.forEach(element => {
            domService.applyCalloutCollapseState(element, newState);
          });
        }
      }
    }
  }

  /**
   * Process all callouts in the document
   * 
   * @param {string} mode - 'toggle', 'collapse', 'expand', or 'toggle-individual'
   * @param {boolean} modifyMarkdown - Whether to update the Markdown
   */
  processCallouts(mode, modifyMarkdown = false) {
    this.applyCalloutOperation('all', mode, modifyMarkdown);
  }
  
  /**
   * Toggle/collapse/expand the current callout
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
   * @param {string} mode - 'toggle', 'collapse', or 'expand', or 'toggle-individual'
   * @param {boolean} modifyMarkdown - Whether to update the Markdown
   */
  toggleSectionCallouts(mode = 'toggle', modifyMarkdown = true) {
    this.applyCalloutOperation('section', mode, modifyMarkdown);
  }
};