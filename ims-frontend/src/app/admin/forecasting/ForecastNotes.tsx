
import { formatUnit } from "@/lib/units";
import { ChevronDown, FileText } from 'lucide-react';
import styles from './forecasting.module.css';
import { forecastPeriodDays, type ForecastRun, type ForecastSeries } from '@/lib/forecasting';

const dateLabel = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const number = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? 'Not recorded' : value.toLocaleString('en-PH', { maximumFractionDigits: 2 });

function IngredientNotes({ ingredient }: { ingredient: Pick<ForecastSeries, 'name' | 'unit' | 'metadata'> }) {
  const m = ingredient.metadata;
  const audit = m.audit?.version === 1 ? m.audit : undefined;
  return <details className={styles.ingredientNotes}>
    <summary>{ingredient.name} <span>({formatUnit(ingredient.unit)}) · {number(m.trainingDays)} training days</span></summary>
    <div className={styles.notesExplanation}>
      {audit ? <>
        <p>I learned from {number(m.trainingDays)} daily amounts, from {dateLabel(audit.trainingStart)} to {dateLabel(audit.trainingEnd)}.</p>
        {m.availableTrainingDays != null && <p>There were {number(m.availableTrainingDays)} daily observations available. {m.availableTrainingDays === m.trainingDays ? 'I used the full history.' : 'I used the configured recent training window.'}</p>}
        <p>In that training window, {number(audit.csvDays)} dates came from the history file and {number(audit.posDays)} from sales records. I filled {number(audit.zeroFilledDays)} missing dates with zero. These filled dates were not measured usage. There were {number(audit.zeroDemandDays)} zero-use days in total.</p>
        <p>{audit.weekdaysOnly ? 'I used weekdays only and set weekend forecasts to zero.' : 'I included weekdays and weekends.'} I estimated across {number(audit.bridgeCalendarDays)} calendar days after this ingredient&apos;s history before reaching the forecast period.</p>
        <p>I tried {number(m.candidateCount)} model choices; {number(audit.successfulCandidates)} finished their checks. The chosen model was checked against {number(m.validationFolds)} past time windows{audit.validationMethod ? ` using ${audit.validationMethod}` : ' (check method not recorded)'}.</p>
        {audit.selectionMetric === 'mae' && <p>I ranked models by how close their guesses were to past amounts on average. This check also works on days with no usage.</p>}
        {audit.rangeCeiling != null && <p>I then checked the estimates and their possible ranges. I skipped {audit.rangeRejections?.length ?? 0} model choices that failed those checks and used the first passing choice. The upper limit was {number(audit.rangeCeiling)} {formatUnit(ingredient.unit)}, based on 100 times the biggest training-day amount (or the storage limit). Passing this check does not guarantee accuracy.</p>}
      </> : <p>This older run did not record detailed training dates, source counts, filled dates, or actual model-check counts. Those details cannot be reconstructed reliably. Available saved results are shown below.</p>}
      {m.seasonalOrder?.[3] != null && <p>The saved model looked for a pattern repeating every {m.seasonalOrder[3]} observations{audit?.weekdaysOnly ? ' (weekdays)' : ''}.</p>}
      {m.transformation === 'log1p (Box-Cox lambda 0)' && <p>I adjusted the numbers while doing the math so zero-use days could be included, then changed the estimates back to ingredient amounts.</p>}
      <p>When checked against past data, the model&apos;s average absolute error was {number(m.metrics?.mae)}{m.metrics?.mae != null ? ` ${formatUnit(ingredient.unit)}` : ''}. This tells you how far its guesses were from past amounts, on average. It does not guarantee future accuracy.</p>
      <dl className={styles.auditFacts}>
        <div><dt>Model</dt><dd>{m.model ?? 'Not recorded'}</dd></div>
        <div><dt>Model settings</dt><dd>{m.order?.join(', ') ?? 'Not recorded'}</dd></div>
        <div><dt>Seasonal settings</dt><dd>{m.seasonalOrder?.join(', ') ?? 'Not recorded'}</dd></div>
        <div><dt>Number adjustment</dt><dd>{m.transformation ?? 'Not recorded'}</dd></div>
        <div><dt>Past percentage error (MAPE)</dt><dd>{number(m.metrics?.mape)}{m.metrics?.mape != null ? '%' : ''}</dd></div>
      </dl>
      {audit && audit.validationWindows.length > 0 && <ul>{audit.validationWindows.map((window, index) => <li key={index}>Past check: {dateLabel(window.start)} – {dateLabel(window.end)} ({window.days} days); average error {number(window.mae)} {formatUnit(ingredient.unit)}.</li>)}</ul>}
    </div>
  </details>;
}

export default function ForecastNotes({ run, title = 'Forecast notes' }: { run: ForecastRun; title?: string }) {
  const notes = run.warnings;
  const period = `${dateLabel(run.startDate)} – ${dateLabel(run.endDate)}`;
  const ingredients = run.noteSeries ?? run.series ?? [];
  const exclusions = notes.filter((note) => /\): /.test(note) && !note.includes('CSV history excluded:'));
  const skippedHistory = notes.filter((note) => note.includes('CSV history excluded:'));
  const steps = [
    `This saved forecast estimates ingredient use for ${forecastPeriodDays(run)} days.`,
    `${ingredients.length} ingredients have saved estimates${run.noteSeries ? ' in this run' : ' in this view'}. Open an ingredient below to see the records and checks saved for it.`,
    `${exclusions.length} ingredient processing problems and ${skippedHistory.length} skipped file histories were recorded. Skipping an old file history does not necessarily exclude the ingredient.`,
  ];
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
        <p>For {period}. Run {run.id}. Saved {dateLabel(run.completedAt ?? run.createdAt)}.</p>
        {steps.length ? <ol>{steps.map((step) => <li key={step}>{step}</li>)}</ol> : <p>This saved forecast does not include enough processing notes to explain its steps.</p>}
        <p>These are estimates, not promises. Your store may use more or less.</p>
      </section>
      <section className={styles.notesGroup}>
        <h3>Ingredients with saved estimates<span>{ingredients.length}</span></h3>
        {ingredients.map((ingredient) => <IngredientNotes key={ingredient.materialId} ingredient={ingredient} />)}
      </section>
      {(exclusions.length > 0 || skippedHistory.length > 0) && <details className={styles.notesOriginal}>
        <summary>Skipped ingredients & history ({exclusions.length + skippedHistory.length})</summary>
        <p>These are the reasons saved by this run. File-history exclusions are separate from failed ingredient forecasts.</p>
        <ul>{[...exclusions, ...skippedHistory].map((note, index) => <li key={index}>{note}</li>)}</ul>
      </details>}
      {notes.length > 0 && <details className={styles.notesOriginal}><summary>Original processing notes ({notes.length})</summary>
      {groups.filter((group) => group.notes.length).map((group) => <section key={group.title} className={styles.notesGroup}>
        <h3>{group.title}<span>{group.notes.length}</span></h3>
        <ul>{group.notes.map((note, index) => <li key={index}>{note}</li>)}</ul>
      </section>)}
      </details>}
    </div>
  </details>;
}
