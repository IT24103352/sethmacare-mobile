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
import { useAuth } from '../../context/AuthContext';
import colors from '../../theme/colors';

const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || 'Unable to load payments.';

const formatDate = (value) => {
  if (!value) {
    return 'Unknown date';
  }

  return new Date(value).toLocaleDateString();
};

const formatTime = (value) => {
  if (!value) {
    return 'N/A';
  }

  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getStatusStyle = (status) => {
  if (status === 'Confirmed') {
    return styles.confirmedBadge;
  }

  if (status === 'Pending') {
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

const MyPaymentsScreen = () => {
  const { user } = useAuth();
  const [payments, setPayments] = useState([]);
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
      const userRef = user?.userCode || 'me';
      const response = await client.get(`/payments/patient/${userRef}`);
      setPayments(response.data.payments || []);
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.userCode]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const renderPayment = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.titleBlock}>
          <Text style={styles.paymentCode}>{item.paymentCode || 'Payment'}</Text>
          <Text style={styles.appointmentCode}>
            Appointment: {item.appointment?.appointmentCode || 'N/A'}
          </Text>
        </View>
        <Text style={[styles.statusBadge, getStatusStyle(item.status)]}>{item.status}</Text>
      </View>

      <View style={styles.detailGrid}>
        <Detail label="Payment Date" value={formatDate(item.paymentDate || item.createdAt)} />
        <Detail label="Payment Time" value={formatTime(item.paymentDate || item.createdAt)} />
        <Detail label="Amount" value={`Rs. ${Number(item.amount || 0).toLocaleString()}`} />
        <Detail label="Method" value={item.paymentMethod} />
      </View>
    </View>
  );

  if (isLoading) {
    return <Loading />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Payments</Text>
      <ErrorMessage message={error} />
      <FlatList
        data={payments}
        keyExtractor={(item) => item._id}
        renderItem={renderPayment}
        contentContainerStyle={payments.length ? styles.list : styles.emptyList}
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
  paymentCode: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  appointmentCode: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
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
  emptyText: {
    color: colors.textMuted,
    fontSize: 16,
    textAlign: 'center',
  },
});

export default MyPaymentsScreen;
