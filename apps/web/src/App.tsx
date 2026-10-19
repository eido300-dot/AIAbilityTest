import { useEffect, useState } from 'react';

type Connection = 'loading' | 'ready' | 'unavailable';

export function App() {
  const [connection, setConnection] = useState<Connection>('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5_000);
    setConnection('loading');
    fetch('/api/v1/health/ready', { signal: controller.signal })
      .then(async (response) => {
        const body: unknown = await response.json();
        if (
          !response.ok ||
          typeof body !== 'object' ||
          body === null ||
          !('status' in body) ||
          body.status !== 'ready'
        ) {
          throw new Error('Service is not ready');
        }
        if (active) setConnection('ready');
      })
      .catch(() => {
        if (active) setConnection('unavailable');
      })
      .finally(() => window.clearTimeout(timeout));
    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [attempt]);

  const messages: Record<Connection, string> = {
    loading: 'בודק את החיבור לשרת ולבסיס הנתונים…',
    ready: 'השרת ובסיס הנתונים זמינים לפיתוח',
    unavailable: 'החיבור אינו זמין. בדקו שהשרת ובסיס הנתונים פועלים.',
  };

  return (
    <>
      <a className="skip-link" href="#main">
        מעבר לתוכן
      </a>
      <header className="site-header">
        <span className="brand">ניהול לקוחות</span>
        <span className="badge">סביבת פיתוח</span>
      </header>
      <main id="main">
        <p className="eyebrow">מוצר אחד. סביבת עבודה נפרדת לכל עסק.</p>
        <h1>מתחילים מתשתית שאפשר לבדוק.</h1>
        <p className="intro">
          כאן נבנית מערכת לניהול לקוחות, מכירות ומשימות. זהו שלד פיתוח; ניהול
          משתמשים והיכולות העסקיות יתווספו לפי תוכנית העבודה.
        </p>
        <section className="connection" aria-labelledby="connection-title">
          <h2 id="connection-title">מצב השירותים</h2>
          <p role="status" aria-live="polite" data-state={connection}>
            {messages[connection]}
          </p>
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
            disabled={connection === 'loading'}
          >
            בדיקה חוזרת
          </button>
        </section>
        <div className="principles">
          <section>
            <h2>הפרדה בין עסקים</h2>
            <p>
              בידוד נתונים נבדק בבסיס הנתונים. אין עדיין גישה לרשומות דרך הממשק.
            </p>
          </section>
          <section>
            <h2>תהליך פיתוח מתועד</h2>
            <p>החלטות, בדיקות ותוצאות נשמרות לצד הקוד כחלק מניסוי הפיתוח.</p>
          </section>
          <section>
            <h2>השלב הבא</h2>
            <p>הזדהות, חברות בעסק והרשאות — לפני פתיחת גישה למידע עסקי.</p>
          </section>
        </div>
      </main>
      <footer>תשתית בפיתוח · טרם הושלמה הכנה להפעלה מסחרית</footer>
    </>
  );
}
