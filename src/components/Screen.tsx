import { PropsWithChildren } from 'react';
import { SafeAreaView, StyleSheet, Text } from 'react-native';
export function Screen({ title, children }: PropsWithChildren<{ title: string }>) { return <SafeAreaView style={styles.container}><Text style={styles.title}>{title}</Text>{children}</SafeAreaView>; }
const styles = StyleSheet.create({ container: { flex: 1, padding: 24 }, title: { fontSize: 28, fontWeight: '700', marginBottom: 16 } });
