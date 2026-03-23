import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Platform, Dimensions, SafeAreaView, Alert, Animated, Vibration, TextInput } from 'react-native';
import { Accelerometer, Gyroscope } from 'expo-sensors';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import axios from 'axios';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { LinearGradient } from 'expo-linear-gradient';
import * as Contacts from 'expo-contacts';
import * as Location from 'expo-location';

import { Config } from '../../constants/Config';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface ThreeAxisMeasurement {
  x: number;
  y: number;
  z: number;
}

interface Subscription {
  remove: () => void;
}

interface SensorSubscription {
  accel: Subscription;
  gyro: Subscription;
}

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relation?: string;
}

export default function HomeScreen() {
  const [accelData, setAccelData] = useState<ThreeAxisMeasurement>({ x: 0, y: 0, z: 0 });
  const [gyroData, setGyroData] = useState<ThreeAxisMeasurement>({ x: 0, y: 0, z: 0 });
  const [riskScore, setRiskScore] = useState<number>(0);
  const [isMonitoring, setIsMonitoring] = useState<boolean>(false);
  const [subscription, setSubscription] = useState<SensorSubscription | null>(null);
  const [accelHistoryX, setAccelHistoryX] = useState<number[]>([0, 0, 0, 0, 0, 0]);
  const [accelHistoryY, setAccelHistoryY] = useState<number[]>([0, 0, 0, 0, 0, 0]);
  const [accelHistoryZ, setAccelHistoryZ] = useState<number[]>([0, 0, 0, 0, 0, 0]);
  const [gyroHistoryX, setGyroHistoryX] = useState<number[]>([0, 0, 0, 0, 0, 0]);
  const [gyroHistoryY, setGyroHistoryY] = useState<number[]>([0, 0, 0, 0, 0, 0]);
  const [gyroHistoryZ, setGyroHistoryZ] = useState<number[]>([0, 0, 0, 0, 0, 0]);
  // X‑axis time labels for 30‑second moving window
  const [timeLabels, setTimeLabels] = useState<string[]>(["", "", "", "", "", ""]);
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [predefinedNumbers, setPredefinedNumbers] = useState<string[]>(Config.DEFAULT_EMERGENCY_NUMBERS?.length ? [...Config.DEFAULT_EMERGENCY_NUMBERS] : []);
  const [newPredefinedNumber, setNewPredefinedNumber] = useState<string>('');
  const [systemLogs, setSystemLogs] = useState<string[]>([]);
  const [tripStartTime, setTripStartTime] = useState<Date | null>(null);
  const [tripDuration, setTripDuration] = useState<string>('0:00');

  // Location and live metrics
  const [location, setLocation] = useState<{ latitude: number, longitude: number } | null>(null);
  const [locationName, setLocationName] = useState<string>('Fetching...');
  const [speed, setSpeed] = useState<number>(0);
  const [nearbyRoads, setNearbyRoads] = useState<string[]>([]);
  const [majorHighways, setMajorHighways] = useState<string[]>([]);
  const [estimatedCongestion, setEstimatedCongestion] = useState<number>(0);
  const [weather, setWeather] = useState<string>('Loading...');
  const [temperature, setTemperature] = useState<number>(0);
  const [trafficDensity, setTrafficDensity] = useState<string>('Unknown');
  const [accidentHistory, setAccidentHistory] = useState<string>('Loading...');
  const [riskLevel, setRiskLevel] = useState<string>('Unknown');
  const [lastAlertTime, setLastAlertTime] = useState<string>('None');
  const [confidenceScore, setConfidenceScore] = useState<number>(98);

  const [motionState, setMotionState] = useState<'Normal' | 'Bump' | 'Accident'>('Normal');
  const [isAccidentDialogVisible, setIsAccidentDialogVisible] = useState<boolean>(false);
  const [accidentCountdown, setAccidentCountdown] = useState<number>(10);
  const accidentTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  // Animation for risk indicator
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Helpline contacts (fallback)
  const helplineContacts: EmergencyContact[] = [
    { id: 'helpline-1', name: 'Police', phone: '100', relation: 'Emergency' },
    { id: 'helpline-2', name: 'Ambulance', phone: '108', relation: 'Medical' },
    { id: 'helpline-3', name: 'Fire', phone: '101', relation: 'Emergency' },
  ];

  const addPredefinedNumber = () => {
    const trimmed = newPredefinedNumber.trim().replace(/\s/g, '');
    if (!trimmed) return;
    if (predefinedNumbers.includes(trimmed)) {
      addLog('Number already in list');
      return;
    }
    setPredefinedNumbers(prev => [...prev, trimmed]);
    setNewPredefinedNumber('');
    addLog(`Added SOS number: ${trimmed}`);
  };

  const removePredefinedNumber = (number: string) => {
    setPredefinedNumbers(prev => prev.filter(n => n !== number));
    addLog(`Removed SOS number: ${number}`);
  };

  const pickContact = async () => {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Cannot access contacts without permission');
      return;
    }

    const { data } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.PhoneNumbers],
    });

    if (data.length > 0) {
      // Show contact picker
      const contactNames = data.map((c, i) => ({
        text: c.name || 'Unknown',
        onPress: () => {
          const phone = c.phoneNumbers?.[0]?.number || 'No phone';
          const newContact: EmergencyContact = {
            id: c.id || String(Date.now()),
            name: c.name || 'Unknown',
            phone: phone,
            relation: 'Emergency Contact',
          };
          setEmergencyContacts(prev => [...prev, newContact]);
        },
      }));

      Alert.alert(
        'Select Emergency Contact',
        'Choose a contact from your list',
        contactNames.slice(0, 10) // Limit to 10 for UI
      );
    }
  };

  // Helper function to add system logs
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setSystemLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 4)]);
  };

  const classifyMotionFromRisk = (score: number): 'Normal' | 'Bump' | 'Accident' => {
    if (score >= 70) return 'Accident';
    if (score >= 30) return 'Bump';
    return 'Normal';
  };

  const classifyMotionFromSensors = (accel: ThreeAxisMeasurement): 'Normal' | 'Bump' | 'Accident' => {
    // Calculate magnitude excluding baseline gravity if possible (naive approach)
    // For a phone at rest, magnitude is ~1.0 G
    const magnitude = Math.sqrt(
      accel.x * accel.x +
      accel.y * accel.y +
      accel.z * accel.z
    );

    // Increase thresholds significantly:
    // 4.0 G impact for accident, 2.5 G for significant bump
    if (magnitude >= 4.0) return 'Accident';
    if (magnitude >= 2.5) return 'Bump';
    return 'Normal';
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

      // Request audio permissions and set mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        staysActiveInBackground: true,
        playThroughEarpieceAndroid: false,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3' },
        { shouldPlay: false, isLooping: true, volume: 1.0 }
      );
      soundRef.current = sound;
      addLog('Alarm sound loaded');
    } catch (error) {
      console.error('Error loading sound:', error);
      addLog(`Sound load error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const playAlarmSound = async () => {
    try {
      if (!soundRef.current) {
        await loadAlarmSound();
      }
      if (soundRef.current) {
        await soundRef.current.replayAsync();
      }
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  };

  const stopAlarmSound = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
      }
    } catch (error) {
      console.error('Error stopping sound:', error);
    }
  };

  const triggerSOS = () => {
    clearAccidentTimer();
    Vibration.cancel();
    stopAlarmSound();
    setIsAccidentDialogVisible(false);
    setAccidentCountdown(10);
    addLog('Accident confirmed - sending SOS');
    sendSMSAlert();
  };

  const cancelAccidentFlow = () => {
    clearAccidentTimer();
    Vibration.cancel();
    stopAlarmSound();
    setIsAccidentDialogVisible(false);
    setAccidentCountdown(10);
    addLog('Accident alert cancelled by user');
  };

  const startAccidentFlow = () => {
    if (isAccidentDialogVisible) {
      return;
    }
    setIsAccidentDialogVisible(true);
    setAccidentCountdown(10);

    // Alert feedback
    Vibration.vibrate([0, 500, 500], true);
    playAlarmSound();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

    const timer = setInterval(() => {
      setAccidentCountdown(prev => {
        if (prev <= 1) {
          triggerSOS();
          return 0;
        }
        // Continuous haptic feedback every second
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        return prev - 1;
      });
    }, 1000);

    accidentTimerRef.current = timer;
  };

  // Send SMS alerts to predefined numbers + emergency contacts
  const sendSMSAlert = async () => {
    const fromContacts = emergencyContacts.map(c => c.phone);
    const allNumbers = [...new Set([...predefinedNumbers, ...fromContacts])].filter(Boolean);
    if (allNumbers.length === 0) {
      addLog('No emergency contacts or predefined numbers to alert');
      return;
    }

    try {
      const resp = await axios.post(Config.SMS_ALERT_URL, {
        phone_numbers: allNumbers,
        risk_score: riskScore,
        latitude: location?.latitude || 28.6139,
        longitude: location?.longitude || 77.2090
      });
      const message = resp?.data?.message ? String(resp.data.message) : `SOS request sent to ${allNumbers.length} number(s)`;
      addLog(message);
      if (resp?.data?.results) {
        const results = resp.data.results as any[];
        const failed = Array.isArray(results) ? results.filter(r => r && r.success === false) : [];
        if (failed.length > 0) {
          addLog(`Some SMS failed: ${failed.length}/${results.length}`);
        }
      }
      Alert.alert('SOS', message);
    } catch (error: any) {
      const backendMsg = error?.response?.data?.message;
      addLog(backendMsg ? `SOS failed: ${backendMsg}` : 'Failed to send SOS (network/backend error)');
      console.error('SMS error:', error?.response?.data || error);
      Alert.alert('SOS Failed', backendMsg || 'Network or backend error while sending SOS');
    }
  };

  // Fetch location name from OpenStreetMap (Nominatim)
  const fetchLocationName = async (lat: number, lon: number) => {
    try {
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
      );
      const address = response.data.address;
      const city = address.city || address.town || address.village || 'Unknown';
      const state = address.state || '';
      setLocationName(`${city}, ${state}`);
    } catch (error) {
      setLocationName('Location unavailable');
      console.error('Geocoding error:', error);
    }
  };

  // Fetch weather from Open-Meteo (free, no API key needed)
  const fetchWeather = async (lat: number, lon: number) => {
    try {
      const response = await axios.get(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
      );
      const current = response.data.current_weather;
      setTemperature(Math.round(current.temperature));

      // Weather code to description mapping
      const weatherCodes: { [key: number]: string } = {
        0: 'Clear', 1: 'Mainly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
        45: 'Foggy', 48: 'Foggy', 51: 'Drizzle', 61: 'Rain', 80: 'Rain Showers'
      };
      setWeather(weatherCodes[current.weathercode] || 'Clear');
    } catch (error) {
      setWeather('Unavailable');
      console.error('Weather error:', error);
    }
  };

  // Fetch regional traffic and accident data
  const fetchRegionalData = async (lat: number, lon: number) => {
    try {
      const response = await axios.get(
        `${Config.REGIONAL_DATA_URL}?lat=${lat}&lon=${lon}`
      );
      const data = response.data;

      setTrafficDensity(data.traffic.density);
      setAccidentHistory(`${data.accident_history.yearly_accidents} accidents/year`);
      setRiskLevel(data.accident_history.risk_level);

      addLog(`Region: ${data.city}, ${data.state} - ${data.accident_history.risk_level} risk`);
    } catch (error) {
      setTrafficDensity('Unknown');
      setAccidentHistory('Data unavailable');
      console.error('Regional data error:', error);
    }
  };

  // Fetch real‑time traffic data from Overpass API
  const fetchTrafficData = async (lat: number, lon: number) => {
    try {
      const response = await axios.get(
        `${Config.TRAFFIC_DATA_URL}?lat=${lat}&lon=${lon}`
      );
      const data = response.data;
      setTrafficDensity(data.traffic_density || data.traffic?.density || 'Unknown');
      setNearbyRoads(data.nearby_roads || []);
      setMajorHighways(data.major_highways || []);
      setEstimatedCongestion(data.estimated_congestion || data.congestion || 0);
      addLog(`Traffic fetched: ${data.traffic_density || data.traffic?.density}`);
    } catch (error) {
      console.error('Traffic API error:', error);
    }
  };
  // Start location tracking
  const startLocationTracking = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      addLog('Location permission denied');
      return;
    }

    addLog('Location tracking started');

    // Watch position with high accuracy
    Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 2000,
        distanceInterval: 10,
      },
      (loc) => {
        const { latitude, longitude, speed: gpsSpeed } = loc.coords;
        setLocation({ latitude, longitude });
        setSpeed(gpsSpeed ? Math.round(gpsSpeed * 3.6) : 0); // m/s to km/h

        // For the core accident/SOS demo we skip external
        // geocoding / weather / traffic APIs to avoid 403/404
        // errors and focus on motion + SOS.
      }
    );
  };

  // Pulse animation for high risk
  useEffect(() => {
    if (riskScore > 50) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [riskScore]);

  // Update trip duration
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isMonitoring && tripStartTime) {
      interval = setInterval(() => {
        const now = new Date();
        const diff = Math.floor((now.getTime() - tripStartTime.getTime()) / 1000);
        const minutes = Math.floor(diff / 60);
        const seconds = diff % 60;
        setTripDuration(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isMonitoring, tripStartTime]);

  const _subscribe = async () => {
    if (Platform.OS === 'web') return;

    const isAccelAvailable = await Accelerometer.isAvailableAsync();
    const isGyroAvailable = await Gyroscope.isAvailableAsync();

    if (!isAccelAvailable || !isGyroAvailable) {
      alert('Sensors not available');
      return;
    }

    setIsMonitoring(true);
    setTripStartTime(new Date());
    addLog('Trip monitoring started');
    startLocationTracking(); // Start GPS tracking
    Accelerometer.setUpdateInterval(200);
    Gyroscope.setUpdateInterval(200);

    const accelSub = Accelerometer.addListener((data: ThreeAxisMeasurement) => {
      setAccelData(data);
      setAccelHistoryX(prev => [...prev.slice(1), data.x]);
      setAccelHistoryY(prev => [...prev.slice(1), data.y]);
      setAccelHistoryZ(prev => [...prev.slice(1), data.z]);
    });

    const gyroSub = Gyroscope.addListener((data: ThreeAxisMeasurement) => {
      setGyroData(data);
      setGyroHistoryX(prev => [...prev.slice(1), data.x]);
      setGyroHistoryY(prev => [...prev.slice(1), data.y]);
      setGyroHistoryZ(prev => [...prev.slice(1), data.z]);
    });

    setSubscription({ accel: accelSub, gyro: gyroSub });
  };

  const _unsubscribe = () => {
    setIsMonitoring(false);
    setTripStartTime(null);
    addLog('Trip monitoring stopped');
    subscription?.accel && subscription.accel.remove();
    subscription?.gyro && subscription.gyro.remove();
    setSubscription(null);
  };

  useEffect(() => {
    let interval: any;
    if (isMonitoring) {
      interval = setInterval(() => {
        sendDataToBackend(accelData, gyroData);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isMonitoring, accelData, gyroData]);

  // Update X‑axis time labels every 3 seconds to reflect real time
  useEffect(() => {
    if (isMonitoring) {
      const updateLabels = () => {
        const now = new Date();
        const label = now.toLocaleTimeString('en-GB', { hour12: false }); // HH:MM:SS
        setTimeLabels(prev => {
          const newLabels = [...prev.slice(1), label];
          return newLabels;
        });
      };
      updateLabels(); // initial
      const labelInterval = setInterval(updateLabels, 3000);
      return () => clearInterval(labelInterval);
    }
  }, [isMonitoring]);

  // Emergency Alert Logic
  useEffect(() => {
    if (!isMonitoring) {
      setMotionState('Normal');
      return;
    }

    const sensorState = classifyMotionFromSensors(accelData);
    const riskState = classifyMotionFromRisk(riskScore);

    let finalState: 'Normal' | 'Bump' | 'Accident' = 'Normal';

    if (sensorState === 'Accident' || riskState === 'Accident') {
      finalState = 'Accident';
    } else if (sensorState === 'Bump' || riskState === 'Bump') {
      finalState = 'Bump';
    }

    setMotionState(finalState);

    if (finalState === 'Accident') {
      startAccidentFlow();
    }
  }, [accelData, riskScore, isMonitoring]);

  const sendDataToBackend = async (accel: ThreeAxisMeasurement, gyro: ThreeAxisMeasurement) => {
    try {
      const payload = {
        accel_x: accel.x, accel_y: accel.y, accel_z: accel.z,
        gyro_x: gyro.x, gyro_y: gyro.y, gyro_z: gyro.z,
      };
      const response = await axios.post(Config.SENSORS_DATA_URL, payload);
      if (response.data && response.data.accident_rate) {
        setRiskScore(response.data.accident_rate);
      }
    } catch (error: any) {
      // console.log('Error sending data:', error);
    }
  };

  useEffect(() => {
    loadAlarmSound();
    return () => {
      _unsubscribe();
      clearAccidentTimer();
      Vibration.cancel();
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  // --- UI Components ---

  const MetricCard = ({ icon, title, value, subValue, color }: any) => (
    <View style={styles.metricCard}>
      <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
        <MaterialCommunityIcons name={icon} size={24} color={color} />
      </View>
      <View>
        <Text style={styles.metricTitle}>{title}</Text>
        <Text style={styles.metricValue}>{value}</Text>
        {subValue && <Text style={styles.metricSubValue}>{subValue}</Text>}
      </View>
    </View>
  );

  const ContactCard = ({ name, relation, phone, color }: any) => (
    <View style={styles.contactCard}>
      <View style={[styles.contactAvatar, { backgroundColor: color }]}>
        <Text style={styles.avatarText}>{name.charAt(0)}</Text>
      </View>
      <View>
        <Text style={styles.contactName}>{name}</Text>
        <Text style={styles.contactRelation}>{relation}</Text>
        <Text style={styles.contactPhone}>{phone}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <View style={styles.logoBox}>
              <Text style={styles.logoText}>R</Text>
            </View>
            <View>
              <Text style={styles.appName}>REFLEX</Text>
              <Text style={styles.appTagline}>SMART VEHICLE SAFETY MONITOR</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.emergencyBtn}>
            <View style={styles.emergencyDot} />
            <Text style={styles.emergencyText}>Emergency Alert</Text>
          </TouchableOpacity>
        </View>

        {/* Main Dashboard Grid */}
        <View style={styles.gridContainer}>

          {/* Left Column: Safety Monitor */}
          <View style={styles.leftColumn}>
            <View style={styles.safetyCard}>
              {/* Background System Log */}
              <View style={styles.logBackgroundContainer} pointerEvents="none">
                {systemLogs.slice().reverse().map((log, index) => (
                  <Text key={index} style={styles.logBackgroundText}>
                    {`> ${log}`}
                  </Text>
                ))}
                {systemLogs.length === 0 && (
                  <Text style={styles.logBackgroundText}>{"> System Ready..."}</Text>
                )}
              </View>

              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="shield-check" size={20} color="#00E5FF" />
                <Text style={styles.cardTitle}>Safety Monitor</Text>
              </View>

              <View style={styles.riskCircleContainer}>
                <TouchableOpacity onPress={isMonitoring ? _unsubscribe : _subscribe} style={{ alignItems: 'center' }}>
                  <Animated.View style={[
                    styles.riskCircle,
                    {
                      borderColor: isMonitoring ? (riskScore > 50 ? '#FF3B30' : '#34C759') : '#00E5FF',
                      transform: [{ scale: pulseAnim }]
                    }
                  ]}>
                    {isMonitoring ? (
                      <>
                        <Text style={[styles.riskValue, { color: riskScore > 50 ? '#FF3B30' : '#34C759' }]}>
                          {Math.round(riskScore)}%
                        </Text>
                        <Text style={[styles.riskLabel, { color: riskScore > 50 ? '#FF3B30' : '#34C759' }]}>
                          {riskScore > 50 ? 'CRITICAL' : 'SAFE'}
                        </Text>
                      </>
                    ) : (
                      <Text style={[styles.riskValue, { color: '#00E5FF', fontSize: 32 }]}>START</Text>
                    )}
                  </Animated.View>
                </TouchableOpacity>
              </View>

              {isMonitoring && (
                <Text style={styles.motionStateText}>
                  MOTION: {motionState.toUpperCase()}
                </Text>
              )}

              {isMonitoring && (
                <View style={styles.safetyStatsRow}>
                  <View style={styles.safetyStat}>
                    <Text style={styles.statValue}>98%</Text>
                    <Text style={styles.statLabel}>CONFIDENCE</Text>
                  </View>
                  <View style={styles.safetyStat}>
                    <Text style={[styles.statValue, { color: '#00E5FF' }]}>None</Text>
                    <Text style={styles.statLabel}>LAST ALERT</Text>
                  </View>
                  <View style={styles.safetyStat}>
                    <Text style={[styles.statValue, { color: '#FFD60A' }]}>{tripDuration}</Text>
                    <Text style={styles.statLabel}>TRIP TIME</Text>
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={[styles.testSoundBtn, { marginTop: 10 }]}
                onPress={async () => {
                  try {
                    addLog('Testing sound...');
                    await playAlarmSound();
                    setTimeout(() => stopAlarmSound(), 3000);
                  } catch (e) {
                    addLog(`Test failed: ${e}`);
                  }
                }}
              >
                <MaterialCommunityIcons name="volume-high" size={20} color="#00E5FF" />
                <Text style={styles.testSoundText}>TEST ALARM SOUND</Text>
              </TouchableOpacity>
            </View>

            {/* Accelerometer Chart */}
            <View style={styles.chartCard}>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="axis-arrow" size={20} color="#00E5FF" />
                <Text style={styles.cardTitle}>Accelerometer (m/s²)</Text>
              </View>
              <LineChart
                data={{
                  labels: timeLabels,
                  datasets: [
                    { data: accelHistoryX, color: (opacity = 1) => `rgba(255, 59, 48, ${opacity})`, strokeWidth: 2 }, // Red X
                    { data: accelHistoryY, color: (opacity = 1) => `rgba(52, 199, 89, ${opacity})`, strokeWidth: 2 }, // Green Y
                    { data: accelHistoryZ, color: (opacity = 1) => `rgba(0, 229, 255, ${opacity})`, strokeWidth: 2 }  // Blue Z
                  ],
                  legend: ["X", "Y", "Z"]
                }}
                width={SCREEN_WIDTH * 0.9}
                height={180}
                chartConfig={{
                  backgroundColor: "#1E1E1E",
                  backgroundGradientFrom: "#1E1E1E",
                  backgroundGradientTo: "#1E1E1E",
                  decimalPlaces: 1,
                  color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                  propsForDots: { r: "0" }
                }}
                bezier
                style={styles.chart}
              />
            </View>

            {/* Gyroscope Chart */}
            <View style={styles.chartCard}>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="rotate-3d-variant" size={20} color="#FFD60A" />
                <Text style={styles.cardTitle}>Gyroscope (rad/s)</Text>
              </View>
              <LineChart
                data={{
                  labels: ["", "", "", "", "", ""],
                  datasets: [
                    { data: gyroHistoryX, color: (opacity = 1) => `rgba(255, 59, 48, ${opacity})`, strokeWidth: 2 }, // Red X
                    { data: gyroHistoryY, color: (opacity = 1) => `rgba(52, 199, 89, ${opacity})`, strokeWidth: 2 }, // Green Y
                    { data: gyroHistoryZ, color: (opacity = 1) => `rgba(255, 214, 10, ${opacity})`, strokeWidth: 2 }  // Yellow Z
                  ],
                  legend: ["X", "Y", "Z"]
                }}
                width={SCREEN_WIDTH * 0.9}
                height={180}
                chartConfig={{
                  backgroundColor: "#1E1E1E",
                  backgroundGradientFrom: "#1E1E1E",
                  backgroundGradientTo: "#1E1E1E",
                  decimalPlaces: 1,
                  color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                  propsForDots: { r: "0" }
                }}
                bezier
                style={styles.chart}
              />
            </View>
          </View>
        </View>

        {/* Metrics Grid */}
        <Text style={styles.sectionTitle}>Live Trip Metrics</Text>
        <View style={styles.metricsGrid}>
          <MetricCard
            icon="speedometer"
            title="SPEED"
            value={`${speed} km/h`}
            color="#00E5FF"
          />
          <MetricCard
            icon="map-marker"
            title="LOCATION"
            value={locationName}
            subValue={location ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}` : 'GPS off'}
            color="#00E5FF"
          />
          <MetricCard
            icon="map-marker-radius"
            title="COORDINATES"
            value={location ? `${location.latitude.toFixed(6)}°` : 'N/A'}
            subValue={location ? `${location.longitude.toFixed(6)}°` : 'N/A'}
            color="#34C759"
          />
          <MetricCard
            icon="weather-cloudy"
            title="WEATHER"
            value={`${weather}, ${temperature}°C`}
            color="#00E5FF"
          />
          <MetricCard
            icon="car-multiple"
            title="TRAFFIC"
            value={trafficDensity}
            subValue={`Congestion: ${estimatedCongestion}%`}
            color="#FFD60A"
          />
          {/* Nearby Roads */}
          <MetricCard
            icon="road-variant"
            title="NEARBY ROADS"
            value={nearbyRoads.length > 0 ? nearbyRoads.join(', ') : 'None'}
            color="#34C759"
          />
          {/* Major Highways */}
          <MetricCard
            icon="highway"
            title="MAJOR HIGHWAYS"
            value={majorHighways.length > 0 ? majorHighways.join(', ') : 'None'}
            color="#FF3B30"
          />
          <MetricCard
            icon="alert-circle"
            title="ACCIDENT HISTORY"
            value={accidentHistory}
            subValue={`Risk: ${riskLevel}`}
            color={riskLevel === 'High' ? '#FF3B30' : riskLevel === 'Medium' ? '#FFD60A' : '#34C759'}
          />
        </View>

        {/* Predefined SOS numbers */}
        <Text style={styles.sectionTitle}>Predefined SOS numbers</Text>
        <Text style={styles.predefinedHint}>These numbers always receive the SOS alert with your location when countdown ends.</Text>
        <View style={styles.predefinedRow}>
          <TextInput
            style={styles.predefinedInput}
            placeholder="e.g. +919876543210"
            placeholderTextColor="#666"
            value={newPredefinedNumber}
            onChangeText={setNewPredefinedNumber}
            keyboardType="phone-pad"
            returnKeyType="done"
            onSubmitEditing={addPredefinedNumber}
          />
          <TouchableOpacity style={styles.predefinedAddBtn} onPress={addPredefinedNumber}>
            <MaterialCommunityIcons name="plus" size={22} color="#121212" />
            <Text style={styles.predefinedAddBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
        {predefinedNumbers.length > 0 && (
          <View style={styles.predefinedList}>
            {predefinedNumbers.map((num) => (
              <View key={num} style={styles.predefinedItem}>
                <MaterialCommunityIcons name="phone" size={18} color="#00E5FF" />
                <Text style={styles.predefinedItemText}>{num}</Text>
                <TouchableOpacity onPress={() => removePredefinedNumber(num)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <MaterialCommunityIcons name="close-circle" size={22} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Emergency Contacts */}
        <View style={styles.contactsHeader}>
          <Text style={styles.sectionTitle}>Emergency Contacts</Text>
          <TouchableOpacity style={styles.addContactBtn} onPress={pickContact}>
            <MaterialCommunityIcons name="plus-circle" size={24} color="#00E5FF" />
          </TouchableOpacity>
        </View>

        {emergencyContacts.length === 0 && predefinedNumbers.length === 0 ? (
          <View style={styles.noContactsContainer}>
            <Text style={styles.noContactsText}>No emergency contacts selected</Text>
            <Text style={styles.helplineText}>Showing helpline numbers:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.contactsScroll}>
              {helplineContacts.map((contact, index) => (
                <ContactCard
                  key={contact.id}
                  name={contact.name}
                  relation={contact.relation}
                  phone={contact.phone}
                  color={index === 0 ? '#FF3B30' : index === 1 ? '#34C759' : '#FFD60A'}
                />
              ))}
            </ScrollView>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.contactsScroll}>
            {predefinedNumbers.map((num, index) => (
              <View key={`pre-${num}`} style={styles.contactCard}>
                <View style={[styles.contactAvatar, { backgroundColor: '#00E5FF' }]}>
                  <MaterialCommunityIcons name="phone" size={20} color="#121212" />
                </View>
                <View>
                  <Text style={styles.contactName}>SOS #{index + 1}</Text>
                  <Text style={styles.contactRelation}>Predefined</Text>
                  <Text style={styles.contactPhone}>{num}</Text>
                </View>
              </View>
            ))}
            {emergencyContacts.map((contact, index) => (
              <ContactCard
                key={contact.id}
                name={contact.name}
                relation={contact.relation || 'Emergency'}
                phone={contact.phone}
                color={index % 3 === 0 ? '#00E5FF' : index % 3 === 1 ? '#34C759' : '#FFD60A'}
              />
            ))}
          </ScrollView>
        )}
      </ScrollView>
      {isAccidentDialogVisible && (
        <View style={styles.accidentOverlay}>
          <View style={styles.accidentCard}>
            <Text style={styles.accidentTitle}>Accident Detected</Text>
            <Text style={styles.accidentMessage}>
              Sending SOS in {accidentCountdown} seconds...
            </Text>
            <Text style={styles.accidentSubMessage}>
              Your emergency contacts will receive an alert with your GPS location.
            </Text>
            <View style={styles.accidentButtonsRow}>
              <TouchableOpacity
                style={[styles.accidentButton, styles.cancelButton]}
                onPress={cancelAccidentFlow}
              >
                <Text style={styles.cancelButtonText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.accidentButton, styles.sosButton]}
                onPress={triggerSOS}
              >
                <Text style={styles.sosButtonText}>SEND SOS NOW</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 10,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoBox: {
    width: 32,
    height: 32,
    backgroundColor: '#00E5FF',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  logoText: {
    color: '#121212',
    fontWeight: 'bold',
    fontSize: 20,
  },
  appName: {
    color: '#00E5FF',
    fontWeight: 'bold',
    fontSize: 18,
    letterSpacing: 1,
  },
  appTagline: {
    color: '#666',
    fontSize: 8,
    fontWeight: 'bold',
  },
  emergencyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  emergencyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
    marginRight: 6,
  },
  emergencyText: {
    color: '#CCC',
    fontSize: 12,
    fontWeight: '600',
  },
  gridContainer: {
    marginBottom: 20,
  },
  leftColumn: {
    gap: 16,
  },
  safetyCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333',
    overflow: 'hidden', // Ensure background log stays inside
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 8,
  },
  cardTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  riskCircleContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  riskCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  riskValue: {
    fontSize: 36,
    fontWeight: 'bold',
  },
  riskLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  safetyStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#121212',
    padding: 16,
    borderRadius: 12,
  },
  safetyStat: {
    alignItems: 'center',
  },
  statValue: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    color: '#666',
    fontSize: 10,
    fontWeight: 'bold',
  },
  motionStateText: {
    color: '#FFD60A',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  chartCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 20,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
    paddingRight: 40,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    marginTop: 8,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricTitle: {
    color: '#666',
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  metricValue: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  metricSubValue: {
    color: '#999',
    fontSize: 10,
  },
  contactsScroll: {
    marginBottom: 24,
  },
  predefinedHint: {
    color: '#999',
    fontSize: 12,
    marginBottom: 10,
  },
  predefinedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  predefinedInput: {
    flex: 1,
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFF',
    fontSize: 16,
  },
  predefinedAddBtn: {
    backgroundColor: '#00E5FF',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  predefinedAddBtnText: {
    color: '#121212',
    fontWeight: '700',
    fontSize: 14,
  },
  predefinedList: {
    marginBottom: 20,
    gap: 8,
  },
  predefinedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    gap: 10,
  },
  predefinedItemText: {
    flex: 1,
    color: '#FFF',
    fontSize: 14,
  },
  contactCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#333',
    flexDirection: 'row',
    alignItems: 'center',
    width: 200,
    gap: 12,
  },
  contactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#121212',
    fontWeight: 'bold',
    fontSize: 18,
  },
  contactName: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  contactRelation: {
    color: '#999',
    fontSize: 12,
  },
  contactPhone: {
    color: '#666',
    fontSize: 10,
    marginTop: 2,
  },
  mainButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 10,
  },
  gradientBtn: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  mainBtnText: {
    color: '#121212',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  startBtn: {},
  stopBtn: {},
  contactsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addContactBtn: {
    padding: 8,
  },
  noContactsContainer: {
    marginBottom: 24,
  },
  noContactsText: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  helplineText: {
    color: '#FFD60A',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: 'bold',
  },
  logCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 24,
    minHeight: 150,
  },
  noLogsText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 20,
  },
  logEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  logText: {
    color: '#CCC',
    fontSize: 12,
    flex: 1,
  },
  logBackgroundContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    justifyContent: 'flex-end',
    opacity: 0.15, // Faint background effect
    zIndex: 0,
  },
  logBackgroundText: {
    color: '#00E5FF',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 10,
    marginBottom: 2,
  },
  accidentOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  accidentCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#FF3B30',
    width: '100%',
    maxWidth: 380,
  },
  accidentTitle: {
    color: '#FF3B30',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  accidentMessage: {
    color: '#FFF',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  accidentSubMessage: {
    color: '#999',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
  },
  accidentButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 12,
  },
  accidentButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#333',
  },
  sosButton: {
    backgroundColor: '#FF3B30',
  },
  cancelButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  sosButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  testSoundBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderWidth: 1,
    borderColor: '#00E5FF',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  testSoundText: {
    color: '#00E5FF',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});
