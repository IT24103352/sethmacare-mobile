import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  error?.response?.data?.message || error?.message || 'Unable to load prescriptions.';

const formatCurrency = (value) =>
  `Rs. ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const getPharmacyFee = (prescription) => {
  if (prescription.pharmacyFeeAmount !== undefined && prescription.pharmacyFeeAmount !== null) {
    return Number(prescription.pharmacyFeeAmount) || 0;
  }

  return (prescription.medicines || []).reduce(
    (total, medicine) =>
      total + (Number(medicine.quantity) || 0) * (Number(medicine.unitPrice) || 0),
    0
  );
};

const DetailRow = ({ label, value }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value || 'N/A'}</Text>
  </View>
);

const ManagePrescriptionsScreen = () => {
  const [prescriptions, setPrescriptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const fetchPrescriptions = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setError('');

    try {
      const response = await client.get('/pharmacist/prescriptions/pending');
      setPrescriptions(response.data.prescriptions || []);
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPrescriptions();
  }, [fetchPrescriptions]);

  const totals = useMemo(() => {
    const pendingPayment = prescriptions.filter(
      (item) => (item.pharmacyPaymentStatus || 'Pending') === 'Pending' && getPharmacyFee(item) > 0
    ).length;
    const paid = prescriptions.filter(
      (item) => item.pharmacyPaymentStatus === 'Paid' || getPharmacyFee(item) === 0
    ).length;

    return {
      pendingPayment,
      paid,
    };
  }, [prescriptions]);

  const handleDispense = async (prescriptionId) => {
    setError('');
    setSuccessMessage('');
    setProcessingId(prescriptionId);

    try {
      await client.patch(`/pharmacist/prescriptions/${prescriptionId}/dispense`);
      setSuccessMessage('Prescription dispensed successfully.');
      await fetchPrescriptions(true);
    } catch (dispenseError) {
      const message = getErrorMessage(dispenseError);
      setError(message);
      Alert.alert('Dispense Failed', message);
    } finally {
      setProcessingId('');
    }
  };

  const renderPrescription = ({ item }) => {
    const pharmacyFee = getPharmacyFee(item);
    const paymentStatus = item.pharmacyPaymentStatus || 'Pending';
    const isPaid = paymentStatus === 'Paid' || pharmacyFee === 0;
    const displayPaymentStatus = isPaid ? 'Paid' : 'Awaiting Patient Payment';
    const isProcessing = processingId === item._id;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardMain}>
            <Text style={styles.code}>{item.prescriptionCode}</Text>
            <Text style={styles.meta}>
              {item.patient?.username || 'Unknown Patient'} - {item.patient?.userCode || 'No ID'}
            </Text>
          </View>
          <Text style={[styles.statusBadge, isPaid ? styles.paidStatus : styles.pendingStatus]}>
            {displayPaymentStatus}
          </Text>
        </View>

        <View style={styles.feePanel}>
          <Text style={styles.feeLabel}>Pharmacy Fee</Text>
          <Text style={styles.feeValue}>{formatCurrency(pharmacyFee)}</Text>
        </View>

        <View style={styles.detailsPanel}>
          <DetailRow label="Doctor" value={item.doctor?.username} />
          <DetailRow label="Appointment ID" value={item.appointment?.appointmentCode} />
          <DetailRow label="Prescription Status" value={item.status} />
          <DetailRow label="Payment Method" value={item.pharmacyPaymentMethod} />
        </View>

        <Text style={styles.medicineTitle}>Medicines</Text>
        {(item.medicines || []).map((medicine) => (
          <View key={`${item._id}-${medicine.medicineCode}`} style={styles.medicineRow}>
            <Text style={styles.medicineName}>
              {medicine.medicineName || medicine.medicineCode}
            </Text>
            <Text style={styles.medicineQty}>
              {medicine.quantity} x {formatCurrency(medicine.unitPrice)}
            </Text>
          </View>
        ))}

        {!isPaid ? (
          <View style={styles.awaitingPanel}>
            <Text style={styles.awaitingTitle}>Awaiting Patient Payment</Text>
            <Text style={styles.awaitingText}>
              The patient must pay the pharmacy fee before this prescription can be dispensed.
            </Text>
          </View>
        ) : null}

        {isPaid ? (
          <CustomButton
            title="Dispense"
            onPress={() => handleDispense(item._id)}
            loading={isProcessing}
            disabled={isProcessing}
            style={styles.button}
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
      <Text style={styles.title}>Manage Prescriptions</Text>
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{totals.pendingPayment}</Text>
          <Text style={styles.summaryLabel}>Pending Payment</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{totals.paid}</Text>
          <Text style={styles.summaryLabel}>Ready to Dispense</Text>
        </View>
      </View>
      {successMessage ? <Text style={styles.success}>{successMessage}</Text> : null}
      <ErrorMessage message={error} />
      <FlatList
        data={prescriptions}
        keyExtractor={(item) => item._id}
        renderItem={renderPrescription}
        contentContainerStyle={prescriptions.length ? styles.list : styles.emptyList}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => fetchPrescriptions(true)} />
        }
        ListEmptyComponent={<Text style={styles.emptyText}>No pending prescriptions found.</Text>}
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
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    padding: 12,
  },
  summaryValue: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 3,
  },
  success: {
    backgroundColor: colors.successBackground,
    borderRadius: 8,
    color: colors.success,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  cardMain: {
    flex: 1,
  },
  code: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 14,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '800',
    maxWidth: 150,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
    textAlign: 'center',
  },
  paidStatus: {
    backgroundColor: colors.successBackground,
    color: colors.success,
  },
  pendingStatus: {
    backgroundColor: '#FEF3C7',
    color: '#B45309',
  },
  feePanel: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingBottom: 12,
  },
  feeLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  feeValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  detailsPanel: {
    gap: 8,
    marginTop: 12,
  },
  detailRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  detailLabel: {
    color: colors.textMuted,
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  detailValue: {
    color: colors.text,
    flex: 1.2,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
  },
  medicineTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 6,
    marginTop: 12,
  },
  medicineRow: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 6,
    padding: 10,
  },
  medicineName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  medicineQty: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 3,
  },
  awaitingPanel: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 10,
    padding: 12,
  },
  awaitingTitle: {
    color: '#B45309',
    fontSize: 13,
    fontWeight: '800',
  },
  awaitingText: {
    color: '#92400E',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  button: {
    marginTop: 12,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 16,
    textAlign: 'center',
  },
});

export default ManagePrescriptionsScreen;
