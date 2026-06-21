import type { AppLanguageCode } from '../../../store/preferencesStore';
import type { PolicyData } from './privacyData';

// ─────────────────────────────────────────────────────────────────────────────
// Cookie Policy — self-hosted consent (no third-party CMP). PRIMARY United States
// (Do Not Sell/Share + GPC) with an EU/EEA prior-consent section. Replace
// [PRIVACY_EMAIL] with the real address before launch.
// ─────────────────────────────────────────────────────────────────────────────

const en: PolicyData = {
  lastUpdated: 'June 2026',
  sections: [
    {
      title: '1. What Are Cookies',
      content: [
        'Cookies are small text files placed on your device when you visit a website. Similar technologies (such as local storage) work the same way. They let the site remember your actions and preferences.',
        'This site uses only first-party cookies and local storage. We do not use third-party advertising, remarketing, or profiling cookies.',
      ],
    },
    {
      title: '2. Categories We Use',
      content: [
        'Strictly necessary — required for the site to work: session and authentication, shopping cart, language and theme preferences, and recording your cookie choice. These do not require consent.',
        'Analytics (optional) — first-party, aggregate, anonymous statistics that help us improve the store. These are off by default and load only if you opt in.',
        'We currently do not run any non-essential cookies until you grant consent.',
      ],
    },
    {
      title: '3. Specific First-Party Cookies / Storage',
      content: [
        'commercejet-theme — stores your light/dark/system theme. Persistent. Strictly necessary.',
        'commercejet-preferences — stores your selected language. Persistent. Strictly necessary.',
        'commercejet-cart — keeps your cart contents. Session/persistent. Strictly necessary.',
        'commercejet-cookie-consent — records your cookie choice. Persistent (up to 12 months). Strictly necessary.',
        'Supabase session — secure authentication tokens that keep you signed in. Session. Strictly necessary.',
        'Stripe — at checkout, Stripe may set technical cookies for payment security and fraud prevention on its own pages. See stripe.com/privacy.',
      ],
    },
    {
      title: '4. Managing Your Preferences',
      content: [
        'On your first visit, our consent banner lets you Accept all, Reject all, or Customize. Rejecting is as easy as accepting, and rejecting non-essential cookies does not affect browsing or purchasing.',
        'You can change your choice at any time using the floating cookie button (bottom right) or the "Manage cookie preferences" button on this page.',
        'You can also block or delete cookies in your browser settings; doing so may affect some site features.',
      ],
    },
    {
      title: '5. U.S. Residents — Do Not Sell/Share & Global Privacy Control',
      content: [
        'We do not sell your personal information and do not share it for cross-context behavioral advertising. There is therefore no advertising tracking to opt out of.',
        'We honor recognized opt-out preference signals, including Global Privacy Control (GPC), as a valid opt-out where applicable. See our Privacy Policy for your state rights.',
      ],
    },
    {
      title: '6. EU/EEA Residents — Prior Consent',
      content: [
        'For visitors in the EU/EEA, non-essential cookies (e.g., analytics) are set only after you give prior, informed consent via the banner, in line with the ePrivacy Directive and EDPB/Garante guidance.',
        'Consent is recorded for up to 12 months, after which you will be asked again. You may withdraw consent at any time as easily as you gave it.',
      ],
    },
    {
      title: '7. Updates',
      content: [
        'We may update this Cookie Policy following technical, regulatory, or service changes. The version in force is the one published here with its "last updated" date.',
        'If material changes require new consent, the banner will be shown again.',
        'Questions: [PRIVACY_EMAIL].',
      ],
    },
  ],
};

const it: PolicyData = {
  lastUpdated: 'Giugno 2026',
  sections: [
    {
      title: '1. Cosa Sono i Cookie',
      content: [
        'I cookie sono piccoli file di testo memorizzati sul tuo dispositivo quando visiti un sito. Tecnologie simili (come il local storage) funzionano allo stesso modo. Consentono al sito di ricordare azioni e preferenze.',
        'Questo sito utilizza solo cookie di prima parte e local storage. Non utilizziamo cookie pubblicitari, di remarketing o di profilazione di terze parti.',
      ],
    },
    {
      title: '2. Categorie Utilizzate',
      content: [
        'Strettamente necessari — indispensabili al funzionamento del sito: sessione e autenticazione, carrello, preferenze di lingua e tema, registrazione della scelta sui cookie. Non richiedono consenso.',
        'Analitici (facoltativi) — statistiche di prima parte, aggregate e anonime che ci aiutano a migliorare lo store. Disattivati per impostazione predefinita, si attivano solo se acconsenti.',
        'Al momento non eseguiamo alcun cookie non essenziale fino a quando non presti il consenso.',
      ],
    },
    {
      title: '3. Cookie / Storage Specifici di Prima Parte',
      content: [
        'commercejet-theme — memorizza il tema chiaro/scuro/sistema. Persistente. Strettamente necessario.',
        'commercejet-preferences — memorizza la lingua selezionata. Persistente. Strettamente necessario.',
        'commercejet-cart — mantiene il contenuto del carrello. Sessione/persistente. Strettamente necessario.',
        'commercejet-cookie-consent — registra la scelta sui cookie. Persistente (fino a 12 mesi). Strettamente necessario.',
        'Sessione Supabase — token di autenticazione sicuri che ti mantengono connesso. Sessione. Strettamente necessario.',
        'Stripe — al checkout, Stripe può impostare cookie tecnici per la sicurezza dei pagamenti e la prevenzione frodi sulle proprie pagine. Vedi stripe.com/privacy.',
      ],
    },
    {
      title: '4. Gestione delle Preferenze',
      content: [
        'Alla prima visita, il nostro banner consente di Accettare tutti, Rifiutare tutti o Personalizzare. Rifiutare è facile quanto accettare e il rifiuto dei cookie non essenziali non pregiudica la navigazione né l\'acquisto.',
        'Puoi modificare la scelta in qualsiasi momento tramite il pulsante cookie flottante (in basso a destra) o il pulsante "Gestisci preferenze cookie" in questa pagina.',
        'Puoi anche bloccare o eliminare i cookie dalle impostazioni del browser; ciò potrebbe influire su alcune funzionalità del sito.',
      ],
    },
    {
      title: '5. Residenti USA — Do Not Sell/Share e Global Privacy Control',
      content: [
        'Non vendiamo i tuoi dati personali e non li condividiamo per pubblicità comportamentale cross-context. Non vi è quindi alcun tracciamento pubblicitario da disattivare.',
        'Rispettiamo i segnali di opt-out riconosciuti, incluso il Global Privacy Control (GPC), quale valida opposizione ove applicabile. Per i diritti del tuo stato vedi la Privacy Policy.',
      ],
    },
    {
      title: '6. Residenti UE/EEE — Consenso Preventivo',
      content: [
        'Per i visitatori nell\'UE/EEE, i cookie non essenziali (es. analitici) vengono attivati solo dopo che hai prestato un consenso preventivo e informato tramite il banner, in linea con la Direttiva ePrivacy e le linee guida EDPB/Garante.',
        'Il consenso è registrato fino a 12 mesi, trascorsi i quali ti verrà richiesto nuovamente. Puoi revocare il consenso in qualsiasi momento con la stessa facilità con cui lo hai prestato.',
      ],
    },
    {
      title: '7. Aggiornamenti',
      content: [
        'Possiamo aggiornare la presente Cookie Policy a seguito di modifiche tecniche, normative o di servizio. La versione vigente è quella pubblicata qui con la relativa data di aggiornamento.',
        'In caso di modifiche sostanziali che richiedano un nuovo consenso, il banner verrà ripresentato.',
        'Domande: [PRIVACY_EMAIL].',
      ],
    },
  ],
};

const es: PolicyData = {
  lastUpdated: 'Junio 2026',
  sections: [
    {
      title: '1. Qué Son las Cookies',
      content: [
        'Las cookies son pequeños archivos de texto que se guardan en tu dispositivo al visitar un sitio. Tecnologías similares (como el almacenamiento local) funcionan igual. Permiten al sitio recordar acciones y preferencias.',
        'Este sitio usa solo cookies de origen y almacenamiento local. No usamos cookies publicitarias, de remarketing ni de elaboración de perfiles de terceros.',
      ],
    },
    {
      title: '2. Categorías que Utilizamos',
      content: [
        'Estrictamente necesarias — imprescindibles para el funcionamiento: sesión y autenticación, carrito, preferencias de idioma y tema, y registro de tu elección de cookies. No requieren consentimiento.',
        'Analíticas (opcionales) — estadísticas de origen, agregadas y anónimas que nos ayudan a mejorar la tienda. Desactivadas por defecto, se cargan solo si das tu consentimiento.',
        'Actualmente no ejecutamos ninguna cookie no esencial hasta que prestes tu consentimiento.',
      ],
    },
    {
      title: '3. Cookies / Almacenamiento de Origen Específicos',
      content: [
        'commercejet-theme — guarda el tema claro/oscuro/sistema. Persistente. Estrictamente necesaria.',
        'commercejet-preferences — guarda el idioma seleccionado. Persistente. Estrictamente necesaria.',
        'commercejet-cart — mantiene el contenido del carrito. Sesión/persistente. Estrictamente necesaria.',
        'commercejet-cookie-consent — registra tu elección de cookies. Persistente (hasta 12 meses). Estrictamente necesaria.',
        'Sesión de Supabase — tokens de autenticación seguros que te mantienen conectado. Sesión. Estrictamente necesaria.',
        'Stripe — en el pago, Stripe puede establecer cookies técnicas para la seguridad de los pagos y la prevención del fraude en sus propias páginas. Ver stripe.com/privacy.',
      ],
    },
    {
      title: '4. Gestión de tus Preferencias',
      content: [
        'En tu primera visita, nuestro banner te permite Aceptar todo, Rechazar todo o Personalizar. Rechazar es tan fácil como aceptar y rechazar las cookies no esenciales no afecta a la navegación ni a la compra.',
        'Puedes cambiar tu elección en cualquier momento con el botón flotante de cookies (abajo a la derecha) o el botón "Gestionar preferencias de cookies" de esta página.',
        'También puedes bloquear o eliminar cookies en la configuración del navegador; esto puede afectar a algunas funciones del sitio.',
      ],
    },
    {
      title: '5. Residentes en EE. UU. — Do Not Sell/Share y Global Privacy Control',
      content: [
        'No vendemos tus datos personales ni los compartimos para publicidad comportamental cross-context. Por tanto, no hay seguimiento publicitario del que excluirse.',
        'Respetamos las señales de exclusión reconocidas, incluido el Global Privacy Control (GPC), como exclusión válida cuando proceda. Consulta la Política de Privacidad para tus derechos estatales.',
      ],
    },
    {
      title: '6. Residentes en la UE/EEE — Consentimiento Previo',
      content: [
        'Para los visitantes en la UE/EEE, las cookies no esenciales (p. ej., analíticas) se activan solo tras prestar un consentimiento previo e informado mediante el banner, conforme a la Directiva ePrivacy y a las directrices del EDPB/Garante.',
        'El consentimiento se registra hasta 12 meses, tras los cuales se te volverá a solicitar. Puedes retirar el consentimiento en cualquier momento con la misma facilidad con la que lo diste.',
      ],
    },
    {
      title: '7. Actualizaciones',
      content: [
        'Podemos actualizar esta Política de Cookies tras cambios técnicos, normativos o de servicio. La versión vigente es la publicada aquí con su fecha de actualización.',
        'Si cambios sustanciales requieren un nuevo consentimiento, el banner se mostrará de nuevo.',
        'Consultas: [PRIVACY_EMAIL].',
      ],
    },
  ],
};

const fr: PolicyData = {
  lastUpdated: 'Juin 2026',
  sections: [
    {
      title: '1. Que Sont les Cookies',
      content: [
        'Les cookies sont de petits fichiers texte déposés sur votre appareil lors de la visite d\'un site. Des technologies similaires (comme le stockage local) fonctionnent de la même façon. Ils permettent au site de mémoriser actions et préférences.',
        'Ce site utilise uniquement des cookies de première partie et le stockage local. Nous n\'utilisons pas de cookies publicitaires, de reciblage ou de profilage tiers.',
      ],
    },
    {
      title: '2. Catégories Utilisées',
      content: [
        'Strictement nécessaires — indispensables au fonctionnement : session et authentification, panier, préférences de langue et de thème, et enregistrement de votre choix de cookies. Sans consentement requis.',
        'Analytiques (facultatifs) — statistiques de première partie, agrégées et anonymes qui nous aident à améliorer la boutique. Désactivés par défaut, ils ne se chargent que si vous y consentez.',
        'Nous n\'exécutons actuellement aucun cookie non essentiel tant que vous n\'avez pas donné votre consentement.',
      ],
    },
    {
      title: '3. Cookies / Stockage de Première Partie Spécifiques',
      content: [
        'commercejet-theme — mémorise le thème clair/sombre/système. Persistant. Strictement nécessaire.',
        'commercejet-preferences — mémorise la langue sélectionnée. Persistant. Strictement nécessaire.',
        'commercejet-cart — conserve le contenu du panier. Session/persistant. Strictement nécessaire.',
        'commercejet-cookie-consent — enregistre votre choix de cookies. Persistant (jusqu\'à 12 mois). Strictement nécessaire.',
        'Session Supabase — jetons d\'authentification sécurisés qui vous maintiennent connecté. Session. Strictement nécessaire.',
        'Stripe — au paiement, Stripe peut déposer des cookies techniques pour la sécurité des paiements et la prévention de la fraude sur ses propres pages. Voir stripe.com/privacy.',
      ],
    },
    {
      title: '4. Gestion de vos Préférences',
      content: [
        'Lors de votre première visite, notre bandeau vous permet de Tout accepter, Tout refuser ou Personnaliser. Refuser est aussi simple qu\'accepter, et refuser les cookies non essentiels n\'affecte ni la navigation ni l\'achat.',
        'Vous pouvez modifier votre choix à tout moment via le bouton cookie flottant (en bas à droite) ou le bouton « Gérer les préférences de cookies » sur cette page.',
        'Vous pouvez aussi bloquer ou supprimer les cookies dans les paramètres de votre navigateur ; cela peut affecter certaines fonctionnalités du site.',
      ],
    },
    {
      title: '5. Résidents Américains — Do Not Sell/Share et Global Privacy Control',
      content: [
        'Nous ne vendons pas vos données personnelles et ne les partageons pas à des fins de publicité comportementale cross-context. Il n\'y a donc aucun suivi publicitaire à désactiver.',
        'Nous respectons les signaux d\'exclusion reconnus, y compris le Global Privacy Control (GPC), comme opposition valable le cas échéant. Voir la Politique de Confidentialité pour vos droits selon votre État.',
      ],
    },
    {
      title: '6. Résidents de l\'UE/EEE — Consentement Préalable',
      content: [
        'Pour les visiteurs de l\'UE/EEE, les cookies non essentiels (ex. analytiques) ne sont déposés qu\'après un consentement préalable et éclairé via le bandeau, conformément à la directive ePrivacy et aux lignes directrices de l\'EDPB/Garante.',
        'Le consentement est enregistré jusqu\'à 12 mois, après quoi il vous sera redemandé. Vous pouvez retirer votre consentement à tout moment aussi facilement que vous l\'avez donné.',
      ],
    },
    {
      title: '7. Mises à Jour',
      content: [
        'Nous pouvons mettre à jour la présente Politique de Cookies à la suite de changements techniques, réglementaires ou de service. La version en vigueur est celle publiée ici avec sa date de mise à jour.',
        'Si des changements substantiels nécessitent un nouveau consentement, le bandeau sera affiché de nouveau.',
        'Questions : [PRIVACY_EMAIL].',
      ],
    },
  ],
};

export const cookieContent: Record<AppLanguageCode, PolicyData> = { it, en, es, fr };
