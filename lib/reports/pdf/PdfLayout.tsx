import path from 'node:path';
import { View, Text, Image, StyleSheet } from '@react-pdf/renderer';

export const WILD_DOGS_LOGO_PATH = path.join(process.cwd(), 'public', 'logo-wilddogs.png');

export const styles = StyleSheet.create({
  page: { padding: 28, fontFamily: 'Helvetica' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 32, height: 32 },
  title: { fontSize: 16, fontWeight: 700, color: '#1a1a1a' },
  subtitle: { fontSize: 9, color: '#6b7280', marginTop: 2 },
  footer: { position: 'absolute', bottom: 20, left: 28, right: 28, fontSize: 7, color: '#6b7280', textAlign: 'center' },
});

export function PdfHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.headerRow}>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image, not an <img>; no alt concept in PDF */}
      <Image src={WILD_DOGS_LOGO_PATH} style={styles.logo} />
      <View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

export function PdfFooter() {
  return (
    <Text style={styles.footer} render={({ pageNumber, totalPages }) => `Hockey.One · Página ${pageNumber} de ${totalPages}`} fixed />
  );
}
