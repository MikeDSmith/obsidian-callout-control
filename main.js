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
      // Use transaction API instead of direct replaceRange
      const transaction = this.editor.transaction({
        changes: [
          {
            from: { line: callout.startLine, ch: 0 },
            to: { line: callout.startLine, ch: startLine.length },
            text: updatedLine
          }
        ]
      });
      transaction.apply();
      return true;
    }
    
    return false;
  }
  
  /**
   * Update multiple callouts in a single transaction
   * 
   * @param {Array<CalloutInfo>} callouts - The callouts to update
   * @param {boolean|Array<boolean>} newStates - Either a single boolean state or array of states
   * @returns {boolean} True if update was successful
   */
  updateMultipleCallouts(callouts, newStates) {
    if (!this.editor || !callouts.length) return false;
    
    // Prepare the changes for all callouts
    const changes = callouts.map((callout, index) => {
      // Get the current line
      const lines = this.editor.getValue().split('\n');
      const line = lines[callout.startLine];
      if (!line) return null;
      
      // Determine the new state for this callout
      const newState = Array.isArray(newStates) ? newStates[index] : newStates;
      
      // Create the updated line
      const updatedLine = line.replace(
        this.CALLOUT_REGEX,
        (_, type, collapse, title) => `> [!${type}]${newState ? '-' : '+'} ${title}`
      );
      
      // Return the change object if the line actually changed
      if (updatedLine !== line) {
        return {
          from: { line: callout.startLine, ch: 0 },
          to: { line: callout.startLine, ch: line.length },
          text: updatedLine
        };
      }
      return null;
    }).filter(change => change !== null); // Remove any null entries
    
    if (changes.length === 0) return false;
    
    // Create and apply the transaction
    const transaction = this.editor.transaction({ changes });
    transaction.apply();
    return true;
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
 * CalloutSyncService bridges the MarkdownService and DOMService
 * This class is responsible for keeping the two representations in sync
 */
class CalloutSyncService {
  /**
   * Creates a new callout sync service
   * 
   * @param {CalloutMarkdownService} markdownService - The markdown service instance
   * @param {DOMCalloutService} domService - The DOM service instance
   */
  constructor(markdownService, domService) {
    this.markdownService = markdownService;
    this.domService = domService;
    this.calloutMap = new Map(); // Maps from unique IDs to callout info
    this.refreshCallouts();
  }

  /**
   * Refreshes the callout information map
   */
  refreshCallouts() {
    if (!this.markdownService || !this.domService) return;
    
    // Get all callouts from the markdown
    const markdownCallouts = this.markdownService.detectAllCallouts();
    
    // Get all callouts from the DOM
    const domCallouts = this.domService.getAllCalloutElements();
    
    this.calloutMap.clear();
    
    // Match DOM callouts with markdown callouts
    domCallouts.forEach((domElement, index) => {
      const { title, type, isCollapsed } = this.domService.getCalloutInfoFromElement(domElement);
      
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
   * Update the state of a callout in both DOM and Markdown
   * 
   * @param {CalloutMapInfo} calloutInfo - The callout info object
   * @param {boolean} newCollapsedState - The new collapse state
   * @returns {boolean} True if update was successful
   */
  updateCalloutState(calloutInfo, newCollapsedState) {
    let success = true;
    
    // Update the DOM
    if (calloutInfo.domElement) {
      this.domService.applyCalloutCollapseState(calloutInfo.domElement, newCollapsedState);
    }
    
    // Update the Markdown
    if (calloutInfo.markdownCallout) {
      success = this.markdownService.updateCalloutCollapseState(
        calloutInfo.markdownCallout, 
        newCollapsedState
      );
    }
    
    return success;
  }
  
  /**
   * Find the callout containing the given line in the document
   * 
   * @param {number} lineNumber - The line number to check
   * @returns {CalloutMapInfo|undefined} The containing callout or undefined
   */
  findCalloutContainingLine(lineNumber) {
    const markdownCallout = this.markdownService.findCalloutContainingLine(lineNumber);
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
    const sectionCallouts = this.markdownService.getCalloutsInCurrentSection(cursorLine);
    
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
    const closestMarkdownCallout = this.markdownService.getClosestCalloutToCursor(cursorLine);
    if (!closestMarkdownCallout) return null;
    
    return Array.from(this.calloutMap.values())
      .find(info => 
        info.markdownCallout && 
        info.markdownCallout.startLine === closestMarkdownCallout.startLine
      );
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
    const syncService = new CalloutSyncService(markdownService, domService);
    
    return {
      editor,
      modeService,
      markdownService,
      domService,
      syncService
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
      syncService 
    } = services;
    
    const cursor = editor.getCursor();
    
    // Check if we're in markdown mode
    const inMarkdownMode = modeService.isInMarkdownMode();
    
    // If in markdown mode and we're modifying markdown, use direct markdown methods
    if (inMarkdownMode && modifyMarkdown) {
      // Get the relevant callouts based on scope
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
      let newStates;
      
      if (mode === 'collapse') {
        newStates = true; // All collapsed
      } else if (mode === 'expand') {
        newStates = false; // All expanded
      } else if (mode === 'toggle-individual') {
        // Toggle each callout individually
        newStates = sortedCallouts.map(callout => !callout.isCollapsed);
      } else { // uniform toggle
        // Count current collapse states to determine majority
        const collapsedCount = callouts.filter(c => c.isCollapsed).length;
        const shouldCollapse = collapsedCount < callouts.length / 2;
        newStates = shouldCollapse; // Same state for all
      }
      
      // Use the batch update method
      markdownService.updateMultipleCallouts(sortedCallouts, newStates);
      
      return;
    }
    
    // For Live Preview mode or visual-only operations
    
    // Handle the different scopes
    if (scope === 'all') {
      const callouts = syncService.getAllCallouts();
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
          
          // Update DOM and Markdown
          if (modifyMarkdown) {
            syncService.updateCalloutState(calloutInfo, newState);
          } else {
            services.domService.applyCalloutCollapseState(calloutInfo.domElement, newState);
          }
        });
      } catch (err) {
        console.error("Toggle Callouts Plugin error:", err);
      }
    } else if (scope === 'current') {
      // Find the callout containing or near the cursor
      const markdownCallout = markdownService.findCalloutContainingLine(cursor.line) || 
                            markdownService.findCalloutAboveCursor(cursor.line);
      
      if (!markdownCallout) return;
      
      // Find the matching DOM element
      let calloutInfo = syncService.getCalloutAtLine(markdownCallout.startLine);
      
      // If no match through the matcher, try direct DOM lookup
      if (!calloutInfo) {
        const domElement = services.domService.findCalloutElementByTitle(markdownCallout.title);
        
        if (domElement) {
          calloutInfo = {
            domElement,
            markdownCallout
          };
        } else {
          return;
        }
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
      if (modifyMarkdown) {
        syncService.updateCalloutState(calloutInfo, newState);
      } else {
        services.domService.applyCalloutCollapseState(calloutInfo.domElement, newState);
      }
    } else if (scope === 'section') {
      // Get all callouts in the current section
      const sectionCallouts = markdownService.getCalloutsInCurrentSection(cursor.line);
      if (!sectionCallouts.length) return;
      
      try {
        // Process each callout in the section
        sectionCallouts.forEach(markdownCallout => {
          // Find the callout in the DOM
          let calloutInfo = syncService.getCalloutAtLine(markdownCallout.startLine);
          
          if (!calloutInfo) {
            // Try direct DOM lookup
            const domElement = services.domService.findCalloutElementByTitle(markdownCallout.title);
            
            if (domElement) {
              calloutInfo = { domElement, markdownCallout };
            }
          }
          
          // Determine new state based on mode
          let newState;
          if (mode === 'collapse') {
            newState = true;
          } else if (mode === 'expand') {
            newState = false;
          } else { // toggle
            const currentState = calloutInfo ? 
              calloutInfo.domElement.classList.contains('is-collapsed') : 
              markdownCallout.isCollapsed;
            newState = !currentState;
          }
          
          // Update Markdown
          if (modifyMarkdown) {
            markdownService.updateCalloutCollapseState(markdownCallout, newState);
          }
          
          // Update DOM if element found
          if (calloutInfo && calloutInfo.domElement) {
            services.domService.applyCalloutCollapseState(calloutInfo.domElement, newState);
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
   * @param {string} mode - 'toggle', 'collapse', or 'expand'
   * @param {boolean} modifyMarkdown - Whether to update the Markdown
   */
  processCallouts(mode, modifyMarkdown = false) {
    this.applyCalloutOperation('all', mode, modifyMarkdown);
  }
  
  /**
   * Toggle each callout individually
   * 
   * @param {boolean} modifyMarkdown - Whether to update the Markdown (default: true)
   */
  toggleWithMarkdown() {
    this.applyCalloutOperation('all', 'toggle-individual', true);
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
   * @param {string} mode - 'toggle', 'collapse', or 'expand'
   * @param {boolean} modifyMarkdown - Whether to update the Markdown
   */
  toggleSectionCallouts(mode = 'toggle', modifyMarkdown = true) {
    this.applyCalloutOperation('section', mode, modifyMarkdown);
  }
}