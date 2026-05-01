import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import client from '../../api/client';
import CustomButton from '../../components/CustomButton';
import ErrorMessage from '../../components/ErrorMessage';
import InputField from '../../components/InputField';
import Loading from '../../components/Loading';
import colors from '../../theme/colors';

const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || 'Unable to create prescription.';

const CreatePrescription = ({ navigation, route }) => {
  const { appointmentId, appointmentCode, patientName = 'Patient' } = route.params || {};
  const [availableMedicines, setAvailableMedicines] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [selectedMedicine, setSelectedMedicine] = useState(null);
  const [quantity, setQuantity] = useState('');
  const [dosage, setDosage] = useState('');
  const [duration, setDuration] = useState('');
  const [instructions, setInstructions] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');
  const [isMedicinePickerOpen, setIsMedicinePickerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchMedicines = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await client.get('/doctor/medicines');
      setAvailableMedicines(response.data.medicines || []);
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMedicines();
  }, [fetchMedicines]);

  const filteredMedicines = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) {
      return availableMedicines;
    }

    return availableMedicines.filter((medicine) => {
      const name = medicine.name?.toLowerCase() || '';
      const code = medicine.medicineCode?.toLowerCase() || '';
      return name.includes(term) || code.includes(term);
    });
  }, [availableMedicines, search]);

  const resetMedicineFields = () => {
    setSelectedMedicine(null);
    setQuantity('');
    setDosage('');
    setDuration('');
    setInstructions('');
  };

  const handleAddMedicine = () => {
    setError('');

    if (!selectedMedicine) {
      setError('Select a medicine before adding it.');
      return;
    }

    if (!quantity || Number(quantity) < 1) {
      setError('Quantity must be at least 1.');
      return;
    }

    setMedicines((current) => [
      ...current,
      {
        medicineId: selectedMedicine._id || selectedMedicine.id,
        medicineCode: selectedMedicine.medicineCode,
        medicineName: selectedMedicine.name,
        quantity: Number(quantity),
        dosage: dosage.trim(),
        duration: duration.trim(),
        instructions: instructions.trim(),
      },
    ]);
    resetMedicineFields();
  };

  const handleRemoveMedicine = (indexToRemove) => {
    setMedicines((current) =>
      current.filter((_, index) => index !== indexToRemove)
    );
  };

  const handleSubmit = async () => {
    setError('');

    if (!appointmentId) {
      setError('Appointment information is missing.');
      return;
    }

    if (medicines.length === 0) {
      setError('Add at least one medicine before submitting.');
      return;
    }

    setIsSubmitting(true);

    try {
      await client.post('/doctor/prescriptions', {
        appointmentId,
        diagnosis: diagnosis.trim(),
        notes: notes.trim(),
        medicines,
      });

      Alert.alert('Prescription Created', 'Prescription saved and sent to the pharmacist queue.', [
        { text: 'OK', onPress: () => navigation.navigate('ManagePrescriptions') },
      ]);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderMedicineOption = ({ item }) => (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={() => {
        setSelectedMedicine(item);
        setIsMedicinePickerOpen(false);
        setSearch('');
      }}
      style={styles.medicineOption}
    >
      <Text style={styles.medicineName}>{item.name}</Text>
      <Text style={styles.medicineMeta}>
        {item.medicineCode} | Stock: {item.stock} | Rs. {item.price}
      </Text>
    </TouchableOpacity>
  );

  const renderPrescriptionItem = ({ item, index }) => (
    <View style={styles.prescriptionItem}>
      <View style={styles.itemTextBlock}>
        <Text style={styles.itemTitle}>
          {index + 1}. {item.medicineName}
        </Text>
        <Text style={styles.itemMeta}>
          {item.medicineCode} | Qty: {item.quantity}
        </Text>
        {item.dosage || item.duration || item.instructions ? (
          <Text style={styles.itemNotes}>
            {[item.dosage, item.duration, item.instructions].filter(Boolean).join(' | ')}
          </Text>
        ) : null}
      </View>
      <TouchableOpacity
        activeOpacity={0.82}
        onPress={() => handleRemoveMedicine(index)}
        style={styles.removeButton}
      >
        <Text style={styles.removeButtonText}>Remove</Text>
      </TouchableOpacity>
    </View>
  );

  if (isLoading) {
    return <Loading />;
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardView}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create Prescription</Text>
        <Text style={styles.subtitle}>
          {appointmentCode || 'Appointment'} for {patientName}
        </Text>

        <ErrorMessage message={error} />

        <View style={styles.formCard}>
          <Text style={styles.inputLabel}>Diagnosis</Text>
          <InputField
            placeholder="Diagnosis"
            value={diagnosis}
            onChangeText={setDiagnosis}
            autoCapitalize="sentences"
          />

          <Text style={styles.inputLabel}>Clinical Notes</Text>
          <InputField
            placeholder="Notes"
            value={notes}
            onChangeText={setNotes}
            autoCapitalize="sentences"
            multiline
            inputStyle={styles.notesInput}
          />
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Medicines</Text>
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={() => setIsMedicinePickerOpen(true)}
            style={styles.selector}
          >
            <Text style={[styles.selectorText, !selectedMedicine && styles.placeholderText]}>
              {selectedMedicine
                ? `${selectedMedicine.name} (${selectedMedicine.medicineCode})`
                : 'Select medicine'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.inputLabel}>Quantity</Text>
          <InputField
            placeholder="Quantity"
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="numeric"
          />

          <Text style={styles.inputLabel}>Dosage</Text>
          <InputField
            placeholder="e.g. 500mg twice daily"
            value={dosage}
            onChangeText={setDosage}
            autoCapitalize="sentences"
          />

          <Text style={styles.inputLabel}>Duration</Text>
          <InputField
            placeholder="e.g. 5 days"
            value={duration}
            onChangeText={setDuration}
            autoCapitalize="sentences"
          />

          <Text style={styles.inputLabel}>Instructions</Text>
          <InputField
            placeholder="e.g. After meals"
            value={instructions}
            onChangeText={setInstructions}
            autoCapitalize="sentences"
          />

          <CustomButton title="Add Medicine" type="secondary" onPress={handleAddMedicine} />
        </View>

        <View style={styles.addedListCard}>
          <Text style={styles.sectionTitle}>Added Medicines</Text>
          <FlatList
            data={medicines}
            keyExtractor={(item, index) => `${item.medicineCode}-${index}`}
            renderItem={renderPrescriptionItem}
            scrollEnabled={false}
            ListEmptyComponent={<Text style={styles.emptyText}>No medicines added yet.</Text>}
          />
        </View>

        <CustomButton
          title="Submit Prescription"
          onPress={handleSubmit}
          loading={isSubmitting}
          style={styles.submitButton}
        />
      </ScrollView>

      <Modal
        animationType="slide"
        transparent
        visible={isMedicinePickerOpen}
        onRequestClose={() => setIsMedicinePickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Medicine</Text>
              <TouchableOpacity
                activeOpacity={0.82}
                onPress={() => setIsMedicinePickerOpen(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>

            <InputField
              placeholder="Search medicine name or code"
              value={search}
              onChangeText={setSearch}
            />

            <FlatList
              data={filteredMedicines}
              keyExtractor={(item) => item._id}
              renderItem={renderMedicineOption}
              ListEmptyComponent={<Text style={styles.emptyText}>No medicines found.</Text>}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: 16,
    paddingBottom: 28,
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
  formCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    padding: 14,
  },
  addedListCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    padding: 14,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 12,
  },
  inputLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
  },
  notesInput: {
    minHeight: 84,
    textAlignVertical: 'top',
  },
  selector: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    marginBottom: 14,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  selectorText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  placeholderText: {
    color: colors.textMuted,
    fontWeight: '500',
  },
  prescriptionItem: {
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    marginBottom: 10,
    padding: 12,
  },
  itemTextBlock: {
    flex: 1,
  },
  itemTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  itemMeta: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  itemNotes: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  removeButton: {
    borderColor: colors.error,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  removeButtonText: {
    color: colors.error,
    fontSize: 12,
    fontWeight: '800',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 15,
    paddingVertical: 18,
    textAlign: 'center',
  },
  submitButton: {
    marginTop: 4,
  },
  modalBackdrop: {
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    maxHeight: '82%',
    padding: 16,
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  closeButton: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  closeButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  medicineOption: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingVertical: 12,
  },
  medicineName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  medicineMeta: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
});

export default CreatePrescription;
