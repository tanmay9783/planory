import { getStorageItem, setStorageItem } from '../utils/storage.js';

const MANTRAS_KEY = 'user_mantras';

const fallbackQuotes = [
  "Start where you are. Use what you have. Do what you can.",
  "Your focus determines your reality. Stay sharp today.",
  "Make each day your masterpiece.",
  "You have a client call and a deadline today — stay fully focused!",
  "Great things are done by a series of small things brought together.",
  "Consistency beats intensity every single time.",
  "One day or Day One? You decide.",
  "The only way to do great work is to love what you do."
];

export function initQuotes() {
  const customMantras = getStorageItem(MANTRAS_KEY, []);
  
  displayRandomQuote(customMantras);
  setupQuoteEvents(customMantras);
  renderMantrasList(customMantras);
}

function displayRandomQuote(customMantras) {
  const allQuotes = [...fallbackQuotes, ...customMantras];
  const randIdx = Math.floor(Math.random() * allQuotes.length);
  document.getElementById('quote-text').textContent = `"${allQuotes[randIdx]}"`;
}

function setupQuoteEvents(customMantras) {
  // Refresh button
  document.getElementById('refresh-quote-btn').addEventListener('click', () => {
    displayRandomQuote(customMantras);
  });
  
  // Add mantra button
  document.getElementById('add-mantra-btn').addEventListener('click', () => {
    const input = document.getElementById('mantra-input');
    const newMantra = input.value.trim();
    if (!newMantra) return;
    
    customMantras.push(newMantra);
    setStorageItem(MANTRAS_KEY, customMantras);
    input.value = '';
    
    renderMantrasList(customMantras);
    displayRandomQuote(customMantras);
  });
}

function renderMantrasList(customMantras) {
  const container = document.getElementById('mantras-list');
  container.innerHTML = '';
  
  if (customMantras.length === 0) {
    container.innerHTML = `<p class="helper-text" style="padding: 10px 0;">No custom mantras yet. Add one below!</p>`;
    return;
  }
  
  customMantras.forEach((mantra, index) => {
    const row = document.createElement('div');
    row.className = 'habit-row'; // Use same styling
    row.innerHTML = `
      <span class="habit-name" style="font-style: italic;">"${mantra}"</span>
      <button class="icon-btn delete-mantra" data-idx="${index}">🗑️</button>
    `;
    container.appendChild(row);
  });
  
  // Hook delete events
  container.querySelectorAll('.delete-mantra').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      customMantras.splice(idx, 1);
      setStorageItem(MANTRAS_KEY, customMantras);
      renderMantrasList(customMantras);
      displayRandomQuote(customMantras);
    });
  });
}
export function getPlannerQuote() {
  return document.getElementById('quote-text').textContent;
}
