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
import { useTheme } from '../../context/ThemeContext';

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

const formatPercentage = (value) => {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 'N/A';
  }

  return `${numericValue.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}%`;
};

const DetailRow = ({ styles, label, value }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value || 'N/A'}</Text>
  </View>
);

const ManageSalariesScreen = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [month, setMonth] = useState(getCurrentMonth());
  const [organizationCutPercentage, setOrganizationCutPercentage] = useState('30');
  const [salaries, setSalaries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [payingId, setPayingId] = useState('');
  const [error, setError] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const isValidMonth = monthPattern.test(month.trim());
  const organizationCutValue = Number(organizationCutPercentage);
  const isValidOrganizationCut =
    Number.isFinite(organizationCutValue) && organizationCutValue >= 0 && organizationCutValue <= 100;

  const fetchFinanceSettings = useCallback(async () => {
    try {
      const response = await client.get('/accountant/financial-report');
      const currentCut = response.data.report?.settings?.organizationCutPercentage;

      if (Number.isFinite(Number(currentCut))) {
        setOrganizationCutPercentage(String(currentCut));
      }

      setSettingsError('');
    } catch (settingsFetchError) {
      setSettingsError(getErrorMessage(settingsFetchError));
    }
  }, []);

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

  useEffect(() => {
    fetchFinanceSettings();
  }, [fetchFinanceSettings]);

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

  const handleSaveSettings = async () => {
    if (!isValidOrganizationCut) {
      setSettingsError('Organization cut must be a number from 0 to 100.');
      return;
    }

    setSettingsError('');
    setError('');
    setSuccessMessage('');
    setIsSavingSettings(true);

    try {
      const response = await client.patch('/accountant/settings', {
        organizationCutPercentage: organizationCutValue,
      });
      const savedCut = Number(response.data.settings?.organizationCutPercentage ?? organizationCutValue);
      setOrganizationCutPercentage(String(savedCut));
      setSummary((currentSummary) =>
        currentSummary
          ? {
              ...currentSummary,
              organizationCutPercentage: savedCut,
              doctorCutPercentage: 100 - savedCut,
            }
          : currentSummary
      );
      setSuccessMessage('Finance settings updated successfully.');
    } catch (settingsUpdateError) {
      const message = getErrorMessage(settingsUpdateError);
      setSettingsError(message);
      Alert.alert('Settings Update Failed', message);
    } finally {
      setIsSavingSettings(false);
    }
  };

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
      const generatedCut = response.data.summary?.organizationCutPercentage;

      if (Number.isFinite(Number(generatedCut))) {
        setOrganizationCutPercentage(String(generatedCut));
      }

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
    const calculation = item.calculation || {};

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
          <DetailRow styles={styles} label="Month" value={item.month} />
          <DetailRow
            styles={styles}
            label="Doctor Share"
            value={formatCurrency(item.doctorConsultationShare)}
          />
          <DetailRow
            styles={styles}
            label="Organization Source"
            value={formatCurrency(item.organizationShareSource)}
          />
          <DetailRow
            styles={styles}
            label="Org Cut Snapshot"
            value={formatPercentage(calculation.organizationCutPercentage)}
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
      <Text style={styles.subtitle}>
        Configure finance splits and generate monthly salary records from consultation and pharmacy income.
      </Text>

      <View style={styles.settingsPanel}>
        <Text style={styles.panelTitle}>Finance Configuration</Text>
        <Text style={styles.panelText}>
          Set the organization percentage used when new doctor salary calculations are generated.
        </Text>
        <InputField
          placeholder="Organization cut percentage"
          value={organizationCutPercentage}
          onChangeText={(value) => {
            setOrganizationCutPercentage(value);
            setSettingsError('');
          }}
          keyboardType="decimal-pad"
          error={settingsError}
          helperText={
            isValidOrganizationCut
              ? `Doctor cut: ${formatPercentage(100 - organizationCutValue)}`
              : 'Enter a percentage from 0 to 100.'
          }
        />
        <CustomButton
          title="Save Settings"
          onPress={handleSaveSettings}
          loading={isSavingSettings}
          disabled={!isValidOrganizationCut}
        />
      </View>

      <View style={styles.panel}>
        <Text style={styles.inputLabel}>Salary Month</Text>
        <InputField
          placeholder="YYYY-MM"
          value={month}
          onChangeText={setMonth}
          autoCapitalize="none"
          error={!isValidMonth ? 'Use YYYY-MM format.' : ''}
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
          <DetailRow styles={styles} label="Consultation Income" value={formatCurrency(summary.consultationIncome)} />
          <DetailRow styles={styles} label="Paid Pharmacy Fees" value={formatCurrency(summary.pharmacyIncome)} />
          <DetailRow styles={styles} label="Organization Pool" value={formatCurrency(summary.organizationPool)} />
          <DetailRow styles={styles} label="Staff Pool Share" value={formatCurrency(summary.staffPoolShare)} />
          <DetailRow styles={styles} label="Organization Cut" value={formatPercentage(summary.organizationCutPercentage)} />
          <DetailRow styles={styles} label="Doctor Cut" value={formatPercentage(summary.doctorCutPercentage)} />
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

      <ErrorMessage message={successMessage} type="success" />
      <ErrorMessage message={error} />

      <FlatList
        data={salaries}
        keyExtractor={(item) => item._id}
        renderItem={renderSalary}
        contentContainerStyle={salaries.length ? styles.list : styles.emptyList}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              fetchSalaries(true);
              fetchFinanceSettings();
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surfaceElevated}
          />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>No salary records found for this month.</Text>
        }
      />
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
    marginBottom: 6,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 14,
  },
  settingsPanel: {
    backgroundColor: colors.surfaceGlass,
    borderColor: colors.borderStrong,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    padding: 14,
    shadowColor: colors.shadowSoft,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 2,
  },
  panel: {
    backgroundColor: colors.surfaceGlass,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    padding: 14,
  },
  panelTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  panelText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
    marginTop: 5,
  },
  inputLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
  },
  summaryPanel: {
    backgroundColor: colors.surfaceGlass,
    borderColor: colors.border,
    borderRadius: 16,
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
    backgroundColor: colors.surfaceGlass,
    borderColor: colors.border,
    borderRadius: 16,
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
    backgroundColor: colors.warningBackground,
    color: colors.warning,
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
