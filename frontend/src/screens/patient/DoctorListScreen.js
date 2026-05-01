import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
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

const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || 'Unable to load doctors.';

const DoctorListScreen = ({ navigation }) => {
  const [doctors, setDoctors] = useState([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchDoctors = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setError('');

    try {
      const response = await client.get('/patient/doctors');
      setDoctors(response.data.doctors || []);
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  const filteredDoctors = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) {
      return doctors;
    }

    return doctors.filter((doctor) => {
      const username = doctor.username?.toLowerCase() || '';
      const specialization = doctor.doctorProfile?.specialization?.toLowerCase() || '';
      return username.includes(term) || specialization.includes(term);
    });
  }, [doctors, search]);

  const renderDoctor = ({ item }) => {
    const specialization = item.doctorProfile?.specialization || 'General';
    const consultationFee = item.doctorProfile?.consultationFee ?? 0;

    return (
      <View style={styles.card}>
        <Text style={styles.name}>{item.username}</Text>
        <Text style={styles.meta}>Specialization: {specialization}</Text>
        <Text style={styles.meta}>Consultation Fee: Rs. {consultationFee}</Text>
        <CustomButton
          title="View Schedule"
          onPress={() =>
            navigation.navigate('BookAppointment', {
              doctorId: item._id,
              doctorName: item.username,
              specialization,
              consultationFee,
            })
          }
          style={styles.button}
        />
      </View>
    );
  };

  if (isLoading) {
    return <Loading />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choose a Doctor</Text>
      <InputField
        placeholder="Search by doctor or specialization"
        value={search}
        onChangeText={setSearch}
      />
      <ErrorMessage message={error} />
      <FlatList
        data={filteredDoctors}
        keyExtractor={(item) => item._id}
        renderItem={renderDoctor}
        contentContainerStyle={filteredDoctors.length ? styles.list : styles.emptyList}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => fetchDoctors(true)} />
        }
        ListEmptyComponent={<Text style={styles.emptyText}>No doctors found.</Text>}
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
  name: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: 4,
  },
  button: {
    marginTop: 12,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 16,
    textAlign: 'center',
  },
});

export default DoctorListScreen;
