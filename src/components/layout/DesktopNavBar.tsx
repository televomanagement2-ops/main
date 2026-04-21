import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

interface Props {
  onMenuClick: () => void;
}

export function DesktopNavBar({ onMenuClick }: Props) {
  const [languageOpen, setLanguageOpen] = useState(false);
  const [language, setLanguage] = useState<'it' | 'en' | 'es' | 'fr'>('it');
  const languageRef = useRef<HTMLDivElement | null>(null);

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

  const languageMap: Record<'it' | 'en' | 'es' | 'fr', { label: string; flag: string }> = {
    it: { label: 'Italiano', flag: 'IT' },
    en: { label: 'English', flag: 'US' },
    es: { label: 'Espanol', flag: 'ES' },
    fr: { label: 'Francais', flag: 'FR' },
  };

  return (
    <header className="desktop-nav">
      <button className="desktop-nav__menu" onClick={onMenuClick} aria-label="Apri menu">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      <Link to="/" className="desktop-nav__brand">
        Shop<span>Base</span>
      </Link>

      <div className="desktop-nav__actions">
        <div className="desktop-nav__lang" ref={languageRef}>
          <button
            type="button"
            className="desktop-nav__link desktop-nav__lang-trigger"
            onClick={() => setLanguageOpen((open) => !open)}
            aria-expanded={languageOpen}
            aria-label="Seleziona lingua"
          >
            <span className="desktop-nav__flag">{languageMap[language].flag}</span>
            <span>{languageMap[language].label}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {languageOpen && (
            <div className="desktop-nav__lang-menu" role="menu">
              {(Object.keys(languageMap) as Array<'it' | 'en' | 'es' | 'fr'>).map((code) => (
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
                  <span className="desktop-nav__flag">{languageMap[code].flag}</span>
                  <span>{languageMap[code].label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button type="button" className="desktop-nav__link">Aiuto</button>
        <button type="button" className="desktop-nav__link">Privacy</button>
      </div>
    </header>
  );
}