import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { PdfHeader, PdfFooter, styles as layoutStyles } from './PdfLayout';
import { PdfStatsTables } from './PdfStatsTables';
import type { MatchBoxScoreData } from '../matchBoxScore';

const STATUS_LABELS: Record<string, string> = {
  programado: 'Programado',
  en_vivo: 'En vivo',
  finalizado: 'Finalizado',
};

const styles = StyleSheet.create({
  scoreCard: { marginTop: 18, alignItems: 'center' },
  matchup: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  teamName: { fontSize: 12, fontWeight: 700, color: '#1a1a1a', width: 160, textAlign: 'center' },
  score: { fontSize: 26, fontWeight: 700, color: '#1a1a1a' },
  meta: { fontSize: 9, color: '#6b7280', marginTop: 6 },
});

export function MatchBoxScorePdf({ match }: { match: MatchBoxScoreData }) {
  const scheduled = new Date(match.scheduledAt).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <Document>
      <Page size="A4" style={layoutStyles.page}>
        <PdfHeader title="Box score" subtitle={`${match.tournamentName} · ${STATUS_LABELS[match.status] ?? match.status}`} />

        <View style={styles.scoreCard}>
          <View style={styles.matchup}>
            <Text style={styles.teamName}>{match.homeTeamName}</Text>
            <Text style={styles.score}>
              {match.homeScore} - {match.awayScore}
            </Text>
            <Text style={styles.teamName}>{match.awayTeamName}</Text>
          </View>
          <Text style={styles.meta}>
            {scheduled}
            {match.location ? ` · ${match.location}` : ''}
          </Text>
        </View>

        <PdfStatsTables
          teamName={match.homeTeamName}
          fieldPlayers={match.fieldPlayers}
          goalies={match.goalies}
          teamStats={match.teamStats}
          statDefs={match.statDefs}
        />

        <PdfFooter />
      </Page>
    </Document>
  );
}
