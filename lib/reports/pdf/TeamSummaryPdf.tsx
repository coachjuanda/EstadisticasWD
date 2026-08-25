import { Document, Page } from '@react-pdf/renderer';
import { PdfHeader, PdfFooter, styles as layoutStyles } from './PdfLayout';
import { PdfStatsTables } from './PdfStatsTables';
import type { TeamSummaryData } from '../teamSummary';

export function TeamSummaryPdf({ summary }: { summary: TeamSummaryData }) {
  const teamLabel = `${summary.teamName}${summary.divisionName ? ` (${summary.divisionName})` : ''}`;
  const matchesLabel = `${summary.matchesConsidered} partido${summary.matchesConsidered === 1 ? '' : 's'} considerado${summary.matchesConsidered === 1 ? '' : 's'}`;

  return (
    <Document>
      <Page size="A4" style={layoutStyles.page}>
        <PdfHeader title="Resumen de equipo" subtitle={`${teamLabel} · ${summary.tournamentName} · ${matchesLabel}`} />

        <PdfStatsTables
          teamName={summary.teamName}
          fieldPlayers={summary.fieldPlayers}
          goalies={summary.goalies}
          teamStats={summary.teamStats}
          statDefs={summary.statDefs}
        />

        <PdfFooter />
      </Page>
    </Document>
  );
}
