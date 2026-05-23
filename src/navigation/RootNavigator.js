import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Screens
import TabNavigator from './TabNavigator';
import FocusScreen from '../screens/FocusScreen';
import NotesScreen from '../screens/NotesScreen';
// We'll rename/refactor ProfileScreen to BudgetScreen
import BudgetScreen from '../screens/BudgetScreen';
import HydrationScreen from '../screens/HydrationScreen';
import ProfileScreen from '../screens/ProfileScreen';
import NotificationCenterScreen from '../screens/NotificationCenterScreen';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ 
      headerShown: true,
      headerStyle: { backgroundColor: '#0F1115' },
      headerTintColor: '#F3F1EC',
      headerTitleStyle: { fontFamily: 'PlusJakartaSans_700Bold' },
      headerBackTitleVisible: false
    }}>
      <Stack.Screen 
        name="MainTabs" 
        component={TabNavigator} 
        options={{ headerShown: false }} 
      />
      <Stack.Screen 
        name="FocusWorkspace" 
        component={FocusScreen} 
        options={{ title: 'Focus Timer' }} 
      />
      <Stack.Screen 
        name="NotesWorkspace" 
        component={NotesScreen} 
        options={{ title: 'Subject Notes' }} 
      />
      <Stack.Screen 
        name="BudgetWorkspace" 
        component={BudgetScreen} 
        options={{ title: 'Student Budget' }} 
      />
      <Stack.Screen 
        name="HydrationWorkspace" 
        component={HydrationScreen} 
        options={{ title: 'Water Log' }} 
      />
      <Stack.Screen 
        name="ProfileWorkspace" 
        component={ProfileScreen} 
        options={{ title: 'Student Profile' }} 
      />
      <Stack.Screen 
        name="NotificationCenterWorkspace" 
        component={NotificationCenterScreen} 
        options={{ title: 'Quiet Hours & Reminders' }} 
      />
    </Stack.Navigator>
  );
}
