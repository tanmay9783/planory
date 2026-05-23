import { Vibration } from 'react-native';

/**
 * Calculates level and XP progression.
 * Returns { level, xp, leveledUp }
 */
export const calculateXPProgress = (currentLevel, currentXP, amount) => {
  let xp = (currentXP || 0) + amount;
  let level = currentLevel || 1;
  let leveledUp = false;

  while (xp >= level * 100) {
    xp -= level * 100;
    level += 1;
    leveledUp = true;
  }

  return { level, xp, leveledUp };
};

/**
 * Maps levels to titles suitable for college/school students in India.
 */
export const getLevelTitle = (level) => {
  if (level >= 15) return 'Dean\'s List Legend';
  if (level >= 10) return 'Desk Master / Legend';
  if (level >= 8) return 'Semester Topper';
  if (level >= 5) return 'Daily Grinder';
  if (level >= 3) return 'Library Scholar';
  return 'Desk Fresher';
};

/**
 * Triggers standard student-centered achievements list.
 */
export const ACHIEVEMENTS = [
  { id: 'water_1', name: 'Hydration Hero', desc: 'Met your daily water target', category: 'hydration', target: 1 },
  { id: 'focus_1', name: 'Focus Beast', desc: 'Completed 5 Pomodoro study rounds', category: 'focus', target: 5 },
  { id: 'tasks_10', name: 'Syllabus Shredder', desc: 'Completed 10 tasks', category: 'tasks', target: 10 },
  { id: 'chai_10', name: 'Chai Addict', desc: 'Logged Cutting Chai 10 times', category: 'chai', target: 10 },
  { id: 'streak_7', name: 'Weekly Warrior', desc: 'Maintained a 7-day habits streak', category: 'streak', target: 7 }
];
