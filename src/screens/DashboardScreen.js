import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  SafeAreaView, 
  TextInput, 
  Modal, 
  Platform, 
  StatusBar, 
  Animated, 
  Vibration,
  Share
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useFirestoreData } from '../hooks/useFirestoreData';
import WorkspaceHubModal from '../components/WorkspaceHubModal';
import ConfettiBurst from '../components/ConfettiBurst';
import { auth } from '../firebase';
import { calculateXPProgress, getLevelTitle } from '../utils/gamification';

export default function DashboardScreen() {
  const navigation = useNavigation();
  const userId = auth.currentUser ? auth.currentUser.uid : 'guest';
  const emailPrefix = auth.currentUser?.email ? auth.currentUser.email.split('@')[0] : 'Student';

  // Core Firestore States
  const [profile, setProfile] = useFirestoreData(`${userId}_user_profile`, { name: emailPrefix, bio: 'Builder', avatar: null });
  const [gamification, setGamification] = useFirestoreData(`${userId}_gamification_state`, { level: 1, xp: 0 });
  const [tasks, setTasks] = useFirestoreData(`${userId}_tasks`, []);
  const [hydration, setHydration] = useFirestoreData(`${userId}_hydration`, { water: 0, target: 8 });
  const [pomodoroStats] = useFirestoreData(`${userId}_pomodoro_stats`, { roundsToday: 0, date: new Date().toISOString().split('T')[0] });
  
  // Gamification additions
  const [loginReward, setLoginReward] = useFirestoreData(`${userId}_login_rewards`, { lastClaimed: '', streak: 0 });
  const [dailyQuestStatus, setDailyQuestStatus] = useFirestoreData(`${userId}_daily_quest_status`, { date: '', claimed: false });
  const [streaks, setStreaks] = useFirestoreData(`${userId}_streaks`, {
    tasks: 0,
    focus: 0,
    hydration: 0,
    habits: 0,
    budget: 0,
    lastUpdated: { tasks: '', focus: '', hydration: '', habits: '', budget: '' },
    shields: 1
  });

  // UI Modal / View states
  const [showHub, setShowHub] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showStreakModal, setShowStreakModal] = useState(false);
  const [loginRewardXp, setLoginRewardXp] = useState(0);
  const [calendarView, setCalendarView] = useState('weekly'); // weekly or monthly
  const [newTaskText, setNewTaskText] = useState('');

  // Custom Grid Calendar Navigation States
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null);
  const [modalNewTaskText, setModalNewTaskText] = useState('');

  // Dashboard entrance animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(25)).current;
  const confettiRef = useRef(null);

  const todayStr = new Date().toISOString().split('T')[0];
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Daily Login Reward Check
  useEffect(() => {
    if (!loginReward || loginReward.lastClaimed === todayStr) return;

    let newStreak = 1;
    if (loginReward.lastClaimed === yesterdayStr) {
      newStreak = (loginReward.streak || 0) + 1;
    }
    if (newStreak > 7) newStreak = 1;

    const rewards = [5, 10, 15, 20, 25, 30, 50];
    const xpReward = rewards[newStreak - 1] || 5;

    setLoginRewardXp(xpReward);
    setShowLoginModal(true);

    const progress = calculateXPProgress(gamification.level, gamification.xp, xpReward);
    setGamification({ level: progress.level, xp: progress.xp });

    setLoginReward({
      lastClaimed: todayStr,
      streak: newStreak
    });
  }, [loginReward]);

  // Streak Tracker Sync on mount/data update
  useEffect(() => {
    if (!streaks || !streaks.lastUpdated) return;

    let streaksChanged = false;
    const newStreaks = { ...streaks };

    const checkStreak = (category, currentActivityMet) => {
      const lastUp = newStreaks.lastUpdated[category] || '';
      if (lastUp === todayStr) return;

      if (currentActivityMet) {
        newStreaks[category] = (newStreaks[category] || 0) + 1;
        newStreaks.lastUpdated[category] = todayStr;
        streaksChanged = true;
      } else if (lastUp !== yesterdayStr && lastUp !== '') {
        // Streak is broken
        if (newStreaks[category] > 0) {
          if (newStreaks.shields > 0) {
            newStreaks.shields -= 1;
            newStreaks.lastUpdated[category] = yesterdayStr; // backdate
            streaksChanged = true;
            Vibration.vibrate([0, 80, 50, 80]);
            Alert.alert(
              'Streak Protected',
              `Your daily ${category} streak was saved from breaking by a Streak Shield!`
            );
          } else {
            newStreaks[`prev_${category}`] = newStreaks[category];
            newStreaks[category] = 0;
            streaksChanged = true;
          }
        }
      }
    };

    const taskGoalMet = tasks.filter(t => t.date === todayStr && t.completed).length >= 3;
    const focusGoalMet = pomodoroStats.roundsToday >= 2;
    const waterGoalMet = hydration.water >= (hydration.target < 50 ? 6 : 1500);

    checkStreak('tasks', taskGoalMet);
    checkStreak('focus', focusGoalMet);
    checkStreak('hydration', waterGoalMet);

    if (streaksChanged) {
      setStreaks(newStreaks);
    }
  }, [tasks, pomodoroStats, hydration]);

  // Daily Quest calculations
  const todayTasks = tasks.filter(t => t.date === todayStr);
  const completedTodayTasks = todayTasks.filter(t => t.completed).length;

  const questWaterGoal = hydration.target < 50 ? 6 : 1500;
  const currentWaterAmount = hydration.target < 50 ? hydration.water : (hydration.water < 50 ? hydration.water * 250 : hydration.water);

  const questWaterMet = currentWaterAmount >= questWaterGoal;
  const questFocusMet = pomodoroStats.roundsToday >= 2;
  const questTasksMet = completedTodayTasks >= 3;

  const allQuestsCompleted = questWaterMet && questFocusMet && questTasksMet;

  // Claim Daily Quest complete reward
  useEffect(() => {
    if (allQuestsCompleted && dailyQuestStatus.date !== todayStr) {
      const progress = calculateXPProgress(gamification.level, gamification.xp, 30);
      setGamification({ level: progress.level, xp: progress.xp });
      setDailyQuestStatus({ date: todayStr, claimed: true });

      setTimeout(() => {
        if (confettiRef.current) confettiRef.current.startBurst();
      }, 300);

      Vibration.vibrate([0, 100, 50, 100]);
      Alert.alert(
        'Daily Quests Complete!',
        'Fantastic! You completed all daily study challenges. Awarded +30 XP!'
      );
    }
  }, [allQuestsCompleted, dailyQuestStatus]);

  const xpProgress = Math.min((gamification.xp / (gamification.level * 100)) * 100, 100);

  // Calculate daily score grade
  let dailyGrade = '—';
  let focusStatus = 'Incomplete';
  let statusDesc = 'No tasks completed. Add study targets below to begin your focus sprint!';
  let statusColor = '#8B92A0';
  let statusIcon = 'ellipse-outline';

  if (todayTasks.length > 0) {
    const ratio = completedTodayTasks / todayTasks.length;
    if (ratio === 1) {
      dailyGrade = 'A+';
      focusStatus = 'Perfect Day';
      statusDesc = 'Stellar performance! You achieved 100% of today\'s study targets.';
      statusColor = '#7C9B7A';
      statusIcon = 'checkmark-done-circle';
    } else if (ratio >= 0.7) {
      dailyGrade = 'A';
      focusStatus = 'High Focus';
      statusDesc = 'Great job! You finished almost all scheduled tasks today.';
      statusColor = '#7C9B7A';
      statusIcon = 'checkmark-circle-outline';
    } else if (ratio >= 0.4) {
      dailyGrade = 'B';
      focusStatus = 'Steady Progress';
      statusDesc = 'Good job! You are halfway through. Complete one more target!';
      statusColor = '#C2A878';
      statusIcon = 'trending-up';
    } else {
      dailyGrade = 'C';
      focusStatus = 'Low Focus';
      statusDesc = 'Build momentum. Ticking just one task kickstarts your study streak.';
      statusColor = '#C47070';
      statusIcon = 'alert-circle-outline';
    }
  }

  const plantProgress = todayTasks.length > 0 ? (completedTodayTasks / todayTasks.length) * 100 : 0;

  const handleAddTask = () => {
    if (!newTaskText.trim()) return;
    const newTask = {
      id: Date.now().toString(),
      title: newTaskText.trim(),
      completed: false,
      date: todayStr
    };
    setTasks([...tasks, newTask]);
    setNewTaskText('');
  };

  const handleAddModalTask = () => {
    if (!modalNewTaskText.trim() || !selectedCalendarDate) return;
    const newTask = {
      id: Date.now().toString(),
      title: modalNewTaskText.trim(),
      completed: false,
      date: selectedCalendarDate
    };
    setTasks([...tasks, newTask]);
    setModalNewTaskText('');
  };

  const toggleTask = (taskId) => {
    let completedState = false;
    const updated = tasks.map(t => {
      if (t.id === taskId) {
        completedState = !t.completed;
        return { ...t, completed: completedState };
      }
      return t;
    });
    setTasks(updated);

    if (completedState) {
      Vibration.vibrate(40);
      const progress = calculateXPProgress(gamification.level, gamification.xp, 10);
      setGamification({ level: progress.level, xp: progress.xp });

      // Trigger small confetti burst on individual task completion if it's the last one
      const remainingCount = updated.filter(t => t.date === todayStr && !t.completed).length;
      if (remainingCount === 0 && updated.filter(t => t.date === todayStr).length > 0) {
        setTimeout(() => {
          if (confettiRef.current) confettiRef.current.startBurst();
        }, 100);
      }
    }
  };

  const deleteTask = (taskId) => {
    setTasks(tasks.filter(t => t.id !== taskId));
  };

  // Shield & Revival Actions
  const handleBuyShield = () => {
    if (gamification.xp < 30 && gamification.level === 1) {
      Alert.alert('Insufficient XP', 'You need at least 30 XP to buy a Streak Shield.');
      return;
    }
    
    let newXp = gamification.xp - 30;
    let newLvl = gamification.level;
    if (newXp < 0) {
      if (newLvl > 1) {
        newLvl -= 1;
        newXp += newLvl * 100;
      } else {
        newXp = 0;
      }
    }
    
    setGamification({ level: newLvl, xp: newXp });
    setStreaks({
      ...streaks,
      shields: (streaks.shields || 0) + 1
    });
    Alert.alert('Purchased', 'Streak Shield added to inventory.');
  };

  const handleReviveStreak = (category) => {
    const prevVal = streaks[`prev_${category}`] || 0;
    if (prevVal === 0) {
      Alert.alert('Nothing to Revive', 'No previous streak value found.');
      return;
    }
    if (gamification.xp < 50 && gamification.level === 1) {
      Alert.alert('Insufficient XP', 'Streak revival requires 50 XP.');
      return;
    }

    let newXp = gamification.xp - 50;
    let newLvl = gamification.level;
    if (newXp < 0) {
      if (newLvl > 1) {
        newLvl -= 1;
        newXp += newLvl * 100;
      } else {
        newXp = 0;
      }
    }

    setGamification({ level: newLvl, xp: newXp });

    const newStreaks = { ...streaks };
    newStreaks[category] = prevVal;
    newStreaks[`prev_${category}`] = 0; // consumed
    newStreaks.lastUpdated[category] = todayStr;
    setStreaks(newStreaks);

    Vibration.vibrate(60);
    Alert.alert('Streak Restored', `${category} streak is back at ${prevVal} days!`);
  };

  // Calendar Grid builder
  const generateMonthDays = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const totalDays = lastDay.getDate();
    const startDayIndex = firstDay.getDay();

    const cells = [];
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayIndex - 1; i >= 0; i--) {
      cells.push({ date: new Date(year, month - 1, prevMonthLastDay - i), isCurrentMonth: false });
    }
    for (let i = 1; i <= totalDays; i++) {
      cells.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }
    const remaining = 42 - cells.length;
    for (let i = 1; i <= remaining; i++) {
      cells.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }
    return cells;
  };

  const handlePrevMonth = () => {
    setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1));
  };

  const selectedDateTasks = selectedCalendarDate 
    ? tasks.filter(t => t.date === selectedCalendarDate)
    : [];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F1115" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setShowHub(true)} style={styles.hamburger}>
          <Ionicons name="menu" size={28} color="#F3F1EC" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Planory Desk</Text>
        <TouchableOpacity onPress={() => setShowStreakModal(true)} style={styles.headerStreak}>
          <Ionicons name="flame" size={20} color="#C2A878" />
          <Text style={styles.headerStreakText}>{(streaks.tasks || 0) + (streaks.focus || 0)}</Text>
        </TouchableOpacity>
      </View>

      <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 80 }}>
          
          {/* Profile Card */}
          <TouchableOpacity 
            style={styles.profileCard} 
            onPress={() => navigation.navigate('ProfileWorkspace')}
            activeOpacity={0.9}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
              <View style={styles.avatarCircle}>
                <Ionicons name="person" size={24} color="#C2A878" />
              </View>
              <View style={{ marginLeft: 16, flex: 1 }}>
                <Text style={styles.name}>{profile.name}</Text>
                <Text style={styles.bio} numberOfLines={1}>{profile.bio || 'Desk Builder'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#5A6070" style={{ marginLeft: 8 }} />
            </View>
            <View style={{ marginTop: 24 }}>
              <View style={styles.levelHeader}>
                <Text style={styles.levelText}>{getLevelTitle(gamification.level)} (LVL {gamification.level})</Text>
                <Text style={styles.xpText}>{gamification.xp} / {gamification.level * 100} XP</Text>
              </View>
              <View style={styles.progressBg}>
                <View style={[styles.progressFill, { width: `${xpProgress}%` }]} />
              </View>
            </View>
          </TouchableOpacity>

          {/* Daily Quests Dashboard */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>DAILY QUESTS (XP MULTIPLIER)</Text>
            <View style={styles.questsCard}>
              <View style={styles.questRow}>
                <Ionicons 
                  name={questWaterMet ? "checkmark-circle" : "ellipse-outline"} 
                  size={20} 
                  color={questWaterMet ? "#7C9B7A" : "#5A6070"} 
                  style={{ marginRight: 12 }}
                />
                <Text style={[styles.questText, questWaterMet && styles.questTextCompleted]}>
                  Log 1.5L Hydration ({currentWaterAmount}/{questWaterGoal} ml)
                </Text>
              </View>
              <View style={styles.questDivider} />
              <View style={styles.questRow}>
                <Ionicons 
                  name={questFocusMet ? "checkmark-circle" : "ellipse-outline"} 
                  size={20} 
                  color={questFocusMet ? "#7C9B7A" : "#5A6070"} 
                  style={{ marginRight: 12 }}
                />
                <Text style={[styles.questText, questFocusMet && styles.questTextCompleted]}>
                  Complete 2 Pomodoro Rounds ({pomodoroStats.roundsToday}/2)
                </Text>
              </View>
              <View style={styles.questDivider} />
              <View style={styles.questRow}>
                <Ionicons 
                  name={questTasksMet ? "checkmark-circle" : "ellipse-outline"} 
                  size={20} 
                  color={questTasksMet ? "#7C9B7A" : "#5A6070"} 
                  style={{ marginRight: 12 }}
                />
                <Text style={[styles.questText, questTasksMet && styles.questTextCompleted]}>
                  Complete 3 Scheduled Tasks ({completedTodayTasks}/3)
                </Text>
              </View>
            </View>
          </View>

          {/* Focus Performance Grade */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>TODAY'S PRODUCTIVITY</Text>
            <View style={styles.scoreCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={styles.gradeCircle}>
                    <Text style={styles.scoreGrade}>{dailyGrade}</Text>
                  </View>
                  <View style={{ marginLeft: 12 }}>
                    <Text style={styles.scoreTitle}>{focusStatus}</Text>
                    <Text style={styles.scoreSub}>{completedTodayTasks} / {todayTasks.length} Tasks completed</Text>
                  </View>
                </View>
                <Ionicons name={statusIcon} size={28} color={statusColor} />
              </View>
              <View style={styles.plantProgressBg}>
                <View style={[styles.plantProgressFill, { width: `${plantProgress}%` }]} />
              </View>
              <Text style={styles.scoreDesc}>{statusDesc}</Text>
            </View>
          </View>

          {/* Calendar Views */}
          <View style={styles.section}>
            <View style={styles.calendarToggle}>
              <TouchableOpacity style={[styles.toggleBtn, calendarView === 'weekly' && styles.toggleBtnActive]} onPress={() => setCalendarView('weekly')}>
                <Text style={[styles.toggleBtnText, calendarView === 'weekly' && styles.toggleBtnTextActive]}>Weekly</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.toggleBtn, calendarView === 'monthly' && styles.toggleBtnActive]} onPress={() => setCalendarView('monthly')}>
                <Text style={[styles.toggleBtnText, calendarView === 'monthly' && styles.toggleBtnTextActive]}>Monthly Grid</Text>
              </TouchableOpacity>
            </View>

            {calendarView === 'monthly' && (
              <View style={styles.customCalendarContainer}>
                <View style={styles.calendarHeader}>
                  <TouchableOpacity onPress={handlePrevMonth}>
                    <Ionicons name="chevron-back" size={20} color="#C2A878" />
                  </TouchableOpacity>
                  <Text style={styles.calendarHeaderTitle}>
                    {currentMonthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </Text>
                  <TouchableOpacity onPress={handleNextMonth}>
                    <Ionicons name="chevron-forward" size={20} color="#C2A878" />
                  </TouchableOpacity>
                </View>

                <View style={styles.dayNamesRow}>
                  {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(day => (
                    <Text key={day} style={styles.dayNameCell}>{day}</Text>
                  ))}
                </View>

                <View style={styles.gridContainer}>
                  {generateMonthDays(currentMonthDate).map((cell, index) => {
                    const cellDateStr = cell.date.toISOString().split('T')[0];
                    const cellTasks = tasks.filter(t => t.date === cellDateStr);
                    const isToday = cellDateStr === todayStr;
                    const isSelected = selectedCalendarDate === cellDateStr;
                    
                    const completedCount = cellTasks.filter(t => t.completed).length;
                    const pendingCount = cellTasks.length - completedCount;
                    
                    return (
                      <TouchableOpacity 
                        key={index} 
                        style={[
                          styles.gridCell, 
                          !cell.isCurrentMonth && styles.gridCellMuted,
                          isToday && styles.gridCellToday,
                          isSelected && styles.gridCellSelected
                        ]}
                        onPress={() => setSelectedCalendarDate(cellDateStr)}
                      >
                        <Text style={[
                          styles.cellDayText, 
                          !cell.isCurrentMonth && styles.cellDayTextMuted,
                          isToday && { color: '#C2A878' }
                        ]}>
                          {cell.date.getDate()}
                        </Text>
                        {cellTasks.length > 0 && (
                          <View style={styles.dotsRow}>
                            {Array.from({ length: Math.min(completedCount, 3) }).map((_, i) => (
                              <View key={`c-${i}`} style={[styles.dot, styles.dotCompleted]} />
                            ))}
                            {Array.from({ length: Math.min(pendingCount, 3) }).map((_, i) => (
                              <View key={`p-${i}`} style={[styles.dot, styles.dotPending]} />
                            ))}
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </View>

          {/* Today's Tasks */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>TODAY'S TASKS</Text>
            <View style={{ marginTop: 12 }}>
              {todayTasks.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>Clear schedule. A calm mind starts here.</Text>
                </View>
              ) : (
                todayTasks.map(item => (
                  <TouchableOpacity 
                    key={item.id}
                    style={[styles.taskCard, item.completed && styles.taskCardCompleted]}
                    onPress={() => toggleTask(item.id)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.checkbox, item.completed && styles.checkboxChecked]} />
                    <Text style={[styles.taskTitle, item.completed && styles.taskTitleCompleted]}>
                      {item.title}
                    </Text>
                  </TouchableOpacity>
                ))
              )}

              {/* Inline Task Input Row */}
              <View style={styles.inlineInputRow}>
                <TextInput
                  style={styles.inlineTaskInput}
                  value={newTaskText}
                  onChangeText={setNewTaskText}
                  placeholder="Add a new task for today..."
                  placeholderTextColor="#5A6070"
                  onSubmitEditing={handleAddTask}
                />
                <TouchableOpacity style={styles.inlineAddBtn} onPress={handleAddTask}>
                  <Ionicons name="add" size={20} color="#0F1115" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

        </ScrollView>
      </Animated.View>

      {/* Daily Login Reward Modal */}
      <Modal
        visible={showLoginModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowLoginModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.loginModalContent}>
            <Ionicons name="gift" size={54} color="#C2A878" style={{ marginBottom: 12 }} />
            <Text style={styles.loginModalTitle}>Daily Login Reward!</Text>
            <Text style={styles.loginModalStreak}>Streak: Day {loginReward?.streak || 1}</Text>
            <Text style={styles.loginModalDesc}>Here is some fuel to unlock your study targets.</Text>
            
            <View style={styles.loginBonusBox}>
              <Text style={styles.loginBonusText}>+ {loginRewardXp} XP</Text>
            </View>

            <TouchableOpacity 
              style={styles.loginClaimBtn} 
              onPress={() => {
                setShowLoginModal(false);
                Vibration.vibrate(40);
                if (confettiRef.current) confettiRef.current.startBurst();
              }}
            >
              <Text style={styles.loginClaimBtnText}>Claim Points</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Streak Dashboard Modal */}
      <Modal
        visible={showStreakModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowStreakModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.loginModalContent, { width: '90%', padding: 24 }]}>
            <Text style={styles.loginModalTitle}>Streak Dashboard</Text>
            <Text style={[styles.loginModalDesc, { marginBottom: 20 }]}>Maintain study targets daily to build your streaks.</Text>
            
            {/* Streak Counters */}
            <View style={styles.streakGrid}>
              <View style={styles.streakPanelRow}>
                <Ionicons name="checkmark-done" size={20} color="#7C9B7A" />
                <Text style={styles.streakPanelLabel}>Tasks Completed Streak</Text>
                <Text style={styles.streakPanelVal}>{streaks.tasks || 0} days</Text>
                {(streaks.prev_tasks || 0) > 0 && (
                  <TouchableOpacity onPress={() => handleReviveStreak('tasks')} style={styles.reviveBtn}>
                    <Text style={styles.reviveBtnText}>Revive (50XP)</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.streakPanelRow}>
                <Ionicons name="timer" size={20} color="#C47070" />
                <Text style={styles.streakPanelLabel}>Pomodoro Focus Streak</Text>
                <Text style={styles.streakPanelVal}>{streaks.focus || 0} days</Text>
                {(streaks.prev_focus || 0) > 0 && (
                  <TouchableOpacity onPress={() => handleReviveStreak('focus')} style={styles.reviveBtn}>
                    <Text style={styles.reviveBtnText}>Revive (50XP)</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.streakPanelRow}>
                <Ionicons name="water" size={20} color="#7B93B0" />
                <Text style={styles.streakPanelLabel}>Water Logged Streak</Text>
                <Text style={styles.streakPanelVal}>{streaks.hydration || 0} days</Text>
                {(streaks.prev_hydration || 0) > 0 && (
                  <TouchableOpacity onPress={() => handleReviveStreak('hydration')} style={styles.reviveBtn}>
                    <Text style={styles.reviveBtnText}>Revive (50XP)</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Streak Shield Section */}
            <View style={styles.shieldCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="shield-checkmark" size={24} color="#C2A878" style={{ marginRight: 10 }} />
                  <View>
                    <Text style={styles.shieldTitle}>Streak Shield</Text>
                    <Text style={styles.shieldSubtitle}>Active: {streaks.shields || 0} available</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={handleBuyShield} style={styles.buyShieldBtn}>
                  <Text style={styles.buyShieldText}>Buy (30XP)</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={[styles.loginClaimBtn, { marginTop: 24 }]} onPress={() => setShowStreakModal(false)}>
              <Text style={styles.loginClaimBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Calendar Day Schedule Modal */}
      <Modal
        visible={selectedCalendarDate !== null}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setSelectedCalendarDate(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Daily Schedule</Text>
            <Text style={styles.modalSubtitle}>For: {selectedCalendarDate}</Text>
            
            <ScrollView style={styles.modalTasksScroll}>
              {selectedDateTasks.length === 0 ? (
                <Text style={styles.emptyModalTasks}>No tasks scheduled for this day.</Text>
              ) : (
                selectedDateTasks.map(t => (
                  <View key={t.id} style={styles.modalTaskRow}>
                    <TouchableOpacity style={styles.modalTaskLeft} onPress={() => toggleTask(t.id)}>
                      <View style={[styles.modalCheckbox, t.completed && styles.modalCheckboxChecked]} />
                      <Text style={[styles.modalTaskText, t.completed && styles.modalTaskTextCompleted]}>{t.title}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteTask(t.id)}>
                      <Ionicons name="trash-outline" size={16} color="#C47070" />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>

            <View style={styles.modalInputRow}>
              <TextInput
                style={styles.modalInput}
                placeholder="Schedule new task..."
                placeholderTextColor="#5A6070"
                value={modalNewTaskText}
                onChangeText={setModalNewTaskText}
                onSubmitEditing={handleAddModalTask}
              />
              <TouchableOpacity style={styles.modalAddBtn} onPress={handleAddModalTask}>
                <Ionicons name="add" size={20} color="#0F1115" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalActionBtn, { backgroundColor: '#171B22', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }]} 
                onPress={() => {
                  setSelectedCalendarDate(null);
                  setModalNewTaskText('');
                }}
              >
                <Text style={[styles.modalActionBtnText, { color: '#8B92A0' }]}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Hamburger Hub Overlay */}
      <WorkspaceHubModal visible={showHub} onClose={() => setShowHub(false)} />

      {/* Confetti simulator */}
      <ConfettiBurst ref={confettiRef} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#0F1115',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8 },
  hamburger: { padding: 4 },
  headerTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: '#F3F1EC' },
  headerStreak: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#171B22', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.03)' },
  headerStreakText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: '#C2A878', marginLeft: 6 },
  
  profileCard: { 
    backgroundColor: '#171B22', 
    borderRadius: 24, 
    padding: 24, 
    marginBottom: 24, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.03)',
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(194, 168, 120, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(194, 168, 120, 0.15)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  name: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20, color: '#F3F1EC' },
  bio: { fontFamily: 'PlusJakartaSans_500Medium', color: '#8B92A0', marginTop: 4, fontSize: 13 },
  levelHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  levelText: { fontFamily: 'PlusJakartaSans_700Bold', color: '#C2A878', fontSize: 11, letterSpacing: 0.5 },
  xpText: { fontFamily: 'PlusJakartaSans_600SemiBold', color: '#8B92A0', fontSize: 11 },
  progressBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#C2A878' },

  section: { marginBottom: 24 },
  sectionTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: '#5A6070', letterSpacing: 1, marginBottom: 12 },
  
  questsCard: {
    backgroundColor: '#171B22',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)'
  },
  questRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12
  },
  questText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: '#F3F1EC',
    flex: 1
  },
  questTextCompleted: {
    color: '#8B92A0',
    textDecorationLine: 'line-through'
  },
  questDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.03)'
  },

  scoreCard: { 
    backgroundColor: '#171B22', 
    borderRadius: 20, 
    padding: 20, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.03)',
  },
  scoreGrade: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20, color: '#C2A878' },
  gradeCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(194, 168, 120, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(194, 168, 120, 0.2)'
  },
  scoreTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: '#F3F1EC' },
  scoreSub: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: '#8B92A0', marginTop: 2 },
  plantProgressBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden', marginTop: 12 },
  plantProgressFill: { height: '100%', backgroundColor: '#7C9B7A', borderRadius: 3 },
  scoreDesc: { fontFamily: 'PlusJakartaSans_500Medium', color: '#8B92A0', fontSize: 13, lineHeight: 20, marginTop: 12 },

  calendarToggle: { flexDirection: 'row', backgroundColor: '#171B22', borderRadius: 12, padding: 4, marginBottom: 12 },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: '#1D2430' },
  toggleBtnText: { color: '#8B92A0', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13 },
  toggleBtnTextActive: { color: '#C2A878' },

  customCalendarContainer: {
    backgroundColor: '#171B22',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)'
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4
  },
  calendarHeaderTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#F3F1EC',
    fontSize: 15
  },
  dayNamesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    paddingBottom: 6
  },
  dayNameCell: {
    width: '13%',
    marginHorizontal: '0.64%',
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#5A6070',
    fontSize: 10
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    justifyContent: 'space-between'
  },
  gridCell: {
    width: '13%',
    height: 52,
    marginHorizontal: '0.64%',
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: '#0F1115',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent'
  },
  gridCellMuted: {
    opacity: 0.25
  },
  gridCellToday: {
    backgroundColor: 'rgba(194, 168, 120, 0.08)',
    borderColor: 'rgba(194, 168, 120, 0.2)'
  },
  gridCellSelected: {
    borderColor: '#C2A878',
    backgroundColor: '#171B22'
  },
  cellDayText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#F3F1EC',
    fontSize: 12
  },
  cellDayTextMuted: {
    color: '#5A6070'
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 4,
    justifyContent: 'center',
    alignItems: 'center'
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2
  },
  dotCompleted: {
    backgroundColor: '#7C9B7A'
  },
  dotPending: {
    backgroundColor: '#C2A878'
  },

  taskCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#171B22', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.03)' },
  taskCardCompleted: { opacity: 0.5 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)', marginRight: 12 },
  checkboxChecked: { backgroundColor: '#C2A878', borderColor: '#C2A878' },
  taskTitle: { fontFamily: 'PlusJakartaSans_500Medium', color: '#F3F1EC', fontSize: 15, flex: 1 },
  taskTitleCompleted: { textDecorationLine: 'line-through', color: '#8B92A0' },
  emptyState: { padding: 32, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', borderStyle: 'dashed', borderRadius: 16 },
  emptyStateText: { fontFamily: 'PlusJakartaSans_400Regular', color: '#8B92A0', fontSize: 14 },

  inlineInputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  inlineTaskInput: { flex: 1, backgroundColor: '#0F1115', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, color: '#F3F1EC', fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, marginRight: 10 },
  inlineAddBtn: { width: 44, height: 44, backgroundColor: '#C2A878', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalContent: {
    backgroundColor: '#171B22',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 24,
    padding: 24,
    width: '90%',
  },
  modalTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    color: '#F3F1EC'
  },
  modalSubtitle: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: '#8B92A0',
    marginTop: 4,
    marginBottom: 16
  },
  modalTasksScroll: {
    maxHeight: 180,
    marginBottom: 16
  },
  emptyModalTasks: {
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#8B92A0',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 12
  },
  modalTaskRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.03)'
  },
  modalTaskLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12
  },
  modalCheckbox: {
    width: 14,
    height: 14,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    marginRight: 10
  },
  modalCheckboxChecked: {
    backgroundColor: '#C2A878',
    borderColor: '#C2A878'
  },
  modalTaskText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#F3F1EC',
    fontSize: 12,
    flex: 1
  },
  modalTaskTextCompleted: {
    color: '#8B92A0',
    textDecorationLine: 'line-through'
  },
  modalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16
  },
  modalInput: {
    flex: 1,
    backgroundColor: '#0F1115',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
    color: '#F3F1EC',
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    marginRight: 8
  },
  modalAddBtn: {
    width: 44,
    height: 44,
    backgroundColor: '#C2A878',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12
  },
  modalActionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalActionBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13
  },

  // Daily Login styles
  loginModalContent: {
    backgroundColor: '#171B22',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '80%',
    borderWidth: 1,
    borderColor: 'rgba(194, 168, 120, 0.2)'
  },
  loginModalTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 20,
    color: '#F3F1EC',
    textAlign: 'center'
  },
  loginModalStreak: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    color: '#C2A878',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  loginModalDesc: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: '#8B92A0',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20
  },
  loginBonusBox: {
    backgroundColor: 'rgba(194, 168, 120, 0.1)',
    borderWidth: 1.5,
    borderColor: '#C2A878',
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginBottom: 24
  },
  loginBonusText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#C2A878',
    fontSize: 22
  },
  loginClaimBtn: {
    backgroundColor: '#C2A878',
    width: '100%',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center'
  },
  loginClaimBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F1115',
    fontSize: 14
  },

  // Streak Modal Grid
  streakGrid: {
    width: '100%',
    gap: 12,
    marginBottom: 20
  },
  streakPanelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F1115',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)'
  },
  streakPanelLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: '#F3F1EC',
    flex: 1,
    marginLeft: 8
  },
  streakPanelVal: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    color: '#C2A878',
    marginRight: 6
  },
  reviveBtn: {
    backgroundColor: '#C47070',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  reviveBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#F3F1EC',
    fontSize: 9
  },
  shieldCard: {
    backgroundColor: 'rgba(194, 168, 120, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(194, 168, 120, 0.15)',
    padding: 16,
    borderRadius: 16,
    width: '100%'
  },
  shieldTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#F3F1EC',
    fontSize: 13
  },
  shieldSubtitle: {
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#8B92A0',
    fontSize: 11,
    marginTop: 2
  },
  buyShieldBtn: {
    backgroundColor: '#C2A878',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8
  },
  buyShieldText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F1115',
    fontSize: 11
  }
});
