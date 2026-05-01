import React from 'react';
import { StyleSheet, Text } from 'react-native';
import colors from '../theme/colors';

const ErrorMessage = ({ message, style }) => {
  if (!message) {
    return null;
  }

  return <Text style={[styles.text, style]}>{message}</Text>;
};

const styles = StyleSheet.create({
  text: {
    color: colors.error,
    backgroundColor: colors.errorBackground,
    borderRadius: 8,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});

export default ErrorMessage;
