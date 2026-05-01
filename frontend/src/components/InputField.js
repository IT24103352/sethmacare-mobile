import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import colors from '../theme/colors';

const InputField = ({
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  style,
  inputStyle,
  ...rest
}) => (
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
      style={[styles.input, inputStyle]}
      {...rest}
    />
  </View>
);

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 14,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
});

export default InputField;
