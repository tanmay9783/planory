import { getStorageItem, setStorageItem } from '../utils/storage.js';
import { parseNaturalLanguageTask } from '../utils/nlp.js';
import { addTaskDirectly } from './tasks.js';

const DUMP_KEY = 'brain_dump';

export function initBrainDump() {
  const items = getStorageItem(DUMP_KEY, []);
  
  renderBrainDumpList(items);
  setupBrainDumpEvents(items);
}

function renderBrainDumpList(items) {
  const container = document.getElementById('brain-dump-list');
  container.innerHTML = '';
  
  document.getElementById('brain-dump-count').textContent = items.length;
  
  if (items.length === 0) {
    container.innerHTML = `<p class="helper-text" style="padding: 16px 0; text-align: center; font-size: 13px; color: var(--text-secondary);">Capture ideas before they disappear.</p>`;
    return;
  }
  
  items.forEach((item, index) => {
    const text = typeof item === 'string' ? item : item.text;
    const div = document.createElement('div');
    div.className = 'dump-item';
    div.draggable = true;
    div.dataset.index = index;
    div.innerHTML = `
      <div class="dump-item-text">${text}</div>
      <div class="dump-item-actions">
        <button class="icon-btn convert-item" data-idx="${index}" title="Convert to Task">📅</button>
        <button class="icon-btn delete-item" data-idx="${index}" title="Delete">🗑️</button>
      </div>
    `;
    
    // Drag start for scheduling
    div.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', `dump:${index}`);
      e.dataTransfer.effectAllowed = 'move';
    });
    
    container.appendChild(div);
  });
  
  // Hook actions
  container.querySelectorAll('.convert-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      const item = items[idx];
      const val = typeof item === 'string' ? item : item.text;
      
      // Auto parse with NLP
      const parsed = parseNaturalLanguageTask(val);
      if (Array.isArray(parsed)) {
        parsed.forEach(task => addTaskDirectly(task));
      } else {
        addTaskDirectly(parsed);
      }
      
      // Remove from dump
      items.splice(idx, 1);
      setStorageItem(DUMP_KEY, items);
      renderBrainDumpList(items);
    });
  });
  
  container.querySelectorAll('.delete-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      items.splice(idx, 1);
      setStorageItem(DUMP_KEY, items);
      renderBrainDumpList(items);
    });
  });
}

function setupBrainDumpEvents(items) {
  const input = document.getElementById('brain-dump-input');
  const addBtn = document.getElementById('brain-dump-add-btn');
  
  const handleAdd = () => {
    const val = input.value.trim();
    if (!val) return;
    
    const newDump = {
      id: 'd_' + Date.now(),
      text: val,
      date: new Date().toISOString()
    };
    
    items.unshift(newDump);
    setStorageItem(DUMP_KEY, items);
    input.value = '';
    renderBrainDumpList(items);
  };
  
  addBtn.addEventListener('click', handleAdd);
  
  // Allow Ctrl+Enter to save
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleAdd();
    }
  });
}

// Public API to append external dumps
export function appendBrainDump(text) {
  const items = getStorageItem(DUMP_KEY, []);
  const newDump = {
    id: 'd_' + Date.now(),
    text: text,
    date: new Date().toISOString()
  };
  items.unshift(newDump);
  setStorageItem(DUMP_KEY, items);
  initBrainDump();
}
