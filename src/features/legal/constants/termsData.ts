import type { AppLanguageCode } from '../../../store/preferencesStore';

export interface TermsSection {
  title: string;
  content: string[];
}

export interface TermsData {
  lastUpdated: string;
  sections: TermsSection[];
}

// ─────────────────────────────────────────────────────────────────────────────
// ITALIANO
// ─────────────────────────────────────────────────────────────────────────────
const it: TermsData = {
  lastUpdated: 'Maggio 2026',
  sections: [
    {
      title: '1. Dati del Venditore',
      content: [
        'Ragione sociale: [INSERISCI_QUI_NOME_NEGOZIO]',
        'Forma giuridica: [INSERISCI_FORMA_GIURIDICA — es. Ditta individuale / S.r.l.]',
        'Sede legale: [INSERISCI_INDIRIZZO_COMPLETO]',
        'Partita IVA / Codice Fiscale: [INSERISCI_P_IVA]',
        'Registro Imprese: [INSERISCI_N_ISCRIZIONE_REGISTRO_IMPRESE]',
        'PEC (domicilio digitale): [INSERISCI_EMAIL_PEC]',
        'Email di contatto: [INSERISCI_EMAIL_CONTATTO]',
        'Telefono: [INSERISCI_NUMERO_TELEFONO]',
      ],
    },
    {
      title: '2. Oggetto e Ambito di Applicazione',
      content: [
        'Le presenti Condizioni Generali di Vendita ("Termini") disciplinano tutti i contratti di acquisto conclusi tramite il sito [INSERISCI_QUI_NOME_NEGOZIO] tra il Venditore e qualsiasi consumatore (persona fisica che acquista per scopi estranei all\'attività imprenditoriale).',
        'I presenti Termini si applicano ai consumatori residenti in Italia, Spagna e Francia. Per ciascun consumatore prevalgono, in ogni caso, i diritti inalienabili previsti dalla legge imperativa del proprio paese di residenza.',
        'Per completare un ordine è necessario accettare i presenti Termini. L\'acquisto implica la piena accettazione di tutte le clausole qui contenute.',
        'Aggiornamento: i presenti Termini possono essere modificati. La versione vigente è sempre quella pubblicata sul sito. Le modifiche non si applicano agli ordini già confermati.',
      ],
    },
    {
      title: '3. Prodotti e Descrizione',
      content: [
        'Il Venditore si impegna a fornire descrizioni accurate e complete di tutti i prodotti, incluse caratteristiche, materiali, dimensioni, peso e funzionalità.',
        'Le immagini dei prodotti sono puramente illustrative e potrebbero differire leggermente dalla realtà (colori, proporzioni) a causa delle variazioni dei monitor. Tale scostamento non costituisce difetto di conformità.',
        'La disponibilità dei prodotti è verificata al momento dell\'ordine. In caso di esaurimento scorte successivo alla conferma d\'ordine, il Venditore notificherà il cliente entro 48 ore proponendo: (a) rimborso integrale entro 14 giorni, oppure (b) attesa della nuova disponibilità previo accordo.',
        'Tutti i prodotti rispettano i requisiti di sicurezza previsti dal Regolamento UE 2023/988 (GPSR — General Product Safety Regulation, vigore 13 dicembre 2024). La documentazione di sicurezza è disponibile su richiesta.',
      ],
    },
    {
      title: '4. Prezzi e Modalità di Pagamento',
      content: [
        'Tutti i prezzi sono espressi in Euro (€) e includono l\'IVA applicabile.',
        'In caso di promozioni o sconti, il prezzo scontato è accompagnato dal prezzo più basso praticato negli ultimi 30 giorni precedenti alla promozione, in conformità al D.Lgs. 26/2023 (recepimento Direttiva Omnibus 2019/2161).',
        'I pagamenti vengono elaborati in modo sicuro da Stripe Payments Europe, Ltd. I dati della carta di credito/debito non vengono mai conservati sui server del Venditore. Stripe è conforme allo standard PCI-DSS Level 1.',
        'Stripe agisce come sub-processor GDPR in forza di un Data Processing Agreement. Per maggiori informazioni: stripe.com/privacy.',
        'Il pagamento avviene al momento della conferma dell\'ordine. In caso di pagamento rifiutato, l\'ordine non viene processato e il cliente riceve immediata notifica.',
        'Una pre-autorizzazione (blocco temporaneo dell\'importo) potrebbe essere attivata da Stripe e rilasciata entro 3-5 giorni lavorativi se l\'ordine non viene completato.',
      ],
    },
    {
      title: '5. Consegna e Spedizione',
      content: [
        'Il Venditore si impegna a consegnare i prodotti entro 30 giorni dalla data di conferma dell\'ordine, salvo cause di forza maggiore o eventi eccezionali comunicati tempestivamente.',
        'I tempi di consegna stimati sono indicati nella scheda prodotto e nell\'email di conferma ordine. Tali tempi sono indicativi e non costituiscono termine essenziale, salvo diverso accordo scritto.',
        'Il rischio di perdita o danneggiamento del bene si trasferisce al consumatore esclusivamente al momento della consegna fisica. Durante il trasporto, il Venditore rimane responsabile per eventuali danni o smarrimenti.',
        'In caso di mancata consegna entro il termine, il consumatore può intimare al Venditore di effettuare la consegna entro un termine supplementare ragionevole. Se la consegna non avviene entro tale termine, il consumatore ha diritto alla risoluzione del contratto e al rimborso integrale.',
        'Un numero di tracciamento sarà fornito via email non appena il pacco viene affidato al corriere.',
        'Le spedizioni sono effettuate verso i paesi dell\'Unione Europea. Non è possibile consegnare a caselle postali (P.O. Box).',
      ],
    },
    {
      title: '6. Diritto di Recesso (14 Giorni)',
      content: [
        'Il consumatore ha il diritto di recedere dal contratto entro 14 giorni dalla data di consegna fisica del bene, senza indicarne la ragione e senza dover sostenere costi diversi da quelli indicati di seguito (Art. 52–62 D.Lgs. 206/2005).',
        'Per esercitare il diritto di recesso, il consumatore deve inviare una dichiarazione inequivoca via email a [INSERISCI_EMAIL_CONTATTO] entro il termine di 14 giorni. È possibile utilizzare il modulo di recesso standard allegato al presente documento, ma non è obbligatorio.',
        'Il consumatore deve restituire il prodotto entro 14 giorni dalla comunicazione del recesso, in condizioni integre e nell\'imballaggio originale ove possibile.',
        'Le spese di restituzione sono a carico del consumatore, salvo che il Venditore non abbia omesso di informarlo di tale obbligo.',
        'Il rimborso, comprensivo del prezzo del prodotto e delle spese di spedizione standard originali, verrà effettuato entro 14 giorni dal ricevimento del reso o dalla prova di avvenuta spedizione, utilizzando lo stesso mezzo di pagamento.',
        'Il diritto di recesso NON si applica a: beni personalizzati o realizzati su misura; beni deperibili; contenuti digitali forniti su supporto non materiale con consenso esplicito prima della scadenza del termine; beni sigillati che non possono essere restituiti per motivi igienici dopo l\'apertura.',
        'ATTENZIONE: se il Venditore non fornisce le informazioni sul diritto di recesso, il termine si estende automaticamente a 12 mesi (Art. 53 D.Lgs. 206/2005).',
      ],
    },
    {
      title: '7. Conformità dei Beni e Garanzia Legale (2 Anni)',
      content: [
        'Il Venditore è responsabile dei difetti di conformità dei beni venduti ai sensi degli artt. 128–135 del D.Lgs. 206/2005, come modificati dal D.Lgs. 170/2021 (recepimento Direttiva UE 2019/771).',
        'La garanzia legale di conformità ha durata di 2 (due) anni dalla data di consegna del bene. Questa garanzia non è escludibile né limitabile nei confronti del consumatore.',
        'Il bene è conforme al contratto se: corrisponde alla descrizione, al tipo, alla quantità e alla qualità indicate; è idoneo all\'uso normale; possiede le qualità e le prestazioni ordinarie di beni dello stesso tipo.',
        'Entro 12 mesi dalla consegna, si presume che il difetto di conformità esistesse già al momento della consegna, con inversione dell\'onere della prova a favore del consumatore. Dopo 12 mesi, spetta al consumatore provare la preesistenza del difetto.',
        'In caso di difetto di conformità, il consumatore ha diritto, a sua scelta: (a) alla riparazione gratuita; (b) alla sostituzione; (c) alla riduzione proporzionale del prezzo; (d) alla risoluzione del contratto con rimborso integrale.',
        'La garanzia non copre: danni da uso improprio; usura normale; danni accidentali o dolosi verificatisi dopo la consegna.',
        'Per esercitare la garanzia, contattare [INSERISCI_EMAIL_CONTATTO] con descrizione del difetto e, se possibile, documentazione fotografica.',
      ],
    },
    {
      title: '8. Privacy e Protezione dei Dati (GDPR)',
      content: [
        'Il trattamento dei dati personali del consumatore avviene nel rispetto del Regolamento UE 2016/679 (GDPR) e del D.Lgs. 196/2003 (Codice Privacy italiano).',
        'I dati raccolti (nome, email, indirizzo, dati di pagamento) sono trattati per: esecuzione del contratto (Art. 6(1)(b) GDPR); adempimento di obblighi legali (Art. 6(1)(c) GDPR); invio di comunicazioni marketing solo previo consenso esplicito (Art. 6(1)(a) GDPR).',
        'I dati di pagamento sono trattati esclusivamente da Stripe, in qualità di sub-processor, in forza di un Data Processing Agreement. Il Venditore non conserva i dati della carta sui propri server.',
        'I dati fiscali e di fatturazione sono conservati per un periodo fino a 10 anni in adempimento degli obblighi fiscali. I dati account sono conservati fino alla cancellazione richiesta dall\'utente.',
        'Il consumatore ha diritto di accesso, rettifica, cancellazione, limitazione, portabilità e opposizione al trattamento. Per esercitare tali diritti: [INSERISCI_EMAIL_PRIVACY].',
        'In caso di reclamo relativo al trattamento dei dati: Garante per la Protezione dei Dati Personali — gpdp.it.',
        'Ulteriori dettagli sono disponibili nella Privacy Policy integrale del sito.',
      ],
    },
    {
      title: '9. Sicurezza dei Prodotti (GPSR)',
      content: [
        'Tutti i prodotti venduti sono conformi ai requisiti del Regolamento UE 2023/988 sulla sicurezza generale dei prodotti (GPSR), in vigore dal 13 dicembre 2024.',
        'Il Venditore garantisce che i prodotti immessi sul mercato siano sicuri e conformi alle normative applicabili (marcatura CE ove richiesta, standard EN pertinenti).',
        'Il responsabile della conformità dei prodotti nell\'Unione Europea è: [INSERISCI_NOME_RESPONSABILE_CONFORMITA] — [INSERISCI_EMAIL_RESPONSABILE].',
        'In caso di identificazione di un rischio per la sicurezza, il Venditore informerà tempestivamente i consumatori acquirenti e adotterà le misure previste dalla legge (ritiro, richiamo, comunicazione alle autorità competenti tramite Safety Gate Business).',
        'La documentazione di sicurezza dei prodotti (certificati, schede tecniche, manuali) è disponibile su richiesta scrivendo a [INSERISCI_EMAIL_CONTATTO].',
      ],
    },
    {
      title: '10. Limitazioni di Responsabilità',
      content: [
        'Fatta salva ogni responsabilità inderogabile per legge (garanzia legale, diritto di recesso, morte o lesioni personali da negligenza), la responsabilità del Venditore è limitata al valore del prodotto acquistato.',
        'Il Venditore non è responsabile per: ritardi imputabili a eventi di forza maggiore (calamità naturali, scioperi, provvedimenti governativi); ritardi del corriere terzo che non superino i 30 giorni complessivi dalla conferma ordine; danni indiretti o consequenziali non prevedibili al momento della conclusione del contratto.',
        'Le seguenti limitazioni sono NULLE per legge e non si applicano: esclusione della garanzia legale di 2 anni; limitazione del diritto di recesso di 14 giorni; esclusione della responsabilità per morte o lesioni personali da negligenza; arbitrato obbligatorio che esclude l\'accesso al giudice ordinario.',
      ],
    },
    {
      title: '11. Reclami e Risoluzione delle Controversie',
      content: [
        'Per qualsiasi reclamo, il consumatore può contattare il Venditore a: [INSERISCI_EMAIL_CONTATTO]. Il Venditore risponderà entro 30 giorni lavorativi.',
        'In caso di mancata risoluzione amichevole, il consumatore può ricorrere alla mediazione ai sensi del D.Lgs. 28/2010 o ad altri strumenti di risoluzione alternativa delle controversie (ADR) disponibili nel proprio paese.',
        'Il foro competente per le controversie con il consumatore è quello del luogo di residenza o domicilio del consumatore (Art. 65 D.Lgs. 206/2005). Il consumatore ha sempre il diritto di adire il giudice ordinario.',
        'NOTA: La piattaforma ODR (Online Dispute Resolution) della Commissione Europea non è più disponibile dal 20 marzo 2025.',
        'Per i consumatori spagnoli si applicano altresì le disposizioni del Real Decreto Legislativo 1/2007. Per i consumatori francesi si applicano le disposizioni del Code de la Consommation.',
      ],
    },
    {
      title: '12. Disposizioni Finali',
      content: [
        'I presenti Termini sono soggetti alla legge italiana. Per i consumatori residenti in altri stati UE, le norme imperative della loro legge nazionale prevalgono sulle presenti condizioni.',
        'Il presente documento è disponibile in italiano (versione prevalente), inglese, spagnolo e francese. In caso di discrepanze tra le versioni, prevale la versione italiana.',
        'Data di entrata in vigore: maggio 2026.',
        'Se una clausola dei presenti Termini è dichiarata invalida, le restanti clausole rimangono pienamente efficaci.',
        'I presenti Termini sostituiscono integralmente qualsiasi versione precedente e si applicano a tutti gli ordini effettuati a partire dalla data di vigenza.',
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// ENGLISH
// ─────────────────────────────────────────────────────────────────────────────
const en: TermsData = {
  lastUpdated: 'May 2026',
  sections: [
    {
      title: '1. Seller Information',
      content: [
        'Business name: [INSERT_STORE_NAME_HERE]',
        'Legal form: [INSERT_LEGAL_FORM — e.g. Sole trader / Ltd]',
        'Registered address: [INSERT_FULL_ADDRESS]',
        'VAT number: [INSERT_VAT_NUMBER]',
        'Companies register: [INSERT_COMPANIES_REGISTER_NUMBER]',
        'Certified email (PEC): [INSERT_PEC_EMAIL]',
        'Contact email: [INSERT_CONTACT_EMAIL]',
        'Phone: [INSERT_PHONE_NUMBER]',
      ],
    },
    {
      title: '2. Scope and Application',
      content: [
        'These General Terms and Conditions of Sale ("Terms") govern all purchase contracts concluded through [INSERT_STORE_NAME_HERE] between the Seller and any consumer (an individual purchasing for purposes outside their trade, business, craft or profession).',
        'These Terms apply to consumers residing in Italy, Spain and France. The mandatory consumer protection laws of the consumer\'s country of residence always prevail over these Terms where more protective.',
        'Completing an order requires acceptance of these Terms. Placing an order implies full acceptance of all clauses contained herein.',
        'These Terms may be updated. The version in force is always the one published on the website. Amendments do not apply to orders already confirmed.',
      ],
    },
    {
      title: '3. Products and Description',
      content: [
        'The Seller undertakes to provide accurate and complete descriptions of all products, including characteristics, materials, dimensions, weight and functionality.',
        'Product images are for illustrative purposes only and may slightly differ from the actual product (colours, proportions) due to monitor variations. Such differences do not constitute a lack of conformity.',
        'Product availability is verified at the time of ordering. If stock runs out after order confirmation, the Seller will notify the customer within 48 hours and offer: (a) a full refund within 14 days, or (b) waiting for restocking, subject to mutual agreement.',
        'All products comply with the safety requirements of Regulation (EU) 2023/988 (GPSR — General Product Safety Regulation, effective 13 December 2024). Safety documentation is available upon request.',
      ],
    },
    {
      title: '4. Prices and Payment',
      content: [
        'All prices are expressed in Euros (€) and include applicable VAT.',
        'For promotions or discounts, the discounted price is displayed alongside the lowest price applied during the 30 days preceding the promotion, in accordance with Directive 2019/2161 (Omnibus).',
        'Payments are processed securely by Stripe Payments Europe, Ltd. Card data is never stored on the Seller\'s servers. Stripe is PCI-DSS Level 1 compliant.',
        'Stripe acts as a GDPR sub-processor under a Data Processing Agreement. For more information: stripe.com/privacy.',
        'Payment occurs at the time of order confirmation. If payment is declined, the order is not processed and the customer receives immediate notification.',
        'A pre-authorisation (temporary hold on funds) may be placed by Stripe and released within 3–5 business days if the order is not completed.',
      ],
    },
    {
      title: '5. Delivery and Shipping',
      content: [
        'The Seller undertakes to deliver products within 30 days of order confirmation, unless force majeure or exceptional circumstances are communicated promptly.',
        'Estimated delivery times are indicated on the product page and in the order confirmation email. These are estimates and do not constitute essential deadlines unless separately agreed in writing.',
        'The risk of loss or damage to goods transfers to the consumer only at the moment of physical delivery. During transit, the Seller remains responsible for any loss or damage.',
        'If the deadline is missed, the consumer may instruct the Seller to deliver within a reasonable additional period. If delivery still does not occur, the consumer is entitled to cancel the contract and receive a full refund.',
        'A tracking number will be provided by email as soon as the parcel is handed over to the carrier.',
        'Deliveries are made within the European Union. Delivery to P.O. boxes is not accepted.',
      ],
    },
    {
      title: '6. Right of Withdrawal (14 Days)',
      content: [
        'The consumer has the right to withdraw from the contract within 14 days of physical delivery, without giving any reason and without incurring costs other than those specified below (Consumer Rights Directive 2011/83/EU, transposed into national law).',
        'To exercise the right of withdrawal, the consumer must send an unambiguous declaration by email to [INSERT_CONTACT_EMAIL] within the 14-day period. The standard withdrawal form appended to these Terms may be used but is not mandatory.',
        'The consumer must return the product within 14 days of communicating withdrawal, in intact condition and in the original packaging where possible.',
        'Return shipping costs are borne by the consumer, unless the Seller failed to inform the consumer of this obligation.',
        'The refund, including the product price and the original standard shipping costs, will be issued within 14 days of receiving the return or proof of shipment, using the same payment method.',
        'The right of withdrawal does NOT apply to: personalised or custom-made goods; perishable goods; digital content provided on a non-tangible medium with the consumer\'s prior consent before the deadline; sealed goods that cannot be returned for hygiene reasons after opening.',
        'WARNING: if the Seller fails to provide information on the right of withdrawal, the period extends automatically to 12 months.',
      ],
    },
    {
      title: '7. Conformity and Legal Warranty (2 Years)',
      content: [
        'The Seller is liable for any lack of conformity of goods sold under Directive 2019/771/EU (Sale of Goods Directive), as transposed into national law.',
        'The legal conformity warranty lasts 2 (two) years from the date of delivery. This warranty cannot be excluded or limited in relation to consumers.',
        'Goods conform to the contract if they match the description, type, quantity and quality specified; are fit for normal use; and possess the ordinary qualities and performance of goods of the same type.',
        'Within 12 months of delivery, any lack of conformity is presumed to have existed at the time of delivery (reversed burden of proof). After 12 months, the consumer must prove the defect was pre-existing.',
        'In case of lack of conformity, the consumer is entitled to: (a) free repair; (b) replacement; (c) proportionate price reduction; (d) termination of contract with full refund.',
        'The warranty does not cover: damage from misuse; normal wear and tear; accidental or intentional damage occurring after delivery.',
        'To exercise the warranty, contact [INSERT_CONTACT_EMAIL] with a description of the defect and, if possible, photographic evidence.',
      ],
    },
    {
      title: '8. Privacy and Data Protection (GDPR)',
      content: [
        'Personal data is processed in compliance with Regulation (EU) 2016/679 (GDPR).',
        'Data collected (name, email, address, payment data) is processed for: contract performance (Art. 6(1)(b) GDPR); legal obligations (Art. 6(1)(c) GDPR); marketing communications only with explicit consent (Art. 6(1)(a) GDPR).',
        'Payment data is processed exclusively by Stripe as a sub-processor under a Data Processing Agreement. The Seller does not store card data on its servers.',
        'Tax and invoicing data is retained for up to 10 years. Account data is retained until deletion is requested by the user.',
        'The consumer has rights of access, rectification, erasure, restriction, portability and objection. To exercise these rights: [INSERT_PRIVACY_EMAIL].',
        'For complaints regarding data processing, contact the relevant national data protection authority.',
        'Full details are available in the site\'s Privacy Policy.',
      ],
    },
    {
      title: '9. Product Safety (GPSR)',
      content: [
        'All products sold comply with Regulation (EU) 2023/988 on general product safety (GPSR), effective 13 December 2024.',
        'The Seller ensures that products placed on the market are safe and compliant with applicable regulations (CE marking where required, relevant EN standards).',
        'The EU responsible person for product compliance is: [INSERT_COMPLIANCE_OFFICER_NAME] — [INSERT_COMPLIANCE_EMAIL].',
        'If a safety risk is identified, the Seller will promptly inform affected consumers and take the measures required by law (withdrawal, recall, notification to competent authorities via Safety Gate Business).',
        'Safety documentation (certificates, datasheets, manuals) is available upon request at [INSERT_CONTACT_EMAIL].',
      ],
    },
    {
      title: '10. Limitation of Liability',
      content: [
        'Subject to any non-excludable statutory liability (legal warranty, right of withdrawal, death or personal injury from negligence), the Seller\'s liability is limited to the value of the purchased product.',
        'The Seller is not liable for: delays caused by force majeure events (natural disasters, strikes, government measures); third-party carrier delays not exceeding 30 days total from order confirmation; indirect or consequential damages not foreseeable at contract formation.',
        'The following limitations are VOID by law and do not apply: exclusion of the 2-year legal warranty; limitation of the 14-day right of withdrawal; exclusion of liability for death or personal injury from negligence; mandatory arbitration excluding access to ordinary courts.',
      ],
    },
    {
      title: '11. Complaints and Dispute Resolution',
      content: [
        'For any complaint, the consumer may contact the Seller at: [INSERT_CONTACT_EMAIL]. The Seller will respond within 30 business days.',
        'If amicable resolution fails, the consumer may resort to mediation or other Alternative Dispute Resolution (ADR) mechanisms available in their country.',
        'The competent court for consumer disputes is that of the consumer\'s place of residence or domicile. The consumer always has the right to bring proceedings before ordinary courts.',
        'NOTE: The EU Online Dispute Resolution (ODR) platform has been unavailable since 20 March 2025 and is no longer required.',
        'For Spanish consumers, Real Decreto Legislativo 1/2007 also applies. For French consumers, the Code de la Consommation also applies.',
      ],
    },
    {
      title: '12. General Provisions',
      content: [
        'These Terms are governed by Italian law. For consumers residing in other EU Member States, the mandatory provisions of their national law prevail.',
        'This document is available in Italian (prevailing version), English, Spanish and French. In case of discrepancies between versions, the Italian version prevails.',
        'Effective date: May 2026.',
        'If any clause of these Terms is declared invalid, the remaining clauses remain fully effective.',
        'These Terms supersede all previous versions and apply to all orders placed from the effective date.',
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// ESPAÑOL
// ─────────────────────────────────────────────────────────────────────────────
const es: TermsData = {
  lastUpdated: 'Mayo 2026',
  sections: [
    {
      title: '1. Datos del Vendedor',
      content: [
        'Razón social: [INSERTAR_NOMBRE_TIENDA_AQUI]',
        'Forma jurídica: [INSERTAR_FORMA_JURIDICA — ej. Autónomo / S.L.]',
        'Domicilio social: [INSERTAR_DIRECCION_COMPLETA]',
        'NIF / CIF: [INSERTAR_NIF]',
        'Registro mercantil: [INSERTAR_NUMERO_REGISTRO_MERCANTIL]',
        'Correo certificado: [INSERTAR_CORREO_CERTIFICADO]',
        'Correo electrónico de contacto: [INSERTAR_CORREO_CONTACTO]',
        'Teléfono: [INSERTAR_NUMERO_TELEFONO]',
      ],
    },
    {
      title: '2. Objeto y Ámbito de Aplicación',
      content: [
        'Las presentes Condiciones Generales de Venta ("Condiciones") regulan todos los contratos de compra celebrados a través de [INSERTAR_NOMBRE_TIENDA_AQUI] entre el Vendedor y cualquier consumidor (persona física que actúa con fines ajenos a su actividad comercial).',
        'Estas Condiciones se aplican a consumidores residentes en Italia, España y Francia. En todo caso, prevalecen los derechos irrenunciables previstos por la ley imperativa del país de residencia del consumidor.',
        'Para completar un pedido es necesario aceptar las presentes Condiciones. Realizar un pedido implica la aceptación plena de todas las cláusulas aquí contenidas.',
        'Estas Condiciones pueden ser modificadas. La versión vigente es siempre la publicada en el sitio web. Las modificaciones no se aplican a los pedidos ya confirmados.',
      ],
    },
    {
      title: '3. Productos y Descripción',
      content: [
        'El Vendedor se compromete a proporcionar descripciones precisas y completas de todos los productos, incluyendo características, materiales, dimensiones, peso y funcionalidades.',
        'Las imágenes de los productos son meramente ilustrativas y pueden diferir ligeramente de la realidad (colores, proporciones) debido a variaciones de pantalla. Dicha diferencia no constituye falta de conformidad.',
        'La disponibilidad de los productos se verifica en el momento del pedido. En caso de agotamiento de existencias tras la confirmación del pedido, el Vendedor notificará al cliente en un plazo de 48 horas ofreciendo: (a) reembolso íntegro en 14 días, o (b) espera de reposición, previo acuerdo.',
        'Todos los productos cumplen los requisitos de seguridad del Reglamento (UE) 2023/988 (GPSR — Reglamento General de Seguridad de los Productos, en vigor desde el 13 de diciembre de 2024). La documentación de seguridad está disponible a petición.',
      ],
    },
    {
      title: '4. Precios y Forma de Pago',
      content: [
        'Todos los precios se expresan en Euros (€) e incluyen el IVA aplicable.',
        'En caso de promociones o descuentos, el precio con descuento se acompaña del precio más bajo aplicado en los 30 días anteriores a la promoción, de conformidad con la Directiva Ómnibus 2019/2161.',
        'Los pagos son procesados de forma segura por Stripe Payments Europe, Ltd. Los datos de la tarjeta no se almacenan jamás en los servidores del Vendedor. Stripe cumple el estándar PCI-DSS Nivel 1.',
        'Stripe actúa como sub-encargado del tratamiento RGPD en virtud de un Acuerdo de Tratamiento de Datos. Más información: stripe.com/privacy.',
        'El pago se efectúa en el momento de la confirmación del pedido. Si el pago es rechazado, el pedido no se procesa y el cliente recibe notificación inmediata.',
        'Stripe podría realizar una preautorización (bloqueo temporal del importe) que se liberará en 3-5 días hábiles si el pedido no se completa.',
      ],
    },
    {
      title: '5. Entrega y Envío',
      content: [
        'El Vendedor se compromete a entregar los productos en un plazo máximo de 30 días desde la confirmación del pedido, salvo causa de fuerza mayor comunicada oportunamente.',
        'Los plazos de entrega estimados se indican en la ficha de producto y en el correo de confirmación del pedido. Son orientativos y no constituyen plazo esencial, salvo acuerdo escrito distinto.',
        'El riesgo de pérdida o deterioro del bien se transfiere al consumidor únicamente en el momento de la entrega física. Durante el transporte, el Vendedor sigue siendo responsable de cualquier pérdida o daño.',
        'Si no se respeta el plazo de entrega, el consumidor podrá requerir al Vendedor que efectúe la entrega en un plazo adicional razonable. Si la entrega no se realiza en dicho plazo, el consumidor tendrá derecho a resolver el contrato y obtener el reembolso íntegro.',
        'Se facilitará un número de seguimiento por correo electrónico en cuanto el paquete sea entregado al transportista.',
        'Los envíos se realizan dentro de la Unión Europea. No se aceptan entregas en apartados de correos.',
      ],
    },
    {
      title: '6. Derecho de Desistimiento (14 Días)',
      content: [
        'El consumidor tiene derecho a desistir del contrato en un plazo de 14 días a partir de la entrega física del bien, sin necesidad de indicar el motivo y sin incurrir en costes distintos de los que se especifican a continuación (Directiva 2011/83/UE, transpuesta en el Real Decreto Legislativo 1/2007).',
        'Para ejercer el derecho de desistimiento, el consumidor debe enviar una declaración inequívoca por correo electrónico a [INSERTAR_CORREO_CONTACTO] dentro del plazo de 14 días. Puede utilizarse el formulario de desistimiento estándar adjunto, aunque no es obligatorio.',
        'El consumidor debe devolver el producto en un plazo de 14 días desde la comunicación del desistimiento, en condiciones íntegras y en el embalaje original en la medida de lo posible.',
        'Los gastos de devolución corren a cargo del consumidor, salvo que el Vendedor haya omitido informarle de dicha obligación.',
        'El reembolso, incluyendo el precio del producto y los gastos de envío estándar originales, se efectuará en un plazo de 14 días desde la recepción de la devolución o de la prueba de envío, utilizando el mismo medio de pago.',
        'El derecho de desistimiento NO se aplica a: bienes personalizados o hechos a medida; bienes perecederos; contenido digital no suministrado en un soporte material con el consentimiento previo del consumidor; bienes precintados que no puedan devolverse por razones de higiene tras haber sido abiertos.',
        'ATENCIÓN: si el Vendedor no facilita la información sobre el derecho de desistimiento, el plazo se amplía automáticamente a 12 meses.',
      ],
    },
    {
      title: '7. Conformidad y Garantía Legal (2 Años)',
      content: [
        'El Vendedor responde de la falta de conformidad de los bienes vendidos conforme a la Directiva 2019/771/UE (Directiva sobre venta de bienes), transpuesta en el RDL 1/2007.',
        'La garantía legal de conformidad tiene una duración de 2 (dos) años desde la fecha de entrega. Esta garantía no puede excluirse ni limitarse frente al consumidor.',
        'Los bienes son conformes al contrato si coinciden con la descripción, tipo, cantidad y calidad indicados; son aptos para el uso normal; y poseen las cualidades y prestaciones ordinarias de bienes del mismo tipo.',
        'En los 12 primeros meses desde la entrega, se presume que la falta de conformidad existía en el momento de la entrega (inversión de la carga de la prueba). Transcurridos 12 meses, corresponde al consumidor demostrar la preexistencia del defecto.',
        'En caso de falta de conformidad, el consumidor tiene derecho a: (a) reparación gratuita; (b) sustitución; (c) reducción proporcional del precio; (d) resolución del contrato con reembolso íntegro.',
        'La garantía no cubre: daños por uso inadecuado; desgaste normal; daños accidentales o intencionados producidos tras la entrega.',
        'Para ejercer la garantía, contacte con [INSERTAR_CORREO_CONTACTO] describiendo el defecto y adjuntando documentación fotográfica si es posible.',
      ],
    },
    {
      title: '8. Privacidad y Protección de Datos (RGPD)',
      content: [
        'El tratamiento de datos personales se realiza conforme al Reglamento (UE) 2016/679 (RGPD).',
        'Los datos recogidos (nombre, correo, dirección, datos de pago) se tratan para: ejecución del contrato (Art. 6(1)(b) RGPD); obligaciones legales (Art. 6(1)(c) RGPD); comunicaciones de marketing solo con consentimiento explícito (Art. 6(1)(a) RGPD).',
        'Los datos de pago son tratados exclusivamente por Stripe como sub-encargado del tratamiento. El Vendedor no almacena datos de tarjetas en sus servidores.',
        'Los datos fiscales se conservan hasta 10 años. Los datos de cuenta se conservan hasta que el usuario solicite su eliminación.',
        'El consumidor tiene derecho de acceso, rectificación, supresión, limitación, portabilidad y oposición. Para ejercer estos derechos: [INSERTAR_CORREO_PRIVACIDAD].',
        'Para reclamaciones sobre el tratamiento de datos, contacte con la autoridad de control competente (AEPD en España).',
        'Consulte la Política de Privacidad completa del sitio para más detalles.',
      ],
    },
    {
      title: '9. Seguridad de los Productos (RGSP)',
      content: [
        'Todos los productos vendidos cumplen el Reglamento (UE) 2023/988 sobre seguridad general de los productos (RGSP), en vigor desde el 13 de diciembre de 2024.',
        'El Vendedor garantiza que los productos comercializados son seguros y conformes a la normativa aplicable (marcado CE cuando sea exigible, normas EN pertinentes).',
        'El responsable de conformidad en la UE es: [INSERTAR_NOMBRE_RESPONSABLE_CONFORMIDAD] — [INSERTAR_CORREO_RESPONSABLE].',
        'Si se identifica un riesgo de seguridad, el Vendedor informará a los consumidores afectados y adoptará las medidas legalmente exigidas (retirada, llamamiento, notificación a las autoridades a través de Safety Gate Business).',
        'La documentación de seguridad (certificados, fichas técnicas, manuales) está disponible a petición en [INSERTAR_CORREO_CONTACTO].',
      ],
    },
    {
      title: '10. Limitación de Responsabilidad',
      content: [
        'Sin perjuicio de cualquier responsabilidad legalmente irrenunciable (garantía legal, derecho de desistimiento, muerte o lesiones personales por negligencia), la responsabilidad del Vendedor se limita al valor del producto adquirido.',
        'El Vendedor no responde de: retrasos causados por fuerza mayor; retrasos del transportista que no superen en total los 30 días desde la confirmación del pedido; daños indirectos o consecuentes no previsibles en el momento de la celebración del contrato.',
        'Las siguientes limitaciones son NULAS por ley y no se aplican: exclusión de la garantía legal de 2 años; limitación del derecho de desistimiento de 14 días; exclusión de responsabilidad por muerte o lesiones personales por negligencia; arbitraje obligatorio que excluya el acceso a los tribunales ordinarios.',
      ],
    },
    {
      title: '11. Reclamaciones y Resolución de Controversias',
      content: [
        'Para cualquier reclamación, el consumidor puede contactar con el Vendedor en: [INSERTAR_CORREO_CONTACTO]. El Vendedor responderá en un plazo de 30 días hábiles.',
        'En caso de no resolución amistosa, el consumidor podrá recurrir a mediación u otros mecanismos de resolución alternativa de litigios (RAL) disponibles en su país.',
        'El tribunal competente para los litigios con consumidores es el del lugar de residencia o domicilio del consumidor. El consumidor siempre tiene derecho a acudir a los tribunales ordinarios.',
        'NOTA: La plataforma de resolución de litigios en línea (RLL) de la Comisión Europea dejó de estar disponible el 20 de marzo de 2025.',
        'Para consumidores españoles, se aplica igualmente el Real Decreto Legislativo 1/2007. Para consumidores franceses, se aplica el Code de la Consommation.',
      ],
    },
    {
      title: '12. Disposiciones Finales',
      content: [
        'Las presentes Condiciones se rigen por la ley italiana. Para los consumidores residentes en otros estados miembros de la UE, prevalecen las disposiciones imperativas de su legislación nacional.',
        'Este documento está disponible en italiano (versión prevalente), inglés, español y francés. En caso de discrepancias entre versiones, prevalece la versión italiana.',
        'Fecha de entrada en vigor: mayo 2026.',
        'Si alguna cláusula de las presentes Condiciones fuera declarada inválida, las restantes cláusulas seguirán siendo plenamente eficaces.',
        'Las presentes Condiciones sustituyen a todas las versiones anteriores y se aplican a todos los pedidos realizados a partir de la fecha de vigencia.',
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// FRANÇAIS
// ─────────────────────────────────────────────────────────────────────────────
const fr: TermsData = {
  lastUpdated: 'Mai 2026',
  sections: [
    {
      title: '1. Informations du Vendeur',
      content: [
        'Raison sociale : [INSÉRER_NOM_BOUTIQUE_ICI]',
        'Forme juridique : [INSÉRER_FORME_JURIDIQUE — ex. Auto-entrepreneur / SARL]',
        'Siège social : [INSÉRER_ADRESSE_COMPLÈTE]',
        'Numéro TVA intracommunautaire : [INSÉRER_NUMÉRO_TVA]',
        'Numéro RCS / SIREN : [INSÉRER_NUMÉRO_RCS]',
        'Courriel certifié : [INSÉRER_EMAIL_CERTIFIÉ]',
        'Courriel de contact : [INSÉRER_EMAIL_CONTACT]',
        'Téléphone : [INSÉRER_NUMÉRO_TÉLÉPHONE]',
      ],
    },
    {
      title: '2. Objet et Champ d\'Application',
      content: [
        'Les présentes Conditions Générales de Vente (« CGV ») régissent tous les contrats d\'achat conclus via [INSÉRER_NOM_BOUTIQUE_ICI] entre le Vendeur et tout consommateur (personne physique agissant à des fins n\'entrant pas dans le cadre de son activité commerciale).',
        'Ces CGV s\'appliquent aux consommateurs résidant en Italie, en Espagne et en France. Les droits impératifs prévus par la loi du pays de résidence du consommateur prévalent en tout état de cause.',
        'Pour finaliser une commande, il est nécessaire d\'accepter les présentes CGV. Passer commande implique l\'acceptation pleine et entière de toutes les clauses contenues dans ces CGV.',
        'Ces CGV peuvent être modifiées. La version en vigueur est toujours celle publiée sur le site. Les modifications ne s\'appliquent pas aux commandes déjà confirmées.',
      ],
    },
    {
      title: '3. Produits et Description',
      content: [
        'Le Vendeur s\'engage à fournir des descriptions précises et complètes de tous les produits, incluant les caractéristiques, matériaux, dimensions, poids et fonctionnalités.',
        'Les images des produits sont purement illustratives et peuvent légèrement différer de la réalité (couleurs, proportions) en raison des variations d\'écran. Une telle différence ne constitue pas un défaut de conformité.',
        'La disponibilité des produits est vérifiée au moment de la commande. En cas de rupture de stock après confirmation de la commande, le Vendeur notifiera le client dans les 48 heures en proposant : (a) un remboursement intégral sous 14 jours, ou (b) l\'attente d\'un réapprovisionnement, sous réserve d\'accord mutuel.',
        'Tous les produits respectent les exigences de sécurité du Règlement (UE) 2023/988 (RGSP — Règlement sur la sécurité générale des produits, en vigueur depuis le 13 décembre 2024). La documentation de sécurité est disponible sur demande.',
      ],
    },
    {
      title: '4. Prix et Modalités de Paiement',
      content: [
        'Tous les prix sont exprimés en Euros (€) et incluent la TVA applicable.',
        'En cas de promotions ou réductions, le prix réduit est accompagné du prix le plus bas pratiqué au cours des 30 jours précédant la promotion, conformément à la Directive Omnibus 2019/2161.',
        'Les paiements sont traités de manière sécurisée par Stripe Payments Europe, Ltd. Les données de carte ne sont jamais stockées sur les serveurs du Vendeur. Stripe est conforme à la norme PCI-DSS Niveau 1.',
        'Stripe agit en tant que sous-traitant RGPD en vertu d\'un Accord de Traitement des Données. Pour plus d\'informations : stripe.com/privacy.',
        'Le paiement intervient au moment de la confirmation de la commande. Si le paiement est refusé, la commande n\'est pas traitée et le client reçoit une notification immédiate.',
        'Stripe peut effectuer une pré-autorisation (blocage temporaire du montant) qui sera levée sous 3 à 5 jours ouvrés si la commande n\'est pas finalisée.',
      ],
    },
    {
      title: '5. Livraison et Expédition',
      content: [
        'Le Vendeur s\'engage à livrer les produits dans un délai maximum de 30 jours à compter de la confirmation de la commande, sauf cas de force majeure communiqué sans délai.',
        'Les délais de livraison estimés sont indiqués sur la fiche produit et dans le courriel de confirmation de commande. Ces délais sont indicatifs et ne constituent pas un délai essentiel, sauf accord écrit contraire.',
        'Le risque de perte ou de détérioration du bien est transféré au consommateur uniquement au moment de la livraison physique. Pendant le transport, le Vendeur reste responsable de toute perte ou détérioration.',
        'En cas de dépassement du délai de livraison, le consommateur peut mettre en demeure le Vendeur de livrer dans un délai supplémentaire raisonnable. Si la livraison n\'intervient pas dans ce délai, le consommateur a le droit de résoudre le contrat et d\'obtenir un remboursement intégral.',
        'Un numéro de suivi sera communiqué par courriel dès que le colis est remis au transporteur.',
        'Les livraisons s\'effectuent dans l\'Union Européenne. La livraison en boîte postale n\'est pas acceptée.',
      ],
    },
    {
      title: '6. Droit de Rétractation (14 Jours)',
      content: [
        'Le consommateur dispose d\'un droit de rétractation de 14 jours à compter de la livraison physique du bien, sans avoir à motiver sa décision et sans encourir de frais autres que ceux précisés ci-dessous (Directive 2011/83/UE, transposée dans le Code de la Consommation).',
        'Pour exercer le droit de rétractation, le consommateur doit adresser une déclaration non équivoque par courriel à [INSÉRER_EMAIL_CONTACT] dans le délai de 14 jours. Le formulaire de rétractation standard annexé peut être utilisé, mais n\'est pas obligatoire.',
        'Le consommateur doit retourner le produit dans les 14 jours suivant la communication de la rétractation, en bon état et dans l\'emballage d\'origine dans la mesure du possible.',
        'Les frais de retour sont à la charge du consommateur, sauf si le Vendeur a omis de l\'informer de cette obligation.',
        'Le remboursement, incluant le prix du produit et les frais d\'expédition standard initiaux, sera effectué dans les 14 jours suivant la réception du retour ou de la preuve d\'expédition, par le même moyen de paiement.',
        'Le droit de rétractation NE s\'applique PAS aux : biens personnalisés ou fabriqués sur mesure ; biens périssables ; contenus numériques fournis sur un support non matériel avec le consentement préalable du consommateur ; biens descellés ne pouvant être renvoyés pour des raisons d\'hygiène.',
        'ATTENTION : si le Vendeur ne fournit pas les informations sur le droit de rétractation, le délai est automatiquement porté à 12 mois.',
      ],
    },
    {
      title: '7. Conformité et Garantie Légale (2 Ans)',
      content: [
        'Le Vendeur est responsable des défauts de conformité des biens vendus conformément à la Directive 2019/771/UE (Directive vente de biens), transposée dans le Code de la Consommation.',
        'La garantie légale de conformité est de 2 (deux) ans à compter de la date de livraison. Cette garantie ne peut être exclue ni limitée à l\'égard des consommateurs.',
        'Les biens sont conformes au contrat s\'ils correspondent à la description, au type, à la quantité et à la qualité indiqués ; sont propres à l\'usage normal ; et possèdent les qualités et performances ordinaires de biens du même type.',
        'Dans les 12 premiers mois suivant la livraison, tout défaut de conformité est présumé exister au moment de la livraison (renversement de la charge de la preuve). Au-delà de 12 mois, il appartient au consommateur de prouver la préexistence du défaut.',
        'En cas de défaut de conformité, le consommateur a droit : (a) à la réparation gratuite ; (b) au remplacement ; (c) à une réduction proportionnelle du prix ; (d) à la résolution du contrat avec remboursement intégral.',
        'La garantie ne couvre pas : les dommages résultant d\'un usage inapproprié ; l\'usure normale ; les dommages accidentels ou intentionnels survenus après la livraison.',
        'Pour exercer la garantie, contactez [INSÉRER_EMAIL_CONTACT] en décrivant le défaut et en joignant si possible une documentation photographique.',
      ],
    },
    {
      title: '8. Confidentialité et Protection des Données (RGPD)',
      content: [
        'Le traitement des données personnelles s\'effectue conformément au Règlement (UE) 2016/679 (RGPD).',
        'Les données collectées (nom, courriel, adresse, données de paiement) sont traitées pour : l\'exécution du contrat (Art. 6(1)(b) RGPD) ; les obligations légales (Art. 6(1)(c) RGPD) ; les communications marketing uniquement avec consentement explicite (Art. 6(1)(a) RGPD).',
        'Les données de paiement sont traitées exclusivement par Stripe en tant que sous-traitant RGPD. Le Vendeur ne stocke aucune donnée de carte sur ses serveurs.',
        'Les données fiscales et de facturation sont conservées jusqu\'à 10 ans. Les données de compte sont conservées jusqu\'à suppression demandée par l\'utilisateur.',
        'Le consommateur dispose de droits d\'accès, de rectification, d\'effacement, de limitation, de portabilité et d\'opposition. Pour exercer ces droits : [INSÉRER_EMAIL_CONFIDENTIALITÉ].',
        'Pour toute réclamation relative au traitement des données, contactez l\'autorité de contrôle nationale (CNIL en France).',
        'Tous les détails figurent dans la Politique de Confidentialité complète du site.',
      ],
    },
    {
      title: '9. Sécurité des Produits (RGSP)',
      content: [
        'Tous les produits vendus sont conformes au Règlement (UE) 2023/988 sur la sécurité générale des produits (RGSP), en vigueur depuis le 13 décembre 2024.',
        'Le Vendeur garantit que les produits mis sur le marché sont sûrs et conformes à la réglementation applicable (marquage CE si requis, normes EN pertinentes).',
        'La personne responsable de la conformité dans l\'UE est : [INSÉRER_NOM_RESPONSABLE_CONFORMITÉ] — [INSÉRER_EMAIL_RESPONSABLE].',
        'Si un risque pour la sécurité est identifié, le Vendeur informera les consommateurs concernés et prendra les mesures imposées par la loi (retrait, rappel, notification aux autorités compétentes via Safety Gate Business).',
        'La documentation de sécurité (certificats, fiches techniques, manuels) est disponible sur demande à [INSÉRER_EMAIL_CONTACT].',
      ],
    },
    {
      title: '10. Limitation de Responsabilité',
      content: [
        'Sous réserve de toute responsabilité légalement irréductible (garantie légale, droit de rétractation, décès ou blessures corporelles résultant d\'une négligence), la responsabilité du Vendeur est limitée à la valeur du produit acheté.',
        'Le Vendeur n\'est pas responsable : des retards causés par des événements de force majeure ; des retards du transporteur ne dépassant pas 30 jours au total à compter de la confirmation de commande ; des dommages indirects ou consécutifs non prévisibles lors de la conclusion du contrat.',
        'Les limitations suivantes sont NULLES de plein droit et ne s\'appliquent pas : exclusion de la garantie légale de 2 ans ; limitation du droit de rétractation de 14 jours ; exclusion de responsabilité pour décès ou blessures corporelles résultant d\'une négligence ; arbitrage obligatoire excluant l\'accès aux juridictions ordinaires.',
      ],
    },
    {
      title: '11. Réclamations et Résolution des Litiges',
      content: [
        'Pour toute réclamation, le consommateur peut contacter le Vendeur à : [INSÉRER_EMAIL_CONTACT]. Le Vendeur répondra dans un délai de 30 jours ouvrés.',
        'En cas d\'échec de la résolution amiable, le consommateur peut recourir à la médiation ou à d\'autres mécanismes de règlement extrajudiciaire des litiges (REL) disponibles dans son pays.',
        'Le tribunal compétent pour les litiges de consommation est celui du lieu de résidence ou de domicile du consommateur. Le consommateur a toujours le droit de saisir les juridictions ordinaires.',
        'REMARQUE : La plateforme de règlement en ligne des litiges (RLL) de la Commission européenne n\'est plus disponible depuis le 20 mars 2025.',
        'Pour les consommateurs espagnols, le Real Decreto Legislativo 1/2007 s\'applique également. Pour les consommateurs français, le Code de la Consommation s\'applique.',
      ],
    },
    {
      title: '12. Dispositions Finales',
      content: [
        'Les présentes CGV sont soumises au droit italien. Pour les consommateurs résidant dans d\'autres États membres de l\'UE, les dispositions impératives de leur législation nationale prévalent.',
        'Ce document est disponible en italien (version prévalente), en anglais, en espagnol et en français. En cas de divergences entre les versions, la version italienne prévaut.',
        'Date d\'entrée en vigueur : mai 2026.',
        'Si une clause des présentes CGV est déclarée invalide, les clauses restantes demeurent pleinement en vigueur.',
        'Les présentes CGV remplacent toutes les versions précédentes et s\'appliquent à toutes les commandes passées à compter de la date d\'entrée en vigueur.',
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────────────────────
export const termsContent: Record<AppLanguageCode, TermsData> = { it, en, es, fr };
