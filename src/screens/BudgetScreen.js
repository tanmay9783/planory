import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Modal, Alert, Share, Linking, Platform, StatusBar, Animated } from 'react-native';
import { useFirestoreData } from '../hooks/useFirestoreData';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../firebase';

const BUDGET_PRESETS = [
  { name: 'Chai & Samosa', amount: 20, category: 'Food', icon: 'cafe-outline' },
  { name: 'Tapri Maggi', amount: 40, category: 'Food', icon: 'restaurant-outline' },
  { name: 'Xerox & Prints', amount: 15, category: 'Books', icon: 'document-outline' },
  { name: 'Auto/Metro', amount: 30, category: 'Transport', icon: 'car-outline' }
];

export default function BudgetScreen() {
  const userId = auth.currentUser ? auth.currentUser.uid : 'guest';
  const [expenses, setExpenses] = useFirestoreData(`${userId}_expenses`, []);
  const [settings, setSettings] = useFirestoreData(`${userId}_budget_settings`, {
    monthlyLimit: 5000, // standard student pocket money pocket limit
    savingsGoalName: 'Semester Exam Fees',
    savingsGoalTarget: 1500,
    savingsGoalCurrent: 500
  });

  const [expenseInput, setExpenseInput] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  
  // Settings edit state
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [editLimit, setEditLimit] = useState('5000');
  const [editGoalName, setEditGoalName] = useState('Exam Fees');
  const [editGoalTarget, setEditGoalTarget] = useState('1500');
  const [editGoalCurrent, setEditGoalCurrent] = useState('500');

  // Split bill modal state
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [splitAmount, setSplitAmount] = useState('');
  const [splitDesc, setSplitDesc] = useState('');
  const [splitPeopleCount, setSplitPeopleCount] = useState('3');
  const [upiId, setUpiId] = useState('student@okaxis');
  const [calculatedSplit, setCalculatedSplit] = useState(null);

  useEffect(() => {
    setEditLimit(settings.monthlyLimit.toString());
    setEditGoalName(settings.savingsGoalName);
    setEditGoalTarget(settings.savingsGoalTarget.toString());
    setEditGoalCurrent(settings.savingsGoalCurrent.toString());
  }, [settings]);

  const autoCategorize = (desc) => {
    const d = desc.toLowerCase();
    if (d.includes('chai') || d.includes('maggi') || d.includes('samosa') || d.includes('food') || d.includes('swiggy') || d.includes('zomato') || d.includes('lunch') || d.includes('dinner') || d.includes('mess')) {
      return 'Food';
    }
    if (d.includes('auto') || d.includes('metro') || d.includes('bus') || d.includes('cab') || d.includes('uber') || d.includes('ola') || d.includes('train')) {
      return 'Transport';
    }
    if (d.includes('xerox') || d.includes('book') || d.includes('print') || d.includes('exam') || d.includes('college') || d.includes('stationery') || d.includes('fees')) {
      return 'Books';
    }
    if (d.includes('movie') || d.includes('netflix') || d.includes('game') || d.includes('fun') || d.includes('party') || d.includes('coke') || d.includes('hangout')) {
      return 'Fun';
    }
    return 'Misc';
  };

  const addExpense = (amountVal, descVal) => {
    const amount = parseFloat(amountVal);
    if (!amount || isNaN(amount)) return;
    
    const description = descVal.trim() || 'Misc';
    const category = autoCategorize(description);

    const newExpense = {
      id: Date.now().toString(),
      amount,
      desc: description,
      date: new Date().toISOString(),
      category
    };
    
    setExpenses([newExpense, ...expenses]);
    setExpenseInput('');
    setExpenseDesc('');
  };

  const deleteExpense = (id) => {
    setExpenses(expenses.filter(e => e.id !== id));
  };

  const saveSettings = () => {
    setSettings({
      monthlyLimit: parseFloat(editLimit) || 5000,
      savingsGoalName: editGoalName || 'Savings',
      savingsGoalTarget: parseFloat(editGoalTarget) || 1500,
      savingsGoalCurrent: parseFloat(editGoalCurrent) || 0
    });
    setIsEditingSettings(false);
  };

  // Process Category totals
  const categoryTotals = { Food: 0, Transport: 0, Books: 0, Fun: 0, Misc: 0 };
  expenses.forEach(exp => {
    const cat = exp.category || 'Misc';
    if (categoryTotals[cat] !== undefined) {
      categoryTotals[cat] += exp.amount;
    } else {
      categoryTotals['Misc'] += exp.amount;
    }
  });

  const totalSpent = expenses.reduce((sum, item) => sum + item.amount, 0);
  const budgetPct = Math.min((totalSpent / settings.monthlyLimit) * 100, 100);
  const savingsPct = Math.min((settings.savingsGoalCurrent / settings.savingsGoalTarget) * 100, 100);

  // Animated values
  const animatedBudget = useRef(new Animated.Value(0)).current;
  const animatedSavings = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.spring(animatedBudget, {
      toValue: budgetPct,
      friction: 6,
      tension: 40,
      useNativeDriver: false
    }).start();
  }, [budgetPct]);

  useEffect(() => {
    Animated.spring(animatedSavings, {
      toValue: savingsPct,
      friction: 6,
      tension: 40,
      useNativeDriver: false
    }).start();
  }, [savingsPct]);

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

  const budgetWidth = animatedBudget.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%']
  });

  const savingsWidth = animatedSavings.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%']
  });

  // Split calculations
  const calculateSplitShare = () => {
    const total = parseFloat(splitAmount);
    const people = parseInt(splitPeopleCount);
    if (!total || isNaN(total) || !people || isNaN(people) || people <= 1) {
      Alert.alert("Invalid Input", "Please enter valid amount and number of people (> 1).");
      return;
    }
    const share = Math.round((total / people) * 100) / 100;
    setCalculatedSplit({
      total,
      people,
      share,
      upiUrl: `upi://pay?pa=${upiId}&pn=StudentSplit&am=${share}&cu=INR&tn=${encodeURIComponent(splitDesc || 'Split Bill')}`
    });
  };

  const handleShareUPI = async () => {
    if (!calculatedSplit) return;
    try {
      const shareMsg = `Hey, split for "${splitDesc || 'Bill'}" is ₹${calculatedSplit.share} each. Pay me using this UPI link: ${calculatedSplit.upiUrl}`;
      await Share.share({ message: shareMsg });
      // Add the user's own share to expenses!
      addExpense(calculatedSplit.share, `${splitDesc || 'Split'} (My Share)`);
      setShowSplitModal(false);
      setCalculatedSplit(null);
      setSplitAmount('');
      setSplitDesc('');
    } catch (error) {
      Alert.alert("Sharing failed", error.message);
    }
  };

  // Warnings / Insights
  let warningMessage = "";
  if (budgetPct >= 100) {
    warningMessage = "Budget Exhausted! Please stop non-essential spending immediately.";
  } else if (budgetPct >= 80) {
    warningMessage = "Budget Alert! You have used 80% of your limit. Time to skip the expensive cafes.";
  }

  // Check if any category has crossed 40% of budget
  let categoryAlert = "";
  Object.keys(categoryTotals).forEach(cat => {
    const pct = totalSpent > 0 ? (categoryTotals[cat] / settings.monthlyLimit) * 100 : 0;
    if (pct >= 40) {
      categoryAlert = `Spend Alert: "${cat}" expenses have crossed 40% of your monthly pocket money!`;
    }
  });

  return (
    <View style={styles.container}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 60 }}>
          
          {/* Warning alerts */}
          {warningMessage ? (
            <View style={[styles.alertBanner, { backgroundColor: 'rgba(196, 112, 112, 0.1)', borderColor: 'rgba(196, 112, 112, 0.3)' }]}>
              <Text style={[styles.alertText, { color: '#C47070' }]}>{warningMessage}</Text>
            </View>
          ) : null}

          {categoryAlert ? (
            <View style={[styles.alertBanner, { backgroundColor: 'rgba(194, 168, 120, 0.08)', borderColor: 'rgba(194, 168, 120, 0.2)', marginTop: warningMessage ? 12 : 0 }]}>
              <Text style={[styles.alertText, { color: '#C2A878' }]}>{categoryAlert}</Text>
            </View>
          ) : null}

          {/* Pocket Money budget Progress Ring */}
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={styles.cardTitle}>Pocket Money Budget</Text>
              <Text style={styles.cardVal}>₹{totalSpent} / ₹{settings.monthlyLimit}</Text>
            </View>
            <View style={styles.progressBg}>
              <Animated.View style={[
                styles.progressFill, 
                { 
                  width: budgetWidth, 
                  backgroundColor: budgetPct >= 100 ? '#C47070' : budgetPct >= 80 ? '#C2A878' : '#4B6BFB' 
                }
              ]} />
            </View>
            <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', color: '#5A6070', fontSize: 10, marginTop: 8 }}>
              Daily Average: ₹{Math.round(totalSpent / new Date().getDate())} / day this month
            </Text>
          </View>

          {/* Savings Goal */}
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={styles.cardTitle}>Goal: {settings.savingsGoalName}</Text>
              <Text style={styles.cardVal}>₹{settings.savingsGoalCurrent} / ₹{settings.savingsGoalTarget}</Text>
            </View>
            <View style={styles.progressBg}>
              <Animated.View style={[styles.progressFill, { width: savingsWidth, backgroundColor: '#7C9B7A' }]} />
            </View>
          </View>

        {/* 1-Tap Quick presets */}
        <Text style={styles.sectionTitle}>1-TAP STUDENT SHORTCUTS</Text>
        <View style={styles.presetsGrid}>
          {BUDGET_PRESETS.map((preset, i) => (
            <TouchableOpacity 
              key={i} 
              style={styles.presetCard}
              onPress={() => addExpense(preset.amount, preset.name)}
            >
              <Ionicons name={preset.icon} size={20} color="#C2A878" />
              <Text style={styles.presetName}>{preset.name}</Text>
              <Text style={styles.presetPrice}>₹{preset.amount}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Actions Row */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => setShowSplitModal(true)}>
            <Ionicons name="people-outline" size={16} color="#0F1115" style={{ marginRight: 6 }} />
            <Text style={styles.actionBtnText}>Split Bill (UPI)</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#1D2430' }]} onPress={() => setIsEditingSettings(!isEditingSettings)}>
            <Ionicons name="settings-outline" size={16} color="#C2A878" style={{ marginRight: 6 }} />
            <Text style={[styles.actionBtnText, { color: '#C2A878' }]}>Edit Limits</Text>
          </TouchableOpacity>
        </View>

        {/* Settings Form */}
        {isEditingSettings && (
          <View style={styles.settingsForm}>
            <Text style={styles.label}>Monthly Limit (₹)</Text>
            <TextInput style={styles.inputFull} keyboardType="numeric" value={editLimit} onChangeText={setEditLimit} />
            
            <Text style={styles.label}>Savings Goal Name</Text>
            <TextInput style={styles.inputFull} value={editGoalName} onChangeText={setEditGoalName} />
            
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Goal Target (₹)</Text>
                <TextInput style={styles.inputFull} keyboardType="numeric" value={editGoalTarget} onChangeText={setEditGoalTarget} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Goal Saved (₹)</Text>
                <TextInput style={styles.inputFull} keyboardType="numeric" value={editGoalCurrent} onChangeText={setEditGoalCurrent} />
              </View>
            </View>
            
            <TouchableOpacity style={styles.saveSettingsBtn} onPress={saveSettings}>
              <Text style={styles.saveSettingsText}>Save Settings</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Add Expense Manually */}
        <Text style={styles.sectionTitle}>LOG MANUAL EXPENSE</Text>
        <View style={styles.budgetInputContainer}>
          <TextInput
            style={[styles.input, { flex: 1, marginRight: 8 }]}
            placeholder="₹ Amount"
            placeholderTextColor="#5A6070"
            keyboardType="numeric"
            value={expenseInput}
            onChangeText={setExpenseInput}
          />
          <TextInput
            style={[styles.input, { flex: 2 }]}
            placeholder="What did you buy? (e.g. Swiggy)"
            placeholderTextColor="#5A6070"
            value={expenseDesc}
            onChangeText={setExpenseDesc}
            onSubmitEditing={() => addExpense(expenseInput, expenseDesc)}
          />
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => addExpense(expenseInput, expenseDesc)}>
          <Text style={styles.addBtnText}>Log Expense</Text>
        </TouchableOpacity>

        {/* Spending Category chart list */}
        <Text style={styles.sectionTitle}>SPENDING CATEGORIES</Text>
        <View style={styles.categoryCard}>
          {Object.keys(categoryTotals).map(cat => {
            const total = categoryTotals[cat];
            const pct = totalSpent > 0 ? (total / totalSpent) * 100 : 0;
            return (
              <View key={cat} style={styles.categoryRow}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={styles.categoryName}>{cat}</Text>
                  <Text style={styles.categoryVal}>₹{total} ({Math.round(pct)}%)</Text>
                </View>
                <View style={styles.categoryBarBg}>
                  <View style={[styles.categoryBarFill, { width: `${pct}%`, backgroundColor: cat === 'Food' ? '#C2A878' : cat === 'Transport' ? '#4B6BFB' : cat === 'Books' ? '#7C9B7A' : '#8B92A0' }]} />
                </View>
              </View>
            );
          })}
        </View>

        {/* Recent logs */}
        <Text style={styles.sectionTitle}>RECENT EXPENSES (LONG PRESS TO REMOVE)</Text>
        {expenses.length === 0 ? (
          <Text style={styles.emptyText}>No expenses logged this month.</Text>
        ) : (
          expenses.map(e => (
            <TouchableOpacity key={e.id} style={styles.expenseItem} onLongPress={() => deleteExpense(e.id)} delayLongPress={500}>
              <View style={{ flex: 1 }}>
                <Text style={styles.expenseDesc}>{e.desc}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  <View style={styles.tagBadge}><Text style={styles.tagBadgeText}>{e.category || 'Misc'}</Text></View>
                  <Text style={styles.expenseDate}>{new Date(e.date).toLocaleDateString()}</Text>
                </View>
              </View>
              <Text style={styles.expenseAmount}>₹{e.amount}</Text>
            </TouchableOpacity>
          ))
        )}

      </ScrollView>
    </Animated.View>

      {/* Bill Splitter Modal */}
      <Modal
        visible={showSplitModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSplitModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { width: '90%' }]}>
            <Text style={styles.modalTitle}>Split Bill & Exporter</Text>
            <Text style={styles.modalSubtitle}>Calculate split and export UPI payment link</Text>
            
            <View style={{ gap: 12, marginBottom: 20 }}>
              <TextInput
                style={styles.modalInputText}
                keyboardType="numeric"
                placeholder="₹ Total Amount (e.g. 300)"
                placeholderTextColor="#5A6070"
                value={splitAmount}
                onChangeText={setSplitAmount}
              />
              <TextInput
                style={styles.modalInputText}
                placeholder="Bill Description (e.g. Mess dinner)"
                placeholderTextColor="#5A6070"
                value={splitDesc}
                onChangeText={setSplitDesc}
              />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TextInput
                  style={[styles.modalInputText, { flex: 1 }]}
                  keyboardType="numeric"
                  placeholder="No. of people (e.g. 3)"
                  placeholderTextColor="#5A6070"
                  value={splitPeopleCount}
                  onChangeText={setSplitPeopleCount}
                />
                <TextInput
                  style={[styles.modalInputText, { flex: 2 }]}
                  placeholder="Your UPI ID (e.g. name@okaxis)"
                  placeholderTextColor="#5A6070"
                  value={upiId}
                  onChangeText={setUpiId}
                />
              </View>
            </View>

            {calculatedSplit && (
              <View style={styles.splitResultBox}>
                <Text style={styles.splitResultLabel}>Split Share Per Person:</Text>
                <Text style={styles.splitResultVal}>₹{calculatedSplit.share}</Text>
                <Text style={styles.splitResultSub}>UPI URL generated successfully.</Text>
              </View>
            )}
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalActionBtn, { backgroundColor: '#171B22', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }]} 
                onPress={() => {
                  setShowSplitModal(false);
                  setCalculatedSplit(null);
                  setSplitAmount('');
                  setSplitDesc('');
                }}
              >
                <Text style={[styles.modalActionBtnText, { color: '#8B92A0' }]}>Cancel</Text>
              </TouchableOpacity>
              
              {calculatedSplit ? (
                <TouchableOpacity 
                  style={[styles.modalActionBtn, { backgroundColor: '#7C9B7A' }]} 
                  onPress={handleShareUPI}
                >
                  <Text style={[styles.modalActionBtnText, { color: '#0F1115' }]}>Share UPI Link</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={[styles.modalActionBtn, { backgroundColor: '#C2A878' }]} 
                  onPress={calculateSplitShare}
                >
                  <Text style={[styles.modalActionBtnText, { color: '#0F1115' }]}>Calculate</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F1115' },
  
  alertBanner: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20
  },
  alertText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    textAlign: 'center'
  },

  card: { 
    backgroundColor: '#171B22', 
    borderRadius: 16, 
    padding: 20, 
    marginBottom: 16, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.03)',
    shadowColor: '#4B6BFB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2
  },
  cardTitle: { fontFamily: 'PlusJakartaSans_700Bold', color: '#F3F1EC', fontSize: 14 },
  cardVal: { fontFamily: 'PlusJakartaSans_600SemiBold', color: '#8B92A0', fontSize: 14 },
  progressBg: { height: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%' },

  sectionTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: '#5A6070', letterSpacing: 1, marginBottom: 12, marginTop: 12 },
  
  presetsGrid: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  presetCard: {
    flex: 1,
    backgroundColor: '#171B22',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  presetName: { fontFamily: 'PlusJakartaSans_700Bold', color: '#8B92A0', fontSize: 10, marginTop: 6, textAlign: 'center' },
  presetPrice: { fontFamily: 'PlusJakartaSans_700Bold', color: '#C2A878', fontSize: 12, marginTop: 2 },

  actionBtn: {
    flex: 1,
    backgroundColor: '#C2A878',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row'
  },
  actionBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    color: '#0F1115'
  },

  settingsForm: { backgroundColor: '#171B22', padding: 16, borderRadius: 16, marginBottom: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  label: { fontFamily: 'PlusJakartaSans_600SemiBold', color: '#8B92A0', fontSize: 11, marginBottom: 8 },
  inputFull: { backgroundColor: '#0F1115', borderRadius: 8, padding: 12, color: '#F3F1EC', fontFamily: 'PlusJakartaSans_500Medium', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  saveSettingsBtn: { backgroundColor: '#C2A878', padding: 12, borderRadius: 8, alignItems: 'center' },
  saveSettingsText: { fontFamily: 'PlusJakartaSans_700Bold', color: '#0F1115' },

  budgetInputContainer: { flexDirection: 'row', marginBottom: 12 },
  input: { backgroundColor: '#171B22', borderRadius: 12, padding: 12, color: '#F3F1EC', fontFamily: 'PlusJakartaSans_500Medium', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  addBtn: { backgroundColor: '#1D2430', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 32 },
  addBtnText: { fontFamily: 'PlusJakartaSans_700Bold', color: '#F3F1EC' },
  
  categoryCard: {
    backgroundColor: '#171B22',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
    marginBottom: 32
  },
  categoryRow: { marginBottom: 16 },
  categoryName: { fontFamily: 'PlusJakartaSans_700Bold', color: '#F3F1EC', fontSize: 13 },
  categoryVal: { fontFamily: 'PlusJakartaSans_600SemiBold', color: '#8B92A0', fontSize: 11 },
  categoryBarBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden', marginTop: 4 },
  categoryBarFill: { height: '100%', borderRadius: 3 },

  expenseItem: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    backgroundColor: '#171B22', 
    padding: 16, 
    borderRadius: 12, 
    marginBottom: 8, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.03)' 
  },
  expenseDesc: { fontFamily: 'PlusJakartaSans_600SemiBold', color: '#F3F1EC', fontSize: 14 },
  expenseDate: { fontFamily: 'PlusJakartaSans_500Medium', color: '#5A6070', fontSize: 10, marginLeft: 8 },
  expenseAmount: { fontFamily: 'PlusJakartaSans_700Bold', color: '#C47070', fontSize: 15 },
  emptyText: { fontFamily: 'PlusJakartaSans_500Medium', color: '#8B92A0', fontSize: 12, textAlign: 'center', padding: 20 },

  tagBadge: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  tagBadgeText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 9,
    color: '#8B92A0',
    textTransform: 'uppercase'
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
  modalInputText: {
    backgroundColor: '#0F1115',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 14,
    color: '#F3F1EC',
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14
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

  // Split result styles
  splitResultBox: {
    backgroundColor: '#0F1115',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20
  },
  splitResultLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: '#8B92A0'
  },
  splitResultVal: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 28,
    color: '#C2A878',
    marginTop: 4
  },
  splitResultSub: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 10,
    color: '#7C9B7A',
    marginTop: 8
  }
});
