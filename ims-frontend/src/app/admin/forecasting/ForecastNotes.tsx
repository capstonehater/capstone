import { ChevronDown, FileText } from 'lucide-react';
import styles from './forecasting.module.css';
import { forecastPeriodDays, type ForecastRun } from '@/lib/forecasting';

const dateLabel = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

export default function ForecastNotes({ run, title = 'Forecast notes' }: { run: ForecastRun; title?: string }) {
  const notes = run.warnings;
  const period = `${dateLabel(run.startDate)} – ${dateLabel(run.endDate)}`;
  const steps: string[] = [];
  if (run.historyEnd) steps.push(`I looked at ingredient-use records through ${dateLabel(run.historyEnd)} to estimate what you might need for these ${forecastPeriodDays(run)} days.`);
  const pos = notes.map((note) => note.match(/Included (\d+) POS material\/day totals across (\d+) transaction dates through ([\d-]+)/)).find(Boolean);
  if (notes.some((note) => note.startsWith('Training source:'))) steps.push(pos ? 'I used ingredient amounts from completed sales and filled dates without sales records with older records from a file.' : 'I used the available ingredient-use history. This run allowed older file records to fill dates without sales records.');
  if (pos) steps.push(`I used sales records from ${pos[2]} dates, through ${dateLabel(pos[3])}. On those dates, sales records took the place of file records. Canceled and refunded sales were left out.`);
  if (notes.some((note) => note.includes('seven-day seasonality'))) steps.push('I looked for patterns that repeat each week, including weekends, to help make my estimates.');
  if (notes.some((note) => note.includes('Weekday-only history'))) steps.push('The history only had weekdays. I used weekday patterns and set weekend estimates to zero.');
  if (notes.some((note) => note.includes('log1p'))) steps.push('I adjusted the numbers while doing the math so days with no ingredient use could still be included. Then I changed the answers back to ingredient amounts.');
  const gap = notes.map((note) => note.match(/forecasting bridges a (\d+)-day gap/)).find(Boolean);
  if (gap) steps.push(`There were ${gap[1]} days between the end of the history and this forecast. I estimated across that gap first; those days were not actual recorded use.`);
  const mismatches = notes.filter((note) => /CSV history excluded: Incompatible units/i.test(note));
  const shortHistory = notes.filter((note) => /observations of history are required/i.test(note));
  const unstable = notes.filter((note) => /unusually large; material excluded/i.test(note));
  if (mismatches.length) steps.push(`I skipped ${mismatches.length} old ingredient histories because their units did not match, like kilograms and pieces. I did not guess how to convert them. This does not always mean the ingredient was left out; usable sales history could still help.`);
  if (shortHistory.length) steps.push(`I could not make estimates for ${shortHistory.length} ingredients because they had fewer than 60 daily history records.`);
  if (unstable.length) steps.push(`I left out ${unstable.length} ingredients because their estimates or possible ranges were too large to use.`);
  if (notes.some((note) => note.includes('stock source: live inventory snapshot'))) steps.push('For buying suggestions, I checked the stock recorded when this forecast was made. That saved stock may be different from what you have now.');
  if (notes.some((note) => note.startsWith('Product filters show'))) steps.push('Choosing a product shows demand for its ingredients across the whole store. It does not predict how many of that product you will sell.');

  const groups = [
    { title: 'Forecast limitations', notes: [] as string[] },
    { title: 'History unit mismatches', notes: [] as string[] },
    { title: 'Data & method', notes: [] as string[] },
  ];
  for (const note of notes) {
    const group = /incompatible units/i.test(note) ? groups[1]
      : /excluded from this run|observations of history are required|forecasting bridges/i.test(note) ? groups[0]
      : groups[2];
    group.notes.push(note);
  }

  return <details className={styles.dataNotes}>
    <summary className={styles.notesSummary}>
      <FileText size={20} aria-hidden="true" />
      <span className={styles.notesHeading}><strong>{title}</strong><span>{period}</span></span>
      <span className={styles.notesCount}>{notes.length}</span>
      <ChevronDown size={18} className={styles.notesChevron} aria-hidden="true" />
    </summary>
    <div className={styles.notesContent} role="region" aria-label={title} tabIndex={0}>
      <section className={styles.notesExplanation}>
        <h3>How this forecast was made</h3>
        <p>For {period}. Based on this saved forecast&apos;s records.</p>
        {steps.length ? <ol>{steps.map((step) => <li key={step}>{step}</li>)}</ol> : <p>This saved forecast does not include enough processing notes to explain its steps.</p>}
        <p>These are estimates, not promises. Your store may use more or less.</p>
      </section>
      {notes.length > 0 && <details className={styles.notesOriginal}><summary>Original processing notes ({notes.length})</summary>
      {groups.filter((group) => group.notes.length).map((group) => <section key={group.title} className={styles.notesGroup}>
        <h3>{group.title}<span>{group.notes.length}</span></h3>
        <ul>{group.notes.map((note, index) => <li key={index}>{note}</li>)}</ul>
      </section>)}
      </details>}
    </div>
  </details>;
}
