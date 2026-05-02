import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

const ErrorMessage = ({ message, style, textStyle }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  if (!message) {
    return null;
  }

  return (
    <View style={[styles.toast, style]}>
      <View style={styles.iconBubble}>
        <Text style={styles.iconText}>!</Text>
      </View>
      <Text style={[styles.text, textStyle]}>{message}</Text>
    </View>
  );
};

const createStyles = (colors) => StyleSheet.create({
  toast: {
    alignItems: 'center',
    backgroundColor: colors.errorBackground,
    borderColor: colors.error,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 2,
  },
  iconBubble: {
    alignItems: 'center',
    backgroundColor: colors.error,
    borderRadius: 999,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  iconText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '900',
  },
  text: {
    color: colors.error,
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
});

export default ErrorMessage;
