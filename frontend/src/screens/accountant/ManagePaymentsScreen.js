import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import client from '../../api/client';
import CustomButton from '../../components/CustomButton';
import ErrorMessage from '../../components/ErrorMessage';
import InputField from '../../components/InputField';
import Loading from '../../components/Loading';
import { useTheme } from '../../context/ThemeContext';

const statusFilters = ['All', 'Pending', 'Confirmed', 'Rejected', 'Refunded'];

const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || 'Unable to load payments.';

const formatDate = (value) => {
  if (!value) {
    return 'N/A';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'N/A';
  }

  return date.toLocaleDateString();
};

const formatTime = (value) => {
  if (!value) {
    return 'N/A';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'N/A';
  }

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getPaymentTimestamp = (payment) => payment.paymentDate || payment.createdAt;

const DetailRow = ({ styles, label, value }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value || 'N/A'}</Text>
  </View>
);

const ManagePaymentsScreen = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [payments, setPayments] = useState([]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [rejectingPayment, setRejectingPayment] = useState(null);
  const [rejectionNote, setRejectionNote] = useState('');
  const [rejectionError, setRejectionError] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const fetchPayments = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setError('');
    setSuccessMessage('');

    try {
      const params = statusFilter === 'All' ? {} : { status: statusFilter };
      const response = await client.get('/payments', { params });
      setPayments(response.data.payments || []);
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const filteredPayments = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) {
      return payments;
    }

    return payments.filter((payment) => {
      const paymentCode = payment.paymentCode?.toLowerCase() || '';
      const appointmentCode = payment.appointment?.appointmentCode?.toLowerCase() || '';
      const patientName = payment.patient?.username?.toLowerCase() || '';
      const paymentMethod = payment.paymentMethod?.toLowerCase() || '';
      return (
        paymentCode.includes(term) ||
        appointmentCode.includes(term) ||
        patientName.includes(term) ||
        paymentMethod.includes(term)
      );
    });
  }, [payments, search]);

  const handleConfirm = async (paymentId) => {
    setSuccessMessage('');

    try {
      await client.patch(`/payments/${paymentId}/confirm`);
      await fetchPayments(true);
      setSuccessMessage('Payment confirmed successfully.');
    } catch (confirmError) {
      Alert.alert('Confirm Failed', getErrorMessage(confirmError));
    }
  };

  const openRejectModal = (payment) => {
    setRejectingPayment(payment);
    setRejectionNote(payment.rejectedReason || '');
    setRejectionError('');
    setSuccessMessage('');
  };

  const closeRejectModal = (force = false) => {
    if (isRejecting && !force) {
      return;
    }

    setRejectingPayment(null);
    setRejectionNote('');
    setRejectionError('');
  };

  const handleRejectSubmit = async () => {
    if (!rejectingPayment?._id) {
      return;
    }

    const note = rejectionNote.trim();

    if (!note) {
      setRejectionError('Rejection note is required.');
      return;
    }

    setIsRejecting(true);
    setRejectionError('');
    setError('');

    try {
      const response = await client.patch(`/payments/${rejectingPayment._id}/reject`, {
        rejectedReason: note,
        rejectionNote: note,
      });
      const updatedPayment = response.data.payment || {
        ...rejectingPayment,
        status: 'Rejected',
        rejectedReason: note,
      };

      setPayments((currentPayments) =>
        currentPayments.map((payment) =>
          payment._id === rejectingPayment._id
            ? { ...payment, ...updatedPayment, status: 'Rejected', rejectedReason: note }
            : payment
        )
      );
      setSuccessMessage('Payment rejected successfully.');
      closeRejectModal(true);
    } catch (rejectError) {
      const message = getErrorMessage(rejectError);
      setRejectionError(message);
    } finally {
      setIsRejecting(false);
    }
  };

  const handleRemove = (payment) => {
    const isPending = payment.status === 'Pending';
    const actionLabel = isPending ? 'Cancel' : 'Delete';

    Alert.alert(`${actionLabel} Payment`, `Do you want to ${actionLabel.toLowerCase()} this payment record?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: actionLabel,
        style: 'destructive',
        onPress: async () => {
          try {
            await client.delete(`/payments/${payment._id}`);
            await fetchPayments(true);
          } catch (removeError) {
            Alert.alert(`${actionLabel} Failed`, getErrorMessage(removeError));
          }
        },
      },
    ]);
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

  const getStatusStyle = (status) => {
    if (status === 'Confirmed') {
      return styles.confirmed;
    }

    if (status === 'Rejected') {
      return styles.rejected;
    }

    if (status === 'Refunded') {
      return styles.refunded;
    }

    return styles.pending;
  };

  const renderPayment = ({ item }) => {
    const paymentTimestamp = getPaymentTimestamp(item);
    const canConfirm = item.status === 'Pending';
    const canReject = item.status === 'Pending';
    const canRemove = item.status !== 'Confirmed';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardMain}>
            <Text style={styles.paymentCode}>{item.paymentCode}</Text>
            <Text style={styles.meta}>
              {item.patient?.username || 'Unknown Patient'} - {item.patient?.userCode || 'No ID'}
            </Text>
          </View>
          <Text style={[styles.statusBadge, getStatusStyle(item.status)]}>
            {item.status}
          </Text>
        </View>

        <View style={styles.amountRow}>
          <Text style={styles.amountLabel}>Amount</Text>
          <Text style={styles.amount}>Rs. {item.amount}</Text>
        </View>

        <View style={styles.detailsPanel}>
          <DetailRow styles={styles} label="Appointment ID" value={item.appointment?.appointmentCode} />
          <DetailRow styles={styles} label="Payment Date" value={formatDate(paymentTimestamp)} />
          <DetailRow styles={styles} label="Payment Time" value={formatTime(paymentTimestamp)} />
          <DetailRow styles={styles} label="Payment Method" value={item.paymentMethod} />
          {item.rejectedReason ? (
            <View style={styles.rejectionNote}>
              <Text style={styles.rejectionLabel}>Rejection Note</Text>
              <Text style={styles.rejectionText}>{item.rejectedReason}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.actionRow}>
          {canConfirm ? (
            <CustomButton
              title="Confirm"
              onPress={() => handleConfirm(item._id)}
              style={styles.actionButton}
            />
          ) : null}
          {canReject ? (
            <CustomButton
              title="Reject"
              type="secondary"
              onPress={() => openRejectModal(item)}
              style={[styles.actionButton, styles.rejectButton]}
              textStyle={styles.rejectButtonText}
            />
          ) : null}
          {canRemove ? (
            <CustomButton
              title={item.status === 'Pending' ? 'Cancel' : 'Delete'}
              type="secondary"
              onPress={() => handleRemove(item)}
              style={[styles.actionButton, styles.destructiveButton]}
              textStyle={styles.destructiveButtonText}
            />
          ) : (
            <Text style={styles.lockedText}>Confirmed payments are locked for audit history.</Text>
          )}
        </View>
      </View>
    );
  };

  if (isLoading) {
    return <Loading />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Manage Payments</Text>
      <View style={styles.filterRow}>{statusFilters.map(renderFilter)}</View>
      <InputField
        placeholder="Search payment, appointment, patient, or method"
        value={search}
        onChangeText={setSearch}
      />
      <ErrorMessage message={successMessage} type="success" />
      <ErrorMessage message={error} />

      <FlatList
        data={filteredPayments}
        keyExtractor={(item) => item._id}
        renderItem={renderPayment}
        contentContainerStyle={filteredPayments.length ? styles.list : styles.emptyList}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => fetchPayments(true)}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surfaceElevated}
          />
        }
        ListEmptyComponent={<Text style={styles.emptyText}>No payments found.</Text>}
      />

      <Modal
        visible={Boolean(rejectingPayment)}
        transparent
        animationType="fade"
        onRequestClose={closeRejectModal}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeRejectModal} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reject Payment</Text>
            <Text style={styles.modalSubtitle}>
              Add a clear note for {rejectingPayment?.paymentCode || 'this payment'} before rejecting it.
            </Text>
            <InputField
              placeholder="Rejection note"
              value={rejectionNote}
              onChangeText={(value) => {
                setRejectionNote(value);
                setRejectionError('');
              }}
              error={rejectionError}
              multiline
              textAlignVertical="top"
              inputStyle={styles.noteInput}
            />
            <View style={styles.modalActions}>
              <CustomButton
                title="Close"
                type="secondary"
                onPress={closeRejectModal}
                disabled={isRejecting}
                style={styles.modalButton}
              />
              <CustomButton
                title="Reject"
                onPress={handleRejectSubmit}
                loading={isRejecting}
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const createStyles = (colors) => StyleSheet.create({
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
    backgroundColor: colors.surfaceGlass,
    borderColor: colors.border,
    borderRadius: 14,
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
    backgroundColor: colors.surfaceGlass,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    padding: 14,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  cardMain: {
    flex: 1,
  },
  paymentCode: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: 4,
  },
  amountRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingBottom: 12,
  },
  amountLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  amount: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  detailsPanel: {
    marginTop: 12,
    gap: 8,
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
  rejectionNote: {
    backgroundColor: colors.errorBackground,
    borderColor: colors.error,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 4,
    padding: 12,
  },
  rejectionLabel: {
    color: colors.error,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  rejectionText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  confirmed: {
    backgroundColor: colors.successBackground,
    color: colors.success,
  },
  pending: {
    backgroundColor: colors.warningBackground,
    color: colors.warning,
  },
  rejected: {
    backgroundColor: colors.errorBackground,
    color: colors.error,
  },
  refunded: {
    backgroundColor: colors.infoBackground,
    color: colors.info,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    minWidth: 100,
  },
  rejectButton: {
    borderColor: colors.warning,
  },
  rejectButtonText: {
    color: colors.warning,
  },
  destructiveButton: {
    borderColor: colors.error,
  },
  destructiveButtonText: {
    color: colors.error,
  },
  lockedText: {
    color: colors.textMuted,
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'right',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 16,
    textAlign: 'center',
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: colors.overlay,
    flex: 1,
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.borderStrong,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.24,
    shadowRadius: 28,
    width: '100%',
    elevation: 5,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '900',
  },
  modalSubtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 14,
    marginTop: 6,
  },
  noteInput: {
    minHeight: 110,
    paddingTop: 12,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalButton: {
    flex: 1,
  },
});

export default ManagePaymentsScreen;
