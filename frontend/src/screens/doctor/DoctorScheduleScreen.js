import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import client from '../../api/client';
import CustomButton from '../../components/CustomButton';
import ErrorMessage from '../../components/ErrorMessage';
import Loading from '../../components/Loading';
import colors from '../../theme/colors';

const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || 'Unable to process schedule request.';

const formatDate = (value) => {
  if (!value) {
    return 'Unknown date';
  }

  return new Date(value).toLocaleDateString();
};

const formatDateInput = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatTimeInput = (date) => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

const getStatusStyle = (status) => {
  if (status === 'Available') {
    return styles.availableBadge;
  }

  if (status === 'Booked') {
    return styles.bookedBadge;
  }

  return styles.cancelledBadge;
};

const DoctorScheduleScreen = () => {
  const [schedules, setSchedules] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(() => {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    now.setHours(now.getHours() + 1);
    return now;
  });
  const [activePicker, setActivePicker] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const scheduleDate = useMemo(() => formatDateInput(selectedDate), [selectedDate]);
  const startTime = useMemo(() => formatTimeInput(selectedTime), [selectedTime]);

  const fetchSchedules = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setError('');

    try {
      const response = await client.get('/doctor/schedules');
      setSchedules(response.data.schedules || []);
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const handlePickerChange = (event, value) => {
    if (Platform.OS !== 'ios') {
      setActivePicker(null);
    }

    if (event?.type === 'dismissed' || !value) {
      return;
    }

    if (activePicker === 'date') {
      setSelectedDate(value);
    } else if (activePicker === 'time') {
      setSelectedTime(value);
    }
  };

  const handleAddSlot = async () => {
    setError('');
    setIsSubmitting(true);

    try {
      await client.post('/doctor/schedules', {
        scheduleDate,
        startTime,
      });
      await fetchSchedules(true);
    } catch (addError) {
      setError(getErrorMessage(addError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (slotId) => {
    Alert.alert('Delete Slot', 'Delete this available schedule slot?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await client.delete(`/doctor/schedules/${slotId}`);
            await fetchSchedules(true);
          } catch (deleteError) {
            Alert.alert('Delete Failed', getErrorMessage(deleteError));
          }
        },
      },
    ]);
  };

  const renderPicker = () => {
    if (!activePicker) {
      return null;
    }

    return (
      <View style={styles.pickerBox}>
        <DateTimePicker
          value={activePicker === 'date' ? selectedDate : selectedTime}
          mode={activePicker}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={activePicker === 'date' ? new Date() : undefined}
          onChange={handlePickerChange}
        />
        {Platform.OS === 'ios' ? (
          <CustomButton
            title="Done"
            type="secondary"
            onPress={() => setActivePicker(null)}
            style={styles.doneButton}
            textStyle={styles.doneButtonText}
          />
        ) : null}
      </View>
    );
  };

  const renderSchedule = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleGroup}>
          <Text style={styles.slotDate}>{formatDate(item.scheduleDate)}</Text>
          <Text style={styles.meta}>Time: {item.startTime}</Text>
        </View>
        <Text style={[styles.statusBadge, getStatusStyle(item.status)]}>{item.status}</Text>
      </View>

      {item.status === 'Available' ? (
        <CustomButton
          title="Delete"
          type="secondary"
          onPress={() => handleDelete(item._id)}
          style={styles.deleteButton}
        />
      ) : null}
    </View>
  );

  if (isLoading) {
    return <Loading />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Schedule</Text>
      <Text style={styles.subtitle}>Add available consultation slots using date and time pickers.</Text>

      <View style={styles.form}>
        <Text style={styles.formTitle}>Add New Slot</Text>
        <View style={styles.pickerRow}>
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={() => setActivePicker('date')}
            style={styles.pickerField}
          >
            <Text style={styles.pickerLabel}>Date</Text>
            <Text style={styles.pickerValue}>{scheduleDate}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.82}
            onPress={() => setActivePicker('time')}
            style={styles.pickerField}
          >
            <Text style={styles.pickerLabel}>Start Time</Text>
            <Text style={styles.pickerValue}>{startTime}</Text>
          </TouchableOpacity>
        </View>

        {renderPicker()}

        <CustomButton title="Add Slot" onPress={handleAddSlot} loading={isSubmitting} />
      </View>

      <ErrorMessage message={error} />

      <FlatList
        data={schedules}
        keyExtractor={(item) => item._id}
        renderItem={renderSchedule}
        contentContainerStyle={schedules.length ? styles.list : styles.emptyList}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => fetchSchedules(true)} />
        }
        ListEmptyComponent={<Text style={styles.emptyText}>No schedule slots found.</Text>}
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
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
    marginTop: 4,
  },
  form: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    padding: 14,
  },
  formTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 12,
  },
  pickerRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  pickerField: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 58,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pickerLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  pickerValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  pickerBox: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
    padding: Platform.OS === 'ios' ? 8 : 0,
  },
  doneButton: {
    margin: 8,
    minHeight: 38,
  },
  doneButtonText: {
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
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  cardTitleGroup: {
    flex: 1,
  },
  slotDate: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 6,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: 4,
  },
  statusBadge: {
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  availableBadge: {
    backgroundColor: colors.successBackground,
    color: colors.success,
  },
  bookedBadge: {
    backgroundColor: '#DBEAFE',
    color: colors.primary,
  },
  cancelledBadge: {
    backgroundColor: colors.errorBackground,
    color: colors.error,
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

export default DoctorScheduleScreen;
