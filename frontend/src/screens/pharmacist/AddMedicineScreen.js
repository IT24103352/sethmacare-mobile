import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text } from 'react-native';
import client from '../../api/client';
import CustomButton from '../../components/CustomButton';
import ErrorMessage from '../../components/ErrorMessage';
import InputField from '../../components/InputField';
import colors from '../../theme/colors';

const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || 'Unable to add medicine.';

const AddMedicineScreen = ({ navigation }) => {
  const [name, setName] = useState('');
  const [stock, setStock] = useState('');
  const [reorderLevel, setReorderLevel] = useState('50');
  const [price, setPrice] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddMedicine = async () => {
    setError('');

    if (!name.trim() || !stock || !reorderLevel || !price) {
      setError('Name, stock, reorder level, and price are required.');
      return;
    }

    setIsSubmitting(true);

    try {
      await client.post('/pharmacist/medicines', {
        name: name.trim(),
        stock: Number(stock),
        reorderLevel: Number(reorderLevel),
        price: Number(price),
      });

      navigation.navigate('MedicineStock');
    } catch (addError) {
      setError(getErrorMessage(addError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <Text style={styles.title}>Add Medicine</Text>
      <ErrorMessage message={error} />
      <InputField
        placeholder="Medicine name"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
      />
      <InputField
        placeholder="Stock"
        value={stock}
        onChangeText={setStock}
        keyboardType="numeric"
      />
      <InputField
        placeholder="Reorder level"
        value={reorderLevel}
        onChangeText={setReorderLevel}
        keyboardType="numeric"
      />
      <InputField
        placeholder="Price"
        value={price}
        onChangeText={setPrice}
        keyboardType="numeric"
      />
      <CustomButton
        title="Save Medicine"
        onPress={handleAddMedicine}
        loading={isSubmitting}
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
});

export default AddMedicineScreen;
