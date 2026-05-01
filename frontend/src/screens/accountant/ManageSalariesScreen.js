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
import InputField from '../../components/InputField';
import Loading from '../../components/Loading';
import colors from '../../theme/colors';

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

const getCurrentMonth = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || 'Unable to load salaries.';

const formatCurrency = (value) =>
  `Rs. ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const DetailRow = ({ label, value }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value || 'N/A'}</Text>
  </View>
);

const ManageSalariesScreen = () => {
  const [month, setMonth] = useState(getCurrentMonth());
  const [salaries, setSalaries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [payingId, setPayingId] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const isValidMonth = monthPattern.test(month.trim());

  const fetchSalaries = useCallback(async (showRefresh = false) => {
    if (!monthPattern.test(month.trim())) {
      setError('Month must use YYYY-MM format.');
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    if (showRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setError('');

    try {
      const response = await client.get('/accountant/salaries', {
        params: { month: month.trim() },
      });
      setSalaries(response.data.salaries || []);
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [month]);

  useEffect(() => {
    fetchSalaries();
  }, [fetchSalaries]);

  const totals = useMemo(() => {
    const totalAmount = salaries.reduce((total, salary) => total + (Number(salary.amount) || 0), 0);
    const pendingCount = salaries.filter((salary) => salary.status === 'Pending').length;
    const paidCount = salaries.filter((salary) => salary.status === 'Paid').length;

    return {
      totalAmount,
      pendingCount,
      paidCount,
    };
  }, [salaries]);

  const handleGenerate = async () => {
    if (!isValidMonth) {
      setError('Month must use YYYY-MM format.');
      return;
    }

    setError('');
    setSuccessMessage('');
    setIsGenerating(true);

    try {
      const response = await client.post('/accountant/salaries/generate', {
        month: month.trim(),
      });
      setSalaries(response.data.salaries || []);
      setSummary(response.data.summary || null);
      setSuccessMessage('Salaries generated successfully.');
    } catch (generateError) {
      const message = getErrorMessage(generateError);
      setError(message);
      Alert.alert('Generate Failed', message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleMarkPaid = async (salaryId) => {
    setError('');
    setSuccessMessage('');
    setPayingId(salaryId);

    try {
      await client.patch(`/accountant/salaries/${salaryId}/pay`);
      setSuccessMessage('Salary marked as paid.');
      await fetchSalaries(true);
    } catch (payError) {
      const message = getErrorMessage(payError);
      setError(message);
      Alert.alert('Payment Failed', message);
    } finally {
      setPayingId('');
    }
  };

  const renderSalary = ({ item }) => {
    const isPaid = item.status === 'Paid';
    const isPaying = payingId === item._id;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardMain}>
            <Text style={styles.staffName}>{item.staff?.username || 'Unknown Staff'}</Text>
            <Text style={styles.staffMeta}>
              {item.staffCodeSnapshot || item.staff?.userCode || 'No ID'} - {item.roleSnapshot}
            </Text>
          </View>
          <Text style={[styles.statusBadge, isPaid ? styles.paidStatus : styles.pendingStatus]}>
            {item.status}
          </Text>
        </View>

        <View style={styles.amountRow}>
          <Text style={styles.amountLabel}>Salary Amount</Text>
          <Text style={styles.amountValue}>{formatCurrency(item.amount)}</Text>
        </View>

        <View style={styles.detailsPanel}>
          <DetailRow label="Month" value={item.month} />
          <DetailRow
            label="Doctor Share"
            value={formatCurrency(item.doctorConsultationShare)}
          />
          <DetailRow
            label="Organization Source"
            value={formatCurrency(item.organizationShareSource)}
          />
        </View>

        {!isPaid ? (
          <CustomButton
            title="Mark Paid"
            onPress={() => handleMarkPaid(item._id)}
            loading={isPaying}
            style={styles.button}
          />
        ) : (
          <Text style={styles.paidText}>
            Paid {item.paidAt ? new Date(item.paidAt).toLocaleDateString() : ''}
          </Text>
        )}
      </View>
    );
  };

  if (isLoading) {
    return <Loading />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Manage Salaries</Text>
      <Text style={styles.subtitle}>Generate monthly salary records from consultation and pharmacy income.</Text>

      <View style={styles.panel}>
        <Text style={styles.inputLabel}>Salary Month</Text>
        <InputField
          placeholder="YYYY-MM"
          value={month}
          onChangeText={setMonth}
          autoCapitalize="none"
        />
        <CustomButton
          title="Generate Salaries"
          onPress={handleGenerate}
          loading={isGenerating}
          disabled={!isValidMonth}
        />
      </View>

      {summary ? (
        <View style={styles.summaryPanel}>
          <DetailRow label="Consultation Income" value={formatCurrency(summary.consultationIncome)} />
          <DetailRow label="Paid Pharmacy Fees" value={formatCurrency(summary.pharmacyIncome)} />
          <DetailRow label="Organization Pool" value={formatCurrency(summary.organizationPool)} />
          <DetailRow label="Staff Pool Share" value={formatCurrency(summary.staffPoolShare)} />
        </View>
      ) : null}

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{formatCurrency(totals.totalAmount)}</Text>
          <Text style={styles.summaryLabel}>Total Salaries</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{totals.pendingCount}</Text>
          <Text style={styles.summaryLabel}>Pending</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{totals.paidCount}</Text>
          <Text style={styles.summaryLabel}>Paid</Text>
        </View>
      </View>

      {successMessage ? <Text style={styles.success}>{successMessage}</Text> : null}
      <ErrorMessage message={error} />

      <FlatList
        data={salaries}
        keyExtractor={(item) => item._id}
        renderItem={renderSalary}
        contentContainerStyle={salaries.length ? styles.list : styles.emptyList}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => fetchSalaries(true)} />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>No salary records found for this month.</Text>
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
    marginBottom: 6,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 14,
  },
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 14,
  },
  inputLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
  },
  summaryPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    marginBottom: 12,
    padding: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    padding: 10,
  },
  summaryValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: 12,
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
  staffName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 5,
  },
  staffMeta: {
    color: colors.textMuted,
    fontSize: 14,
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
  paidStatus: {
    backgroundColor: colors.successBackground,
    color: colors.success,
  },
  pendingStatus: {
    backgroundColor: '#FEF3C7',
    color: '#B45309',
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
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  amountValue: {
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
  button: {
    marginTop: 12,
  },
  paidText: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 12,
    textAlign: 'right',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 16,
    textAlign: 'center',
  },
});

export default ManageSalariesScreen;
