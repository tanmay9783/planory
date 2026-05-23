import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  SafeAreaView, 
  ScrollView, 
  TextInput, 
  Alert,
  Vibration,
  Animated,
  Platform,
  StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../firebase';
import { useFirestoreData } from '../hooks/useFirestoreData';
import { getLevelTitle } from '../utils/gamification';

export default function ProfileScreen() {
  const userId = auth.currentUser ? auth.currentUser.uid : 'guest';
  const emailPrefix = auth.currentUser?.email ? auth.currentUser.email.split('@')[0] : 'Student';

  // Firestore States
  const [profile, setProfile] = useFirestoreData(`${userId}_user_profile`, { 
    name: emailPrefix, 
    bio: 'Builder', 
    college: 'L.D. College of Engineering', 
    branch: 'Computer Science', 
    semester: 'Semester 4',
    onboarded: true 
  });
  const [gamification] = useFirestoreData(`${userId}_gamification_state`, { level: 1, xp: 0 });
  const [tasks] = useFirestoreData(`${userId}_tasks`, []);
  const [hydration] = useFirestoreData(`${userId}_hydration`, { water: 0, target: 8 });
  const [hydrationLogs] = useFirestoreData(`${userId}_hydration_logs`, []);
  const [streaks] = useFirestoreData(`${userId}_streaks`, { tasks: 0, focus: 0, hydration: 0, habits: 0, budget: 0 });
  const [pomodoroStats] = useFirestoreData(`${userId}_pomodoro_stats`, { roundsToday: 0 });

  // Local editing states
  const [isEditingCard, setIsEditingCard] = useState(false);
  const [editName, setEditName] = useState(profile.name || emailPrefix);
  const [editCollege, setEditCollege] = useState(profile.college || 'Institute');
  const [editBranch, setEditBranch] = useState(profile.branch || 'Branch');
  const [editSemester, setEditSemester] = useState(profile.semester || 'Semester');

  // Entrance animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

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

  useEffect(() => {
    if (profile) {
      setEditName(profile.name || emailPrefix);
      setEditCollege(profile.college || '');
      setEditBranch(profile.branch || '');
      setEditSemester(profile.semester || '');
    }
  }, [profile]);

  const saveIDCard = async () => {
    if (!editName.trim() || !editCollege.trim() || !editBranch.trim() || !editSemester.trim()) {
      Alert.alert('Required Fields', 'All ID Card details are required.');
      return;
    }
    
    try {
      await setProfile({
        ...profile,
        name: editName.trim(),
        college: editCollege.trim(),
        branch: editBranch.trim(),
        semester: editSemester.trim(),
        bio: `Student at ${editCollege.trim()}`
      });
      setIsEditingCard(false);
      Vibration.vibrate(40);
    } catch (e) {
      Alert.alert('Save Failed', 'Could not update your student profile.');
    }
  };

  const xpProgress = Math.min((gamification.xp / (gamification.level * 100)) * 100, 100);

  // Badge unlock checks
  const completedTasksCount = tasks.filter(t => t.completed).length;
  const chaiCount = hydrationLogs.filter(log => log.name === 'Cutting Chai').length;

  const isHydrationHero = hydration.water >= hydration.target;
  const isFocusBeast = pomodoroStats.roundsToday >= 2;
  const isChaiAddict = chaiCount >= 3;
  const isSyllabusShredder = completedTasksCount >= 5;
  const isWeeklyWarrior = (streaks.tasks || 0) >= 3 || (streaks.focus || 0) >= 3;

  const badges = [
    { id: 'water', name: 'Hydration Hero', icon: 'water', unlocked: isHydrationHero, desc: 'Met daily water target' },
    { id: 'focus', name: 'Focus Beast', icon: 'timer', unlocked: isFocusBeast, desc: 'Finished 2+ focus rounds today' },
    { id: 'chai', name: 'Chai Addict', icon: 'cafe', unlocked: isChaiAddict, desc: 'Logged 3+ cutting chais' },
    { id: 'tasks', name: 'Syllabus Shredder', icon: 'checkbox', unlocked: isSyllabusShredder, desc: 'Completed 5+ total tasks' },
    { id: 'streak', name: 'Weekly Warrior', icon: 'flame', unlocked: isWeeklyWarrior, desc: 'Built a 3-day study streak' }
  ];

  // Git Heatmap calculations (last 28 days, 4 columns of 7 days)
  const renderHeatmap = () => {
    const today = new Date();
    const cells = [];
    
    // We want to generate columns. Standard Git heatmap has 7 rows (Sun-Sat) and 4 columns.
    // Sunday = index 0, Saturday = index 6.
    for (let row = 0; row < 7; row++) {
      const rowCells = [];
      for (let col = 0; col < 4; col++) {
        // Calculate date offset
        const daysAgo = (3 - col) * 7 + (6 - row);
        const cellDate = new Date();
        cellDate.setDate(today.getDate() - daysAgo);
        const dateStr = cellDate.toISOString().split('T')[0];

        // Tasks completed count on this date
        const dayCompletedCount = tasks.filter(t => t.date === dateStr && t.completed).length;
        
        let cellColor = '#1D2430'; // Empty
        if (dayCompletedCount >= 3) cellColor = '#7C9B7A'; // High
        else if (dayCompletedCount >= 1) cellColor = 'rgba(194, 168, 120, 0.4)'; // Low/Mid

        rowCells.push(
          <View 
            key={`${row}-${col}`} 
            style={[styles.heatmapCell, { backgroundColor: cellColor }]} 
            title={dateStr}
          />
        );
      }
      cells.push(
        <View key={row} style={styles.heatmapRow}>
          {rowCells}
        </View>
      );
    }
    return cells;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 60 }}>
        
        {/* College Smart ID Card */}
        <Text style={styles.sectionTitle}>Digital Student ID Card</Text>
        <View style={styles.idCardContainer}>
          <View style={styles.idCardGlow} />
          
          <View style={styles.idCardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="school" size={20} color="#C2A878" style={{ marginRight: 8 }} />
              <Text style={styles.idCardHeaderTitle} numberOfLines={1}>{editCollege || 'Institute'}</Text>
            </View>
            <View style={styles.chipLayout} />
          </View>

          {isEditingCard ? (
            <View style={styles.editForm}>
              <TextInput 
                style={styles.editInput} 
                value={editName} 
                onChangeText={setEditName} 
                placeholder="Full Name" 
                placeholderTextColor="#5A6070" 
              />
              <TextInput 
                style={styles.editInput} 
                value={editCollege} 
                onChangeText={setEditCollege} 
                placeholder="College Name" 
                placeholderTextColor="#5A6070" 
              />
              <TextInput 
                style={styles.editInput} 
                value={editBranch} 
                onChangeText={setEditBranch} 
                placeholder="Branch / Major" 
                placeholderTextColor="#5A6070" 
              />
              <TextInput 
                style={styles.editInput} 
                value={editSemester} 
                onChangeText={setEditSemester} 
                placeholder="Semester" 
                placeholderTextColor="#5A6070" 
              />
              <View style={styles.editButtons}>
                <TouchableOpacity style={styles.btnCancel} onPress={() => setIsEditingCard(false)}>
                  <Text style={styles.btnCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnSave} onPress={saveIDCard}>
                  <Text style={styles.btnSaveText}>Save ID</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.idCardBody}>
              <View style={styles.idCardLeft}>
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="person" size={42} color="rgba(194, 168, 120, 0.4)" />
                </View>
                <TouchableOpacity style={styles.editCardBtn} onPress={() => setIsEditingCard(true)}>
                  <Ionicons name="create-outline" size={14} color="#C2A878" style={{ marginRight: 4 }} />
                  <Text style={styles.editCardBtnText}>Edit ID</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.idCardRight}>
                <Text style={styles.idCardName} numberOfLines={1}>{profile.name}</Text>
                <Text style={styles.idCardLabel}>BRANCH</Text>
                <Text style={styles.idCardValue} numberOfLines={1}>{profile.branch || 'Not Set'}</Text>
                <Text style={styles.idCardLabel}>SEMESTER</Text>
                <Text style={styles.idCardValue} numberOfLines={1}>{profile.semester || 'Not Set'}</Text>
                
                {/* Simulated Barcode */}
                <View style={styles.barcodeRow}>
                  <View style={[styles.barcodeLine, { width: 2 }]} />
                  <View style={[styles.barcodeLine, { width: 1 }]} />
                  <View style={[styles.barcodeLine, { width: 4 }]} />
                  <View style={[styles.barcodeLine, { width: 2 }]} />
                  <View style={[styles.barcodeLine, { width: 1 }]} />
                  <View style={[styles.barcodeLine, { width: 3 }]} />
                  <View style={[styles.barcodeLine, { width: 1 }]} />
                  <View style={[styles.barcodeLine, { width: 2 }]} />
                  <View style={[styles.barcodeLine, { width: 4 }]} />
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Stats Row */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{(pomodoroStats.roundsToday || 0) * 0.4}</Text>
            <Text style={styles.statLabel}>Focus Hours</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{completedTasksCount}</Text>
            <Text style={styles.statLabel}>Tasks Done</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{streaks.tasks || 0}</Text>
            <Text style={styles.statLabel}>Daily Streak</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{gamification.xp}</Text>
            <Text style={styles.statLabel}>Current XP</Text>
          </View>
        </View>

        {/* Achievements Shelf */}
        <Text style={styles.sectionTitle}>Achievements Shelf</Text>
        <View style={styles.badgesCard}>
          {badges.map(badge => (
            <View 
              key={badge.id} 
              style={[styles.badgeItem, !badge.unlocked && styles.badgeItemLocked]}
            >
              <View style={[styles.badgeIconBg, badge.unlocked && styles.badgeIconBgUnlocked]}>
                <Ionicons 
                  name={badge.icon} 
                  size={24} 
                  color={badge.unlocked ? '#0F1115' : 'rgba(255,255,255,0.1)'} 
                />
              </View>
              <View style={styles.badgeTextCol}>
                <Text style={[styles.badgeName, badge.unlocked && styles.badgeNameUnlocked]}>{badge.name}</Text>
                <Text style={styles.badgeDesc}>{badge.desc}</Text>
              </View>
              {badge.unlocked ? (
                <Ionicons name="checkmark-circle" size={18} color="#7C9B7A" />
              ) : (
                <Ionicons name="lock-closed" size={16} color="#5A6070" />
              )}
            </View>
          ))}
        </View>

        {/* Git-Style Heatmap consistency Grid */}
        <View style={styles.heatmapSection}>
          <Text style={styles.sectionTitle}>Study Consistency Grid</Text>
          <View style={styles.heatmapCard}>
            <View style={{ flexDirection: 'row' }}>
              <View style={styles.heatmapDaysLabels}>
                <Text style={styles.dayLabelText}>S</Text>
                <Text style={styles.dayLabelText}>M</Text>
                <Text style={styles.dayLabelText}>T</Text>
                <Text style={styles.dayLabelText}>W</Text>
                <Text style={styles.dayLabelText}>T</Text>
                <Text style={styles.dayLabelText}>F</Text>
                <Text style={styles.dayLabelText}>S</Text>
              </View>
              <View style={styles.heatmapGrid}>
                {renderHeatmap()}
              </View>
            </View>
            <View style={styles.heatmapLegend}>
              <Text style={styles.legendText}>Missed</Text>
              <View style={[styles.legendBox, { backgroundColor: '#1D2430' }]} />
              <View style={[styles.legendBox, { backgroundColor: 'rgba(194, 168, 120, 0.4)' }]} />
              <View style={[styles.legendBox, { backgroundColor: '#7C9B7A' }]} />
              <Text style={styles.legendText}>Productive</Text>
            </View>
          </View>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity style={styles.logoutBtn} onPress={() => auth.signOut()}>
          <Ionicons name="log-out-outline" size={18} color="#C47070" style={{ marginRight: 8 }} />
          <Text style={styles.logoutText}>Sign Out Student Workspace</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F1115' },
  sectionTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: '#5A6070', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12, marginTop: 12 },
  
  // ID Card Styling
  idCardContainer: {
    backgroundColor: '#171B22',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#C2A878',
    padding: 20,
    marginBottom: 24,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#C2A878',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4
  },
  idCardGlow: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(194, 168, 120, 0.08)',
    filter: 'blur(20px)'
  },
  idCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    paddingBottom: 12,
    marginBottom: 16
  },
  idCardHeaderTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    color: '#F3F1EC',
    width: '75%'
  },
  chipLayout: {
    width: 28,
    height: 20,
    backgroundColor: 'rgba(194, 168, 120, 0.25)',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(194, 168, 120, 0.4)'
  },
  idCardBody: {
    flexDirection: 'row'
  },
  idCardLeft: {
    alignItems: 'center',
    marginRight: 20
  },
  photoPlaceholder: {
    width: 80,
    height: 90,
    borderRadius: 8,
    backgroundColor: '#0F1115',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  editCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: 'rgba(194, 168, 120, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  editCardBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10,
    color: '#C2A878'
  },
  idCardRight: {
    flex: 1,
    justifyContent: 'center'
  },
  idCardName: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    color: '#C2A878',
    marginBottom: 8
  },
  idCardLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 8,
    color: '#5A6070',
    letterSpacing: 0.5,
    marginTop: 4
  },
  idCardValue: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: '#F3F1EC'
  },
  barcodeRow: {
    flexDirection: 'row',
    height: 16,
    alignItems: 'center',
    gap: 2,
    marginTop: 12
  },
  barcodeLine: {
    height: '100%',
    backgroundColor: '#8B92A0',
    opacity: 0.4
  },
  
  // ID Card Edit Mode
  editForm: {
    width: '100%'
  },
  editInput: {
    backgroundColor: '#0F1115',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#F3F1EC',
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    marginBottom: 10
  },
  editButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8
  },
  btnCancel: {
    flex: 1,
    backgroundColor: '#1C2029',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center'
  },
  btnCancelText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#8B92A0',
    fontSize: 13
  },
  btnSave: {
    flex: 1,
    backgroundColor: '#C2A878',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center'
  },
  btnSaveText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F1115',
    fontSize: 13
  },

  // Stats
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 8
  },
  statCard: {
    flex: 1,
    backgroundColor: '#171B22',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)'
  },
  statVal: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: '#C2A878'
  },
  statLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 9,
    color: '#8B92A0',
    marginTop: 4,
    textAlign: 'center'
  },

  // Badges Card
  badgesCard: {
    backgroundColor: '#171B22',
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)'
  },
  badgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)'
  },
  badgeItemLocked: {
    opacity: 0.4
  },
  badgeIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0F1115',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16
  },
  badgeIconBgUnlocked: {
    backgroundColor: '#C2A878'
  },
  badgeTextCol: {
    flex: 1
  },
  badgeName: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    color: '#8B92A0'
  },
  badgeNameUnlocked: {
    color: '#F3F1EC'
  },
  badgeDesc: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 10,
    color: '#8B92A0',
    marginTop: 2
  },

  // Heatmap Section
  heatmapSection: {
    marginBottom: 24
  },
  heatmapCard: {
    backgroundColor: '#171B22',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)'
  },
  heatmapDaysLabels: {
    marginRight: 12,
    justifyContent: 'space-between',
    paddingVertical: 4
  },
  dayLabelText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#5A6070',
    fontSize: 10,
    height: 14,
    lineHeight: 14
  },
  heatmapGrid: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  heatmapRow: {
    flexDirection: 'column',
    justifyContent: 'space-between'
  },
  heatmapCell: {
    width: 14,
    height: 14,
    borderRadius: 3,
    marginBottom: 4
  },
  heatmapLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 16,
    gap: 4
  },
  legendText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 10,
    color: '#5A6070'
  },
  legendBox: {
    width: 10,
    height: 10,
    borderRadius: 2,
    marginHorizontal: 1
  },

  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(196, 112, 112, 0.2)',
    backgroundColor: 'rgba(196, 112, 112, 0.05)',
    borderRadius: 12,
    marginTop: 16,
    width: '100%'
  },
  logoutText: {
    color: '#C47070',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13
  }
});
