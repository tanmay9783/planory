# ✨ Planory

Planory is an ultra-premium, gamified, multi-platform personal planning, productivity, and real-time study ecosystem. Combining a gorgeous desktop web workspace, a highly responsive React Native mobile companion app, and a secure Groq-powered vision server, Planory is engineered to transform mundane habits and study sessions into an engaging, gamified RPG-style journey.

---

## 🌌 Ecosystem Overview

Planory is architected as three seamless, interconnected workspaces:

1. **Planory Web Workspace (Vite + Modular ES6 + Firebase + Dexie)**  
   A beautiful, high-fidelity desktop workspace featuring premium HSL-tailored glassmorphism, fluid interactive micro-animations, time-of-day dynamic lighting, offline-first IndexedDB caching (via Dexie), and live synchronized study rooms.
   
2. **Planory Mobile Companion (React Native + Expo)**  
   A gorgeous native mobile experience featuring smooth swipe-gesture navigation, trophy level-up sparkle animations, full push notification setups, local AsyncStorage, custom interactive home-screen widgets (WidgetKit & AppWidgetProvider ready), and a scanner tool.

3. **Planory OCR Proxy Server (Node.js + Groq Vision)**  
   A lightweight, secure proxy server that protects your API credentials. It forwards vision payloads from the mobile companion app to the Groq Vision API to scan physical documents/notebooks and instantly convert them to digital markdown notes.

---

## 🚀 Key Modules & Feature Highlights

### 👥 1. Real-Time Social Studypool & Friends System
Planory features a synchronized virtual study lounge powered by Firebase Firestore, complete with live user presences:
* **Global Study Room:** A live focus lounge showing all active online students alongside custom ambient study bots (**Aarav, Riya, Kabir**) that simulate real-time focus rounds and send motivational messages. Your friends are dynamically pinned to the top of the grid with a gorgeous blue glowing aura and active presence tags.
* **Private Study Room:** A locked, zero-distraction study room. This room strictly excludes bots and strangers—only you and your verified added friends can enter, chat, and keep each other accountable.
* **Synchronous Real-Time Chat:** Exchange thoughts, coordinate study breaks, and share focus goals in an active chat room.
* **Live Friend Verification & Add System:** Enter a friend's email to add them instantly. The application queries a secure Firebase `users_directory` collections. If the user is found, they are added to your contact list in real time. If they are not registered, the system returns a polite, descriptive `"User not registered"` error message.

### 🏆 2. RPG-style Gamification & Week-in-Review
Your productivity directly fuels your character status:
* **XP & Leveling System:** Earn XP by completing tasks, drinking water, logging budgets, or finishing Pomodoro focus blocks. 
* **Trophy Reveals:** When leveling up, the application triggers a high-fidelity visual modal with native vibrations and circular, physics-based golden sparkle bursts.
* **The Coin Shop:** Spend your earned productivity coins to unlock custom high-end themes, aesthetic widgets, and profile badges.
* **The Week in Review:** A premium dashboard that pulls your statistical data to give you detailed analytics on hydration habits, focus session frequencies, tasks accomplished, and habit consistency over the past 7 days.

### ⏱️ 3. Advanced Pomodoro Focus Timer
A distraction-free focus workspace designed to induce deep flow states:
* **High-Fidelity Visuals:** Features a gorgeous, canvas-drawn circular progress ring with smooth transitions and timer countdowns.
* **Custom Ambient Soundscapes:** Integrate high-quality background audio tracks directly into your session, including *Library Whispers*, *Rhythmic Rain*, *Study Cafe Ambience*, and *Deep White Noise*.
* **Task Association:** Attach specific tasks directly to active Pomodoro sessions so your focus is highly targeted.

### 💧 4. Animated Hydration Tracker
A beautiful visual logger that elevates water tracking into an interactive delight:
* **Wave Physics Animation:** A custom CSS/JS water glass that dynamically fills up when you log drinks (e.g. `+250ml`), with a flowing liquid wave effect that scales based on your intake level.
* **Daily Hydro Goal:** Tracks your intake progress against personalized daily targets and awards bonus XP once met.

### 🪙 5. Student Budget Tracker
Take complete control of student finances with a gamified logging engine:
* **Smart Category Auto-Matching:** Instantly logs expenses and auto-categorizes them based on your input description (e.g., typing *"Samosa & Chai"* automatically registers under **Food**; *"Metro"* or *"Auto"* registers under **Transport**; *"Xerox"* or *"Print"* registers under **Books**).
* **Budget Metrics:** Enter a daily pocket money limit and visualize your spend distributions across custom pie layouts.
* **Financial Discipline Rewards:** Earn `+5 XP` for each expense logged, incentivizing structured money management.

### 📝 6. Brain Dump & Subject Notes (with Mobile Groq OCR)
Capture ideas and digitized lectures immediately:
* **Lecture Notes Library:** Catalog digital notes organized by subject tags, with high-performance search and detailed date-wise sorting.
* **Physical Document digitizer (Groq Vision OCR):** Snapshot handwritten formulas, notebook pages, or whiteboard slides using the mobile app. The payload is piped securely to our Groq Vision proxy, which outputs beautiful, structural Markdown ready to copy directly into your web workspace.

### 🗓️ 7. Dynamic Calendars & Alarm Missions
Never lose track of academic deadlines:
* **Time-Blocking Month View:** A clean calendar grid to schedule study blocks, assignments, exams, and habits.
* **Daily Alarms & Active Missions:** Gamified wake-up routines on the mobile companion requiring active engagement to dismiss, preparing you mentally for the study day.

### 🎨 8. Premium UI/UX & Focus Enhancements
* **Time-Of-Day Auto Themes:** Background lighting gradients adapt dynamically based on your system clock, changing seamlessly from **Morning**, **Day**, **Evening**, to **Night**.
* **Zen Mode:** Instantly collapses headers, sidebars, and chat boxes to hide everything except your active timer or notes editor, ensuring absolute focus.
* **Command Palette (`Ctrl + K`):** A high-performance keyboard shortcut hub. Summon the search menu to search notes, swap active workspaces, toggle Zen mode, or activate dark mode instantly.
* **Voice Focus Controls:** Activate focus sessions or toggle UI controls hands-free using speech synthesis and recognition.

---

## 🛠️ Tech Stack

### Web Workspace
* **Core:** Raw Vanilla JS (ES6 Modules), HTML5 Semantic markup.
* **Styling:** Premium custom CSS (Glassmorphism, CSS Custom Properties, smooth transitions).
* **Realtime Sync:** Firebase Firestore & Firebase Auth.
* **Offline Database Cache:** Dexie.js (IndexedDB wrapper) for zero-latency initial loads.
* **Build System:** Vite.

### Mobile Companion
* **Core:** React Native (Expo SDK 54).
* **Fonts:** Plus Jakarta Sans (Google Fonts API).
* **Media & Audio:** Expo Audio/AV for focus soundscapes.
* **Storage:** AsyncStorage.
* **Navigation:** React Navigation (Native Stack + Bottom Tab) with custom gesture-swipe navigation.

### OCR Proxy Server
* **Environment:** Node.js, Express.
* **LLM Engine:** Groq API (`llama-3.2-11b-vision-preview`).

---

## ⚡ Setup & Local Development

### Prerequisites
Make sure you have [Node.js](https://nodejs.org) and [Git](https://git-scm.com) installed.

### 1. Repository Setup
Clone this repository and navigate into it:
```bash
git clone https://github.com/tanmay9783/planory.git
cd planory
```

### 2. Run the Web App
1. Install dependencies at the project root:
   ```bash
   npm install
   ```
2. Launch the Vite local dev server:
   ```bash
   npm run dev
   ```
3. Open your browser and navigate to `http://localhost:5173`.

### 3. Run the Mobile App (Expo)
1. Navigate into the mobile directory:
   ```bash
   cd mobile
   ```
2. Install mobile dependencies:
   ```bash
   npm install
   ```
3. Start the Expo bundler:
   ```bash
   npx expo start
   ```
4. Scan the QR code using the Expo Go app on your phone (Android) or your Camera app (iOS) to launch.

### 4. Run the OCR Proxy Server
1. Navigate into the server directory:
   ```bash
   cd server
   ```
2. Install server dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` into a new `.env` file and insert your Groq API key:
   ```bash
   cp .env.example .env
   # Edit .env and set GROQ_API_KEY = your_gsk_key
   ```
4. Launch the local proxy server:
   ```bash
   node proxy.js
   ```
5. Set `CLOUD_PROXY_URL` in `mobile/src/config/api.js` to point to `http://localhost:3001` (or `http://10.0.2.2:3001` in the Android Emulator).

---

## 🌐 Production Deployment

### Web Deployment
The Planory Web client is configured out-of-the-box for high-performance hosting on platforms like **Render**, **Vercel**, or **Netlify**.
* Build command: `npm run build`
* Publish directory: `dist`

### OCR Server Deployment (Railway / Render)
1. Create a new service on **Railway** connected to your repository.
2. Under settings, configure the root directory to `server`.
3. Add the **Environment Variable** `GROQ_API_KEY` with your actual key.
4. Copy the public domain URL generated by Railway and update the API client config in `mobile/src/config/api.js`.

---

## 🔒 Security & Best Practices
* **Secret Isolation:** The Groq API key lives strictly on the server backend. Payloads are proxied safely, ensuring no keys are decompiled or exposed on mobile client builds.
* **Offline Resiliency:** Planory utilizes Dexie DB caching on the web client. If a Firestore connection drops, local actions are cached safely and loaded instantaneously.

Let's crush some study hours! 🚀
