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
// ITALIANO
// ─────────────────────────────────────────────────────────────────────────────
const it: PolicyData = {
  lastUpdated: 'Maggio 2026',
  sections: [
    {
      title: '1. Titolare del Trattamento',
      content: [
        'Ragione sociale: [INSERISCI_QUI_NOME_NEGOZIO]',
        'Sede legale: [INSERISCI_INDIRIZZO_COMPLETO]',
        'Partita IVA: [INSERISCI_P_IVA]',
        'Email: [INSERISCI_EMAIL_PRIVACY]',
        'PEC: [INSERISCI_EMAIL_PEC]',
      ],
    },
    {
      title: '2. Tipologie di Dati Raccolti',
      content: [
        'Dati forniti volontariamente dall\'utente: nome e cognome, indirizzo email, indirizzo di spedizione e fatturazione, numero di telefono.',
        'Dati di pagamento: elaborati esclusivamente da Stripe Payments Europe, Ltd. — il Titolare non conserva mai i dati della carta sui propri server.',
        'Dati raccolti automaticamente: indirizzo IP, tipo di browser, sistema operativo, pagine visitate, durata della sessione.',
        'Cookie tecnici (necessari al funzionamento del sito) e, previo consenso, cookie analitici per il miglioramento del servizio.',
      ],
    },
    {
      title: '3. Finalità e Basi Giuridiche del Trattamento',
      content: [
        'Esecuzione del contratto di vendita e gestione degli ordini (Art. 6(1)(b) GDPR) — base contrattuale.',
        'Adempimento di obblighi legali, fiscali e contabili (Art. 6(1)(c) GDPR) — obbligo legale.',
        'Gestione dell\'assistenza clienti, resi e rimborsi (Art. 6(1)(b) GDPR) — base contrattuale.',
        'Invio di comunicazioni di marketing e newsletter (Art. 6(1)(a) GDPR) — solo previo consenso esplicito e revocabile.',
        'Analisi statistiche aggregate per il miglioramento del servizio (Art. 6(1)(f) GDPR) — legittimo interesse, dati anonimizzati.',
      ],
    },
    {
      title: '4. Comunicazione dei Dati a Terzi',
      content: [
        'Stripe Payments Europe, Ltd. — elaborazione sicura dei pagamenti (sub-processor GDPR, conforme PCI-DSS Level 1). Privacy Policy: stripe.com/privacy.',
        'Corrieri e partner logistici — necessari per la consegna degli ordini (nome, indirizzo di spedizione, telefono).',
        'Supabase Inc. — infrastruttura cloud e database (server in EU). I dati sono trattati in conformità al GDPR tramite Data Processing Agreement.',
        'Fornitori di servizi email — per notifiche transazionali (conferma ordine, tracking, assistenza).',
        'Autorità pubbliche — esclusivamente su richiesta e nei limiti di legge.',
        'I dati non vengono mai venduti a terzi né utilizzati per profilazione commerciale senza consenso esplicito.',
      ],
    },
    {
      title: '5. Trasferimento dei Dati Extra-UE',
      content: [
        'Alcuni fornitori (es. Stripe, Supabase) potrebbero trattare dati al di fuori dello Spazio Economico Europeo (SEE).',
        'In tali casi, il trasferimento avviene nel rispetto delle garanzie previste dal GDPR: Clausole Contrattuali Standard (SCC) approvate dalla Commissione Europea, o trasferimento verso paesi riconosciuti come adeguati dalla Commissione.',
        'Per informazioni sulle garanzie specifiche adottate, è possibile scrivere a [INSERISCI_EMAIL_PRIVACY].',
      ],
    },
    {
      title: '6. Periodo di Conservazione dei Dati',
      content: [
        'Dati fiscali e di fatturazione: fino a 10 anni, in adempimento degli obblighi di legge.',
        'Dati degli ordini e dell\'account: fino alla cancellazione dell\'account su richiesta dell\'utente.',
        'Dati di marketing: fino alla revoca del consenso, con effetto immediato.',
        'Log di navigazione e dati tecnici: massimo 12 mesi.',
        'Alla scadenza del periodo di conservazione, i dati vengono cancellati o resi anonimi in modo irreversibile.',
      ],
    },
    {
      title: '7. Diritti dell\'Interessato',
      content: [
        'Diritto di accesso (Art. 15 GDPR): ottenere conferma e copia dei dati trattati.',
        'Diritto di rettifica (Art. 16 GDPR): correggere dati inesatti o incompleti.',
        'Diritto alla cancellazione / "oblio" (Art. 17 GDPR): ottenere la cancellazione dei dati, nei limiti di legge.',
        'Diritto di limitazione del trattamento (Art. 18 GDPR): richiedere la sospensione del trattamento.',
        'Diritto alla portabilità dei dati (Art. 20 GDPR): ricevere i propri dati in formato strutturato e leggibile.',
        'Diritto di opposizione (Art. 21 GDPR): opporsi al trattamento basato su legittimo interesse o a fini di marketing diretto.',
        'Diritto di revocare il consenso in qualsiasi momento, senza pregiudicare la liceità del trattamento precedente.',
        'Per esercitare i propri diritti: [INSERISCI_EMAIL_PRIVACY]. Il Titolare risponderà entro 30 giorni.',
        'In caso di risposta insoddisfacente, è possibile proporre reclamo al Garante per la Protezione dei Dati Personali (gpdp.it).',
      ],
    },
    {
      title: '8. Cookie Policy',
      content: [
        'Il sito utilizza cookie tecnici strettamente necessari al funzionamento (es. gestione sessione, carrello, preferenze lingua). Questi cookie non richiedono consenso.',
        'Con il consenso dell\'utente, possono essere attivati cookie analitici per misurare l\'utilizzo del sito in forma aggregata e anonima.',
        'Non vengono utilizzati cookie di profilazione di terze parti né pixel di tracciamento senza consenso esplicito.',
        'L\'utente può gestire, modificare o revocare le proprie preferenze cookie in qualsiasi momento tramite il pannello dedicato (icona in basso a destra) o dalle impostazioni del browser.',
        'Per ulteriori dettagli, consulta la Cookie Policy completa.',
      ],
    },
    {
      title: '9. Sicurezza dei Dati',
      content: [
        'Il Titolare adotta misure tecniche e organizzative adeguate per proteggere i dati personali da accessi non autorizzati, perdita, distruzione o divulgazione.',
        'Le comunicazioni tra il browser dell\'utente e il sito avvengono tramite protocollo HTTPS con crittografia TLS.',
        'I dati di pagamento sono gestiti esclusivamente da Stripe con crittografia end-to-end e conformità PCI-DSS.',
        'In caso di violazione dei dati (data breach) che comporti rischi per i diritti degli interessati, il Titolare notificherà le autorità competenti entro 72 ore e gli interessati senza ingiustificato ritardo.',
      ],
    },
    {
      title: '10. Modifiche alla Privacy Policy',
      content: [
        'La presente Privacy Policy può essere aggiornata per riflettere modifiche normative, tecnologiche o operative.',
        'La versione vigente è sempre quella pubblicata su questa pagina, con indicazione della data dell\'ultimo aggiornamento.',
        'In caso di modifiche sostanziali che interessino i diritti degli utenti, il Titolare provvederà a notificare gli utenti registrati via email con ragionevole anticipo.',
        'Data ultima revisione: maggio 2026.',
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// ENGLISH
// ─────────────────────────────────────────────────────────────────────────────
const en: PolicyData = {
  lastUpdated: 'May 2026',
  sections: [
    {
      title: '1. Data Controller',
      content: [
        'Business name: [INSERT_STORE_NAME_HERE]',
        'Registered address: [INSERT_FULL_ADDRESS]',
        'VAT number: [INSERT_VAT_NUMBER]',
        'Email: [INSERT_PRIVACY_EMAIL]',
        'Certified email (PEC): [INSERT_PEC_EMAIL]',
      ],
    },
    {
      title: '2. Types of Data Collected',
      content: [
        'Data provided voluntarily: first and last name, email address, shipping and billing address, phone number.',
        'Payment data: processed exclusively by Stripe Payments Europe, Ltd. — the Controller never stores card data on its own servers.',
        'Automatically collected data: IP address, browser type, operating system, pages visited, session duration.',
        'Technical cookies (necessary for the site to function) and, with consent, analytics cookies for service improvement.',
      ],
    },
    {
      title: '3. Purposes and Legal Bases of Processing',
      content: [
        'Performance of the sales contract and order management (Art. 6(1)(b) GDPR) — contractual basis.',
        'Compliance with legal, tax and accounting obligations (Art. 6(1)(c) GDPR) — legal obligation.',
        'Customer support, returns and refunds management (Art. 6(1)(b) GDPR) — contractual basis.',
        'Sending marketing communications and newsletters (Art. 6(1)(a) GDPR) — only with explicit, revocable consent.',
        'Aggregate statistical analysis for service improvement (Art. 6(1)(f) GDPR) — legitimate interest, anonymised data.',
      ],
    },
    {
      title: '4. Data Sharing with Third Parties',
      content: [
        'Stripe Payments Europe, Ltd. — secure payment processing (GDPR sub-processor, PCI-DSS Level 1 compliant). Privacy Policy: stripe.com/privacy.',
        'Carriers and logistics partners — required for order delivery (name, shipping address, phone).',
        'Supabase Inc. — cloud infrastructure and database (EU servers). Data is processed in compliance with GDPR under a Data Processing Agreement.',
        'Email service providers — for transactional notifications (order confirmation, tracking, support).',
        'Public authorities — only upon legally required request and within legal limits.',
        'Data is never sold to third parties or used for commercial profiling without explicit consent.',
      ],
    },
    {
      title: '5. International Data Transfers',
      content: [
        'Some providers (e.g. Stripe, Supabase) may process data outside the European Economic Area (EEA).',
        'In such cases, transfers take place in compliance with GDPR safeguards: Standard Contractual Clauses (SCCs) approved by the European Commission, or transfer to countries recognised as adequate by the Commission.',
        'For information on specific safeguards, please write to [INSERT_PRIVACY_EMAIL].',
      ],
    },
    {
      title: '6. Data Retention Periods',
      content: [
        'Tax and invoicing data: up to 10 years, in compliance with legal obligations.',
        'Order and account data: until account deletion upon user request.',
        'Marketing data: until consent is withdrawn, with immediate effect.',
        'Navigation logs and technical data: maximum 12 months.',
        'Upon expiry of the retention period, data is deleted or irreversibly anonymised.',
      ],
    },
    {
      title: '7. Data Subject Rights',
      content: [
        'Right of access (Art. 15 GDPR): obtain confirmation and a copy of data processed.',
        'Right to rectification (Art. 16 GDPR): correct inaccurate or incomplete data.',
        'Right to erasure / "right to be forgotten" (Art. 17 GDPR): obtain deletion of data, within legal limits.',
        'Right to restriction of processing (Art. 18 GDPR): request suspension of processing.',
        'Right to data portability (Art. 20 GDPR): receive personal data in a structured, machine-readable format.',
        'Right to object (Art. 21 GDPR): object to processing based on legitimate interest or for direct marketing purposes.',
        'Right to withdraw consent at any time, without affecting the lawfulness of prior processing.',
        'To exercise your rights: [INSERT_PRIVACY_EMAIL]. The Controller will respond within 30 days.',
        'If unsatisfied with the response, you may lodge a complaint with your national data protection authority.',
      ],
    },
    {
      title: '8. Cookie Policy',
      content: [
        'The site uses strictly necessary technical cookies for operation (e.g. session management, cart, language preferences). These cookies do not require consent.',
        'With the user\'s consent, analytics cookies may be activated to measure site usage in aggregate, anonymous form.',
        'No third-party profiling cookies or tracking pixels are used without explicit consent.',
        'Users can manage, modify or withdraw cookie preferences at any time via the dedicated panel (icon in the bottom right) or via browser settings.',
        'For further details, see the full Cookie Policy.',
      ],
    },
    {
      title: '9. Data Security',
      content: [
        'The Controller implements appropriate technical and organisational measures to protect personal data from unauthorised access, loss, destruction or disclosure.',
        'Communications between the user\'s browser and the site use the HTTPS protocol with TLS encryption.',
        'Payment data is handled exclusively by Stripe with end-to-end encryption and PCI-DSS compliance.',
        'In the event of a data breach posing risks to data subjects\' rights, the Controller will notify the competent authority within 72 hours and affected individuals without undue delay.',
      ],
    },
    {
      title: '10. Changes to this Privacy Policy',
      content: [
        'This Privacy Policy may be updated to reflect regulatory, technological or operational changes.',
        'The version in force is always the one published on this page, with the date of the last update indicated.',
        'In the event of material changes affecting users\' rights, the Controller will notify registered users by email with reasonable notice.',
        'Last revised: May 2026.',
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// ESPAÑOL
// ─────────────────────────────────────────────────────────────────────────────
const es: PolicyData = {
  lastUpdated: 'Mayo 2026',
  sections: [
    {
      title: '1. Responsable del Tratamiento',
      content: [
        'Razón social: [INSERTAR_NOMBRE_TIENDA_AQUI]',
        'Domicilio social: [INSERTAR_DIRECCIÓN_COMPLETA]',
        'NIF/CIF: [INSERTAR_NIF]',
        'Correo electrónico: [INSERTAR_EMAIL_PRIVACIDAD]',
        'Correo certificado: [INSERTAR_EMAIL_CERTIFICADO]',
      ],
    },
    {
      title: '2. Tipos de Datos Recopilados',
      content: [
        'Datos proporcionados voluntariamente: nombre y apellidos, dirección de correo electrónico, dirección de envío y facturación, número de teléfono.',
        'Datos de pago: procesados exclusivamente por Stripe Payments Europe, Ltd. — el Responsable nunca almacena datos de tarjetas en sus propios servidores.',
        'Datos recopilados automáticamente: dirección IP, tipo de navegador, sistema operativo, páginas visitadas, duración de la sesión.',
        'Cookies técnicas (necesarias para el funcionamiento del sitio) y, con consentimiento, cookies analíticas para la mejora del servicio.',
      ],
    },
    {
      title: '3. Finalidades y Bases Jurídicas del Tratamiento',
      content: [
        'Ejecución del contrato de venta y gestión de pedidos (Art. 6(1)(b) RGPD) — base contractual.',
        'Cumplimiento de obligaciones legales, fiscales y contables (Art. 6(1)(c) RGPD) — obligación legal.',
        'Gestión de la atención al cliente, devoluciones y reembolsos (Art. 6(1)(b) RGPD) — base contractual.',
        'Envío de comunicaciones de marketing y boletines (Art. 6(1)(a) RGPD) — solo con consentimiento explícito y revocable.',
        'Análisis estadísticos agregados para la mejora del servicio (Art. 6(1)(f) RGPD) — interés legítimo, datos anonimizados.',
      ],
    },
    {
      title: '4. Comunicación de Datos a Terceros',
      content: [
        'Stripe Payments Europe, Ltd. — procesamiento seguro de pagos (sub-encargado RGPD, conforme PCI-DSS Nivel 1). Política de privacidad: stripe.com/privacy.',
        'Transportistas y socios logísticos — necesarios para la entrega de pedidos (nombre, dirección de envío, teléfono).',
        'Supabase Inc. — infraestructura cloud y base de datos (servidores en UE). Los datos se tratan conforme al RGPD mediante Acuerdo de Tratamiento de Datos.',
        'Proveedores de servicios de correo electrónico — para notificaciones transaccionales (confirmación de pedido, seguimiento, soporte).',
        'Autoridades públicas — únicamente cuando sea legalmente requerido y dentro de los límites legales.',
        'Los datos no se venden nunca a terceros ni se utilizan para elaboración de perfiles comerciales sin consentimiento explícito.',
      ],
    },
    {
      title: '5. Transferencias Internacionales de Datos',
      content: [
        'Algunos proveedores (p. ej. Stripe, Supabase) pueden tratar datos fuera del Espacio Económico Europeo (EEE).',
        'En tales casos, las transferencias se realizan conforme a las garantías del RGPD: Cláusulas Contractuales Estándar (CCE) aprobadas por la Comisión Europea, o transferencia a países reconocidos como adecuados por la Comisión.',
        'Para información sobre las garantías específicas adoptadas, escribir a [INSERTAR_EMAIL_PRIVACIDAD].',
      ],
    },
    {
      title: '6. Períodos de Conservación de los Datos',
      content: [
        'Datos fiscales y de facturación: hasta 10 años, en cumplimiento de las obligaciones legales.',
        'Datos de pedidos y cuenta: hasta la eliminación de la cuenta a petición del usuario.',
        'Datos de marketing: hasta la retirada del consentimiento, con efecto inmediato.',
        'Registros de navegación y datos técnicos: máximo 12 meses.',
        'Al vencimiento del período de conservación, los datos se eliminan o se anonimizan de forma irreversible.',
      ],
    },
    {
      title: '7. Derechos del Interesado',
      content: [
        'Derecho de acceso (Art. 15 RGPD): obtener confirmación y copia de los datos tratados.',
        'Derecho de rectificación (Art. 16 RGPD): corregir datos inexactos o incompletos.',
        'Derecho de supresión / "derecho al olvido" (Art. 17 RGPD): obtener la eliminación de los datos, dentro de los límites legales.',
        'Derecho a la limitación del tratamiento (Art. 18 RGPD): solicitar la suspensión del tratamiento.',
        'Derecho a la portabilidad de los datos (Art. 20 RGPD): recibir los datos personales en un formato estructurado y legible.',
        'Derecho de oposición (Art. 21 RGPD): oponerse al tratamiento basado en interés legítimo o con fines de marketing directo.',
        'Derecho a retirar el consentimiento en cualquier momento, sin afectar a la licitud del tratamiento anterior.',
        'Para ejercer los derechos: [INSERTAR_EMAIL_PRIVACIDAD]. El Responsable responderá en un plazo de 30 días.',
        'En caso de respuesta insatisfactoria, se puede presentar una reclamación ante la AEPD (aepd.es).',
      ],
    },
    {
      title: '8. Política de Cookies',
      content: [
        'El sitio utiliza cookies técnicas estrictamente necesarias para el funcionamiento (p. ej. gestión de sesión, carrito, preferencias de idioma). Estas cookies no requieren consentimiento.',
        'Con el consentimiento del usuario, pueden activarse cookies analíticas para medir el uso del sitio de forma agregada y anónima.',
        'No se utilizan cookies de elaboración de perfiles de terceros ni píxeles de seguimiento sin consentimiento explícito.',
        'El usuario puede gestionar, modificar o revocar sus preferencias de cookies en cualquier momento a través del panel dedicado (icono en la parte inferior derecha) o desde la configuración del navegador.',
        'Para más detalles, consulte la Política de Cookies completa.',
      ],
    },
    {
      title: '9. Seguridad de los Datos',
      content: [
        'El Responsable adopta medidas técnicas y organizativas adecuadas para proteger los datos personales frente a accesos no autorizados, pérdida, destrucción o divulgación.',
        'Las comunicaciones entre el navegador del usuario y el sitio utilizan el protocolo HTTPS con cifrado TLS.',
        'Los datos de pago son gestionados exclusivamente por Stripe con cifrado de extremo a extremo y conformidad PCI-DSS.',
        'En caso de violación de datos que implique riesgos para los derechos de los interesados, el Responsable notificará a las autoridades competentes en un plazo de 72 horas y a los interesados sin demora injustificada.',
      ],
    },
    {
      title: '10. Modificaciones de la Política de Privacidad',
      content: [
        'La presente Política de Privacidad puede actualizarse para reflejar cambios normativos, tecnológicos u operativos.',
        'La versión vigente es siempre la publicada en esta página, con indicación de la fecha de la última actualización.',
        'En caso de cambios sustanciales que afecten a los derechos de los usuarios, el Responsable notificará a los usuarios registrados por correo electrónico con antelación razonable.',
        'Última revisión: mayo 2026.',
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// FRANÇAIS
// ─────────────────────────────────────────────────────────────────────────────
const fr: PolicyData = {
  lastUpdated: 'Mai 2026',
  sections: [
    {
      title: '1. Responsable du Traitement',
      content: [
        'Raison sociale : [INSÉRER_NOM_BOUTIQUE_ICI]',
        'Siège social : [INSÉRER_ADRESSE_COMPLÈTE]',
        'Numéro TVA : [INSÉRER_NUMÉRO_TVA]',
        'Courriel : [INSÉRER_EMAIL_CONFIDENTIALITÉ]',
        'Courriel certifié : [INSÉRER_EMAIL_CERTIFIÉ]',
      ],
    },
    {
      title: '2. Types de Données Collectées',
      content: [
        'Données fournies volontairement : nom et prénom, adresse e-mail, adresse de livraison et de facturation, numéro de téléphone.',
        'Données de paiement : traitées exclusivement par Stripe Payments Europe, Ltd. — le Responsable ne stocke jamais les données de carte sur ses propres serveurs.',
        'Données collectées automatiquement : adresse IP, type de navigateur, système d\'exploitation, pages visitées, durée de session.',
        'Cookies techniques (nécessaires au fonctionnement du site) et, avec consentement, cookies analytiques pour l\'amélioration du service.',
      ],
    },
    {
      title: '3. Finalités et Bases Juridiques du Traitement',
      content: [
        'Exécution du contrat de vente et gestion des commandes (Art. 6(1)(b) RGPD) — base contractuelle.',
        'Respect des obligations légales, fiscales et comptables (Art. 6(1)(c) RGPD) — obligation légale.',
        'Gestion du support client, des retours et des remboursements (Art. 6(1)(b) RGPD) — base contractuelle.',
        'Envoi de communications marketing et de newsletters (Art. 6(1)(a) RGPD) — uniquement avec consentement explicite et révocable.',
        'Analyses statistiques agrégées pour l\'amélioration du service (Art. 6(1)(f) RGPD) — intérêt légitime, données anonymisées.',
      ],
    },
    {
      title: '4. Communication des Données à des Tiers',
      content: [
        'Stripe Payments Europe, Ltd. — traitement sécurisé des paiements (sous-traitant RGPD, conforme PCI-DSS Niveau 1). Politique de confidentialité : stripe.com/privacy.',
        'Transporteurs et partenaires logistiques — nécessaires pour la livraison des commandes (nom, adresse de livraison, téléphone).',
        'Supabase Inc. — infrastructure cloud et base de données (serveurs en UE). Les données sont traitées conformément au RGPD dans le cadre d\'un Accord de Traitement des Données.',
        'Prestataires de services de messagerie — pour les notifications transactionnelles (confirmation de commande, suivi, support).',
        'Autorités publiques — uniquement sur demande légalement requise et dans les limites légales.',
        'Les données ne sont jamais vendues à des tiers ni utilisées pour du profilage commercial sans consentement explicite.',
      ],
    },
    {
      title: '5. Transferts Internationaux de Données',
      content: [
        'Certains prestataires (ex. Stripe, Supabase) peuvent traiter des données en dehors de l\'Espace Économique Européen (EEE).',
        'Dans ce cas, les transferts s\'effectuent conformément aux garanties du RGPD : Clauses Contractuelles Types (CCT) approuvées par la Commission européenne, ou transfert vers des pays reconnus comme adéquats.',
        'Pour des informations sur les garanties spécifiques adoptées, écrire à [INSÉRER_EMAIL_CONFIDENTIALITÉ].',
      ],
    },
    {
      title: '6. Durées de Conservation des Données',
      content: [
        'Données fiscales et de facturation : jusqu\'à 10 ans, conformément aux obligations légales.',
        'Données de commandes et de compte : jusqu\'à la suppression du compte à la demande de l\'utilisateur.',
        'Données marketing : jusqu\'au retrait du consentement, avec effet immédiat.',
        'Journaux de navigation et données techniques : 12 mois maximum.',
        'À l\'expiration de la période de conservation, les données sont supprimées ou anonymisées de manière irréversible.',
      ],
    },
    {
      title: '7. Droits des Personnes Concernées',
      content: [
        'Droit d\'accès (Art. 15 RGPD) : obtenir confirmation et copie des données traitées.',
        'Droit de rectification (Art. 16 RGPD) : corriger les données inexactes ou incomplètes.',
        'Droit à l\'effacement / « droit à l\'oubli » (Art. 17 RGPD) : obtenir la suppression des données, dans les limites légales.',
        'Droit à la limitation du traitement (Art. 18 RGPD) : demander la suspension du traitement.',
        'Droit à la portabilité des données (Art. 20 RGPD) : recevoir ses données dans un format structuré et lisible.',
        'Droit d\'opposition (Art. 21 RGPD) : s\'opposer au traitement fondé sur l\'intérêt légitime ou à des fins de marketing direct.',
        'Droit de retirer son consentement à tout moment, sans affecter la licéité du traitement antérieur.',
        'Pour exercer ces droits : [INSÉRER_EMAIL_CONFIDENTIALITÉ]. Le Responsable répondra dans un délai de 30 jours.',
        'En cas de réponse insatisfaisante, une réclamation peut être déposée auprès de la CNIL (cnil.fr).',
      ],
    },
    {
      title: '8. Politique de Cookies',
      content: [
        'Le site utilise des cookies techniques strictement nécessaires au fonctionnement (ex. gestion de session, panier, préférences linguistiques). Ces cookies ne nécessitent pas de consentement.',
        'Avec le consentement de l\'utilisateur, des cookies analytiques peuvent être activés pour mesurer l\'utilisation du site de manière agrégée et anonyme.',
        'Aucun cookie de profilage tiers ni pixel de suivi n\'est utilisé sans consentement explicite.',
        'L\'utilisateur peut gérer, modifier ou révoquer ses préférences de cookies à tout moment via le panneau dédié (icône en bas à droite) ou via les paramètres du navigateur.',
        'Pour plus de détails, consultez la Politique de Cookies complète.',
      ],
    },
    {
      title: '9. Sécurité des Données',
      content: [
        'Le Responsable met en œuvre des mesures techniques et organisationnelles appropriées pour protéger les données personnelles contre tout accès non autorisé, perte, destruction ou divulgation.',
        'Les communications entre le navigateur de l\'utilisateur et le site utilisent le protocole HTTPS avec chiffrement TLS.',
        'Les données de paiement sont gérées exclusivement par Stripe avec chiffrement de bout en bout et conformité PCI-DSS.',
        'En cas de violation de données présentant des risques pour les droits des personnes concernées, le Responsable notifiera les autorités compétentes dans les 72 heures et les personnes concernées sans délai injustifié.',
      ],
    },
    {
      title: '10. Modifications de la Politique de Confidentialité',
      content: [
        'La présente Politique de Confidentialité peut être mise à jour pour refléter des changements réglementaires, technologiques ou opérationnels.',
        'La version en vigueur est toujours celle publiée sur cette page, avec indication de la date de la dernière mise à jour.',
        'En cas de modifications substantielles affectant les droits des utilisateurs, le Responsable notifiera les utilisateurs inscrits par e-mail avec un préavis raisonnable.',
        'Dernière révision : mai 2026.',
      ],
    },
  ],
};

export const privacyContent: Record<AppLanguageCode, PolicyData> = { it, en, es, fr };
