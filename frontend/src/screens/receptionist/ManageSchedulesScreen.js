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
import InputField from '../../components/InputField';
import Loading from '../../components/Loading';
import colors from '../../theme/colors';

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || 'Unable to manage schedules.';

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

const getDoctorSpecialization = (doctor) =>
  doctor?.doctorProfile?.specialization || doctor?.specialization || 'General';

const formatTimeInput = (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 4);

  if (digits.length <= 2) {
    return digits;
  }

  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
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

const canDeleteSchedule = (schedule) => schedule.status !== 'Booked' && !schedule.appointment;

const ManageSchedulesScreen = () => {
  const [doctors, setDoctors] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [isDoctorPickerOpen, setIsDoctorPickerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const scheduleDate = useMemo(() => formatDateInput(selectedDate), [selectedDate]);
  const selectedDoctor = doctors.find((doctor) => doctor._id === selectedDoctorId);

  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setError('');

    try {
      const [doctorsResponse, schedulesResponse] = await Promise.all([
        client.get('/patient/doctors'),
        client.get('/receptionist/schedules'),
      ]);
      const nextDoctors = doctorsResponse.data.doctors || [];

      setDoctors(nextDoctors);
      setSchedules(schedulesResponse.data.schedules || []);
      setSelectedDoctorId((currentDoctorId) =>
        nextDoctors.some((doctor) => doctor._id === currentDoctorId)
          ? currentDoctorId
          : nextDoctors[0]?._id || ''
      );
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const validateForm = () => {
    if (!selectedDoctorId) {
      return 'Select an active doctor before creating a schedule.';
    }

    if (!timePattern.test(startTime) || !timePattern.test(endTime)) {
      return 'Start time and end time must use HH:MM format.';
    }

    if (endTime <= startTime) {
      return 'End time must be later than start time.';
    }

    return '';
  };

  const handleDateChange = (event, value) => {
    if (Platform.OS !== 'ios') {
      setIsDatePickerOpen(false);
    }

    if (event?.type === 'dismissed' || !value) {
      return;
    }

    setSelectedDate(value);
  };

  const handleCreateSchedule = async () => {
    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      setSuccessMessage('');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setSuccessMessage('');

    try {
      await client.post('/receptionist/schedules', {
        doctorId: selectedDoctorId,
        scheduleDate,
        startTime,
        endTime,
      });
      setStartTime('');
      setEndTime('');
      await fetchData(true);
      setSuccessMessage('Schedule slot created successfully.');
    } catch (createError) {
      setError(getErrorMessage(createError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSchedule = (schedule) => {
    Alert.alert('Delete Schedule', 'Delete this unbooked schedule slot?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setError('');
            setSuccessMessage('');
            await client.delete(`/receptionist/schedules/${schedule._id}`);
            await fetchData(true);
            setSuccessMessage('Schedule slot deleted successfully.');
          } catch (deleteError) {
            Alert.alert('Delete Failed', getErrorMessage(deleteError));
          }
        },
      },
    ]);
  };

  const renderDoctorPicker = () => {
    if (!isDoctorPickerOpen) {
      return null;
    }

    return (
      <View style={styles.dropdownMenu}>
        {doctors.length ? (
          doctors.map((doctor) => {
            const isSelected = doctor._id === selectedDoctorId;

            return (
              <TouchableOpacity
                key={doctor._id}
                activeOpacity={0.82}
                onPress={() => {
                  setSelectedDoctorId(doctor._id);
                  setIsDoctorPickerOpen(false);
                }}
                style={[styles.doctorOption, isSelected && styles.selectedDoctorOption]}
              >
                <Text style={[styles.doctorOptionName, isSelected && styles.selectedDoctorText]}>
                  {doctor.username}
                </Text>
                <Text style={[styles.doctorOptionMeta, isSelected && styles.selectedDoctorText]}>
                  {getDoctorSpecialization(doctor)}
                </Text>
              </TouchableOpacity>
            );
          })
        ) : (
          <Text style={styles.emptyPickerText}>No active doctors found.</Text>
        )}
      </View>
    );
  };

  const renderSchedule = ({ item }) => {
    const doctor = item.doctor;
    const doctorName = doctor?.username || 'Doctor';
    const specialization = getDoctorSpecialization(doctor);

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleGroup}>
            <Text style={styles.slotDate}>{formatDate(item.scheduleDate)}</Text>
            <Text style={styles.meta}>Doctor: {doctorName}</Text>
            <Text style={styles.meta}>Specialization: {specialization}</Text>
            <Text style={styles.meta}>
              Time: {item.startTime}
              {item.endTime ? ` - ${item.endTime}` : ''}
            </Text>
          </View>
          <Text style={[styles.statusBadge, getStatusStyle(item.status)]}>{item.status}</Text>
        </View>

        {canDeleteSchedule(item) ? (
          <CustomButton
            title="Delete"
            type="secondary"
            onPress={() => handleDeleteSchedule(item)}
            style={styles.deleteButton}
            textStyle={styles.deleteButtonText}
          />
        ) : (
          <Text style={styles.lockedText}>Booked slots are locked.</Text>
        )}
      </View>
    );
  };

  if (isLoading) {
    return <Loading />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Manage Schedules</Text>
      <Text style={styles.subtitle}>Create and maintain doctor availability across the hospital.</Text>

      <View style={styles.form}>
        <Text style={styles.formTitle}>New Schedule Slot</Text>
        <Text style={styles.inputLabel}>Doctor</Text>
        <TouchableOpacity
          activeOpacity={0.82}
          onPress={() => setIsDoctorPickerOpen((value) => !value)}
          style={styles.dropdownButton}
        >
          <View style={styles.dropdownValueGroup}>
            <Text style={styles.dropdownValue}>
              {selectedDoctor?.username || 'Select an active doctor'}
            </Text>
            {selectedDoctor ? (
              <Text style={styles.dropdownMeta}>{getDoctorSpecialization(selectedDoctor)}</Text>
            ) : null}
          </View>
          <Text style={styles.dropdownIcon}>{isDoctorPickerOpen ? 'Close' : 'Select'}</Text>
        </TouchableOpacity>
        {renderDoctorPicker()}

        <Text style={styles.inputLabel}>Schedule Date</Text>
        <TouchableOpacity
          activeOpacity={0.82}
          onPress={() => setIsDatePickerOpen(true)}
          style={styles.dateButton}
        >
          <Text style={styles.dateButtonLabel}>Date</Text>
          <Text style={styles.dateButtonValue}>{scheduleDate}</Text>
        </TouchableOpacity>

        {isDatePickerOpen ? (
          <View style={styles.pickerBox}>
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              minimumDate={new Date()}
              onChange={handleDateChange}
            />
            {Platform.OS === 'ios' ? (
              <CustomButton
                title="Done"
                type="secondary"
                onPress={() => setIsDatePickerOpen(false)}
                style={styles.doneButton}
                textStyle={styles.doneButtonText}
              />
            ) : null}
          </View>
        ) : null}

        <View style={styles.timeRow}>
          <View style={styles.timeField}>
            <Text style={styles.inputLabel}>Start Time</Text>
            <InputField
              placeholder="HH:MM"
              value={startTime}
              onChangeText={(value) => setStartTime(formatTimeInput(value))}
              keyboardType="numeric"
              maxLength={5}
            />
          </View>
          <View style={styles.timeField}>
            <Text style={styles.inputLabel}>End Time</Text>
            <InputField
              placeholder="HH:MM"
              value={endTime}
              onChangeText={(value) => setEndTime(formatTimeInput(value))}
              keyboardType="numeric"
              maxLength={5}
            />
          </View>
        </View>

        <CustomButton
          title="Create Schedule"
          onPress={handleCreateSchedule}
          loading={isSubmitting}
          disabled={!doctors.length}
        />
      </View>

      <ErrorMessage message={successMessage} type="success" />
      <ErrorMessage message={error} />

      <FlatList
        data={schedules}
        keyExtractor={(item) => item._id}
        renderItem={renderSchedule}
        contentContainerStyle={schedules.length ? styles.list : styles.emptyList}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => fetchData(true)} />
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
  inputLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 7,
  },
  dropdownButton: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    minHeight: 58,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dropdownValueGroup: {
    flex: 1,
  },
  dropdownValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  dropdownMeta: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 3,
  },
  dropdownIcon: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 10,
  },
  dropdownMenu: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 8,
  },
  doctorOption: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  selectedDoctorOption: {
    backgroundColor: colors.primary,
  },
  doctorOptionName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  doctorOptionMeta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 3,
  },
  selectedDoctorText: {
    color: colors.white,
  },
  emptyPickerText: {
    color: colors.textMuted,
    fontSize: 14,
    padding: 10,
    textAlign: 'center',
  },
  dateButton: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    minHeight: 58,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateButtonLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  dateButtonValue: {
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
  timeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  timeField: {
    flex: 1,
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
    borderColor: colors.error,
    marginTop: 12,
  },
  deleteButtonText: {
    color: colors.error,
  },
  lockedText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
    textAlign: 'right',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 16,
    textAlign: 'center',
  },
});

export default ManageSchedulesScreen;
