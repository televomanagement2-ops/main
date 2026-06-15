import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LANGUAGE_OPTIONS, usePreferencesStore, type AppLanguageCode } from '../../store/preferencesStore';
import { useI18n } from '../../lib/i18n';

interface Props {
  onMenuClick: () => void;
}

export function DesktopNavBar({ onMenuClick }: Props) {
  const [languageOpen, setLanguageOpen] = useState(false);
  const language = usePreferencesStore((s) => s.language);
  const setLanguage = usePreferencesStore((s) => s.setLanguage);
  const languageRef = useRef<HTMLDivElement | null>(null);
  const { t } = useI18n();

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!languageRef.current?.contains(target)) {
        setLanguageOpen(false);
      }
    };

    document.addEventListener('mousedown', onDocumentClick);
    return () => document.removeEventListener('mousedown', onDocumentClick);
  }, []);

  return (
    <header className="desktop-nav">
      <button className="desktop-nav__menu" onClick={onMenuClick} aria-label={t('nav.openMenu')}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      <Link to="/" className="desktop-nav__brand">
        Commerce<span>Jet</span>
      </Link>

      <div className="desktop-nav__actions">
        <div className="desktop-nav__lang" ref={languageRef}>
          <button
            type="button"
            className="desktop-nav__link desktop-nav__lang-trigger"
            onClick={() => setLanguageOpen((open) => !open)}
            aria-expanded={languageOpen}
            aria-label={t('nav.selectLanguage')}
          >
            <span className="desktop-nav__flag" aria-hidden="true">{LANGUAGE_OPTIONS[language].flag}</span>
            <span>{LANGUAGE_OPTIONS[language].label}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {languageOpen && (
            <div className="desktop-nav__lang-menu" role="menu">
              {(Object.keys(LANGUAGE_OPTIONS) as AppLanguageCode[]).map((code) => (
                <button
                  key={code}
                  type="button"
                  role="menuitem"
                  className={`desktop-nav__lang-option ${language === code ? 'is-active' : ''}`}
                  onClick={() => {
                    setLanguage(code);
                    setLanguageOpen(false);
                  }}
                >
                  <span className="desktop-nav__flag" aria-hidden="true">{LANGUAGE_OPTIONS[code].flag}</span>
                  <span>{LANGUAGE_OPTIONS[code].label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <Link to="/help" className="desktop-nav__link">{t('nav.help')}</Link>
        <Link to="/privacy" className="desktop-nav__link">{t('nav.privacy')}</Link>
      </div>
    </header>
  );
}