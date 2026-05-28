import { getStorageItem, setStorageItem } from '../utils/storage.js';

const GAMIFICATION_KEY = 'radhe_gamification_state';

const defaultState = {
  xp: 0,
  level: 1,
  tasksCompletedToday: 0,
  waterLoggedToday: 0,
  focusMinutesToday: 0,
  lastUpdated: new Date().toDateString()
};

const PET_STAGES = [
  { minLevel: 1, emoji: '🌱', msg: 'Your plant is sprouting! Add tasks to grow it.' },
  { minLevel: 3, emoji: '🌿', msg: 'Your plant is growing leaves! Keep it up!' },
  { minLevel: 5, emoji: '🪴', msg: 'Your plant is healthy and potted!' },
  { minLevel: 10, emoji: '🌳', msg: 'Your plant has become a mighty tree!' },
  { minLevel: 15, emoji: '🌸', msg: 'Your tree is blossoming beautifully!' },
  { minLevel: 20, emoji: '✨🌳✨', msg: 'A magical glowing tree of ultimate focus!' }
];

export function initGamification() {
  checkDailyReset();
  updateUI();
}

function checkDailyReset() {
  const state = getStorageItem(GAMIFICATION_KEY, defaultState);
  const today = new Date().toDateString();
  
  if (state.lastUpdated !== today) {
    // Reset daily stats
    state.tasksCompletedToday = 0;
    state.waterLoggedToday = 0;
    state.focusMinutesToday = 0;
    state.lastUpdated = today;
    setStorageItem(GAMIFICATION_KEY, state);
  }
}

export function addXP(amount) {
  const state = getStorageItem(GAMIFICATION_KEY, defaultState);
  state.xp += amount;
  
  const xpNeeded = getXPForNextLevel(state.level);
  let leveledUp = false;
  
  if (state.xp >= xpNeeded) {
    state.xp -= xpNeeded;
    state.level += 1;
    leveledUp = true;
  }
  
  setStorageItem(GAMIFICATION_KEY, state);
  updateUI();
  
  if (leveledUp) {
    playLevelUpEffect(state.level);
  }
}

export function logDailyActivity(type, amount = 1) {
  const state = getStorageItem(GAMIFICATION_KEY, defaultState);
  if (type === 'task') state.tasksCompletedToday += amount;
  if (type === 'water') state.waterLoggedToday += amount;
  if (type === 'focus') state.focusMinutesToday += amount;
  
  setStorageItem(GAMIFICATION_KEY, state);
  updateUI();
}

function getXPForNextLevel(level) {
  return Math.floor(100 * Math.pow(1.2, level - 1));
}

function updateUI() {
  const state = getStorageItem(GAMIFICATION_KEY, defaultState);
  
  // 1. Update Level & XP Bar
  const levelDisplay = document.getElementById('level-display');
  const xpDisplay = document.getElementById('xp-display');
  const xpProgressFill = document.getElementById('xp-progress-fill');
  
  if (levelDisplay) levelDisplay.textContent = `Level ${state.level}`;
  
  const xpNeeded = getXPForNextLevel(state.level);
  if (xpDisplay) xpDisplay.textContent = `${Math.floor(state.xp)} / ${Math.floor(xpNeeded)} XP`;
  
  if (xpProgressFill) {
    const pct = Math.min(100, Math.max(0, (state.xp / xpNeeded) * 100));
    xpProgressFill.style.width = `${pct}%`;
    
    // Update avatar ring fill
    const avatarRingFill = document.getElementById('avatar-ring-fill');
    if (avatarRingFill) {
      const circumference = 276.46; // Circumference of radius 44 circle
      const offset = circumference - (pct / 100) * circumference;
      avatarRingFill.style.strokeDashoffset = offset;
    }
  }
  
  // 2. Update Virtual Pet
  const petContainer = document.getElementById('virtual-pet-container');
  const petMsg = document.getElementById('pet-status-msg');
  
  if (petContainer && petMsg) {
    let currentStage = PET_STAGES[0];
    for (let i = PET_STAGES.length - 1; i >= 0; i--) {
      if (state.level >= PET_STAGES[i].minLevel) {
        currentStage = PET_STAGES[i];
        break;
      }
    }
    
    petContainer.textContent = currentStage.emoji;
    petMsg.textContent = currentStage.msg;
    
    // Add sleepy effect if no tasks completed today
    if (state.tasksCompletedToday === 0 && state.level > 1) {
      petContainer.style.opacity = '0.6';
      petContainer.style.animation = 'none'; // Stop floating
      petMsg.textContent = `${currentStage.emoji} is feeling sleepy... do a task to wake it up!`;
    } else {
      petContainer.style.opacity = '1';
      petContainer.style.animation = 'floatFlame 3s ease-in-out infinite alternate';
    }
  }
  
  // 3. Update Daily Score
  const scoreDisplay = document.getElementById('daily-score-display');
  if (scoreDisplay) {
    const score = calculateDailyScore(state);
    scoreDisplay.textContent = score;
    
    // Change color based on score
    if (score === 'A+' || score === 'A') scoreDisplay.style.color = '#34d399'; // Green
    else if (score === 'B' || score === 'C') scoreDisplay.style.color = '#a78bfa'; // Purple
    else scoreDisplay.style.color = '#f87171'; // Red
  }
  
  // 4. Update Streak Aura Class
  const streakCard = document.querySelector('.streak-card');
  if (streakCard) {
    if (state.tasksCompletedToday > 0 || state.focusMinutesToday > 0 || state.waterLoggedToday > 0) {
      streakCard.classList.add('active-aura');
    } else {
      streakCard.classList.remove('active-aura');
    }
  }
}

function calculateDailyScore(state) {
  let score = 0;
  
  // Points for tasks
  score += Math.min(50, state.tasksCompletedToday * 10);
  
  // Points for focus (1 point per minute up to 30)
  score += Math.min(30, state.focusMinutesToday);
  
  // Points for water
  score += Math.min(20, state.waterLoggedToday * 5); // Assuming waterLoggedToday is number of times logged
  
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 50) return 'C';
  if (score >= 20) return 'D';
  return 'F';
}

export function populateWeekInReview() {
  const state = getStorageItem(GAMIFICATION_KEY, defaultState);
  
  // In a real app we would aggregate 7 days of logs.
  // For demo aesthetics, we'll calculate based on current state + some flavor
  const score = calculateDailyScore(state);
  document.getElementById('wr-score').textContent = score;
  document.getElementById('wr-tasks').textContent = Math.max(state.tasksCompletedToday * 4, 12); // Simulated weekly
  document.getElementById('wr-focus').textContent = `${Math.max(Math.floor(state.focusMinutesToday * 3 / 60), 2)}h`;
  
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  document.getElementById('wr-best-day').textContent = days[new Date().getDay() - 1] || 'Friday';
}

function playLevelUpEffect(level) {
  // Create a stunning full-screen level up effect with an evolution card
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.pointerEvents = 'all';
  overlay.style.display = 'flex';
  overlay.style.flexDirection = 'column';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = '99999';
  overlay.style.background = 'rgba(9, 8, 11, 0.85)';
  overlay.style.backdropFilter = 'blur(20px)';
  overlay.style.transition = 'opacity 0.5s ease';
  
  const card = document.createElement('div');
  card.style.width = '360px';
  card.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.005) 100%)';
  card.style.border = '1px solid rgba(255, 255, 255, 0.08)';
  card.style.boxShadow = '0 24px 64px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.05)';
  card.style.borderRadius = '24px';
  card.style.padding = '32px';
  card.style.textAlign = 'center';
  card.style.animation = 'slideUpBounce 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards';

  // Get stage name
  const state = getStorageItem(GAMIFICATION_KEY, defaultState);
  let currentStage = PET_STAGES[0];
  for (let i = PET_STAGES.length - 1; i >= 0; i--) {
    if (level >= PET_STAGES[i].minLevel) {
      currentStage = PET_STAGES[i];
      break;
    }
  }

  card.innerHTML = `
    <div style="font-size: 64px; margin-bottom: 20px; animation: floatFlame 3s ease-in-out infinite alternate;">${currentStage.emoji}</div>
    <h2 style="font-family: var(--font-display); font-size: 26px; font-weight: 800; color: #fff; margin-bottom: 8px;">Level Up!</h2>
    <p style="font-size: 14px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 24px;">
      You have evolved into a <strong>${currentStage.emoji} ${currentStage.name}</strong> at Level ${level}!
    </p>
    <button class="btn-primary" id="level-up-confirm-btn" style="width: 100%; padding: 12px; border-radius: 12px; font-weight: 700;">Continue ✓</button>
  `;
  
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  const confirmBtn = card.querySelector('#level-up-confirm-btn');
  confirmBtn.addEventListener('click', () => {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 500);
  });
  
  // Play subtle sound if browser allows
  try {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3');
    audio.volume = 0.5;
    audio.play().catch(e => console.log("Audio autoplay prevented"));
  } catch(e) {}
}

// Global hook for animations
if (typeof window !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideUpBounce {
      0% { transform: translateY(50px) scale(0.8); opacity: 0; }
      100% { transform: translateY(0) scale(1); opacity: 1; }
    }
    @keyframes fadeInOut {
      0% { opacity: 0; }
      20% { opacity: 1; }
      80% { opacity: 1; }
      100% { opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}
