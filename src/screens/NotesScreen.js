import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, TextInput, ScrollView, Modal, ActivityIndicator, Platform, StatusBar } from 'react-native';
import { useFirestoreData } from '../hooks/useFirestoreData';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../firebase';

const SUBJECT_SHORTCUTS = ['CS101', 'Maths-II', 'Physics', 'Exams', 'General'];

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
  
  // New Note State
  const [newSubject, setNewSubject] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [dumpText, setDumpText] = useState('');

  // OCR Scan Simulator State
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState(0); // 0: idle, 1: scanning, 2: complete

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

  const addNote = () => {
    if (!newContent.trim()) return;
    setNotes([
      { 
        id: Date.now().toString(), 
        subject: newSubject.trim() || 'General',
        title: newTitle.trim() || 'Untitled Note',
        text: newContent.trim(), 
        date: new Date().toISOString() 
      },
      ...notes
    ]);
    setNewSubject('');
    setNewTitle('');
    setNewContent('');
  };

  const deleteNote = (id) => {
    setNotes(notes.filter(n => n.id !== id));
  };

  const addBrainDump = () => {
    if (!dumpText.trim()) return;
    setBrainDump([
      { id: Date.now().toString(), text: dumpText.trim(), date: new Date().toISOString() },
      ...brainDump
    ]);
    setDumpText('');
  };

  // OCR simulation process
  const startOcrScan = () => {
    setIsScanning(true);
    setScanStep(1);
    
    // Simulate scanner animation steps
    setTimeout(() => {
      setScanStep(2); // extraction
    }, 1500);

    setTimeout(() => {
      const randomText = MOCK_OCR_RESULTS[Math.floor(Math.random() * MOCK_OCR_RESULTS.length)];
      setNewContent(prev => (prev ? prev + '\n\n' + randomText : randomText));
      setIsScanning(false);
      setShowScannerModal(false);
      setScanStep(0);
    }, 3000);
  };

  const filteredNotes = notes.filter(n => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (n.subject && n.subject.toLowerCase().includes(q)) || 
           (n.title && n.title.toLowerCase().includes(q)) || 
           (n.text && n.text.toLowerCase().includes(q));
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.viewToggle}>
          <TouchableOpacity onPress={() => setViewMode('notes')} style={[styles.toggleBtn, viewMode === 'notes' && styles.toggleActive]}>
            <Text style={[styles.toggleText, viewMode === 'notes' && styles.toggleTextActive]}>Subject Notes</Text>
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
            data={filteredNotes}
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
                
                <TouchableOpacity style={styles.btn} onPress={addNote}>
                  <Text style={styles.btnText}>Save to Library</Text>
                </TouchableOpacity>

                <Text style={[styles.sectionTitle, { marginTop: 32 }]}>YOUR LIBRARY (LONG PRESS TO DELETE)</Text>
              </View>
            )}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.card}
                onLongPress={() => deleteNote(item.id)}
                delayLongPress={500}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <View style={styles.subjectBadge}>
                    <Text style={styles.subjectText}>{item.subject || 'General'}</Text>
                  </View>
                  <Text style={styles.date}>{new Date(item.date).toLocaleDateString()}</Text>
                </View>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.text}>{item.text}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={() => (
              <Text style={{ color: '#8B92A0', textAlign: 'center', marginTop: 32, fontFamily: 'PlusJakartaSans_500Medium' }}>
                {searchQuery ? "No notes found matching your search." : "Your library is empty."}
              </Text>
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

      {/* OCR Scanner Simulator Modal */}
      <Modal
        visible={showScannerModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowScannerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { width: '90%', padding: 20 }]}>
            <Text style={styles.modalTitle}>Whiteboard OCR Scanner</Text>
            <Text style={styles.modalSubtitle}>Simulates extracting text from handwritten college notes</Text>
            
            <View style={styles.scannerBox}>
              {isScanning ? (
                <View style={{ alignItems: 'center' }}>
                  <ActivityIndicator size="large" color="#C2A878" />
                  <Text style={styles.scannerStepText}>
                    {scanStep === 1 ? 'Reading document margins...' : 'Extracting handwritten text...'}
                  </Text>
                  <View style={styles.scannerBar} />
                </View>
              ) : (
                <View style={{ alignItems: 'center' }}>
                  <Ionicons name="camera" size={48} color="#5A6070" />
                  <Text style={styles.scannerPromptText}>Position physical notes or whiteboard in frame</Text>
                </View>
              )}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalActionBtn, { backgroundColor: '#171B22', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }]} 
                onPress={() => setShowScannerModal(false)}
                disabled={isScanning}
              >
                <Text style={[styles.modalActionBtnText, { color: '#8B92A0' }]}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalActionBtn, { backgroundColor: '#C2A878' }]} 
                onPress={startOcrScan}
                disabled={isScanning}
              >
                <Text style={[styles.modalActionBtnText, { color: '#0F1115' }]}>
                  {isScanning ? 'Scanning...' : 'Simulate Scan'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F1115' },
  header: { paddingHorizontal: 24, paddingBottom: 16, paddingTop: 16 },
  
  viewToggle: { flexDirection: 'row', backgroundColor: '#171B22', borderRadius: 12, padding: 4 },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  toggleActive: { backgroundColor: '#1D2430' },
  toggleText: { color: '#8B92A0', fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13 },
  toggleTextActive: { color: '#F3F1EC' },

  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#171B22', marginHorizontal: 24, marginBottom: 16, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  searchInput: { flex: 1, paddingVertical: 12, color: '#F3F1EC', fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14 },

  editorContainer: { paddingBottom: 24 },
  sectionTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: '#5A6070', letterSpacing: 1, marginBottom: 12 },
  
  subjectPill: { backgroundColor: '#171B22', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  subjectPillActive: { backgroundColor: '#C2A878', borderColor: '#C2A878' },
  subjectPillText: { fontFamily: 'PlusJakartaSans_700Bold', color: '#8B92A0', fontSize: 11 },

  input: { backgroundColor: '#171B22', borderRadius: 12, padding: 16, color: '#F3F1EC', fontFamily: 'PlusJakartaSans_400Regular', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  btn: { backgroundColor: '#C2A878', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  btnText: { color: '#0F1115', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15 },
  
  list: { paddingHorizontal: 24, paddingBottom: 24 },
  card: { backgroundColor: '#1D2430', padding: 20, borderRadius: 16, marginBottom: 16, borderLeftWidth: 3, borderLeftColor: '#C2A878' },
  subjectBadge: { backgroundColor: 'rgba(194, 168, 120, 0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  subjectText: { color: '#C2A878', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10, textTransform: 'uppercase' },
  cardTitle: { fontFamily: 'PlusJakartaSans_700Bold', color: '#F3F1EC', fontSize: 18, marginBottom: 8 },
  text: { color: '#8B92A0', fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, lineHeight: 22 },
  date: { color: '#5A6070', fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium' },

  // Toolbar
  toolbar: { 
    flexDirection: 'row', 
    backgroundColor: '#171B22', 
    borderTopLeftRadius: 12, 
    borderTopRightRadius: 12, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.05)',
    borderBottomWidth: 0,
    padding: 8, 
    gap: 8, 
    marginTop: 12,
    alignItems: 'center'
  },
  toolbarBtn: { 
    backgroundColor: '#1D2430', 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 6, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.03)',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row'
  },
  toolbarBtnTextBold: { fontFamily: 'PlusJakartaSans_700Bold', color: '#8B92A0', fontSize: 13 },
  toolbarBtnTextItalic: { fontFamily: 'PlusJakartaSans_600SemiBold', color: '#8B92A0', fontSize: 13, fontStyle: 'italic' },
  toolbarBtnTextCode: { fontFamily: 'PlusJakartaSans_600SemiBold', color: '#8B92A0', fontSize: 12 },
  toolbarBtnTextList: { fontFamily: 'PlusJakartaSans_600SemiBold', color: '#8B92A0', fontSize: 12 },

  // Modal Scanner Styles
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
  
  scannerBox: {
    height: 180,
    backgroundColor: '#0F1115',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    overflow: 'hidden',
    position: 'relative'
  },
  scannerBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 50,
    height: 3,
    backgroundColor: '#C2A878',
    opacity: 0.7
  },
  scannerStepText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#C2A878',
    fontSize: 12,
    marginTop: 12
  },
  scannerPromptText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#5A6070',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12
  }
});
