const { Plugin, PluginSettingTab, Setting } = require('obsidian');

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
   * Get all callout DOM elements within the current section (between headings)
   * 
   * @param {number} cursorLine - The line number where the cursor is located
   * @param {Array<string>} lines - All lines in the document
   * @returns {Array<HTMLElement>} Array of callout DOM elements in the current section
   */
  getCalloutsInCurrentSection(cursorLine, lines) {
    let sectionStart = cursorLine;
    let sectionEnd = cursorLine;

    // Determine section boundaries based on headings
    while (sectionStart >= 0 && !lines[sectionStart].startsWith('#')) {
      sectionStart--;
    }
    while (sectionEnd < lines.length && !lines[sectionEnd].startsWith('#')) {
      sectionEnd++;
    }

    return this.getAllCalloutElements().filter(element => {
      const calloutContent = element.querySelector('.callout-content')?.textContent.trim();
      const lineIndex = lines.findIndex(line => line.includes(calloutContent));
      return lineIndex >= sectionStart && lineIndex <= sectionEnd;
    });
  }

  /**
   * Get the closest callout DOM element to the cursor position
   * 
   * @param {number} cursorLine - The line number where the cursor is located
   * @param {Array<string>} lines - All lines in the document
   * @returns {HTMLElement|null} The closest callout DOM element or null
   */
  getClosestCalloutToCursor(cursorLine, lines) {
    const calloutElements = this.getAllCalloutElements();
    if (!calloutElements.length) return null;

    let closestElement = null;
    let closestDistance = Infinity;

    calloutElements.forEach((element, index) => {
      // Find the line number of the callout by matching its content with the lines
      const calloutContent = element.querySelector('.callout-content')?.textContent.trim();
      const lineIndex = lines.findIndex(line => line.includes(calloutContent));

      if (lineIndex !== -1) {
        const distance = Math.abs(lineIndex - cursorLine);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestElement = element;
        }
      }
    });

    return closestElement;
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
 * Settings tab for the Callout Control plugin
 */
class CalloutControlSettingsTab extends PluginSettingTab {
  // Command groupings for toggles and helpers
  // eslint-disable-next-line no-unused-vars
  static COMMAND_GROUPS = {
    current: [
      'toggle-current-visual', 'collapse-current-visual', 'expand-current-visual',
      'toggle-current-markdown', 'collapse-current-markdown',
      'expand-current-markdown'
    ],
    section: [
      'toggle-section-visual', 'collapse-section-visual', 'expand-section-visual', 'flip-section-visual',
      'toggle-section-markdown', 'collapse-section-markdown',
      'expand-section-markdown', 'flip-section-markdown'
    ],
    all: [
      'toggle-all-visual', 'collapse-all-visual', 'expand-all-visual', 'flip-all-visual',
      'toggle-all-markdown', 'collapse-all-markdown',
      'expand-all-markdown', 'flip-all-markdown'
    ]
  };

  // Helper to get group for a command
  static getGroupForCommand(commandId) {
    for (const [group, ids] of Object.entries(CalloutControlSettingsTab.COMMAND_GROUPS)) {
      if (ids.includes(commandId)) return group;
    }
    return null;
  }

  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    // Add minimal styling for group containers
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
    `;
    containerEl.appendChild(style);

    // Default settings structure if not initialized
    if (!this.plugin.settings) {
      this.plugin.settings = {
        commands: {},
        groupsEnabled: {
          all: true,
          current: true,
          section: true
        }
      };
    }

    // Add settings header and brief description
    const heading = containerEl.createEl('h3', { text: 'Available Commands' });
    const description = document.createElement('div');
    description.textContent = 'Enable or disable specific commands shown in the command palette.';
    description.style.marginBottom = '1em';
    heading.insertAdjacentElement('afterend', description);

    // Render grouped command toggles
    // --- Current Group ---
    const currentSection = containerEl.createDiv({ cls: 'callout-control-group' });
    currentSection.createEl('h3', { text: 'Current' });
    // Toggle to enable/disable all current callout commands
    new Setting(currentSection)
      .setName('Enable Current Commands')
      .setDesc('Toggle all commands that affect the current callout')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.groupsEnabled.current || false)
        .onChange(async (value) => {
          this.plugin.settings.groupsEnabled.current = value;
          CalloutControlSettingsTab.COMMAND_GROUPS.current.forEach(cmdId => {
            this.plugin.settings.commands[cmdId] = value;
          });
          await this.plugin.saveSettings();
          this.plugin.refreshCommands();
          this.display();
        }));
    currentSection.createEl('h4', { text: 'Visual' });
    const currentGroupEnabled = this.plugin.settings.groupsEnabled.current !== false;
    this.createCommandToggle(currentSection, 'toggle-current-visual', 'Toggle Current Callout (Visual Only)', !currentGroupEnabled);
    this.createCommandToggle(currentSection, 'collapse-current-visual', 'Collapse Current Callout (Visual Only)', !currentGroupEnabled);
    this.createCommandToggle(currentSection, 'expand-current-visual', 'Expand Current Callout (Visual Only)', !currentGroupEnabled);
    currentSection.createEl('h4', { text: 'Markdown' });
    this.createCommandToggle(currentSection, 'toggle-current-markdown', 'Toggle Current Callout (Markdown)', !currentGroupEnabled);
    this.createCommandToggle(currentSection, 'collapse-current-markdown', 'Collapse Current Callout (Markdown)', !currentGroupEnabled);
    this.createCommandToggle(currentSection, 'expand-current-markdown', 'Expand Current Callout (Markdown)', !currentGroupEnabled);

    // --- Section Group ---
    const sectionSection = containerEl.createDiv({ cls: 'callout-control-group' });
    sectionSection.createEl('h3', { text: 'Section' });
    // Toggle to enable/disable all section callout commands
    new Setting(sectionSection)
      .setName('Enable Section Commands')
      .setDesc('Toggle all commands that affect callouts in the current section')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.groupsEnabled.section || false)
        .onChange(async (value) => {
          this.plugin.settings.groupsEnabled.section = value;
          CalloutControlSettingsTab.COMMAND_GROUPS.section.forEach(cmdId => {
            this.plugin.settings.commands[cmdId] = value;
          });
          await this.plugin.saveSettings();
          this.plugin.refreshCommands();
          this.display();
        }));
    sectionSection.createEl('h4', { text: 'Visual' });
    const sectionGroupEnabled = this.plugin.settings.groupsEnabled.section !== false;
    this.createCommandToggle(sectionSection, 'toggle-section-visual', 'Toggle Section Callouts Uniformly (Visual Only)', !sectionGroupEnabled);
    this.createCommandToggle(sectionSection, 'collapse-section-visual', 'Collapse Section Callouts (Visual Only)', !sectionGroupEnabled);
    this.createCommandToggle(sectionSection, 'expand-section-visual', 'Expand Section Callouts (Visual Only)', !sectionGroupEnabled);
    this.createCommandToggle(sectionSection, 'flip-section-visual', 'Flip Section Callouts Individually (Visual Only)', !sectionGroupEnabled);
    sectionSection.createEl('h4', { text: 'Markdown' });
    this.createCommandToggle(sectionSection, 'toggle-section-markdown', 'Toggle Section Callouts Uniformly (Markdown)', !sectionGroupEnabled);
    this.createCommandToggle(sectionSection, 'collapse-section-markdown', 'Collapse Section Callouts (Markdown)', !sectionGroupEnabled);
    this.createCommandToggle(sectionSection, 'expand-section-markdown', 'Expand Section Callouts (Markdown)', !sectionGroupEnabled);
    this.createCommandToggle(sectionSection, 'flip-section-markdown', 'Flip Section Callouts Individually (Markdown)', !sectionGroupEnabled);

    // --- All Group ---
    const allSection = containerEl.createDiv({ cls: 'callout-control-group' });
    allSection.createEl('h3', { text: 'All' });
    // Toggle to enable/disable all document-wide callout commands
    new Setting(allSection)
      .setName('Enable All Commands')
      .setDesc('Toggle all commands that affect all callouts in the document')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.groupsEnabled.all || false)
        .onChange(async (value) => {
          this.plugin.settings.groupsEnabled.all = value;
          CalloutControlSettingsTab.COMMAND_GROUPS.all.forEach(cmdId => {
            this.plugin.settings.commands[cmdId] = value;
          });
          await this.plugin.saveSettings();
          this.plugin.refreshCommands();
          this.display();
        }));
    allSection.createEl('h4', { text: 'Visual' });
    const allGroupEnabled = this.plugin.settings.groupsEnabled.all !== false;
    this.createCommandToggle(allSection, 'toggle-all-visual', 'Toggle All Callouts Uniformly (Visual Only)', !allGroupEnabled);
    this.createCommandToggle(allSection, 'collapse-all-visual', 'Collapse All Callouts (Visual Only)', !allGroupEnabled);
    this.createCommandToggle(allSection, 'expand-all-visual', 'Expand All Callouts (Visual Only)', !allGroupEnabled);
    this.createCommandToggle(allSection, 'flip-all-visual', 'Flip All Callouts Individually (Visual Only)', !allGroupEnabled);
    allSection.createEl('h4', { text: 'Markdown' });
    this.createCommandToggle(allSection, 'toggle-all-markdown', 'Toggle All Callouts Uniformly (Markdown)', !allGroupEnabled);
    this.createCommandToggle(allSection, 'collapse-all-markdown', 'Collapse All Callouts (Markdown)', !allGroupEnabled);
    this.createCommandToggle(allSection, 'expand-all-markdown', 'Expand All Callouts (Markdown)', !allGroupEnabled);
    this.createCommandToggle(allSection, 'flip-all-markdown', 'Flip All Callouts Individually (Markdown)', !allGroupEnabled);
  }

  // Helper to create a toggle for a specific command
  createCommandToggle(containerEl, commandId, name, disabled = false) {
    if (this.plugin.settings.commands[commandId] === undefined) {
      this.plugin.settings.commands[commandId] = true; // Default to enabled
    }

    new Setting(containerEl)
      .setName(name)
      .addToggle(toggle => {
        toggle
          .setValue(this.plugin.settings.commands[commandId])
          .onChange(async (value) => {
            // If group is disabled but individual command is turned on, activate group
            if (value) {
              const group = CalloutControlSettingsTab.getGroupForCommand(commandId);
              if (group) this.plugin.settings.groupsEnabled[group] = true;
            }

            this.plugin.settings.commands[commandId] = value;
            await this.plugin.saveSettings();
            this.plugin.refreshCommands();
            this.display();
          });
      });
  }
}

/**
 * CalloutControlPlugin
 * 
 * The main plugin class that coordinates the services and provides
 * commands to the Obsidian interface.
 */
module.exports = class CalloutControlPlugin extends Plugin {
  // Add these properties to your class
  settings = {
    commands: {},
    groupsEnabled: {
      all: true,
      current: true,
      section: true
    }
  };
  registeredCommandIds = [];

  
  // Load settings
  async loadSettings() {
    this.settings = Object.assign({}, {
      commands: {},
      groupsEnabled: {
        all: true,
        current: true,
        section: true
      }
    }, await this.loadData());
  }

  // Save settings
  async saveSettings() {
    await this.saveData(this.settings);
  }
  
  /**
   * Initialize the plugin and register commands
   */
  async onload() {
    // Load settings at startup
    await this.loadSettings();
    
    // Add settings tab
    this.addSettingTab(new CalloutControlSettingsTab(this.app, this));
    
    // Register available commands based on settings
    this.registerAvailableCommands();
  }
  
  // Register commands helper method
  registerCommand = (id, name, callback) => {
    if (!this.settings.commands[id]) return;

    const fullId = `callout-control.${id}`;

    this.registeredCommandIds.push(fullId);

    return this.addCommand({
      id: fullId,
      name,
      callback
    });
  };
  
  // Register all available commands based on settings
  registerAvailableCommands() {
    // Current Callout (Visual Only)
    this.registerCommand('toggle-current-visual', 'Toggle Current Callout (Visual Only)', () => this.toggleCurrentCallout('toggle'));
    this.registerCommand('collapse-current-visual', 'Collapse Current Callout (Visual Only)', () => this.toggleCurrentCallout('collapse'));
    this.registerCommand('expand-current-visual', 'Expand Current Callout (Visual Only)', () => this.toggleCurrentCallout('expand'));

    // Current Callout (Markdown)
    this.registerCommand('toggle-current-markdown', 'Toggle Current Callout (Markdown)', () => this.toggleCurrentCallout('toggle', true));
    this.registerCommand('collapse-current-markdown', 'Collapse Current Callout (Markdown)', () => this.toggleCurrentCallout('collapse', true));
    this.registerCommand('expand-current-markdown', 'Expand Current Callout (Markdown)', () => this.toggleCurrentCallout('expand', true));

    // Section Callouts (Visual Only)
    this.registerCommand('toggle-section-visual', 'Toggle Section Callouts Uniformly (Visual Only)', () => this.toggleSectionCallouts('toggle'));
    this.registerCommand('collapse-section-visual', 'Collapse Section Callouts (Visual Only)', () => this.toggleSectionCallouts('collapse'));
    this.registerCommand('expand-section-visual', 'Expand Section Callouts (Visual Only)', () => this.toggleSectionCallouts('expand'));
    this.registerCommand('flip-section-visual', 'Flip Section Callouts Individually (Visual Only)', () => this.toggleSectionCallouts('toggle-individual'));

    // Section Callouts (Markdown)
    this.registerCommand('toggle-section-markdown', 'Toggle Section Callouts Uniformly (Markdown)', () => this.toggleSectionCallouts('toggle', true));
    this.registerCommand('collapse-section-markdown', 'Collapse Section Callouts (Markdown)', () => this.toggleSectionCallouts('collapse', true));
    this.registerCommand('expand-section-markdown', 'Expand Section Callouts (Markdown)', () => this.toggleSectionCallouts('expand', true));
    this.registerCommand('flip-section-markdown', 'Flip Section Callouts Individually (Markdown)', () => this.toggleSectionCallouts('toggle-individual', true));

    // All Callouts (Visual Only)
    this.registerCommand('toggle-all-visual', 'Toggle All Callouts Uniformly (Visual Only)', () => this.processCallouts('toggle'));
    this.registerCommand('collapse-all-visual', 'Collapse All Callouts (Visual Only)', () => this.processCallouts('collapse'));
    this.registerCommand('expand-all-visual', 'Expand All Callouts (Visual Only)', () => this.processCallouts('expand'));
    this.registerCommand('flip-all-visual', 'Flip All Callouts Individually (Visual Only)', () => this.processCallouts('toggle-individual'));

    // All Callouts (Markdown)
    this.registerCommand('toggle-all-markdown', 'Toggle All Callouts Uniformly (Markdown)', () => this.processCallouts('toggle', true));
    this.registerCommand('collapse-all-markdown', 'Collapse All Callouts (Markdown)', () => this.processCallouts('collapse', true));
    this.registerCommand('expand-all-markdown', 'Expand All Callouts (Markdown)', () => this.processCallouts('expand', true));
    this.registerCommand('flip-all-markdown', 'Flip All Callouts Individually (Markdown)', () => this.processCallouts('toggle-individual', true));
  }
  
  // Refresh commands based on updated settings
  refreshCommands() {
    this.registeredCommandIds.forEach(id => {
      this.removeCommand(id);
    });

    this.registeredCommandIds = [];

    this.registerAvailableCommands();
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
      const cursorLine = editor.getCursor().line;
      const lines = editor.getValue().split('\n');

      // Use DOMCalloutService to find the closest callout to the cursor
      const targetElement = domService.getClosestCalloutToCursor(cursorLine, lines);

      if (targetElement) {
        let newState;
        if (mode === 'collapse') {
          newState = true;
        } else if (mode === 'expand') {
          newState = false;
        } else { // toggle
          newState = !targetElement.classList.contains('is-collapsed');
        }

        // Apply the new state to the closest callout
        domService.applyCalloutCollapseState(targetElement, newState);
      }
    } else if (scope === 'section') {
      const cursorLine = editor.getCursor().line;
      const lines = editor.getValue().split('\n');

      // Use DOMCalloutService to find all callouts in the current section
      const matchingElements = domService.getCalloutsInCurrentSection(cursorLine, lines);

      if (matchingElements.length) {
        if (mode === 'collapse') {
          matchingElements.forEach(element => domService.applyCalloutCollapseState(element, true));
        } else if (mode === 'expand') {
          matchingElements.forEach(element => domService.applyCalloutCollapseState(element, false));
        } else if (mode === 'toggle-individual') {
          matchingElements.forEach(element => {
            const currentState = element.classList.contains('is-collapsed');
            domService.applyCalloutCollapseState(element, !currentState);
          });
        } else { // uniform toggle
          const collapsedCount = matchingElements.filter(element => element.classList.contains('is-collapsed')).length;
          const newState = collapsedCount < matchingElements.length / 2;
          matchingElements.forEach(element => domService.applyCalloutCollapseState(element, newState));
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
  toggleSectionCallouts(mode = 'toggle', modifyMarkdown = false) {
    this.applyCalloutOperation('section', mode, modifyMarkdown);
  }
};