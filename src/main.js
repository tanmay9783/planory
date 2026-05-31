import './style.css';
import { preloadCache } from './utils/storage.js';
import { initProfile } from './modules/profile.js';
import { initThemes } from './modules/themes.js';
import { initQuotes } from './modules/quotes.js';
import { initBrainDump } from './modules/brain-dump.js';
import { initVoiceInput } from './modules/voice.js';
import { initPomodoro, stopAmbientSound } from './modules/pomodoro.js';
import { initHabits } from './modules/habits.js';
import { initMonthlyCalendar, renderMonthlyCalendar } from './modules/monthly-cal.js';
import { initTasks, renderGrid } from './modules/tasks.js';
import { initBudgetTracker } from './modules/budget.js';
import { initHydration } from './modules/hydration.js';
import { initNotes, renderNotesLibrary } from './modules/notes.js';

import { initGamification, populateWeekInReview } from './modules/gamification.js';
import { initThemeToggle, initZenMode, initLivePresence, initCollapsibleSections } from './modules/advanced-focus.js';
import { initAuth } from './modules/auth.js';
import { auth } from './db/firebase.js';
import { onAuthStateChanged } from 'firebase/auth';

console.log("⚡ main.js evaluated!");

function runInit() {
  console.log("⚡ runInit called!");

  const safeInit = (name, fn) => {
    try { fn(); } catch (e) { console.error(`Error initializing ${name}:`, e); }
  };

  // 1. Initialize Profile & Settings tabs
  safeInit('Profile', initProfile);
  safeInit('Themes', initThemes);
  safeInit('Quotes', initQuotes);

  // 2. Initialize Core Features
  safeInit('Gamification', initGamification);
  safeInit('MonthlyCalendar', initMonthlyCalendar);
  safeInit('Tasks', initTasks);
  safeInit('BrainDump', initBrainDump);
  safeInit('VoiceInput', initVoiceInput);
  safeInit('Pomodoro', initPomodoro);
  safeInit('Habits', initHabits);
  safeInit('BudgetTracker', initBudgetTracker);
  safeInit('Hydration', initHydration);
  safeInit('Notes', initNotes);

  // 3. Setup General Layout Triggers & Navigation switches
  safeInit('GeneralUI', setupGeneralUI);
}

function applyTimeOfDayTheme() {
  const hour = new Date().getHours();
  const body = document.body;

  body.classList.remove('theme-morning', 'theme-day', 'theme-evening', 'theme-night');

  if (hour >= 5 && hour < 11) body.classList.add('theme-morning');
  else if (hour >= 11 && hour < 17) body.classList.add('theme-day');
  else if (hour >= 17 && hour < 20) body.classList.add('theme-evening');
  else body.classList.add('theme-night');
}

function initAppFlow() {
  let appInitialized = false;

  // Initialize Auth listeners (login/signup buttons, status updates) immediately
  try {
    initAuth();
  } catch (e) {
    console.error("Error initializing Auth module:", e);
  }

  onAuthStateChanged(auth, async (user) => {
    const authModal = document.getElementById('auth-modal-overlay');
    const closeBtn = document.getElementById('auth-close-btn');

    if (user) {
      if (authModal) authModal.classList.add('hidden');
      if (closeBtn) closeBtn.style.display = ''; // restore close button visibility
      
      if (!appInitialized) {
        appInitialized = true;
        // Wait for DB cache to preload before rendering any module
        await preloadCache();
        runInit();
      }
    } else {
      // Force show auth modal overlay and hide its close button
      if (authModal) {
        authModal.classList.remove('hidden');
        if (closeBtn) closeBtn.style.display = 'none';
      }
      
      // If the app was previously initialized and user logs out, reload to clear memory/UI states
      if (appInitialized) {
        window.location.reload();
      }
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    applyTimeOfDayTheme();
    initAppFlow();
  });
} else {
  applyTimeOfDayTheme();
  initAppFlow();
}

function setupGeneralUI() {
  console.log("⚡ setupGeneralUI called!");
  // Sidebar toggler
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('sidebar-toggle');

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
    });
  }

  // View switches (Weekly Timetable vs Dedicated Month Calendar)
  const viewWeeklyBtn = document.getElementById('view-weekly-btn');
  const viewCalendarBtn = document.getElementById('view-calendar-btn');
  
  const weeklyGrid = document.getElementById('weekly-grid-view');
  const monthlyCalendar = document.getElementById('monthly-calendar-view');

  if (viewWeeklyBtn && viewCalendarBtn && weeklyGrid && monthlyCalendar) {
    viewWeeklyBtn.addEventListener('click', () => {
      viewWeeklyBtn.classList.add('active');
      viewCalendarBtn.classList.remove('active');

      weeklyGrid.classList.remove('hidden');
      monthlyCalendar.classList.add('hidden');

      renderGrid(); // Rerender weekly grid
    });

    viewCalendarBtn.addEventListener('click', () => {
      viewCalendarBtn.classList.add('active');
      viewWeeklyBtn.classList.remove('active');

      monthlyCalendar.classList.remove('hidden');
      weeklyGrid.classList.add('hidden');

      renderMonthlyCalendar(); // Rerender monthly calendar
    });
  }

  // Settings Tab switches
  const tabs = document.querySelectorAll('.settings-tab');
  const panels = document.querySelectorAll('.settings-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      const target = tab.dataset.tab;
      document.getElementById(`panel-${target}`).classList.add('active');
    });
  });

  // Settings Modal opening / closing
  const openSettingsBtn = document.getElementById('open-settings-btn');
  const settingsOverlay = document.getElementById('settings-modal-overlay');
  const closeSettingsBtn = document.getElementById('settings-close-btn');

  if (openSettingsBtn && settingsOverlay) {
    openSettingsBtn.addEventListener('click', () => {
      settingsOverlay.classList.remove('hidden');
    });
  }

  if (closeSettingsBtn && settingsOverlay) {
    closeSettingsBtn.addEventListener('click', () => {
      settingsOverlay.classList.add('hidden');
    });
  }

  // Advanced Focus Modules
  initThemeToggle();
  initZenMode();
  initLivePresence();
  initCollapsibleSections();

  // Week in Review Modal
  const wrBtn = document.getElementById('week-review-btn');
  const wrOverlay = document.getElementById('week-review-overlay');
  const wrCloseBtn = document.getElementById('close-week-review-btn');

  if (wrBtn && wrOverlay) {
    wrBtn.addEventListener('click', () => {
      populateWeekInReview();
      wrOverlay.classList.remove('hidden');
    });
  }

  if (wrCloseBtn && wrOverlay) {
    wrCloseBtn.addEventListener('click', () => {
      wrOverlay.classList.add('hidden');
    });
  }

  // Hamburger Apps Hub Drawer Triggers
  const hubBtn = document.getElementById('global-hub-hamburger-btn');
  const hubOverlay = document.getElementById('apps-hub-overlay');
  const hubClose = document.getElementById('apps-hub-close-btn');

  if (hubBtn && hubOverlay) {
    hubBtn.addEventListener('click', () => {
      hubOverlay.classList.remove('hidden');
    });
  }

  if (hubClose && hubOverlay) {
    hubClose.addEventListener('click', () => {
      hubOverlay.classList.add('hidden');
    });
  }

  // Hub Drawer Tile Launch Events
  const tileNotes = document.getElementById('hub-tile-notes');
  const tileWater = document.getElementById('hub-tile-water');
  const tileBudget = document.getElementById('hub-tile-budget');
  const tilePomo = document.getElementById('hub-tile-pomodoro');

  if (tileNotes) {
    tileNotes.addEventListener('click', () => {
      hubOverlay.classList.add('hidden');
      document.getElementById('notes-library-modal-overlay').classList.remove('hidden');
      renderNotesLibrary();
    });
  }

  if (tileWater) {
    tileWater.addEventListener('click', () => {
      hubOverlay.classList.add('hidden');
      document.getElementById('water-modal-overlay').classList.remove('hidden');
    });
  }

  if (tileBudget) {
    tileBudget.addEventListener('click', () => {
      hubOverlay.classList.add('hidden');
      document.getElementById('budget-insights-modal-overlay').classList.remove('hidden');
    });
  }

  if (tilePomo) {
    tilePomo.addEventListener('click', () => {
      hubOverlay.classList.add('hidden');
      document.getElementById('pomodoro-modal-overlay').classList.remove('hidden');
    });
  }

  // Close modals when clicking overlay outside card
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        // Prevent closing the auth overlay when the user is logged out (forced auth screen)
        if (overlay.id === 'auth-modal-overlay' && !auth.currentUser) {
          return;
        }
        overlay.classList.add('hidden');
        if (overlay.id === 'pomodoro-modal-overlay') {
          stopAmbientSound();
        }
      }
    });
  });

  // Notes library modal close
  const libraryClose = document.getElementById('notes-library-close-btn');
  if (libraryClose) {
    libraryClose.addEventListener('click', () => {
      document.getElementById('notes-library-modal-overlay').classList.add('hidden');
    });
  }

  // Pomodoro Focus modal close
  const pomoClose = document.getElementById('pomodoro-modal-close-btn');
  if (pomoClose) {
    pomoClose.addEventListener('click', () => {
      document.getElementById('pomodoro-modal-overlay').classList.add('hidden');
      stopAmbientSound();
    });
  }

  // Handle Side Notes drawer click overlay closing
  const drawerOverlay = document.getElementById('notes-drawer-overlay');
  if (drawerOverlay) {
    drawerOverlay.addEventListener('click', (e) => {
      if (e.target === drawerOverlay) {
        drawerOverlay.classList.add('hidden');
        renderGrid();
      }
    });
  }
}
