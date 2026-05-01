import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import InputField from '../../components/InputField';
import Loading from '../../components/Loading';
import colors from '../../theme/colors';

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

const DetailRow = ({ label, value }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value || 'N/A'}</Text>
  </View>
);

const ManagePaymentsScreen = () => {
  const [payments, setPayments] = useState([]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchPayments = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setError('');

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
    try {
      await client.patch(`/payments/${paymentId}/confirm`);
      await fetchPayments(true);
    } catch (confirmError) {
      Alert.alert('Confirm Failed', getErrorMessage(confirmError));
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
          <DetailRow label="Appointment ID" value={item.appointment?.appointmentCode} />
          <DetailRow label="Payment Date" value={formatDate(paymentTimestamp)} />
          <DetailRow label="Payment Time" value={formatTime(paymentTimestamp)} />
          <DetailRow label="Payment Method" value={item.paymentMethod} />
        </View>

        <View style={styles.actionRow}>
          {canConfirm ? (
            <CustomButton
              title="Confirm"
              onPress={() => handleConfirm(item._id)}
              style={styles.actionButton}
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
      <ErrorMessage message={error} />

      <FlatList
        data={filteredPayments}
        keyExtractor={(item) => item._id}
        renderItem={renderPayment}
        contentContainerStyle={filteredPayments.length ? styles.list : styles.emptyList}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => fetchPayments(true)} />
        }
        ListEmptyComponent={<Text style={styles.emptyText}>No payments found.</Text>}
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
    backgroundColor: '#FEF3C7',
    color: '#B45309',
  },
  rejected: {
    backgroundColor: colors.errorBackground,
    color: colors.error,
  },
  refunded: {
    backgroundColor: '#DBEAFE',
    color: colors.primary,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    minWidth: 120,
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
});

export default ManagePaymentsScreen;
