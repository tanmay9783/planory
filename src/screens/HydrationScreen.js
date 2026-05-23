import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, TextInput, Modal, Platform, StatusBar, Animated } from 'react-native';
import { useFirestoreData } from '../hooks/useFirestoreData';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../firebase';
import { calculateXPProgress } from '../utils/gamification';

const DRINK_TYPES = [
  { name: 'Water', icon: 'water-outline', factor: 1.0, desc: 'Pure Hydration' },
  { name: 'Nariyal Paani', icon: 'leaf-outline', factor: 1.25, desc: 'Electrolytes +' },
  { name: 'Nimbu Paani', icon: 'sunny-outline', factor: 1.1, desc: 'Vitamin C Boost' },
  { name: 'Chaas', icon: 'cafe-outline', factor: 1.15, desc: 'Cooling probiotic' },
  { name: 'ORS / Shake', icon: 'beaker-outline', factor: 1.1, desc: 'Recovery energy' },
  { name: 'Cutting Chai', icon: 'thermometer-outline', factor: -0.2, desc: 'Diuretic (-30ml)' }
];

export default function HydrationScreen() {
  const userId = auth.currentUser ? auth.currentUser.uid : 'guest';
  const [hydration, setHydration] = useFirestoreData(`${userId}_hydration`, { water: 0, target: 2000 });
  const [logs, setLogs] = useFirestoreData(`${userId}_hydration_logs`, []);
  const [gamification, setGamification] = useFirestoreData(`${userId}_gamification_state`, { level: 1, xp: 0 });
  
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [isIndianSummer, setIsIndianSummer] = useState(false);
  const [bottleSize, setBottleSize] = useState(1000); // 1000ml standard Milton
  const [customBottleInput, setCustomBottleInput] = useState('1000');
  const [showBottleModal, setShowBottleModal] = useState(false);
  
  // Challenge State
  const [challengeActive, setChallengeActive] = useState(false);
  const [challengeTimer, setChallengeTimer] = useState(60);
  const [challengeWon, setChallengeWon] = useState(false);

  // Timing log for dry spells
  const [timingLogs, setTimingLogs] = useState([]);

  useEffect(() => {
    // Sort and grab latest 10 logs
    const sorted = [...logs].sort((a, b) => b.timestamp - a.timestamp);
    setTimingLogs(sorted.slice(0, 8));
  }, [logs]);

  // Handle Challenge Timer
  useEffect(() => {
    let interval = null;
    if (challengeActive && challengeTimer > 0) {
      interval = setInterval(() => {
        setChallengeTimer(t => t - 1);
      }, 1000);
    } else if (challengeTimer === 0 && challengeActive) {
      setChallengeActive(false);
      setChallengeTimer(60);
    }
    return () => clearInterval(interval);
  }, [challengeActive, challengeTimer]);

  const baseTarget = hydration.target < 50 ? hydration.target * 250 : hydration.target;
  const currentTarget = isIndianSummer ? baseTarget + 750 : baseTarget;
  const progress = Math.min((hydration.water / currentTarget) * 100, 100);

  // Animated values
  const animatedProgress = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.spring(animatedProgress, {
      toValue: progress,
      friction: 6,
      tension: 40,
      useNativeDriver: false
    }).start();
  }, [progress]);

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

  const progressWidth = animatedProgress.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%']
  });

  const addCustomDrink = (drink, size) => {
    const calculatedAmount = Math.round(size * drink.factor);
    setHydration(prev => ({
      ...prev,
      water: Math.max(0, prev.water + calculatedAmount)
    }));

    const newLog = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      name: drink.name,
      icon: drink.icon,
      amount: calculatedAmount,
      originalSize: size,
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    };
    setLogs([newLog, ...logs]);
  };

  const handleBottleLog = () => {
    const waterDrink = DRINK_TYPES[0]; // Water
    addCustomDrink(waterDrink, bottleSize);
  };

  const startChallenge = () => {
    setChallengeTimer(60);
    setChallengeActive(true);
    setChallengeWon(false);
  };

  const logChallengeDrink = () => {
    addCustomDrink(DRINK_TYPES[0], 250); // Log a glass of water
    setChallengeWon(true);
    setChallengeActive(false);
    // Add XP
    const progress = calculateXPProgress(gamification.level, gamification.xp, 15);
    setGamification({ level: progress.level, xp: progress.xp });
  };

  return (
    <View style={styles.container}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 60 }}>
          
          {/* Weather alert banner for Indian summer */}
          {isIndianSummer && (
            <View style={styles.summerBanner}>
              <Ionicons name="sunny" size={18} color="#C2A878" style={{ marginRight: 8 }} />
              <Text style={styles.summerBannerText}>Indian Summer mode: Daily goal increased by 750ml!</Text>
            </View>
          )}

          {/* Main Status Ring */}
          <View style={styles.hydrationCard}>
            <Text style={styles.hydrationVal}>{hydration.water} / {currentTarget} ml</Text>
            <Text style={styles.hydrationPercent}>{Math.round(progress)}%</Text>
            <View style={styles.progressBg}>
              <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
            </View>
          </View>

        {/* Quick Log Bottle & Weather controls */}
        <View style={styles.row}>
          <TouchableOpacity style={styles.quickAddCard} onPress={handleBottleLog}>
            <Ionicons name="water-outline" size={24} color="#C2A878" />
            <Text style={styles.quickAddTitle}>1-Tap Bottle</Text>
            <Text style={styles.quickAddSub}>{bottleSize}ml</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickAddCard} onPress={() => setShowBottleModal(true)}>
            <Ionicons name="settings-outline" size={24} color="#8B92A0" />
            <Text style={styles.quickAddTitle}>Set Bottle</Text>
            <Text style={styles.quickAddSub}>Configure size</Text>
          </TouchableOpacity>
        </View>

        {/* Desi Drink Library */}
        <Text style={styles.sectionTitle}>DESI DRINK LIBRARY</Text>
        <View style={styles.drinkGrid}>
          {DRINK_TYPES.map((drink, index) => (
            <TouchableOpacity 
              key={index} 
              style={styles.drinkCard}
              onPress={() => addCustomDrink(drink, drink.name === 'Cutting Chai' ? 150 : 250)}
            >
              <Ionicons name={drink.icon} size={22} color="#C2A878" />
              <Text style={styles.drinkName}>{drink.name}</Text>
              <Text style={styles.drinkDesc}>{drink.desc}</Text>
              <Text style={styles.drinkAction}>+ {drink.name === 'Cutting Chai' ? 150 : 250}ml</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Timing logs / Dry spells */}
        <View style={{ marginTop: 24 }}>
          <Text style={styles.sectionTitle}>DRINK TIMELINE (PREVENT DRY SPELLS)</Text>
          <View style={styles.timelineContainer}>
            {timingLogs.length === 0 ? (
              <Text style={styles.emptyTimelineText}>No drinks logged yet today. Keep hydrating!</Text>
            ) : (
              timingLogs.map((log, index) => (
                <View key={log.id} style={styles.timelineItem}>
                  <View style={styles.timelineLeft}>
                    <Text style={styles.timelineTime}>{log.time}</Text>
                    <View style={styles.timelineNode} />
                  </View>
                  <View style={styles.timelineCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name={log.icon || 'water-outline'} size={14} color="#8B92A0" style={{ marginRight: 6 }} />
                      <Text style={styles.timelineCardText}>{log.name}</Text>
                    </View>
                    <Text style={[styles.timelineCardAmount, log.amount < 0 && { color: '#C47070' }]}>
                      {log.amount > 0 ? `+${log.amount}ml` : `${log.amount}ml`}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Challenge Mode Widget */}
        <View style={styles.challengeContainer}>
          <Text style={styles.sectionTitle}>CHALLENGE MODE</Text>
          <View style={styles.challengeCard}>
            {challengeActive ? (
              <View style={{ alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="timer-outline" size={14} color="#C2A878" style={{ marginRight: 4 }} />
                  <Text style={styles.challengeTimer}>{challengeTimer}s left</Text>
                </View>
                <Text style={styles.challengeSubtitle}>Drink 1 glass (250ml) before the time runs out!</Text>
                <TouchableOpacity style={styles.challengeActionBtn} onPress={logChallengeDrink}>
                  <Text style={styles.challengeActionBtnText}>I drank it! (+15 XP)</Text>
                </TouchableOpacity>
              </View>
            ) : challengeWon ? (
              <View style={{ alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="checkmark-circle" size={16} color="#7C9B7A" style={{ marginRight: 6 }} />
                  <Text style={styles.challengeTitleWon}>Challenge Completed!</Text>
                </View>
                <Text style={styles.challengeSubtitle}>Awesome job staying hydrated. You gained +15 XP!</Text>
                <TouchableOpacity style={styles.challengeStartBtn} onPress={startChallenge}>
                  <Text style={styles.challengeStartBtnText}>Start New Challenge</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ alignItems: 'center' }}>
                <Text style={styles.challengeTitleHeader}>60s Hydration Blitz</Text>
                <Text style={styles.challengeSubtitle}>Force yourself to drink water. Finish in 60s for bonus XP.</Text>
                <TouchableOpacity style={styles.challengeStartBtn} onPress={startChallenge}>
                  <Text style={styles.challengeStartBtnText}>Start Challenge</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Settings */}
        <View style={{ marginTop: 24 }}>
          <Text style={styles.sectionTitle}>SETTINGS</Text>
          
          <View style={styles.settingsRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingsLabel}>Indian Summer mode</Text>
              <Text style={styles.settingsSub}>Increases daily target by 750ml for hot days</Text>
            </View>
            <Switch 
              value={isIndianSummer} 
              onValueChange={setIsIndianSummer}
              trackColor={{ false: '#171B22', true: 'rgba(194, 168, 120, 0.5)' }}
              thumbColor={isIndianSummer ? '#C2A878' : '#8B92A0'}
            />
          </View>

          <View style={[styles.settingsRow, { marginTop: 12 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingsLabel}>Lecture Quiet Hours</Text>
              <Text style={styles.settingsSub}>Mutes reminders during standard college hours</Text>
            </View>
            <Switch 
              value={alertsEnabled} 
              onValueChange={setAlertsEnabled}
              trackColor={{ false: '#171B22', true: 'rgba(194, 168, 120, 0.5)' }}
              thumbColor={alertsEnabled ? '#C2A878' : '#8B92A0'}
            />
          </View>
        </View>
        
      </ScrollView>
    </Animated.View>

      {/* Configure Bottle Size Modal */}
      <Modal
        visible={showBottleModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowBottleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Set Custom Bottle Size</Text>
            <Text style={styles.modalSubtitle}>Configure your daily flask (ml)</Text>
            
            <TextInput
              style={styles.modalInput}
              keyboardType="numeric"
              placeholder="e.g. 1000 for standard bottle"
              placeholderTextColor="#5A6070"
              value={customBottleInput}
              onChangeText={setCustomBottleInput}
              autoFocus
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalActionBtn, { backgroundColor: '#171B22', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }]} 
                onPress={() => setShowBottleModal(false)}
              >
                <Text style={[styles.modalActionBtnText, { color: '#8B92A0' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalActionBtn, { backgroundColor: '#C2A878' }]} 
                onPress={() => {
                  const size = parseInt(customBottleInput);
                  if (size > 0) {
                    setBottleSize(size);
                  }
                  setShowBottleModal(false);
                }}
              >
                <Text style={[styles.modalActionBtnText, { color: '#0F1115' }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F1115' },
  
  summerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(194, 168, 120, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(194, 168, 120, 0.2)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20
  },
  summerBannerText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: '#C2A878',
    flex: 1
  },

  hydrationCard: { 
    backgroundColor: '#171B22', 
    borderRadius: 24, 
    padding: 24, 
    alignItems: 'center', 
    marginBottom: 20, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.03)',
    shadowColor: '#4B6BFB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 4
  },
  hydrationVal: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20, color: '#F3F1EC', marginBottom: 8 },
  hydrationPercent: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 44, color: '#4B6BFB', marginBottom: 16 },
  progressBg: { width: '100%', height: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#4B6BFB' },

  row: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  quickAddCard: {
    flex: 1,
    backgroundColor: '#171B22',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center'
  },
  quickAddTitle: { fontFamily: 'PlusJakartaSans_700Bold', color: '#F3F1EC', fontSize: 13, marginTop: 8 },
  quickAddSub: { fontFamily: 'PlusJakartaSans_500Medium', color: '#8B92A0', fontSize: 11, marginTop: 2 },

  sectionTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: '#5A6070', letterSpacing: 1, marginBottom: 12 },
  
  drinkGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  drinkCard: {
    width: '48%',
    backgroundColor: '#171B22',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center'
  },
  drinkEmoji: { fontSize: 28, marginBottom: 4 },
  drinkName: { fontFamily: 'PlusJakartaSans_700Bold', color: '#F3F1EC', fontSize: 13, textAlign: 'center' },
  drinkDesc: { fontFamily: 'PlusJakartaSans_500Medium', color: '#8B92A0', fontSize: 10, marginTop: 2, textAlign: 'center' },
  drinkAction: { fontFamily: 'PlusJakartaSans_700Bold', color: '#4B6BFB', fontSize: 11, marginTop: 12 },

  timelineContainer: {
    backgroundColor: '#171B22',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
    marginBottom: 24
  },
  emptyTimelineText: { fontFamily: 'PlusJakartaSans_500Medium', color: '#8B92A0', fontSize: 12, textAlign: 'center', paddingVertical: 12 },
  timelineItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  timelineLeft: { width: 70, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timelineTime: { fontFamily: 'PlusJakartaSans_600SemiBold', color: '#8B92A0', fontSize: 11 },
  timelineNode: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4B6BFB', marginRight: 8 },
  timelineCard: { flex: 1, backgroundColor: '#1D2430', borderRadius: 10, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timelineCardText: { fontFamily: 'PlusJakartaSans_600SemiBold', color: '#F3F1EC', fontSize: 12 },
  timelineCardAmount: { fontFamily: 'PlusJakartaSans_700Bold', color: '#4B6BFB', fontSize: 12 },

  challengeContainer: { marginBottom: 24 },
  challengeCard: {
    backgroundColor: '#171B22',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
    padding: 20
  },
  challengeTitleHeader: { fontFamily: 'PlusJakartaSans_700Bold', color: '#C2A878', fontSize: 15, marginBottom: 8 },
  challengeTitleWon: { fontFamily: 'PlusJakartaSans_700Bold', color: '#7C9B7A', fontSize: 15, marginBottom: 8 },
  challengeTimer: { fontFamily: 'PlusJakartaSans_700Bold', color: '#C47070', fontSize: 18, marginBottom: 8 },
  challengeSubtitle: { fontFamily: 'PlusJakartaSans_500Medium', color: '#8B92A0', fontSize: 11, textAlign: 'center', marginBottom: 16, lineHeight: 18 },
  challengeStartBtn: { backgroundColor: '#1D2430', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  challengeStartBtnText: { fontFamily: 'PlusJakartaSans_700Bold', color: '#C2A878', fontSize: 12 },
  challengeActionBtn: { backgroundColor: '#C2A878', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  challengeActionBtnText: { fontFamily: 'PlusJakartaSans_700Bold', color: '#0F1115', fontSize: 12 },

  settingsRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    backgroundColor: '#171B22', 
    padding: 20, 
    borderRadius: 16, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.03)' 
  },
  settingsLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', color: '#F3F1EC', fontSize: 14 },
  settingsSub: { fontFamily: 'PlusJakartaSans_500Medium', color: '#8B92A0', fontSize: 11, marginTop: 4 },

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
  }
});
