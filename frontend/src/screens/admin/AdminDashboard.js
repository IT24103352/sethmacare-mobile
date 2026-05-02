import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import client from '../../api/client';
import CustomButton from '../../components/CustomButton';
import ErrorMessage from '../../components/ErrorMessage';
import { useAuth } from '../../context/AuthContext';
import colors from '../../theme/colors';

const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || 'Unable to load dashboard stats.';

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

const AdminDashboard = ({ navigation }) => {
  const { user, logout } = useAuth();
  const displayName = user?.username || user?.email || 'Admin';
  const [users, setUsers] = useState([]);
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
      const response = await client.get('/auth/users');
      setUsers(response.data.users || []);
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

  const stats = useMemo(() => {
    const doctorCount = users.filter((item) => item.role === 'Doctor').length;
    const pendingCount = users.filter((item) => !item.confirmed).length;

    return {
      totalUsers: users.length,
      doctors: doctorCount,
      pending: pendingCount,
    };
  }, [users]);

  const loadingValue = isLoading ? '...' : null;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={() => fetchStats(true)} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Admin Portal</Text>
        <Text style={styles.title}>Welcome back, {displayName}</Text>
        <Text style={styles.subtitle}>Monitor account activity and manage user access.</Text>
      </View>

      <ErrorMessage message={error} />

      <View style={styles.statsGrid}>
        <StatCard
          label="Total Users"
          value={loadingValue || stats.totalUsers}
          helper="All registered accounts"
          accentColor={colors.primary}
        />
        <StatCard
          label="Doctors"
          value={loadingValue || stats.doctors}
          helper="Confirmed and pending doctors"
          accentColor={colors.secondary}
        />
        <StatCard
          label="Pending Confirmation"
          value={loadingValue || stats.pending}
          helper="Accounts awaiting approval"
          accentColor="#F59E0B"
        />
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Quick Actions</Text>
        <Text style={styles.panelText}>Open the user registry or update your profile details.</Text>

        <CustomButton
          title="Manage Users"
          onPress={() => navigation.navigate('ManageUsers')}
          style={styles.button}
        />
        <CustomButton
          title="Manage Announcements"
          type="secondary"
          onPress={() => navigation.navigate('ManageAnnouncements')}
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

export default AdminDashboard;
