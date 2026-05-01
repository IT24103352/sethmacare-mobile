import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import client from '../../api/client';
import CustomButton from '../../components/CustomButton';
import ErrorMessage from '../../components/ErrorMessage';
import Loading from '../../components/Loading';
import MockPaymentForm, {
  emptyCardDetails,
  emptyOnlineDetails,
  isMockPaymentValid,
} from '../../components/MockPaymentForm';
import colors from '../../theme/colors';

const paymentMethods = ['Card', 'Cash', 'Online'];

const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || 'Unable to load prescriptions.';

const formatDate = (value) => {
  if (!value) {
    return 'Unknown date';
  }

  return new Date(value).toLocaleDateString();
};

const getStatusStyle = (status) => {
  if (status === 'Dispensed') {
    return styles.dispensedBadge;
  }

  if (status === 'Pending') {
    return styles.pendingBadge;
  }

  return styles.neutralBadge;
};

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

const MedicineItem = ({ item, index }) => (
  <View style={styles.medicineItem}>
    <Text style={styles.medicineTitle}>
      {index + 1}. {item.medicineName || item.name || 'Medicine'}
    </Text>
    <Text style={styles.medicineMeta}>
      Qty: {item.quantity}
      {item.dosage ? ` | Dosage: ${item.dosage}` : ''}
    </Text>
    {item.duration ? <Text style={styles.medicineMeta}>Duration: {item.duration}</Text> : null}
    {item.instructions ? (
      <Text style={styles.instructions}>Instructions: {item.instructions}</Text>
    ) : null}
  </View>
);

const MyPrescriptionsScreen = () => {
  const [prescriptions, setPrescriptions] = useState([]);
  const [selectedPrescription, setSelectedPrescription] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [cardDetails, setCardDetails] = useState(emptyCardDetails);
  const [onlineDetails, setOnlineDetails] = useState(emptyOnlineDetails);
  const [isPaymentModalVisible, setIsPaymentModalVisible] = useState(false);
  const [isSuccessModalVisible, setIsSuccessModalVisible] = useState(false);
  const [paymentSummary, setPaymentSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [error, setError] = useState('');

  const fetchPrescriptions = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setError('');

    try {
      const response = await client.get('/patient/prescriptions/my');
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

  const openPaymentModal = (prescription) => {
    setError('');
    setSelectedPrescription(prescription);
    setPaymentMethod('Cash');
    setCardDetails({ ...emptyCardDetails });
    setOnlineDetails({ ...emptyOnlineDetails });
    setIsPaymentModalVisible(true);
  };

  const closePaymentModal = () => {
    if (!isSubmittingPayment) {
      setIsPaymentModalVisible(false);
    }
  };

  const handlePayPharmacyFee = async () => {
    if (!selectedPrescription) {
      return;
    }

    if (!isMockPaymentValid(paymentMethod, cardDetails, onlineDetails)) {
      setError('Complete the selected payment method details before confirming payment.');
      return;
    }

    setError('');
    setIsSubmittingPayment(true);

    try {
      const response = await client.patch(
        `/patient/pay-pharmacy-fee/${selectedPrescription._id}`,
        { paymentMethod }
      );
      const updatedPrescription = response.data.prescription;

      setPaymentSummary({
        prescriptionCode:
          updatedPrescription?.prescriptionCode || selectedPrescription.prescriptionCode,
        amount: getPharmacyFee(updatedPrescription || selectedPrescription),
        paymentMethod,
      });
      setIsPaymentModalVisible(false);
      setIsSuccessModalVisible(true);
      await fetchPrescriptions(true);
    } catch (paymentError) {
      setError(getErrorMessage(paymentError));
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const renderPrescription = ({ item }) => {
    const doctorName = item.doctor?.username || 'Doctor';
    const appointmentCode = item.appointment?.appointmentCode || 'N/A';
    const prescriptionDate = item.prescriptionDate || item.createdAt;
    const pharmacyFee = getPharmacyFee(item);
    const pharmacyPaymentStatus = item.pharmacyPaymentStatus || 'Pending';
    const canPayPharmacyFee = pharmacyFee > 0 && pharmacyPaymentStatus === 'Pending';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.titleBlock}>
            <Text style={styles.prescriptionCode}>{item.prescriptionCode || 'Prescription'}</Text>
            <Text style={styles.doctorName}>{doctorName}</Text>
          </View>
          <Text style={[styles.statusBadge, getStatusStyle(item.status)]}>{item.status}</Text>
        </View>

        <View style={styles.detailGrid}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Appointment ID</Text>
            <Text style={styles.detailValue}>{appointmentCode}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Date</Text>
            <Text style={styles.detailValue}>{formatDate(prescriptionDate)}</Text>
          </View>
        </View>

        {item.diagnosis ? (
          <View style={styles.noteBox}>
            <Text style={styles.noteLabel}>Diagnosis</Text>
            <Text style={styles.noteText}>{item.diagnosis}</Text>
          </View>
        ) : null}

        {item.notes ? (
          <View style={styles.noteBox}>
            <Text style={styles.noteLabel}>Doctor's Notes</Text>
            <Text style={styles.noteText}>{item.notes}</Text>
          </View>
        ) : null}

        <View style={styles.pharmacyPanel}>
          <View>
            <Text style={styles.pharmacyLabel}>Pharmacy Fee</Text>
            <Text style={styles.pharmacyAmount}>{formatCurrency(pharmacyFee)}</Text>
          </View>
          <Text
            style={[
              styles.paymentBadge,
              pharmacyPaymentStatus === 'Paid' || pharmacyFee === 0
                ? styles.paymentPaidBadge
                : styles.paymentPendingBadge,
            ]}
          >
            {pharmacyPaymentStatus === 'Paid' || pharmacyFee === 0 ? 'Paid' : 'Pending'}
          </Text>
        </View>

        {canPayPharmacyFee ? (
          <CustomButton
            title={`Pay Pharmacy Fee (${formatCurrency(pharmacyFee)})`}
            onPress={() => openPaymentModal(item)}
            style={styles.payButton}
          />
        ) : null}

        <Text style={styles.sectionTitle}>Medicines</Text>
        {(item.medicines || []).map((medicine, index) => (
          <MedicineItem
            key={`${medicine.medicineCode || medicine.medicineName || index}-${index}`}
            item={medicine}
            index={index}
          />
        ))}
      </View>
    );
  };

  if (isLoading) {
    return <Loading />;
  }

  const isPaymentReady = isMockPaymentValid(paymentMethod, cardDetails, onlineDetails);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Prescriptions</Text>
      <ErrorMessage message={error} />
      <FlatList
        data={prescriptions}
        keyExtractor={(item) => item._id}
        renderItem={renderPrescription}
        contentContainerStyle={prescriptions.length ? styles.list : styles.emptyList}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => fetchPrescriptions(true)} />
        }
        ListEmptyComponent={<Text style={styles.emptyText}>No prescriptions found.</Text>}
      />

      <Modal
        animationType="slide"
        transparent
        visible={isPaymentModalVisible}
        onRequestClose={closePaymentModal}
      >
        <View style={styles.modalBackdrop}>
          <ScrollView
            style={styles.modalCard}
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pharmacy Payment</Text>
              <TouchableOpacity
                activeOpacity={0.82}
                onPress={closePaymentModal}
                style={styles.closeButton}
                disabled={isSubmittingPayment}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Prescription</Text>
              <Text style={styles.summaryValue}>
                {selectedPrescription?.prescriptionCode || 'Prescription'}
              </Text>
              <Text style={styles.summaryLabel}>Doctor</Text>
              <Text style={styles.summaryValue}>
                {selectedPrescription?.doctor?.username || 'Doctor'}
              </Text>
              <Text style={styles.summaryAmount}>
                {formatCurrency(getPharmacyFee(selectedPrescription || {}))}
              </Text>
            </View>

            <Text style={styles.paymentTitle}>Select Payment Method</Text>
            <View style={styles.paymentOptions}>
              {paymentMethods.map((method) => {
                const isSelected = paymentMethod === method;

                return (
                  <TouchableOpacity
                    key={method}
                    activeOpacity={0.82}
                    onPress={() => setPaymentMethod(method)}
                    style={[styles.paymentOption, isSelected && styles.selectedPaymentOption]}
                  >
                    <Text
                      style={[
                        styles.paymentOptionText,
                        isSelected && styles.selectedPaymentText,
                      ]}
                    >
                      {method}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <MockPaymentForm
              paymentMethod={paymentMethod}
              cardDetails={cardDetails}
              onlineDetails={onlineDetails}
              onCardDetailsChange={setCardDetails}
              onOnlineDetailsChange={setOnlineDetails}
            />

            <View style={styles.modalActions}>
              <CustomButton
                title="Back"
                type="secondary"
                onPress={closePaymentModal}
                disabled={isSubmittingPayment}
                style={styles.modalActionButton}
              />
              <CustomButton
                title="Confirm Payment"
                onPress={handlePayPharmacyFee}
                loading={isSubmittingPayment}
                disabled={!isPaymentReady}
                style={styles.modalActionButton}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={isSuccessModalVisible}
        onRequestClose={() => setIsSuccessModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.successCard}>
            <Text style={styles.successTitle}>Payment Complete</Text>
            <Text style={styles.successText}>
              Your pharmacy fee has been paid. The prescription is ready for pharmacist dispensing.
            </Text>
            {paymentSummary ? (
              <View style={styles.successSummary}>
                <Text style={styles.successMeta}>Prescription: {paymentSummary.prescriptionCode}</Text>
                <Text style={styles.successMeta}>Payment Method: {paymentSummary.paymentMethod}</Text>
                <Text style={styles.successMeta}>Amount: {formatCurrency(paymentSummary.amount)}</Text>
              </View>
            ) : null}
            <CustomButton
              title="Done"
              onPress={() => setIsSuccessModalVisible(false)}
              style={styles.doneButton}
            />
          </View>
        </View>
      </Modal>
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
  prescriptionCode: {
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
    marginBottom: 5,
  },
  detailValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  noteBox: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 10,
  },
  noteLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 5,
  },
  noteText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  pharmacyPanel: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    padding: 12,
  },
  pharmacyLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  pharmacyAmount: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  paymentBadge: {
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  paymentPaidBadge: {
    backgroundColor: colors.successBackground,
    color: colors.success,
  },
  paymentPendingBadge: {
    backgroundColor: '#FEF3C7',
    color: '#B45309',
  },
  payButton: {
    marginBottom: 12,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 8,
  },
  medicineItem: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
    padding: 10,
  },
  medicineTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  medicineMeta: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  instructions: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
  },
  dispensedBadge: {
    backgroundColor: '#DBEAFE',
    color: colors.primary,
  },
  pendingBadge: {
    backgroundColor: '#FEF3C7',
    color: '#B45309',
  },
  neutralBadge: {
    backgroundColor: colors.errorBackground,
    color: colors.error,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 16,
    textAlign: 'center',
  },
  paymentTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 10,
  },
  paymentOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  paymentOption: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  selectedPaymentOption: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  paymentOptionText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  selectedPaymentText: {
    color: colors.white,
  },
  modalBackdrop: {
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    maxHeight: '90%',
  },
  modalContent: {
    padding: 16,
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  closeButton: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  closeButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  summaryBox: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    padding: 14,
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  summaryValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 10,
  },
  summaryAmount: {
    color: colors.success,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 4,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  modalActionButton: {
    flex: 1,
  },
  successCard: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    margin: 16,
    padding: 18,
  },
  successTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  successText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
  },
  successSummary: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 14,
    padding: 12,
  },
  successMeta: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 5,
  },
  doneButton: {
    marginTop: 16,
  },
});

export default MyPrescriptionsScreen;
