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
  error?.response?.data?.message || error?.message || 'Unable to load receptionist dashboard.';

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

const ReceptionistDashboard = ({ navigation }) => {
  const { user, logout } = useAuth();
  const displayName = user?.username || user?.email || 'Receptionist';
  const [stats, setStats] = useState({
    pendingConfirmations: 0,
    todaysAppointments: 0,
    totalConfirmed: 0,
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
      const response = await client.get('/receptionist/dashboard-stats');
      setStats({
        pendingConfirmations: response.data.stats?.pendingConfirmations || 0,
        todaysAppointments: response.data.stats?.todaysAppointments || 0,
        totalConfirmed: response.data.stats?.totalConfirmed || 0,
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
        <Text style={styles.eyebrow}>Receptionist Portal</Text>
        <Text style={styles.title}>Welcome back, {displayName}</Text>
        <Text style={styles.subtitle}>Coordinate paid appointments and daily confirmation flow.</Text>
      </View>

      <ErrorMessage message={error} />

      <View style={styles.statsGrid}>
        <StatCard
          label="Pending Confirmations"
          value={loadingValue || stats.pendingConfirmations}
          helper="Paid appointments awaiting confirmation"
          accentColor="#F59E0B"
        />
        <StatCard
          label="Today's Appointments"
          value={loadingValue || stats.todaysAppointments}
          helper="Appointments scheduled today"
          accentColor={colors.primary}
        />
        <StatCard
          label="Total Confirmed"
          value={loadingValue || stats.totalConfirmed}
          helper="Confirmed appointment records"
          accentColor={colors.success}
        />
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Quick Actions</Text>
        <Text style={styles.panelText}>Review paid appointments, finalize confirmations, or contact support.</Text>

        <CustomButton
          title="Manage Appointments"
          onPress={() => navigation.navigate('ManageAppointments')}
          style={styles.button}
        />
        <CustomButton
          title="Manage Schedules"
          type="secondary"
          onPress={() => navigation.navigate('ManageSchedules')}
          style={styles.button}
        />
        <CustomButton
          title="My Tickets"
          type="secondary"
          onPress={() => navigation.navigate('MyTickets')}
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

export default ReceptionistDashboard;
