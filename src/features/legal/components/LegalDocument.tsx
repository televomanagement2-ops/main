import type { ReactNode } from 'react';
import { fillPlaceholders } from '../../../config/storeConfig';
import { useI18n } from '../../../lib/i18n';

interface Section {
  title: string;
  content: string[];
}

interface Props {
  eyebrow: string;
  title: string;
  subtitle: string;
  lastUpdated: string;
  sections: Section[];
  intro?: ReactNode;
}

function slugify(value: string, index: number): string {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base ? `${base}-${index}` : `section-${index}`;
}

/**
 * Long-form legal text set as an editorial document: a narrow measure for
 * reading, a quiet section index that tracks alongside it on wide screens.
 * Shared by privacy, terms and cookies so the three never drift apart.
 */
export function LegalDocument({ eyebrow, title, subtitle, lastUpdated, sections, intro }: Props) {
  const { t } = useI18n();

  return (
    <div className="page" style={{ paddingBottom: 'var(--s-20)' }}>
      <header className="account-head">
        <div className="account-head__title">
          <p className="t-label">{eyebrow}</p>
          <h1 className="t-h1" style={{ marginTop: 'var(--s-3)' }}>{title}</h1>
          <p className="t-body collection__desc t-measure">{subtitle}</p>
          <p className="t-xs t-faint" style={{ marginTop: 'var(--s-4)' }}>
            {t('terms.lastUpdated')}: {lastUpdated}
          </p>
        </div>
      </header>

      {intro && <div style={{ marginBottom: 'var(--s-10)' }}>{intro}</div>}

      <div className="doc">
        <nav className="doc__aside" aria-label={t('legal.contents')}>
          <div className="doc__aside-inner">
            <p className="t-label" style={{ marginBottom: 'var(--s-2)' }}>{t('legal.contents')}</p>
            {sections.map((section, index) => (
              <a key={section.title} href={`#${slugify(section.title, index)}`} className="doc__nav-link">
                {section.title}
              </a>
            ))}
          </div>
        </nav>

        <div className="doc__body">
          {sections.map((section, index) => (
            <section key={section.title} id={slugify(section.title, index)} className="doc__section">
              <h2>{section.title}</h2>
              {section.content.map((line, i) => (
                <p key={i}>{fillPlaceholders(line)}</p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
