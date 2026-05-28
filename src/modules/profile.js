import { getStorageItem, setStorageItem } from '../utils/storage.js';

const PROFILE_KEY = 'radhe_user_profile';

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
}

function updateProfileUI(profile) {
  document.getElementById('profile-name-display').textContent = profile.name;
  document.getElementById('profile-bio-display').textContent = profile.bio;
  document.getElementById('profile-avatar-display').textContent = profile.avatar;
  
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
  document.getElementById('edit-profile-btn').addEventListener('click', () => {
    document.getElementById('settings-modal-overlay').classList.remove('hidden');
    // Open profile tab
    document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.settings-tab[data-tab="profile"]').classList.add('active');
    document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('panel-profile').classList.add('active');
  });
}
