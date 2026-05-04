import React, { useState } from 'react'; //admin add user screen
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import CustomButton from '../../components/CustomButton';
import ErrorMessage from '../../components/ErrorMessage';
import InputField from '../../components/InputField';
import { useAuth } from '../../context/AuthContext';
import colors from '../../theme/colors';

const roles = ['Patient', 'Doctor', 'Receptionist', 'Accountant', 'Pharmacist', 'Admin'];

const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || 'Unable to create user.';

const AdminAddUser = ({ navigation }) => {
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Patient');
  const [specialization, setSpecialization] = useState('');
  const [consultationFee, setConsultationFee] = useState('');
  const [isRolePickerOpen, setIsRolePickerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const validateForm = () => {
    if (!username.trim() || !email.trim() || !password) {
      return 'Username, email, and password are required.';
    }

    if (password.length < 6) {
      return 'Password must be at least 6 characters.';
    }

    if (role === 'Doctor' && (!specialization.trim() || !consultationFee)) {
      return 'Doctor specialization and consultation fee are required.';
    }

    return '';
  };

  const handleCreateUser = async () => {
    setError('');
    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    const payload = {
      username: username.trim(),
      email: email.trim().toLowerCase(),
      password,
      role,
    };

    if (role === 'Doctor') {
      payload.doctorProfile = {
        specialization: specialization.trim(),
        consultationFee: Number(consultationFee),
      };
    }

    setIsSubmitting(true);

    try {
      const response = await register(payload);
      Alert.alert('User Created', response.message || 'The user account was created.');
      navigation.navigate('ManageUsers', { refreshAt: Date.now() });
    } catch (createError) {
      setError(getErrorMessage(createError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardView}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Add User</Text>
          <Text style={styles.subtitle}>Create an account for a staff member or patient.</Text>
        </View>

        <ErrorMessage message={error} />

        <View style={styles.formCard}>
          <Text style={styles.inputLabel}>Username</Text>
          <InputField
            placeholder="Username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />

          <Text style={styles.inputLabel}>Email Address</Text>
          <InputField
            placeholder="Email address"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.inputLabel}>Password</Text>
          <InputField
            placeholder="Temporary password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Text style={styles.inputLabel}>Role</Text>
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={() => setIsRolePickerOpen((value) => !value)}
            style={styles.dropdownButton}
          >
            <Text style={styles.dropdownValue}>{role}</Text>
            <Text style={styles.dropdownIcon}>{isRolePickerOpen ? 'Close' : 'Select'}</Text>
          </TouchableOpacity>

          {isRolePickerOpen ? (
            <View style={styles.dropdownMenu}>
              {roles.map((item) => {
                const isSelected = item === role;

                return (
                  <TouchableOpacity
                    key={item}
                    activeOpacity={0.8}
                    onPress={() => {
                      setRole(item);
                      setIsRolePickerOpen(false);
                    }}
                    style={[styles.roleOption, isSelected && styles.selectedRoleOption]}
                  >
                    <Text style={[styles.roleOptionText, isSelected && styles.selectedRoleText]}>
                      {item}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}

          {role === 'Doctor' ? (
            <View style={styles.doctorFields}>
              <Text style={styles.inputLabel}>Specialization</Text>
              <InputField
                placeholder="Specialization"
                value={specialization}
                onChangeText={setSpecialization}
                autoCapitalize="words"
              />

              <Text style={styles.inputLabel}>Consultation Fee</Text>
              <InputField
                placeholder="Consultation fee"
                value={consultationFee}
                onChangeText={setConsultationFee}
                keyboardType="numeric"
              />
            </View>
          ) : null}

          <CustomButton
            title="+ Add User"
            onPress={handleCreateUser}
            loading={isSubmitting}
            style={styles.primaryButton}
          />

          <CustomButton
            title="Cancel"
            type="secondary"
            onPress={() => navigation.goBack()}
            disabled={isSubmitting}
            style={styles.secondaryButton}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 28,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 6,
  },
  formCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  inputLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
  },
  dropdownButton: {
    minHeight: 48,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 14,
  },
  dropdownValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  dropdownIcon: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  dropdownMenu: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    padding: 8,
  },
  roleOption: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  selectedRoleOption: {
    backgroundColor: colors.primary,
  },
  roleOptionText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  selectedRoleText: {
    color: colors.white,
  },
  doctorFields: {
    marginTop: 2,
  },
  primaryButton: {
    marginTop: 8,
  },
  secondaryButton: {
    marginTop: 12,
  },
});

export default AdminAddUser;
