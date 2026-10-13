import { ArrowLeft, Repeat } from 'lucide-react';
import type { ReviewQueue } from '../reviewDeck';
import './lessons.css';
type Props = { swedish: boolean; queue: ReviewQueue | null; onBack: () => void; onReview: (lessonId: string) => void };

/** The cross-lesson spaced-review queue opened from the "Due reviews" sidebar item. */
export default function ReviewQueueView({ swedish, queue, onBack, onReview }: Props) {
  const t = (en: string, sv: string) => (swedish ? sv : en);
  const count = queue?.count ?? 0;
  return <div className="lesson-shell">
    <aside className="lesson-rail">
      <button className="lesson-back" onClick={onBack}><ArrowLeft size={17}/><span>SchoolWork</span></button>
      <div className="lesson-brand"><span><Repeat size={24}/></span><div><strong>{t('Due reviews.', 'Att repetera.')}<br/>{t('Every day.', 'Varje dag.')}</strong><small>{t('LEARN · REPEAT · REMEMBER', 'LÄR · REPETERA · MINNS')}</small></div></div>
      <div className="lesson-rail-label">{t('DUE NOW', 'ATT GÖRA NU')}</div>
      <div className="lesson-history">{queue?.lessons.map(s => <div className="lesson-history-row" key={s.lessonId}>
        <button onClick={() => onReview(s.lessonId)}><div><strong>{s.title}</strong><small>{s.cards + s.quiz} {t('items due', 'att repetera')}</small></div></button>
      </div>)}</div>
      {queue && count === 0 && <div className="lesson-notice">{t('Nothing due right now.', 'Inget att repetera just nu.')}</div>}
      <div className="lesson-local"><span className="lesson-dot"/>{t('Reviews are saved on this computer', 'Repeteringen sparas på den här datorn')}</div>
    </aside>
    <main className="lesson-main">
      <header className="lesson-topbar"><div><span>{t('DUE REVIEWS / ', 'ATT REPETERA / ')}</span>{count > 0 ? t(`${count} DUE`, `${count} ATT GÖRA`) : t('ALL CLEAR', 'KLART ÖVER')}</div></header>
      {count === 0 ? <section className="lesson-intro"><div>
        <div className="lesson-eyebrow"><Repeat size={13}/>{t('ALL CLEAR', 'KLART ÖVER')}</div>
        <h1>{t('Nothing due today.', 'Inget att repetera idag.')}</h1>
        <p>{t('Finish a lesson in the Lesson Follower and build its review deck. Cards you answer come back here on a spaced schedule: “still learning” returns tomorrow, “got it” comes back in two days and spreads out further each time you get it right.', 'Slutför en lektion i Lektionsföljaren och bygg dess repeteringsdeck. Kort du svarat på kommer tillbaka hit enligt ett utrymmesplanerat schema: “fortfarande lär mig” tillbaka imorgon, “klart” tillbaka om två dagar och allt längre ut varje gång du får det rätt.')}</p>
      </div></section> : <div className="lesson-card follow-report"><div className="lesson-card-head"><div><h2>{t('Your review queue', 'Din repeteringskö')}</h2></div><span>{t('DUE', 'ATT GÖRA')}</span></div>
        <div className="lesson-scroll follow-report-scroll">
          {queue?.lessons.map(s => <div key={s.lessonId} className="follow-review-row">
            <span className="follow-part-number">{s.cards + s.quiz}</span>
            <span><strong>{s.title}</strong><small>{[s.cards > 0 && t(`${s.cards} flashcard${s.cards === 1 ? '' : 's'}`, `${s.cards} flashkort`), s.quiz > 0 && t(`${s.quiz} quiz question${s.quiz === 1 ? '' : 's'}`, `${s.quiz} provfråga${s.quiz === 1 ? '' : 'r'}`)].filter(Boolean).join(' · ')}</small></span>
            <button className="lesson-primary follow-review-open" onClick={() => onReview(s.lessonId)}>{t('Review now', 'Repetera nu')}</button>
          </div>)}
          <p className="lesson-muted follow-queue-note">{t('Items marked “still learning” are due tomorrow. Items you got right come back after a growing interval.', 'Poster markerade som “fortfarande lär mig” är aktuella imorgon. Poster du fått rätt på återkommer efter allt längre intervall.')}</p>
        </div>
      </div>}
    </main>
  </div>;
}
