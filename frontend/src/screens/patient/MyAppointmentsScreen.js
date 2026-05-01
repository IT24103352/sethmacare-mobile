import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import client from '../../api/client';
import CustomButton from '../../components/CustomButton';
import ErrorMessage from '../../components/ErrorMessage';
import Loading from '../../components/Loading';
import colors from '../../theme/colors';

const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || 'Unable to load appointments.';

const formatDate = (value) => {
  if (!value) {
    return 'Unknown date';
  }

  return new Date(value).toLocaleDateString();
};

const getBadgeStyle = (status) => {
  if (status === 'Confirmed') {
    return styles.confirmedBadge;
  }

  if (status === 'Pending' || status === 'Paid') {
    return styles.pendingBadge;
  }

  return styles.neutralBadge;
};

const Detail = ({ label, value }) => (
  <View style={styles.detailItem}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value || 'N/A'}</Text>
  </View>
);

const MyAppointmentsScreen = () => {
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

  const handleCancel = (appointmentId) => {
    Alert.alert('Cancel Appointment', 'Do you want to cancel this appointment and remove its pending payment?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Cancel Appointment',
        style: 'destructive',
        onPress: async () => {
          try {
            await client.delete(`/appointments/${appointmentId}`);
            await fetchAppointments(true);
          } catch (cancelError) {
            Alert.alert('Cancel Failed', getErrorMessage(cancelError));
          }
        },
      },
    ]);
  };

  const renderAppointment = ({ item }) => {
    const doctorName = item.doctor?.username || item.doctorSnapshot?.username || 'Doctor';
    const canCancel = item.status !== 'Confirmed' && item.status !== 'Completed' && item.status !== 'Prescribed';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.titleBlock}>
            <Text style={styles.appointmentCode}>{item.appointmentCode || 'Appointment'}</Text>
            <Text style={styles.doctorName}>{doctorName}</Text>
          </View>
          <Text style={[styles.statusBadge, getBadgeStyle(item.status)]}>{item.status}</Text>
        </View>

        <View style={styles.detailGrid}>
          <Detail label="Date" value={formatDate(item.appointmentDate)} />
          <Detail label="Time" value={item.appointmentTime} />
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Payment</Text>
            <Text style={[styles.inlineBadge, getBadgeStyle(item.paymentStatus)]}>
              {item.paymentStatus || 'Pending'}
            </Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Appointment</Text>
            <Text style={[styles.inlineBadge, getBadgeStyle(item.status)]}>
              {item.status || 'Pending'}
            </Text>
          </View>
        </View>

        {canCancel ? (
          <CustomButton
            title="Cancel"
            type="secondary"
            onPress={() => handleCancel(item._id)}
            style={styles.cancelButton}
          />
        ) : null}
      </View>
    );
  };

  if (isLoading) {
    return <Loading />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Appointments</Text>
      <ErrorMessage message={error} />
      <FlatList
        data={appointments}
        keyExtractor={(item) => item._id}
        renderItem={renderAppointment}
        contentContainerStyle={appointments.length ? styles.list : styles.emptyList}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => fetchAppointments(true)} />
        }
        ListEmptyComponent={<Text style={styles.emptyText}>No appointments found.</Text>}
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
    marginBottom: 14,
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
    marginBottom: 12,
  },
  titleBlock: {
    flex: 1,
  },
  appointmentCode: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  doctorName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  detailItem: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: '47%',
    padding: 10,
  },
  detailLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 5,
  },
  detailValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  statusBadge: {
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  inlineBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  confirmedBadge: {
    backgroundColor: colors.successBackground,
    color: colors.success,
  },
  pendingBadge: {
    backgroundColor: '#FEF3C7',
    color: '#B45309',
  },
  neutralBadge: {
    backgroundColor: colors.errorBackground,
    color: colors.error,
  },
  cancelButton: {
    marginTop: 12,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 16,
    textAlign: 'center',
  },
});

export default MyAppointmentsScreen;
