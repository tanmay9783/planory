import { getStorageItem, setStorageItem, removeStorageItem } from '../utils/storage.js';
import { auth } from '../db/firebase.js';
import { deleteUser } from 'firebase/auth';

const PROFILE_KEY = 'user_profile';

const defaultProfile = {
  name: 'Tanmay',
  bio: 'Builder & Innovator ☕',
  timezone: 'Asia/Kolkata',
  avatar: '🦁',
  onboarded: false
};

export function initProfile() {
  const profile = getStorageItem(PROFILE_KEY, defaultProfile);
  
  // Elements
  const onboardingOverlay = document.getElementById('onboarding-overlay');
  const profileNameDisplay = document.getElementById('profile-name-display');
  const profileBioDisplay = document.getElementById('profile-bio-display');
  const profileAvatarDisplay = document.getElementById('profile-avatar-display');
  
  if (!profile.onboarded) {
    onboardingOverlay.classList.remove('hidden');
    setupOnboardingEvents(profile);
  } else {
    onboardingOverlay.classList.add('hidden');
    updateProfileUI(profile);
  }
  
  setupSettingsProfileEvents(profile);
  setupWorkspaceSettings();
  initMobileAppConfig();
}

function updateProfileUI(profile) {
  document.getElementById('profile-name-display').textContent = profile.name;
  document.getElementById('profile-bio-display').textContent = profile.bio;
  document.getElementById('profile-avatar-display').textContent = profile.avatar;
  
  // Update Workspace Hub Title
  const hubTitle = document.getElementById('workspace-hub-title');
  if (hubTitle) {
    hubTitle.textContent = `⚡ ${profile.name} Workspace Hub`;
  }
  
  // Set in Settings page inputs
  document.getElementById('settings-name').value = profile.name;
  document.getElementById('settings-bio').value = profile.bio;
  
  // Select matching avatar option in settings
  const avatarOpts = document.querySelectorAll('#settings-avatar-picker .avatar-opt');
  avatarOpts.forEach(opt => {
    if (opt.dataset.avatar === profile.avatar) {
      opt.classList.add('selected');
    } else {
      opt.classList.remove('selected');
    }
  });
}

function setupOnboardingEvents(profile) {
  const saveBtn = document.getElementById('onboarding-save');
  const nameInput = document.getElementById('profile-name-input');
  const bioInput = document.getElementById('profile-bio-input');
  const tzInput = document.getElementById('profile-timezone-input');
  const avatarPicker = document.getElementById('avatar-picker');
  
  let selectedAvatar = '🦁';
  
  avatarPicker.addEventListener('click', (e) => {
    const opt = e.target.closest('.avatar-opt');
    if (!opt) return;
    
    avatarPicker.querySelectorAll('.avatar-opt').forEach(el => el.classList.remove('selected'));
    opt.classList.add('selected');
    selectedAvatar = opt.dataset.avatar;
  });
  
  saveBtn.addEventListener('click', () => {
    const name = nameInput.value.trim() || 'Radhe Planner';
    const bio = bioInput.value.trim() || 'My Focus Area';
    const timezone = tzInput.value;
    
    const updatedProfile = {
      name,
      bio,
      timezone,
      avatar: selectedAvatar,
      onboarded: true
    };
    
    setStorageItem(PROFILE_KEY, updatedProfile);
    document.getElementById('onboarding-overlay').classList.add('hidden');
    updateProfileUI(updatedProfile);
  });
}

function setupSettingsProfileEvents(profile) {
  const saveBtn = document.getElementById('save-profile-btn');
  const avatarPicker = document.getElementById('settings-avatar-picker');
  if (!saveBtn || !avatarPicker) return;
  
  let selectedAvatar = profile.avatar;
  
  avatarPicker.addEventListener('click', (e) => {
    const opt = e.target.closest('.avatar-opt');
    if (!opt) return;
    
    avatarPicker.querySelectorAll('.avatar-opt').forEach(el => el.classList.remove('selected'));
    opt.classList.add('selected');
    selectedAvatar = opt.dataset.avatar;
  });
  
  saveBtn.addEventListener('click', () => {
    const name = document.getElementById('settings-name').value.trim() || 'Radhe Planner';
    const bio = document.getElementById('settings-bio').value.trim() || 'My Focus Area';
    
    const updatedProfile = {
      name,
      bio,
      timezone: profile.timezone,
      avatar: selectedAvatar,
      onboarded: true
    };
    
    setStorageItem(PROFILE_KEY, updatedProfile);
    updateProfileUI(updatedProfile);
    
    // Show notification toast
    const toast = document.getElementById('notif-toast');
    document.getElementById('notif-msg').textContent = "Profile updated successfully! ✨";
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
  });
  
  // Hook open profile edit button
  const editBtn = document.getElementById('edit-profile-btn');
  if (editBtn) {
    editBtn.addEventListener('click', () => {
      document.getElementById('settings-modal-overlay').classList.remove('hidden');
      // Open account tab
      document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
      const accountTab = document.querySelector('.settings-tab[data-tab="account"]');
      if (accountTab) accountTab.classList.add('active');
      document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
      const accountPanel = document.getElementById('panel-account');
      if (accountPanel) accountPanel.classList.add('active');
    });
  }
}

function setupWorkspaceSettings() {
  // 1. Appearance Settings: Dark/Light Mode
  const darkmodeBtn = document.getElementById('settings-darkmode-toggle');
  if (darkmodeBtn) {
    const updateDarkmodeBtnText = () => {
      const isLight = document.body.classList.contains('theme-light');
      darkmodeBtn.textContent = isLight ? "Light Mode" : "Dark Mode";
    };
    
    updateDarkmodeBtnText();
    
    darkmodeBtn.addEventListener('click', () => {
      const themeToggleBtn = document.getElementById('theme-toggle-btn');
      if (themeToggleBtn) {
        themeToggleBtn.click();
        updateDarkmodeBtnText();
      }
    });
  }

  // 2. Font Size Pickers (S, M, L)
  const fontsizeBtns = document.querySelectorAll('.fontsize-btn');
  const savedSize = getStorageItem('planory_font_size', 'M');
  
  const applyFontSize = (sz) => {
    const root = document.documentElement;
    fontsizeBtns.forEach(btn => {
      if (btn.dataset.sz === sz) btn.classList.add('active');
      else btn.classList.remove('active');
    });
    
    if (sz === 'S') {
      root.style.setProperty('--font-base', '12px');
      root.style.setProperty('--font-lg', '14px');
      root.style.setProperty('--font-xl', '18px');
      root.style.setProperty('--font-2xl', '20px');
    } else if (sz === 'L') {
      root.style.setProperty('--font-base', '16px');
      root.style.setProperty('--font-lg', '18px');
      root.style.setProperty('--font-xl', '22px');
      root.style.setProperty('--font-2xl', '26px');
    } else {
      // M (Default)
      root.style.setProperty('--font-base', '14px');
      root.style.setProperty('--font-lg', '16px');
      root.style.setProperty('--font-xl', '20px');
      root.style.setProperty('--font-2xl', '24px');
    }
  };
  
  applyFontSize(savedSize);
  
  fontsizeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const sz = btn.dataset.sz;
      setStorageItem('planory_font_size', sz);
      applyFontSize(sz);
    });
  });

  // 3. Study Preferences
  const saveStudyBtn = document.getElementById('save-study-prefs-btn');
  const sessionInput = document.getElementById('settings-study-session');
  const breakInput = document.getElementById('settings-study-break');
  const soundInput = document.getElementById('settings-study-sound');
  const goalInput = document.getElementById('settings-study-goal');
  
  const studyPrefs = getStorageItem('planory_study_prefs', {
    session: 25,
    break: 5,
    sound: 'none',
    goalHours: 4
  });
  
  if (sessionInput) sessionInput.value = studyPrefs.session;
  if (breakInput) breakInput.value = studyPrefs.break;
  if (soundInput) soundInput.value = studyPrefs.sound;
  if (goalInput) goalInput.value = studyPrefs.goalHours;
  
  if (saveStudyBtn) {
    saveStudyBtn.addEventListener('click', () => {
      const updated = {
        session: parseInt(sessionInput.value) || 25,
        break: parseInt(breakInput.value) || 5,
        sound: soundInput.value || 'none',
        goalHours: parseFloat(goalInput.value) || 4
      };
      setStorageItem('planory_study_prefs', updated);
      
      const toast = document.getElementById('notif-toast');
      document.getElementById('notif-msg').textContent = "Study preferences saved! 📚";
      toast.classList.remove('hidden');
      setTimeout(() => toast.classList.add('hidden'), 3000);
    });
  }

  // 4. Notifications
  const toggles = {
    water: document.getElementById('notif-toggle-water'),
    deadline: document.getElementById('notif-toggle-deadline'),
    habit: document.getElementById('notif-toggle-habit')
  };
  
  const savedNotifs = getStorageItem('planory_notifications_enabled', {
    water: true,
    deadline: true,
    habit: true
  });
  
  Object.keys(toggles).forEach(k => {
    const el = toggles[k];
    if (el) {
      el.checked = savedNotifs[k] !== false;
      el.addEventListener('change', () => {
        savedNotifs[k] = el.checked;
        setStorageItem('planory_notifications_enabled', savedNotifs);
      });
    }
  });

  // 5. Data Management
  const exportBtn = document.getElementById('data-export-btn');
  const clearBtn  = document.getElementById('data-clear-btn');
  const deleteBtn = document.getElementById('data-delete-btn');

  // Helper: show the app's notification toast
  function showDataToast(msg, isError = false) {
    const toast = document.getElementById('notif-toast');
    const msgEl = document.getElementById('notif-msg');
    if (!toast || !msgEl) return;
    msgEl.textContent = msg;
    toast.style.background = isError ? 'rgba(248,113,113,0.12)' : '';
    toast.style.borderColor = isError ? 'rgba(248,113,113,0.3)' : '';
    toast.style.color = isError ? '#f87171' : '';
    toast.classList.remove('hidden');
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => {
      toast.classList.add('hidden');
      toast.style.background = '';
      toast.style.borderColor = '';
      toast.style.color = '';
    }, 3500);
  }

  // Helper: in-app confirm dialog (no native browser dialogs)
  function showInAppConfirm(message, onConfirm) {
    const existing = document.getElementById('data-confirm-card');
    if (existing) existing.remove();

    const card = document.createElement('div');
    card.id = 'data-confirm-card';
    card.style.cssText = `
      position: fixed; inset: 0; z-index: 200000;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.75); backdrop-filter: blur(10px);
    `;
    card.innerHTML = `
      <div style="
        background: #1a1d24; border: 1px solid rgba(255,255,255,0.07);
        border-radius: 20px; padding: 32px 28px; max-width: 360px; width: 90%;
        box-shadow: 0 24px 60px rgba(0,0,0,0.6);
        display: flex; flex-direction: column; gap: 20px;
        animation: scaleIn 0.3s cubic-bezier(0.34,1.56,0.64,1);
      ">
        <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.6;">${message}</div>
        <div style="display: flex; gap: 10px;">
          <button id="data-confirm-yes" style="
            flex:1; padding:10px; border-radius:10px; font-weight:700; font-size:13px;
            background: #f87171; color:#fff; border:none; cursor:pointer;
            transition: opacity 0.2s;
          ">Confirm</button>
          <button id="data-confirm-no" style="
            flex:1; padding:10px; border-radius:10px; font-weight:600; font-size:13px;
            background: rgba(255,255,255,0.05); color:var(--text-secondary);
            border: 1px solid rgba(255,255,255,0.06); cursor:pointer;
            transition: opacity 0.2s;
          ">Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(card);
    card.querySelector('#data-confirm-yes').addEventListener('click', () => {
      card.remove();
      onConfirm();
    });
    card.querySelector('#data-confirm-no').addEventListener('click', () => card.remove());
  }

  // Clear History
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      showInAppConfirm(
        'This will clear your task history, hydration logs, habits progress, and expenses — but keep your profile and settings intact. This cannot be undone.',
        () => {
          const toClear = [
            'tasks', 'hydration_logs', 'gamification', 'user_habits', 'habit_logs', 'expenses',
            'pomo_forest', 'forest_growth_progress', 'brain_dump', 'weekly_tasks'
          ];
          toClear.forEach(k => removeStorageItem(k));
          showDataToast('History cleared. Reloading in 2 seconds...');
          setTimeout(() => window.location.reload(), 2000);
        }
      );
    });
  }

  // Delete Account
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      showInAppConfirm(
        'WARNING: This permanently deletes your profile and ALL data from this device. This action cannot be undone.',
        () => {
          showDataToast('Deleting account and all data. Please wait...');
          setTimeout(async () => {
            // Delete user in firebase if logged in
            const user = auth.currentUser;
            if (user) {
              try {
                await deleteUser(user);
              } catch (err) {
                console.warn('Firebase user delete failed (needs recent login), signing out instead:', err);
                try {
                  const { signOut } = await import('firebase/auth');
                  await signOut(auth);
                } catch (e) {}
              }
            }
            // Clear IndexedDB
            try {
              const { localDB } = await import('../db/database.js');
              await localDB.kv_store.clear();
            } catch (err) {
              console.error('Dexie clear failed:', err);
            }
            localStorage.clear();
            sessionStorage.clear();
            window.location.reload();
          }, 1500);
        }
      );
    });
  }
}

async function initMobileAppConfig() {
  // Elements
  const banner = document.getElementById('apk-promo-banner');
  const bannerClose = document.getElementById('banner-close-btn');
  const bannerDownload = document.getElementById('banner-download-btn');
  const hubTileMobile = document.getElementById('hub-tile-mobile');
  
  const settingsVersion = document.getElementById('settings-apk-version');
  const settingsSize = document.getElementById('settings-apk-size');
  const settingsDate = document.getElementById('settings-apk-date');
  const settingsChangelog = document.getElementById('settings-apk-changelog');
  const settingsDownloadLink = document.getElementById('settings-apk-download-link');
  const settingsQr = document.getElementById('settings-apk-qr');
  const otaInfoCard = document.getElementById('ota-info-card');
  const otaMinVersionText = document.getElementById('ota-min-version-text');
  const otaStatusText = document.getElementById('ota-status-text');

  // Fallback defaults matching app-config.json schema
  let apkConfig = {
    version: '1.0.0',
    apkUrl: '/planrova.apk',
    size: '24.8 MB',
    updatedDate: 'June 2026',
    changelog: 'First release — planner, water log, alarms, budget',
    qrCodeImage: '/qr-planrova.png',
    qrCodeText: 'https://planrova.com/planrova.apk',
    supportsOTA: true,
    minimumRequiredVersion: '1.0.0'
  };

  try {
    const res = await fetch('/app-config.json');
    if (res.ok) {
      const data = await res.json();
      apkConfig = { ...apkConfig, ...data };
    }
  } catch (err) {
    console.warn('Failed to load app-config.json, using defaults:', err);
  }

  // Populate settings modal fields
  if (settingsVersion) settingsVersion.textContent = `v${apkConfig.version}`;
  if (settingsSize) settingsSize.textContent = apkConfig.size;
  if (settingsDate) settingsDate.textContent = apkConfig.updatedDate;
  if (settingsChangelog) settingsChangelog.textContent = apkConfig.changelog;
  if (settingsDownloadLink) {
    settingsDownloadLink.setAttribute('href', apkConfig.apkUrl);
  }

  // Static QR image — no dynamic generation, works offline
  if (settingsQr && apkConfig.qrCodeImage) {
    settingsQr.setAttribute('src', apkConfig.qrCodeImage);
    settingsQr.setAttribute('alt', `Scan to download Planrova APK — ${apkConfig.qrCodeText}`);
  }

  // OTA Update Info Card
  if (otaInfoCard) {
    if (apkConfig.supportsOTA) {
      otaInfoCard.classList.remove('hidden');
      if (otaMinVersionText) {
        otaMinVersionText.textContent = apkConfig.minimumRequiredVersion || '1.0.0';
      }
      if (otaStatusText) {
        otaStatusText.textContent = 'Installed app automatically receives feature updates.';
      }
    } else {
      otaInfoCard.classList.add('hidden');
    }
  }

  // Banner visibility — show once per session unless dismissed
  const isDismissed = getStorageItem('planrova_apk_banner_dismissed', false);
  if (banner && !isDismissed) {
    banner.classList.remove('hidden');
  }

  if (bannerClose && banner) {
    bannerClose.addEventListener('click', () => {
      banner.classList.add('hidden');
      setStorageItem('planrova_apk_banner_dismissed', true);
    });
  }

  // Banner download button — triggers file download
  if (bannerDownload) {
    bannerDownload.addEventListener('click', () => {
      const link = document.createElement('a');
      link.href = apkConfig.apkUrl;
      link.download = apkConfig.apkUrl.split('/').pop() || 'planrova.apk';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  }

  // Apps Hub tile click — closes drawer and opens Settings → Mobile App tab
  if (hubTileMobile) {
    hubTileMobile.addEventListener('click', () => {
      // Close apps hub drawer
      const appsHubOverlay = document.getElementById('apps-hub-overlay');
      if (appsHubOverlay) {
        appsHubOverlay.classList.add('hidden');
      }

      // Open settings modal
      const settingsOverlay = document.getElementById('settings-modal-overlay');
      if (settingsOverlay) {
        settingsOverlay.classList.remove('hidden');
      }

      // Activate Mobile App settings tab and panel
      document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
      const mobileTab = document.querySelector('.settings-tab[data-tab="mobile-app"]');
      if (mobileTab) mobileTab.classList.add('active');

      document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
      const mobilePanel = document.getElementById('panel-mobile-app');
      if (mobilePanel) mobilePanel.classList.add('active');
    });
  }
}
