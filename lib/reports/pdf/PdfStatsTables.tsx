import { View, Text, StyleSheet } from '@react-pdf/renderer';
import type { ReportPlayerRow, ReportStatDef, ReportTeamStats } from '../types';

const styles = StyleSheet.create({
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 12, fontWeight: 700, marginBottom: 6, color: '#1a1a1a' },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e4e4e7' },
  headerRow: { flexDirection: 'row', backgroundColor: '#f5f5f5', borderBottomWidth: 1, borderBottomColor: '#e4e4e7' },
  nameCell: { width: 130, padding: 4, fontSize: 8, fontWeight: 700 },
  headerNameCell: { width: 130, padding: 4, fontSize: 7, fontWeight: 700, color: '#6b7280' },
  cell: { flex: 1, padding: 4, fontSize: 8, textAlign: 'center' },
  headerCell: { flex: 1, padding: 4, fontSize: 6.5, textAlign: 'center', color: '#6b7280', fontWeight: 700 },
  emptyText: { fontSize: 8, color: '#6b7280', padding: 6, textAlign: 'center' },
  didNotPlay: { fontSize: 8, color: '#6b7280', marginTop: 4 },
  didNotPlayLabel: { fontWeight: 700, color: '#1a1a1a' },
});

const bySortOrder = (a: ReportStatDef, b: ReportStatDef) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0);

export function PdfStatsTables({
  teamName,
  fieldPlayers,
  goalies,
  didNotPlay,
  teamStats,
  statDefs,
}: {
  teamName: string;
  fieldPlayers: ReportPlayerRow[];
  goalies: ReportPlayerRow[];
  didNotPlay?: { athleteId: string; label: string }[];
  teamStats: ReportTeamStats;
  statDefs: ReportStatDef[];
}) {
  const fieldStatDefs = statDefs.filter((s) => s.scope === 'jugador' && s.appliesTo === 'jugador_de_campo').sort(bySortOrder);
  const goalieStatDefs = statDefs.filter((s) => s.scope === 'jugador' && s.appliesTo === 'portero').sort(bySortOrder);
  const teamStatDefs = statDefs.filter((s) => s.scope === 'equipo').sort(bySortOrder);

  const hasPlusMinus = fieldStatDefs.some((s) => s.key === 'plus') && fieldStatDefs.some((s) => s.key === 'minus');
  const hasPpPair = teamStatDefs.some((s) => s.key === 'pp') && teamStatDefs.some((s) => s.key === 'pp_goal');
  const hasPkPair = teamStatDefs.some((s) => s.key === 'pk') && teamStatDefs.some((s) => s.key === 'pk_goal');
  const ppCount = teamStats?.stats.pp ?? 0;
  const ppGoalCount = teamStats?.stats.pp_goal ?? 0;
  const pkCount = teamStats?.stats.pk ?? 0;
  const pkGoalCount = teamStats?.stats.pk_goal ?? 0;
  const ppEffectiveness = hasPpPair && ppCount > 0 ? Math.round((ppGoalCount / ppCount) * 100) : null;
  const pkEffectiveness = hasPkPair && pkCount > 0 ? Math.round(((pkCount - pkGoalCount) / pkCount) * 100) : null;

  return (
    <>
      {didNotPlay && didNotPlay.length > 0 && (
        <Text style={styles.didNotPlay}>
          <Text style={styles.didNotPlayLabel}>No participaron en este partido: </Text>
          {didNotPlay.map((p) => p.label).join(', ')}
        </Text>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Jugadores</Text>
        <View style={styles.headerRow}>
          <Text style={styles.headerNameCell}>Jugador</Text>
          {fieldStatDefs.map((s) => (
            <Text key={s.id} style={styles.headerCell}>
              {s.label}
            </Text>
          ))}
          {hasPlusMinus && <Text style={styles.headerCell}>+/-</Text>}
        </View>
        {fieldPlayers.map((p) => (
          <View key={p.athleteId} style={styles.row}>
            <Text style={styles.nameCell}>{p.label}</Text>
            {fieldStatDefs.map((s) => (
              <Text key={s.id} style={styles.cell}>
                {p.stats[s.key] ?? 0}
              </Text>
            ))}
            {hasPlusMinus && <Text style={styles.cell}>{(p.stats.plus ?? 0) - (p.stats.minus ?? 0)}</Text>}
          </View>
        ))}
        {fieldPlayers.length === 0 && <Text style={styles.emptyText}>Sin jugadores de campo.</Text>}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Porteros</Text>
        <View style={styles.headerRow}>
          <Text style={styles.headerNameCell}>Portero</Text>
          {goalieStatDefs.map((s) => (
            <Text key={s.id} style={styles.headerCell}>
              {s.label}
            </Text>
          ))}
          <Text style={styles.headerCell}>SV%</Text>
        </View>
        {goalies.map((p) => {
          const shots = p.stats.shots_received ?? 0;
          const goalsAgainst = p.stats.goals_received ?? 0;
          const savePct = shots > 0 ? Math.round(((shots - goalsAgainst) / shots) * 100) : null;
          return (
            <View key={p.athleteId} style={styles.row}>
              <Text style={styles.nameCell}>{p.label}</Text>
              {goalieStatDefs.map((s) => (
                <Text key={s.id} style={styles.cell}>
                  {p.stats[s.key] ?? 0}
                </Text>
              ))}
              <Text style={styles.cell}>{savePct !== null ? `${savePct}%` : '—'}</Text>
            </View>
          );
        })}
        {goalies.length === 0 && <Text style={styles.emptyText}>Sin porteros.</Text>}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Estadísticas de equipo</Text>
        <View style={styles.headerRow}>
          <Text style={styles.headerNameCell}>Equipo</Text>
          {teamStatDefs.map((s) => (
            <Text key={s.id} style={styles.headerCell}>
              {s.label}
            </Text>
          ))}
          {hasPpPair && <Text style={styles.headerCell}>Efect. PP</Text>}
          {hasPkPair && <Text style={styles.headerCell}>Efect. PK</Text>}
        </View>
        {teamStats ? (
          <View style={styles.row}>
            <Text style={styles.nameCell}>{teamName}</Text>
            {teamStatDefs.map((s) => (
              <Text key={s.id} style={styles.cell}>
                {teamStats.stats[s.key] ?? 0}
              </Text>
            ))}
            {hasPpPair && <Text style={styles.cell}>{ppEffectiveness !== null ? `${ppEffectiveness}%` : '—'}</Text>}
            {hasPkPair && <Text style={styles.cell}>{pkEffectiveness !== null ? `${pkEffectiveness}%` : '—'}</Text>}
          </View>
        ) : (
          <Text style={styles.emptyText}>No hay estadísticas de equipo registradas.</Text>
        )}
      </View>
    </>
  );
}
