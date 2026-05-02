import React, { useCallback, useEffect, useState } from 'react';
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
  error?.response?.data?.message || error?.message || 'Unable to load doctor dashboard.';

const StatCard = ({ label, value, helper, accentColor }) => (
  <View style={styles.statCard}>
    <View style={[styles.statAccent, { backgroundColor: accentColor }]} />
    <View style={styles.statBody}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statHelper}>{helper}</Text>
    </View>
  </View>
);

const DoctorDashboard = ({ navigation }) => {
  const { user, logout } = useAuth();
  const displayName = user?.username || user?.email || 'Doctor';
  const specialization = user?.specialization || user?.doctorProfile?.specialization;
  const [stats, setStats] = useState({
    totalAppointments: 0,
    confirmedToday: 0,
    pendingRequests: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchStats = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setError('');

    try {
      const response = await client.get('/doctor/stats');
      setStats({
        totalAppointments: response.data.stats?.totalAppointments || 0,
        confirmedToday: response.data.stats?.confirmedToday || 0,
        pendingRequests: response.data.stats?.pendingRequests || 0,
      });
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const loadingValue = isLoading ? '...' : null;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={() => fetchStats(true)} />
      }
    >
      <AnnouncementCarousel />

      <View style={styles.header}>
        <Text style={styles.eyebrow}>Doctor Portal</Text>
        <Text style={styles.title}>Welcome back, {displayName}</Text>
        <Text style={styles.subtitle}>
          {specialization ? `${specialization} consultations and appointments` : 'Manage consultations and patient appointments'}
        </Text>
      </View>

      <ErrorMessage message={error} />

      <View style={styles.statsGrid}>
        <StatCard
          label="Total Appointments"
          value={loadingValue || stats.totalAppointments}
          helper="All assigned bookings"
          accentColor={colors.primary}
        />
        <StatCard
          label="Confirmed Today"
          value={loadingValue || stats.confirmedToday}
          helper="Approved visits for today"
          accentColor={colors.success}
        />
        <StatCard
          label="Pending Requests"
          value={loadingValue || stats.pendingRequests}
          helper="Waiting for confirmation"
          accentColor="#F59E0B"
        />
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Quick Actions</Text>
        <Text style={styles.panelText}>Review bookings, maintain availability, or update your profile.</Text>

        <CustomButton
          title="My Appointments"
          onPress={() => navigation.navigate('DoctorAppointments')}
          style={styles.button}
        />
        <CustomButton
          title="My Schedule"
          type="secondary"
          onPress={() => navigation.navigate('DoctorSchedule')}
          style={styles.button}
        />
        <CustomButton
          title="Manage Prescriptions"
          type="secondary"
          onPress={() => navigation.navigate('ManagePrescriptions')}
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

export default DoctorDashboard;
