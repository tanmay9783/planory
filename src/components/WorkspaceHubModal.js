import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { auth } from '../firebase';

export default function WorkspaceHubModal({ visible, onClose }) {
  const navigation = useNavigation();
  const emailPrefix = auth.currentUser?.email ? auth.currentUser.email.split('@')[0] : 'Student';

  const handleNavigate = (screenName) => {
    onClose();
    navigation.navigate(screenName);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTitleContainer}>
            <Ionicons name="flash" size={24} color="#F3F1EC" />
            <Text style={styles.headerTitle}>{emailPrefix}'s Hub</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color="#8B92A0" />
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>Select a productivity module to expand</Text>

        <ScrollView contentContainerStyle={styles.list}>
          {/* Notes */}
          <TouchableOpacity style={styles.card} onPress={() => handleNavigate('NotesWorkspace')} activeOpacity={0.8}>
            <View style={styles.cardHeader}>
              <Ionicons name="document-text" size={28} color="#C2A878" />
              <View style={styles.badge}><Text style={styles.badgeText}>Rich Notes</Text></View>
            </View>
            <Text style={styles.cardTitle}>Subject Notes & Text Editor</Text>
            <Text style={styles.cardDesc}>Access your full library of day-linked rich lecture drafts, past versions, templates, and full text search keywords.</Text>
          </TouchableOpacity>

          {/* Hydration */}
          <TouchableOpacity style={styles.card} onPress={() => handleNavigate('HydrationWorkspace')} activeOpacity={0.8}>
            <View style={styles.cardHeader}>
              <Ionicons name="water" size={28} color="#7B93B0" />
              <View style={[styles.badge, { backgroundColor: 'rgba(123, 147, 176, 0.15)' }]}><Text style={[styles.badgeText, { color: '#7B93B0' }]}>Water Log</Text></View>
            </View>
            <Text style={styles.cardTitle}>Water Hydration Workspace</Text>
            <Text style={styles.cardDesc}>Log preset beverages (glasses, bottles, diuretic tea coffee), check weekly SVG statistics and study alerts.</Text>
          </TouchableOpacity>

          {/* Budget */}
          <TouchableOpacity style={styles.card} onPress={() => handleNavigate('BudgetWorkspace')} activeOpacity={0.8}>
            <View style={styles.cardHeader}>
              <Ionicons name="cash" size={28} color="#7C9B7A" />
              <View style={[styles.badge, { backgroundColor: 'rgba(124, 155, 122, 0.15)' }]}><Text style={[styles.badgeText, { color: '#7C9B7A' }]}>Student Budget</Text></View>
            </View>
            <Text style={styles.cardTitle}>Expense Tracker & Savings goals</Text>
            <Text style={styles.cardDesc}>Log daily expenses, calculate budget warning limits, check savings goal progress and dynamic EOM advice.</Text>
          </TouchableOpacity>

          {/* Focus */}
          <TouchableOpacity style={styles.card} onPress={() => handleNavigate('FocusWorkspace')} activeOpacity={0.8}>
            <View style={styles.cardHeader}>
              <Ionicons name="timer" size={28} color="#C47070" />
              <View style={[styles.badge, { backgroundColor: 'rgba(196, 112, 112, 0.15)' }]}><Text style={[styles.badgeText, { color: '#C47070' }]}>Pomodoro Focus</Text></View>
            </View>
            <Text style={styles.cardTitle}>Pomodoro Focus Timer</Text>
            <Text style={styles.cardDesc}>Start focus interval rounds, auto-track productivity, and assign active timetable tasks to countdown timers.</Text>
          </TouchableOpacity>

          {/* Profile */}
          <TouchableOpacity style={styles.card} onPress={() => handleNavigate('ProfileWorkspace')} activeOpacity={0.8}>
            <View style={styles.cardHeader}>
              <Ionicons name="person" size={28} color="#C2A878" />
              <View style={[styles.badge, { backgroundColor: 'rgba(194, 168, 120, 0.15)' }]}><Text style={[styles.badgeText, { color: '#C2A878' }]}>Edit Profile</Text></View>
            </View>
            <Text style={styles.cardTitle}>Student Profile & Customization</Text>
            <Text style={styles.cardDesc}>Change your display name, edit focus bio, customize goals, and sign out of your student workspace securely.</Text>
          </TouchableOpacity>

          {/* Notifications */}
          <TouchableOpacity style={styles.card} onPress={() => handleNavigate('NotificationCenterWorkspace')} activeOpacity={0.8}>
            <View style={styles.cardHeader}>
              <Ionicons name="notifications" size={28} color="#4B6BFB" />
              <View style={[styles.badge, { backgroundColor: 'rgba(75, 107, 251, 0.15)' }]}><Text style={[styles.badgeText, { color: '#4B6BFB' }]}>Quiet Hours</Text></View>
            </View>
            <Text style={styles.cardTitle}>Notification Center</Text>
            <Text style={styles.cardDesc}>Configure study quiet hours, customize reminder alerts, and set study tones.</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#171B22' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, paddingBottom: 8 },
  headerTitleContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 24, color: '#F3F1EC' },
  closeBtn: { padding: 4 },
  subtitle: { fontFamily: 'PlusJakartaSans_500Medium', color: '#8B92A0', fontSize: 14, paddingHorizontal: 24, paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  
  list: { padding: 24, gap: 16 },
  card: { backgroundColor: '#1D2430', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.03)' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  emoji: { fontSize: 24 },
  badge: { backgroundColor: 'rgba(194, 168, 120, 0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 10, color: '#C2A878' },
  cardTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: '#F3F1EC', marginBottom: 8 },
  cardDesc: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: '#8B92A0', lineHeight: 20 }
});
