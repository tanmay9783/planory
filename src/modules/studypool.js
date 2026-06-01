import { getStorageItem, setStorageItem } from '../utils/storage.js';
import { db, auth } from '../db/firebase.js';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  serverTimestamp, 
  doc, 
  setDoc, 
  deleteDoc,
  getDocs,
  where
} from 'firebase/firestore';

let isJoined = false;
let activeRoom = 'global'; // 'global' or 'private'
let activeBuddies = [];
let allMessages = [];
let unsubMessages = null;
let unsubUsers = null;
let friendsList = getStorageItem('studypool_friends', []);

// Bots configuration
let chatInterval = null;
let simulationInterval = null;
const BOTS = [
  { isBot: true, email: 'aarav@bot.com', name: 'Aarav 🦁', seed: 'sakura', status: 'Studying', progress: 45, timestamp: Date.now() },
  { isBot: true, email: 'riya@bot.com', name: 'Riya 🌸', seed: 'oak', status: 'Studying', progress: 80, timestamp: Date.now() },
  { isBot: true, email: 'kabir@bot.com', name: 'Kabir 🦄', seed: 'pine', status: 'Studying', progress: 12, timestamp: Date.now() },
];
const ENCOURAGING_MESSAGES = [
  "Keep going guys, we can do this! 🚀",
  "Just completed 25 mins of chemistry. Feeling good! 📚",
  "Remember to drink some water! 💧",
  "Focus mode is glowing today! ✨",
  "That Lofi track is fire 🔥"
];

export function initStudypool() {
  const joinBtn = document.getElementById('join-room-btn');
  const chatInput = document.getElementById('studypool-chat-input');
  const sendBtn = document.getElementById('studypool-send-btn');
  
  // Room Toggles
  const toggleGlobal = document.getElementById('room-toggle-global');
  const togglePrivate = document.getElementById('room-toggle-private');
  
  if (toggleGlobal && togglePrivate) {
    toggleGlobal.onclick = () => {
      activeRoom = 'global';
      toggleGlobal.classList.add('active');
      toggleGlobal.style.color = 'var(--accent)';
      togglePrivate.classList.remove('active');
      togglePrivate.style.color = 'var(--text-secondary)';
      togglePrivate.style.background = 'transparent';
      renderRoom();
      renderChat();
    };
    togglePrivate.onclick = () => {
      activeRoom = 'private';
      togglePrivate.classList.add('active');
      togglePrivate.style.color = 'var(--accent)';
      togglePrivate.style.background = 'var(--surface-300)';
      toggleGlobal.classList.remove('active');
      toggleGlobal.style.color = 'var(--text-secondary)';
      toggleGlobal.style.background = 'transparent';
      renderRoom();
      renderChat();
    };
  }

  // Add Friend Logic
  const addFriendBtn = document.getElementById('add-friend-btn');
  const addFriendInput = document.getElementById('add-friend-email-input');
  const addFriendStatus = document.getElementById('add-friend-status');

  if (addFriendBtn && addFriendInput) {
    addFriendBtn.onclick = async () => {
      const email = addFriendInput.value.trim().toLowerCase();
      if (!email || !email.includes('@')) {
        showFriendStatus('Please enter a valid email', true);
        return;
      }
      if (friendsList.includes(email)) {
        showFriendStatus('Already in friends list', true);
        return;
      }
      
      showFriendStatus('Checking...', false);
      addFriendBtn.disabled = true;

      try {
        const q = query(collection(db, 'users_directory'), where('email', '==', email));
        const snap = await getDocs(q);
        
        if (snap.empty) {
          showFriendStatus('User not registered', true);
        } else {
          friendsList.push(email);
          setStorageItem('studypool_friends', friendsList);
          showFriendStatus(`Added ${email}!`, false);
          addFriendInput.value = '';
          renderRoom();
          renderChat();
        }
      } catch (e) {
        console.error("Error verifying friend:", e);
        showFriendStatus('Network error verifying user', true);
      } finally {
        addFriendBtn.disabled = false;
      }
    };
  }

  function showFriendStatus(msg, isError) {
    if (!addFriendStatus) return;
    addFriendStatus.textContent = msg;
    addFriendStatus.style.color = isError ? '#f87171' : '#7c9b7a';
    addFriendStatus.style.display = 'block';
    setTimeout(() => { addFriendStatus.style.display = 'none'; }, 3000);
  }

  if (joinBtn) {
    joinBtn.onclick = async () => {
      isJoined = !isJoined;
      if (isJoined) {
        joinBtn.textContent = 'Leave Room 🚪';
        joinBtn.style.background = '#f87171';
        chatInput.disabled = false;
        sendBtn.disabled = false;
        allMessages.push({ isSystem: true, text: "You have joined the Study Pool. Happy studying! ⚡" });
        renderChat();
        startBots();
        await joinFirebaseRoom();
      } else {
        joinBtn.textContent = 'Join Room ⚡';
        joinBtn.style.background = '';
        chatInput.disabled = true;
        sendBtn.disabled = true;
        allMessages.push({ isSystem: true, text: "You left the Study Pool." });
        renderChat();
        stopBots();
        await leaveFirebaseRoom();
      }
    };
  }

  if (sendBtn && chatInput) {
    const handleSend = async () => {
      const text = chatInput.value.trim();
      if (!text || !auth.currentUser) return;
      const profile = getStorageItem('user_profile', { name: 'You' });
      
      try {
        await addDoc(collection(db, 'studypool_messages'), {
          text: text,
          userId: auth.currentUser.uid,
          userName: profile.name,
          userEmail: auth.currentUser.email,
          timestamp: serverTimestamp()
        });
        chatInput.value = '';
      } catch (e) {
        console.error("Error sending message:", e);
      }
    };

    sendBtn.onclick = handleSend;
    chatInput.onkeydown = (e) => {
      if (e.key === 'Enter') handleSend();
    };
  }

  listenToFirebaseRoom();
}

function startBots() {
  chatInterval = setInterval(() => {
    const bot = BOTS[Math.floor(Math.random() * BOTS.length)];
    const text = ENCOURAGING_MESSAGES[Math.floor(Math.random() * ENCOURAGING_MESSAGES.length)];
    allMessages.push({ userName: bot.name, userEmail: bot.email, text, isBot: true });
    renderChat();
  }, 15000);

  simulationInterval = setInterval(() => {
    BOTS.forEach(bot => {
      bot.progress += Math.floor(Math.random() * 5) + 1;
      if (bot.progress >= 100) {
        bot.progress = 0;
        bot.status = 'Taking Break';
        allMessages.push({ isSystem: true, text: `${bot.name} completed their focus round! 🌳` });
        renderChat();
      } else if (bot.status === 'Taking Break' && Math.random() > 0.7) {
        bot.status = 'Studying';
        bot.progress = Math.floor(Math.random() * 10);
      }
    });
    renderRoom();
  }, 8000);
}

function stopBots() {
  clearInterval(chatInterval);
  clearInterval(simulationInterval);
}

async function joinFirebaseRoom() {
  if (!auth.currentUser) return;
  const uid = auth.currentUser.uid;
  const profile = getStorageItem('user_profile', { name: 'You', avatar: '🦁' });
  const seed = getStorageItem('forest_selected_seed', 'oak');
  
  window.studypoolSyncInterval = setInterval(async () => {
    if (!isJoined || !auth.currentUser) return;
    
    let progress = 20;
    let status = "Studying";
    const pomoTimerActive = document.getElementById('pomo-start-btn')?.textContent === 'Pause';
    
    if (pomoTimerActive) {
      status = "Focusing ⏱️";
      const timerText = document.getElementById('pomo-display')?.textContent || "25:00";
      const parts = timerText.split(':').map(Number);
      if (parts.length === 2) {
        const remainingSecs = parts[0] * 60 + parts[1];
        progress = Math.min(100, Math.max(0, Math.round(((1500 - remainingSecs) / 1500) * 100)));
      }
    }
    
    try {
      await setDoc(doc(db, 'studypool_users', uid), {
        name: profile.name,
        email: auth.currentUser.email,
        seed: seed,
        status: status,
        progress: progress,
        timestamp: Date.now()
      });
    } catch(e) {}
  }, 10000);
  
  try {
      await setDoc(doc(db, 'studypool_users', uid), {
        name: profile.name,
        email: auth.currentUser.email,
        seed: seed,
        status: "Studying",
        progress: 20,
        timestamp: Date.now()
      });
  } catch(e) {}

  const q = query(collection(db, 'studypool_messages'), orderBy('timestamp', 'desc'), limit(50));
  unsubMessages = onSnapshot(q, (snapshot) => {
    // We want to replace the chat history with the latest 50 messages, keeping local system/bot messages.
    // Instead of wiping allMessages, let's extract only the Firestore messages and append them properly.
    const firestoreMessages = [];
    snapshot.forEach(docSnap => {
      firestoreMessages.push(docSnap.data());
    });
    
    // Reverse to chronological order
    firestoreMessages.reverse();

    // Filter out existing firestore messages from allMessages to prevent duplicates
    allMessages = allMessages.filter(m => m.isSystem || m.isBot);
    
    // Add them back
    allMessages.push(...firestoreMessages);
    
    // Sort all messages by timestamp (system/bot messages use Date.now(), firestore uses timestamp object)
    allMessages.sort((a, b) => {
      const timeA = a.timestamp ? (a.timestamp.toMillis ? a.timestamp.toMillis() : a.timestamp) : Date.now();
      const timeB = b.timestamp ? (b.timestamp.toMillis ? b.timestamp.toMillis() : b.timestamp) : Date.now();
      return timeA - timeB;
    });

    renderChat();
  });
}

async function leaveFirebaseRoom() {
  if (window.studypoolSyncInterval) clearInterval(window.studypoolSyncInterval);
  if (unsubMessages) { unsubMessages(); unsubMessages = null; }
  if (auth.currentUser) {
    try { await deleteDoc(doc(db, 'studypool_users', auth.currentUser.uid)); } catch(e) {}
  }
}

function listenToFirebaseRoom() {
  const usersRef = collection(db, 'studypool_users');
  unsubUsers = onSnapshot(usersRef, (snapshot) => {
    activeBuddies = [];
    const now = Date.now();
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (now - data.timestamp < 60000) {
        if (!auth.currentUser || docSnap.id !== auth.currentUser.uid) {
           activeBuddies.push({ id: docSnap.id, ...data });
        }
      } else {
        try { deleteDoc(doc(db, 'studypool_users', docSnap.id)); } catch(e) {}
      }
    });
    renderRoom();
  });
}

window.addEventListener('beforeunload', () => {
    if (isJoined) leaveFirebaseRoom();
});

function renderChat() {
  const box = document.getElementById('studypool-chat-box');
  if (!box) return;
  box.innerHTML = '';
  
  const myEmail = auth.currentUser ? auth.currentUser.email : '';

  allMessages.forEach(msg => {
    // In private room, only show messages from friends, yourself, or system
    if (activeRoom === 'private') {
      const isFriend = msg.userEmail && friendsList.includes(msg.userEmail.toLowerCase());
      const isMe = msg.userEmail === myEmail;
      if (!isFriend && !isMe && !msg.isSystem) return;
    }

    const div = document.createElement('div');
    if (msg.isSystem) {
      div.style.color = 'var(--accent)';
      div.textContent = `[System] ${msg.text}`;
    } else {
      const isFriend = msg.userEmail && friendsList.includes(msg.userEmail.toLowerCase());
      const nameColor = isFriend ? '#4B6BFB' : '#fff';
      const badge = isFriend ? `<span style="background:#4B6BFB; color:#fff; padding:2px 4px; border-radius:4px; font-size:8px; margin-left:4px;">FRIEND</span>` : '';
      div.innerHTML = `<strong style="color:${nameColor};">${msg.userName}${badge}:</strong> ${msg.text}`;
    }
    box.appendChild(div);
  });
  box.scrollTop = box.scrollHeight;
}

function getGrowingPlantEmoji(seed, progress) {
  if (progress < 15) return '🌱';
  if (progress < 45) return '🌿';
  if (progress < 75) return '🍀';
  const emojis = { oak: '🌳', sakura: '🌸', maple: '🍁', pine: '🌲', palm: '🌴' };
  return emojis[seed] || '🌳';
}

function renderRoom() {
  const room = document.getElementById('studypool-room');
  if (!room) return;
  room.innerHTML = '';

  let displayBuddies = [...activeBuddies];
  
  if (isJoined) {
    // Add Bots to the visual pool if joined
    displayBuddies = [...displayBuddies, ...BOTS];
  }

  if (activeRoom === 'private') {
    // Filter to only friends (exclude bots from private room as requested)
    displayBuddies = displayBuddies.filter(b => !b.isBot && b.email && friendsList.includes(b.email.toLowerCase()));
  } else {
    // Global room: Pin friends to the top by sorting
    displayBuddies.sort((a, b) => {
      const aFriend = a.email && friendsList.includes(a.email.toLowerCase()) ? 1 : 0;
      const bFriend = b.email && friendsList.includes(b.email.toLowerCase()) ? 1 : 0;
      return bFriend - aFriend; // Friends first
    });
  }

  if (displayBuddies.length === 0 && !isJoined) {
    room.innerHTML = `<div class="helper-text" style="color: var(--text-secondary); font-size: 13px;">Room is currently empty. Click Join Room to start studying!</div>`;
    return;
  }

  // Draw user's card if joined
  if (isJoined) {
    const profile = getStorageItem('user_profile', { name: 'You', avatar: '🦁' });
    const userSeed = getStorageItem('forest_selected_seed', 'oak');
    let userProgress = 20;
    let userStatus = "Studying";
    
    const pomoTimerActive = document.getElementById('pomo-start-btn')?.textContent === 'Pause';
    if (pomoTimerActive) {
      userStatus = "Focusing ⏱️";
      const timerText = document.getElementById('pomo-display')?.textContent || "25:00";
      const parts = timerText.split(':').map(Number);
      if (parts.length === 2) {
        const remainingSecs = parts[0] * 60 + parts[1];
        userProgress = Math.min(100, Math.max(0, Math.round(((1500 - remainingSecs) / 1500) * 100)));
      }
    }

    const userPlantEmoji = getGrowingPlantEmoji(userSeed, userProgress);
    const userCard = document.createElement('div');
    userCard.className = 'studypool-member-card glassmorphic-card';
    userCard.style.cssText = 'width: 130px; height: 160px; padding: 16px; display: flex; flex-direction: column; align-items: center; justify-content: space-between; border-radius: var(--radius-lg); background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); position: relative; transition: transform 0.2s ease; box-shadow: 0 8px 32px rgba(0,0,0,0.1);';
    
    let aura = '';
    if (userStatus.includes('Focusing')) {
      aura = `<div style="position:absolute; top:0; left:0; width:100%; height:100%; border-radius:var(--radius-lg); box-shadow: inset 0 0 20px rgba(194, 168, 120, 0.15); pointer-events:none;"></div>`;
    }
    
    userCard.innerHTML = `
      ${aura}
      <div class="studypool-member-avatar" style="font-size: 36px; filter: drop-shadow(0 4px 12px rgba(255,255,255,0.1)); animation: floatFlame 3s ease-in-out infinite alternate;">${userPlantEmoji}</div>
      <div style="text-align: center; width: 100%;">
        <div class="studypool-member-name" style="font-size: 13px; font-weight: 700; color: #fff; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${profile.name} (You)</div>
        <div class="studypool-member-status" style="font-size: 10px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; display:flex; justify-content:space-between;">
          <span>${userStatus.includes('Focusing') ? 'Focusing' : userStatus}</span>
          <span style="font-weight:800; color:var(--accent);">${userProgress}%</span>
        </div>
        <div style="width:100%; height:4px; background:rgba(0,0,0,0.3); border-radius:2px; margin-top:8px; overflow:hidden; border: 1px solid rgba(255,255,255,0.05);">
          <div style="width:${userProgress}%; height:100%; background:linear-gradient(90deg, #7c9b7a, var(--accent)); border-radius:2px;"></div>
        </div>
      </div>
    `;
    room.appendChild(userCard);
  }

  // Draw buddies (Live Users + Bots)
  displayBuddies.forEach(buddy => {
    const card = document.createElement('div');
    card.className = 'studypool-member-card glassmorphic-card';
    card.style.cssText = 'width: 130px; height: 160px; padding: 16px; display: flex; flex-direction: column; align-items: center; justify-content: space-between; border-radius: var(--radius-lg); background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); position: relative; transition: transform 0.2s ease; cursor: pointer; box-shadow: 0 8px 32px rgba(0,0,0,0.1);';
    
    card.onmouseover = () => card.style.transform = 'translateY(-4px)';
    card.onmouseout = () => card.style.transform = 'translateY(0)';
    card.onclick = () => {
      allMessages.push({ isSystem: true, text: `You cheered for ${buddy.name.split(' ')[0]}! ✨` });
      renderChat();
    };

    const isFriend = buddy.email && friendsList.includes(buddy.email.toLowerCase());
    const friendBadge = isFriend ? `<div style="position:absolute; top: -8px; right: -8px; background: #4B6BFB; color: #fff; font-size: 9px; font-weight: 800; padding: 4px 8px; border-radius: 10px; border: 2px solid #0F1115; z-index: 10; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">FRIEND</div>` : '';
    
    // No bot badge as requested
    const botBadge = '';

    const plantEmoji = getGrowingPlantEmoji(buddy.seed || 'oak', buddy.progress || 0);
    let aura = '';
    
    // Golden aura for focusing, Blue aura for friends
    if (buddy.status && buddy.status.includes('Focusing')) {
      aura = `<div style="position:absolute; top:0; left:0; width:100%; height:100%; border-radius:var(--radius-lg); box-shadow: inset 0 0 20px rgba(194, 168, 120, 0.15); pointer-events:none;"></div>`;
    } else if (isFriend) {
      aura = `<div style="position:absolute; top:0; left:0; width:100%; height:100%; border-radius:var(--radius-lg); box-shadow: inset 0 0 15px rgba(75, 107, 251, 0.1); pointer-events:none;"></div>`;
    }
    
    const cardBorder = isFriend ? `border: 1px solid rgba(75, 107, 251, 0.3) !important;` : ``;

    card.innerHTML = `
      ${aura}
      ${friendBadge}
      ${botBadge}
      <div class="studypool-member-avatar" style="font-size: 36px; filter: drop-shadow(0 4px 12px rgba(255,255,255,0.1)); animation: floatFlame 3s ease-in-out infinite alternate; animation-delay: ${Math.random()}s;">${plantEmoji}</div>
      <div style="text-align: center; width: 100%;">
        <div class="studypool-member-name" style="font-size: 13px; font-weight: 700; color: #fff; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${buddy.name}</div>
        <div class="studypool-member-status" style="font-size: 10px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; display:flex; justify-content:space-between;">
          <span>${buddy.status || 'Offline'}</span>
          <span style="font-weight:800; color:var(--accent);">${buddy.progress || 0}%</span>
        </div>
        <div style="width:100%; height:4px; background:rgba(0,0,0,0.3); border-radius:2px; margin-top:8px; overflow:hidden; border: 1px solid rgba(255,255,255,0.05);">
          <div style="width:${buddy.progress || 0}%; height:100%; background:linear-gradient(90deg, #7c9b7a, var(--accent)); border-radius:2px; transition: width 0.8s ease;"></div>
        </div>
      </div>
    `;
    if(isFriend) {
      card.style.cssText += cardBorder;
    }
    room.appendChild(card);
  });
  
  renderLeaderboard();
}

function renderLeaderboard() {
  const container = document.getElementById('studypool-leaderboard');
  if (!container) return;
  container.innerHTML = '';

  const list = [
    { rank: 1, name: 'You', score: '0h 0m' }
  ];
  
  activeBuddies.forEach((buddy) => {
     list.push({ rank: 2, name: buddy.name, score: '0h 0m' });
  });
  
  BOTS.forEach((bot) => {
     list.push({ rank: 3, name: bot.name, score: '0h 0m' });
  });

  const stats = getStorageItem('pomodoro_stats', { totalFocusedTime: 0 });
  const userHrs = Math.floor(stats.totalFocusedTime / 60);
  const userMins = stats.totalFocusedTime % 60;
  list[0].score = `${userHrs}h ${userMins}m`;

  list.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'leaderboard-row';
    row.innerHTML = `
      <span class="leaderboard-rank">#${index + 1}</span>
      <span class="leaderboard-name">${item.name}</span>
      <span class="leaderboard-score">${item.score}</span>
    `;
    container.appendChild(row);
  });
}
