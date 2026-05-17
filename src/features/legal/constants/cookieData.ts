import type { AppLanguageCode } from '../../../store/preferencesStore';
import type { PolicyData } from './privacyData';

const it: PolicyData = {
  lastUpdated: 'Maggio 2026',
  sections: [
    {
      title: '1. Cosa sono i Cookie',
      content: [
        'I cookie sono piccoli file di testo che i siti web inviano al browser dell\'utente e che vengono memorizzati sul suo dispositivo (computer, smartphone, tablet). Consentono al sito di riconoscere l\'utente nelle visite successive e di memorizzare le sue preferenze.',
        'I cookie non danneggiano il dispositivo e non contengono informazioni personali direttamente identificative, salvo quando l\'utente abbia esplicitamente fornito tali informazioni al sito.',
      ],
    },
    {
      title: '2. Tipologie di Cookie Utilizzati',
      content: [
        'Cookie tecnici necessari — indispensabili per il corretto funzionamento del sito. Includono: gestione della sessione utente, mantenimento del carrello, preferenze di lingua e tema. Non richiedono consenso (Art. 122 D.Lgs. 196/2003).',
        'Cookie di autenticazione — utilizzati per mantenere l\'utente connesso durante la navigazione. Scadono alla chiusura della sessione o dopo un periodo definito.',
        'Cookie di preferenze — memorizzano impostazioni scelte dall\'utente (es. lingua, modalità scura/chiara). Persistenti per la durata scelta dall\'utente.',
        'Cookie analitici di prima parte — raccolgono dati aggregati e anonimi sull\'utilizzo del sito (pagine visitate, durata sessione, percorsi di navigazione) per migliorare l\'esperienza. Richiedono consenso.',
        'Cookie di terze parti — eventualmente presenti se il sito integra servizi di terzi (es. mappe, video, social). Ogni terza parte ha la propria policy. Richiedono consenso esplicito.',
      ],
    },
    {
      title: '3. Cookie Tecnici Specifici del Sito',
      content: [
        'shopbase-theme — memorizza la preferenza tema (chiaro/scuro/sistema). Durata: persistente. Prima parte. Non richiede consenso.',
        'shopbase-preferences — memorizza la lingua selezionata dall\'utente. Durata: persistente. Prima parte. Non richiede consenso.',
        'shopbase-cart — mantiene il contenuto del carrello per utenti non autenticati. Durata: sessione. Prima parte. Non richiede consenso.',
        'shopbase-cookie-consent — memorizza la scelta dell\'utente relativa ai cookie. Durata: 12 mesi. Prima parte. Non richiede consenso.',
        'Cookie di sessione Supabase — gestiscono l\'autenticazione sicura dell\'utente. Durata: sessione / token JWT. Prima parte. Non richiedono consenso.',
      ],
    },
    {
      title: '4. Cookie di Terze Parti',
      content: [
        'Stripe — il gateway di pagamento può utilizzare cookie tecnici per la sicurezza delle transazioni. Non raccolgono dati di navigazione sul nostro sito. Policy: stripe.com/privacy.',
        'Cookie analitici (se attivati) — utilizzati solo previo consenso esplicito dell\'utente per migliorare il servizio in forma anonima e aggregata.',
        'Non utilizziamo cookie pubblicitari, di remarketing o di profilazione commerciale.',
      ],
    },
    {
      title: '5. Base Giuridica e Consenso',
      content: [
        'Cookie tecnici necessari: non richiedono consenso in quanto strettamente necessari all\'erogazione del servizio richiesto dall\'utente (Art. 122, co. 1, D.Lgs. 196/2003; Considerando 25 Direttiva ePrivacy).',
        'Cookie analitici e di terze parti: richiedono consenso esplicito e informato, preventivo all\'installazione. Il consenso è raccolto tramite il banner cookie al primo accesso.',
        'Il consenso è sempre revocabile: l\'utente può modificare le proprie preferenze in qualsiasi momento tramite il pannello dedicato (pulsante "Gestisci preferenze cookie" in questa pagina o icona in basso a destra del sito).',
        'Il rifiuto dei cookie non tecnici non pregiudica la navigazione né l\'acquisto sul sito.',
      ],
    },
    {
      title: '6. Durata dei Cookie',
      content: [
        'Cookie di sessione: eliminati automaticamente alla chiusura del browser.',
        'Cookie persistenti: rimangono sul dispositivo per la durata specificata (massimo 12 mesi per i cookie di consenso, come indicato dal Garante Privacy italiano).',
        'Il Titolare non utilizza cookie con durata superiore a 12 mesi, salvo diversa indicazione per cookie tecnici strettamente necessari.',
      ],
    },
    {
      title: '7. Come Gestire i Cookie',
      content: [
        'Tramite il pannello preferenze del sito: clicca su "Gestisci preferenze cookie" in questa pagina o sull\'icona di gestione consenso presente in basso a destra del sito.',
        'Tramite le impostazioni del browser: ogni browser permette di bloccare, cancellare o limitare i cookie. La modifica delle impostazioni del browser può influire sul funzionamento di alcune funzionalità del sito.',
        'Google Chrome: Impostazioni > Privacy e sicurezza > Cookie e altri dati dei siti.',
        'Mozilla Firefox: Impostazioni > Privacy e sicurezza > Cookie e dati dei siti web.',
        'Safari: Preferenze > Privacy > Gestisci dati siti web.',
        'Microsoft Edge: Impostazioni > Cookie e autorizzazioni sito.',
      ],
    },
    {
      title: '8. Aggiornamenti della Cookie Policy',
      content: [
        'La presente Cookie Policy può essere aggiornata in seguito a modifiche tecniche, normative o di servizio.',
        'In caso di modifiche sostanziali che richiedano un nuovo consenso, il banner cookie verrà ripresentato agli utenti.',
        'La versione vigente è sempre quella pubblicata su questa pagina con la data di ultimo aggiornamento.',
        'Data ultima revisione: maggio 2026.',
        'Titolare del trattamento: [INSERISCI_QUI_NOME_NEGOZIO] — [INSERISCI_EMAIL_PRIVACY].',
      ],
    },
  ],
};

const en: PolicyData = {
  lastUpdated: 'May 2026',
  sections: [
    {
      title: '1. What are Cookies',
      content: [
        'Cookies are small text files that websites send to the user\'s browser and are stored on their device (computer, smartphone, tablet). They allow the site to recognise the user on subsequent visits and remember their preferences.',
        'Cookies do not harm the device and do not contain directly identifiable personal information, unless the user has explicitly provided such information to the site.',
      ],
    },
    {
      title: '2. Types of Cookies Used',
      content: [
        'Strictly necessary technical cookies — essential for the site to function correctly. These include: user session management, cart maintenance, language and theme preferences. No consent required (ePrivacy Directive, Recital 25).',
        'Authentication cookies — used to keep the user logged in during navigation. They expire at session close or after a defined period.',
        'Preference cookies — store settings chosen by the user (e.g. language, dark/light mode). Persistent for the user-chosen duration.',
        'First-party analytics cookies — collect aggregate, anonymous data on site usage (pages visited, session duration, navigation paths) to improve the experience. Consent required.',
        'Third-party cookies — may be present if the site integrates third-party services (e.g. maps, video, social). Each third party has its own policy. Explicit consent required.',
      ],
    },
    {
      title: '3. Site-Specific Technical Cookies',
      content: [
        'shopbase-theme — stores theme preference (light/dark/system). Duration: persistent. First party. No consent required.',
        'shopbase-preferences — stores the user\'s selected language. Duration: persistent. First party. No consent required.',
        'shopbase-cart — maintains the cart contents for unauthenticated users. Duration: session. First party. No consent required.',
        'shopbase-cookie-consent — stores the user\'s cookie choice. Duration: 12 months. First party. No consent required.',
        'Supabase session cookies — manage secure user authentication. Duration: session / JWT token. First party. No consent required.',
      ],
    },
    {
      title: '4. Third-Party Cookies',
      content: [
        'Stripe — the payment gateway may use technical cookies for transaction security. They do not collect browsing data on our site. Policy: stripe.com/privacy.',
        'Analytics cookies (if activated) — used only with the user\'s explicit consent to improve the service in anonymous, aggregate form.',
        'We do not use advertising, remarketing or commercial profiling cookies.',
      ],
    },
    {
      title: '5. Legal Basis and Consent',
      content: [
        'Strictly necessary technical cookies: no consent required, as they are strictly necessary to provide the service requested by the user (ePrivacy Directive, Recital 25).',
        'Analytics and third-party cookies: require explicit, informed consent prior to installation. Consent is collected via the cookie banner on first visit.',
        'Consent is always revocable: the user can change their preferences at any time via the dedicated panel (the "Manage cookie preferences" button on this page or the icon at the bottom right of the site).',
        'Refusing non-technical cookies does not affect browsing or purchasing on the site.',
      ],
    },
    {
      title: '6. Cookie Duration',
      content: [
        'Session cookies: automatically deleted when the browser is closed.',
        'Persistent cookies: remain on the device for the specified duration (maximum 12 months for consent cookies).',
        'The Controller does not use cookies with a duration exceeding 12 months, except where indicated for strictly necessary technical cookies.',
      ],
    },
    {
      title: '7. How to Manage Cookies',
      content: [
        'Via the site preference panel: click "Manage cookie preferences" on this page or the consent management icon at the bottom right of the site.',
        'Via browser settings: every browser allows you to block, delete or restrict cookies. Changing browser settings may affect some site features.',
        'Google Chrome: Settings > Privacy and security > Cookies and other site data.',
        'Mozilla Firefox: Settings > Privacy & Security > Cookies and Site Data.',
        'Safari: Preferences > Privacy > Manage Website Data.',
        'Microsoft Edge: Settings > Cookies and site permissions.',
      ],
    },
    {
      title: '8. Updates to this Cookie Policy',
      content: [
        'This Cookie Policy may be updated following technical, regulatory or service changes.',
        'If material changes require new consent, the cookie banner will be displayed again to users.',
        'The version in force is always the one published on this page with the date of the last update.',
        'Last revised: May 2026.',
        'Data Controller: [INSERT_STORE_NAME_HERE] — [INSERT_PRIVACY_EMAIL].',
      ],
    },
  ],
};

const es: PolicyData = {
  lastUpdated: 'Mayo 2026',
  sections: [
    {
      title: '1. Qué son las Cookies',
      content: [
        'Las cookies son pequeños archivos de texto que los sitios web envían al navegador del usuario y que se almacenan en su dispositivo (ordenador, smartphone, tableta). Permiten al sitio reconocer al usuario en visitas posteriores y recordar sus preferencias.',
        'Las cookies no dañan el dispositivo y no contienen información personal directamente identificable, salvo que el usuario haya proporcionado explícitamente dicha información al sitio.',
      ],
    },
    {
      title: '2. Tipos de Cookies Utilizadas',
      content: [
        'Cookies técnicas estrictamente necesarias — imprescindibles para el correcto funcionamiento del sitio. Incluyen: gestión de sesión de usuario, mantenimiento del carrito, preferencias de idioma y tema. No requieren consentimiento (Directiva ePrivacy, Considerando 25).',
        'Cookies de autenticación — se utilizan para mantener al usuario conectado durante la navegación. Expiran al cerrar la sesión o tras un período definido.',
        'Cookies de preferencias — almacenan configuraciones elegidas por el usuario (p. ej. idioma, modo oscuro/claro). Persistentes durante la duración elegida por el usuario.',
        'Cookies analíticas de primera parte — recopilan datos agregados y anónimos sobre el uso del sitio (páginas visitadas, duración de sesión, rutas de navegación) para mejorar la experiencia. Requieren consentimiento.',
        'Cookies de terceros — pueden estar presentes si el sitio integra servicios de terceros (p. ej. mapas, vídeo, redes sociales). Cada tercero tiene su propia política. Requieren consentimiento explícito.',
      ],
    },
    {
      title: '3. Cookies Técnicas Específicas del Sitio',
      content: [
        'shopbase-theme — almacena la preferencia de tema (claro/oscuro/sistema). Duración: persistente. Primera parte. No requiere consentimiento.',
        'shopbase-preferences — almacena el idioma seleccionado por el usuario. Duración: persistente. Primera parte. No requiere consentimiento.',
        'shopbase-cart — mantiene el contenido del carrito para usuarios no autenticados. Duración: sesión. Primera parte. No requiere consentimiento.',
        'shopbase-cookie-consent — almacena la elección del usuario respecto a las cookies. Duración: 12 meses. Primera parte. No requiere consentimiento.',
        'Cookies de sesión de Supabase — gestionan la autenticación segura del usuario. Duración: sesión / token JWT. Primera parte. No requieren consentimiento.',
      ],
    },
    {
      title: '4. Cookies de Terceros',
      content: [
        'Stripe — la pasarela de pago puede usar cookies técnicas para la seguridad de las transacciones. No recopilan datos de navegación en nuestro sitio. Política: stripe.com/privacy.',
        'Cookies analíticas (si se activan) — se usan únicamente con el consentimiento explícito del usuario para mejorar el servicio de forma anónima y agregada.',
        'No utilizamos cookies publicitarias, de remarketing ni de elaboración de perfiles comerciales.',
      ],
    },
    {
      title: '5. Base Jurídica y Consentimiento',
      content: [
        'Cookies técnicas estrictamente necesarias: no requieren consentimiento, ya que son imprescindibles para prestar el servicio solicitado por el usuario (Directiva ePrivacy, Considerando 25).',
        'Cookies analíticas y de terceros: requieren consentimiento explícito e informado, previo a su instalación. El consentimiento se recoge mediante el banner de cookies en la primera visita.',
        'El consentimiento es siempre revocable: el usuario puede modificar sus preferencias en cualquier momento a través del panel dedicado (botón "Gestionar preferencias de cookies" en esta página o icono en la parte inferior derecha del sitio).',
        'El rechazo de cookies no técnicas no afecta a la navegación ni a la compra en el sitio.',
      ],
    },
    {
      title: '6. Duración de las Cookies',
      content: [
        'Cookies de sesión: se eliminan automáticamente al cerrar el navegador.',
        'Cookies persistentes: permanecen en el dispositivo durante la duración especificada (máximo 12 meses para las cookies de consentimiento).',
        'El Responsable no utiliza cookies con una duración superior a 12 meses, salvo indicación contraria para cookies técnicas estrictamente necesarias.',
      ],
    },
    {
      title: '7. Cómo Gestionar las Cookies',
      content: [
        'A través del panel de preferencias del sitio: haz clic en "Gestionar preferencias de cookies" en esta página o en el icono de gestión del consentimiento en la parte inferior derecha del sitio.',
        'A través de la configuración del navegador: cada navegador permite bloquear, eliminar o restringir las cookies. Cambiar la configuración del navegador puede afectar a algunas funciones del sitio.',
        'Google Chrome: Configuración > Privacidad y seguridad > Cookies y otros datos de sitios.',
        'Mozilla Firefox: Ajustes > Privacidad y seguridad > Cookies y datos del sitio.',
        'Safari: Preferencias > Privacidad > Gestionar datos de sitios web.',
        'Microsoft Edge: Configuración > Cookies y permisos del sitio.',
      ],
    },
    {
      title: '8. Actualizaciones de la Política de Cookies',
      content: [
        'La presente Política de Cookies puede actualizarse tras cambios técnicos, normativos o de servicio.',
        'Si los cambios sustanciales requieren un nuevo consentimiento, el banner de cookies se mostrará de nuevo a los usuarios.',
        'La versión vigente es siempre la publicada en esta página con la fecha de la última actualización.',
        'Última revisión: mayo 2026.',
        'Responsable del tratamiento: [INSERTAR_NOMBRE_TIENDA_AQUI] — [INSERTAR_EMAIL_PRIVACIDAD].',
      ],
    },
  ],
};

const fr: PolicyData = {
  lastUpdated: 'Mai 2026',
  sections: [
    {
      title: '1. Que sont les Cookies',
      content: [
        'Les cookies sont de petits fichiers texte que les sites web envoient au navigateur de l\'utilisateur et qui sont stockés sur son appareil (ordinateur, smartphone, tablette). Ils permettent au site de reconnaître l\'utilisateur lors de visites ultérieures et de mémoriser ses préférences.',
        'Les cookies n\'endommagent pas l\'appareil et ne contiennent pas d\'informations personnelles directement identifiables, sauf si l\'utilisateur a explicitement fourni ces informations au site.',
      ],
    },
    {
      title: '2. Types de Cookies Utilisés',
      content: [
        'Cookies techniques strictement nécessaires — indispensables au bon fonctionnement du site. Comprennent : gestion de session utilisateur, maintien du panier, préférences de langue et de thème. Pas de consentement requis (Directive ePrivacy, Considérant 25).',
        'Cookies d\'authentification — utilisés pour maintenir l\'utilisateur connecté pendant la navigation. Ils expirent à la fermeture de la session ou après une période définie.',
        'Cookies de préférences — stockent les paramètres choisis par l\'utilisateur (ex. langue, mode sombre/clair). Persistants pour la durée choisie par l\'utilisateur.',
        'Cookies analytiques de première partie — collectent des données agrégées et anonymes sur l\'utilisation du site (pages visitées, durée de session, parcours de navigation) pour améliorer l\'expérience. Consentement requis.',
        'Cookies tiers — peuvent être présents si le site intègre des services tiers (ex. cartes, vidéo, réseaux sociaux). Chaque tiers dispose de sa propre politique. Consentement explicite requis.',
      ],
    },
    {
      title: '3. Cookies Techniques Spécifiques au Site',
      content: [
        'shopbase-theme — stocke la préférence de thème (clair/sombre/système). Durée : persistant. Première partie. Pas de consentement requis.',
        'shopbase-preferences — stocke la langue sélectionnée par l\'utilisateur. Durée : persistant. Première partie. Pas de consentement requis.',
        'shopbase-cart — maintient le contenu du panier pour les utilisateurs non authentifiés. Durée : session. Première partie. Pas de consentement requis.',
        'shopbase-cookie-consent — stocke le choix de l\'utilisateur concernant les cookies. Durée : 12 mois. Première partie. Pas de consentement requis.',
        'Cookies de session Supabase — gèrent l\'authentification sécurisée de l\'utilisateur. Durée : session / jeton JWT. Première partie. Pas de consentement requis.',
      ],
    },
    {
      title: '4. Cookies Tiers',
      content: [
        'Stripe — la passerelle de paiement peut utiliser des cookies techniques pour la sécurité des transactions. Ils ne collectent pas de données de navigation sur notre site. Politique : stripe.com/privacy.',
        'Cookies analytiques (si activés) — utilisés uniquement avec le consentement explicite de l\'utilisateur pour améliorer le service de manière anonyme et agrégée.',
        'Nous n\'utilisons pas de cookies publicitaires, de remarketing ou de profilage commercial.',
      ],
    },
    {
      title: '5. Base Juridique et Consentement',
      content: [
        'Cookies techniques strictement nécessaires : pas de consentement requis, car ils sont indispensables à la fourniture du service demandé par l\'utilisateur (Directive ePrivacy, Considérant 25).',
        'Cookies analytiques et tiers : nécessitent un consentement explicite et éclairé, préalable à leur installation. Le consentement est recueilli via le bandeau cookies lors de la première visite.',
        'Le consentement est toujours révocable : l\'utilisateur peut modifier ses préférences à tout moment via le panneau dédié (bouton "Gérer les préférences de cookies" sur cette page ou icône en bas à droite du site).',
        'Le refus des cookies non techniques n\'affecte pas la navigation ni les achats sur le site.',
      ],
    },
    {
      title: '6. Durée des Cookies',
      content: [
        'Cookies de session : supprimés automatiquement à la fermeture du navigateur.',
        'Cookies persistants : restent sur l\'appareil pendant la durée spécifiée (12 mois maximum pour les cookies de consentement).',
        'Le Responsable n\'utilise pas de cookies d\'une durée supérieure à 12 mois, sauf indication contraire pour les cookies techniques strictement nécessaires.',
      ],
    },
    {
      title: '7. Comment Gérer les Cookies',
      content: [
        'Via le panneau de préférences du site : cliquez sur "Gérer les préférences de cookies" sur cette page ou sur l\'icône de gestion du consentement en bas à droite du site.',
        'Via les paramètres du navigateur : chaque navigateur permet de bloquer, supprimer ou restreindre les cookies. La modification des paramètres du navigateur peut affecter certaines fonctionnalités du site.',
        'Google Chrome : Paramètres > Confidentialité et sécurité > Cookies et autres données des sites.',
        'Mozilla Firefox : Paramètres > Vie privée et sécurité > Cookies et données du site.',
        'Safari : Préférences > Confidentialité > Gérer les données des sites web.',
        'Microsoft Edge : Paramètres > Cookies et autorisations des sites.',
      ],
    },
    {
      title: '8. Mises à Jour de la Politique de Cookies',
      content: [
        'La présente Politique de Cookies peut être mise à jour suite à des changements techniques, réglementaires ou de service.',
        'Si des changements substantiels nécessitent un nouveau consentement, le bandeau cookies sera à nouveau affiché aux utilisateurs.',
        'La version en vigueur est toujours celle publiée sur cette page avec la date de la dernière mise à jour.',
        'Dernière révision : mai 2026.',
        'Responsable du traitement : [INSÉRER_NOM_BOUTIQUE_ICI] — [INSÉRER_EMAIL_CONFIDENTIALITÉ].',
      ],
    },
  ],
};

export const cookieContent: Record<AppLanguageCode, PolicyData> = { it, en, es, fr };
