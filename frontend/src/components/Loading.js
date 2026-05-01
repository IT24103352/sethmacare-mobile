import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import colors from '../theme/colors';

const Loading = ({ size = 'large', color = colors.primary }) => (
  <View style={styles.container}>
    <ActivityIndicator size={size} color={color} />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});

export default Loading;
