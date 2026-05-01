import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
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

const getAppointmentBadgeStyle = (status) => {
  if (status === 'Confirmed') {
    return styles.confirmedBadge;
  }

  if (status === 'Pending') {
    return styles.pendingBadge;
  }

  return styles.neutralBadge;
};

const getPaymentBadgeStyle = (status) => {
  if (status === 'Confirmed') {
    return styles.confirmedBadge;
  }

  if (status === 'Pending') {
    return styles.pendingBadge;
  }

  return styles.neutralBadge;
};

const DoctorAppointmentsScreen = ({ navigation }) => {
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
      const response = await client.get('/doctor/appointments');
      const confirmedAppointments = (response.data.appointments || []).filter(
        (appointment) => appointment.status === 'Confirmed'
      );
      setAppointments(confirmedAppointments);
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

  const handleCompleteAppointment = (appointmentId) => {
    Alert.alert('Complete Consultation', 'Mark this appointment as completed and ready for prescription?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Complete',
        onPress: async () => {
          try {
            await client.patch(`/doctor/appointments/${appointmentId}/complete`);
            await fetchAppointments(true);
            Alert.alert('Completed', 'The appointment is ready for prescription.');
          } catch (completeError) {
            Alert.alert('Action Failed', getErrorMessage(completeError));
          }
        },
      },
    ]);
  };

  const renderAppointment = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.patientBlock}>
          <Text style={styles.appointmentCode}>
            {item.appointmentCode || 'Appointment'}
          </Text>
          <Text style={styles.patientName}>
            {item.patient?.username || item.patientSnapshot?.username || 'Patient'}
          </Text>
          <Text style={styles.meta}>
            {item.patient?.userCode || item.patientSnapshot?.userCode || 'Patient ID unavailable'}
          </Text>
        </View>
        <Text style={[styles.statusBadge, getAppointmentBadgeStyle(item.status)]}>
          {item.status}
        </Text>
      </View>

      <View style={styles.detailGrid}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Date</Text>
          <Text style={styles.detailValue}>{formatDate(item.appointmentDate)}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Time</Text>
          <Text style={styles.detailValue}>{item.appointmentTime}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Payment</Text>
          <Text style={[styles.detailBadge, getPaymentBadgeStyle(item.paymentStatus)]}>
            {item.paymentStatus}
          </Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        <CustomButton
          title="Mark Completed"
          onPress={() => handleCompleteAppointment(item._id)}
          style={styles.actionButton}
        />
        <CustomButton
          title="Manage Prescriptions"
          type="secondary"
          onPress={() => navigation.navigate('ManagePrescriptions')}
          style={styles.actionButton}
        />
      </View>
    </View>
  );

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
        ListEmptyComponent={<Text style={styles.emptyText}>No confirmed appointments found.</Text>}
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
  patientBlock: {
    flex: 1,
  },
  appointmentCode: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  patientName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  meta: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 4,
  },
  statusBadge: {
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
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
    minWidth: '30%',
    padding: 10,
  },
  detailLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  detailValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  detailBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 8,
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
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 16,
    textAlign: 'center',
  },
});

export default DoctorAppointmentsScreen;
