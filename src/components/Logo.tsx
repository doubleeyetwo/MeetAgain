import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Path, Rect, Stop } from 'react-native-svg';
import { colors, text } from '@/theme';

/* Logo: SVG approximation. Replace with your real exported asset. */
export function Logo() {
  return (
    <View style={styles.logoWrap}>
      <Svg width={44} height={44} viewBox="0 0 44 44">
        <Defs>
          <SvgGradient id="logoBlue" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#7FA2FF" />
            <Stop offset="1" stopColor="#8B7BFF" />
          </SvgGradient>
          <SvgGradient id="logoPurple" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#9A5BFF" />
            <Stop offset="1" stopColor="#7A1FE0" />
          </SvgGradient>
        </Defs>
        <Circle cx={8} cy={6} r={6} fill="url(#logoBlue)" />
        <Circle cx={36} cy={6} r={6} fill="url(#logoPurple)" />
        <Rect x={2} y={16} width={12} height={26} rx={6} fill="url(#logoBlue)" />
        <Path
          d="M16 18 L22 32 L28 18 L28 36 C28 39.3 30.7 42 34 42 C37.3 42 40 39.3 40 36 L40 18 C40 15 38 14 36 14 C34 14 32.5 15 31.5 17 L22 34 Z"
          fill="url(#logoPurple)"
        />
      </Svg>
      <Text style={styles.brand}>MeetAgain</Text>
    </View>
  );
}

export function GoogleIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  logoWrap: { alignItems: 'center', gap: 6 },
  brand: { ...text.title, color: colors.white },
});