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
import Ionicons from '@expo/vector-icons/Ionicons';
import CustomButton from '../../components/CustomButton';
import ErrorMessage from '../../components/ErrorMessage';
import InputField from '../../components/InputField';
import getApiErrorMessage from '../../api/errors';
import colors from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';

const LoginScreen = ({ navigation, route }) => {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const successMessage = route?.params?.message;

  const handleLogin = async () => {
    setError('');

    if (!identifier.trim() || !password) {
      setError('Username/email and password are required.');
      return;
    }

    setIsSubmitting(true);

    try {
      await login({
        identifier: identifier.trim(),
        password,
      });
    } catch (loginError) {
      setError(getApiErrorMessage(loginError, 'Login failed. Please try again.'));
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
          <Text style={styles.title}>SethmaCare</Text>
          <Text style={styles.subtitle}>Sign in to continue to your mobile dashboard.</Text>
        </View>

        {successMessage ? <Text style={styles.success}>{successMessage}</Text> : null}
        <ErrorMessage message={error} />

        <InputField
          placeholder="Username or email"
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
          keyboardType="email-address"
          returnKeyType="next"
        />

        <View style={styles.passwordField}>
          <InputField
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            returnKeyType="done"
            onSubmitEditing={handleLogin}
            inputStyle={styles.passwordInput}
          />
          <TouchableOpacity
            activeOpacity={0.72}
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            accessibilityRole="button"
            onPress={() => setShowPassword((current) => !current)}
            style={styles.passwordToggle}
          >
            <Ionicons
              name={showPassword ? 'eye-off' : 'eye'}
              size={22}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        </View>

        <CustomButton
          title="Login"
          onPress={handleLogin}
          loading={isSubmitting}
        />

        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => navigation.navigate('Register')}
          style={styles.linkButton}
        >
          <Text style={styles.linkText}>Create a new account</Text>
        </TouchableOpacity>
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
    marginBottom: 28,
  },
  title: {
    color: colors.primary,
    fontSize: 34,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 23,
  },
  success: {
    backgroundColor: colors.successBackground,
    borderRadius: 8,
    color: colors.success,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  passwordField: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 48,
  },
  passwordToggle: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    position: 'absolute',
    right: 2,
    top: 0,
    width: 48,
  },
  linkButton: {
    alignItems: 'center',
    marginTop: 18,
    paddingVertical: 10,
  },
  linkText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
});

export default LoginScreen;
