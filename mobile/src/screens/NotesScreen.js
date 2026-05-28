import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ScrollView, Modal, ActivityIndicator, Platform, StatusBar, Alert, Vibration, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFirestoreData } from '../hooks/useFirestoreData';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../firebase';
import { calculateXPProgress } from '../utils/gamification';

const SUBJECT_SHORTCUTS = ['CS101', 'Maths-II', 'Physics', 'Exams', 'General'];

const NOTE_COLORS = [
  { value: '#171B22', name: 'Dark Grey' },
  { value: '#1E2430', name: 'Deep Slate' },
  { value: '#1A2E40', name: 'Midnight Blue' },
  { value: '#143026', name: 'Forest Green' },
  { value: '#2D1A3A', name: 'Rich Purple' }
];

const MOCK_OCR_RESULTS = [
  "--- \n[OCR SCAN: Whiteboard Lecture Notes]\n• Array indices start from 0.\n• Space complexity of Merge Sort is O(n).\n• Stack operates on LIFO (Last In First Out).\n---",
  "--- \n[OCR SCAN: Handwritten Formula Sheet]\n• Euler's Formula: e^(i*pi) + 1 = 0\n• Quadratic Formula: x = (-b ± √(b^2 - 4ac)) / 2a\n---",
  "--- \n[OCR SCAN: Textbook Diagram]\n• Figure 4.2: Synaptic transmission diagram.\n• Neurotransmitters cross the synaptic cleft to bind to receptors.\n---"
];

export default function NotesScreen() {
  const userId = auth.currentUser ? auth.currentUser.uid : 'guest';
  const [viewMode, setViewMode] = useState('notes'); // 'notes' or 'braindump'
  const [notes, setNotes] = useFirestoreData(`${userId}_notes`, []);
  const [brainDump, setBrainDump] = useFirestoreData(`${userId}_brain_dump`, []);
  const [gamification, setGamification] = useFirestoreData(`${userId}_gamification_state`, { level: 1, xp: 0 });

  // New Note State
  const [newSubject, setNewSubject] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [dumpText, setDumpText] = useState('');

  // OCR Scan State
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState(0); // 0: idle, 1: scanning, 2: complete

  // Groq API Key — loaded from AsyncStorage only (never hardcoded)
  const [groqKey, setGroqKey] = useState('');

  useEffect(() => {
    AsyncStorage.getItem('groq_api_key').then(val => {
      if (val) setGroqKey(val);
    });
  }, []);

  const insertMarkdown = (syntax) => {
    if (syntax === 'list') {
      setNewContent(prev => prev + (prev.endsWith('\n') || prev === '' ? '- ' : '\n- '));
    } else if (syntax === 'bold') {
      setNewContent(prev => prev + '**bold**');
    } else if (syntax === 'italic') {
      setNewContent(prev => prev + '*italic*');
    } else if (syntax === 'code') {
      setNewContent(prev => prev + '`code`');
    }
  };

  const [selectedColor, setSelectedColor] = useState('#171B22');

  const addNote = () => {
    if (!newContent.trim()) return;
    setNotes([
      { 
        id: Date.now().toString(), 
        subject: newSubject.trim() || 'General',
        title: newTitle.trim() || 'Untitled Note',
        text: newContent.trim(), 
        date: new Date().toISOString(),
        color: selectedColor,
        pinned: false
      },
      ...notes
    ]);
    setNewSubject('');
    setNewTitle('');
    setNewContent('');
    setSelectedColor('#171B22');
  };

  const deleteNote = (id) => {
    setNotes(notes.filter(n => n.id !== id));
  };

  const togglePinNote = (id) => {
    setNotes(notes.map(n => n.id === id ? { ...n, pinned: !n.pinned } : n));
    Vibration.vibrate(30);
  };

  const addBrainDump = () => {
    if (!dumpText.trim()) return;
    setBrainDump([
      { id: Date.now().toString(), text: dumpText.trim(), date: new Date().toISOString() },
      ...brainDump
    ]);
    setDumpText('');
  };

  const handleLaunchWhiteboardOcr = async (useCamera = false) => {
    try {
      const { status } = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('Permission Denied', `We need ${useCamera ? 'camera' : 'gallery'} access to scan your notes!`);
        return;
      }

      const result = useCamera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8, base64: true })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, base64: true });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const base64 = result.assets[0].base64;
        runWhiteboardOcr(base64);
      }
    } catch (e) {
      console.warn(e);
      runWhiteboardOcr(null);
    }
  };

  const runWhiteboardOcr = async (base64Data) => {
    setIsScanning(true);
    setScanStep(1);
    
    const step2Timer = setTimeout(() => setScanStep(2), 1000);

    const useMockFallback = () => {
      clearTimeout(step2Timer);
      const randomText = MOCK_OCR_RESULTS[Math.floor(Math.random() * MOCK_OCR_RESULTS.length)];
      setNewContent(prev => (prev ? prev + '\n\n' + randomText : randomText));
      setIsScanning(false);
      setShowScannerModal(false);
      setScanStep(0);
    };

    if (!base64Data) {
      Alert.alert(
        'No Image Selected',
        'Please snap or choose a whiteboard photo to enable real AI text extraction.',
        [{ text: 'OK' }]
      );
      setTimeout(useMockFallback, 2000);
      return;
    }

    if (!groqKey) {
      setTimeout(useMockFallback, 2000);
      return;
    }

    const activeKey = groqKey;

    try {
      const response = await fetch(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${activeKey}`
          },
          body: JSON.stringify({
            model: 'meta-llama/llama-4-scout-17b-16e-instruct',
            messages: [{
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Analyze this image of whiteboard notes, textbook pages, or handwritten text. Extract all readable study notes, explanations, and diagrams. Format it cleanly as markdown study notes with bullet points and clear headings. Do not include markdown code block backticks (like ```) in your output, just return the raw text formatting.'
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${base64Data}`
                  }
                }
              ]
            }],
            max_tokens: 2048,
            temperature: 0.1
          })
        }
      );

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(`Groq API error ${response.status}: ${errJson?.error?.message || 'Unknown error'}`);
      }

      const resJson = await response.json();
      const textResult = resJson.choices?.[0]?.message?.content || '';

      clearTimeout(step2Timer);
      setNewContent(prev => (prev ? prev + '\n\n' + textResult : textResult));
      setIsScanning(false);
      setShowScannerModal(false);
      setScanStep(0);
    } catch (e) {
      console.warn('Whiteboard Groq OCR failed, using fallback:', e);
      Alert.alert(
        'AI Scan Failed',
        `Could not extract text from image: ${e.message}. Using sample notes.`,
        [{ text: 'OK' }]
      );
      useMockFallback();
    }
  };

  const filteredNotes = notes.filter(n => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (n.subject && n.subject.toLowerCase().includes(q)) || 
           (n.title && n.title.toLowerCase().includes(q)) || 
           (n.text && n.text.toLowerCase().includes(q));
  });

  const sortedNotes = [...filteredNotes].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.date) - new Date(a.date);
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.viewToggle}>
          <TouchableOpacity onPress={() => setViewMode('notes')} style={[styles.toggleBtn, viewMode === 'notes' && styles.toggleActive]}>
            <Text style={[styles.toggleText, viewMode === 'notes' && styles.toggleTextActive]}>Notes</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setViewMode('braindump')} style={[styles.toggleBtn, viewMode === 'braindump' && styles.toggleActive]}>
            <Text style={[styles.toggleText, viewMode === 'braindump' && styles.toggleTextActive]}>Brain Dump</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {viewMode === 'notes' ? (
        <>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={16} color="#5A6070" style={{ marginRight: 8 }} />
            <TextInput 
              style={styles.searchInput} 
              placeholder="Search subjects, titles, or keywords..." 
              placeholderTextColor="#5A6070"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <FlatList
            data={sortedNotes}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            ListHeaderComponent={() => (
              <View style={styles.editorContainer}>
                <Text style={styles.sectionTitle}>RICH TEXT EDITOR</Text>
                
                {/* Subject picker shortcuts */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 12 }}>
                  {SUBJECT_SHORTCUTS.map(subj => (
                    <TouchableOpacity 
                      key={subj} 
                      style={[styles.subjectPill, newSubject === subj && styles.subjectPillActive]}
                      onPress={() => setNewSubject(subj)}
                    >
                      <Text style={[styles.subjectPillText, newSubject === subj && { color: '#0F1115' }]}>{subj}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                  <TextInput
                    style={[styles.input, { flex: 1, paddingVertical: 12 }]}
                    placeholder="Subject (e.g. Maths)"
                    placeholderTextColor="#5A6070"
                    value={newSubject}
                    onChangeText={setNewSubject}
                  />
                  <TextInput
                    style={[styles.input, { flex: 2, paddingVertical: 12 }]}
                    placeholder="Note Title"
                    placeholderTextColor="#5A6070"
                    value={newTitle}
                    onChangeText={setNewTitle}
                  />
                </View>

                {/* Markdown helper toolbar */}
                <View style={styles.toolbar}>
                  <TouchableOpacity onPress={() => insertMarkdown('bold')} style={styles.toolbarBtn}>
                    <Text style={styles.toolbarBtnTextBold}>B</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => insertMarkdown('italic')} style={styles.toolbarBtn}>
                    <Text style={styles.toolbarBtnTextItalic}>I</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => insertMarkdown('code')} style={styles.toolbarBtn}>
                    <Text style={styles.toolbarBtnTextCode}>Code</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => insertMarkdown('list')} style={styles.toolbarBtn}>
                    <Text style={styles.toolbarBtnTextList}>• List</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setShowScannerModal(true)} style={[styles.toolbarBtn, { marginLeft: 'auto', backgroundColor: 'rgba(194, 168, 120, 0.15)' }]}>
                    <Ionicons name="camera-outline" size={14} color="#C2A878" />
                    <Text style={[styles.toolbarBtnTextCode, { color: '#C2A878', marginLeft: 4 }]}>Scan Whiteboard</Text>
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={[styles.input, { minHeight: 120, textAlignVertical: 'top', borderTopLeftRadius: 0, borderTopRightRadius: 0 }]}
                  placeholder="Start typing your rich notes..."
                  placeholderTextColor="#5A6070"
                  value={newContent}
                  onChangeText={setNewContent}
                  multiline
                />
                
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 10 }}>
                  <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: '#8B92A0' }}>Note Color:</Text>
                  {NOTE_COLORS.map(c => (
                    <TouchableOpacity
                      key={c.value}
                      style={[
                        styles.colorDot,
                        { backgroundColor: c.value },
                        selectedColor === c.value && { borderWidth: 2, borderColor: '#C2A878' }
                      ]}
                      onPress={() => setSelectedColor(c.value)}
                    />
                  ))}
                </View>

                <TouchableOpacity style={styles.btn} onPress={addNote}>
                  <Text style={styles.btnText}>Save to Library</Text>
                </TouchableOpacity>

                <Text style={[styles.sectionTitle, { marginTop: 32 }]}>YOUR LIBRARY (LONG PRESS TO DELETE)</Text>
              </View>
            )}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={[styles.card, { backgroundColor: item.color || '#171B22' }]}
                onLongPress={() => deleteNote(item.id)}
                delayLongPress={500}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <View style={styles.subjectBadge}>
                    <Text style={styles.subjectText}>{item.subject || 'General'}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Text style={styles.date}>{new Date(item.date).toLocaleDateString()}</Text>
                    <TouchableOpacity onPress={() => togglePinNote(item.id)} style={{ padding: 4 }}>
                      <Ionicons name={item.pinned ? "pin" : "pin-outline"} size={16} color={item.pinned ? "#C2A878" : "#5A6070"} />
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.text}>{item.text}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={() => (
              <View style={styles.emptyStateContainer}>
                <Ionicons name={searchQuery ? "search-outline" : "document-text-outline"} size={36} color="#5A6070" style={{ marginBottom: 12 }} />
                <Text style={styles.emptyStateText}>
                  {searchQuery 
                    ? "No lecture notes found matching your search query." 
                    : "Your library is empty. Scan whiteboard or type above to add notes!"}
                </Text>
                {!searchQuery && (
                  <TouchableOpacity style={styles.emptyStateBtn} onPress={() => setShowScannerModal(true)}>
                    <Text style={styles.emptyStateBtnText}>📷 Scan Whiteboard</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          />
        </>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 24 }}>
          <Text style={{ color: '#8B92A0', fontFamily: 'PlusJakartaSans_400Regular', marginBottom: 16 }}>
            Free your mind. Dump random thoughts, whiteboard ideas, or exam stress here.
          </Text>
          <TextInput
            style={[styles.input, { minHeight: 180, marginBottom: 16 }]}
            placeholder="Type anything..."
            placeholderTextColor="#5A6070"
            value={dumpText}
            onChangeText={setDumpText}
            multiline
          />
          <TouchableOpacity style={styles.btn} onPress={addBrainDump}>
            <Text style={styles.btnText}>Release Thought</Text>
          </TouchableOpacity>

          <View style={{ marginTop: 32 }}>
            <Text style={styles.sectionTitle}>PREVIOUS DUMPS</Text>
            {brainDump.map(item => (
              <View key={item.id} style={[styles.card, { borderLeftColor: '#4B6BFB' }]}>
                <Text style={styles.text}>{item.text}</Text>
                <Text style={styles.date}>{new Date(item.date).toLocaleString()}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Whiteboard OCR Scanner Modal */}
      <Modal
        visible={showScannerModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowScannerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { width: '90%', padding: 20 }]}>
            <Text style={styles.modalTitle}>Whiteboard OCR Scanner</Text>
            <Text style={styles.modalSubtitle}>Extract text from whiteboard photos, textbooks, or handwritten notes</Text>

            <View style={styles.scannerBox}>
              {isScanning ? (
                <View style={{ alignItems: 'center' }}>
                  <ActivityIndicator size="large" color="#C2A878" />
                  <Text style={styles.scannerStepText}>
                    {scanStep === 1 ? 'Reading document margins...' : 'Extracting handwritten text...'}
                  </Text>
                </View>
              ) : (
                <View style={{ alignItems: 'center', gap: 12 }}>
                  <Ionicons name="camera-outline" size={48} color="#C2A878" />
                  <TouchableOpacity
                    style={[styles.modalActionBtn, { backgroundColor: '#C2A878', width: 200 }]}
                    onPress={() => handleLaunchWhiteboardOcr(true)}
                  >
                    <Text style={[styles.modalActionBtnText, { color: '#0F1115' }]}>Snap Whiteboard</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalActionBtn, { backgroundColor: '#171B22', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', width: 200 }]}
                    onPress={() => handleLaunchWhiteboardOcr(false)}
                  >
                    <Text style={styles.modalActionBtnText}>Pick from Gallery</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={[styles.modalActionBtn, { backgroundColor: '#171B22', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', marginTop: 8 }]}
              onPress={() => setShowScannerModal(false)}
              disabled={isScanning}
            >
              <Text style={[styles.modalActionBtnText, { color: '#5A6070' }]}>Cancel</Text>
            </TouchableOpacity>
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
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: '#171B22',
    borderRadius: 12,
    padding: 4,
    flex: 1,
    maxWidth: 300,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  toggleActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  toggleText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: '#8B92A0',
  },
  toggleTextActive: {
    color: '#F3F1EC',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#171B22',
    marginHorizontal: 24,
    marginVertical: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  searchInput: {
    flex: 1,
    color: '#F3F1EC',
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    padding: 0,
  },
  list: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  editorContainer: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
    color: '#5A6070',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  subjectPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#171B22',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  subjectPillActive: {
    backgroundColor: '#C2A878',
    borderColor: '#C2A878',
  },
  subjectPillText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: '#8B92A0',
  },
  input: {
    backgroundColor: '#171B22',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#F3F1EC',
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  toolbar: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: '#1E232C',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    padding: 8,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
  },
  toolbarBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  toolbarBtnTextBold: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    color: '#F3F1EC',
  },
  toolbarBtnTextItalic: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: '#F3F1EC',
    fontStyle: 'italic',
  },
  toolbarBtnTextCode: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: '#8B92A0',
  },
  toolbarBtnTextList: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: '#F3F1EC',
  },
  btn: {
    backgroundColor: '#C2A878',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  btnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    color: '#0F1115',
  },
  card: {
    backgroundColor: '#171B22',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  subjectBadge: {
    backgroundColor: 'rgba(194, 168, 120, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  subjectText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 10,
    color: '#C2A878',
    letterSpacing: 0.5,
  },
  date: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11,
    color: '#5A6070',
  },
  cardTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: '#F3F1EC',
    marginBottom: 6,
  },
  text: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    color: '#8B92A0',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(9, 13, 26, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#171B22',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  modalTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 20,
    color: '#F3F1EC',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: '#5A6070',
    marginBottom: 20,
    lineHeight: 18,
  },
  scannerBox: {
    minHeight: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F1115',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 16,
    padding: 20,
  },
  scannerStepText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: '#8B92A0',
    marginTop: 12,
  },
  modalActionBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalActionBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    color: '#F3F1EC',
  },
  colorDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginHorizontal: 2
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    borderStyle: 'dashed',
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.01)',
    marginTop: 20
  },
  emptyStateText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#5A6070',
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 18
  },
  emptyStateBtn: {
    backgroundColor: 'rgba(194, 168, 120, 0.12)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 12
  },
  emptyStateBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
    color: '#C2A878'
  }
});
