import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import client from '../../api/client';
import AnnouncementCarousel from '../../components/AnnouncementCarousel';
import CustomButton from '../../components/CustomButton';
import ErrorMessage from '../../components/ErrorMessage';
import { useAuth } from '../../context/AuthContext';
import colors from '../../theme/colors';

const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || 'Unable to load dashboard.';

const StatCard = ({ label, value, accentColor, helper }) => (
  <View style={styles.statCard}>
    <View style={[styles.statAccent, { backgroundColor: accentColor }]} />
    <View style={styles.statBody}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statHelper}>{helper}</Text>
    </View>
  </View>
);

const PatientDashboard = ({ navigation }) => {
  const { user, logout } = useAuth();
  const displayName = user?.username || user?.email || 'Patient';
  const [appointments, setAppointments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchAppointments = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setError('');

    try {
      const response = await client.get('/patient/appointments/my');
      setAppointments(response.data.appointments || []);
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const stats = useMemo(() => {
    const confirmed = appointments.filter((item) => item.status === 'Confirmed').length;
    const pending = appointments.filter((item) => item.status === 'Pending').length;

    return {
      total: appointments.length,
      confirmed,
      pending,
    };
  }, [appointments]);

  const loadingValue = isLoading ? '...' : null;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={() => fetchAppointments(true)} />
      }
    >
      <AnnouncementCarousel />

      <View style={styles.header}>
        <Text style={styles.eyebrow}>Patient Portal</Text>
        <Text style={styles.title}>Welcome, {displayName}</Text>
        <Text style={styles.subtitle}>Track appointment requests and manage your care visits.</Text>
      </View>

      <ErrorMessage message={error} />

      <View style={styles.statsGrid}>
        <StatCard
          label="Total Appointments"
          value={loadingValue || stats.total}
          helper="All appointment records"
          accentColor={colors.primary}
        />
        <StatCard
          label="Confirmed"
          value={loadingValue || stats.confirmed}
          helper="Approved appointments"
          accentColor={colors.success}
        />
        <StatCard
          label="Pending"
          value={loadingValue || stats.pending}
          helper="Awaiting confirmation"
          accentColor="#F59E0B"
        />
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Quick Actions</Text>
        <Text style={styles.panelText}>Book a doctor, review appointments, or update your details.</Text>

        <CustomButton
          title="Book Appointment"
          onPress={() => navigation.navigate('DoctorList')}
          style={styles.button}
        />
        <CustomButton
          title="My Appointments"
          type="secondary"
          onPress={() => navigation.navigate('MyAppointments')}
          style={styles.button}
        />
        <CustomButton
          title="My Prescriptions"
          type="secondary"
          onPress={() => navigation.navigate('MyPrescriptions')}
          style={styles.button}
        />
        <CustomButton
          title="My Payments"
          type="secondary"
          onPress={() => navigation.navigate('MyPayments')}
          style={styles.button}
        />
        <CustomButton
          title="My Profile"
          type="secondary"
          onPress={() => navigation.navigate('MyProfile')}
          style={styles.button}
        />
        <CustomButton
          title="Log Out"
          type="secondary"
          onPress={logout}
          style={styles.button}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: 16,
    paddingBottom: 28,
  },
  header: {
    marginBottom: 16,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 27,
    fontWeight: '800',
    lineHeight: 34,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  statsGrid: {
    gap: 12,
  },
  statCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  statAccent: {
    width: 6,
  },
  statBody: {
    flex: 1,
    padding: 16,
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  statValue: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
    marginTop: 6,
  },
  statHelper: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 16,
    padding: 16,
  },
  panelTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  panelText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
  },
  button: {
    alignSelf: 'stretch',
    marginTop: 12,
  },
});

export default PatientDashboard;
