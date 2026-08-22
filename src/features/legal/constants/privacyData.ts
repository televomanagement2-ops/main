import type { AppLanguageCode } from '../../../store/preferencesStore';

export interface PolicySection {
  title: string;
  content: string[];
}

export interface PolicyData {
  lastUpdated: string;
  sections: PolicySection[];
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTE ON PLACEHOLDERS — replace [SQUARE_BRACKETS] with real data before launch:
// [SELLER_LEGAL_NAME], [BUSINESS_ADDRESS], [PRIVACY_EMAIL], [EU_REPRESENTATIVE].
// Market model: PRIMARY United States (CCPA/CPRA & other state laws), with an
// additional section for the EEA/UK (GDPR). English is the prevailing version.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// ENGLISH (prevailing version)
// ─────────────────────────────────────────────────────────────────────────────
const en: PolicyData = {
  lastUpdated: 'June 2026',
  sections: [
    {
      title: '1. Who We Are',
      content: [
        'This Privacy Policy explains how [SELLER_LEGAL_NAME] ("we", "us", "AURUM") collects, uses, and shares personal information when you visit this site or make a purchase.',
        'Controller / business: [SELLER_LEGAL_NAME] — [BUSINESS_ADDRESS]. Privacy contact: [PRIVACY_EMAIL].',
        'By using the site you acknowledge this Policy. It should be read together with our Cookie Policy and Terms of Service.',
      ],
    },
    {
      title: '2. Information We Collect',
      content: [
        'Information you provide: name, email, shipping and billing address, phone number, order details, and any messages you send us.',
        'Payment information: card payments are processed by Stripe. We receive limited transaction data (e.g., confirmation, last four digits, status) but never your full card number.',
        'Information collected automatically: IP address, device and browser type, pages viewed, referring pages, and similar usage data collected via cookies and similar technologies (see our Cookie Policy).',
        'We do not intentionally collect sensitive categories of personal information (e.g., precise geolocation, health, biometric data).',
      ],
    },
    {
      title: '3. How We Use Information',
      content: [
        'To process and deliver orders, handle payments, returns, and refunds, and provide customer support.',
        'To operate, secure, and improve the site, prevent fraud, and comply with legal, tax, and accounting obligations.',
        'To send transactional messages (order confirmation, shipping, delivery) and, only with your consent where required, marketing communications you can opt out of at any time.',
        'To produce aggregate, de-identified analytics about how the site is used.',
      ],
    },
    {
      title: '4. How We Share Information',
      content: [
        'Service providers acting on our behalf under contract: Stripe (payments), Supabase (cloud database and authentication), our email provider (transactional notifications), and shipping carriers (delivery).',
        'Legal and safety: public authorities or third parties where required by law, to enforce our Terms, or to protect rights, property, or safety.',
        'Business transfers: in connection with a merger, acquisition, or sale of assets, subject to this Policy.',
        'We require service providers to protect personal information and to use it only to provide their services to us.',
      ],
    },
    {
      title: '5. We Do Not Sell Your Personal Information',
      content: [
        'We do not sell your personal information for money, and we do not "share" it for cross-context behavioral advertising as those terms are defined under California and other U.S. state laws.',
        'If this ever changes, we will update this Policy and provide a clear "Do Not Sell or Share My Personal Information" mechanism beforehand.',
        'Global Privacy Control (GPC): we honor recognized opt-out preference signals, such as GPC, sent by your browser as a valid opt-out of sale/sharing where applicable.',
      ],
    },
    {
      title: '6. Cookies & Similar Technologies',
      content: [
        'We use strictly necessary cookies to operate the site and, only with your consent, first-party analytics cookies. We do not use third-party advertising or profiling cookies.',
        'You can accept, reject, or customize non-essential cookies via our consent banner and re-open your choices at any time using the floating cookie button.',
        'See the full Cookie Policy for the specific cookies used and their purposes.',
      ],
    },
    {
      title: '7. Data Retention',
      content: [
        'Tax and invoicing records: retained as required by law (typically up to 7–10 years depending on jurisdiction).',
        'Account and order data: retained while your account is active and as needed to provide the service, then deleted or anonymized.',
        'Marketing data: retained until you withdraw consent or opt out.',
        'Technical logs: retained for a limited period for security and troubleshooting.',
      ],
    },
    {
      title: '8. Data Security',
      content: [
        'We use appropriate technical and organizational measures to protect personal information, including encryption in transit (HTTPS/TLS) and access controls.',
        'Payments are handled by Stripe under PCI-DSS Level 1 standards; we do not store full card data.',
        'No method of transmission or storage is completely secure; we cannot guarantee absolute security, but we work to protect your information and to respond promptly to incidents.',
      ],
    },
    {
      title: '9. Children\'s Privacy',
      content: [
        'The site is not directed to children under 13 (or the minimum age in your jurisdiction), and we do not knowingly collect their personal information.',
        'If you believe a child has provided us personal information, contact [PRIVACY_EMAIL] and we will delete it.',
      ],
    },
    {
      title: '10. Your U.S. State Privacy Rights',
      content: [
        'Depending on your state of residence (e.g., California, Virginia, Colorado, Connecticut, Texas, and other states with comprehensive privacy laws), you may have the right to: know/access the personal information we hold; correct inaccuracies; delete your information; obtain a portable copy; and opt out of sale, sharing, or targeted advertising.',
        'We will not discriminate against you for exercising these rights.',
        'To exercise your rights, contact [PRIVACY_EMAIL]. We will verify your request and respond within the timeframe required by your state\'s law (generally 45 days, extendable). You may use an authorized agent where permitted.',
        'California residents may also request information about disclosures for a business purpose. If we deny a request, you may appeal by replying to our decision; certain states provide a right to appeal.',
      ],
    },
    {
      title: '11. EEA / UK Residents (GDPR)',
      content: [
        'If you are in the European Economic Area or the United Kingdom, the following applies. Controller: [SELLER_LEGAL_NAME]. EU/UK representative (where appointed): [EU_REPRESENTATIVE].',
        'Legal bases: performance of the contract (orders, delivery, payment); legal obligations (tax/accounting); your consent (marketing, non-essential cookies); and our legitimate interests (security, service improvement) balanced against your rights.',
        'Your rights: access, rectification, erasure, restriction, portability, objection, and withdrawal of consent at any time without affecting prior processing.',
        'International transfers: some providers (e.g., Stripe, Supabase) may process data outside the EEA/UK. Where they do, transfers rely on appropriate safeguards such as the European Commission\'s Standard Contractual Clauses (and the UK Addendum) or an adequacy decision.',
        'You may lodge a complaint with your national supervisory authority. To exercise your rights, contact [PRIVACY_EMAIL]; we respond within one month.',
      ],
    },
    {
      title: '12. Changes & Contact',
      content: [
        'We may update this Privacy Policy to reflect legal, technical, or operational changes. The version in force is the one published here with its "last updated" date.',
        'For material changes affecting your rights, we will provide notice by reasonable means.',
        'Questions or requests: [PRIVACY_EMAIL].',
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// ITALIANO
// ─────────────────────────────────────────────────────────────────────────────
const it: PolicyData = {
  lastUpdated: 'Giugno 2026',
  sections: [
    {
      title: '1. Chi Siamo',
      content: [
        'La presente Privacy Policy spiega come [SELLER_LEGAL_NAME] ("noi", "AURUM") raccoglie, utilizza e condivide i dati personali quando visiti il sito o effettui un acquisto.',
        'Titolare / impresa: [SELLER_LEGAL_NAME] — [BUSINESS_ADDRESS]. Contatto privacy: [PRIVACY_EMAIL].',
        'Utilizzando il sito prendi atto della presente Policy, da leggere insieme alla Cookie Policy e ai Termini di Servizio.',
      ],
    },
    {
      title: '2. Dati che Raccogliamo',
      content: [
        'Dati che fornisci: nome, email, indirizzo di spedizione e fatturazione, numero di telefono, dettagli dell\'ordine ed eventuali messaggi che ci invii.',
        'Dati di pagamento: i pagamenti con carta sono elaborati da Stripe. Riceviamo dati limitati della transazione (es. conferma, ultime quattro cifre, stato) ma mai il numero completo della carta.',
        'Dati raccolti automaticamente: indirizzo IP, tipo di dispositivo e browser, pagine visitate, pagine di provenienza e dati di utilizzo analoghi raccolti tramite cookie e tecnologie simili (vedi Cookie Policy).',
        'Non raccogliamo intenzionalmente categorie particolari di dati (es. geolocalizzazione precisa, dati sanitari o biometrici).',
      ],
    },
    {
      title: '3. Come Utilizziamo i Dati',
      content: [
        'Per elaborare ed evadere gli ordini, gestire pagamenti, resi e rimborsi e fornire assistenza clienti.',
        'Per gestire, proteggere e migliorare il sito, prevenire frodi e adempiere agli obblighi legali, fiscali e contabili.',
        'Per inviare comunicazioni transazionali (conferma ordine, spedizione, consegna) e, solo previo consenso ove richiesto, comunicazioni di marketing da cui puoi disiscriverti in qualsiasi momento.',
        'Per produrre analisi aggregate e non identificative sull\'uso del sito.',
      ],
    },
    {
      title: '4. Come Condividiamo i Dati',
      content: [
        'Fornitori di servizi che agiscono per nostro conto su base contrattuale: Stripe (pagamenti), Supabase (database cloud e autenticazione), il nostro provider email (notifiche transazionali) e i corrieri (consegna).',
        'Esigenze legali e di sicurezza: autorità pubbliche o terzi ove richiesto dalla legge, per far valere i nostri Termini o per tutelare diritti, beni o sicurezza.',
        'Operazioni societarie: in caso di fusione, acquisizione o cessione di azienda, nel rispetto della presente Policy.',
        'Imponiamo ai fornitori di proteggere i dati personali e di utilizzarli solo per erogarci i loro servizi.',
      ],
    },
    {
      title: '5. Non Vendiamo i Tuoi Dati Personali',
      content: [
        'Non vendiamo i tuoi dati personali in cambio di denaro e non li "condividiamo" per pubblicità comportamentale cross-context secondo le definizioni delle leggi della California e di altri stati USA.',
        'Se ciò dovesse cambiare, aggiorneremo la Policy e forniremo preventivamente un chiaro meccanismo "Do Not Sell or Share My Personal Information".',
        'Global Privacy Control (GPC): rispettiamo i segnali di opt-out riconosciuti, come il GPC inviato dal browser, quale valida opposizione alla vendita/condivisione ove applicabile.',
      ],
    },
    {
      title: '6. Cookie e Tecnologie Simili',
      content: [
        'Utilizziamo cookie strettamente necessari al funzionamento del sito e, solo con il tuo consenso, cookie analitici di prima parte. Non utilizziamo cookie pubblicitari o di profilazione di terze parti.',
        'Puoi accettare, rifiutare o personalizzare i cookie non essenziali tramite il banner di consenso e riaprire le tue scelte in qualsiasi momento con il pulsante cookie flottante.',
        'Consulta la Cookie Policy completa per i cookie specifici utilizzati e le relative finalità.',
      ],
    },
    {
      title: '7. Conservazione dei Dati',
      content: [
        'Documenti fiscali e di fatturazione: conservati come richiesto dalla legge (di norma fino a 7–10 anni a seconda della giurisdizione).',
        'Dati di account e ordini: conservati finché l\'account è attivo e per il tempo necessario a fornire il servizio, poi cancellati o anonimizzati.',
        'Dati di marketing: conservati fino alla revoca del consenso o all\'opt-out.',
        'Log tecnici: conservati per un periodo limitato per sicurezza e diagnostica.',
      ],
    },
    {
      title: '8. Sicurezza dei Dati',
      content: [
        'Adottiamo misure tecniche e organizzative adeguate per proteggere i dati personali, inclusa la cifratura in transito (HTTPS/TLS) e i controlli di accesso.',
        'I pagamenti sono gestiti da Stripe secondo lo standard PCI-DSS Level 1; non conserviamo i dati completi della carta.',
        'Nessun metodo di trasmissione o archiviazione è completamente sicuro; non possiamo garantire una sicurezza assoluta, ma lavoriamo per proteggere i tuoi dati e rispondere tempestivamente agli incidenti.',
      ],
    },
    {
      title: '9. Privacy dei Minori',
      content: [
        'Il sito non è rivolto a minori di 13 anni (o l\'età minima prevista nella tua giurisdizione) e non raccogliamo consapevolmente i loro dati personali.',
        'Se ritieni che un minore ci abbia fornito dati personali, contatta [PRIVACY_EMAIL] e procederemo alla cancellazione.',
      ],
    },
    {
      title: '10. Diritti Privacy dei Residenti negli Stati Uniti',
      content: [
        'In base allo stato di residenza (es. California, Virginia, Colorado, Connecticut, Texas e altri stati con leggi privacy complete), puoi avere il diritto di: conoscere/accedere ai dati personali in nostro possesso; correggere inesattezze; cancellare i dati; ottenere una copia portabile; e opporti a vendita, condivisione o pubblicità mirata.',
        'Non ti tratteremo in modo discriminatorio per l\'esercizio di tali diritti.',
        'Per esercitare i diritti contatta [PRIVACY_EMAIL]. Verificheremo la richiesta e risponderemo entro il termine previsto dalla legge del tuo stato (in genere 45 giorni, prorogabili). Ove consentito, puoi avvalerti di un agente autorizzato.',
        'I residenti in California possono inoltre richiedere informazioni sulle comunicazioni effettuate per finalità aziendali. In caso di rifiuto, puoi presentare ricorso rispondendo alla nostra decisione; alcuni stati prevedono un diritto di appello.',
      ],
    },
    {
      title: '11. Residenti SEE / Regno Unito (GDPR)',
      content: [
        'Se ti trovi nello Spazio Economico Europeo o nel Regno Unito si applica quanto segue. Titolare: [SELLER_LEGAL_NAME]. Rappresentante UE/UK (ove nominato): [EU_REPRESENTATIVE].',
        'Basi giuridiche: esecuzione del contratto (ordini, consegna, pagamento); obblighi legali (fiscali/contabili); il tuo consenso (marketing, cookie non essenziali); e i nostri legittimi interessi (sicurezza, miglioramento del servizio) bilanciati con i tuoi diritti.',
        'I tuoi diritti: accesso, rettifica, cancellazione, limitazione, portabilità, opposizione e revoca del consenso in qualsiasi momento senza pregiudicare i trattamenti precedenti.',
        'Trasferimenti internazionali: alcuni fornitori (es. Stripe, Supabase) possono trattare dati al di fuori del SEE/UK. In tali casi i trasferimenti si basano su garanzie adeguate quali le Clausole Contrattuali Standard della Commissione Europea (e l\'Addendum UK) o una decisione di adeguatezza.',
        'Puoi presentare reclamo all\'autorità di controllo nazionale (in Italia, il Garante per la Protezione dei Dati Personali). Per esercitare i diritti contatta [PRIVACY_EMAIL]; rispondiamo entro un mese.',
      ],
    },
    {
      title: '12. Modifiche e Contatti',
      content: [
        'Possiamo aggiornare la presente Privacy Policy per riflettere modifiche normative, tecniche o operative. La versione vigente è quella pubblicata qui con la relativa data di aggiornamento.',
        'In caso di modifiche sostanziali che incidono sui tuoi diritti, ti informeremo con mezzi ragionevoli.',
        'Domande o richieste: [PRIVACY_EMAIL].',
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// ESPAÑOL
// ─────────────────────────────────────────────────────────────────────────────
const es: PolicyData = {
  lastUpdated: 'Junio 2026',
  sections: [
    {
      title: '1. Quiénes Somos',
      content: [
        'Esta Política de Privacidad explica cómo [SELLER_LEGAL_NAME] ("nosotros", "AURUM") recopila, usa y comparte datos personales cuando visitas el sitio o realizas una compra.',
        'Responsable / empresa: [SELLER_LEGAL_NAME] — [BUSINESS_ADDRESS]. Contacto de privacidad: [PRIVACY_EMAIL].',
        'Al usar el sitio reconoces esta Política, que debe leerse junto con la Política de Cookies y las Condiciones del Servicio.',
      ],
    },
    {
      title: '2. Datos que Recopilamos',
      content: [
        'Datos que facilitas: nombre, correo, dirección de envío y facturación, teléfono, detalles del pedido y los mensajes que nos envíes.',
        'Datos de pago: los pagos con tarjeta los procesa Stripe. Recibimos datos limitados de la transacción (p. ej., confirmación, últimos cuatro dígitos, estado) pero nunca el número completo de la tarjeta.',
        'Datos recopilados automáticamente: dirección IP, tipo de dispositivo y navegador, páginas vistas, páginas de origen y datos de uso similares mediante cookies y tecnologías análogas (ver Política de Cookies).',
        'No recopilamos intencionadamente categorías especiales de datos (p. ej., geolocalización precisa, datos de salud o biométricos).',
      ],
    },
    {
      title: '3. Cómo Usamos los Datos',
      content: [
        'Para procesar y entregar pedidos, gestionar pagos, devoluciones y reembolsos y prestar atención al cliente.',
        'Para operar, proteger y mejorar el sitio, prevenir fraudes y cumplir obligaciones legales, fiscales y contables.',
        'Para enviar comunicaciones transaccionales (confirmación, envío, entrega) y, solo con tu consentimiento cuando se requiera, comunicaciones de marketing de las que puedes darte de baja en cualquier momento.',
        'Para elaborar analíticas agregadas y no identificativas sobre el uso del sitio.',
      ],
    },
    {
      title: '4. Cómo Compartimos los Datos',
      content: [
        'Proveedores de servicios que actúan por cuenta nuestra bajo contrato: Stripe (pagos), Supabase (base de datos en la nube y autenticación), nuestro proveedor de correo (notificaciones transaccionales) y transportistas (entrega).',
        'Requisitos legales y de seguridad: autoridades públicas o terceros cuando lo exija la ley, para hacer cumplir nuestras Condiciones o proteger derechos, bienes o seguridad.',
        'Operaciones empresariales: en caso de fusión, adquisición o venta de activos, conforme a esta Política.',
        'Exigimos a los proveedores que protejan los datos personales y los usen solo para prestarnos sus servicios.',
      ],
    },
    {
      title: '5. No Vendemos tus Datos Personales',
      content: [
        'No vendemos tus datos personales a cambio de dinero ni los "compartimos" para publicidad comportamental cross-context según las definiciones de las leyes de California y otros estados de EE. UU.',
        'Si esto cambiara, actualizaremos esta Política y facilitaremos previamente un mecanismo claro "Do Not Sell or Share My Personal Information".',
        'Global Privacy Control (GPC): respetamos las señales de exclusión reconocidas, como el GPC enviado por tu navegador, como exclusión válida de la venta/compartición cuando proceda.',
      ],
    },
    {
      title: '6. Cookies y Tecnologías Similares',
      content: [
        'Usamos cookies estrictamente necesarias para el funcionamiento del sitio y, solo con tu consentimiento, cookies analíticas de primera parte. No usamos cookies publicitarias ni de elaboración de perfiles de terceros.',
        'Puedes aceptar, rechazar o personalizar las cookies no esenciales mediante el banner de consentimiento y reabrir tus opciones en cualquier momento con el botón flotante de cookies.',
        'Consulta la Política de Cookies completa para conocer las cookies concretas y sus finalidades.',
      ],
    },
    {
      title: '7. Conservación de los Datos',
      content: [
        'Registros fiscales y de facturación: conservados según exige la ley (normalmente hasta 7–10 años según la jurisdicción).',
        'Datos de cuenta y pedidos: conservados mientras la cuenta esté activa y lo necesario para prestar el servicio, luego eliminados o anonimizados.',
        'Datos de marketing: conservados hasta que retires el consentimiento o te des de baja.',
        'Registros técnicos: conservados durante un período limitado por seguridad y diagnóstico.',
      ],
    },
    {
      title: '8. Seguridad de los Datos',
      content: [
        'Aplicamos medidas técnicas y organizativas adecuadas para proteger los datos personales, incluido el cifrado en tránsito (HTTPS/TLS) y controles de acceso.',
        'Los pagos los gestiona Stripe conforme al estándar PCI-DSS Nivel 1; no almacenamos datos completos de la tarjeta.',
        'Ningún método de transmisión o almacenamiento es completamente seguro; no podemos garantizar seguridad absoluta, pero trabajamos para proteger tus datos y responder con prontitud a los incidentes.',
      ],
    },
    {
      title: '9. Privacidad de los Menores',
      content: [
        'El sitio no se dirige a menores de 13 años (o la edad mínima de tu jurisdicción) y no recopilamos conscientemente sus datos personales.',
        'Si crees que un menor nos ha facilitado datos personales, contacta con [PRIVACY_EMAIL] y los eliminaremos.',
      ],
    },
    {
      title: '10. Tus Derechos de Privacidad en EE. UU.',
      content: [
        'Según tu estado de residencia (p. ej., California, Virginia, Colorado, Connecticut, Texas y otros estados con leyes de privacidad completas), puedes tener derecho a: conocer/acceder a los datos que tenemos; corregir inexactitudes; eliminar tus datos; obtener una copia portátil; y excluirte de la venta, compartición o publicidad dirigida.',
        'No te trataremos de forma discriminatoria por ejercer estos derechos.',
        'Para ejercerlos, contacta con [PRIVACY_EMAIL]. Verificaremos la solicitud y responderemos en el plazo que exija la ley de tu estado (en general 45 días, prorrogables). Cuando se permita, puedes usar un agente autorizado.',
        'Los residentes en California también pueden solicitar información sobre las comunicaciones con fines empresariales. Si denegamos una solicitud, puedes recurrir respondiendo a nuestra decisión; algunos estados prevén un derecho de apelación.',
      ],
    },
    {
      title: '11. Residentes en el EEE / Reino Unido (RGPD)',
      content: [
        'Si te encuentras en el Espacio Económico Europeo o el Reino Unido se aplica lo siguiente. Responsable: [SELLER_LEGAL_NAME]. Representante UE/RU (cuando se designe): [EU_REPRESENTATIVE].',
        'Bases jurídicas: ejecución del contrato (pedidos, entrega, pago); obligaciones legales (fiscales/contables); tu consentimiento (marketing, cookies no esenciales); y nuestros intereses legítimos (seguridad, mejora del servicio) ponderados con tus derechos.',
        'Tus derechos: acceso, rectificación, supresión, limitación, portabilidad, oposición y retirada del consentimiento en cualquier momento sin afectar a los tratamientos previos.',
        'Transferencias internacionales: algunos proveedores (p. ej., Stripe, Supabase) pueden tratar datos fuera del EEE/RU. En tal caso, las transferencias se basan en garantías adecuadas como las Cláusulas Contractuales Estándar de la Comisión Europea (y el Adenda del RU) o una decisión de adecuación.',
        'Puedes presentar una reclamación ante tu autoridad de control nacional (en España, la AEPD). Para ejercer tus derechos, contacta con [PRIVACY_EMAIL]; respondemos en un mes.',
      ],
    },
    {
      title: '12. Cambios y Contacto',
      content: [
        'Podemos actualizar esta Política de Privacidad para reflejar cambios legales, técnicos u operativos. La versión vigente es la publicada aquí con su fecha de actualización.',
        'Ante cambios sustanciales que afecten a tus derechos, lo notificaremos por medios razonables.',
        'Preguntas o solicitudes: [PRIVACY_EMAIL].',
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// FRANÇAIS
// ─────────────────────────────────────────────────────────────────────────────
const fr: PolicyData = {
  lastUpdated: 'Juin 2026',
  sections: [
    {
      title: '1. Qui Sommes-Nous',
      content: [
        'La présente Politique de Confidentialité explique comment [SELLER_LEGAL_NAME] (« nous », « AURUM ») collecte, utilise et partage les données personnelles lorsque vous visitez le site ou effectuez un achat.',
        'Responsable / entreprise : [SELLER_LEGAL_NAME] — [BUSINESS_ADDRESS]. Contact confidentialité : [PRIVACY_EMAIL].',
        'En utilisant le site, vous reconnaissez la présente Politique, à lire conjointement avec la Politique de Cookies et les Conditions de Service.',
      ],
    },
    {
      title: '2. Données que Nous Collectons',
      content: [
        'Données que vous fournissez : nom, e-mail, adresse de livraison et de facturation, téléphone, détails de commande et messages que vous nous envoyez.',
        'Données de paiement : les paiements par carte sont traités par Stripe. Nous recevons des données de transaction limitées (ex. confirmation, quatre derniers chiffres, statut) mais jamais le numéro complet de la carte.',
        'Données collectées automatiquement : adresse IP, type d\'appareil et de navigateur, pages consultées, pages de provenance et données d\'usage similaires via cookies et technologies analogues (voir Politique de Cookies).',
        'Nous ne collectons pas intentionnellement de catégories particulières de données (ex. géolocalisation précise, données de santé ou biométriques).',
      ],
    },
    {
      title: '3. Comment Nous Utilisons les Données',
      content: [
        'Pour traiter et livrer les commandes, gérer les paiements, retours et remboursements et fournir l\'assistance client.',
        'Pour exploiter, sécuriser et améliorer le site, prévenir la fraude et respecter les obligations légales, fiscales et comptables.',
        'Pour envoyer des communications transactionnelles (confirmation, expédition, livraison) et, uniquement avec votre consentement lorsque requis, des communications marketing auxquelles vous pouvez vous désinscrire à tout moment.',
        'Pour produire des analyses agrégées et non identifiantes sur l\'utilisation du site.',
      ],
    },
    {
      title: '4. Comment Nous Partageons les Données',
      content: [
        'Prestataires agissant pour notre compte sous contrat : Stripe (paiements), Supabase (base de données cloud et authentification), notre prestataire e-mail (notifications transactionnelles) et les transporteurs (livraison).',
        'Exigences légales et de sécurité : autorités publiques ou tiers lorsque la loi l\'exige, pour faire respecter nos Conditions ou protéger des droits, des biens ou la sécurité.',
        'Opérations sur l\'entreprise : en cas de fusion, acquisition ou cession d\'actifs, sous réserve de la présente Politique.',
        'Nous exigeons des prestataires qu\'ils protègent les données personnelles et ne les utilisent que pour nous fournir leurs services.',
      ],
    },
    {
      title: '5. Nous Ne Vendons Pas Vos Données Personnelles',
      content: [
        'Nous ne vendons pas vos données personnelles contre rémunération et nous ne les « partageons » pas à des fins de publicité comportementale cross-context au sens des lois de Californie et d\'autres États américains.',
        'Si cela venait à changer, nous mettrions à jour la Politique et fournirions au préalable un mécanisme clair « Do Not Sell or Share My Personal Information ».',
        'Global Privacy Control (GPC) : nous respectons les signaux d\'exclusion reconnus, tels que le GPC envoyé par votre navigateur, comme opposition valable à la vente/au partage le cas échéant.',
      ],
    },
    {
      title: '6. Cookies et Technologies Similaires',
      content: [
        'Nous utilisons des cookies strictement nécessaires au fonctionnement du site et, uniquement avec votre consentement, des cookies analytiques de première partie. Nous n\'utilisons pas de cookies publicitaires ou de profilage tiers.',
        'Vous pouvez accepter, refuser ou personnaliser les cookies non essentiels via notre bandeau de consentement et rouvrir vos choix à tout moment grâce au bouton cookie flottant.',
        'Consultez la Politique de Cookies complète pour les cookies spécifiques utilisés et leurs finalités.',
      ],
    },
    {
      title: '7. Conservation des Données',
      content: [
        'Documents fiscaux et de facturation : conservés conformément à la loi (généralement jusqu\'à 7–10 ans selon la juridiction).',
        'Données de compte et de commande : conservées tant que le compte est actif et le temps nécessaire à la fourniture du service, puis supprimées ou anonymisées.',
        'Données marketing : conservées jusqu\'au retrait du consentement ou à la désinscription.',
        'Journaux techniques : conservés pour une durée limitée à des fins de sécurité et de dépannage.',
      ],
    },
    {
      title: '8. Sécurité des Données',
      content: [
        'Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger les données personnelles, y compris le chiffrement en transit (HTTPS/TLS) et des contrôles d\'accès.',
        'Les paiements sont gérés par Stripe selon la norme PCI-DSS Niveau 1 ; nous ne stockons pas les données complètes de carte.',
        'Aucune méthode de transmission ou de stockage n\'est totalement sûre ; nous ne pouvons garantir une sécurité absolue, mais nous œuvrons à protéger vos données et à répondre rapidement aux incidents.',
      ],
    },
    {
      title: '9. Confidentialité des Mineurs',
      content: [
        'Le site ne s\'adresse pas aux enfants de moins de 13 ans (ou l\'âge minimum de votre juridiction) et nous ne collectons pas sciemment leurs données personnelles.',
        'Si vous pensez qu\'un enfant nous a fourni des données personnelles, contactez [PRIVACY_EMAIL] et nous les supprimerons.',
      ],
    },
    {
      title: '10. Vos Droits à la Vie Privée aux États-Unis',
      content: [
        'Selon votre État de résidence (ex. Californie, Virginie, Colorado, Connecticut, Texas et d\'autres États dotés de lois complètes sur la vie privée), vous pouvez avoir le droit de : connaître/accéder aux données que nous détenons ; corriger les inexactitudes ; supprimer vos données ; obtenir une copie portable ; et vous opposer à la vente, au partage ou à la publicité ciblée.',
        'Nous ne vous traiterons pas de manière discriminatoire pour l\'exercice de ces droits.',
        'Pour les exercer, contactez [PRIVACY_EMAIL]. Nous vérifierons la demande et répondrons dans le délai exigé par la loi de votre État (généralement 45 jours, prolongeable). Lorsque cela est permis, vous pouvez recourir à un agent autorisé.',
        'Les résidents de Californie peuvent aussi demander des informations sur les divulgations à des fins commerciales. En cas de refus, vous pouvez faire appel en répondant à notre décision ; certains États prévoient un droit d\'appel.',
      ],
    },
    {
      title: '11. Résidents de l\'EEE / Royaume-Uni (RGPD)',
      content: [
        'Si vous vous trouvez dans l\'Espace économique européen ou au Royaume-Uni, ce qui suit s\'applique. Responsable : [SELLER_LEGAL_NAME]. Représentant UE/RU (le cas échéant) : [EU_REPRESENTATIVE].',
        'Bases juridiques : exécution du contrat (commandes, livraison, paiement) ; obligations légales (fiscales/comptables) ; votre consentement (marketing, cookies non essentiels) ; et nos intérêts légitimes (sécurité, amélioration du service) mis en balance avec vos droits.',
        'Vos droits : accès, rectification, effacement, limitation, portabilité, opposition et retrait du consentement à tout moment sans affecter les traitements antérieurs.',
        'Transferts internationaux : certains prestataires (ex. Stripe, Supabase) peuvent traiter des données hors EEE/RU. Le cas échéant, les transferts reposent sur des garanties appropriées telles que les Clauses Contractuelles Types de la Commission européenne (et l\'addendum britannique) ou une décision d\'adéquation.',
        'Vous pouvez introduire une réclamation auprès de votre autorité de contrôle nationale (en France, la CNIL). Pour exercer vos droits, contactez [PRIVACY_EMAIL] ; nous répondons sous un mois.',
      ],
    },
    {
      title: '12. Modifications et Contact',
      content: [
        'Nous pouvons mettre à jour la présente Politique de Confidentialité pour refléter des changements légaux, techniques ou opérationnels. La version en vigueur est celle publiée ici avec sa date de mise à jour.',
        'En cas de modifications substantielles affectant vos droits, nous vous en informerons par des moyens raisonnables.',
        'Questions ou demandes : [PRIVACY_EMAIL].',
      ],
    },
  ],
};

export const privacyContent: Record<AppLanguageCode, PolicyData> = { it, en, es, fr };
