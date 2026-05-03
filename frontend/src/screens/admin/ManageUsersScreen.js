import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import client from '../../api/client';
import CustomButton from '../../components/CustomButton';
import ErrorMessage from '../../components/ErrorMessage';
import Loading from '../../components/Loading';
import colors from '../../theme/colors';

const csvHeaders = ['username', 'email', 'password', 'role', 'specialization', 'consultationfee'];
const csvRoles = ['Admin', 'Patient', 'Doctor', 'Receptionist', 'Accountant', 'Pharmacist'];

const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || 'Unable to load users.';

const normalizeCsvHeader = (header) =>
  header.replace(/^\uFEFF/, '').trim().toLowerCase();

const normalizeRole = (value) => {
  const trimmedValue = value.trim();
  return csvRoles.find((role) => role.toLowerCase() === trimmedValue.toLowerCase()) || trimmedValue;
};

const parseCsvLine = (line) => {
  const values = [];
  let currentValue = '';
  let isInsideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && isInsideQuotes && nextCharacter === '"') {
      currentValue += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      isInsideQuotes = !isInsideQuotes;
      continue;
    }

    if (character === ',' && !isInsideQuotes) {
      values.push(currentValue.trim());
      currentValue = '';
      continue;
    }

    currentValue += character;
  }

  values.push(currentValue.trim());
  return values;
};

const parseUsersCsv = (csvText) => {
  const rows = csvText
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((row) => row.trim());

  if (rows.length < 2) {
    throw new Error('CSV must include a header row and at least one user row.');
  }

  const headers = parseCsvLine(rows[0]).map(normalizeCsvHeader);
  const missingHeaders = csvHeaders.filter((header) => !headers.includes(header));

  if (missingHeaders.length) {
    throw new Error(`CSV is missing required headers: ${missingHeaders.join(', ')}.`);
  }

  const headerIndex = headers.reduce((map, header, index) => {
    map[header] = index;
    return map;
  }, {});

  return rows.slice(1).map((row, rowIndex) => {
    const rowNumber = rowIndex + 2;
    const columns = parseCsvLine(row);
    const getValue = (header) => columns[headerIndex[header]]?.trim() || '';
    const consultationFeeValue = getValue('consultationfee');
    const user = {
      username: getValue('username'),
      email: getValue('email').toLowerCase(),
      password: getValue('password'),
      role: normalizeRole(getValue('role')),
      specialization: getValue('specialization'),
    };

    if (consultationFeeValue) {
      const consultationFee = Number(consultationFeeValue);

      if (Number.isNaN(consultationFee)) {
        throw new Error(`Row ${rowNumber}: consultationFee must be a number.`);
      }

      user.consultationFee = consultationFee;
    }

    return user;
  });
};

const ManageUsersScreen = ({ navigation, route }) => {
  const [users, setUsers] = useState([]);
  const [pendingOnly, setPendingOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const refreshAt = route?.params?.refreshAt;

  const fetchUsers = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setError('');

    try {
      const endpoint = pendingOnly ? '/auth/users/pending' : '/auth/users';
      const response = await client.get(endpoint);
      setUsers(response.data.users || []);
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [pendingOnly]);

  useFocusEffect(
    useCallback(() => {
      fetchUsers();
    }, [fetchUsers, refreshAt])
  );

  const handleConfirm = async (userId) => {
    try {
      await client.patch(`/auth/users/${userId}/confirm`);
      await fetchUsers(true);
    } catch (confirmError) {
      Alert.alert('Confirm Failed', getErrorMessage(confirmError));
    }
  };

  const handleDelete = (userId) => {
    Alert.alert('Delete User', 'Are you sure you want to delete this user?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await client.delete(`/auth/users/${userId}`);
            await fetchUsers(true);
          } catch (deleteError) {
            Alert.alert('Delete Failed', getErrorMessage(deleteError));
          }
        },
      },
    ]);
  };

  const handleBulkImport = async () => {
    setError('');
    setSuccessMessage('');

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/csv', 'application/vnd.ms-excel'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || result.type === 'cancel') {
        return;
      }

      const asset = result.assets?.[0] || result;

      if (!asset?.uri) {
        throw new Error('Unable to read the selected CSV file.');
      }

      if (asset.name && !asset.name.toLowerCase().endsWith('.csv')) {
        throw new Error('Please select a .csv file.');
      }

      setIsImporting(true);

      const fileResponse = await fetch(asset.uri);
      const csvText = await fileResponse.text();
      const parsedUsers = parseUsersCsv(csvText);

      if (!parsedUsers.length) {
        throw new Error('CSV did not contain any user rows.');
      }

      const response = await client.post('/auth/users/bulk', {
        users: parsedUsers,
      });
      const importedCount = response.data.count || parsedUsers.length;

      await fetchUsers(true);
      setSuccessMessage(`${importedCount} users imported successfully.`);
    } catch (importError) {
      setError(getErrorMessage(importError));
    } finally {
      setIsImporting(false);
    }
  };

  const renderUser = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.userInfo}>
          <Text style={styles.userCode}>{item.userCode || 'User ID unavailable'}</Text>
          <Text style={styles.username}>{item.username}</Text>
          <Text style={styles.email}>{item.email}</Text>
          <Text style={styles.meta}>{item.role}</Text>
        </View>
        <Text style={[styles.badge, item.confirmed ? styles.confirmedBadge : styles.pendingBadge]}>
          {item.confirmed ? 'Confirmed' : 'Pending'}
        </Text>
      </View>

      {!item.confirmed ? (
        <CustomButton
          title="Confirm"
          onPress={() => handleConfirm(item._id)}
          style={styles.actionButton}
        />
      ) : null}

      <CustomButton
        title="Delete"
        type="secondary"
        onPress={() => handleDelete(item._id)}
        style={styles.actionButton}
      />
    </View>
  );

  if (isLoading) {
    return <Loading />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Manage Users</Text>
          <Text style={styles.subtitle}>{users.length} user records</Text>
        </View>
        <CustomButton
          title="+ Add User"
          onPress={() => navigation.navigate('AdminAddUser')}
          style={styles.addButton}
          textStyle={styles.headerButtonText}
        />
      </View>

      <View style={styles.toolbar}>
        <CustomButton
          title={pendingOnly ? 'Show All' : 'Pending Only'}
          type="secondary"
          onPress={() => setPendingOnly((value) => !value)}
          style={styles.filterButton}
          textStyle={styles.headerButtonText}
        />
        <CustomButton
          title="Bulk Import CSV"
          type="secondary"
          onPress={handleBulkImport}
          loading={isImporting}
          style={styles.filterButton}
          textStyle={styles.headerButtonText}
        />
      </View>

      <ErrorMessage message={successMessage} type="success" />
      <ErrorMessage message={error} />

      <FlatList
        data={users}
        keyExtractor={(item) => item._id}
        renderItem={renderUser}
        contentContainerStyle={users.length ? styles.list : styles.emptyList}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => fetchUsers(true)} />
        }
        ListEmptyComponent={<Text style={styles.emptyText}>No users found.</Text>}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 4,
  },
  toolbar: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  addButton: {
    minHeight: 40,
    paddingHorizontal: 12,
  },
  filterButton: {
    minHeight: 40,
    paddingHorizontal: 12,
  },
  headerButtonText: {
    fontSize: 13,
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  userInfo: {
    flex: 1,
  },
  userCode: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 5,
  },
  username: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  email: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 3,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 4,
  },
  badge: {
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  confirmedBadge: {
    backgroundColor: colors.successBackground,
    color: colors.success,
  },
  pendingBadge: {
    backgroundColor: colors.errorBackground,
    color: colors.error,
  },
  actionButton: {
    marginTop: 12,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 16,
    textAlign: 'center',
  },
});

export default ManageUsersScreen;
