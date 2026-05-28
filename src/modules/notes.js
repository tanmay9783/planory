import { getStorageItem, setStorageItem } from '../utils/storage.js';
import { formatDate } from '../utils/date.js';

const NOTES_KEY = 'radhe_notes';
const DRAFTS_HISTORY_KEY = 'radhe_notes_drafts';

let activeNoteDate = '';

export function initNotes() {
  setupNotesEvents();
  renderNotesLibrary();
}

// Injects Notes Drawer trigger button inside task column headers
export function appendNotesButtonToHeader(headerEl, dateStr) {
  const btn = document.createElement('button');
  btn.className = 'icon-btn notes-header-btn';
  btn.title = 'Open Notes for this Day';
  btn.innerHTML = '📝';
  btn.style.fontSize = '12px';
  btn.style.marginLeft = 'auto';
  
  // Bind click
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    openNotesDrawer(dateStr);
  });
  
  headerEl.appendChild(btn);
}

// Renders pinned notes inside the weekly column so they are always visible!
export function renderPinnedNoteInsideColumn(columnEl, dateStr) {
  const notes = getStorageItem(NOTES_KEY, {});
  const note = notes[dateStr];
  
  // Remove existing pinned card first
  const existing = columnEl.querySelector('.pinned-note-card');
  if (existing) existing.remove();
  
  if (note && note.pinned) {
    const pCard = document.createElement('div');
    pCard.className = 'task-card pinned-note-card';
    pCard.style.borderLeft = '4px solid #a78bfa'; // Purple note accent
    pCard.style.background = 'rgba(167, 139, 250, 0.04)';
    pCard.style.cursor = 'pointer';
    
    // Preview text (strip html tags)
    const temp = document.createElement('div');
    temp.innerHTML = note.content;
    const txt = temp.textContent || temp.innerText || "";
    const preview = txt.length > 60 ? txt.slice(0, 60) + "..." : txt;
    
    pCard.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span style="font-weight:700; font-size:11px; color:#a78bfa;">📌 NOTE: ${note.title || 'Untitled Note'}</span>
        <span style="font-size:10px;">✏️</span>
      </div>
      <div style="font-size:12px; font-style:italic; color:var(--text-secondary); margin-top:4px;">"${preview || 'Empty note content'}"</div>
    `;
    
    pCard.addEventListener('click', () => {
      openNotesDrawer(dateStr);
    });
    
    const tasksContainer = columnEl.querySelector('.tasks-container');
    if (tasksContainer) {
      // Insert at the top of the tasks list
      tasksContainer.insertBefore(pCard, tasksContainer.firstChild);
    }
  }
}

function openNotesDrawer(dateStr) {
  activeNoteDate = dateStr;
  
  const notes = getStorageItem(NOTES_KEY, {});
  const note = notes[dateStr] || { content: '', title: '', pinned: false, attachments: [] };
  
  // Set date title label
  const formattedDate = new Date(dateStr).toLocaleDateString('default', { weekday: 'long', month: 'short', day: 'numeric' });
  document.getElementById('drawer-date-label').textContent = `${formattedDate} Notes`;
  
  // Set editor values
  const editor = document.getElementById('editor-content-area');
  editor.innerHTML = note.content || '';
  
  document.getElementById('note-page-title').value = note.title || '';
  document.getElementById('ai-summary-output').classList.add('hidden');
  document.getElementById('ai-flashcards-output').classList.add('hidden');
  
  // Attachments preview
  renderAttachmentsPreview(note.attachments || []);
  
  // Load draft versions history
  loadDraftsHistoryOptions(dateStr);
  
  // Reset Pin button visual state
  updatePinButtonState(note.pinned);
  
  // Update words count
  updateEditorStats(note.content || '');
  
  // Display Drawer
  document.getElementById('notes-drawer-overlay').classList.remove('hidden');
}

function renderAttachmentsPreview(attachments) {
  const container = document.getElementById('note-attachments-preview');
  container.innerHTML = '';
  
  attachments.forEach((att, idx) => {
    const item = document.createElement('div');
    item.style.position = 'relative';
    item.style.width = '50px';
    item.style.height = '50px';
    item.style.borderRadius = '4px';
    item.style.overflow = 'hidden';
    item.style.border = '1px solid var(--border-color)';
    
    item.innerHTML = `
      <img src="${att}" style="width:100%; height:100%; object-fit:cover;" />
      <button class="delete-att" data-idx="${idx}" style="position:absolute; top:2px; right:2px; background:rgba(0,0,0,0.6); color:#fff; border-radius:50%; width:14px; height:14px; font-size:8px; display:flex; align-items:center; justify-content:center; cursor:pointer;">×</button>
    `;
    container.appendChild(item);
  });
  
  container.querySelectorAll('.delete-att').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.idx);
      const notes = getStorageItem(NOTES_KEY, {});
      const note = notes[activeNoteDate];
      if (note && note.attachments) {
        note.attachments.splice(idx, 1);
        setStorageItem(NOTES_KEY, notes);
        renderAttachmentsPreview(note.attachments);
      }
    });
  });
}

function updatePinButtonState(isPinned) {
  const btn = document.getElementById('note-pin-btn');
  if (isPinned) {
    btn.textContent = "📌 Pinned";
    btn.style.background = 'rgba(167, 139, 250, 0.15)';
    btn.style.borderColor = '#a78bfa';
  } else {
    btn.textContent = "📌 Pin to Day";
    btn.style.background = 'none';
    btn.style.borderColor = 'var(--border-color)';
  }
}

function updateEditorStats(html) {
  const temp = document.createElement('div');
  temp.innerHTML = html;
  const text = temp.textContent || temp.innerText || "";
  
  // Count words
  const words = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
  // Avg read time: 200 wpm
  const mins = Math.max(1, Math.round(words / 200));
  
  document.getElementById('editor-stats').textContent = `Words: ${words} • Read Time: ${words > 0 ? mins : 0} min`;
}

function loadDraftsHistoryOptions(dateStr) {
  const select = document.getElementById('note-drafts-history');
  select.innerHTML = '<option value="">Restore Version</option>';
  
  const history = getStorageItem(DRAFTS_HISTORY_KEY, {});
  const dateDrafts = history[dateStr] || [];
  
  dateDrafts.forEach((d, idx) => {
    const opt = document.createElement('option');
    opt.value = idx;
    opt.textContent = `${d.timestamp} (${d.title || 'Untitled'})`;
    select.appendChild(opt);
  });
}

function setupNotesEvents() {
  const overlay = document.getElementById('notes-drawer-overlay');
  const closeBtn = document.getElementById('notes-drawer-close-btn');
  const editor = document.getElementById('editor-content-area');
  const immersiveBtn = document.getElementById('note-immersive-toggle-btn');
  
  // Close drawer
  closeBtn.addEventListener('click', () => {
    saveActiveNote(true); // Force final save
    overlay.classList.add('hidden');
    document.body.classList.remove('notes-immersive-active');
    if (immersiveBtn) {
      immersiveBtn.textContent = "🧘 Focus Writing";
      immersiveBtn.classList.remove('active');
    }
    
    // Rerender weekly columns and notes libraries
    import('./tasks.js').then(m => m.renderGrid());
    renderNotesLibrary();
  });
  
  // Immersive Focus toggle
  if (immersiveBtn) {
    immersiveBtn.addEventListener('click', () => {
      document.body.classList.toggle('notes-immersive-active');
      if (document.body.classList.contains('notes-immersive-active')) {
        immersiveBtn.textContent = "Exit Focus Mode";
        immersiveBtn.classList.add('active');
      } else {
        immersiveBtn.textContent = "🧘 Focus Writing";
        immersiveBtn.classList.remove('active');
      }
    });
  }
  
  // Text Editor formatting buttons
  document.querySelectorAll('.toolbar-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const cmd = btn.dataset.cmd;
      const val = btn.dataset.val || null;
      
      if (cmd === 'hiliteColor') {
        document.execCommand(cmd, false, '#ffc048'); // Highlighter yellow
      } else {
        document.execCommand(cmd, false, val);
      }
      editor.focus();
    });
  });
  
  // Auto-save listeners on keystrokes
  let autosaveTimeout = null;
  editor.addEventListener('input', () => {
    updateEditorStats(editor.innerHTML);
    
    const status = document.getElementById('draft-autosave-status');
    status.textContent = "Typing...";
    
    clearTimeout(autosaveTimeout);
    autosaveTimeout = setTimeout(() => {
      saveActiveNote(false); // Silent background draft backup
      status.textContent = "Auto-saved";
    }, 1000);
  });
  
  // Title changes auto-saves too
  document.getElementById('note-page-title').addEventListener('input', () => {
    clearTimeout(autosaveTimeout);
    autosaveTimeout = setTimeout(() => {
      saveActiveNote(false);
    }, 1000);
  });
  
  // Load templates
  document.getElementById('editor-template-picker').addEventListener('change', (e) => {
    const val = e.target.value;
    if (!val) return;
    
    let templateHtml = '';
    if (val === 'lecture') {
      templateHtml = `
        <h1>📚 Lecture Notes: Topic</h1>
        <h2>🔑 Core Concepts & Vocabulary</h2>
        <ul>
          <li>Concept A: Define</li>
          <li>Concept B: Define</li>
        </ul>
        <h2>📝 Detailed Class Notes</h2>
        <p>Type core lecture arguments, slides notes, and definitions here...</p>
      `;
    } else if (val === 'problem') {
      templateHtml = `
        <h1>✏️ Problem Set: Homework</h1>
        <h2>❓ Problem Statement</h2>
        <p>Type the equation, question text or prompt details...</p>
        <h2>💡 Solution Strategy</h2>
        <p>1. Step details</p>
        <p>2. Step details</p>
        <h2>✓ Final Answers & Check</h2>
        <pre><code>x = 42</code></pre>
      `;
    } else if (val === 'journal') {
      templateHtml = `
        <h1>📖 Reflections Daily Journal</h1>
        <h2>🌟 Gratitude Checklist</h2>
        <ul>
          <li>I am grateful for...</li>
          <li>I am grateful for...</li>
        </ul>
        <h2>🧠 Daily learnings & study check</h2>
        <p>Reviewing focus cycles today, what did I complete? How can tomorrow be improved?</p>
      `;
    }
    
    editor.innerHTML = templateHtml;
    saveActiveNote(false);
    updateEditorStats(templateHtml);
    e.target.value = ''; // Reset picker
  });
  
  // Pin note to weekly calendar
  document.getElementById('note-pin-btn').addEventListener('click', () => {
    const notes = getStorageItem(NOTES_KEY, {});
    const note = notes[activeNoteDate] || { content: '', title: '', pinned: false, attachments: [] };
    
    note.pinned = !note.pinned;
    notes[activeNoteDate] = note;
    setStorageItem(NOTES_KEY, notes);
    
    updatePinButtonState(note.pinned);
    showToast(note.pinned ? "Pinned note to day column! 📌" : "Unpinned note.");
  });
  
  // Drafts restores
  document.getElementById('note-drafts-history').addEventListener('change', (e) => {
    const idx = e.target.value;
    if (idx === "") return;
    
    const history = getStorageItem(DRAFTS_HISTORY_KEY, {});
    const dateDrafts = history[activeNoteDate] || [];
    const draft = dateDrafts[parseInt(idx)];
    
    if (draft) {
      editor.innerHTML = draft.content;
      document.getElementById('note-page-title').value = draft.title || '';
      updateEditorStats(draft.content);
      showToast("Draft version restored! ↺");
    }
    e.target.value = ''; // Reset picker
  });
  
  // File upload pasted logic
  const dropZone = document.getElementById('editor-file-drop');
  dropZone.addEventListener('click', () => {
    document.getElementById('note-file-input').click();
  });
  
  document.getElementById('note-file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleImageUpload(file);
  });
  
  // AI summariser simulation
  document.getElementById('ai-summarise-btn').addEventListener('click', () => {
    const textContent = editor.innerText.trim();
    if (!textContent) {
      alert("Please write some notes first.");
      return;
    }
    
    const summaryOut = document.getElementById('ai-summary-output');
    summaryOut.innerHTML = "🤖 <em>Claude is reading and summarizing your notes...</em>";
    summaryOut.classList.remove('hidden');
    
    setTimeout(() => {
      summaryOut.innerHTML = `
        <strong>🤖 Claude's 3-Bullet Summary:</strong><br/>
        • <strong>Core Focus:</strong> Mastered the scheduled lecture themes and documented definitions.<br/>
        • <strong>Key Takeaway:</strong> Mastered practical equations and completed scheduled problem steps.<br/>
        • <strong>Review Suggestion:</strong> Practice these revision card decks before test hours.
      `;
    }, 1500);
  });
  
  // AI flashcards simulation
  document.getElementById('ai-flashcards-btn').addEventListener('click', () => {
    const textContent = editor.innerText.trim();
    if (!textContent) {
      alert("Please write some notes first.");
      return;
    }
    
    const flashOut = document.getElementById('ai-flashcards-output');
    flashOut.innerHTML = "🤖 <em>Claude is generating revision flashcards Q&As...</em>";
    flashOut.classList.remove('hidden');
    
    setTimeout(() => {
      flashOut.innerHTML = `
        <strong>🤖 Claude's Q&A Revision Deck:</strong><br/>
        • <strong>Q:</strong> What is the main target concept logged today?<br/>
        &nbsp;&nbsp;<strong>A:</strong> The core formula or conceptual subject tag mapped in the dropdown.<br/>
        • <strong>Q:</strong> What step strategy resolves problems in notes?<br/>
        &nbsp;&nbsp;<strong>A:</strong> Follow the bulleted homework solution strategies logged in the templates!
      `;
    }, 1500);
  });
  
  // Export plain text
  document.getElementById('note-export-btn').addEventListener('click', () => {
    const text = editor.innerText;
    navigator.clipboard.writeText(text);
    showToast("Notes copied to clipboard! 📋");
  });
  
  // Notes Search in Library
  document.getElementById('notes-search-input').addEventListener('input', () => {
    renderNotesLibrary();
  });
}

function handleImageUpload(file) {
  const reader = new FileReader();
  reader.onload = (event) => {
    const base64 = event.target.result;
    
    const notes = getStorageItem(NOTES_KEY, {});
    const note = notes[activeNoteDate] || { content: '', title: '', pinned: false, attachments: [] };
    
    if (!note.attachments) note.attachments = [];
    note.attachments.push(base64);
    
    notes[activeNoteDate] = note;
    setStorageItem(NOTES_KEY, notes);
    
    renderAttachmentsPreview(note.attachments);
    showToast("Sketch screenshot attached successfully! 📎");
  };
  reader.readAsDataURL(file);
}

function saveActiveNote(forceBackup = false) {
  if (!activeNoteDate) return;
  
  const content = document.getElementById('editor-content-area').innerHTML;
  const title = document.getElementById('note-page-title').value.trim();
  
  const notes = getStorageItem(NOTES_KEY, {});
  const note = notes[activeNoteDate] || { content: '', title: '', pinned: false, attachments: [] };
  
  note.content = content;
  note.title = title || 'Untitled Note';
  
  notes[activeNoteDate] = note;
  setStorageItem(NOTES_KEY, notes);
  
  // Storing drafts backups (max 10 versions)
  if (forceBackup || Math.random() < 0.3) {
    const history = getStorageItem(DRAFTS_HISTORY_KEY, {});
    if (!history[activeNoteDate]) history[activeNoteDate] = [];
    
    const newDraft = {
      content,
      title: title || 'Untitled Note',
      timestamp: new Date().toLocaleTimeString()
    };
    
    history[activeNoteDate].unshift(newDraft);
    if (history[activeNoteDate].length > 10) {
      history[activeNoteDate].pop(); // Maintain 10 versions
    }
    setStorageItem(DRAFTS_HISTORY_KEY, history);
  }
}

// Renders the library cards inside modal list
export function renderNotesLibrary() {
  const container = document.getElementById('notes-library-grid');
  if (!container) return;
  container.innerHTML = '';
  
  const notes = getStorageItem(NOTES_KEY, {});
  const query = document.getElementById('notes-search-input').value.toLowerCase().trim();
  
  const keys = Object.keys(notes);
  let renderedCount = 0;
  
  keys.forEach(dateStr => {
    const note = notes[dateStr];
    
    // Search query match (highlight matches)
    const temp = document.createElement('div');
    temp.innerHTML = note.content;
    const plainText = temp.textContent || temp.innerText || "";
    
    const titleMatch = (note.title || 'Untitled Note').toLowerCase().includes(query);
    const textMatch = plainText.toLowerCase().includes(query);
    
    if (query !== "" && !titleMatch && !textMatch) return;
    
    // Build library card
    const card = document.createElement('div');
    card.className = 'day-column';
    card.style.minHeight = '160px';
    
    // Generate text preview with matched highlights
    let preview = plainText.length > 140 ? plainText.slice(0, 140) + "..." : plainText;
    let cardTitle = note.title || 'Untitled Note';
    
    if (query !== "") {
      const regex = new RegExp(`(${query})`, 'gi');
      preview = preview.replace(regex, `<mark style="background:#ffc048; color:#000;">$1</mark>`);
      cardTitle = cardTitle.replace(regex, `<mark style="background:#ffc048; color:#000;">$1</mark>`);
    }
    
    const formattedDate = new Date(dateStr).toLocaleDateString('default', { weekday: 'short', month: 'short', day: 'numeric' });
    
    card.innerHTML = `
      <div class="day-header" style="background: rgba(167,139,250,0.06); border-bottom-color: rgba(167,139,250,0.15);">
        <div class="day-name" style="color:#a78bfa">📝 ${cardTitle}</div>
        <div class="day-date">${formattedDate}</div>
      </div>
      <div style="padding: 14px; flex:1; display:flex; flex-direction:column; justify-content:space-between;">
        <p style="font-size:12px; color:var(--text-secondary); line-height:1.5; font-style:italic;">"${preview || 'Empty notes content'}"</p>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; border-top:1px solid var(--border-color); padding-top:8px;">
          <span style="font-size:10px; color:var(--text-muted);">Attachments: ${note.attachments ? note.attachments.length : 0}</span>
          <button class="btn-primary-sm open-lib-note" data-date="${dateStr}">Edit ✏️</button>
        </div>
      </div>
    `;
    
    container.appendChild(card);
    renderedCount++;
  });
  
  if (renderedCount === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align:center; padding: 48px 24px; max-width: 480px; margin: 24px auto;">
        <div style="font-size: 32px; margin-bottom: 16px;">📚</div>
        <div style="font-size: 16px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px;">Capture ideas before they disappear.</div>
        <p style="font-size: 14px; color: var(--text-secondary); line-height: 1.6; margin: 0;">Your study sanctuary is currently empty. Pin your notes directly inside daily columns to start writing.</p>
      </div>
    `;
  }
  
  container.querySelectorAll('.open-lib-note').forEach(btn => {
    btn.addEventListener('click', () => {
      // Hide library modal
      document.getElementById('notes-library-modal-overlay').classList.add('hidden');
      
      const dateStr = btn.dataset.date;
      openNotesDrawer(dateStr);
    });
  });
}

function showToast(msg) {
  const toast = document.getElementById('notif-toast');
  document.getElementById('notif-msg').textContent = msg;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3000);
}
