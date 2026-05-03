import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import client from '../../api/client';
import ErrorMessage from '../../components/ErrorMessage';
import Loading from '../../components/Loading';
import colors from '../../theme/colors';

const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || 'Unable to load schedule.';

const formatDate = (value) => {
  if (!value) {
    return 'Unknown date';
  }

  return new Date(value).toLocaleDateString();
};

const getStatusStyle = (status) => {
  if (status === 'Available') {
    return styles.availableBadge;
  }

  if (status === 'Booked') {
    return styles.bookedBadge;
  }

  return styles.cancelledBadge;
};

const isUpcomingSchedule = (schedule) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const scheduleDate = new Date(schedule.scheduleDate);
  scheduleDate.setHours(0, 0, 0, 0);

  return scheduleDate >= todayStart;
};

const DoctorScheduleScreen = () => {
  const [schedules, setSchedules] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchSchedules = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setError('');

    try {
      const response = await client.get('/doctor/schedules');
      setSchedules((response.data.schedules || []).filter(isUpcomingSchedule));
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const renderSchedule = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleGroup}>
          <Text style={styles.slotDate}>{formatDate(item.scheduleDate)}</Text>
          <Text style={styles.meta}>
            Time: {item.startTime}
            {item.endTime ? ` - ${item.endTime}` : ''}
          </Text>
        </View>
        <Text style={[styles.statusBadge, getStatusStyle(item.status)]}>{item.status}</Text>
      </View>
    </View>
  );

  if (isLoading) {
    return <Loading />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Schedule</Text>
      <Text style={styles.subtitle}>Your upcoming roster is managed by the receptionist team.</Text>

      <ErrorMessage message={error} />

      <FlatList
        data={schedules}
        keyExtractor={(item) => item._id}
        renderItem={renderSchedule}
        contentContainerStyle={schedules.length ? styles.list : styles.emptyList}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => fetchSchedules(true)} />
        }
        ListEmptyComponent={<Text style={styles.emptyText}>No upcoming schedule slots found.</Text>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 16,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
    marginTop: 4,
  },
  list: {
    paddingBottom: 24,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 14,
  },
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  cardTitleGroup: {
    flex: 1,
  },
  slotDate: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 6,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: 4,
  },
  statusBadge: {
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  availableBadge: {
    backgroundColor: colors.successBackground,
    color: colors.success,
  },
  bookedBadge: {
    backgroundColor: '#DBEAFE',
    color: colors.primary,
  },
  cancelledBadge: {
    backgroundColor: colors.errorBackground,
    color: colors.error,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 16,
    textAlign: 'center',
  },
});

export default DoctorScheduleScreen;
