import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link, router } from 'expo-router';

import { useAuth } from '@/providers/AuthProvider';

export default function SignupScreen() {
  const { signUp } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignup = async () => {
    if (!username.trim() || !password || !confirmPassword) {
      setErrorMessage('Username and password are required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      await signUp({
        username,
        email,
        fullName,
        phoneNumber,
        password,
        confirmPassword,
      });
      router.replace('/(tabs)');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Signup failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>CREATE ACCOUNT</Text>
          <Text style={styles.title}>Set up your driver profile</Text>
          <Text style={styles.subtitle}>
            This profile becomes the person attached to future readings and SOS records.
          </Text>

          <TextInput
            autoCapitalize="none"
            placeholder="Username"
            placeholderTextColor="#6B7280"
            style={styles.input}
            value={username}
            onChangeText={setUsername}
          />
          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="Email"
            placeholderTextColor="#6B7280"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            placeholder="Full name"
            placeholderTextColor="#6B7280"
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
          />
          <TextInput
            keyboardType="phone-pad"
            placeholder="Phone number"
            placeholderTextColor="#6B7280"
            style={styles.input}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
          />
          <TextInput
            autoCapitalize="none"
            secureTextEntry
            placeholder="Password"
            placeholderTextColor="#6B7280"
            style={styles.input}
            value={password}
            onChangeText={setPassword}
          />
          <TextInput
            autoCapitalize="none"
            secureTextEntry
            placeholder="Confirm password"
            placeholderTextColor="#6B7280"
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <Pressable style={styles.primaryButton} onPress={handleSignup} disabled={isSubmitting}>
            {isSubmitting ? (
              <ActivityIndicator color="#0B1220" />
            ) : (
              <Text style={styles.primaryButtonText}>Create Account</Text>
            )}
          </Pressable>

          <Link href="/login" asChild>
            <Pressable style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Already have an account?</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0B1220',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    padding: 24,
    gap: 14,
  },
  eyebrow: {
    color: '#F97316',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2,
  },
  title: {
    color: '#0F172A',
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
  },
  primaryButton: {
    backgroundColor: '#F59E0B',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#0B1220',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '700',
  },
});
