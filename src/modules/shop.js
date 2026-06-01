import { getStorageItem, setStorageItem } from '../utils/storage.js';

const COINS_KEY = 'focus_coins';
const SEEDS_KEY = 'unlocked_seeds';

export const SEEDS_DATABASE = [
  { id: 'oak', name: 'Oak Tree', emoji: '🌳', cost: 0, desc: 'A classic oak tree that symbolizes endurance and strength.' },
  { id: 'sakura', name: 'Sakura Blossom', emoji: '🌸', cost: 50, desc: 'A beautiful cherry blossom that bursts with pink leaves.' },
  { id: 'maple', name: 'Red Maple', emoji: '🍁', cost: 100, desc: 'A rich red maple leaf tree perfect for autumn vibes.' },
  { id: 'pine', name: 'Pine Tree', emoji: '🌲', cost: 150, desc: 'A rugged evergreen pine that withstands the coldest nights.' },
  { id: 'palm', name: 'Palm Tree', emoji: '🌴', cost: 200, desc: 'A tropical palm tree that adds sunny summer breeze.' }
];

export function initShop() {
  const overlay = document.getElementById('shop-modal-overlay');
  const closeBtn = document.getElementById('shop-close-btn');
  const openBtn = document.getElementById('open-shop-btn');

  if (openBtn && overlay) {
    openBtn.addEventListener('click', () => {
      renderShop();
      overlay.classList.remove('hidden');
    });
  }

  if (closeBtn && overlay) {
    closeBtn.addEventListener('click', () => {
      overlay.classList.add('hidden');
    });
  }

  updateCoinsUI();
  updateSeedPickerOptions();
}

export function getCoins() {
  return parseInt(getStorageItem(COINS_KEY, 0)) || 0;
}

export function addCoins(amount) {
  const current = getCoins();
  const next = current + amount;
  setStorageItem(COINS_KEY, next);
  updateCoinsUI();

  // Show dynamic toast
  const toast = document.getElementById('notif-toast');
  const msgEl = document.getElementById('notif-msg');
  if (toast && msgEl) {
    msgEl.innerHTML = `🪙 +${amount} Focus Coins earned!`;
    toast.classList.remove('hidden');
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => toast.classList.add('hidden'), 2500);
  }
}

export function deductCoins(amount) {
  const current = getCoins();
  if (current < amount) return false;
  setStorageItem(COINS_KEY, current - amount);
  updateCoinsUI();
  return true;
}

export function getUnlockedSeeds() {
  return getStorageItem(SEEDS_KEY, ['oak']);
}

function unlockSeed(id) {
  const unlocked = getUnlockedSeeds();
  if (!unlocked.includes(id)) {
    unlocked.push(id);
    setStorageItem(SEEDS_KEY, unlocked);
    updateSeedPickerOptions();
  }
}

function updateCoinsUI() {
  const coins = getCoins();
  const counter = document.getElementById('coin-display');
  const balance = document.getElementById('shop-coin-balance');
  if (counter) counter.textContent = coins;
  if (balance) balance.textContent = coins;
}

function updateSeedPickerOptions() {
  const pickers = [
    document.getElementById('forest-seed-picker'),
    document.getElementById('settings-forest-seed-picker') // mobile / other places if present
  ];

  const unlocked = getUnlockedSeeds();

  pickers.forEach(picker => {
    if (!picker) return;
    const currentVal = picker.value;
    picker.innerHTML = '';
    
    SEEDS_DATABASE.forEach(seed => {
      if (unlocked.includes(seed.id)) {
        const opt = document.createElement('option');
        opt.value = seed.id;
        opt.textContent = `${seed.emoji} ${seed.name}`;
        picker.appendChild(opt);
      }
    });

    if (unlocked.includes(currentVal)) {
      picker.value = currentVal;
    }
  });
}

export function renderShop() {
  const container = document.getElementById('shop-items-grid');
  if (!container) return;
  container.innerHTML = '';

  const coins = getCoins();
  const unlocked = getUnlockedSeeds();

  SEEDS_DATABASE.forEach(seed => {
    const isOwned = unlocked.includes(seed.id);
    const card = document.createElement('div');
    card.className = 'shop-item-card';
    card.innerHTML = `
      <div class="shop-item-header">
        <span class="shop-item-emoji">${seed.emoji}</span>
        <span class="shop-item-price">${seed.cost > 0 ? `🪙 ${seed.cost}` : 'FREE'}</span>
      </div>
      <div>
        <div class="shop-item-title">${seed.name}</div>
        <div class="shop-item-desc">${seed.desc}</div>
      </div>
      <button class="shop-item-btn ${isOwned ? 'owned' : 'buy'}" data-id="${seed.id}">
        ${isOwned ? 'Unlocked ✓' : 'Unlock Seed'}
      </button>
    `;

    const button = card.querySelector('.shop-item-btn');
    if (!isOwned) {
      button.addEventListener('click', () => {
        if (coins >= seed.cost) {
          deductCoins(seed.cost);
          unlockSeed(seed.id);
          renderShop();
        } else {
          alert('Not enough Focus Coins! Complete focus sessions, tasks, and habits to earn more.');
        }
      });
    }

    container.appendChild(card);
  });
}
