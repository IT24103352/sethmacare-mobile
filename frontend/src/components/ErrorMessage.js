import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

const ErrorMessage = ({ message, type = 'error', style, textStyle }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const tone = type === 'success' ? 'success' : type === 'info' ? 'info' : 'error';

  if (!message) {
    return null;
  }

  return (
    <View style={[styles.toast, styles[`${tone}Toast`], style]}>
      <View style={[styles.iconBubble, styles[`${tone}IconBubble`]]}>
        <Text style={styles.iconText}>{tone === 'success' ? 'OK' : '!'}</Text>
      </View>
      <Text style={[styles.text, styles[`${tone}Text`], textStyle]}>{message}</Text>
    </View>
  );
};

const createStyles = (colors) => StyleSheet.create({
  toast: {
    alignItems: 'center',
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
  errorToast: {
    backgroundColor: colors.errorBackground,
    borderColor: colors.error,
  },
  successToast: {
    backgroundColor: colors.successBackground,
    borderColor: colors.success,
  },
  infoToast: {
    backgroundColor: colors.infoBackground,
    borderColor: colors.info,
  },
  iconBubble: {
    alignItems: 'center',
    borderRadius: 999,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  errorIconBubble: {
    backgroundColor: colors.error,
  },
  successIconBubble: {
    backgroundColor: colors.success,
  },
  infoIconBubble: {
    backgroundColor: colors.info,
  },
  iconText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '900',
  },
  text: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  errorText: {
    color: colors.error,
  },
  successText: {
    color: colors.success,
  },
  infoText: {
    color: colors.info,
  },
});

export default ErrorMessage;
