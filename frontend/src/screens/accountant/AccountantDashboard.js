import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import client from '../../api/client';
import AnnouncementCarousel from '../../components/AnnouncementCarousel';
import CustomButton from '../../components/CustomButton';
import ErrorMessage from '../../components/ErrorMessage';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || 'Unable to load accountant dashboard.';

const formatCurrency = (value) =>
  `Rs. ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const getNestedTotal = (source) => Number(source?.total || 0);

const MetricCard = ({ styles, label, value, helper, accentColor, toneStyle }) => (
  <View style={styles.metricCard}>
    <View style={styles.metricHeader}>
      <View style={[styles.metricIcon, { backgroundColor: accentColor }]} />
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
    <Text style={[styles.metricValue, toneStyle]}>{value}</Text>
    <Text style={styles.metricHelper}>{helper}</Text>
  </View>
);

const AccountantDashboard = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user, logout } = useAuth();
  const displayName = user?.username || user?.email || 'Accountant';
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchReport = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setError('');

    try {
      const response = await client.get('/accountant/financial-report');
      setReport(response.data.report || null);
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const financials = useMemo(() => {
    const consultationRevenue = getNestedTotal(report?.revenue?.consultationRevenue);
    const pharmacyIncome = getNestedTotal(report?.revenue?.pharmacyIncome);
    const unpaidLiabilities = getNestedTotal(report?.liabilities?.unpaidSalaries);
    const paidPayouts = getNestedTotal(report?.payouts?.paidSalaries);
    const estimatedNetPosition = Number(report?.estimatedNetPosition || 0);

    return {
      consultationRevenue,
      pharmacyIncome,
      unpaidLiabilities,
      paidPayouts,
      estimatedNetPosition,
    };
  }, [report]);

  const netToneStyle =
    financials.estimatedNetPosition < 0 ? styles.negativeValue : styles.positiveValue;
  const loadingValue = isLoading ? '...' : null;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => fetchReport(true)}
          tintColor={colors.primary}
          colors={[colors.primary]}
          progressBackgroundColor={colors.surfaceElevated}
        />
      }
    >
      <AnnouncementCarousel />

      <View style={styles.header}>
        <Text style={styles.eyebrow}>Accountant Portal</Text>
        <Text style={styles.title}>Welcome back, {displayName}</Text>
        <Text style={styles.subtitle}>
          Review revenue, liabilities, payouts, and cash position from one finance cockpit.
        </Text>
      </View>

      <ErrorMessage message={error} />

      <View style={styles.heroPanel}>
        <Text style={styles.heroLabel}>Estimated Net Position</Text>
        <Text style={[styles.heroValue, netToneStyle]}>
          {loadingValue || formatCurrency(financials.estimatedNetPosition)}
        </Text>
        <Text style={styles.heroMeta}>
          {report?.period ? `Period: ${report.period}` : 'All-time financial summary'}
        </Text>
      </View>

      <View style={styles.metricsGrid}>
        <MetricCard
          styles={styles}
          label="Consultation Revenue"
          value={loadingValue || formatCurrency(financials.consultationRevenue)}
          helper="Confirmed appointment payments"
          accentColor={colors.primary}
        />
        <MetricCard
          styles={styles}
          label="Pharmacy Income"
          value={loadingValue || formatCurrency(financials.pharmacyIncome)}
          helper="Paid pharmacy prescription fees"
          accentColor={colors.secondary}
        />
        <MetricCard
          styles={styles}
          label="Unpaid Liabilities"
          value={loadingValue || formatCurrency(financials.unpaidLiabilities)}
          helper="Pending salary obligations"
          accentColor={colors.warning}
          toneStyle={styles.warningValue}
        />
        <MetricCard
          styles={styles}
          label="Paid Payouts"
          value={loadingValue || formatCurrency(financials.paidPayouts)}
          helper="Settled salary records"
          accentColor={colors.success}
        />
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Finance Actions</Text>
        <Text style={styles.panelText}>
          Verify pending payments, adjust salary settings, and keep audit records current.
        </Text>

        <CustomButton
          title="Manage Payments"
          onPress={() => navigation.navigate('ManagePayments')}
          style={styles.button}
        />
        <CustomButton
          title="Manage Salaries"
          type="secondary"
          onPress={() => navigation.navigate('ManageSalaries')}
          style={styles.button}
        />
        <CustomButton
          title="My Profile"
          type="secondary"
          onPress={() => navigation.navigate('MyProfile')}
          style={styles.button}
        />
        <CustomButton
          title="Log Out"
          type="secondary"
          onPress={logout}
          style={styles.button}
        />
      </View>
    </ScrollView>
  );
};

const createStyles = (colors) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: 16,
    paddingBottom: 28,
  },
  header: {
    marginBottom: 16,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 27,
    fontWeight: '800',
    lineHeight: 34,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  heroPanel: {
    backgroundColor: colors.surfaceGlass,
    borderColor: colors.borderStrong,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 12,
    padding: 18,
    shadowColor: colors.shadowSoft,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 3,
  },
  heroLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  heroValue: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 40,
    marginTop: 8,
  },
  heroMeta: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  metricsGrid: {
    gap: 12,
  },
  metricCard: {
    backgroundColor: colors.surfaceGlass,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    padding: 15,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 2,
  },
  metricHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  metricIcon: {
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  metricLabel: {
    color: colors.textMuted,
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  metricValue: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 31,
    marginTop: 10,
  },
  metricHelper: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  positiveValue: {
    color: colors.success,
  },
  negativeValue: {
    color: colors.error,
  },
  warningValue: {
    color: colors.warning,
  },
  panel: {
    backgroundColor: colors.surfaceGlass,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 16,
    padding: 16,
  },
  panelTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  panelText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
  },
  button: {
    alignSelf: 'stretch',
    marginTop: 12,
  },
});

export default AccountantDashboard;
