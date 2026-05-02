import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

const InputField = ({
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  error,
  helperText,
  style,
  inputStyle,
  ...rest
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const hasError = Boolean(error);
  const errorMessage = typeof error === 'string' ? error : '';
  const supportText = errorMessage || helperText;

  return (
    <View style={[styles.container, style]}>
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        selectionColor={colors.primary}
        style={[styles.input, inputStyle, hasError && styles.inputError]}
        {...rest}
      />
      {supportText ? (
        <Text style={[styles.supportText, hasError && styles.errorText]}>{supportText}</Text>
      ) : null}
    </View>
  );
};

const createStyles = (colors) => StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 14,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.inputBackground,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: colors.shadowSoft,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 1,
  },
  inputError: {
    borderColor: colors.error,
    backgroundColor: colors.errorBackground,
  },
  supportText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
    paddingHorizontal: 4,
  },
  errorText: {
    color: colors.error,
    fontWeight: '700',
  },
});

export default InputField;
