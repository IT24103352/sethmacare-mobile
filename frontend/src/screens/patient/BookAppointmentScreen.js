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
  buildMockPaymentDetails,
  emptyCardDetails,
  emptyOnlineDetails,
  getMockPaymentValidationError,
} from '../../components/MockPaymentForm';
import colors from '../../theme/colors';

const paymentMethods = ['Card', 'Cash', 'Online'];

const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || 'Unable to book appointment.';

const formatDate = (value) => {
  if (!value) {
    return 'Unknown date';
  }

  return new Date(value).toLocaleDateString();
};

const BookAppointmentScreen = ({ navigation, route }) => {
  const {
    doctorId,
    doctorName = 'Doctor',
    specialization = 'General',
    consultationFee = 0,
  } = route.params || {};

  const [schedules, setSchedules] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [cardDetails, setCardDetails] = useState(emptyCardDetails);
  const [onlineDetails, setOnlineDetails] = useState(emptyOnlineDetails);
  const [isPaymentModalVisible, setIsPaymentModalVisible] = useState(false);
  const [isSuccessModalVisible, setIsSuccessModalVisible] = useState(false);
  const [bookingSummary, setBookingSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchSchedule = useCallback(async (showRefresh = false) => {
    if (!doctorId) {
      setError('Doctor information is missing.');
      setIsLoading(false);
      return;
    }

    if (showRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setError('');

    try {
      const response = await client.get(`/patient/doctors/${doctorId}/schedules`);
      setSchedules(response.data.schedules || []);
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [doctorId]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const openPaymentModal = () => {
    if (!selectedSlot) {
      setError('Please select an available schedule slot.');
      return;
    }

    setError('');
    setPaymentMethod('Cash');
    setCardDetails({ ...emptyCardDetails });
    setOnlineDetails({ ...emptyOnlineDetails });
    setIsPaymentModalVisible(true);
  };

  const handlePaymentMethodChange = (method) => {
    setPaymentMethod(method);
  };

  const handleBooking = async () => {
    const validationError = getMockPaymentValidationError(
      paymentMethod,
      cardDetails,
      onlineDetails
    );

    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const appointmentResponse = await client.post('/patient/appointments', {
        doctorId,
        scheduleId: selectedSlot._id,
        date: selectedSlot.scheduleDate,
        time: selectedSlot.startTime,
        fee: consultationFee,
      });

      const appointment = appointmentResponse.data.appointment;

      const paymentDetailsData = buildMockPaymentDetails(paymentMethod, cardDetails, onlineDetails);
      
      let payload;
      let headers = {};

      if (paymentMethod === 'Online' && paymentDetailsData.slipImage) {
        payload = new FormData();
        payload.append('appointmentId', appointment._id);
        payload.append('amount', String(appointment.consultationFee ?? consultationFee));
        payload.append('paymentMethod', paymentMethod);
        
        payload.append('provider', paymentDetailsData.provider);
        payload.append('contactInfo', paymentDetailsData.contactInfo);
        
        const uriParts = paymentDetailsData.slipImage.split('.');
        const fileType = uriParts[uriParts.length - 1];
        
        payload.append('slipImage', {
          uri: paymentDetailsData.slipImage,
          name: `payment_slip_${Date.now()}.${fileType}`,
          type: `image/${fileType === 'jpg' ? 'jpeg' : fileType}`,
        });
        
        headers = { 'Content-Type': 'multipart/form-data' };
      } else {
        payload = {
          appointmentId: appointment._id,
          amount: appointment.consultationFee ?? consultationFee,
          paymentMethod,
          paymentDetails: paymentDetailsData,
        };
      }

      await client.post('/payments', payload, { headers });

      setBookingSummary({
        appointmentCode: appointment.appointmentCode,
        doctorName,
        date: selectedSlot.scheduleDate,
        time: selectedSlot.startTime,
        paymentMethod,
        amount: appointment.consultationFee ?? consultationFee,
      });
      setIsPaymentModalVisible(false);
      setIsSuccessModalVisible(true);
    } catch (bookingError) {
      setError(getErrorMessage(bookingError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderSchedule = ({ item }) => {
    const isSelected = selectedSlot?._id === item._id;

    return (
      <TouchableOpacity
        activeOpacity={0.82}
        onPress={() => setSelectedSlot(item)}
        style={[styles.slotCard, isSelected && styles.selectedSlot]}
      >
        <Text style={[styles.slotDate, isSelected && styles.selectedText]}>
          {formatDate(item.scheduleDate)}
        </Text>
        <Text style={[styles.slotTime, isSelected && styles.selectedText]}>
          {item.startTime}
          {item.endTime ? ` - ${item.endTime}` : ''}
        </Text>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return <Loading />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{doctorName}</Text>
      <Text style={styles.subtitle}>{specialization}</Text>
      <Text style={styles.fee}>Consultation Fee: Rs. {consultationFee}</Text>

      <ErrorMessage message={error} />

      <FlatList
        data={schedules}
        keyExtractor={(item) => item._id}
        renderItem={renderSchedule}
        contentContainerStyle={schedules.length ? styles.list : styles.emptyList}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => fetchSchedule(true)} />
        }
        ListEmptyComponent={<Text style={styles.emptyText}>No available slots found.</Text>}
      />

      <CustomButton
        title="Proceed to Payment"
        onPress={openPaymentModal}
        disabled={!selectedSlot}
        style={styles.confirmButton}
      />

      <Modal
        animationType="slide"
        transparent
        visible={isPaymentModalVisible}
        onRequestClose={() => setIsPaymentModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <ScrollView
            style={styles.modalCard}
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Appointment Summary</Text>
              <TouchableOpacity
                activeOpacity={0.82}
                onPress={() => setIsPaymentModalVisible(false)}
                style={styles.closeButton}
                disabled={isSubmitting}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Doctor</Text>
              <Text style={styles.summaryValue}>{doctorName}</Text>
              <Text style={styles.summaryLabel}>Session</Text>
              <Text style={styles.summaryValue}>
                {selectedSlot ? `${formatDate(selectedSlot.scheduleDate)} at ${selectedSlot.startTime}` : 'No slot selected'}
              </Text>
              <Text style={styles.summaryAmount}>Rs. {Number(consultationFee || 0).toLocaleString()}</Text>
            </View>

            <ErrorMessage message={error} />

            <Text style={styles.paymentTitle}>Select Payment Method</Text>
            <View style={styles.paymentOptions}>
              {paymentMethods.map((method) => {
                const isSelected = paymentMethod === method;

                return (
                  <TouchableOpacity
                    key={method}
                    activeOpacity={0.82}
                    onPress={() => handlePaymentMethodChange(method)}
                    style={[styles.paymentOption, isSelected && styles.selectedPaymentOption]}
                  >
                    <Text style={[styles.paymentOptionText, isSelected && styles.selectedPaymentText]}>
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
                onPress={() => setIsPaymentModalVisible(false)}
                disabled={isSubmitting}
                style={styles.modalActionButton}
              />
              <CustomButton
                title="Complete Booking"
                onPress={handleBooking}
                loading={isSubmitting}
                disabled={isSubmitting}
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
        onRequestClose={() => {
          setIsSuccessModalVisible(false);
          navigation.navigate('PatientHome');
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.successCard}>
            <Text style={styles.successTitle}>Booking Complete</Text>
            <Text style={styles.successText}>
              Payment was recorded as Pending and is awaiting accountant verification.
            </Text>
            {bookingSummary ? (
              <View style={styles.successSummary}>
                <Text style={styles.successMeta}>Appointment: {bookingSummary.appointmentCode}</Text>
                <Text style={styles.successMeta}>Doctor: {bookingSummary.doctorName}</Text>
                <Text style={styles.successMeta}>Payment Method: {bookingSummary.paymentMethod}</Text>
                <Text style={styles.successMeta}>
                  Amount: Rs. {Number(bookingSummary.amount || 0).toLocaleString()}
                </Text>
              </View>
            ) : null}
            <CustomButton
              title="Done"
              onPress={() => {
                setIsSuccessModalVisible(false);
                navigation.navigate('PatientHome');
              }}
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
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    marginTop: 4,
  },
  fee: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 16,
    marginTop: 8,
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
  list: {
    paddingBottom: 100,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  slotCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 14,
  },
  selectedSlot: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  slotDate: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  slotTime: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 5,
  },
  selectedText: {
    color: colors.white,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 16,
    textAlign: 'center',
  },
  confirmButton: {
    bottom: 16,
    left: 16,
    position: 'absolute',
    right: 16,
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

export default BookAppointmentScreen;
