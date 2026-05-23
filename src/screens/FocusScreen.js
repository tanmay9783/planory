import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, TextInput, Modal, Alert, Platform, StatusBar, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFirestoreData } from '../hooks/useFirestoreData';
import { auth } from '../firebase';
import { Audio } from 'expo-av';
import { calculateXPProgress } from '../utils/gamification';

const SOUND_ASSETS = {
  rain: require('../../assets/music/rain.mp3'),
  tapri: require('../../assets/music/tapri.mp3'),
  sitar: require('../../assets/music/sitar.mp3'),
  lofi: require('../../assets/music/lofi.mp3')
};

const WORK_TIME = 25 * 60;
const BREAK_TIME = 5 * 60;

const AMBIENT_SOUNDS = [
  { id: 'rain', name: 'Soothing Rain', icon: 'rainy-outline' },
  { id: 'tapri', name: 'Soft Cafe Ambience', icon: 'cafe-outline' },
  { id: 'sitar', name: 'Zen Flute', icon: 'musical-notes-outline' },
  { id: 'lofi', name: 'Calm Lofi Beats', icon: 'headset-outline' }
];

export default function FocusScreen() {
  const userId = auth.currentUser ? auth.currentUser.uid : 'guest';

  const [timeLeft, setTimeLeft] = useState(WORK_TIME);
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState('work'); // 'work' or 'break'
  
  // Tasks & Intention State
  const [tasks, setTasks] = useFirestoreData(`${userId}_tasks`, []);
  const [activeTaskId, setActiveTaskId] = useState(null);
  
  const [showIntentionModal, setShowIntentionModal] = useState(false);
  const [selectedFocusSound, setSelectedFocusSound] = useState('lofi');
  const [intentionText, setIntentionText] = useState('');
  const [committedIntention, setCommittedIntention] = useState('');

  // Distraction & Session Tracking
  const [distractionsCount, setDistractionsCount] = useState(0);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [starRating, setStarRating] = useState(5);
  const [summaryNote, setSummaryNote] = useState('');

  // Lock Mode / Full Screen
  const [isFullScreenLock, setIsFullScreenLock] = useState(false);
  const [exitPressTimer, setExitPressTimer] = useState(0);
  const [isPressingExit, setIsPressingExit] = useState(false);

  // Sound Mixer state (vol values 0 - 100)
  const [soundVolumes, setSoundVolumes] = useState({
    rain: 50,
    tapri: 20,
    sitar: 0,
    lofi: 40
  });

  // Audio playback object ref
  const soundObjects = useRef({
    rain: null,
    tapri: null,
    sitar: null,
    lofi: null
  });

  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  // Mount entrance animations
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

  // Pulse animation loop when timer is active
  useEffect(() => {
    let loop = null;
    if (isActive) {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1500,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true
          }),
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 1500,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true
          })
        ])
      );
      loop.start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => {
      if (loop) loop.stop();
    };
  }, [isActive]);

  // Audio Mode Setup & Unload cleanup
  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      staysActiveInBackground: true,
      playThroughEarpieceAndroid: false
    }).catch(err => console.warn('Audio setup error:', err));

    return () => {
      // Unload sounds when screen unmounts
      Object.keys(soundObjects.current).forEach(async (key) => {
        if (soundObjects.current[key]) {
          try {
            await soundObjects.current[key].unloadAsync();
          } catch (e) {
            // ignore
          }
        }
      });
    };
  }, []);

  // Sync sound playback states instantly with timer activity/modal preview and volumes (Concurrently)
  useEffect(() => {
    const syncMixerSounds = async () => {
      await Promise.all(['rain', 'tapri', 'sitar', 'lofi'].map(async (soundId) => {
        let shouldPlayThis = false;
        let volumeToSet = 0;

        if (showIntentionModal) {
          if (selectedFocusSound === soundId && selectedFocusSound !== 'none') {
            shouldPlayThis = true;
            volumeToSet = 60;
          }
        } else if (isActive) {
          const vol = soundVolumes[soundId];
          if (vol > 0) {
            shouldPlayThis = true;
            volumeToSet = vol;
          }
        }

        const sound = soundObjects.current[soundId];
        
        try {
          if (shouldPlayThis) {
            if (!sound) {
              // Lazy load on demand
              const { sound: newSound } = await Audio.Sound.createAsync(
                SOUND_ASSETS[soundId],
                { shouldPlay: true, isLooping: true, volume: volumeToSet / 100 }
              );
              soundObjects.current[soundId] = newSound;
            } else {
              const status = await sound.getStatusAsync();
              if (status.isLoaded) {
                await sound.setVolumeAsync(volumeToSet / 100);
                if (!status.isPlaying) {
                  await sound.playAsync();
                }
              } else {
                // If it was unloaded or error, re-create
                const { sound: newSound } = await Audio.Sound.createAsync(
                  SOUND_ASSETS[soundId],
                  { shouldPlay: true, isLooping: true, volume: volumeToSet / 100 }
                );
                soundObjects.current[soundId] = newSound;
              }
            }
          } else {
            // Stop/pause if it shouldn't play
            if (sound) {
              const status = await sound.getStatusAsync();
              if (status.isLoaded && status.isPlaying) {
                await sound.pauseAsync();
              }
            }
          }
        } catch (e) {
          console.warn(`Mixer sync error for ${soundId}:`, e);
        }
      }));
    };
    
    syncMixerSounds();
  }, [isActive, showIntentionModal, selectedFocusSound, soundVolumes]);

  // Gamification & Tracking
  const [gamification, setGamification] = useFirestoreData(`${userId}_gamification_state`, { level: 1, xp: 0 });
  const [pomodoroStats, setPomodoroStats] = useFirestoreData(`${userId}_pomodoro_stats`, { roundsToday: 0, date: new Date().toISOString().split('T')[0] });

  // Reset stats if new day
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    if (pomodoroStats.date !== today) {
      setPomodoroStats({ roundsToday: 0, date: today });
    }
  }, []);

  // Timer Tick Interval
  useEffect(() => {
    let interval = null;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((time) => time - 1);
      }, 1000);
    } else if (isActive && timeLeft === 0) {
      clearInterval(interval);
      setIsActive(false);
      setIsFullScreenLock(false);
      
      if (mode === 'work') {
        // Work session completed! Show summary modal
        const progress = calculateXPProgress(gamification.level, gamification.xp, 20);
        setGamification({ level: progress.level, xp: progress.xp });
        setPomodoroStats(prev => ({ ...prev, roundsToday: prev.roundsToday + 1 }));
        setShowSummaryModal(true);
      } else {
        // Break session completed
        setMode('work');
        setTimeLeft(WORK_TIME);
        Alert.alert("Break Over!", "Time to get back to work. Set your intention!");
      }
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft, mode]);

  // Handle Exit Press Countdown
  useEffect(() => {
    let interval = null;
    if (isPressingExit) {
      interval = setInterval(() => {
        setExitPressTimer(prev => {
          if (prev >= 3) {
            clearInterval(interval);
            setIsFullScreenLock(false);
            setIsActive(false);
            setIsPressingExit(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      setExitPressTimer(0);
    }
    return () => clearInterval(interval);
  }, [isPressingExit]);

  const handleStartPress = () => {
    if (!isActive && mode === 'work' && !committedIntention) {
      // Trigger intention gate modal
      setShowIntentionModal(true);
    } else {
      setIsActive(!isActive);
    }
  };

  const handleCommitIntention = () => {
    if (!intentionText.trim()) {
      Alert.alert("Write Intention", "Please write one study goal before committing.");
      return;
    }
    setCommittedIntention(intentionText.trim());
    
    // Set selectedFocusSound volume to 60, and set other volumes to 0!
    setSoundVolumes(prev => {
      const newVols = { rain: 0, tapri: 0, sitar: 0, lofi: 0 };
      if (selectedFocusSound !== 'none') {
        newVols[selectedFocusSound] = 60;
      }
      return newVols;
    });

    setShowIntentionModal(false);
    setIsActive(true);
  };

  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(mode === 'work' ? WORK_TIME : BREAK_TIME);
    setCommittedIntention('');
    setIntentionText('');
    setDistractionsCount(0);
  };

  const switchMode = (newMode) => {
    setIsActive(false);
    setMode(newMode);
    setTimeLeft(newMode === 'work' ? WORK_TIME : BREAK_TIME);
    setCommittedIntention('');
    setIntentionText('');
    setDistractionsCount(0);
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const adjustVolume = (trackId, change) => {
    setSoundVolumes(prev => ({
      ...prev,
      [trackId]: Math.max(0, Math.min(100, prev[trackId] + change))
    }));
  };

  const logDistraction = () => {
    setDistractionsCount(prev => prev + 1);
  };

  const saveSessionSummary = () => {
    setShowSummaryModal(false);
    // Move directly into Short Break mode
    setMode('break');
    setTimeLeft(BREAK_TIME);
    setCommittedIntention('');
    setIntentionText('');
    setDistractionsCount(0);
    setStarRating(5);
    setSummaryNote('');
  };

  // Filter pending tasks
  const pendingTasks = tasks.filter(t => !t.completed);

  // Full Screen Lock View render
  if (isFullScreenLock) {
    return (
      <View style={[styles.container, styles.fullScreenContainer]}>
        <StatusBar hidden />
        <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}>
          <Text style={styles.fullScreenIntention}>Focusing on: "{committedIntention || 'Active Task'}"</Text>
          <Text style={styles.fullScreenTimer} numberOfLines={1} adjustsFontSizeToFit>{formatTime(timeLeft)}</Text>
          
          <TouchableOpacity 
            style={styles.fullScreenDistractionBtn}
            onPress={logDistraction}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Ionicons name="alert-circle-outline" size={16} color="#C47070" />
              <Text style={styles.fullScreenDistractionBtnText}>Log Distraction ({distractionsCount})</Text>
            </View>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={[styles.exitBtn, isPressingExit && { backgroundColor: '#C47070' }]}
          onPressIn={() => setIsPressingExit(true)}
          onPressOut={() => setIsPressingExit(false)}
          activeOpacity={0.8}
        >
          <Text style={styles.exitBtnText}>
            {isPressingExit ? `Hold ${3 - exitPressTimer}s to Exit` : 'Hold 3s to Exit'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 60 }}>
        
        {/* Intention Status Banner */}
        {committedIntention ? (
          <View style={styles.intentionBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.intentionBannerTitle}>Target Intention</Text>
              <Text style={styles.intentionBannerText}>"{committedIntention}"</Text>
            </View>
            <TouchableOpacity onPress={() => setCommittedIntention('')}>
              <Ionicons name="close" size={16} color="#8B92A0" />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Focus Round Progress Summary */}
        <View style={styles.statsCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={styles.targetIconContainer}>
              <Ionicons name="ribbon-outline" size={24} color="#C2A878" />
            </View>
            <View style={{ marginLeft: 16 }}>
              <Text style={styles.statsLabel}>STUDY TARGETS TODAY</Text>
              <Text style={styles.statsVal}>{pomodoroStats.roundsToday} Deep Work Rounds Completed</Text>
            </View>
          </View>
        </View>

        {/* Task Assigner */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SELECT RELEVANT SUBJECT TASK</Text>
          {pendingTasks.length === 0 ? (
            <View style={styles.emptyTaskCard}>
              <Text style={styles.emptyTaskText}>No pending exam/subject tasks scheduled.</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              <TouchableOpacity 
                style={[styles.taskPill, activeTaskId === null && styles.taskPillActive]}
                onPress={() => {
                  setActiveTaskId(null);
                  setIntentionText('');
                }}
              >
                <Text style={[styles.taskPillText, activeTaskId === null && { color: '#0F1115' }]}>General study</Text>
              </TouchableOpacity>
              {pendingTasks.map(task => (
                <TouchableOpacity 
                  key={task.id} 
                  style={[styles.taskPill, activeTaskId === task.id && styles.taskPillActive]}
                  onPress={() => {
                    setActiveTaskId(task.id);
                    setIntentionText(`Work on task: ${task.title}`);
                  }}
                >
                  <Text style={[styles.taskPillText, activeTaskId === task.id && { color: '#0F1115' }]}>{task.title}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Timer Card */}
        <View style={styles.timerCard}>
          <View style={styles.modeToggle}>
            <TouchableOpacity onPress={() => switchMode('work')} style={[styles.modeBtn, mode === 'work' && styles.modeActive]}>
              <Text style={[styles.modeText, mode === 'work' && styles.modeTextActive]}>Deep Study</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => switchMode('break')} style={[styles.modeBtn, mode === 'break' && styles.modeActive]}>
              <Text style={[styles.modeText, mode === 'break' && styles.modeTextActive]}>Chai Break</Text>
            </TouchableOpacity>
          </View>

          <Animated.View style={[
            styles.timerRing,
            isActive && { borderColor: 'rgba(194, 168, 120, 0.4)' },
            { transform: [{ scale: pulseAnim }] }
          ]}>
            <Text style={styles.timeText} numberOfLines={1} adjustsFontSizeToFit>{formatTime(timeLeft)}</Text>
          </Animated.View>
          
          <View style={styles.controls}>
            <TouchableOpacity style={styles.playBtn} onPress={handleStartPress}>
              <Ionicons name={isActive ? "pause" : "play"} size={32} color="#0F1115" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.resetBtn} onPress={resetTimer}>
              <Ionicons name="refresh" size={24} color="#F3F1EC" />
            </TouchableOpacity>
          </View>

          {isActive && (
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
              <TouchableOpacity style={styles.inlineActionBtn} onPress={logDistraction}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Ionicons name="alert-circle-outline" size={14} color="#C47070" />
                  <Text style={styles.inlineActionBtnText}>Log Distraction ({distractionsCount})</Text>
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity style={[styles.inlineActionBtn, { backgroundColor: '#1D2430' }]} onPress={() => setIsFullScreenLock(true)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Ionicons name="lock-closed-outline" size={14} color="#F3F1EC" />
                  <Text style={[styles.inlineActionBtnText, { color: '#F3F1EC' }]}>Lock Screen</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Desi Sound Mixer */}
        <View style={{ marginTop: 32 }}>
          <Text style={styles.sectionTitle}>STUDY BACKGROUND SOUND MIXER</Text>
          <View style={styles.mixerCard}>
            {AMBIENT_SOUNDS.map(sound => (
              <View key={sound.id} style={styles.mixerRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', width: '38%' }}>
                  <Ionicons name={sound.icon} size={18} color="#8B92A0" style={{ marginRight: 8 }} />
                  <Text style={styles.mixerSoundName} numberOfLines={1}>{sound.name}</Text>
                </View>
                
                <View style={styles.volumeController}>
                  <TouchableOpacity onPress={() => adjustVolume(sound.id, -10)} style={styles.volBtn}>
                    <Ionicons name="remove" size={14} color="#8B92A0" />
                  </TouchableOpacity>
                  
                  <View style={styles.sliderTrack}>
                    <View style={[styles.sliderFill, { width: `${soundVolumes[sound.id]}%` }]} />
                  </View>
                  
                  <TouchableOpacity onPress={() => adjustVolume(sound.id, 10)} style={styles.volBtn}>
                    <Ionicons name="add" size={14} color="#8B92A0" />
                  </TouchableOpacity>
                  
                  <Text style={styles.volPct}>{soundVolumes[sound.id]}%</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

      </ScrollView>
    </Animated.View>

      {/* Pre-session Intention Commit Modal */}
      <Modal
        visible={showIntentionModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowIntentionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Set Study Intention</Text>
            <Text style={styles.modalSubtitle}>Commit to one target before study countdown</Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Finish mechanics practice problems"
              placeholderTextColor="#5A6070"
              value={intentionText}
              onChangeText={setIntentionText}
              autoFocus
            />

            <Text style={styles.modalSubLabel}>SELECT FOCUS MUSIC</Text>
            <View style={styles.soundSelectorContainer}>
              {[
                { id: 'lofi', name: 'Calm Lofi', icon: 'headset-outline' },
                { id: 'rain', name: 'Soothing Rain', icon: 'rainy-outline' },
                { id: 'sitar', name: 'Zen Flute', icon: 'musical-notes-outline' },
                { id: 'tapri', name: 'Cafe Sound', icon: 'cafe-outline' },
                { id: 'none', name: 'Silence', icon: 'volume-mute-outline' }
              ].map(item => (
                <TouchableOpacity 
                  key={item.id} 
                  style={[styles.soundSelectBtn, selectedFocusSound === item.id && styles.soundSelectBtnActive]}
                  onPress={() => setSelectedFocusSound(item.id)}
                  activeOpacity={0.8}
                >
                  <Ionicons 
                    name={item.icon} 
                    size={16} 
                    color={selectedFocusSound === item.id ? '#0F1115' : '#8B92A0'} 
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[styles.soundSelectBtnText, selectedFocusSound === item.id && styles.soundSelectBtnTextActive]}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalActionBtn, { backgroundColor: '#171B22', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }]} 
                onPress={() => setShowIntentionModal(false)}
              >
                <Text style={[styles.modalActionBtnText, { color: '#8B92A0' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalActionBtn, { backgroundColor: '#C2A878' }]} 
                onPress={handleCommitIntention}
              >
                <Text style={[styles.modalActionBtnText, { color: '#0F1115' }]}>Commit & Start</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Session Summary Card Modal */}
      <Modal
        visible={showSummaryModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowSummaryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { width: '90%' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Ionicons name="trophy-outline" size={22} color="#C2A878" />
              <Text style={styles.modalTitle}>Study Round Completed!</Text>
            </View>
            <Text style={styles.modalSubtitle}>Excellent work completing 25 minutes of deep focus.</Text>
            
            <View style={styles.summaryStatsBox}>
              <View style={styles.summaryStatItem}>
                <Text style={styles.summaryStatVal}>25m</Text>
                <Text style={styles.summaryStatLabel}>FOCUS TIME</Text>
              </View>
              <View style={styles.summaryStatItem}>
                <Text style={[styles.summaryStatVal, { color: '#C47070' }]}>{distractionsCount}</Text>
                <Text style={styles.summaryStatLabel}>DISTRACTIONS</Text>
              </View>
              <View style={styles.summaryStatItem}>
                <Text style={[styles.summaryStatVal, { color: '#7C9B7A' }]}>+20 XP</Text>
                <Text style={styles.summaryStatLabel}>BONUS GAINED</Text>
              </View>
            </View>

            <Text style={styles.label}>RATE YOUR SESSION FOCUS LEVEL</Text>
            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map(val => (
                <TouchableOpacity key={val} onPress={() => setStarRating(val)}>
                  <Ionicons 
                    name={val <= starRating ? "star" : "star-outline"} 
                    size={28} 
                    color="#C2A878" 
                    style={{ marginRight: 8 }}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>STUDY LOG NOTES (OPTIONAL)</Text>
            <TextInput
              style={styles.summaryInput}
              placeholder="Write a brief note on what you achieved..."
              placeholderTextColor="#5A6070"
              value={summaryNote}
              onChangeText={setSummaryNote}
              multiline
            />
            
            <TouchableOpacity style={styles.summarySaveBtn} onPress={saveSessionSummary}>
              <Text style={styles.summarySaveBtnText}>Complete & Start Break</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F1115' },
  fullScreenContainer: {
    backgroundColor: '#05070B',
    justifyContent: 'space-between',
    padding: 40
  },
  
  intentionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(194, 168, 120, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(194, 168, 120, 0.15)',
    padding: 16,
    borderRadius: 16,
    marginBottom: 20
  },
  intentionBannerTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10,
    color: '#C2A878',
    letterSpacing: 1,
    textTransform: 'uppercase'
  },
  intentionBannerText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: '#F3F1EC',
    marginTop: 4
  },

  statsCard: { 
    backgroundColor: 'rgba(75, 107, 251, 0.08)', 
    borderRadius: 16, 
    padding: 20, 
    marginBottom: 24, 
    borderWidth: 1, 
    borderColor: 'rgba(75, 107, 251, 0.2)' 
  },
  statsLabel: { fontFamily: 'PlusJakartaSans_700Bold', color: '#4B6BFB', fontSize: 11, letterSpacing: 1, marginBottom: 4 },
  statsVal: { fontFamily: 'PlusJakartaSans_600SemiBold', color: '#F3F1EC', fontSize: 14 },

  section: { marginBottom: 24 },
  sectionTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: '#5A6070', letterSpacing: 1, marginBottom: 12 },
  
  emptyTaskCard: { backgroundColor: '#171B22', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.03)' },
  emptyTaskText: { fontFamily: 'PlusJakartaSans_500Medium', color: '#8B92A0', fontSize: 13, textAlign: 'center' },

  taskPill: { backgroundColor: '#171B22', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  taskPillActive: { backgroundColor: '#C2A878', borderColor: '#C2A878' },
  taskPillText: { fontFamily: 'PlusJakartaSans_600SemiBold', color: '#F3F1EC', fontSize: 13 },

  timerCard: { 
    backgroundColor: '#171B22', 
    borderRadius: 24, 
    padding: 32, 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.03)',
    shadowColor: '#C2A878',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 3
  },
  modeToggle: { flexDirection: 'row', backgroundColor: '#0F1115', borderRadius: 12, padding: 4, marginBottom: 32 },
  modeBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8 },
  modeActive: { backgroundColor: '#1D2430' },
  modeText: { color: '#8B92A0', fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13 },
  modeTextActive: { color: '#F3F1EC' },
  
  timerRing: {
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 2.5,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F1115',
    marginBottom: 32,
    shadowColor: '#C2A878',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 4
  },
  timeText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 48, color: '#F3F1EC', textAlign: 'center' },
  
  controls: { flexDirection: 'row', alignItems: 'center' },
  playBtn: { width: 80, height: 80, backgroundColor: '#C2A878', borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginRight: 24 },
  resetBtn: { width: 56, height: 56, backgroundColor: '#1D2430', borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  
  inlineActionBtn: {
    backgroundColor: 'rgba(196, 112, 112, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(196, 112, 112, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12
  },
  inlineActionBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    color: '#C47070'
  },

  // Sound Mixer styles
  mixerCard: {
    backgroundColor: '#171B22',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 20
  },
  mixerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    justifyContent: 'space-between'
  },
  mixerSoundName: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#F3F1EC',
    fontSize: 13
  },
  volumeController: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '60%',
    justifyContent: 'flex-end'
  },
  volBtn: {
    backgroundColor: '#1D2430',
    padding: 6,
    borderRadius: 6
  },
  sliderTrack: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 2,
    marginHorizontal: 10,
    overflow: 'hidden'
  },
  sliderFill: {
    height: '100%',
    backgroundColor: '#C2A878'
  },
  volPct: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#8B92A0',
    fontSize: 11,
    width: 32,
    textAlign: 'right'
  },

  // Lock View styles
  fullScreenIntention: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 18,
    color: '#8B92A0',
    textAlign: 'center',
    marginBottom: 24
  },
  fullScreenTimer: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 80,
    color: '#F3F1EC',
    marginBottom: 40,
    textAlign: 'center',
    width: '100%'
  },
  fullScreenDistractionBtn: {
    backgroundColor: 'rgba(196, 112, 112, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(196, 112, 112, 0.2)',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14
  },
  fullScreenDistractionBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#C47070',
    fontSize: 14
  },
  exitBtn: {
    backgroundColor: '#1D2430',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center'
  },
  exitBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#F3F1EC',
    fontSize: 14
  },

  // Modal styles
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

  // Summary stats
  summaryStatsBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#0F1115',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
    marginBottom: 20
  },
  summaryStatItem: { alignItems: 'center', flex: 1 },
  summaryStatVal: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: '#C2A878', marginBottom: 2 },
  summaryStatLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 8, color: '#5A6070' },
  
  label: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10, color: '#5A6070', letterSpacing: 1, marginBottom: 8, marginTop: 12 },
  starRow: { flexDirection: 'row', marginBottom: 16 },
  summaryInput: {
    backgroundColor: '#0F1115',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
    color: '#F3F1EC',
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    height: 80,
    textAlignVertical: 'top',
    marginBottom: 20
  },
  summarySaveBtn: {
    backgroundColor: '#C2A878',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center'
  },
  summarySaveBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F1115',
    fontSize: 15
  },
  targetIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(194, 168, 120, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(194, 168, 120, 0.15)',
    marginRight: 16
  },
  modalSubLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10,
    color: '#5A6070',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 8
  },
  soundSelectorContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20
  },
  soundSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F1115',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12
  },
  soundSelectBtnActive: {
    backgroundColor: '#C2A878',
    borderColor: '#C2A878'
  },
  soundSelectBtnText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#8B92A0',
    fontSize: 12
  },
  soundSelectBtnTextActive: {
    color: '#0F1115'
  }
});
