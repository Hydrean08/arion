import React, { useState, useEffect } from 'react';
import { createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import ErrorBoundary from '../components/ErrorBoundary';
import { orion } from '../api/orion';

import DiscoverScreen     from '../screens/discover/DiscoverScreen';
import LibraryScreen      from '../screens/library/LibraryScreen';
import ItemDetailScreen   from '../screens/detail/ItemDetailScreen';
import MusicHomeScreen    from '../screens/music/MusicHomeScreen';
import ArtistDetailScreen from '../screens/music/ArtistDetailScreen';
import DownloadsScreen    from '../screens/downloads/DownloadsScreen';
import SettingsScreen     from '../screens/settings/SettingsScreen';
import PredictorDebugScreen from '../screens/settings/PredictorDebugScreen';
import { aria } from '../api/aria';

export const navigationRef = createNavigationContainerRef();

const Tab   = createBottomTabNavigator();
const Root  = createNativeStackNavigator();
const Music = createNativeStackNavigator();

function MusicStack() {
  return (
    <Music.Navigator screenOptions={{ headerShown: false }}>
      <Music.Screen name="MusicHome"    component={MusicHomeScreen} />
      <Music.Screen name="ArtistDetail" component={ArtistDetailScreen} />
    </Music.Navigator>
  );
}

function TabNavigator() {
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const poll = async () => {
      try {
        const stats = await orion.stats();
        setPendingCount((stats.pending ?? 0) + (stats.queued ?? 0));
      } catch {}
    };
    poll();
    const interval = setInterval(poll, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor:   colors.accent2,
        tabBarInactiveTintColor: colors.muted,
        tabBarIcon: ({ focused, color, size }) => {
          const icons = {
            Discover: focused ? 'search'        : 'search-outline',
            Video:    focused ? 'film'           : 'film-outline',
            Music:    focused ? 'musical-notes'  : 'musical-notes-outline',
            Settings: focused ? 'settings'       : 'settings-outline',
          };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Discover">{() => <ErrorBoundary><DiscoverScreen /></ErrorBoundary>}</Tab.Screen>
      <Tab.Screen
        name="Video"
        options={{ tabBarBadge: pendingCount > 0 ? pendingCount : undefined }}
      >
        {() => <ErrorBoundary><LibraryScreen /></ErrorBoundary>}
      </Tab.Screen>
      <Tab.Screen name="Music"   >{() => <ErrorBoundary><MusicStack /></ErrorBoundary>}</Tab.Screen>
      <Tab.Screen name="Settings">{() => <ErrorBoundary><SettingsScreen /></ErrorBoundary>}</Tab.Screen>
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  return (
    <Root.Navigator screenOptions={{ headerShown: false }}>
      <Root.Group>
        <Root.Screen name="Main" component={TabNavigator} />
      </Root.Group>
      <Root.Group screenOptions={{ presentation: 'modal', animation: 'slide_from_bottom' }}>
        <Root.Screen name="ItemDetail"      component={ItemDetailScreen} />
        <Root.Screen name="ArtistDetail"    component={ArtistDetailScreen} />
        <Root.Screen name="PredictorDebug"  component={PredictorDebugScreen} />
      </Root.Group>
    </Root.Navigator>
  );
}
