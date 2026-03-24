import React, { useEffect, useRef, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, Vibration, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import * as Contacts from 'expo-contacts';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { Accelerometer, Gyroscope } from 'expo-sensors';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Config } from '@/constants/Config';
import api from '@/lib/api';
import { useAuth } from '@/providers/AuthProvider';

type MotionState = 'Normal' | 'Bump' | 'Accident';
type Vector3 = { x: number; y: number; z: number };
type Subscription = { remove: () => void };
type SensorSubscription = { accel: Subscription; gyro: Subscription };
type EmergencyContact = { id: string; name: string; phone: string; relation?: string };
type ApiEmergencyContact = { id: number; name: string; phone_number: string; relation?: string };
type SensorSequenceItem = { accel_x: number; accel_y: number; accel_z: number; gyro_x: number; gyro_y: number; gyro_z: number };
type RegionalSummary = { city: string; state: string; trafficDensity: string; congestionLevel: number; yearlyAccidents: number; riskLevel: string };
type RiskAnalysis = { rawScore: number; smoothedScore: number; band: string; recommendation: string; confidence: number; impactDelta: number; angularVelocity: number; reasons: string[]; motionState: MotionState; readingId: number | null; lastSyncedAt: string };

const GRAVITY_MS2 = 9.81;
const SENSOR_SEQUENCE_LIMIT = 64;
const RISK_WINDOW = 5;
const HELPLINES: EmergencyContact[] = [
  { id: 'police', name: 'Police', phone: '100', relation: 'Emergency' },
  { id: 'ambulance', name: 'Ambulance', phone: '108', relation: 'Medical' },
  { id: 'fire', name: 'Fire', phone: '101', relation: 'Emergency' },
];
const INITIAL_ANALYSIS: RiskAnalysis = {
  rawScore: 0,
  smoothedScore: 0,
  band: 'low',
  recommendation: 'Normal monitoring.',
  confidence: 55,
  impactDelta: 0,
  angularVelocity: 0,
  reasons: [],
  motionState: 'Normal',
  readingId: null,
  lastSyncedAt: 'Not synced yet',
};

const mapApiContactToLocal = (contact: ApiEmergencyContact): EmergencyContact => ({
  id: String(contact.id),
  name: contact.name,
  phone: contact.phone_number,
  relation: contact.relation,
});

const toMs2 = (value: number) => value * GRAVITY_MS2;
const accelToMs2 = (accel: Vector3) => ({ x: toMs2(accel.x), y: toMs2(accel.y), z: toMs2(accel.z) });
const magnitude = (vector: Vector3) => Math.sqrt((vector.x * vector.x) + (vector.y * vector.y) + (vector.z * vector.z));
const impactDelta = (accel: Vector3) => Math.abs(magnitude(accelToMs2(accel)) - GRAVITY_MS2);
const maxAngularVelocity = (gyro: Vector3) => Math.max(Math.abs(gyro.x), Math.abs(gyro.y), Math.abs(gyro.z));
const smoothRisk = (samples: number[]) => {
  if (samples.length === 0) return 0;
  const weighted = samples.reduce((acc, value, index) => ({ total: acc.total + (value * (index + 1)), weight: acc.weight + index + 1 }), { total: 0, weight: 0 });
  return weighted.total / weighted.weight;
};
const formatBandLabel = (value: string) => value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : 'Low';
const formatMotion = (value?: string): MotionState => value === 'accident' ? 'Accident' : value === 'bump' ? 'Bump' : 'Normal';
const toneForRisk = (score: number) => score >= 80 ? { accent: '#FF4D67', soft: '#351019', text: '#FFE7EB' } : score >= 55 ? { accent: '#FF9A3D', soft: '#38210D', text: '#FFF0DF' } : score >= 25 ? { accent: '#F3C64E', soft: '#342A10', text: '#FFF6DB' } : { accent: '#32C48D', soft: '#103126', text: '#E6FFF5' };
const clockTime = (value: Date) => value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export default function HomeScreen() {
  const { profile, token } = useAuth();
  const [accelData, setAccelData] = useState<Vector3>({ x: 0, y: 0, z: 1 });
  const [gyroData, setGyroData] = useState<Vector3>({ x: 0, y: 0, z: 0 });
  const [riskAnalysis, setRiskAnalysis] = useState<RiskAnalysis>(INITIAL_ANALYSIS);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [sensorSubscription, setSensorSubscription] = useState<SensorSubscription | null>(null);
  const [locationWatcher, setLocationWatcher] = useState<Location.LocationSubscription | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationLabel, setLocationLabel] = useState('Waiting for GPS');
  const [speedKmph, setSpeedKmph] = useState(0);
  const [regionalSummary, setRegionalSummary] = useState<RegionalSummary>({ city: 'Unknown', state: 'Unknown', trafficDensity: 'Unknown', congestionLevel: 0, yearlyAccidents: 0, riskLevel: 'Unknown' });
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [predefinedNumbers, setPredefinedNumbers] = useState<string[]>(Config.DEFAULT_EMERGENCY_NUMBERS?.length ? [...Config.DEFAULT_EMERGENCY_NUMBERS] : []);
  const [newPredefinedNumber, setNewPredefinedNumber] = useState('');
  const [systemLogs, setSystemLogs] = useState<string[]>([]);
  const [tripStartTime, setTripStartTime] = useState<Date | null>(null);
  const [tripDuration, setTripDuration] = useState('0:00');
  const [lastAlertTime, setLastAlertTime] = useState('Never');
  const [isAccidentDialogVisible, setIsAccidentDialogVisible] = useState(false);
  const [accidentCountdown, setAccidentCountdown] = useState(10);

  const accelRef = useRef(accelData);
  const gyroRef = useRef(gyroData);
  const locationRef = useRef(location);
  const speedRef = useRef(speedKmph);
  const trafficRef = useRef(regionalSummary.trafficDensity);
  const regionRef = useRef(regionalSummary.riskLevel);
  const riskSamplesRef = useRef<number[]>([]);
  const sensorSequenceRef = useRef<SensorSequenceItem[]>([]);
  const accidentTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const lastRegionalFetchRef = useRef(0);

  const liveAccel = accelToMs2(accelData);
  const currentImpact = riskAnalysis.impactDelta || impactDelta(accelData);
  const currentAngularVelocity = riskAnalysis.angularVelocity || maxAngularVelocity(gyroData);
  const riskTone = toneForRisk(riskAnalysis.smoothedScore);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setSystemLogs((prev) => [`[${timestamp}] ${message}`, ...prev.slice(0, 5)]);
  };

  const loadEmergencyContacts = async () => {
    if (!token) {
      setEmergencyContacts([]);
      return;
    }
    try {
      const response = await api.get(Config.CONTACTS_URL);
      const contacts = Array.isArray(response.data?.contacts) ? response.data.contacts : [];
      setEmergencyContacts(contacts.map(mapApiContactToLocal));
    } catch {
      addLog('Could not sync contacts from backend');
    }
  };

  const saveEmergencyContact = async (contact: Omit<EmergencyContact, 'id'>) => {
    try {
      const response = await api.post(Config.CONTACTS_URL, {
        name: contact.name,
        phone_number: contact.phone.replace(/\s/g, ''),
        relation: contact.relation || 'Emergency Contact',
        is_primary: emergencyContacts.length === 0,
      });
      const savedContact = mapApiContactToLocal(response.data.contact);
      setEmergencyContacts((prev) => [...prev.filter((item) => item.phone !== savedContact.phone), savedContact]);
      addLog(`Saved emergency contact: ${savedContact.name}`);
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Could not save contact.';
      addLog(message);
      Alert.alert('Contact Save Failed', message);
    }
  };

  const pickContact = async () => {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Cannot access contacts without permission.');
      return;
    }
    const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers] });
    const options = data.filter((contact) => contact.phoneNumbers?.[0]?.number).slice(0, 8).map((contact) => ({
      text: contact.name || 'Unknown',
      onPress: () => saveEmergencyContact({
        name: contact.name || 'Unknown',
        phone: contact.phoneNumbers?.[0]?.number || '',
        relation: 'Emergency Contact',
      }),
    }));
    if (options.length === 0) {
      Alert.alert('No Contacts', 'No contacts with phone numbers were found.');
      return;
    }
    Alert.alert('Select Emergency Contact', 'Choose a contact from your phone.', options);
  };

  const addPredefinedNumber = () => {
    const trimmed = newPredefinedNumber.trim().replace(/\s/g, '');
    if (!trimmed) return;
    if (predefinedNumbers.includes(trimmed)) {
      addLog('Number already added');
      return;
    }
    setPredefinedNumbers((prev) => [...prev, trimmed]);
    setNewPredefinedNumber('');
    addLog(`Added SOS number: ${trimmed}`);
  };

  const removePredefinedNumber = (phone: string) => {
    setPredefinedNumbers((prev) => prev.filter((item) => item !== phone));
    addLog(`Removed SOS number: ${phone}`);
  };

  const fetchRegionalSummary = async (latitude: number, longitude: number) => {
    try {
      const response = await api.get(Config.REGIONAL_DATA_URL, { params: { lat: latitude, lon: longitude } });
      const data = response.data || {};
      setRegionalSummary({
        city: data.city || 'Unknown',
        state: data.state || 'Unknown',
        trafficDensity: data.traffic?.density || 'Unknown',
        congestionLevel: Number(data.traffic?.congestion_level || 0),
        yearlyAccidents: Number(data.accident_history?.yearly_accidents || 0),
        riskLevel: data.accident_history?.risk_level || 'Unknown',
      });
      setLocationLabel(data.city && data.city !== 'Unknown' ? `${data.city}, ${data.state}` : 'GPS active');
    } catch {
      setLocationLabel('GPS active');
    }
  };

  const pushSensorSample = (accel: Vector3, gyro: Vector3) => {
    const converted = accelToMs2(accel);
    sensorSequenceRef.current = [
      ...sensorSequenceRef.current.slice(-(SENSOR_SEQUENCE_LIMIT - 1)),
      {
        accel_x: Number(converted.x.toFixed(3)),
        accel_y: Number(converted.y.toFixed(3)),
        accel_z: Number(converted.z.toFixed(3)),
        gyro_x: Number(gyro.x.toFixed(3)),
        gyro_y: Number(gyro.y.toFixed(3)),
        gyro_z: Number(gyro.z.toFixed(3)),
      },
    ];
  };

  const clearAccidentTimer = () => {
    if (accidentTimerRef.current) {
      clearInterval(accidentTimerRef.current);
      accidentTimerRef.current = null;
    }
  };

  const loadAlarmSound = async () => {
    try {
      if (soundRef.current) return;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true, shouldDuckAndroid: true, playThroughEarpieceAndroid: false });
      const { sound } = await Audio.Sound.createAsync({ uri: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3' }, { shouldPlay: false, isLooping: true, volume: 1 });
      soundRef.current = sound;
    } catch (error) {
      addLog(`Alarm sound unavailable: ${String(error)}`);
    }
  };

  const playAlarmSound = async () => {
    try {
      if (!soundRef.current) await loadAlarmSound();
      if (soundRef.current) await soundRef.current.replayAsync();
    } catch {
      addLog('Alarm playback failed');
    }
  };

  const stopAlarmSound = async () => {
    try {
      if (soundRef.current) await soundRef.current.stopAsync();
    } catch {
      // Ignore alarm stop failures during cleanup.
    }
  };

  const sendSMSAlert = async (triggerSource: 'automatic' | 'manual') => {
    const backendContacts = emergencyContacts.map((contact) => contact.phone);
    const allNumbers = [...new Set([...predefinedNumbers, ...backendContacts])].filter(Boolean);
    if (allNumbers.length === 0 && !token) {
      addLog('No emergency contacts available for SOS');
      Alert.alert('No Contacts', 'Add at least one emergency contact before sending SOS.');
      return;
    }
    try {
      const response = await api.post(Config.SMS_ALERT_URL, {
        phone_numbers: allNumbers,
        risk_score: Math.round(riskAnalysis.smoothedScore),
        latitude: locationRef.current?.latitude,
        longitude: locationRef.current?.longitude,
        reading_id: riskAnalysis.readingId,
        sender_name: profile?.emergency_message_name || profile?.full_name || profile?.username || 'REFLEX User',
        motion_state: riskAnalysis.motionState.toLowerCase(),
        risk_band: riskAnalysis.band,
        trigger_source: triggerSource,
      });
      const message = response.data?.message || 'SOS sent successfully.';
      setLastAlertTime(clockTime(new Date()));
      addLog(message);
      Alert.alert('SOS Sent', response.data?.message_body || message);
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Network or backend error while sending SOS.';
      addLog(`SOS failed: ${message}`);
      Alert.alert('SOS Failed', message);
    }
  };

  const triggerSOS = async () => {
    clearAccidentTimer();
    Vibration.cancel();
    await stopAlarmSound();
    setIsAccidentDialogVisible(false);
    setAccidentCountdown(10);
    addLog('Accident confirmed. Sending SOS.');
    await sendSMSAlert('automatic');
  };

  const cancelAccidentFlow = async () => {
    clearAccidentTimer();
    Vibration.cancel();
    await stopAlarmSound();
    setIsAccidentDialogVisible(false);
    setAccidentCountdown(10);
    addLog('Accident alert canceled by user');
  };

  const startAccidentFlow = async () => {
    if (isAccidentDialogVisible) return;
    setIsAccidentDialogVisible(true);
    setAccidentCountdown(10);
    Vibration.vibrate([0, 500, 500], true);
    await playAlarmSound();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    accidentTimerRef.current = setInterval(() => {
      setAccidentCountdown((prev) => {
        if (prev <= 1) {
          void triggerSOS();
          return 0;
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        return prev - 1;
      });
    }, 1000);
  };

  const startLocationTracking = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      addLog('Location permission denied');
      return;
    }
    const watcher = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 15 }, (currentLocation) => {
      const nextLocation = { latitude: currentLocation.coords.latitude, longitude: currentLocation.coords.longitude };
      const nextSpeed = Math.max(0, Math.round((currentLocation.coords.speed || 0) * 3.6));
      setLocation(nextLocation);
      locationRef.current = nextLocation;
      setSpeedKmph(nextSpeed);
      speedRef.current = nextSpeed;
      const now = Date.now();
      if (now - lastRegionalFetchRef.current > 15000) {
        lastRegionalFetchRef.current = now;
        void fetchRegionalSummary(nextLocation.latitude, nextLocation.longitude);
      }
    });
    setLocationWatcher(watcher);
    addLog('Location tracking started');
  };

  const stopLocationTracking = () => {
    if (locationWatcher) {
      locationWatcher.remove();
      setLocationWatcher(null);
    }
  };

  const sendDataToBackend = async () => {
    try {
      const now = new Date();
      const accel = accelToMs2(accelRef.current);
      const gyro = gyroRef.current;
      const payload: Record<string, unknown> = {
        accel_x: accel.x,
        accel_y: accel.y,
        accel_z: accel.z,
        gyro_x: gyro.x,
        gyro_y: gyro.y,
        gyro_z: gyro.z,
        speed_kmph: speedRef.current,
        latitude: locationRef.current?.latitude,
        longitude: locationRef.current?.longitude,
        weather: 'Clear',
        traffic: trafficRef.current === 'Unknown' ? 'Moderate' : trafficRef.current,
        region_type: regionRef.current === 'Unknown' ? 'Urban' : regionRef.current,
        road_class: 'Urban',
        weekday: now.toLocaleDateString('en-US', { weekday: 'short' }),
        time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }),
      };
      if (sensorSequenceRef.current.length === SENSOR_SEQUENCE_LIMIT) payload.sensor_sequence = sensorSequenceRef.current;
      const response = await api.post(Config.SENSORS_DATA_URL, payload);
      if (typeof response.data?.accident_rate !== 'number') return;
      const rawScore = response.data.accident_rate;
      const samples = [...riskSamplesRef.current, rawScore].slice(-RISK_WINDOW);
      riskSamplesRef.current = samples;
      const smoothedScore = smoothRisk(samples);
      const motionState = formatMotion(response.data?.motion_state);
      const reasons = Array.isArray(response.data?.trigger_reasons) ? response.data.trigger_reasons : [];
      setRiskAnalysis({
        rawScore,
        smoothedScore,
        band: response.data?.risk_band || 'low',
        recommendation: response.data?.recommended_action || 'Normal monitoring.',
        confidence: Number(response.data?.confidence_score || 55),
        impactDelta: Number(response.data?.impact_delta || impactDelta(accelRef.current)),
        angularVelocity: Number(response.data?.max_angular_velocity || maxAngularVelocity(gyroRef.current)),
        reasons,
        motionState,
        readingId: response.data?.reading_id ?? null,
        lastSyncedAt: clockTime(new Date()),
      });
      if (smoothedScore >= 55) addLog(`Risk ${Math.round(smoothedScore)}%: ${reasons.join(', ') || 'High-risk reading detected'}`);
      if (motionState === 'Accident' || smoothedScore >= 80) void startAccidentFlow();
    } catch {
      addLog('Backend sync failed');
    }
  };

  const startMonitoring = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Unavailable', 'Live sensor monitoring is only available on a mobile device.');
      return;
    }
    const accelAvailable = await Accelerometer.isAvailableAsync();
    const gyroAvailable = await Gyroscope.isAvailableAsync();
    if (!accelAvailable || !gyroAvailable) {
      Alert.alert('Sensors Unavailable', 'This device does not expose the required sensors.');
      return;
    }
    setIsMonitoring(true);
    setTripStartTime(new Date());
    setRiskAnalysis(INITIAL_ANALYSIS);
    riskSamplesRef.current = [];
    sensorSequenceRef.current = [];
    addLog('Trip monitoring started');
    await startLocationTracking();
    Accelerometer.setUpdateInterval(250);
    Gyroscope.setUpdateInterval(250);
    const accelSub = Accelerometer.addListener((data) => {
      accelRef.current = data;
      setAccelData(data);
      pushSensorSample(data, gyroRef.current);
    });
    const gyroSub = Gyroscope.addListener((data) => {
      gyroRef.current = data;
      setGyroData(data);
      pushSensorSample(accelRef.current, data);
    });
    setSensorSubscription({ accel: accelSub, gyro: gyroSub });
  };

  const stopMonitoring = async () => {
    setIsMonitoring(false);
    setTripStartTime(null);
    setTripDuration('0:00');
    sensorSubscription?.accel.remove();
    sensorSubscription?.gyro.remove();
    setSensorSubscription(null);
    stopLocationTracking();
    await cancelAccidentFlow();
    addLog('Trip monitoring stopped');
  };

  useEffect(() => { accelRef.current = accelData; }, [accelData]);
  useEffect(() => { gyroRef.current = gyroData; }, [gyroData]);
  useEffect(() => { locationRef.current = location; }, [location]);
  useEffect(() => { speedRef.current = speedKmph; }, [speedKmph]);
  useEffect(() => { trafficRef.current = regionalSummary.trafficDensity; regionRef.current = regionalSummary.riskLevel; }, [regionalSummary]);
  useEffect(() => { void loadEmergencyContacts(); }, [token]);
  useEffect(() => {
    void loadAlarmSound();
    return () => {
      void stopMonitoring();
      if (soundRef.current) void soundRef.current.unloadAsync();
    };
  }, []);
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isMonitoring) interval = setInterval(() => void sendDataToBackend(), 1200);
    return () => { if (interval) clearInterval(interval); };
  }, [isMonitoring]);
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isMonitoring && tripStartTime) {
      interval = setInterval(() => {
        const diffSeconds = Math.floor((Date.now() - tripStartTime.getTime()) / 1000);
        const minutes = Math.floor(diffSeconds / 60);
        const seconds = diffSeconds % 60;
        setTripDuration(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      }, 1000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isMonitoring, tripStartTime]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Road safety monitor</Text>
            <Text style={styles.title}>REFLEX</Text>
            <Text style={styles.subtitle}>{profile?.full_name ? `Protecting ${profile.full_name}` : 'Protecting every trip'}</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: isMonitoring ? '#103126' : '#1C2431' }]}>
            <View style={[styles.statusDot, { backgroundColor: isMonitoring ? '#32C48D' : '#8F9BA8' }]} />
            <Text style={styles.statusText}>{isMonitoring ? 'Monitoring' : 'Idle'}</Text>
          </View>
        </View>

        <LinearGradient colors={[riskTone.soft, '#0F1722']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.heroCard, { borderColor: `${riskTone.accent}40` }]}>
          <View style={styles.heroRow}>
            <View>
              <Text style={styles.heroLabel}>Current risk</Text>
              <Text style={[styles.heroValue, { color: riskTone.text }]}>{Math.round(riskAnalysis.smoothedScore)}%</Text>
            </View>
            <View style={[styles.heroBadge, { backgroundColor: riskTone.accent }]}>
              <Text style={styles.heroBadgeText}>{formatBandLabel(riskAnalysis.band)}</Text>
            </View>
          </View>
          <Text style={[styles.heroMotion, { color: riskTone.text }]}>{riskAnalysis.motionState} detected</Text>
          <Text style={styles.heroRecommendation}>{riskAnalysis.recommendation}</Text>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}><Text style={styles.heroStatLabel}>Confidence</Text><Text style={styles.heroStatValue}>{riskAnalysis.confidence}%</Text></View>
            <View style={styles.heroStat}><Text style={styles.heroStatLabel}>Impact delta</Text><Text style={styles.heroStatValue}>{currentImpact.toFixed(1)} m/s²</Text></View>
            <View style={styles.heroStat}><Text style={styles.heroStatLabel}>Last sync</Text><Text style={styles.heroStatValue}>{riskAnalysis.lastSyncedAt}</Text></View>
          </View>
          <View style={styles.heroButtons}>
            <TouchableOpacity style={[styles.primaryButton, { backgroundColor: isMonitoring ? '#F4F7FB' : '#32C48D' }]} onPress={isMonitoring ? () => void stopMonitoring() : () => void startMonitoring()}>
              <MaterialCommunityIcons name={isMonitoring ? 'stop-circle-outline' : 'play-circle-outline'} size={18} color={isMonitoring ? '#0F1722' : '#08231C'} />
              <Text style={[styles.primaryButtonText, { color: isMonitoring ? '#0F1722' : '#08231C' }]}>{isMonitoring ? 'Stop monitoring' : 'Start monitoring'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => void sendSMSAlert('manual')}>
              <MaterialCommunityIcons name="alarm-light-outline" size={18} color="#F4F7FB" />
              <Text style={styles.secondaryButtonText}>Send SOS now</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}><Text style={styles.metricLabel}>Speed</Text><Text style={styles.metricValue}>{speedKmph} km/h</Text><Text style={styles.metricHelper}>Live GPS speed</Text></View>
          <View style={styles.metricCard}><Text style={styles.metricLabel}>Location</Text><Text style={styles.metricValue}>{locationLabel}</Text><Text style={styles.metricHelper}>{location ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}` : 'Waiting for coordinates'}</Text></View>
          <View style={styles.metricCard}><Text style={styles.metricLabel}>Traffic</Text><Text style={styles.metricValue}>{regionalSummary.trafficDensity}</Text><Text style={styles.metricHelper}>Congestion {regionalSummary.congestionLevel}%</Text></View>
          <View style={styles.metricCard}><Text style={styles.metricLabel}>Regional risk</Text><Text style={styles.metricValue}>{regionalSummary.riskLevel}</Text><Text style={styles.metricHelper}>{regionalSummary.yearlyAccidents} accidents/year</Text></View>
          <View style={styles.metricCard}><Text style={styles.metricLabel}>Trip time</Text><Text style={styles.metricValue}>{tripDuration}</Text><Text style={styles.metricHelper}>Current session</Text></View>
          <View style={styles.metricCard}><Text style={styles.metricLabel}>Last alert</Text><Text style={styles.metricValue}>{lastAlertTime}</Text><Text style={styles.metricHelper}>Most recent SOS</Text></View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Live readings</Text>
          <View style={styles.readingRow}><Text style={styles.readingName}>Acceleration</Text><Text style={styles.readingValue}>X {liveAccel.x.toFixed(2)}  Y {liveAccel.y.toFixed(2)}  Z {liveAccel.z.toFixed(2)} m/s²</Text></View>
          <View style={styles.readingRow}><Text style={styles.readingName}>Gyroscope</Text><Text style={styles.readingValue}>X {gyroData.x.toFixed(2)}  Y {gyroData.y.toFixed(2)}  Z {gyroData.z.toFixed(2)} rad/s</Text></View>
          <View style={styles.sensorSummary}>
            <View style={styles.sensorBox}><Text style={styles.sensorLabel}>Impact delta</Text><Text style={styles.sensorValue}>{currentImpact.toFixed(2)} m/s²</Text></View>
            <View style={styles.sensorBox}><Text style={styles.sensorLabel}>Angular velocity</Text><Text style={styles.sensorValue}>{currentAngularVelocity.toFixed(2)} rad/s</Text></View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Why the score changed</Text>
          {riskAnalysis.reasons.length > 0 ? riskAnalysis.reasons.map((reason) => (
            <View key={reason} style={styles.reasonChip}><MaterialCommunityIcons name="chevron-right" size={16} color="#D07A24" /><Text style={styles.reasonText}>{reason}</Text></View>
          )) : <Text style={styles.emptyText}>No critical triggers yet. Start monitoring to see live explanations.</Text>}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Emergency contacts</Text>
            <TouchableOpacity style={styles.inlineAction} onPress={pickContact}><MaterialCommunityIcons name="plus" size={16} color="#0F1722" /><Text style={styles.inlineActionText}>Import</Text></TouchableOpacity>
          </View>
          <Text style={styles.helperText}>These numbers receive your name, risk, trigger, and location in the SOS.</Text>
          <View style={styles.numberRow}>
            <TextInput style={styles.numberInput} placeholder="Add direct SOS number" placeholderTextColor="#7C8794" value={newPredefinedNumber} onChangeText={setNewPredefinedNumber} keyboardType="phone-pad" returnKeyType="done" onSubmitEditing={addPredefinedNumber} />
            <TouchableOpacity style={styles.addButton} onPress={addPredefinedNumber}><MaterialCommunityIcons name="plus" size={18} color="#08231C" /><Text style={styles.addButtonText}>Add</Text></TouchableOpacity>
          </View>
          {[...predefinedNumbers.map((phone) => ({ id: `pre-${phone}`, name: 'Direct SOS', phone, relation: 'Predefined' })), ...(emergencyContacts.length > 0 ? emergencyContacts : HELPLINES)].map((contact) => (
            <View key={contact.id} style={styles.contactRow}>
              <View style={styles.contactAvatar}><Text style={styles.contactAvatarText}>{contact.name.charAt(0)}</Text></View>
              <View style={styles.contactTextBlock}>
                <Text style={styles.contactName}>{contact.name}</Text>
                <Text style={styles.contactMeta}>{contact.relation || 'Emergency'} · {contact.phone}</Text>
              </View>
              {contact.relation === 'Predefined' ? <TouchableOpacity onPress={() => removePredefinedNumber(contact.phone)}><MaterialCommunityIcons name="close-circle" size={22} color="#B2455C" /></TouchableOpacity> : null}
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Activity</Text>
          {systemLogs.length > 0 ? systemLogs.map((log) => <Text key={log} style={styles.logEntry}>{log}</Text>) : <Text style={styles.emptyText}>No activity yet. Start monitoring to begin the trip.</Text>}
        </View>
      </ScrollView>

      {isAccidentDialogVisible ? (
        <View style={styles.accidentOverlay}>
          <View style={styles.accidentCard}>
            <Text style={styles.accidentTitle}>Possible accident detected</Text>
            <Text style={styles.accidentMessage}>Sending SOS in {accidentCountdown} seconds.</Text>
            <Text style={styles.accidentSubMessage}>Your contacts will receive your name, risk score, trigger, and current location.</Text>
            <View style={styles.accidentActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => void cancelAccidentFlow()}><Text style={styles.cancelButtonText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.sosButton} onPress={() => void triggerSOS()}><Text style={styles.sosButtonText}>Send SOS now</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F3F5F8' },
  content: { padding: 18, paddingBottom: 28, gap: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  eyebrow: { color: '#6E7B88', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 4 },
  title: { color: '#0F1722', fontSize: 28, fontWeight: '800', letterSpacing: 0.4 },
  subtitle: { color: '#546170', fontSize: 14, marginTop: 2 },
  statusPill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { color: '#F4F7FB', fontWeight: '700', fontSize: 12 },
  heroCard: { borderRadius: 28, padding: 20, borderWidth: 1, gap: 14 },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroLabel: { color: '#90A0B3', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1.1, marginBottom: 6 },
  heroValue: { fontSize: 56, fontWeight: '800', lineHeight: 60 },
  heroBadge: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  heroBadgeText: { color: '#0F1722', fontWeight: '800', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  heroMotion: { fontSize: 22, fontWeight: '700' },
  heroRecommendation: { color: '#D8E1EA', fontSize: 15, lineHeight: 22 },
  heroStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  heroStat: { flex: 1, minWidth: 90, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 18, padding: 12 },
  heroStatLabel: { color: '#90A0B3', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: 6 },
  heroStatValue: { color: '#F4F7FB', fontSize: 15, fontWeight: '700' },
  heroButtons: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  primaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 18, paddingHorizontal: 18, paddingVertical: 14, flex: 1, minWidth: 160 },
  primaryButtonText: { fontSize: 15, fontWeight: '800' },
  secondaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 18, paddingHorizontal: 18, paddingVertical: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', flex: 1, minWidth: 160 },
  secondaryButtonText: { color: '#F4F7FB', fontSize: 15, fontWeight: '700' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metricCard: { width: '48%', minWidth: 150, backgroundColor: '#FFFFFF', borderRadius: 22, padding: 16, borderWidth: 1, borderColor: '#E5EAF0' },
  metricLabel: { color: '#758394', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: 6 },
  metricValue: { color: '#0F1722', fontSize: 18, fontWeight: '800', marginBottom: 4 },
  metricHelper: { color: '#607081', fontSize: 12, lineHeight: 16 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 18, borderWidth: 1, borderColor: '#E5EAF0' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12 },
  sectionTitle: { color: '#0F1722', fontSize: 18, fontWeight: '800', marginBottom: 10 },
  readingRow: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#EEF2F6', gap: 6 },
  readingName: { color: '#0F1722', fontSize: 15, fontWeight: '700' },
  readingValue: { color: '#243244', fontSize: 13, fontWeight: '600' },
  sensorSummary: { flexDirection: 'row', gap: 12, marginTop: 16 },
  sensorBox: { flex: 1, backgroundColor: '#F4F7FB', borderRadius: 18, padding: 14 },
  sensorLabel: { color: '#6B798B', fontSize: 12, marginBottom: 6 },
  sensorValue: { color: '#0F1722', fontSize: 16, fontWeight: '800' },
  reasonChip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF4E9', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, marginTop: 10 },
  reasonText: { color: '#7C5114', fontSize: 13, fontWeight: '600', flex: 1 },
  emptyText: { color: '#738194', fontSize: 13, lineHeight: 19 },
  inlineAction: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#D7F3EA', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  inlineActionText: { color: '#0F1722', fontSize: 12, fontWeight: '700' },
  helperText: { color: '#657487', fontSize: 13, lineHeight: 19, marginBottom: 14 },
  numberRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  numberInput: { flex: 1, backgroundColor: '#F4F7FB', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: '#E5EAF0', color: '#0F1722' },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#32C48D', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12 },
  addButtonText: { color: '#08231C', fontWeight: '800' },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#EEF2F6' },
  contactAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#0F1722', alignItems: 'center', justifyContent: 'center' },
  contactAvatarText: { color: '#F4F7FB', fontSize: 16, fontWeight: '800' },
  contactTextBlock: { flex: 1 },
  contactName: { color: '#0F1722', fontSize: 15, fontWeight: '700', marginBottom: 2 },
  contactMeta: { color: '#657487', fontSize: 12 },
  logEntry: { color: '#243244', fontSize: 13, lineHeight: 19, paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#EEF2F6' },
  accidentOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8, 11, 16, 0.78)', justifyContent: 'center', alignItems: 'center', padding: 22 },
  accidentCard: { width: '100%', maxWidth: 360, backgroundColor: '#FFFFFF', borderRadius: 28, padding: 22 },
  accidentTitle: { color: '#A12A44', fontSize: 24, fontWeight: '800', marginBottom: 8 },
  accidentMessage: { color: '#0F1722', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  accidentSubMessage: { color: '#607081', fontSize: 13, lineHeight: 19 },
  accidentActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelButton: { flex: 1, backgroundColor: '#EDF1F5', borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  cancelButtonText: { color: '#0F1722', fontWeight: '700' },
  sosButton: { flex: 1, backgroundColor: '#FF4D67', borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  sosButtonText: { color: '#FFFFFF', fontWeight: '800' },
});
