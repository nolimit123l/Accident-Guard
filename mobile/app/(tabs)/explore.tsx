import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { useAuth } from '@/providers/AuthProvider';

export default function AccountScreen() {
  const { profile, user, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    router.replace('/login');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.heroCard}>
        <Text style={styles.eyebrow}>ACCOUNT</Text>
        <Text style={styles.title}>{profile?.full_name || user?.username || 'Driver'}</Text>
        <Text style={styles.subtitle}>
          Signed in users can sync contacts, readings, and SOS records with the backend.
        </Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.sectionTitle}>Profile</Text>

        <Text style={styles.label}>Username</Text>
        <Text style={styles.value}>{profile?.username || user?.username || 'N/A'}</Text>

        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{profile?.email || user?.email || 'N/A'}</Text>

        <Text style={styles.label}>Phone</Text>
        <Text style={styles.value}>{profile?.phone_number || 'Not set'}</Text>

        <Text style={styles.label}>SOS Name</Text>
        <Text style={styles.value}>{profile?.emergency_message_name || 'Not set'}</Text>

        <Text style={styles.label}>Risk Threshold</Text>
        <Text style={styles.value}>
          {profile?.default_risk_threshold ? `${profile.default_risk_threshold}%` : '70%'}
        </Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.sectionTitle}>What&apos;s Ready</Text>
        <Text style={styles.bullet}>Your login now maps readings and alerts to a real backend user.</Text>
        <Text style={styles.bullet}>Contacts added from the dashboard are stored in the database.</Text>
        <Text style={styles.bullet}>SOS requests can include your saved profile identity.</Text>
      </View>

      <Pressable style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Log Out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    gap: 16,
    backgroundColor: '#0B1220',
  },
  heroCard: {
    backgroundColor: '#F97316',
    borderRadius: 24,
    padding: 22,
  },
  eyebrow: {
    color: '#FBF7F0',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 8,
  },
  title: {
    color: '#0B1220',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    color: '#1E293B',
    fontSize: 14,
    lineHeight: 21,
  },
  infoCard: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 20,
  },
  sectionTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 14,
  },
  label: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  value: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  bullet: {
    color: '#E2E8F0',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 8,
  },
  logoutButton: {
    backgroundColor: '#38BDF8',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#0B1220',
    fontSize: 16,
    fontWeight: '800',
  },
});
