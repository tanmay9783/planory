import { auth } from '../db/firebase.js';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged,
  signOut
} from 'firebase/auth';
import { startRealtimeSync, stopRealtimeSync, syncPendingChanges } from '../db/syncEngine.js';

export function initAuth() {
  const authBtn = document.getElementById('auth-login-btn');
  const authModal = document.getElementById('auth-modal-overlay');
  const closeBtn = document.getElementById('auth-close-btn');
  
  const emailInput = document.getElementById('auth-email');
  const passInput = document.getElementById('auth-password');
  const loginBtn = document.getElementById('auth-login-submit');
  const signupBtn = document.getElementById('auth-signup-submit');
  const errorMsg = document.getElementById('auth-error-msg');

  // Handle Auth State Changes
  onAuthStateChanged(auth, (user) => {
    if (user) {
      // Logged in
      authBtn.innerHTML = '☁️ Synced';
      authBtn.style.color = 'var(--color-success)';
      authBtn.title = `Logged in as ${user.email} (Click to logout)`;
      
      authModal.classList.add('hidden');
      if (closeBtn) closeBtn.style.display = '';
      
      // Start Background Sync Engine!
      startRealtimeSync();
      syncPendingChanges(); // initial push if any
    } else {
      // Logged out
      authBtn.innerHTML = '☁️ Off';
      authBtn.style.color = 'var(--text-muted)';
      authBtn.title = 'Enable Cloud Sync';
      
      authModal.classList.remove('hidden');
      if (closeBtn) closeBtn.style.display = 'none';
      
      stopRealtimeSync();
    }
  });

  // Toggle Auth Modal / Logout
  if (authBtn) {
    authBtn.addEventListener('click', () => {
      if (auth.currentUser) {
        if (confirm('Log out of Cloud Sync? Data will remain locally.')) {
          signOut(auth);
        }
      } else {
        authModal.classList.remove('hidden');
        errorMsg.style.display = 'none';
      }
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      if (!auth.currentUser) return; // Prevent close if not logged in
      authModal.classList.add('hidden');
    });
  }

  // Handle Login
  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      errorMsg.style.display = 'none';
      const email = emailInput.value.trim();
      const password = passInput.value;
      if (!email || !password) return;

      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (err) {
        errorMsg.textContent = err.message;
        errorMsg.style.display = 'block';
      }
    });
  }

  // Handle Sign Up
  if (signupBtn) {
    signupBtn.addEventListener('click', async () => {
      errorMsg.style.display = 'none';
      const email = emailInput.value.trim();
      const password = passInput.value;
      if (!email || !password) return;

      try {
        await createUserWithEmailAndPassword(auth, email, password);
      } catch (err) {
        errorMsg.textContent = err.message;
        errorMsg.style.display = 'block';
      }
    });
  }
}
