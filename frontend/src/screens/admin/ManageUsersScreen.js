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
import client from '../../api/client';
import CustomButton from '../../components/CustomButton';
import ErrorMessage from '../../components/ErrorMessage';
import Loading from '../../components/Loading';
import colors from '../../theme/colors';

const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || 'Unable to load users.';

const ManageUsersScreen = ({ navigation, route }) => {
  const [users, setUsers] = useState([]);
  const [pendingOnly, setPendingOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
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
      </View>

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
