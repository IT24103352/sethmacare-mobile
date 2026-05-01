import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import client from '../../api/client';
import CustomButton from '../../components/CustomButton';
import ErrorMessage from '../../components/ErrorMessage';
import Loading from '../../components/Loading';
import colors from '../../theme/colors';

const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || 'Unable to load prescription queue.';

const formatDate = (value) => {
  if (!value) {
    return 'Unknown date';
  }

  return new Date(value).toLocaleDateString();
};

const formatCurrency = (value) =>
  `Rs. ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const ManagePrescriptions = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('Pending');
  const [appointments, setAppointments] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchPrescriptionData = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setError('');

    try {
      const [appointmentsResponse, prescriptionsResponse] = await Promise.all([
        client.get('/doctor/appointments'),
        client.get('/doctor/prescriptions'),
      ]);
      setAppointments(appointmentsResponse.data.appointments || []);
      setPrescriptions(prescriptionsResponse.data.prescriptions || []);
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchPrescriptionData();
    }, [fetchPrescriptionData])
  );

  const readyAppointments = useMemo(
    () => appointments.filter((appointment) => appointment.status === 'Completed'),
    [appointments]
  );

  const renderAppointment = ({ item }) => {
    const patientName = item.patient?.username || item.patientSnapshot?.username || 'Patient';
    const patientCode = item.patient?.userCode || item.patientSnapshot?.userCode || 'Patient ID unavailable';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.patientBlock}>
            <Text style={styles.appointmentCode}>{item.appointmentCode}</Text>
            <Text style={styles.patientName}>{patientName}</Text>
            <Text style={styles.meta}>{patientCode}</Text>
          </View>
          <Text style={styles.readyBadge}>Ready</Text>
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
        </View>

        <CustomButton
          title="Create Prescription"
          onPress={() =>
            navigation.navigate('CreatePrescription', {
              appointmentId: item._id,
              appointmentCode: item.appointmentCode,
              patientName,
            })
          }
          style={styles.button}
        />
      </View>
    );
  };

  const renderHistory = ({ item }) => {
    const patientName = item.patient?.username || 'Patient';
    const patientCode = item.patient?.userCode || 'Patient ID unavailable';
    const appointmentCode = item.appointment?.appointmentCode || 'N/A';
    const prescriptionDate = item.prescriptionDate || item.createdAt;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.patientBlock}>
            <Text style={styles.appointmentCode}>{item.prescriptionCode}</Text>
            <Text style={styles.patientName}>{patientName}</Text>
            <Text style={styles.meta}>
              {patientCode} - Appointment {appointmentCode}
            </Text>
          </View>
          <Text style={styles.historyBadge}>{item.status}</Text>
        </View>

        <View style={styles.detailGrid}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Date</Text>
            <Text style={styles.detailValue}>{formatDate(prescriptionDate)}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Pharmacy Fee</Text>
            <Text style={styles.detailValue}>{formatCurrency(item.pharmacyFeeAmount)}</Text>
          </View>
        </View>

        {item.diagnosis ? (
          <View style={styles.noteBox}>
            <Text style={styles.detailLabel}>Diagnosis</Text>
            <Text style={styles.noteText}>{item.diagnosis}</Text>
          </View>
        ) : null}

        {item.notes ? (
          <View style={styles.noteBox}>
            <Text style={styles.detailLabel}>Doctor's Notes</Text>
            <Text style={styles.noteText}>{item.notes}</Text>
          </View>
        ) : null}

        <Text style={styles.medicineTitle}>Medicines</Text>
        {(item.medicines || []).map((medicine, index) => (
          <View key={`${item._id}-${medicine.medicineCode || index}`} style={styles.medicineRow}>
            <Text style={styles.medicineName}>
              {index + 1}. {medicine.medicineName || medicine.medicineCode}
            </Text>
            <Text style={styles.medicineMeta}>
              Qty: {medicine.quantity}
              {medicine.dosage ? ` | Dosage: ${medicine.dosage}` : ''}
            </Text>
            {medicine.duration ? (
              <Text style={styles.medicineMeta}>Duration: {medicine.duration}</Text>
            ) : null}
            {medicine.instructions ? (
              <Text style={styles.noteText}>Instructions: {medicine.instructions}</Text>
            ) : null}
          </View>
        ))}
      </View>
    );
  };

  if (isLoading) {
    return <Loading />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Manage Prescriptions</Text>
      <Text style={styles.subtitle}>Create prescriptions and review completed medical records.</Text>
      <View style={styles.segmentedControl}>
        {['Pending', 'History'].map((tab) => {
          const isSelected = activeTab === tab;
          const count = tab === 'Pending' ? readyAppointments.length : prescriptions.length;

          return (
            <TouchableOpacity
              key={tab}
              activeOpacity={0.82}
              onPress={() => setActiveTab(tab)}
              style={[styles.segmentButton, isSelected && styles.selectedSegment]}
            >
              <Text style={[styles.segmentText, isSelected && styles.selectedSegmentText]}>
                {tab} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <ErrorMessage message={error} />

      <FlatList
        data={activeTab === 'Pending' ? readyAppointments : prescriptions}
        keyExtractor={(item) => item._id}
        renderItem={activeTab === 'Pending' ? renderAppointment : renderHistory}
        contentContainerStyle={
          (activeTab === 'Pending' ? readyAppointments : prescriptions).length
            ? styles.list
            : styles.emptyList
        }
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => fetchPrescriptionData(true)} />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {activeTab === 'Pending'
              ? 'No completed appointments awaiting prescriptions.'
              : 'No prescription history found.'}
          </Text>
        }
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
  segmentedControl: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
    padding: 4,
  },
  segmentButton: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  selectedSegment: {
    backgroundColor: colors.primary,
  },
  segmentText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  selectedSegmentText: {
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
  readyBadge: {
    backgroundColor: colors.successBackground,
    borderRadius: 999,
    color: colors.success,
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  historyBadge: {
    backgroundColor: '#DBEAFE',
    borderRadius: 999,
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  detailGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  detailItem: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
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
  button: {
    marginTop: 12,
  },
  noteBox: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 10,
  },
  noteText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
  },
  medicineTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 8,
  },
  medicineRow: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
    padding: 10,
  },
  medicineName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  medicineMeta: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 16,
    textAlign: 'center',
  },
});

export default ManagePrescriptions;
