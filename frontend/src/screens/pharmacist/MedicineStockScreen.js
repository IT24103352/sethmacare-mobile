import React, { useCallback, useEffect, useState } from 'react';
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
import Loading from '../../components/Loading';
import colors from '../../theme/colors';

const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || 'Unable to load medicine stock.';

const MedicineStockScreen = ({ navigation }) => {
  const [medicines, setMedicines] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchMedicines = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setError('');

    try {
      const response = await client.get('/pharmacist/medicines');
      setMedicines(response.data.medicines || []);
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => fetchMedicines());
    return unsubscribe;
  }, [fetchMedicines, navigation]);

  const handleDelete = (medicineId) => {
    Alert.alert('Delete Medicine', 'Do you want to delete this medicine?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await client.delete(`/pharmacist/medicines/${medicineId}`);
            await fetchMedicines(true);
          } catch (deleteError) {
            Alert.alert('Delete Failed', getErrorMessage(deleteError));
          }
        },
      },
    ]);
  };

  const renderMedicine = ({ item }) => {
    const lowStock = Number(item.stock) <= Number(item.reorderLevel);

    return (
      <View style={[styles.card, lowStock && styles.lowStockCard]}>
        <View style={styles.cardHeader}>
          <View style={styles.cardMain}>
            <Text style={[styles.name, lowStock && styles.lowStockText]}>{item.name}</Text>
            <Text style={styles.meta}>Code: {item.medicineCode}</Text>
            <Text style={styles.meta}>Stock: {item.stock}</Text>
            <Text style={styles.meta}>Reorder Level: {item.reorderLevel}</Text>
            <Text style={styles.meta}>Price: Rs. {item.price}</Text>
          </View>
          {lowStock ? <Text style={styles.lowStockBadge}>LOW</Text> : null}
        </View>
        <CustomButton
          title="Delete"
          type="secondary"
          onPress={() => handleDelete(item._id)}
          style={styles.deleteButton}
        />
      </View>
    );
  };

  if (isLoading) {
    return <Loading />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Medicine Stock</Text>
          <Text style={styles.subtitle}>{medicines.length} medicines</Text>
        </View>
        <CustomButton
          title="Add"
          onPress={() => navigation.navigate('AddMedicine')}
          style={styles.addButton}
          textStyle={styles.addButtonText}
        />
      </View>
      <ErrorMessage message={error} />

      <FlatList
        data={medicines}
        keyExtractor={(item) => item._id}
        renderItem={renderMedicine}
        contentContainerStyle={medicines.length ? styles.list : styles.emptyList}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => fetchMedicines(true)} />
        }
        ListEmptyComponent={<Text style={styles.emptyText}>No medicines found.</Text>}
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
    marginBottom: 16,
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
  addButton: {
    minHeight: 40,
    paddingHorizontal: 16,
  },
  addButtonText: {
    fontSize: 14,
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
  lowStockCard: {
    borderColor: colors.error,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  cardMain: {
    flex: 1,
  },
  name: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  lowStockText: {
    color: colors.error,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: 4,
  },
  lowStockBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.errorBackground,
    borderRadius: 999,
    color: colors.error,
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  deleteButton: {
    marginTop: 12,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 16,
    textAlign: 'center',
  },
});

export default MedicineStockScreen;
