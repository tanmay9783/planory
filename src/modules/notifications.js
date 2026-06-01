import { getStorageItem } from '../utils/storage.js';
import { formatDate } from '../utils/date.js';

let notificationTimer = null;
const notifiedTasks = new Set(JSON.parse(sessionStorage.getItem('planory_notified_tasks') || '[]'));

export function initNotifications() {
  // Request desktop notification permission on init if not denied
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  // Run initial check and set up interval (every 30 seconds)
  checkAllNotifications();
  clearInterval(notificationTimer);
  notificationTimer = setInterval(checkAllNotifications, 30000);
}

export function showSystemNotification(title, body) {
  // 1. Show browser notification if permitted
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.svg' });
  }

  // 2. Show in-app toast
  const toast = document.getElementById('notif-toast');
  const msgEl = document.getElementById('notif-msg');
  if (toast && msgEl) {
    msgEl.innerHTML = `<strong>${title}</strong><br>${body}`;
    toast.classList.remove('hidden');
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => {
      toast.classList.add('hidden');
    }, 5000);
  }
}

function checkAllNotifications() {
  const enabled = getStorageItem('planory_notifications_enabled', {
    water: true,
    deadline: true,
    habit: true
  });

  if (enabled.deadline !== false) {
    checkDeadlines();
  }

  if (enabled.habit !== false) {
    checkHabits();
  }
}

function checkDeadlines() {
  const tasks = getStorageItem('tasks', []);
  const todayStr = formatDate(new Date());
  const now = new Date();

  // Filter tasks for today, not completed, having a startTime
  const pendingTasks = tasks.filter(t => t.date === todayStr && !t.completed && t.startTime);

  pendingTasks.forEach(task => {
    if (notifiedTasks.has(task.id)) return;

    const [hours, minutes] = task.startTime.split(':').map(Number);
    const taskTime = new Date(now);
    taskTime.setHours(hours, minutes, 0, 0);

    const diffMs = taskTime - now;
    const diffMins = diffMs / (1000 * 60);

    // If task is due within the next 2 hours (120 minutes) and not in the past
    if (diffMins > 0 && diffMins <= 120) {
      notifiedTasks.add(task.id);
      sessionStorage.setItem('planory_notified_tasks', JSON.stringify([...notifiedTasks]));
      
      const dueText = diffMins < 60 
        ? `${Math.round(diffMins)} minutes` 
        : `${Math.round(diffMins / 60)} hours`;
      
      showSystemNotification(
        "Deadline Warning ⏰",
        `Task "${task.title}" is due in ${dueText}!`
      );
    }
  });
}

function checkHabits() {
  const habits = getStorageItem('user_habits', []);
  const logs = getStorageItem('habit_logs', {});
  const todayStr = formatDate(new Date());
  const now = new Date();

  // Only nudge in the evening (after 6 PM / 18:00)
  if (now.getHours() < 18) return;

  // Check if we already nudged today
  const lastNudgeDate = sessionStorage.getItem('planory_last_habit_nudge_date');
  if (lastNudgeDate === todayStr) return;

  // Find uncompleted habits
  const uncompleted = habits.filter(h => !logs[h.id] || !logs[h.id].includes(todayStr));

  if (uncompleted.length > 0) {
    // Nudge about the first uncompleted habit
    const habit = uncompleted[0];
    sessionStorage.setItem('planory_last_habit_nudge_date', todayStr);
    showSystemNotification(
      "Habit Nudge ⚡",
      `Don't forget your habit "${habit.name}" tonight!`
    );
  }
}
