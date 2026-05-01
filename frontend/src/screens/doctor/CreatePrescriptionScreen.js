import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import client from '../../api/client';
import CustomButton from '../../components/CustomButton';
import ErrorMessage from '../../components/ErrorMessage';
import InputField from '../../components/InputField';
import colors from '../../theme/colors';

const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || 'Unable to create prescription.';

const CreatePrescriptionScreen = ({ navigation, route }) => {
  const { appointmentId } = route.params || {};
  const [medicineCode, setMedicineCode] = useState('');
  const [quantity, setQuantity] = useState('');
  const [medicines, setMedicines] = useState([]);
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddMedicine = () => {
    setError('');

    if (!medicineCode.trim() || !quantity || Number(quantity) < 1) {
      setError('Medicine code and a valid quantity are required.');
      return;
    }

    setMedicines((current) => [
      ...current,
      {
        medicineCode: medicineCode.trim().toUpperCase(),
        quantity: Number(quantity),
      },
    ]);
    setMedicineCode('');
    setQuantity('');
  };

  const handleCreatePrescription = async () => {
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

      Alert.alert('Prescription Created', 'Prescription saved successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (createError) {
      setError(getErrorMessage(createError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderMedicine = ({ item, index }) => (
    <View style={styles.medicineRow}>
      <Text style={styles.medicineText}>
        {index + 1}. {item.medicineCode} x {item.quantity}
      </Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <Text style={styles.title}>Create Prescription</Text>
      <ErrorMessage message={error} />

      <InputField
        placeholder="Diagnosis"
        value={diagnosis}
        onChangeText={setDiagnosis}
        autoCapitalize="sentences"
      />
      <InputField
        placeholder="Notes"
        value={notes}
        onChangeText={setNotes}
        autoCapitalize="sentences"
      />

      <View style={styles.form}>
        <Text style={styles.formTitle}>Add Medicine</Text>
        <InputField
          placeholder="Medicine code, e.g. MED001"
          value={medicineCode}
          onChangeText={setMedicineCode}
          autoCapitalize="characters"
        />
        <InputField
          placeholder="Quantity"
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="numeric"
        />
        <CustomButton title="Add Medicine" type="secondary" onPress={handleAddMedicine} />
      </View>

      <FlatList
        data={medicines}
        keyExtractor={(item, index) => `${item.medicineCode}-${index}`}
        renderItem={renderMedicine}
        ListEmptyComponent={<Text style={styles.emptyText}>No medicines added yet.</Text>}
        style={styles.list}
      />

      <CustomButton
        title="Submit Prescription"
        onPress={handleCreatePrescription}
        loading={isSubmitting}
        style={styles.submitButton}
      />
    </KeyboardAvoidingView>
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
  list: {
    flex: 1,
  },
  medicineRow: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
    padding: 12,
  },
  medicineText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 15,
    textAlign: 'center',
    paddingVertical: 20,
  },
  submitButton: {
    marginTop: 12,
  },
});

export default CreatePrescriptionScreen;
