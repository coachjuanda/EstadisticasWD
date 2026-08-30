import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { PdfHeader, PdfFooter, styles as layoutStyles } from './PdfLayout';
import type { AthleteTrainingAttendanceData, CoachTrainingAttendanceData } from '../trainingAttendance';

const styles = StyleSheet.create({
  section: { marginTop: 16 },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e4e4e7' },
  headerRow: { flexDirection: 'row', backgroundColor: '#f5f5f5', borderBottomWidth: 1, borderBottomColor: '#e4e4e7' },
  nameCell: { flex: 2, padding: 4, fontSize: 8 },
  headerNameCell: { flex: 2, padding: 4, fontSize: 7, fontWeight: 700, color: '#6b7280' },
  cell: { flex: 1, padding: 4, fontSize: 8, textAlign: 'right' },
  headerCell: { flex: 1, padding: 4, fontSize: 7, textAlign: 'right', color: '#6b7280', fontWeight: 700 },
  emptyText: { fontSize: 8, color: '#6b7280', padding: 6, textAlign: 'center' },
  presentText: { color: '#15803d', fontWeight: 700 },
  absentText: { color: '#b91c1c', fontWeight: 700 },
});

function formatDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
}

function rangeLabel(dateFrom?: string, dateTo?: string) {
  if (!dateFrom && !dateTo) return 'Todo el histórico';
  if (dateFrom && dateTo) return `${dateFrom} a ${dateTo}`;
  if (dateFrom) return `Desde ${dateFrom}`;
  return `Hasta ${dateTo}`;
}

export function TrainingAttendanceAthletesPdf({ data }: { data: AthleteTrainingAttendanceData }) {
  const { summary, detail, meta } = data;
  const subtitleParts = [rangeLabel(meta.dateFrom, meta.dateTo)];
  if (meta.divisionNames.length > 0) subtitleParts.push(meta.divisionNames.join(', '));
  if (meta.athleteName) subtitleParts.push(meta.athleteName);

  return (
    <Document>
      <Page size="A4" style={layoutStyles.page}>
        <PdfHeader title="Asistencia a entrenamientos — Deportistas" subtitle={subtitleParts.join(' · ')} />

        {meta.athleteName ? (
          <View style={styles.section}>
            <View style={styles.headerRow}>
              <Text style={styles.headerNameCell}>Fecha</Text>
              <Text style={styles.headerCell}>Estado</Text>
            </View>
            {detail.map((d) => (
              <View key={d.id} style={styles.row}>
                <Text style={styles.nameCell}>
                  {formatDate(d.scheduledAt)}
                  {d.divisionNames ? ` · ${d.divisionNames}` : ''}
                </Text>
                <Text style={[styles.cell, d.present ? styles.presentText : styles.absentText]}>
                  {d.present ? 'Presente' : 'Ausente'}
                </Text>
              </View>
            ))}
            {detail.length === 0 && <Text style={styles.emptyText}>Sin convocatorias con ese filtro.</Text>}
          </View>
        ) : (
          <View style={styles.section}>
            <View style={styles.headerRow}>
              <Text style={styles.headerNameCell}>Deportista</Text>
              <Text style={styles.headerCell}>Convocatorias</Text>
              <Text style={styles.headerCell}>Presentes</Text>
              <Text style={styles.headerCell}>%</Text>
            </View>
            {summary.map((a) => (
              <View key={a.athleteId} style={styles.row}>
                <Text style={styles.nameCell}>{a.fullName}</Text>
                <Text style={styles.cell}>{a.total}</Text>
                <Text style={styles.cell}>{a.present}</Text>
                <Text style={styles.cell}>{a.pct}%</Text>
              </View>
            ))}
            {summary.length === 0 && <Text style={styles.emptyText}>No hay convocatorias con ese filtro.</Text>}
          </View>
        )}

        <PdfFooter />
      </Page>
    </Document>
  );
}

export function TrainingAttendanceCoachesPdf({ data }: { data: CoachTrainingAttendanceData }) {
  const { summary, detail, meta } = data;
  const subtitleParts = [rangeLabel(meta.dateFrom, meta.dateTo)];
  if (meta.coachName) subtitleParts.push(meta.coachName);

  return (
    <Document>
      <Page size="A4" style={layoutStyles.page}>
        <PdfHeader title="Asistencia a entrenamientos — Entrenadores" subtitle={subtitleParts.join(' · ')} />

        {meta.coachName ? (
          <View style={styles.section}>
            <View style={styles.headerRow}>
              <Text style={styles.headerNameCell}>Fecha</Text>
              <Text style={styles.headerCell}>División</Text>
            </View>
            {detail.map((d) => (
              <View key={d.id} style={styles.row}>
                <Text style={styles.nameCell}>{formatDate(d.scheduledAt)}</Text>
                <Text style={styles.cell}>{d.divisionNames || '—'}</Text>
              </View>
            ))}
            {detail.length === 0 && <Text style={styles.emptyText}>Este entrenador no tiene sesiones registradas con ese filtro.</Text>}
          </View>
        ) : (
          <View style={styles.section}>
            <View style={styles.headerRow}>
              <Text style={styles.headerNameCell}>Entrenador</Text>
              <Text style={styles.headerCell}>Sesiones presente</Text>
            </View>
            {summary.map((c) => (
              <View key={c.coachId} style={styles.row}>
                <Text style={styles.nameCell}>{c.fullName}</Text>
                <Text style={styles.cell}>{c.sessionsPresent}</Text>
              </View>
            ))}
            {summary.length === 0 && <Text style={styles.emptyText}>Aún no hay entrenadores marcados como presentes con ese filtro.</Text>}
          </View>
        )}

        <PdfFooter />
      </Page>
    </Document>
  );
}
