import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { PdfHeader, PdfFooter, styles as layoutStyles } from './PdfLayout';
import type { AthleteProfileData } from '../athleteProfile';

const styles = StyleSheet.create({
  cardsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 },
  card: { width: 110, borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 6, padding: 8, alignItems: 'center' },
  cardLabel: { fontSize: 7, color: '#6b7280' },
  cardValue: { fontSize: 14, fontWeight: 700, color: '#1a1a1a', marginTop: 3 },
  teamsSection: { marginTop: 20 },
  sectionTitle: { fontSize: 11, fontWeight: 700, color: '#1a1a1a', marginBottom: 4 },
  teamRow: { fontSize: 9, color: '#374151', marginBottom: 2 },
  emptyText: { fontSize: 9, color: '#6b7280', marginTop: 18 },
});

export function AthleteProfilePdf({ athlete }: { athlete: AthleteProfileData }) {
  const tournamentLabel = athlete.selectedTournamentId
    ? athlete.tournamentsPlayed.find((t) => t.id === athlete.selectedTournamentId)?.name ?? '—'
    : 'Acumulado';
  const scopeLabel = athlete.selectedSportLabel
    ? `${athlete.selectedSportLabel} · ${tournamentLabel}`
    : 'Sin actividad registrada';

  return (
    <Document>
      <Page size="A4" style={layoutStyles.page}>
        <PdfHeader
          title={athlete.fullName}
          subtitle={`${athlete.positionLabel}${athlete.teams.length > 0 ? ` · ${athlete.teams.join(', ')}` : ''} · ${scopeLabel}`}
        />

        {athlete.matchesInScope === 0 ? (
          <Text style={styles.emptyText}>Sin partidos registrados en esta vista.</Text>
        ) : (
          <View style={styles.cardsGrid}>
            {athlete.statCards.map((s) => (
              <View key={s.key} style={styles.card}>
                <Text style={styles.cardLabel}>{s.label}</Text>
                <Text style={styles.cardValue}>{s.value}</Text>
              </View>
            ))}
          </View>
        )}

        {athlete.teamMemberships.length > 0 && (
          <View style={styles.teamsSection}>
            <Text style={styles.sectionTitle}>Equipos</Text>
            {athlete.teamMemberships.map((m) => (
              <Text key={m.rosterId} style={styles.teamRow}>
                {m.teamName} · {m.tournamentName}
              </Text>
            ))}
          </View>
        )}

        <PdfFooter />
      </Page>
    </Document>
  );
}
