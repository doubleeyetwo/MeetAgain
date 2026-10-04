import { PropsWithChildren } from 'react';
import { SafeAreaView, StyleSheet, Text } from 'react-native';

type ScreenProps = PropsWithChildren<{ title: string }>;

export function Screen({ title, children }: ScreenProps) {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 16,
  },
});
