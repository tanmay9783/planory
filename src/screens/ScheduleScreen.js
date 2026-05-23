import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Platform, StatusBar, Modal, TextInput, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFirestoreData } from '../hooks/useFirestoreData';
import { auth } from '../firebase';

export default function ScheduleScreen() {
  const userId = auth.currentUser ? auth.currentUser.uid : 'guest';
  const [tasks, setTasks] = useFirestoreData(`${userId}_tasks`, []);
  const [pomodoroStats] = useFirestoreData(`${userId}_pomodoro_stats`, { roundsToday: 0 });
  const [expenses] = useFirestoreData(`${userId}_expenses`, []);
  const [habits] = useFirestoreData(`${userId}_user_habits`, []);
  
  const [activeDate, setActiveDate] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');

  // Entrance animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(25)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 650,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 650,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleAddTask = () => {
    if (!newTaskText.trim() || !activeDate) return;
    const newTask = {
      id: Date.now().toString(),
      title: newTaskText.trim(),
      completed: false,
      date: activeDate
    };
    setTasks([...tasks, newTask]);
    setNewTaskText('');
    setActiveDate(null);
  };

  const handleDeleteTask = (taskId) => {
    setTasks(tasks.filter(t => t.id !== taskId));
  };

  // Get current week dates
  const getWeekDates = () => {
    const curr = new Date();
    const first = curr.getDate() - curr.getDay() + 1; // Monday
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(curr.getFullYear(), curr.getMonth(), first + i);
      dates.push(d);
    }
    return dates;
  };

  const weekDates = getWeekDates();
  
  const renderDayCard = (dateObj) => {
    const dayStr = dateObj.toISOString().split('T')[0];
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
    const monthDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    const dayTasks = tasks.filter(t => t.date === dayStr);

    return (
      <TouchableOpacity 
        key={dayStr} 
        style={styles.dayCard}
        onPress={() => setActiveDate(dayStr)}
        activeOpacity={0.9}
      >
        <View style={styles.dayHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text style={styles.dayName}>{dayName}</Text>
            <Text style={styles.dayDate}>{monthDate}</Text>
          </View>
          <Ionicons name="add-circle-outline" size={16} color="#C2A878" />
        </View>
        
        <View style={styles.tasksContainer}>
          {dayTasks.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="sparkles-outline" size={14} color="#5A6070" style={{ marginBottom: 4 }} />
              <Text style={styles.emptyText}>Clear schedule. Tap to add.</Text>
            </View>
          ) : (
            dayTasks.map(task => (
              <View key={task.id} style={styles.taskItem}>
                <TouchableOpacity 
                  style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                  onPress={() => toggleTask(task.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, task.completed && styles.checkboxChecked]} />
                  <Text style={[styles.taskTitle, task.completed && styles.taskTitleCompleted]} numberOfLines={1}>
                    {task.title}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteTask(task.id)} style={styles.deleteBtn}>
                  <Ionicons name="trash-outline" size={13} color="#C47070" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const leftColDays = [weekDates[0], weekDates[2], weekDates[4]]; // Mon, Wed, Fri
  const rightColDays = [weekDates[1], weekDates[3], weekDates[5], weekDates[6]]; // Tue, Thu, Sat, Sun

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.completed).length;
  
  // Estimate focus time based on pomodoro stats (25 mins per round)
  const focusMinutes = pomodoroStats.roundsToday * 25;
  const hours = Math.floor(focusMinutes / 60);
  const minutes = focusMinutes % 60;

  // Calculations for Week Review
  const weekDatesStr = weekDates.map(d => d.toISOString().split('T')[0]);
  const thisWeekTasks = tasks.filter(t => weekDatesStr.includes(t.date));
  const completedThisWeek = thisWeekTasks.filter(t => t.completed).length;
  const totalThisWeek = thisWeekTasks.length;

  const thisWeekExpenses = expenses.filter(e => {
    try {
      const eDate = new Date(e.date);
      const monday = weekDates[0];
      const sunday = new Date(weekDates[6]);
      sunday.setHours(23, 59, 59, 999);
      return eDate >= monday && eDate <= sunday;
    } catch {
      return false;
    }
  });
  const totalSpentThisWeek = thisWeekExpenses.reduce((sum, e) => sum + e.amount, 0);

  const totalHabitCompletionsThisWeek = habits.reduce((sum, h) => {
    if (!h.logs) return sum;
    const weekLogs = h.logs.filter(d => weekDatesStr.includes(d));
    return sum + weekLogs.length;
  }, 0);

  // Dynamic Coach Insights for Indian Students
  const getCoachInsight = () => {
    const taskRatio = totalThisWeek > 0 ? completedThisWeek / totalThisWeek : 0;
    
    if (totalThisWeek === 0) {
      return {
        icon: 'document-text-outline',
        iconColor: '#8B92A0',
        title: 'Empty Desk',
        text: 'Bhai, no tasks scheduled this week! Add some study targets to get started.'
      };
    }
    
    if (taskRatio === 1) {
      return {
        icon: 'trophy-outline',
        iconColor: '#C2A878',
        title: 'Exam Topper Mode',
        text: 'Outstanding! 100% tasks completed this week. Treat yourself to some extra samosas and tapri chai!'
      };
    }
    
    if (totalSpentThisWeek > 400) {
      return {
        icon: 'alert-circle-outline',
        iconColor: '#C47070',
        title: 'Budget Alert',
        text: `Spent ₹${totalSpentThisWeek} this week! Maggi and auto fares are stacking up. Try checking your budget tracker!`
      };
    }
    
    if (taskRatio >= 0.75) {
      return {
        icon: 'flame-outline',
        iconColor: '#C2A878',
        title: 'Solid Momentum',
        text: 'Great work! You are sticking to your targets. Keep this consistency up for the semester.'
      };
    }
    
    if (taskRatio < 0.4) {
      return {
        icon: 'hourglass-outline',
        iconColor: '#C47070',
        title: 'Backlogs Piling Up',
        text: 'Backlogs are piling up, friend. Break your study sessions into small 25-minute Pomodoros to start catch up.'
      };
    }
    
    return {
      icon: 'trending-up-outline',
      iconColor: '#4B6BFB',
      title: 'Keep Moving',
      text: 'Good progress. Try completing 1-2 more tasks daily to build a bulletproof daily streak.'
    };
  };

  const insight = getCoachInsight();

  // Format dates for display
  const weekStartStr = weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const weekEndStr = weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
          <View style={styles.gridContainer}>
            <View style={styles.column}>
              {leftColDays.map(renderDayCard)}
            </View>
            <View style={styles.column}>
              {rightColDays.map(renderDayCard)}
            </View>
          </View>

          {/* Inline Stats Summary Card */}
          <View style={styles.inlineStatsBar}>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statVal}>{totalTasks}</Text>
                <Text style={styles.statLabel}>TOTAL TASKS</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statVal}>{completedTasks}</Text>
                <Text style={styles.statLabel}>COMPLETED</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statVal}>{hours}h {minutes}m</Text>
                <Text style={styles.statLabel}>FOCUS TIME</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statVal}>—</Text>
                <Text style={styles.statLabel}>BEST DAY</Text>
              </View>
            </View>
            
            <TouchableOpacity style={styles.reviewBtn} onPress={() => setShowReviewModal(true)}>
              <Text style={styles.reviewBtnText}>Week Review</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Animated.View>

      {/* Add Task Modal */}
      <Modal
        visible={activeDate !== null}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setActiveDate(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Schedule Task</Text>
            <Text style={styles.modalSubtitle}>For: {activeDate}</Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder="What needs to be done?"
              placeholderTextColor="#5A6070"
              value={newTaskText}
              onChangeText={setNewTaskText}
              autoFocus
              onSubmitEditing={handleAddTask}
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalActionBtn, { backgroundColor: '#171B22', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }]} 
                onPress={() => {
                  setActiveDate(null);
                  setNewTaskText('');
                }}
              >
                <Text style={[styles.modalActionBtnText, { color: '#8B92A0' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalActionBtn, { backgroundColor: '#C2A878' }]} 
                onPress={handleAddTask}
              >
                <Text style={[styles.modalActionBtnText, { color: '#0F1115' }]}>Schedule</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Week Review Modal */}
      <Modal
        visible={showReviewModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowReviewModal(false)}
      >
        <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { width: '90%', maxHeight: '85%' }]}>
          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="stats-chart" size={20} color="#C2A878" />
                <Text style={styles.modalTitle}>Weekly Review</Text>
              </View>
              <TouchableOpacity onPress={() => setShowReviewModal(false)}>
                <Ionicons name="close" size={24} color="#8B92A0" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>{weekStartStr} — {weekEndStr}</Text>

            {/* Coach Insight Card */}
            <View style={[styles.coachCard, { borderColor: insight.iconColor + '30' }]}>
              <View style={[styles.coachIconContainer, { backgroundColor: insight.iconColor + '15' }]}>
                <Ionicons name={insight.icon} size={22} color={insight.iconColor} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.coachTitle, { color: insight.iconColor }]}>{insight.title}</Text>
                <Text style={styles.coachText}>{insight.text}</Text>
              </View>
            </View>

            {/* Stats Grid */}
            <View style={styles.statsGrid}>
              <View style={styles.statsGridRow}>
                <View style={styles.gridStatCard}>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#7C9B7A" style={{ marginBottom: 6 }} />
                  <Text style={styles.gridStatVal}>{completedThisWeek}/{totalThisWeek}</Text>
                  <Text style={styles.gridStatLabel}>TASKS DONE</Text>
                </View>
                <View style={styles.gridStatCard}>
                  <Ionicons name="time-outline" size={20} color="#4B6BFB" style={{ marginBottom: 6 }} />
                  <Text style={styles.gridStatVal}>{hours}h {minutes}m</Text>
                  <Text style={styles.gridStatLabel}>FOCUS TIME</Text>
                </View>
              </View>
              <View style={styles.statsGridRow}>
                <View style={styles.gridStatCard}>
                  <View style={{ height: 20, justifyContent: 'center', marginBottom: 6 }}>
                    <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: '#C47070', fontSize: 16 }}>₹</Text>
                  </View>
                  <Text style={[styles.gridStatVal, { color: totalSpentThisWeek > 400 ? '#C47070' : '#F3F1EC' }]}>₹{totalSpentThisWeek}</Text>
                  <Text style={styles.gridStatLabel}>SPENT</Text>
                </View>
                <View style={styles.gridStatCard}>
                  <Ionicons name="repeat-outline" size={20} color="#C2A878" style={{ marginBottom: 6 }} />
                  <Text style={styles.gridStatVal}>{totalHabitCompletionsThisWeek}</Text>
                  <Text style={styles.gridStatLabel}>HABIT CHECKS</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.modalActionBtn, { backgroundColor: '#C2A878', marginTop: 16 }]} 
              onPress={() => setShowReviewModal(false)}
            >
              <Text style={[styles.modalActionBtnText, { color: '#0F1115' }]}>Chalo, Next Week!</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#0F1115',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0
  },
  scrollContent: { padding: 16, paddingBottom: 24 },
  
  gridContainer: { flexDirection: 'row', gap: 12 },
  column: { flex: 1, gap: 12 },
  
  dayCard: { backgroundColor: '#171B22', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.03)', overflow: 'hidden' },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.02)' },
  dayName: { fontFamily: 'PlusJakartaSans_700Bold', color: '#F3F1EC', fontSize: 13, marginRight: 6 },
  dayDate: { fontFamily: 'PlusJakartaSans_500Medium', color: '#5A6070', fontSize: 11 },
  
  tasksContainer: { minHeight: 120, padding: 12, justifyContent: 'center' },
  
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
  emptyEmoji: { fontSize: 16, marginBottom: 4 },
  emptyText: { fontFamily: 'PlusJakartaSans_500Medium', color: '#5A6070', fontSize: 10, textAlign: 'center' },

  taskItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, justifyContent: 'space-between' },
  checkbox: { width: 12, height: 12, borderRadius: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', marginRight: 8 },
  checkboxChecked: { backgroundColor: '#C2A878', borderColor: '#C2A878' },
  taskTitle: { fontFamily: 'PlusJakartaSans_500Medium', color: '#F3F1EC', fontSize: 11, flex: 1 },
  taskTitleCompleted: { color: '#5A6070', textDecorationLine: 'line-through' },
  deleteBtn: { padding: 4, marginLeft: 4 },

  inlineStatsBar: { 
    backgroundColor: '#171B22', 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.03)', 
    borderRadius: 20,
    padding: 20, 
    marginTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statsRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    marginBottom: 16 
  },
  statItem: { 
    alignItems: 'center',
    flex: 1
  },
  statVal: { 
    fontFamily: 'PlusJakartaSans_700Bold', 
    color: '#F3F1EC', 
    fontSize: 16, 
    marginBottom: 4 
  },
  statLabel: { 
    fontFamily: 'PlusJakartaSans_600SemiBold', 
    color: '#8B92A0', 
    fontSize: 9, 
    letterSpacing: 0.5,
    textAlign: 'center'
  },
  
  reviewBtn: { 
    backgroundColor: '#C2A878', 
    paddingVertical: 12, 
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%'
  },
  reviewBtnText: { 
    fontFamily: 'PlusJakartaSans_700Bold', 
    color: '#0F1115', 
    fontSize: 14,
    letterSpacing: 0.5
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalContent: {
    backgroundColor: '#171B22',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 24,
    padding: 24,
    width: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15
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
  modalInput: {
    backgroundColor: '#0F1115',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    color: '#F3F1EC',
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 15,
    marginBottom: 20
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12
  },
  modalActionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalActionBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14
  },
  coachCard: {
    backgroundColor: 'rgba(194, 168, 120, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(194, 168, 120, 0.15)',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  coachIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center'
  },
  coachTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  },
  coachText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#8B92A0',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4
  },
  statsGrid: {
    gap: 12,
    marginBottom: 8
  },
  statsGridRow: {
    flexDirection: 'row',
    gap: 12
  },
  gridStatCard: {
    flex: 1,
    backgroundColor: '#0F1115',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center'
  },
  gridStatVal: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#F3F1EC',
    fontSize: 15,
    marginBottom: 4
  },
  gridStatLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#5A6070',
    fontSize: 8,
    letterSpacing: 0.5
  }
});
