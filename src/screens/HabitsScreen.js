import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Platform, StatusBar, Animated, Vibration } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFirestoreData } from '../hooks/useFirestoreData';
import { auth } from '../firebase';
import { calculateXPProgress } from '../utils/gamification';

export default function HabitsScreen() {
  const userId = auth.currentUser ? auth.currentUser.uid : 'guest';
  const [hydration, setHydration] = useFirestoreData(`${userId}_hydration`, { water: 0, target: 2000 });
  const [gamification, setGamification] = useFirestoreData(`${userId}_gamification_state`, { level: 1, xp: 0 });
  const [habits, setHabits] = useFirestoreData(`${userId}_user_habits`, [
    { id: '1', name: 'Drink 3L Water', icon: 'water-outline', fire: 4 },
    { id: '2', name: 'Read 10 Pages', icon: 'book-outline', fire: 2 },
    { id: '3', name: 'Work out', icon: 'barbell-outline', fire: 5 },
    { id: '4', name: 'Meditate', icon: 'body-outline', fire: 1 },
  ]);

  // Entrance animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  // Spring scale animations for each habit card
  const scaleAnims = useRef({
    '1': new Animated.Value(1),
    '2': new Animated.Value(1),
    '3': new Animated.Value(1),
    '4': new Animated.Value(1),
  }).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const addWater = () => {
    setHydration({ ...hydration, water: hydration.water + 250 });
  };

  const animateToggle = (habitId) => {
    const anim = scaleAnims[habitId] || new Animated.Value(1);
    scaleAnims[habitId] = anim;
    
    anim.setValue(0.88);
    Animated.spring(anim, {
      toValue: 1,
      friction: 4,
      tension: 40,
      useNativeDriver: true
    }).start();
  };

  const toggleHabit = (habitId) => {
    animateToggle(habitId);
    const today = new Date().toISOString().split('T')[0];
    setHabits(habits.map(h => {
      if (h.id === habitId) {
        const isCompletedToday = h.logs && h.logs.includes(today);
        if (!isCompletedToday) {
          Vibration.vibrate(40);
          const progress = calculateXPProgress(gamification.level, gamification.xp, 5);
          setGamification({ level: progress.level, xp: progress.xp });
        }
        const newLogs = isCompletedToday 
          ? h.logs.filter(d => d !== today)
          : [...(h.logs || []), today];
        return { ...h, logs: newLogs, fire: isCompletedToday ? Math.max(0, h.fire - 1) : h.fire + 1 };
      }
      return h;
    }));
  };

  // Defensive scaling: if target is set as glasses/liters (e.g. < 50) instead of ml, scale it to ml
  const displayTarget = hydration.target < 50 ? hydration.target * 250 : hydration.target;
  const progress = Math.min((hydration.water / displayTarget) * 100, 100);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Habits</Text>
      </View>
      
      <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        <ScrollView contentContainerStyle={{ padding: 24 }}>
        
        {/* Hydration Widget */}
        <TouchableOpacity style={styles.hydrationCard} onPress={addWater} activeOpacity={0.9}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Ionicons name="water-outline" size={20} color="#4B6BFB" style={{ marginRight: 6 }} />
            <Text style={styles.hydrationVal}>{hydration.water} / {displayTarget} ml</Text>
          </View>
          <Text style={styles.hydrationPercent}>{Math.round(progress)}%</Text>
          <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', color: '#5A6070', fontSize: 11, marginTop: 8 }}>Tap card to quick log +250ml</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.addWaterBtn} onPress={addWater}>
          <Text style={styles.addWaterText}>HYDRATION    + 250ml</Text>
          <Ionicons name="caret-forward" size={12} color="#5A6070" />
        </TouchableOpacity>

        {/* Daily Habits */}
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
            <Text style={styles.sectionTitle}>DAILY HABITS  +</Text>
            <Ionicons name="caret-down" size={14} color="#5A6070" />
          </View>

          {habits.map(h => {
            const today = new Date().toISOString().split('T')[0];
            const isCompleted = h.logs && h.logs.includes(today);
            
            return (
              <Animated.View 
                key={h.id} 
                style={{ transform: [{ scale: scaleAnims[h.id] || 1 }] }}
              >
                <TouchableOpacity 
                  style={styles.habitCard} 
                  onPress={() => toggleHabit(h.id)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.checkbox, isCompleted && styles.checkboxChecked]} />
                  <View style={styles.habitIconContainer}>
                    <Ionicons name={h.icon || 'star-outline'} size={14} color={isCompleted ? '#C2A878' : '#8B92A0'} />
                  </View>
                  <Text style={[styles.habitTitle, isCompleted && styles.habitTitleCompleted]}>
                    {h.name}
                  </Text>
                  <View style={styles.fireBadge}>
                    <Ionicons name="flame-outline" size={12} color="#FF8C00" style={{ marginRight: 4 }} />
                    <Text style={styles.fireCount}>{h.fire}</Text>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>

      </ScrollView>
    </Animated.View>
  </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#0F1115',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0
  },
  header: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8 },
  headerTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 28, color: '#F3F1EC' },
  
  hydrationCard: { 
    backgroundColor: '#171B22', 
    borderRadius: 24, 
    padding: 24, 
    alignItems: 'center', 
    marginBottom: 24, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.03)',
    shadowColor: '#4B6BFB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 4
  },
  hydrationVal: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: '#F3F1EC', marginBottom: 8 },
  hydrationPercent: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 36, color: '#4B6BFB' },

  addWaterBtn: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    backgroundColor: '#171B22', 
    borderRadius: 16, 
    paddingHorizontal: 20, 
    paddingVertical: 16, 
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1
  },
  addWaterText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: '#5A6070', letterSpacing: 1 },

  section: { marginBottom: 24 },
  sectionTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: '#5A6070', letterSpacing: 1 },
  
  habitCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#171B22', 
    borderRadius: 16, 
    padding: 16, 
    marginBottom: 12, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.03)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2
  },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)', marginRight: 16, backgroundColor: '#0F1115' },
  checkboxChecked: { backgroundColor: '#C2A878', borderColor: '#C2A878' },
  habitTitle: { flex: 1, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15, color: '#F3F1EC' },
  habitTitleCompleted: { color: '#8B92A0', textDecorationLine: 'line-through' },
  
  fireBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 69, 0, 0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  fireCount: { fontFamily: 'PlusJakartaSans_700Bold', color: '#FF8C00', fontSize: 12 },
  habitIconContainer: { width: 24, height: 24, justifyContent: 'center', alignItems: 'center', marginRight: 12 }
});
