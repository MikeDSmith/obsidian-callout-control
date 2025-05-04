const { Plugin, PluginSettingTab, Setting, Notice } = require('obsidian');

// Constants and regular expressions
const CONSTANTS = {
  // Regular expression to identify callout patterns in Markdown
  CALLOUT_REGEX: /^>\s*\[!([\w-]+)\]([+-]?)\s*(.*)/,
  // Regular expression to identify callout continuation lines
  CONTINUATION_REGEX: /^>\s?(.*)/, 
  // Scopes for callout operations
  SCOPES: {
    ALL: 'all',
    CURRENT: 'current',
    SECTION: 'section'
  },
  // Modes for callout operations
  MODES: {
    TOGGLE: 'toggle',
    COLLAPSE: 'collapse',
    EXPAND: 'expand',
    TOGGLE_INDIVIDUAL: 'toggle-individual'
  }
};

/**
 * Callout class represents a callout in the document with behavior methods
 */
class Callout {
  /**
   * Creates a new callout object
   * 
   * @param {string} type - The callout type (note, warning, etc.)
   * @param {string} title - The callout title
   * @param {boolean} isCollapsed - Whether the callout is collapsed
   * @param {string} content - The content of the callout
   * @param {number} startLine - Line where the callout starts
   * @param {number} endLine - Line where the callout ends
   * @param {Array<Callout>} nestedCallouts - Child callouts inside this one
   * @param {string} rawLine - Original Markdown line that started the callout
   */
  constructor(type, title, isCollapsed, content, startLine, endLine, nestedCallouts = [], rawLine = '') {
    this.type = type;
    this.title = title;
    this.isCollapsed = isCollapsed;
    this.content = content;
    this.startLine = startLine;
    this.endLine = endLine;
    this.nestedCallouts = nestedCallouts;
    this.rawLine = rawLine;
  }

  /**
   * Check if this callout contains the given line number
   * 
   * @param {number} lineNumber - The line number to check
   * @returns {boolean} Whether the callout contains this line
   */
  containsLine(lineNumber) {
    return lineNumber >= this.startLine && lineNumber <= this.endLine;
  }

  /**
   * Find a nested callout that contains the given line
   * 
   * @param {number} lineNumber - The line number to find
   * @returns {Callout|null} The nested callout or null
   */
  findNestedCalloutWithLine(lineNumber) {
    for (const nested of this.nestedCallouts) {
      if (nested.containsLine(lineNumber)) {
        const deeperNested = nested.findNestedCalloutWithLine(lineNumber);
        return deeperNested || nested;
      }
    }
    return null;
  }

  /**
   * Get the distance from this callout to the given line
   * 
   * @param {number} lineNumber - The line to measure distance to
   * @returns {number} The distance in lines
   */
  distanceToLine(lineNumber) {
    if (this.containsLine(lineNumber)) return 0;
    return Math.min(
      Math.abs(this.startLine - lineNumber),
      Math.abs(this.endLine - lineNumber)
    );
  }

  /**
   * Create a new callout from markdown line match results
   * 
   * @param {Array} match - The regex match results
   * @param {number} startLineIndex - The starting line index
   * @returns {Callout} A new callout instance
   */
  static fromMatch(match, startLineIndex) {
    const type = match[1];
    const collapseState = match[2] || '';
    const title = match[3].trim();
    const isCollapsed = collapseState === '-';
    
    return new Callout(
      type,
      title,
      isCollapsed,
      '',  // content will be set later
      startLineIndex,
      startLineIndex,  // endLine will be updated during processing
      [],  // nestedCallouts will be added during processing
      match.input  // original raw line
    );
  }

  /**
   * Update this callout's collapse state
   * 
   * @param {boolean} newState - The new collapse state
   * @returns {string} The updated markdown line
   */
  updateCollapseState(newState) {
    return this.rawLine.replace(
      CONSTANTS.CALLOUT_REGEX,
      (_, type, collapse, title) => `> [!${type}]${newState ? '-' : '+'} ${title}`
    );
  }
}

/**
 * CalloutCommand class represents a command in the command registry
 */
class CalloutCommand {
  /**
   * Creates a new callout command
   * 
   * @param {string} id - Command ID
   * @param {string} name - Display name for the command
   * @param {string} scope - Scope of the command ('all', 'current', 'section')
   * @param {string} mode - Mode of operation ('toggle', 'collapse', 'expand', 'toggle-individual')
   * @param {boolean} modifyMarkdown - Whether the command modifies the underlying Markdown
   */
  constructor(id, name, scope, mode, modifyMarkdown) {
    this.id = id;
    this.name = name;
    this.scope = scope;
    this.mode = mode;
    this.modifyMarkdown = modifyMarkdown;
  }

  /**
   * Execute the command using the provided operation handler
   * 
   * @param {Function} operationHandler - Function to execute the operation
   */
  execute(operationHandler) {
    operationHandler(this.scope, this.mode, this.modifyMarkdown);
  }
}

/**
 * CalloutParser extracts callouts from Markdown text
 * This is a major refactoring of the previous processCallout method
 */
class CalloutParser {
  /**
   * Create a new callout parser
   */
  constructor() {
    this.CALLOUT_REGEX = CONSTANTS.CALLOUT_REGEX;
    this.CONTINUATION_REGEX = CONSTANTS.CONTINUATION_REGEX;
  }

  /**
   * Parse all callouts from a document
   * 
   * @param {string} content - The document content
   * @returns {Array<Callout>} Array of detected callouts
   */
  parseDocument(content) {
    const lines = content.split('\n');
    const callouts = [];
    
    for (let i = 0; i < lines.length; i++) {
      if (this.isCalloutStartLine(lines[i])) {
        const callout = this.parseCallout(lines, i);
        if (callout) {
          callouts.push(callout);
          i = callout.endLine; // Skip to end of this callout
        }
      }
    }
    
    return callouts;
  }

  /**
   * Check if a line starts a callout
   * 
   * @param {string} line - The line to check
   * @returns {boolean} True if this is a callout start line
   */
  isCalloutStartLine(line) {
    return this.CALLOUT_REGEX.test(line);
  }

  /**
   * Check if a line continues a callout
   * 
   * @param {string} line - The line to check
   * @returns {boolean} True if this is a callout continuation line
   */
  isCalloutContinuationLine(line) {
    const trimmed = line.trim();
    return trimmed.startsWith('>') && !this.isCalloutStartLine(line);
  }

  /**
   * Parse a callout starting at a specific line
   * 
   * @param {Array<string>} lines - All document lines
   * @param {number} startLineIndex - The starting line index
   * @returns {Callout|null} The parsed callout or null
   */
  parseCallout(lines, startLineIndex) {
    const startLine = lines[startLineIndex];
    const match = startLine.match(this.CALLOUT_REGEX);
    
    if (!match) return null;
    
    // Create a new callout from the match
    const callout = Callout.fromMatch(match, startLineIndex);
    
    // Extract content lines
    const { contentLines, endLine, nestedCallouts } = this.extractContent(
      lines, 
      startLineIndex + 1
    );
    
    // Update callout with extracted data
    callout.endLine = endLine;
    callout.content = this.formatContent(contentLines);
    callout.nestedCallouts = nestedCallouts;
    
    return callout;
  }

  /**
   * Extract content and nested callouts
   * 
   * @param {Array<string>} lines - All document lines
   * @param {number} startLine - The starting line for content
   * @returns {Object} The extracted content and metadata
   */
  extractContent(lines, startLine) {
    const contentLines = [];
    let currentLine = startLine;
    let endLine = startLine - 1;
    let nesting = 0;
    
    // Process lines until the end of this callout
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
    
    // Handle case where callout extends to end of document
    if (currentLine >= lines.length) {
      endLine = lines.length - 1;
    }
    
    // Parse nested callouts
    const nestedCallouts = this.parseNestedCallouts(
      contentLines, 
      startLine - 1
    );
    
    return {
      contentLines,
      endLine,
      nestedCallouts
    };
  }

  /**
   * Parse nested callouts from content lines
   * 
   * @param {Array<string>} contentLines - Content lines to parse
   * @param {number} parentStartLine - Starting line of parent callout
   * @returns {Array<Callout>} Nested callouts
   */
  parseNestedCallouts(contentLines, parentStartLine) {
    const nestedCallouts = [];
    let nestedStartLine = 0;
    
    while (nestedStartLine < contentLines.length) {
      if (this.isCalloutStartLine(contentLines[nestedStartLine])) {
        const nestedLines = contentLines.slice(nestedStartLine);
        const nested = this.parseCallout(nestedLines, 0);
        
        if (nested) {
          // Adjust line numbers to be relative to the document
          nested.startLine += parentStartLine + 1 + nestedStartLine;
          nested.endLine += parentStartLine + 1 + nestedStartLine;
          
          nestedCallouts.push(nested);
          nestedStartLine += nested.endLine - nested.startLine + 1;
        } else {
          nestedStartLine++;
        }
      } else {
        nestedStartLine++;
      }
    }
    
    return nestedCallouts;
  }

  /**
   * Format content by removing callout prefix
   * 
   * @param {Array<string>} contentLines - The raw content lines
   * @returns {string} Formatted content
   */
  formatContent(contentLines) {
    return contentLines.map(line => {
      const match = line.match(this.CONTINUATION_REGEX);
      return match ? match[1] : line;
    }).join('\n');
  }

  /**
   * Find the callout containing the given line
   * 
   * @param {Array<Callout>} callouts - All callouts in the document
   * @param {number} lineNumber - The line number to check
   * @returns {Callout|null} The callout containing the line or null
   */
  findCalloutContainingLine(callouts, lineNumber) {
    for (const callout of callouts) {
      if (callout.containsLine(lineNumber)) {
        return callout.findNestedCalloutWithLine(lineNumber) || callout;
      }
    }
    return null;
  }

  /**
   * Find the callout closest to the given line
   * 
   * @param {Array<Callout>} callouts - All callouts in the document
   * @param {number} lineNumber - The line number to check
   * @returns {Callout|null} The closest callout or null
   */
  findClosestCallout(callouts, lineNumber) {
    const containingCallout = this.findCalloutContainingLine(callouts, lineNumber);
    if (containingCallout) return containingCallout;
    
    if (!callouts.length) return null;
    
    // Sort by distance to line
    return callouts.sort((a, b) => {
      return a.distanceToLine(lineNumber) - b.distanceToLine(lineNumber);
    })[0];
  }

  /**
   * Get all callouts within the current section (between headings)
   * 
   * @param {Array<Callout>} callouts - All callouts in the document
   * @param {Array<string>} lines - All document lines
   * @param {number} cursorLine - The cursor line to start from
   * @returns {Array<Callout>} Callouts in the current section
   */
  getCalloutsInSection(callouts, lines, cursorLine) {
    // Find section boundaries
    let sectionStart = cursorLine;
    while (sectionStart >= 0 && !lines[sectionStart].startsWith('#')) {
      sectionStart--;
    }
    
    let sectionEnd = cursorLine;
    while (sectionEnd < lines.length && !lines[sectionEnd].startsWith('#')) {
      sectionEnd++;
    }
    
    // Adjust boundaries
    if (sectionStart < 0) sectionStart = 0;
    if (sectionEnd >= lines.length) sectionEnd = lines.length - 1;
    
    // Filter callouts in this section
    return callouts.filter(callout => 
      callout.startLine >= sectionStart && 
      callout.endLine <= sectionEnd
    );
  }
}

/**
 * Factory function to create a CalloutOperation that encapsulates
 * the logic for determining the new state of callouts
 */
function createCalloutOperation(mode, callouts) {
  // Return a function that determines the new state for each callout
  switch (mode) {
    case CONSTANTS.MODES.COLLAPSE:
      return () => true; // Always collapse
      
    case CONSTANTS.MODES.EXPAND:
      return () => false; // Always expand
      
    case CONSTANTS.MODES.TOGGLE_INDIVIDUAL:
      return (callout) => !callout.isCollapsed; // Flip each callout
      
    case CONSTANTS.MODES.TOGGLE:
    default:
      // Count current collapse states to determine majority
      const collapsedCount = callouts.filter(c => c.isCollapsed).length;
      const shouldCollapse = collapsedCount < callouts.length / 2;
      return () => shouldCollapse; // Toggle based on majority
  }
}

/**
 * CalloutMarkdownService - Improved version
 * This class handles the Markdown parsing and manipulation
 */
class CalloutMarkdownService {
  /**
   * Creates a new callout markdown service
   * 
   * @param {Editor} editor - The Obsidian editor instance to work with
   */
  constructor(editor) {
    this.editor = editor;
    this.parser = new CalloutParser();
  }

  /**
   * Detect all callouts in the document
   * 
   * @returns {Array<Callout>} Array of detected callouts
   */
  detectAllCallouts() {
    if (!this.editor) return [];
    const content = this.editor.getValue();
    return this.parser.parseDocument(content);
  }

  /**
   * Find the callout containing the given line
   * 
   * @param {number} lineNumber - The line number to check
   * @returns {Callout|null} The callout containing this line or null
   */
  findCalloutContainingLine(lineNumber) {
    const allCallouts = this.detectAllCallouts();
    return this.parser.findCalloutContainingLine(allCallouts, lineNumber);
  }

  /**
   * Get the closest callout to the cursor position
   * 
   * @param {number} cursorLine - The current cursor line
   * @returns {Callout|null} The closest callout or null
   */
  getClosestCalloutToCursor(cursorLine) {
    const allCallouts = this.detectAllCallouts();
    return this.parser.findClosestCallout(allCallouts, cursorLine);
  }

  /**
   * Find a callout above the cursor
   * 
   * @param {number} cursorLine - The current cursor line
   * @returns {Callout|null} The callout above the cursor or null
   */
  findCalloutAboveCursor(cursorLine) {
    if (!this.editor) return null;
    const content = this.editor.getValue();
    const lines = content.split('\n');
    
    // Scan upward from cursor
    for (let lineIndex = cursorLine; lineIndex >= 0; lineIndex--) {
      if (this.parser.isCalloutStartLine(lines[lineIndex])) {
        return this.parser.parseCallout(lines, lineIndex);
      }
    }
    
    return null;
  }

  /**
   * Get all callouts in the current section
   * 
   * @param {number} cursorLine - The cursor line
   * @returns {Array<Callout>} Callouts in the current section
   */
  getCalloutsInCurrentSection(cursorLine) {
    if (!this.editor) return [];
    
    const allCallouts = this.detectAllCallouts();
    const lines = this.editor.getValue().split('\n');
    
    return this.parser.getCalloutsInSection(allCallouts, lines, cursorLine);
  }

  /**
   * Update a callout's collapse state in the document
   * 
   * @param {Callout} callout - The callout to update
   * @param {boolean} newState - The new collapse state
   * @returns {boolean} True if update was successful
   */
  updateCalloutCollapseState(callout, newState) {
    if (!this.editor || callout.startLine === undefined) return false;
    
    // Get the updated line from the callout
    const updatedLine = callout.updateCollapseState(newState);
    
    // Get the original line for comparison
    const lines = this.editor.getValue().split('\n');
    const originalLine = lines[callout.startLine];
    
    // Only update if the line has changed
    if (updatedLine !== originalLine) {
      this.editor.replaceRange(
        updatedLine,
        { line: callout.startLine, ch: 0 },
        { line: callout.startLine, ch: originalLine.length }
      );
      return true;
    }
    
    return false;
  }
}

/**
 * DOMCalloutService - Improved version
 * This class handles the DOM manipulation for callouts
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
   * Add data attributes to DOM elements for better correlation
   * 
   * @param {Array<Callout>} callouts - All callouts in the document
   */
  addDataAttributes(callouts) {
    const elements = this.getAllCalloutElements();
    
    // Skip if no elements or callouts
    if (!elements.length || !callouts.length) return;
    
    // Match elements with callouts by content and add data attributes
    elements.forEach((element, index) => {
      // Try to match with a callout from the list
      const callout = this.findMatchingCallout(element, callouts);
      
      if (callout) {
        // Store lines in data attributes
        element.dataset.startLine = callout.startLine;
        element.dataset.endLine = callout.endLine;
        element.dataset.type = callout.type;
      } else {
        // Use index as fallback
        element.dataset.index = index;
      }
    });
  }

  /**
   * Find a callout that matches the DOM element
   * 
   * @param {HTMLElement} element - DOM element to match
   * @param {Array<Callout>} callouts - All callouts in the document
   * @returns {Callout|null} The matching callout or null
   */
  findMatchingCallout(element, callouts) {
    const titleElement = element.querySelector('.callout-title-inner');
    const contentElement = element.querySelector('.callout-content');
    const typeElement = element.querySelector('.callout-title');
    
    if (!titleElement || !contentElement) return null;
    
    const title = titleElement.textContent.trim();
    const content = contentElement.textContent.trim();
    const typeClass = typeElement ? 
      Array.from(typeElement.classList)
        .find(cls => cls.startsWith('callout-title-')) : null;
    
    // Extract type from class (callout-title-info -> info)
    const type = typeClass ? 
      typeClass.replace('callout-title-', '') : null;
    
    // Find callout with matching title and type
    return callouts.find(callout => {
      const titleMatch = callout.title === title;
      const typeMatch = !type || callout.type === type;
      
      // For smaller callouts, check content too
      if (content.length < 50) {
        const contentMatch = callout.content.includes(content) ||
                            content.includes(callout.content);
        return titleMatch && typeMatch && contentMatch;
      }
      
      return titleMatch && typeMatch;
    });
  }

  /**
   * Apply collapse/expand state to a callout DOM element
   * 
   * @param {HTMLElement} element - The callout DOM element
   * @param {boolean} collapsed - Whether to collapse the callout
   */
  applyCalloutCollapseState(element, collapsed) {
    if (!element) return;

    const content = element.querySelector('.callout-content');
    const foldIcon = element.querySelector('.callout-fold');
    
    // Only apply if state is different from current
    const currentlyCollapsed = element.classList.contains('is-collapsed');
    if (collapsed !== currentlyCollapsed) {
      // Toggle collapsed class
      element.classList.toggle('is-collapsed', collapsed);
      
      // Update fold icon
      if (foldIcon) {
        foldIcon.classList.toggle('is-collapsed', collapsed);
      }
      
      // Hide/show content
      if (content) {
        content.setAttribute('style', collapsed ? 'display: none;' : '');
      }
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
   * Get all callout DOM elements within the current section
   * 
   * @param {number} cursorLine - The line number where the cursor is located
   * @param {Array<string>} lines - All lines in the document
   * @param {Array<Callout>} callouts - All callouts in the document (optional)
   * @returns {Array<HTMLElement>} Array of callout DOM elements in the current section
   */
  getCalloutsInCurrentSection(cursorLine, lines, callouts = null) {
    // Find section boundaries
    let sectionStart = cursorLine;
    let sectionEnd = cursorLine;

    // Determine section boundaries based on headings
    while (sectionStart >= 0 && !lines[sectionStart].startsWith('#')) {
      sectionStart--;
    }
    while (sectionEnd < lines.length && !lines[sectionEnd].startsWith('#')) {
      sectionEnd++;
    }

    // Adjust boundaries
    if (sectionStart < 0) sectionStart = 0;
    if (sectionEnd >= lines.length) sectionEnd = lines.length - 1;

    // If we have data attributes, use them for precise matching
    const elements = this.getAllCalloutElements();
    const elementsWithDataAttrs = elements.filter(el => el.dataset.startLine !== undefined);
    
    if (elementsWithDataAttrs.length > 0) {
      // Use data attributes for precise matching
      return elementsWithDataAttrs.filter(element => {
        const startLine = parseInt(element.dataset.startLine);
        const endLine = parseInt(element.dataset.endLine);
        return startLine >= sectionStart && endLine <= sectionEnd;
      });
    }
    
    // If we have callouts, try to match by content
    if (callouts) {
      // Get callouts in this section
      const sectionCallouts = callouts.filter(
        callout => callout.startLine >= sectionStart && callout.endLine <= sectionEnd
      );
      
      // Match DOM elements to these callouts
      return elements.filter(element => {
        return sectionCallouts.some(callout => 
          this.findMatchingCallout(element, [callout]) !== null
        );
      });
    }

    // Fallback to content matching (less precise)
    return elements.filter(element => {
      const calloutContent = element.querySelector('.callout-content')?.textContent.trim();
      if (!calloutContent) return false;
      
      // Try to find a line that contains this content
      for (let i = sectionStart; i <= sectionEnd; i++) {
        if (lines[i].includes(calloutContent.substring(0, 20))) {
          return true;
        }
      }
      return false;
    });
  }

  /**
   * Get the closest callout DOM element to the cursor position
   * 
   * @param {number} cursorLine - The line number where the cursor is located
   * @param {Array<string>} lines - All lines in the document
   * @param {Array<Callout>} callouts - All callouts in the document (optional)
   * @returns {HTMLElement|null} The closest callout DOM element or null
   */
  getClosestCalloutToCursor(cursorLine, lines, callouts = null) {
    const calloutElements = this.getAllCalloutElements();
    if (!calloutElements.length) return null;

    // If we have data attributes, use them for precise matching
    const elementsWithDataAttrs = calloutElements.filter(el => el.dataset.startLine !== undefined);
    
    if (elementsWithDataAttrs.length > 0) {
      // Find containing element using data attributes
      const containingElement = elementsWithDataAttrs.find(element => {
        const startLine = parseInt(element.dataset.startLine);
        const endLine = parseInt(element.dataset.endLine);
        return cursorLine >= startLine && cursorLine <= endLine;
      });
      
      if (containingElement) {
        return containingElement;
      }
      
      // Find closest element by distance
      return elementsWithDataAttrs.sort((a, b) => {
        const aStartLine = parseInt(a.dataset.startLine);
        const aEndLine = parseInt(a.dataset.endLine);
        const bStartLine = parseInt(b.dataset.startLine);
        const bEndLine = parseInt(b.dataset.endLine);
        
        const aDistance = Math.min(
          Math.abs(aStartLine - cursorLine), 
          Math.abs(aEndLine - cursorLine)
        );
        const bDistance = Math.min(
          Math.abs(bStartLine - cursorLine), 
          Math.abs(bEndLine - cursorLine)
        );
        
        return aDistance - bDistance;
      })[0];
    }
    
    // If we have callouts, try to match by content
    if (callouts) {
      // Find callout at or closest to cursor
      const targetCallout = callouts.find(c => c.containsLine(cursorLine)) || 
                           callouts.sort((a, b) => 
                             a.distanceToLine(cursorLine) - b.distanceToLine(cursorLine)
                           )[0];
      
      if (targetCallout) {
        // Find matching DOM element
        return calloutElements.find(element => 
          this.findMatchingCallout(element, [targetCallout]) !== null
        );
      }
    }

    // Fallback to content matching (less precise)
    let closestElement = null;
    let closestDistance = Infinity;

    calloutElements.forEach(element => {
      const calloutContent = element.querySelector('.callout-content')?.textContent.trim();
      if (!calloutContent) return;
      
      // Find the line number of the callout by matching its content with the lines
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(calloutContent.substring(0, 20))) {
          const distance = Math.abs(i - cursorLine);
          if (distance < closestDistance) {
            closestDistance = distance;
            closestElement = element;
          }
          break;
        }
      }
    });

    return closestElement;
  }
}

/**
 * ErrorHandler manages error reporting and logging
 */
class ErrorHandler {
  /**
   * Log an error without showing to user
   * 
   * @param {string} message - Error message
   * @param {Error} error - Error object
   */
  logError(message, error) {
    console.error(`Callout Control: ${message}`, error);
  }
  
  /**
   * Handle an error with user notification
   * 
   * @param {string} message - Error message
   * @param {Error} error - Error object
   * @param {string} userMessage - Message to show to the user
   */
  handleError(message, error, userMessage) {
    // Log error
    this.logError(message, error);
    
    // Show notification if available
    if (window.activeWindow) {
      const notice = new Notice(`Callout Control: ${userMessage}`);
    }
  }
}

/**
 * PluginSettings class encapsulates the settings for the plugin
 */
class PluginSettings {
  /**
   * Create a new settings object with default values
   */
  constructor() {
    this.commands = {};
    this.groupsEnabled = {
      all: true,
      current: true,
      section: true
    };
  }

  /**
   * Merge default settings with loaded settings
   * 
   * @param {Object} loadedSettings - Settings loaded from storage
   * @returns {PluginSettings} The merged settings
   */
  merge(loadedSettings) {
    if (!loadedSettings) return this;
    
    // Merge command settings
    if (loadedSettings.commands) {
      this.commands = { ...this.commands, ...loadedSettings.commands };
    }
    
    // Merge group settings
    if (loadedSettings.groupsEnabled) {
      this.groupsEnabled = { ...this.groupsEnabled, ...loadedSettings.groupsEnabled };
    }
    
    return this;
  }

  /**
   * Check if a command is enabled
   * 
   * @param {string} commandId - The command ID to check
   * @returns {boolean} Whether the command is enabled
   */
  isCommandEnabled(commandId) {
    return this.commands[commandId] !== false; // Default to enabled if not set
  }

  /**
   * Enable or disable a command
   * 
   * @param {string} commandId - The command ID to update
   * @param {boolean} enabled - Whether to enable the command
   */
  setCommandEnabled(commandId, enabled) {
    this.commands[commandId] = enabled;
  }

  /**
   * Enable or disable all commands in a group
   * 
   * @param {string} group - The group to update ('all', 'current', 'section')
   * @param {boolean} enabled - Whether to enable the group
   * @param {Array<CalloutCommand>} commands - All commands to update
   */
  setGroupEnabled(group, enabled, commands) {
    this.groupsEnabled[group] = enabled;
    
    // Update all commands in this group
    commands.forEach(cmd => {
      if (cmd.scope === group) {
        this.setCommandEnabled(cmd.id, enabled);
      }
    });
  }

  /**
   * Create a plain object representation for storage
   * 
   * @returns {Object} Plain object for storage
   */
  toObject() {
    return {
      commands: { ...this.commands },
      groupsEnabled: { ...this.groupsEnabled }
    };
  }
}

/**
 * CommandRegistry manages the plugin's available commands
 */
class CommandRegistry {
  /**
   * Create a new command registry
   * 
   * @param {Plugin} plugin - The Obsidian plugin instance
   * @param {PluginSettings} settings - The plugin settings
   */
  constructor(plugin, settings) {
    this.plugin = plugin;
    this.settings = settings;
    this.commands = [];
    this.registeredIds = [];
  }

  /**
   * Initialize the command registry with the provided command table
   * 
   * @param {Array} commandTable - Table of command definitions
   * @returns {CommandRegistry} This registry instance for chaining
   */
  initializeFromTable(commandTable) {
    this.commands = commandTable.map(([id, name, scope, mode, modifyMarkdown]) => 
      new CalloutCommand(id, name, scope, mode, modifyMarkdown)
    );
    return this;
  }

  /**
   * Register all enabled commands
   * 
   * @param {Function} operationHandler - Function to handle command operations
   */
  registerCommands(operationHandler) {
    // Clear any previously registered commands
    this.unregisterAllCommands();
    
    // Register each enabled command
    this.commands.forEach(command => {
      if (this.settings.isCommandEnabled(command.id)) {
        const fullId = `callout-control.${command.id}`;
        this.registeredIds.push(fullId);
        
        this.plugin.addCommand({
          id: fullId,
          name: command.name,
          callback: () => command.execute(operationHandler)
        });
      }
    });
  }

  /**
   * Unregister all previously registered commands
   */
  unregisterAllCommands() {
    this.registeredIds.forEach(id => {
      this.plugin.removeCommand(id);
    });
    this.registeredIds = [];
  }

  /**
   * Get all commands with a specific scope
   * 
   * @param {string} scope - The scope to filter by
   * @returns {Array<CalloutCommand>} Commands with the given scope
   */
  getCommandsByScope(scope) {
    return this.commands.filter(cmd => cmd.scope === scope);
  }

  /**
   * Get all command scopes
   * 
   * @returns {Array<string>} Array of unique scopes
   */
  getAllScopes() {
    return [...new Set(this.commands.map(cmd => cmd.scope))];
  }
}

/**
 * Settings tab for the Callout Control plugin
 */
class CalloutControlSettingsTab extends PluginSettingTab {
  /**
   * Create a new settings tab
   * 
   * @param {App} app - The Obsidian application instance
   * @param {CalloutControlPlugin} plugin - The plugin instance
   */
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  /**
   * Display the settings UI
   */
  display() {
    const { containerEl } = this;
    containerEl.empty();

    // Add styling for group containers
    this.addGroupContainerStyles();

    // Add settings header and description
    this.addHeaderAndDescription();

    // Group commands by scope for display
    const groupedCommands = this.groupCommandsByScope();

    // Render settings for each command group
    this.renderGroupSettings(groupedCommands);
  }

  /**
   * Add CSS styling for group containers
   */
  addGroupContainerStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .callout-control-group {
        margin-bottom: 2em;
        padding: 0.5em 1em;
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
      }
      .callout-control-group h3 {
        margin-top: 0;
      }
      .callout-control-description {
        margin-bottom: 1em;
        color: var(--text-muted);
        font-size: 0.9em;
      }
    `;
    this.containerEl.appendChild(style);
  }

  /**
   * Add header and description to settings
   */
  addHeaderAndDescription() {
    const heading = this.containerEl.createEl('h3', { text: 'Available Commands' });
    
    const description = document.createElement('div');
    description.className = 'callout-control-description';
    description.textContent = 'Enable or disable specific commands shown in the command palette.';
    
    heading.insertAdjacentElement('afterend', description);
  }

  /**
   * Group commands by their scope
   * 
   * @returns {Object} Commands grouped by scope
   */
  groupCommandsByScope() {
    // Get all commands from the registry
    const commands = this.plugin.commandRegistry.commands;
    
    // Group by scope
    return commands.reduce((groups, command) => {
      if (!groups[command.scope]) {
        groups[command.scope] = [];
      }
      groups[command.scope].push(command);
      return groups;
    }, {});
  }

  /**
   * Render settings for all command groups
   * 
   * @param {Object} groupedCommands - Commands grouped by scope
   */
  renderGroupSettings(groupedCommands) {
    Object.entries(groupedCommands).forEach(([scope, commands]) => {
      this.renderScopeGroup(scope, commands);
    });
  }

  /**
   * Render settings for a specific command scope
   * 
   * @param {string} scope - The command scope
   * @param {Array<CalloutCommand>} commands - Commands in this scope
   */
  renderScopeGroup(scope, commands) {
    // Create group container
    const section = this.containerEl.createDiv({ cls: 'callout-control-group' });
    
    // Add scope heading
    const formattedScope = scope.charAt(0).toUpperCase() + scope.slice(1);
    section.createEl('h3', { text: formattedScope });
    
    // Add scope description
    let scopeDescription = '';
    switch (scope) {
      case CONSTANTS.SCOPES.ALL:
        scopeDescription = 'Commands that affect all callouts in the document.';
        break;
      case CONSTANTS.SCOPES.CURRENT:
        scopeDescription = 'Commands that affect the callout at or nearest to the cursor.';
        break;
      case CONSTANTS.SCOPES.SECTION:
        scopeDescription = 'Commands that affect callouts in the current section (between headings).';
        break;
    }
    
    const descEl = section.createDiv({ cls: 'callout-control-description' });
    descEl.textContent = scopeDescription;

    // Add group toggle
    this.addGroupToggle(section, scope, commands);

    // Separate markdown and visual commands
    const markdownCommands = commands.filter(cmd => cmd.modifyMarkdown);
    const visualCommands = commands.filter(cmd => !cmd.modifyMarkdown);

    // Add subheadings if both types exist
    if (markdownCommands.length && visualCommands.length) {
      const markdownHeading = section.createEl('h4', { text: 'Markdown Commands' });
      markdownHeading.style.marginTop = '1em';
      markdownHeading.style.marginBottom = '0.5em';
      
      markdownCommands.forEach(command => {
        this.addCommandToggle(section, command);
      });
      
      const visualHeading = section.createEl('h4', { text: 'Visual-Only Commands' });
      visualHeading.style.marginTop = '1em';
      visualHeading.style.marginBottom = '0.5em';
      
      visualCommands.forEach(command => {
        this.addCommandToggle(section, command);
      });
    } else {
      // Just list all commands without subheadings
      commands.forEach(command => {
        this.addCommandToggle(section, command);
      });
    }
  }

  /**
   * Add a toggle for enabling/disabling all commands in a group
   * 
   * @param {HTMLElement} containerEl - Container element
   * @param {string} scope - Command scope
   * @param {Array<CalloutCommand>} commands - Commands in this scope
   */
  addGroupToggle(containerEl, scope, commands) {
    const formattedScope = scope.charAt(0).toUpperCase() + scope.slice(1);
    
    new Setting(containerEl)
      .setName(`Enable ${formattedScope} Commands`)
      .setDesc(`Toggle all commands that affect ${scope} callouts`)
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.groupsEnabled[scope] || false)
        .onChange(async (value) => {
          // Update all commands in this group
          this.plugin.settings.setGroupEnabled(scope, value, commands);
          
          // Save settings
          await this.plugin.saveSettings();
          
          // Refresh commands in the command palette
          this.plugin.commandRegistry.registerCommands(
            (scope, mode, modifyMarkdown) => 
              this.plugin.applyCalloutOperation(scope, mode, modifyMarkdown)
          );
          
          // Redraw settings panel to reflect changes
          this.display();
        })
      );
  }

  /**
   * Add a toggle for a specific command
   * 
   * @param {HTMLElement} containerEl - Container element
   * @param {CalloutCommand} command - The command to add a toggle for
   */
  addCommandToggle(containerEl, command) {
    // Determine if command is enabled
    const isEnabled = this.plugin.settings.isCommandEnabled(command.id);
    
    // Create a descriptive name based on command properties
    let displayName = command.name;
    
    // Add description based on mode
    let description = '';
    switch (command.mode) {
      case CONSTANTS.MODES.TOGGLE:
        description = 'Toggles all callouts based on the majority state';
        break;
      case CONSTANTS.MODES.COLLAPSE:
        description = 'Collapses all callouts';
        break;
      case CONSTANTS.MODES.EXPAND:
        description = 'Expands all callouts';
        break;
      case CONSTANTS.MODES.TOGGLE_INDIVIDUAL:
        description = 'Toggles each callout individually';
        break;
    }
    
    // Add setting toggle
    new Setting(containerEl)
      .setName(displayName)
      .setDesc(description)
      .addToggle(toggle => {
        toggle
          .setValue(isEnabled)
          .onChange(async (value) => {
            // Update command state
            this.plugin.settings.setCommandEnabled(command.id, value);
            
            // If enabling a command, ensure its group is enabled
            if (value) {
              this.plugin.settings.groupsEnabled[command.scope] = true;
            }
            
            // Save settings
            await this.plugin.saveSettings();
            
            // Refresh commands in the command palette
            this.plugin.commandRegistry.registerCommands(
              (scope, mode, modifyMarkdown) => 
                this.plugin.applyCalloutOperation(scope, mode, modifyMarkdown)
            );
            
            // Redraw settings panel to reflect changes
            this.display();
          });
      });
  }
}

/**
 * CalloutControlPlugin - Refactored main plugin class
 * 
 * The main plugin class that coordinates the services and provides
 * commands to the Obsidian interface.
 */
module.exports = class CalloutControlPlugin extends Plugin {
  /**
   * Initialize plugin properties
   */
  constructor(app, manifest) {
    super(app, manifest);
    
    // Initialize settings
    this.settings = new PluginSettings();
    
    // Command registry
    this.commandRegistry = new CommandRegistry(this, this.settings);
    
    // Error handler
    this.errorHandler = new ErrorHandler();
  }
  
  /**
   * Load settings from storage
   */
  async loadSettings() {
    try {
      const loadedData = await this.loadData();
      this.settings.merge(loadedData);
    } catch (error) {
      this.errorHandler.handleError(
        "Failed to load settings", 
        error,
        "Using default settings instead."
      );
    }
  }

  /**
   * Save settings to storage
   */
  async saveSettings() {
    try {
      await this.saveData(this.settings.toObject());
    } catch (error) {
      this.errorHandler.handleError(
        "Failed to save settings", 
        error,
        "Your changes may not persist after restarting Obsidian."
      );
    }
  }
  
  /**
   * Initialize the plugin and register commands
   */
  async onload() {
    try {
      // Load settings at startup
      await this.loadSettings();
      
      // Initialize command registry with command table
      this.commandRegistry.initializeFromTable([
        // Current Callout (Markdown)
        ['toggle-current-markdown', 'Toggle Current', CONSTANTS.SCOPES.CURRENT, CONSTANTS.MODES.TOGGLE, true],
        ['collapse-current-markdown', 'Collapse Current', CONSTANTS.SCOPES.CURRENT, CONSTANTS.MODES.COLLAPSE, true],
        ['expand-current-markdown', 'Expand Current', CONSTANTS.SCOPES.CURRENT, CONSTANTS.MODES.EXPAND, true],
      
        // Section Callouts (Markdown)
        ['toggle-section-markdown', 'Toggle Section', CONSTANTS.SCOPES.SECTION, CONSTANTS.MODES.TOGGLE, true],
        ['collapse-section-markdown', 'Collapse Section', CONSTANTS.SCOPES.SECTION, CONSTANTS.MODES.COLLAPSE, true],
        ['expand-section-markdown', 'Expand Section', CONSTANTS.SCOPES.SECTION, CONSTANTS.MODES.EXPAND, true],
        ['flip-section-markdown', 'Flip Section', CONSTANTS.SCOPES.SECTION, CONSTANTS.MODES.TOGGLE_INDIVIDUAL, true],
      
        // All Callouts (Markdown)
        ['toggle-all-markdown', 'Toggle All', CONSTANTS.SCOPES.ALL, CONSTANTS.MODES.TOGGLE, true],
        ['collapse-all-markdown', 'Collapse All', CONSTANTS.SCOPES.ALL, CONSTANTS.MODES.COLLAPSE, true],
        ['expand-all-markdown', 'Expand All', CONSTANTS.SCOPES.ALL, CONSTANTS.MODES.EXPAND, true],
        ['flip-all-markdown', 'Flip All', CONSTANTS.SCOPES.ALL, CONSTANTS.MODES.TOGGLE_INDIVIDUAL, true],
      
        // Section Callouts (Visual Only)
        ['toggle-section-visual', 'Toggle Section (Visual)', CONSTANTS.SCOPES.SECTION, CONSTANTS.MODES.TOGGLE, false],
        ['collapse-section-visual', 'Collapse Section (Visual)', CONSTANTS.SCOPES.SECTION, CONSTANTS.MODES.COLLAPSE, false],
        ['expand-section-visual', 'Expand Section (Visual)', CONSTANTS.SCOPES.SECTION, CONSTANTS.MODES.EXPAND, false],
        ['flip-section-visual', 'Flip Section (Visual)', CONSTANTS.SCOPES.SECTION, CONSTANTS.MODES.TOGGLE_INDIVIDUAL, false],
      
        // All Callouts (Visual Only)
        ['toggle-all-visual', 'Toggle All (Visual)', CONSTANTS.SCOPES.ALL, CONSTANTS.MODES.TOGGLE, false],
        ['collapse-all-visual', 'Collapse All (Visual)', CONSTANTS.SCOPES.ALL, CONSTANTS.MODES.COLLAPSE, false],
        ['expand-all-visual', 'Expand All (Visual)', CONSTANTS.SCOPES.ALL, CONSTANTS.MODES.EXPAND, false],
        ['flip-all-visual', 'Flip All (Visual)', CONSTANTS.SCOPES.ALL, CONSTANTS.MODES.TOGGLE_INDIVIDUAL, false],
      ]);
      
      // Register commands with operation handler
      this.commandRegistry.registerCommands(
        (scope, mode, modifyMarkdown) => this.applyCalloutOperation(scope, mode, modifyMarkdown)
      );
      
      // Add settings tab
      this.addSettingTab(new CalloutControlSettingsTab(this.app, this));
      
      // Register event handlers for editor changes
      this.registerEditorHandlers();
      
    } catch (error) {
      this.errorHandler.handleError(
        "Failed to initialize plugin", 
        error,
        "Please try restarting Obsidian."
      );
    }
  }
  
  /**
   * Register event handlers for editor changes
   */
  registerEditorHandlers() {
    // Listen for editor changes to update data attributes
    this.registerEvent(
      this.app.workspace.on('editor-change', (editor) => {
        try {
          this.updateDataAttributes(editor);
        } catch (error) {
          // Silently handle errors in event handlers
          this.errorHandler.logError(
            "Error updating data attributes", 
            error
          );
        }
      })
    );
  }
  
  /**
   * Update data attributes on callout DOM elements
   * 
   * @param {Editor} editor - The editor that changed
   */
  updateDataAttributes(editor) {
    // Get services
    const services = this.getServices();
    if (!services) return;
    
    const { markdownService, domService } = services;
    
    // Get all callouts in the document
    const callouts = markdownService.detectAllCallouts();
    
    // Add data attributes to DOM elements
    domService.addDataAttributes(callouts);
  }

  /**
   * Get the service instances for the current editor context
   * 
   * @returns {Object|null} Object containing the service instances, or null
   */
  getServices() {
    try {
      const editor = this.app.workspace.activeEditor?.editor;
      const root = this.app.workspace.activeEditor?.containerEl;
      
      if (!editor || !root) return null;
      
      const markdownService = new CalloutMarkdownService(editor);
      const domService = new DOMCalloutService(root);
      
      return {
        editor,
        markdownService,
        domService
      };
    } catch (error) {
      this.errorHandler.handleError(
        "Failed to initialize services", 
        error,
        "Please try again or restart Obsidian."
      );
      return null;
    }
  }
  
  /**
   * Apply a collapse/expand operation to callouts
   * 
   * @param {string} scope - 'all', 'current', or 'section' 
   * @param {string} mode - 'toggle', 'collapse', 'expand', or 'toggle-individual'
   * @param {boolean} modifyMarkdown - Whether to update the Markdown
   */
  applyCalloutOperation(scope, mode, modifyMarkdown = false) {
    try {
      // Get services
      const services = this.getServices();
      if (!services) return;
      
      const { 
        editor, 
        markdownService,
        domService
      } = services;
      
      const cursor = editor.getCursor();
      const lines = editor.getValue().split('\n');
      
      // If we're modifying markdown (for "with markdown" commands)
      if (modifyMarkdown) {
        this.applyMarkdownOperation(scope, mode, cursor, markdownService);
      } else {
        this.applyVisualOperation(scope, mode, cursor, lines, domService, markdownService);
      }
    } catch (error) {
      this.errorHandler.handleError(
        `Failed to apply operation (${scope}, ${mode})`, 
        error,
        "Please try again or try a different command."
      );
    }
  }
  
  /**
   * Apply operation to Markdown
   * 
   * @param {string} scope - Operation scope
   * @param {string} mode - Operation mode
   * @param {Position} cursor - Editor cursor position
   * @param {CalloutMarkdownService} markdownService - Markdown service instance
   */
  applyMarkdownOperation(scope, mode, cursor, markdownService) {
    // Determine which callouts to modify based on scope
    let callouts = [];
    
    switch (scope) {
      case CONSTANTS.SCOPES.ALL:
        callouts = markdownService.detectAllCallouts();
        break;
        
      case CONSTANTS.SCOPES.CURRENT:
        const callout = markdownService.findCalloutContainingLine(cursor.line) || 
                       markdownService.findCalloutAboveCursor(cursor.line);
        if (callout) callouts = [callout];
        break;
        
      case CONSTANTS.SCOPES.SECTION:
        callouts = markdownService.getCalloutsInCurrentSection(cursor.line);
        break;
    }
    
    if (!callouts.length) return;
    
    // Process callouts in reverse order to maintain line numbers
    const sortedCallouts = [...callouts].sort((a, b) => b.startLine - a.startLine);
    
    // Create operation based on mode
    const getNewState = createCalloutOperation(mode, callouts);
    
    // Update each callout in the Markdown
    sortedCallouts.forEach(callout => {
      markdownService.updateCalloutCollapseState(callout, getNewState(callout));
    });
  }
  
  /**
   * Apply operation to DOM elements (visual only)
   * 
   * @param {string} scope - Operation scope
   * @param {string} mode - Operation mode
   * @param {Position} cursor - Editor cursor position
   * @param {Array<string>} lines - Document lines
   * @param {DOMCalloutService} domService - DOM service instance
   * @param {CalloutMarkdownService} markdownService - Markdown service for parsing
   */
  applyVisualOperation(scope, mode, cursor, lines, domService, markdownService) {
    // Get all callouts for matching
    const allCallouts = markdownService.detectAllCallouts();
    
    switch (scope) {
      case CONSTANTS.SCOPES.ALL:
        // Get all callout elements
        const allElements = domService.getAllCalloutElements();
        if (!allElements.length) return;
        
        switch (mode) {
          case CONSTANTS.MODES.COLLAPSE:
            domService.applyToAllCallouts(true);
            break;
            
          case CONSTANTS.MODES.EXPAND:
            domService.applyToAllCallouts(false);
            break;
            
          case CONSTANTS.MODES.TOGGLE_INDIVIDUAL:
            allElements.forEach(element => {
              const currentState = element.classList.contains('is-collapsed');
              domService.applyCalloutCollapseState(element, !currentState);
            });
            break;
            
          case CONSTANTS.MODES.TOGGLE:
          default:
            // Base the toggle on the first callout's state
            const newState = !allElements[0].classList.contains('is-collapsed');
            domService.applyToAllCallouts(newState);
            break;
        }
        break;
        
      case CONSTANTS.SCOPES.CURRENT:
        // Find closest callout element
        const cursorLine = cursor.line;
        const targetElement = domService.getClosestCalloutToCursor(cursorLine, lines, allCallouts);
        
        if (targetElement) {
          let newState;
          
          switch (mode) {
            case CONSTANTS.MODES.COLLAPSE:
              newState = true;
              break;
              
            case CONSTANTS.MODES.EXPAND:
              newState = false;
              break;
              
            case CONSTANTS.MODES.TOGGLE:
            case CONSTANTS.MODES.TOGGLE_INDIVIDUAL:
            default:
              newState = !targetElement.classList.contains('is-collapsed');
              break;
          }
          
          // Apply the new state
          domService.applyCalloutCollapseState(targetElement, newState);
        }
        break;
        
      case CONSTANTS.SCOPES.SECTION:
        // Find all callouts in section
        const matchingElements = domService.getCalloutsInCurrentSection(
          cursor.line, 
          lines,
          allCallouts
        );
        
        if (!matchingElements.length) return;
        
        switch (mode) {
          case CONSTANTS.MODES.COLLAPSE:
            matchingElements.forEach(element => 
              domService.applyCalloutCollapseState(element, true)
            );
            break;
            
          case CONSTANTS.MODES.EXPAND:
            matchingElements.forEach(element => 
              domService.applyCalloutCollapseState(element, false)
            );
            break;
            
          case CONSTANTS.MODES.TOGGLE_INDIVIDUAL:
            matchingElements.forEach(element => {
              const currentState = element.classList.contains('is-collapsed');
              domService.applyCalloutCollapseState(element, !currentState);
            });
            break;
            
          case CONSTANTS.MODES.TOGGLE:
          default:
            // Count current collapse states
            const collapsedCount = matchingElements.filter(
              element => element.classList.contains('is-collapsed')
            ).length;
            
            // Toggle based on majority
            const newState = collapsedCount < matchingElements.length / 2;
            
            // Apply to all elements
            matchingElements.forEach(element => 
              domService.applyCalloutCollapseState(element, newState)
            );
            break;
        }
        break;
    }
  }
};