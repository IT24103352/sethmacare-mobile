import React, { useState } from 'react';
import {
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
import colors from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';

const roles = ['Patient', 'Doctor'];

const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || 'Registration failed. Please try again.';

const RegisterScreen = ({ navigation }) => {
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Patient');
  const [specialization, setSpecialization] = useState('');
  const [consultationFee, setConsultationFee] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleRegister = async () => {
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
      await register(payload);
      navigation.navigate('Login', {
        message:
          'Registration successful. Please wait for Admin confirmation before logging in.',
      });
    } catch (registerError) {
      setError(getErrorMessage(registerError));
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
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Your account will become active after Admin approval.</Text>
        </View>

        <ErrorMessage message={error} />

        <InputField
          placeholder="Username"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />

        <InputField
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <InputField
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Text style={styles.sectionLabel}>Role</Text>
        <View style={styles.roleGrid}>
          {roles.map((item) => {
            const isSelected = item === role;

            return (
              <TouchableOpacity
                key={item}
                activeOpacity={0.8}
                onPress={() => setRole(item)}
                style={[styles.roleButton, isSelected && styles.selectedRoleButton]}
              >
                <Text style={[styles.roleText, isSelected && styles.selectedRoleText]}>
                  {item}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {role === 'Doctor' ? (
          <>
            <InputField
              placeholder="Specialization"
              value={specialization}
              onChangeText={setSpecialization}
              autoCapitalize="words"
            />
            <InputField
              placeholder="Consultation fee"
              value={consultationFee}
              onChangeText={setConsultationFee}
              keyboardType="numeric"
            />
          </>
        ) : null}

        <CustomButton
          title="Register"
          onPress={handleRegister}
          loading={isSubmitting}
        />

        <CustomButton
          title="Back to Login"
          onPress={() => navigation.navigate('Login')}
          type="secondary"
          style={styles.secondaryButton}
          disabled={isSubmitting}
        />
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
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    color: colors.primary,
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 23,
  },
  sectionLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  roleButton: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  selectedRoleButton: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  roleText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  selectedRoleText: {
    color: colors.white,
  },
  secondaryButton: {
    marginTop: 12,
  },
});

export default RegisterScreen;
