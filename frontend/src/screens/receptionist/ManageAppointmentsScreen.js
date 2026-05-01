import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import client from '../../api/client';
import CustomButton from '../../components/CustomButton';
import ErrorMessage from '../../components/ErrorMessage';
import Loading from '../../components/Loading';
import colors from '../../theme/colors';

const statusFilters = ['All', 'Paid', 'Confirmed', 'Pending', 'Rejected'];

const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || 'Unable to load appointments.';

const formatDate = (value) => {
  if (!value) {
    return 'Unknown date';
  }

  return new Date(value).toLocaleDateString();
};

const ManageAppointmentsScreen = () => {
  const [appointments, setAppointments] = useState([]);
  const [statusFilter, setStatusFilter] = useState('All');
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
      const params = statusFilter === 'All' ? {} : { status: statusFilter };
      const response = await client.get('/receptionist/appointments', { params });
      setAppointments(response.data.appointments || []);
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const confirmPaidAppointment = async (appointmentId) => {
    try {
      await client.patch(`/receptionist/confirm-appointment/${appointmentId}`);
      await fetchAppointments(true);
    } catch (updateError) {
      Alert.alert('Action Failed', getErrorMessage(updateError));
    }
  };

  const rejectPendingAppointment = async (appointmentId) => {
    try {
      await client.patch(`/receptionist/appointments/${appointmentId}/reject`);
      await fetchAppointments(true);
    } catch (updateError) {
      Alert.alert('Action Failed', getErrorMessage(updateError));
    }
  };

  const renderFilter = (filter) => {
    const selected = statusFilter === filter;

    return (
      <TouchableOpacity
        key={filter}
        activeOpacity={0.8}
        onPress={() => setStatusFilter(filter)}
        style={[styles.filterButton, selected && styles.selectedFilter]}
      >
        <Text style={[styles.filterText, selected && styles.selectedFilterText]}>
          {filter}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderAppointment = ({ item }) => (
    <View style={styles.card}>
      <Text style={styles.patientName}>
        {item.patient?.username || item.patientSnapshot?.username || 'Patient'}
      </Text>
      <Text style={styles.meta}>
        Doctor: {item.doctor?.username || item.doctorSnapshot?.username || 'Doctor'}
      </Text>
      <Text style={styles.meta}>Date: {formatDate(item.appointmentDate)}</Text>
      <Text style={styles.meta}>Time: {item.appointmentTime}</Text>
      <Text style={styles.meta}>Status: {item.status}</Text>
      <Text style={styles.meta}>Payment: {item.paymentStatus}</Text>

      {item.status === 'Paid' ? (
        <View style={styles.actionRow}>
          <CustomButton
            title="Confirm Appointment"
            onPress={() => confirmPaidAppointment(item._id)}
            style={styles.actionButton}
          />
        </View>
      ) : null}

      {item.status === 'Pending' ? (
        <View style={styles.noticeBox}>
          <Text style={styles.noticeText}>Waiting for accountant payment verification.</Text>
          <CustomButton
            title="Reject"
            type="secondary"
            onPress={() => rejectPendingAppointment(item._id)}
            style={styles.rejectButton}
          />
        </View>
      ) : null}
    </View>
  );

  if (isLoading) {
    return <Loading />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Manage Appointments</Text>
      <View style={styles.filterRow}>{statusFilters.map(renderFilter)}</View>
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
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  filterButton: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  selectedFilter: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  selectedFilterText: {
    color: colors.white,
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
  patientName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: 4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
  },
  noticeBox: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    padding: 12,
  },
  noticeText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  rejectButton: {
    alignSelf: 'stretch',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 16,
    textAlign: 'center',
  },
});

export default ManageAppointmentsScreen;
