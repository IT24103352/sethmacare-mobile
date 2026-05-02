import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

const Loading = ({ size = 'large', color }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <View style={styles.brandCard}>
        <View style={styles.logoMark}>
          <Text style={styles.logoCross}>+</Text>
        </View>
        <Text style={styles.brandName}>SethmaCare</Text>
        <Text style={styles.brandTagline}>Connected care, ready when you are</Text>
        <ActivityIndicator size={size} color={color || colors.primary} style={styles.spinner} />
      </View>
    </View>
  );
};

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: 24,
  },
  brandCard: {
    alignItems: 'center',
    backgroundColor: colors.surfaceGlass,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 26,
    paddingVertical: 28,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 4,
    width: '100%',
    maxWidth: 320,
  },
  logoMark: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderColor: colors.primarySoft,
    borderRadius: 22,
    borderWidth: 6,
    height: 76,
    justifyContent: 'center',
    marginBottom: 16,
    width: 76,
  },
  logoCross: {
    color: colors.white,
    fontSize: 40,
    fontWeight: '900',
    lineHeight: 45,
  },
  brandName: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
  },
  brandTagline: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    textAlign: 'center',
  },
  spinner: {
    marginTop: 22,
  },
});

export default Loading;
