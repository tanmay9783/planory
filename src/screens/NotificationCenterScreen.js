import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  SafeAreaView, 
  ScrollView, 
  Switch, 
  Animated, 
  Platform, 
  StatusBar,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFirestoreData } from '../hooks/useFirestoreData';
import { auth } from '../firebase';
import { 
  requestNotificationPermission, 
  scheduleWaterReminders, 
  scheduleHabitNudges, 
  scheduleFocusReminders, 
  cancelReminders 
} from '../utils/notifications';

const NOTIFICATION_STYLES = [
  { id: 'gentle', name: 'Gentle & Soft', preview: 'Hey buddy, it is time to study! Grab a tea and open CS101.' },
  { id: 'firm', name: 'Firm & Strict', preview: 'Get to your desk! Your study slot is starting. No excuses.' },
  { id: 'funny', name: 'Funny & Desi', preview: 'Chai thandi ho rahi hai aur syllabus abhi bhi garam hai. Padhan baith!' },
  { id: 'challenge', name: 'Challenge Mode', preview: 'Bet you cannot finish 2 focus rounds in a row today. Ready to prove me wrong?' }
];

export default function NotificationCenterScreen() {
  const userId = auth.currentUser ? auth.currentUser.uid : 'guest';
  
  const [settings, setSettings] = useFirestoreData(`${userId}_notification_settings`, {
    waterReminders: true,
    taskDeadlines: true,
    habitNudges: true,
    focusReminders: true,
    quietHoursEnabled: false,
    quietStart: '22:00',
    quietEnd: '07:00',
    style: 'gentle'
  });

  const [previewText, setPreviewText] = useState(NOTIFICATION_STYLES[0].preview);

  // Entrance animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

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

  useEffect(() => {
    const activeStyle = NOTIFICATION_STYLES.find(s => s.id === settings.style);
    if (activeStyle) {
      setPreviewText(activeStyle.preview);
    }
  }, [settings.style]);

  const toggleSetting = async (key) => {
    const newVal = !settings[key];
    const newSettings = {
      ...settings,
      [key]: newVal
    };

    if (newVal && ['waterReminders', 'habitNudges', 'focusReminders'].includes(key)) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert('Permission Required', 'Please enable notifications in your device Settings to receive study alerts.');
        return;
      }
    }

    try {
      if (key === 'waterReminders') {
        if (newVal) await scheduleWaterReminders();
        else await cancelReminders('water');
      } else if (key === 'habitNudges') {
        if (newVal) await scheduleHabitNudges();
        else await cancelReminders('habits');
      } else if (key === 'focusReminders') {
        if (newVal) await scheduleFocusReminders();
        else await cancelReminders('focus');
      }
    } catch (err) {
      console.warn("Scheduler error:", err);
    }

    setSettings(newSettings);
  };

  const setStyle = (styleId) => {
    setSettings({
      ...settings,
      style: styleId
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        <ScrollView contentContainerStyle={styles.scroll}>
          
          <Text style={styles.sectionTitle}>Reminders & Alerts</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Ionicons name="water-outline" size={20} color="#7B93B0" style={styles.icon} />
                <View>
                  <Text style={styles.rowTitle}>Water Alerts</Text>
                  <Text style={styles.rowDesc}>Reminders to stay hydrated hourly</Text>
                </View>
              </View>
              <Switch 
                value={settings.waterReminders} 
                onValueChange={() => toggleSetting('waterReminders')}
                trackColor={{ false: '#0F1115', true: 'rgba(194, 168, 120, 0.4)' }}
                thumbColor={settings.waterReminders ? '#C2A878' : '#8B92A0'}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Ionicons name="alarm-outline" size={20} color="#C47070" style={styles.icon} />
                <View>
                  <Text style={styles.rowTitle}>Task Deadlines</Text>
                  <Text style={styles.rowDesc}>Alerts before tasks & exams are due</Text>
                </View>
              </View>
              <Switch 
                value={settings.taskDeadlines} 
                onValueChange={() => toggleSetting('taskDeadlines')}
                trackColor={{ false: '#0F1115', true: 'rgba(194, 168, 120, 0.4)' }}
                thumbColor={settings.taskDeadlines ? '#C2A878' : '#8B92A0'}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Ionicons name="checkmark-circle-outline" size={20} color="#7C9B7A" style={styles.icon} />
                <View>
                  <Text style={styles.rowTitle}>Habit Nudges</Text>
                  <Text style={styles.rowDesc}>Gentle taps to complete daily habits</Text>
                </View>
              </View>
              <Switch 
                value={settings.habitNudges} 
                onValueChange={() => toggleSetting('habitNudges')}
                trackColor={{ false: '#0F1115', true: 'rgba(194, 168, 120, 0.4)' }}
                thumbColor={settings.habitNudges ? '#C2A878' : '#8B92A0'}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Ionicons name="timer-outline" size={20} color="#C2A878" style={styles.icon} />
                <View>
                  <Text style={styles.rowTitle}>Focus Nudges</Text>
                  <Text style={styles.rowDesc}>Nudges when study target starts</Text>
                </View>
              </View>
              <Switch 
                value={settings.focusReminders} 
                onValueChange={() => toggleSetting('focusReminders')}
                trackColor={{ false: '#0F1115', true: 'rgba(194, 168, 120, 0.4)' }}
                thumbColor={settings.focusReminders ? '#C2A878' : '#8B92A0'}
              />
            </View>
          </View>

          <Text style={styles.sectionTitle}>Quite Study Hours</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Ionicons name="moon-outline" size={20} color="#4B6BFB" style={styles.icon} />
                <View>
                  <Text style={styles.rowTitle}>Mute Workspace Alarms</Text>
                  <Text style={styles.rowDesc}>Automatically silent all reminders</Text>
                </View>
              </View>
              <Switch 
                value={settings.quietHoursEnabled} 
                onValueChange={() => toggleSetting('quietHoursEnabled')}
                trackColor={{ false: '#0F1115', true: 'rgba(194, 168, 120, 0.4)' }}
                thumbColor={settings.quietHoursEnabled ? '#C2A878' : '#8B92A0'}
              />
            </View>
            
            {settings.quietHoursEnabled && (
              <View style={styles.quietHoursSelection}>
                <View style={styles.timePickerRow}>
                  <Text style={styles.timeLabel}>Start time:</Text>
                  <TouchableOpacity style={styles.timeBtn}>
                    <Text style={styles.timeBtnText}>{settings.quietStart}</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.timePickerRow}>
                  <Text style={styles.timeLabel}>End time:</Text>
                  <TouchableOpacity style={styles.timeBtn}>
                    <Text style={styles.timeBtnText}>{settings.quietEnd}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          <Text style={styles.sectionTitle}>Nudge Style & Tone</Text>
          <View style={styles.styleSelector}>
            {NOTIFICATION_STYLES.map(style => (
              <TouchableOpacity 
                key={style.id}
                style={[styles.styleBtn, settings.style === style.id && styles.styleBtnActive]}
                onPress={() => setStyle(style.id)}
              >
                <Text style={[styles.styleBtnText, settings.style === style.id && styles.styleBtnTextActive]}>
                  {style.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.previewCard}>
            <Text style={styles.previewLabel}>LIVE NUDGE PREVIEW</Text>
            <View style={styles.nudgeBubble}>
              <Ionicons name="chatbubble-ellipses" size={22} color="#C2A878" style={{ marginRight: 12 }} />
              <Text style={styles.nudgeText}>"{previewText}"</Text>
            </View>
          </View>

        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F1115' },
  scroll: { padding: 24, paddingBottom: 60 },
  sectionTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: '#5A6070', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12, marginTop: 12 },
  card: { backgroundColor: '#171B22', borderRadius: 20, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.03)' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  icon: { marginRight: 16 },
  rowTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: '#F3F1EC' },
  rowDesc: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: '#8B92A0', marginTop: 2 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.03)', marginVertical: 4 },
  
  quietHoursSelection: {
    marginTop: 16,
    backgroundColor: '#0F1115',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)'
  },
  timePickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  timeLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: '#8B92A0'
  },
  timeBtn: {
    backgroundColor: '#171B22',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6
  },
  timeBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#C2A878',
    fontSize: 13
  },

  styleSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24
  },
  styleBtn: {
    backgroundColor: '#171B22',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)'
  },
  styleBtnActive: {
    backgroundColor: '#C2A878',
    borderColor: '#C2A878'
  },
  styleBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#8B92A0',
    fontSize: 12
  },
  styleBtnTextActive: {
    color: '#0F1115'
  },

  previewCard: {
    backgroundColor: 'rgba(194, 168, 120, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(194, 168, 120, 0.12)',
    borderRadius: 20,
    padding: 20,
    marginTop: 8
  },
  previewLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10,
    color: '#C2A878',
    letterSpacing: 1.5,
    marginBottom: 12
  },
  nudgeBubble: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  nudgeText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: '#F3F1EC',
    flex: 1,
    lineHeight: 18,
    fontStyle: 'italic'
  }
});
