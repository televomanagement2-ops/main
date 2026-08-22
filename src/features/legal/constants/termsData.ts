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
// NOTE ON PLACEHOLDERS
// Text in [SQUARE_BRACKETS] must be replaced with the seller's real details
// before going live (legal name, address, governing state, contact email,
// return window, EU responsible person, etc.). Until then the documents are
// structurally complete but not yet legally final.
//
// Market model: PRIMARY United States (USD), with an additional binding
// section for consumers in the EU/EEA. English is the prevailing version.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// ENGLISH (prevailing version)
// ─────────────────────────────────────────────────────────────────────────────
const en: TermsData = {
  lastUpdated: 'June 2026',
  sections: [
    {
      title: '1. Seller Information & Acceptance',
      content: [
        'These Terms of Service ("Terms") are a binding agreement between you ("you", "customer") and [SELLER_LEGAL_NAME] ("we", "us", "AURUM"), the operator of this website.',
        'Seller: [SELLER_LEGAL_NAME] ([SELLER_ENTITY_TYPE]) — Address: [BUSINESS_ADDRESS] — Email: [CONTACT_EMAIL] — Phone: [SUPPORT_PHONE].',
        'By accessing the site, creating an account, or placing an order, you confirm that you have read, understood, and agree to be bound by these Terms and by our Privacy Policy and Cookie Policy, which are incorporated by reference.',
        'If you do not agree with these Terms, do not use the site or place an order.',
      ],
    },
    {
      title: '2. Eligibility & Account',
      content: [
        'You must be at least 18 years old (or the age of majority in your jurisdiction) and able to form a legally binding contract to purchase from this site.',
        'If you create an account, you are responsible for keeping your credentials confidential and for all activity that occurs under your account. Notify us immediately of any unauthorized use.',
        'You agree to provide accurate, current, and complete information and to keep it updated. We may suspend or terminate accounts that contain false information or that are used in violation of these Terms.',
      ],
    },
    {
      title: '3. Products, Descriptions & Availability',
      content: [
        'We strive to describe and display products as accurately as possible, including materials, dimensions, and features.',
        'Product images are for illustration only; actual colors and proportions may vary slightly depending on your screen. Such variation does not constitute a defect.',
        'All products are subject to availability. We may limit quantities, discontinue products, or correct errors in descriptions, pricing, or availability at any time, even after an order has been submitted.',
        'If a product becomes unavailable after you order, we will notify you and offer a replacement, a backorder, or a full refund of the affected item.',
      ],
    },
    {
      title: '4. Prices, Taxes & Payment',
      content: [
        'All prices are shown in U.S. Dollars (USD) unless otherwise stated. Prices are exclusive of applicable taxes unless indicated; sales tax is calculated and displayed at checkout where required.',
        'We reserve the right to change prices at any time. The price that applies to your order is the price displayed at the time the order is confirmed.',
        'Payments are processed securely by Stripe, Inc. / Stripe Payments Europe, Ltd. ("Stripe"). We never receive or store your full card number on our servers. Stripe is PCI-DSS Level 1 certified.',
        'By submitting payment information, you represent that you are authorized to use the payment method. If a charge is declined or reversed, we may cancel or suspend the related order.',
        'Order totals (item prices, shipping, and tax) are calculated on our servers from authoritative catalog data; any amount submitted by your browser is ignored.',
      ],
    },
    {
      title: '5. Orders & Order Acceptance',
      content: [
        'Your submission of an order is an offer to purchase. No contract is formed until we confirm acceptance, which generally occurs when we send an order confirmation or ship the product.',
        'We may refuse or cancel any order — including after confirmation — for reasons such as suspected fraud, pricing or stock errors, payment issues, or violation of these Terms. If we cancel a paid order, you receive a full refund.',
        'You will receive electronic communications related to your order (confirmation, shipping, delivery). These are part of the transaction and are sent regardless of marketing preferences.',
      ],
    },
    {
      title: '6. Shipping & Delivery',
      content: [
        'We ship to the destinations made available at checkout. Estimated delivery times are shown on the product page and/or at checkout and are estimates, not guarantees.',
        'Title and risk of loss for products pass to you upon delivery to the carrier, except where mandatory consumer law provides otherwise (see the EU/EEA section below, where risk passes on physical delivery to the consumer).',
        'A tracking number is provided by email once the parcel is handed to the carrier. We are not responsible for carrier delays outside our control, but we will assist with lost or damaged shipments.',
        'You are responsible for providing an accurate shipping address. We are not liable for orders delivered to an incorrect address provided by you.',
      ],
    },
    {
      title: '7. Returns, Refunds & Cancellations',
      content: [
        'U.S. and other non-EU/EEA customers: you may return eligible products within [RETURN_WINDOW] days of delivery, in unused condition with original packaging, unless the item is marked final sale or is non-returnable for hygiene or personalization reasons.',
        'To start a return, contact [CONTACT_EMAIL] with your order number. Unless the return is due to our error or a defective product, return shipping costs are the customer\'s responsibility.',
        'Approved refunds are issued to the original payment method within a reasonable time after we receive and inspect the return. Original shipping charges are non-refundable except where required by law or where the return is due to our error.',
        'This voluntary policy is separate from, and in addition to, any non-waivable statutory rights, including the rights of EU/EEA consumers described below.',
      ],
    },
    {
      title: '8. Disclaimer of Warranties',
      content: [
        'Except as expressly stated in these Terms or required by applicable law, the site and all products and services are provided "AS IS" and "AS AVAILABLE" without warranties of any kind, whether express or implied.',
        'To the fullest extent permitted by law, we disclaim all implied warranties, including merchantability, fitness for a particular purpose, title, and non-infringement.',
        'Some jurisdictions do not allow the exclusion of certain warranties; in those jurisdictions the above exclusions apply only to the extent permitted, and your mandatory statutory rights are unaffected.',
      ],
    },
    {
      title: '9. Limitation of Liability',
      content: [
        'To the maximum extent permitted by law, we and our suppliers will not be liable for any indirect, incidental, special, consequential, or punitive damages, or for lost profits, data, or goodwill, arising from your use of the site or any product.',
        'Our total aggregate liability for any claim relating to an order will not exceed the amount you paid for the product(s) giving rise to the claim.',
        'Nothing in these Terms limits liability that cannot be limited by law, including liability for death or personal injury caused by negligence, fraud, or — for EU/EEA consumers — the mandatory rights described below.',
      ],
    },
    {
      title: '10. Indemnification',
      content: [
        'You agree to indemnify and hold harmless [SELLER_LEGAL_NAME] and its officers, employees, and agents from any claims, losses, liabilities, and expenses (including reasonable legal fees) arising from your misuse of the site, your violation of these Terms, or your violation of any law or third-party right.',
        'This provision does not apply to the extent a claim results from our own negligence or willful misconduct, and does not affect the mandatory rights of consumers.',
      ],
    },
    {
      title: '11. Intellectual Property',
      content: [
        'All content on the site — including text, graphics, logos, images, and software — is owned by [SELLER_LEGAL_NAME] or its licensors and is protected by intellectual property laws.',
        'You may use the site only for lawful, personal, non-commercial purposes. You may not copy, reproduce, distribute, or create derivative works from our content without prior written permission.',
        'AURUM and related marks are trademarks of [SELLER_LEGAL_NAME]. Other names and logos are the property of their respective owners.',
      ],
    },
    {
      title: '12. Acceptable Use',
      content: [
        'You agree not to: use the site for any unlawful purpose; attempt to gain unauthorized access to systems or accounts; interfere with the site\'s operation or security; scrape, harvest, or reverse-engineer the site; or submit false, fraudulent, or abusive orders or content.',
        'We may investigate and take action — including suspending access and cooperating with law enforcement — against conduct that violates this section.',
      ],
    },
    {
      title: '13. Dispute Resolution — Binding Arbitration & Class Action Waiver',
      content: [
        'PLEASE READ THIS SECTION CAREFULLY — IT AFFECTS YOUR LEGAL RIGHTS. It applies to U.S. customers to the fullest extent permitted by the Federal Arbitration Act, and does not apply to EU/EEA consumers (see the EU/EEA section) or where prohibited by law.',
        'Most concerns can be resolved informally: please first contact [CONTACT_EMAIL] and allow us 30 days to resolve the matter.',
        'Any dispute not resolved informally will be settled by final and binding individual arbitration administered by [ARBITRATION_BODY] under its consumer rules, rather than in court, except that either party may bring a qualifying claim in small-claims court.',
        'CLASS ACTION WAIVER: disputes will be conducted only on an individual basis and not as a plaintiff or class member in any class, collective, or representative proceeding.',
        'OPT-OUT: you may opt out of this arbitration agreement by sending written notice to [CONTACT_EMAIL] within 30 days of first accepting these Terms; opting out does not affect any other part of these Terms.',
      ],
    },
    {
      title: '14. Governing Law & Venue',
      content: [
        'These Terms are governed by the laws of the State of [GOVERNING_STATE], United States, without regard to conflict-of-law rules.',
        'Subject to the arbitration section above, the exclusive venue for any permitted court proceeding is the state or federal courts located in [GOVERNING_STATE].',
        'For EU/EEA consumers, this choice of law and venue does not deprive you of the protection of the mandatory laws of your country of residence (see the EU/EEA section).',
      ],
    },
    {
      title: '15. Changes & General Provisions',
      content: [
        'We may update these Terms from time to time. The version in force is the one published on this page with its "last updated" date. Material changes will be communicated by reasonable means; continued use after changes take effect constitutes acceptance.',
        'If any provision is held unenforceable, the remaining provisions remain in full effect. Our failure to enforce a provision is not a waiver.',
        'You may not assign these Terms without our consent; we may assign them in connection with a merger, acquisition, or sale of assets. These Terms are the entire agreement between you and us regarding the site.',
        'Questions about these Terms: [CONTACT_EMAIL].',
      ],
    },
    {
      title: '16. Additional Rights for Consumers in the EU/EEA',
      content: [
        'This section applies in addition to the above for consumers resident in the European Union or EEA. Where it conflicts with other sections, this section and the mandatory consumer law of your country of residence prevail; the arbitration and class-action provisions in Section 13 do NOT apply to you.',
        'Right of withdrawal: you may withdraw from the purchase within 14 days of physical delivery, without giving any reason, by an unambiguous statement to [CONTACT_EMAIL]. You then return the goods within 14 days; we refund the price and standard outbound shipping within 14 days using the same payment method. Exceptions apply (e.g., personalized, sealed hygiene, or perishable goods). If we fail to inform you of this right, the period extends by up to 12 months.',
        'Legal guarantee of conformity: goods benefit from the statutory 2-year guarantee of conformity (Directive (EU) 2019/771). For lack of conformity you are entitled to repair, replacement, price reduction, or termination, as provided by law. This guarantee cannot be excluded or limited.',
        'Product safety (GPSR): products comply with Regulation (EU) 2023/988 (in force since 13 December 2024). The EU responsible person is: [EU_RESPONSIBLE_PERSON] — [EU_RESPONSIBLE_CONTACT].',
        'Accessibility (EAA): we work to meet the European Accessibility Act (Directive (EU) 2019/882, applicable since 28 June 2025); our accessibility statement is available on request at [CONTACT_EMAIL].',
        'Complaints & ADR: contact [CONTACT_EMAIL]; you may also use alternative dispute resolution available in your country. Note: the EU Online Dispute Resolution (ODR) platform was discontinued on 20 July 2025 and is no longer available.',
        'You may always bring proceedings in the courts of your place of residence.',
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// ITALIANO
// ─────────────────────────────────────────────────────────────────────────────
const it: TermsData = {
  lastUpdated: 'Giugno 2026',
  sections: [
    {
      title: '1. Dati del Venditore e Accettazione',
      content: [
        'I presenti Termini di Servizio ("Termini") costituiscono un accordo vincolante tra l\'utente ("tu", "cliente") e [SELLER_LEGAL_NAME] ("noi", "AURUM"), gestore di questo sito web.',
        'Venditore: [SELLER_LEGAL_NAME] ([SELLER_ENTITY_TYPE]) — Indirizzo: [BUSINESS_ADDRESS] — Email: [CONTACT_EMAIL] — Telefono: [SUPPORT_PHONE].',
        'Accedendo al sito, creando un account o effettuando un ordine, dichiari di aver letto, compreso e accettato i presenti Termini, nonché la Privacy Policy e la Cookie Policy, qui richiamate per riferimento.',
        'Se non accetti i presenti Termini, non utilizzare il sito e non effettuare ordini.',
      ],
    },
    {
      title: '2. Idoneità e Account',
      content: [
        'Per acquistare devi avere almeno 18 anni (o la maggiore età nella tua giurisdizione) ed essere in grado di concludere un contratto giuridicamente vincolante.',
        'Se crei un account, sei responsabile della riservatezza delle credenziali e di ogni attività svolta tramite il tuo account. Comunicaci immediatamente qualsiasi uso non autorizzato.',
        'Ti impegni a fornire informazioni accurate, aggiornate e complete. Possiamo sospendere o chiudere account contenenti informazioni false o usati in violazione dei presenti Termini.',
      ],
    },
    {
      title: '3. Prodotti, Descrizioni e Disponibilità',
      content: [
        'Ci impegniamo a descrivere e mostrare i prodotti nel modo più accurato possibile, inclusi materiali, dimensioni e caratteristiche.',
        'Le immagini sono puramente illustrative; colori e proporzioni reali possono variare leggermente in base allo schermo. Tale scostamento non costituisce difetto.',
        'Tutti i prodotti sono soggetti a disponibilità. Possiamo limitare le quantità, ritirare prodotti o correggere errori di descrizione, prezzo o disponibilità in qualsiasi momento, anche dopo l\'invio di un ordine.',
        'Se un prodotto diventa non disponibile dopo l\'ordine, ti avviseremo offrendo una sostituzione, l\'attesa del riassortimento o il rimborso integrale dell\'articolo interessato.',
      ],
    },
    {
      title: '4. Prezzi, Imposte e Pagamento',
      content: [
        'Tutti i prezzi sono indicati in Dollari USA (USD) salvo diversa indicazione. Salvo quanto indicato, i prezzi non includono le imposte applicabili; l\'imposta sulle vendite, ove dovuta, è calcolata e mostrata al checkout.',
        'Ci riserviamo di modificare i prezzi in qualsiasi momento. Il prezzo applicabile è quello visualizzato al momento della conferma dell\'ordine.',
        'I pagamenti sono elaborati in modo sicuro da Stripe, Inc. / Stripe Payments Europe, Ltd. ("Stripe"). Non riceviamo né conserviamo mai il numero completo della carta sui nostri server. Stripe è certificata PCI-DSS Level 1.',
        'Inviando i dati di pagamento, dichiari di essere autorizzato a utilizzare il metodo di pagamento. Se un addebito viene rifiutato o stornato, possiamo annullare o sospendere l\'ordine relativo.',
        'Gli importi dell\'ordine (prezzi, spedizione e imposte) sono calcolati sui nostri server a partire dai dati ufficiali del catalogo; qualsiasi importo inviato dal browser viene ignorato.',
      ],
    },
    {
      title: '5. Ordini e Accettazione',
      content: [
        'L\'invio di un ordine costituisce una proposta d\'acquisto. Il contratto si conclude solo con la nostra conferma di accettazione, generalmente con l\'email di conferma o la spedizione del prodotto.',
        'Possiamo rifiutare o annullare un ordine — anche dopo la conferma — per motivi quali sospetta frode, errori di prezzo o di stock, problemi di pagamento o violazione dei presenti Termini. In caso di annullamento di un ordine pagato, riceverai il rimborso integrale.',
        'Riceverai comunicazioni elettroniche relative all\'ordine (conferma, spedizione, consegna). Tali comunicazioni fanno parte della transazione e vengono inviate indipendentemente dalle preferenze di marketing.',
      ],
    },
    {
      title: '6. Spedizione e Consegna',
      content: [
        'Spediamo verso le destinazioni rese disponibili al checkout. I tempi di consegna stimati indicati nella scheda prodotto e/o al checkout sono stime, non garanzie.',
        'La proprietà e il rischio di perdita passano all\'utente alla consegna al corriere, salvo ove la legge imperativa a tutela del consumatore disponga diversamente (vedi la sezione UE/EEA: per i consumatori il rischio passa alla consegna fisica).',
        'Un numero di tracciamento è fornito via email all\'affidamento del pacco al corriere. Non siamo responsabili per ritardi del corriere fuori dal nostro controllo, ma ti assisteremo in caso di smarrimento o danneggiamento.',
        'Sei responsabile della correttezza dell\'indirizzo di spedizione. Non rispondiamo di ordini consegnati a un indirizzo errato fornito dall\'utente.',
      ],
    },
    {
      title: '7. Resi, Rimborsi e Annullamenti',
      content: [
        'Clienti USA e di altri paesi non UE/EEA: puoi restituire i prodotti idonei entro [RETURN_WINDOW] giorni dalla consegna, non utilizzati e con imballo originale, salvo articoli indicati come vendita finale o non restituibili per ragioni igieniche o di personalizzazione.',
        'Per avviare un reso, contatta [CONTACT_EMAIL] indicando il numero d\'ordine. Salvo che il reso sia dovuto a un nostro errore o a prodotto difettoso, le spese di restituzione sono a carico del cliente.',
        'I rimborsi approvati sono accreditati sul metodo di pagamento originale entro un termine ragionevole dal ricevimento e dalla verifica del reso. Le spese di spedizione originali non sono rimborsabili salvo ove richiesto dalla legge o in caso di nostro errore.',
        'Questa politica volontaria è distinta e si aggiunge ai diritti inderogabili di legge, inclusi i diritti dei consumatori UE/EEA descritti più avanti.',
      ],
    },
    {
      title: '8. Esclusione di Garanzie',
      content: [
        'Salvo quanto espressamente previsto dai presenti Termini o richiesto dalla legge applicabile, il sito e tutti i prodotti e servizi sono forniti "COSÌ COME SONO" e "SECONDO DISPONIBILITÀ", senza garanzie di alcun tipo, espresse o implicite.',
        'Nei limiti massimi consentiti dalla legge, escludiamo ogni garanzia implicita, inclusa commerciabilità, idoneità a uno scopo particolare, titolarità e non violazione di diritti.',
        'Alcune giurisdizioni non consentono l\'esclusione di determinate garanzie; in tali casi le esclusioni si applicano solo nei limiti consentiti e i tuoi diritti inderogabili di legge restano impregiudicati.',
      ],
    },
    {
      title: '9. Limitazione di Responsabilità',
      content: [
        'Nei limiti massimi consentiti dalla legge, noi e i nostri fornitori non saremo responsabili per danni indiretti, incidentali, speciali, consequenziali o punitivi, né per perdita di profitti, dati o avviamento, derivanti dall\'uso del sito o di un prodotto.',
        'La nostra responsabilità complessiva per qualsiasi pretesa relativa a un ordine non eccederà l\'importo da te pagato per il/i prodotto/i oggetto della pretesa.',
        'Nulla nei presenti Termini limita la responsabilità non limitabile per legge, inclusa quella per morte o lesioni personali da negligenza, dolo o — per i consumatori UE/EEA — i diritti inderogabili descritti più avanti.',
      ],
    },
    {
      title: '10. Manleva',
      content: [
        'Ti impegni a manlevare e tenere indenne [SELLER_LEGAL_NAME] e i suoi amministratori, dipendenti e collaboratori da qualsiasi pretesa, perdita, responsabilità e spesa (incluse ragionevoli spese legali) derivante da un uso improprio del sito, dalla violazione dei presenti Termini o di qualsiasi legge o diritto di terzi.',
        'La presente clausola non si applica nella misura in cui la pretesa derivi da nostra negligenza o dolo e non pregiudica i diritti inderogabili dei consumatori.',
      ],
    },
    {
      title: '11. Proprietà Intellettuale',
      content: [
        'Tutti i contenuti del sito — inclusi testi, grafica, loghi, immagini e software — sono di proprietà di [SELLER_LEGAL_NAME] o dei suoi licenzianti e sono protetti dalle leggi sulla proprietà intellettuale.',
        'Puoi utilizzare il sito solo per scopi leciti, personali e non commerciali. Non puoi copiare, riprodurre, distribuire o creare opere derivate dai nostri contenuti senza previa autorizzazione scritta.',
        'AURUM e i marchi correlati sono marchi di [SELLER_LEGAL_NAME]. Altri nomi e loghi appartengono ai rispettivi proprietari.',
      ],
    },
    {
      title: '12. Uso Consentito',
      content: [
        'Ti impegni a non: usare il sito per scopi illeciti; tentare accessi non autorizzati a sistemi o account; interferire con il funzionamento o la sicurezza del sito; effettuare scraping o reverse engineering; inviare ordini o contenuti falsi, fraudolenti o abusivi.',
        'Possiamo indagare e adottare misure — inclusa la sospensione dell\'accesso e la collaborazione con le autorità — contro condotte che violano la presente sezione.',
      ],
    },
    {
      title: '13. Risoluzione delle Controversie — Arbitrato e Rinuncia alle Azioni Collettive',
      content: [
        'LEGGI ATTENTAMENTE QUESTA SEZIONE — INCIDE SUI TUOI DIRITTI. Si applica ai clienti USA nei limiti massimi consentiti dal Federal Arbitration Act e NON si applica ai consumatori UE/EEA (vedi relativa sezione) né ove vietato dalla legge.',
        'La maggior parte dei problemi può risolversi in via informale: contatta prima [CONTACT_EMAIL] e concedici 30 giorni per risolvere.',
        'Ogni controversia non risolta in via informale sarà definita mediante arbitrato individuale, definitivo e vincolante, amministrato da [ARBITRATION_BODY] secondo le sue regole per i consumatori, anziché dinanzi a un tribunale, fermo restando il ricorso a un giudice di prossimità per le pretese ammissibili.',
        'RINUNCIA ALL\'AZIONE COLLETTIVA: le controversie saranno condotte solo su base individuale e non come attore o membro in azioni di classe, collettive o rappresentative.',
        'OPT-OUT: puoi rinunciare a questo accordo arbitrale inviando comunicazione scritta a [CONTACT_EMAIL] entro 30 giorni dalla prima accettazione dei Termini; l\'opt-out non incide sulle altre parti dei Termini.',
      ],
    },
    {
      title: '14. Legge Applicabile e Foro',
      content: [
        'I presenti Termini sono regolati dalle leggi dello Stato di [GOVERNING_STATE], USA, senza riguardo alle norme sui conflitti di legge.',
        'Fatta salva la sezione sull\'arbitrato, il foro esclusivo per i procedimenti giudiziari ammessi è quello dei tribunali statali o federali siti in [GOVERNING_STATE].',
        'Per i consumatori UE/EEA, tale scelta di legge e foro non ti priva della tutela delle norme imperative del tuo paese di residenza (vedi sezione UE/EEA).',
      ],
    },
    {
      title: '15. Modifiche e Disposizioni Generali',
      content: [
        'Possiamo aggiornare i presenti Termini periodicamente. La versione vigente è quella pubblicata in questa pagina con la relativa data di aggiornamento. Le modifiche sostanziali saranno comunicate con mezzi ragionevoli; l\'uso continuato dopo l\'efficacia delle modifiche ne costituisce accettazione.',
        'Se una clausola è dichiarata inefficace, le restanti restano pienamente valide. Il mancato esercizio di un diritto non costituisce rinuncia.',
        'Non puoi cedere i presenti Termini senza il nostro consenso; noi possiamo cederli in caso di fusione, acquisizione o cessione di azienda. I presenti Termini costituiscono l\'intero accordo tra le parti riguardo al sito.',
        'Domande sui presenti Termini: [CONTACT_EMAIL].',
      ],
    },
    {
      title: '16. Diritti Aggiuntivi per i Consumatori UE/EEA',
      content: [
        'Questa sezione si applica in aggiunta alle precedenti ai consumatori residenti nell\'Unione Europea o nel SEE. In caso di conflitto, prevalgono questa sezione e la legge imperativa a tutela del consumatore del tuo paese di residenza; le clausole su arbitrato e azione collettiva della Sezione 13 NON ti si applicano.',
        'Diritto di recesso: puoi recedere dall\'acquisto entro 14 giorni dalla consegna fisica, senza motivazione, con dichiarazione inequivoca a [CONTACT_EMAIL]. Restituisci poi i beni entro 14 giorni; rimborsiamo prezzo e spedizione standard di andata entro 14 giorni con lo stesso mezzo di pagamento. Si applicano eccezioni (es. beni personalizzati, sigillati per igiene, deperibili). Se omettiamo di informarti di tale diritto, il termine si estende fino a 12 mesi.',
        'Garanzia legale di conformità: i beni godono della garanzia legale di conformità di 2 anni (Direttiva (UE) 2019/771). In caso di difetto hai diritto a riparazione, sostituzione, riduzione del prezzo o risoluzione, come previsto dalla legge. Questa garanzia non è escludibile né limitabile.',
        'Sicurezza dei prodotti (GPSR): i prodotti sono conformi al Regolamento (UE) 2023/988 (in vigore dal 13 dicembre 2024). Il responsabile UE è: [EU_RESPONSIBLE_PERSON] — [EU_RESPONSIBLE_CONTACT].',
        'Accessibilità (EAA): operiamo per conformarci allo European Accessibility Act (Direttiva (UE) 2019/882, applicabile dal 28 giugno 2025); la dichiarazione di accessibilità è disponibile su richiesta a [CONTACT_EMAIL].',
        'Reclami e ADR: contatta [CONTACT_EMAIL]; puoi inoltre ricorrere agli strumenti di risoluzione alternativa disponibili nel tuo paese. Nota: la piattaforma ODR della Commissione UE è stata dismessa il 20 luglio 2025 e non è più disponibile.',
        'Puoi sempre adire i tribunali del tuo luogo di residenza.',
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// ESPAÑOL
// ─────────────────────────────────────────────────────────────────────────────
const es: TermsData = {
  lastUpdated: 'Junio 2026',
  sections: [
    {
      title: '1. Datos del Vendedor y Aceptación',
      content: [
        'Estas Condiciones del Servicio ("Condiciones") constituyen un acuerdo vinculante entre tú ("usuario", "cliente") y [SELLER_LEGAL_NAME] ("nosotros", "AURUM"), operador de este sitio web.',
        'Vendedor: [SELLER_LEGAL_NAME] ([SELLER_ENTITY_TYPE]) — Dirección: [BUSINESS_ADDRESS] — Correo: [CONTACT_EMAIL] — Teléfono: [SUPPORT_PHONE].',
        'Al acceder al sitio, crear una cuenta o realizar un pedido, confirmas que has leído, entendido y aceptado estas Condiciones, así como la Política de Privacidad y la Política de Cookies, incorporadas por referencia.',
        'Si no aceptas estas Condiciones, no utilices el sitio ni realices pedidos.',
      ],
    },
    {
      title: '2. Elegibilidad y Cuenta',
      content: [
        'Para comprar debes tener al menos 18 años (o la mayoría de edad en tu jurisdicción) y capacidad para celebrar un contrato jurídicamente vinculante.',
        'Si creas una cuenta, eres responsable de la confidencialidad de tus credenciales y de toda actividad realizada con tu cuenta. Notifícanos de inmediato cualquier uso no autorizado.',
        'Te comprometes a facilitar información veraz, actualizada y completa. Podemos suspender o cerrar cuentas con información falsa o usadas en violación de estas Condiciones.',
      ],
    },
    {
      title: '3. Productos, Descripciones y Disponibilidad',
      content: [
        'Procuramos describir y mostrar los productos con la mayor precisión posible, incluyendo materiales, dimensiones y características.',
        'Las imágenes son meramente ilustrativas; los colores y proporciones reales pueden variar ligeramente según la pantalla. Dicha variación no constituye un defecto.',
        'Todos los productos están sujetos a disponibilidad. Podemos limitar cantidades, retirar productos o corregir errores de descripción, precio o disponibilidad en cualquier momento, incluso tras el envío de un pedido.',
        'Si un producto deja de estar disponible tras tu pedido, te avisaremos y ofreceremos una sustitución, la espera de reposición o el reembolso íntegro del artículo afectado.',
      ],
    },
    {
      title: '4. Precios, Impuestos y Pago',
      content: [
        'Todos los precios se muestran en Dólares estadounidenses (USD) salvo indicación contraria. Salvo que se indique, los precios no incluyen los impuestos aplicables; el impuesto sobre ventas, cuando proceda, se calcula y muestra en el pago.',
        'Nos reservamos el derecho de modificar los precios en cualquier momento. El precio aplicable es el mostrado en el momento de confirmar el pedido.',
        'Los pagos son procesados de forma segura por Stripe, Inc. / Stripe Payments Europe, Ltd. ("Stripe"). Nunca recibimos ni almacenamos el número completo de la tarjeta en nuestros servidores. Stripe cuenta con certificación PCI-DSS Nivel 1.',
        'Al enviar los datos de pago, declaras estar autorizado a usar el método de pago. Si un cargo es rechazado o revertido, podemos cancelar o suspender el pedido correspondiente.',
        'Los importes del pedido (precios, envío e impuestos) se calculan en nuestros servidores a partir de los datos oficiales del catálogo; cualquier importe enviado por el navegador se ignora.',
      ],
    },
    {
      title: '5. Pedidos y Aceptación',
      content: [
        'El envío de un pedido es una oferta de compra. No se forma contrato hasta que confirmamos la aceptación, normalmente con el correo de confirmación o el envío del producto.',
        'Podemos rechazar o cancelar un pedido — incluso tras la confirmación — por motivos como sospecha de fraude, errores de precio o de stock, problemas de pago o violación de estas Condiciones. Si cancelamos un pedido pagado, recibirás el reembolso íntegro.',
        'Recibirás comunicaciones electrónicas relativas al pedido (confirmación, envío, entrega). Forman parte de la transacción y se envían con independencia de las preferencias de marketing.',
      ],
    },
    {
      title: '6. Envío y Entrega',
      content: [
        'Enviamos a los destinos disponibles en el pago. Los plazos de entrega estimados que se muestran en la ficha de producto y/o en el pago son estimaciones, no garantías.',
        'La propiedad y el riesgo de pérdida pasan al usuario en el momento de la entrega al transportista, salvo que la ley imperativa de consumo disponga otra cosa (ver la sección UE/EEE: para consumidores el riesgo pasa en la entrega física).',
        'Se facilita un número de seguimiento por correo al entregar el paquete al transportista. No respondemos de retrasos del transportista ajenos a nuestro control, pero te ayudaremos en caso de pérdida o daño.',
        'Eres responsable de facilitar una dirección de envío correcta. No respondemos de pedidos entregados en una dirección incorrecta facilitada por el usuario.',
      ],
    },
    {
      title: '7. Devoluciones, Reembolsos y Cancelaciones',
      content: [
        'Clientes de EE. UU. y de otros países fuera de la UE/EEE: puedes devolver productos elegibles en un plazo de [RETURN_WINDOW] días desde la entrega, sin usar y con el embalaje original, salvo artículos marcados como venta final o no devolubles por higiene o personalización.',
        'Para iniciar una devolución, contacta con [CONTACT_EMAIL] indicando el número de pedido. Salvo que la devolución se deba a un error nuestro o a producto defectuoso, los gastos de devolución corren a cargo del cliente.',
        'Los reembolsos aprobados se abonan al método de pago original en un plazo razonable tras recibir y revisar la devolución. Los gastos de envío originales no son reembolsables salvo que lo exija la ley o en caso de error nuestro.',
        'Esta política voluntaria es independiente y se añade a los derechos legales irrenunciables, incluidos los derechos de los consumidores de la UE/EEE descritos más adelante.',
      ],
    },
    {
      title: '8. Exclusión de Garantías',
      content: [
        'Salvo lo expresamente previsto en estas Condiciones o exigido por la ley aplicable, el sitio y todos los productos y servicios se proporcionan "TAL CUAL" y "SEGÚN DISPONIBILIDAD", sin garantías de ningún tipo, expresas o implícitas.',
        'En la máxima medida permitida por la ley, excluimos toda garantía implícita, incluyendo comerciabilidad, idoneidad para un fin concreto, titularidad y no infracción.',
        'Algunas jurisdicciones no permiten excluir ciertas garantías; en ellas las exclusiones se aplican solo en la medida permitida y tus derechos legales irrenunciables no se ven afectados.',
      ],
    },
    {
      title: '9. Limitación de Responsabilidad',
      content: [
        'En la máxima medida permitida por la ley, ni nosotros ni nuestros proveedores seremos responsables de daños indirectos, incidentales, especiales, consecuentes o punitivos, ni de lucro cesante o pérdida de datos o reputación, derivados del uso del sitio o de un producto.',
        'Nuestra responsabilidad total por cualquier reclamación relativa a un pedido no excederá el importe que hayas pagado por el/los producto(s) que originan la reclamación.',
        'Nada en estas Condiciones limita la responsabilidad que no pueda limitarse por ley, incluida la responsabilidad por muerte o lesiones personales por negligencia, dolo o — para consumidores de la UE/EEE — los derechos irrenunciables descritos más adelante.',
      ],
    },
    {
      title: '10. Indemnización',
      content: [
        'Te comprometes a indemnizar y mantener indemne a [SELLER_LEGAL_NAME] y a sus directivos, empleados y colaboradores frente a cualquier reclamación, pérdida, responsabilidad y gasto (incluidos honorarios legales razonables) derivados del uso indebido del sitio, de la violación de estas Condiciones o de cualquier ley o derecho de terceros.',
        'Esta cláusula no se aplica en la medida en que la reclamación derive de nuestra negligencia o dolo y no afecta a los derechos irrenunciables de los consumidores.',
      ],
    },
    {
      title: '11. Propiedad Intelectual',
      content: [
        'Todo el contenido del sitio — textos, gráficos, logotipos, imágenes y software — es propiedad de [SELLER_LEGAL_NAME] o de sus licenciantes y está protegido por las leyes de propiedad intelectual.',
        'Solo puedes usar el sitio con fines lícitos, personales y no comerciales. No puedes copiar, reproducir, distribuir ni crear obras derivadas de nuestro contenido sin autorización previa por escrito.',
        'AURUM y las marcas relacionadas son marcas de [SELLER_LEGAL_NAME]. Otros nombres y logotipos pertenecen a sus respectivos titulares.',
      ],
    },
    {
      title: '12. Uso Aceptable',
      content: [
        'Te comprometes a no: usar el sitio con fines ilícitos; intentar accesos no autorizados a sistemas o cuentas; interferir en el funcionamiento o la seguridad del sitio; hacer scraping o ingeniería inversa; enviar pedidos o contenidos falsos, fraudulentos o abusivos.',
        'Podemos investigar y tomar medidas — incluida la suspensión del acceso y la cooperación con las autoridades — frente a conductas que violen esta sección.',
      ],
    },
    {
      title: '13. Resolución de Disputas — Arbitraje y Renuncia a Acciones Colectivas',
      content: [
        'LEE ATENTAMENTE ESTA SECCIÓN — AFECTA A TUS DERECHOS. Se aplica a los clientes de EE. UU. en la máxima medida permitida por la Federal Arbitration Act y NO se aplica a los consumidores de la UE/EEE (ver su sección) ni cuando la ley lo prohíba.',
        'La mayoría de los problemas pueden resolverse de forma informal: contacta primero con [CONTACT_EMAIL] y concédenos 30 días para resolverlo.',
        'Toda disputa no resuelta de forma informal se resolverá mediante arbitraje individual, definitivo y vinculante, administrado por [ARBITRATION_BODY] conforme a sus reglas de consumo, en lugar de ante un tribunal, salvo el recurso a un tribunal de menor cuantía para reclamaciones admisibles.',
        'RENUNCIA A LA ACCIÓN COLECTIVA: las disputas se tramitarán solo de forma individual y no como demandante o miembro de una acción de clase, colectiva o representativa.',
        'OPT-OUT: puedes renunciar a este acuerdo de arbitraje enviando un aviso por escrito a [CONTACT_EMAIL] dentro de los 30 días siguientes a la primera aceptación de estas Condiciones; el opt-out no afecta al resto de las Condiciones.',
      ],
    },
    {
      title: '14. Ley Aplicable y Jurisdicción',
      content: [
        'Estas Condiciones se rigen por las leyes del Estado de [GOVERNING_STATE], EE. UU., sin atender a normas de conflicto de leyes.',
        'Sin perjuicio de la sección de arbitraje, la jurisdicción exclusiva para los procedimientos judiciales permitidos corresponde a los tribunales estatales o federales sitos en [GOVERNING_STATE].',
        'Para los consumidores de la UE/EEE, esta elección de ley y jurisdicción no te priva de la protección de las normas imperativas de tu país de residencia (ver sección UE/EEE).',
      ],
    },
    {
      title: '15. Modificaciones y Disposiciones Generales',
      content: [
        'Podemos actualizar estas Condiciones periódicamente. La versión vigente es la publicada en esta página con su fecha de actualización. Los cambios sustanciales se comunicarán por medios razonables; el uso continuado tras su entrada en vigor implica aceptación.',
        'Si alguna disposición resulta inaplicable, las demás seguirán plenamente vigentes. La falta de ejercicio de un derecho no constituye renuncia.',
        'No puedes ceder estas Condiciones sin nuestro consentimiento; nosotros podemos cederlas en caso de fusión, adquisición o venta de activos. Estas Condiciones constituyen el acuerdo íntegro entre las partes respecto al sitio.',
        'Consultas sobre estas Condiciones: [CONTACT_EMAIL].',
      ],
    },
    {
      title: '16. Derechos Adicionales para Consumidores de la UE/EEE',
      content: [
        'Esta sección se aplica además de las anteriores a los consumidores residentes en la Unión Europea o el EEE. En caso de conflicto, prevalecen esta sección y la ley imperativa de consumo de tu país de residencia; las cláusulas de arbitraje y acción colectiva de la Sección 13 NO se te aplican.',
        'Derecho de desistimiento: puedes desistir de la compra en un plazo de 14 días desde la entrega física, sin motivo, mediante declaración inequívoca a [CONTACT_EMAIL]. Luego devuelves los bienes en 14 días; reembolsamos el precio y el envío estándar de ida en 14 días por el mismo medio de pago. Aplican excepciones (p. ej., bienes personalizados, precintados por higiene, perecederos). Si omitimos informarte de este derecho, el plazo se amplía hasta 12 meses.',
        'Garantía legal de conformidad: los bienes gozan de la garantía legal de conformidad de 2 años (Directiva (UE) 2019/771). Ante una falta de conformidad tienes derecho a reparación, sustitución, reducción del precio o resolución, conforme a la ley. Esta garantía no puede excluirse ni limitarse.',
        'Seguridad de los productos (RGSP): los productos cumplen el Reglamento (UE) 2023/988 (en vigor desde el 13 de diciembre de 2024). El responsable en la UE es: [EU_RESPONSIBLE_PERSON] — [EU_RESPONSIBLE_CONTACT].',
        'Accesibilidad (EAA): trabajamos para cumplir la Ley Europea de Accesibilidad (Directiva (UE) 2019/882, aplicable desde el 28 de junio de 2025); la declaración de accesibilidad está disponible a petición en [CONTACT_EMAIL].',
        'Reclamaciones y RAL: contacta con [CONTACT_EMAIL]; también puedes recurrir a los mecanismos de resolución alternativa disponibles en tu país. Nota: la plataforma ODR de la Comisión Europea se dio de baja el 20 de julio de 2025 y ya no está disponible.',
        'Siempre puedes acudir a los tribunales de tu lugar de residencia.',
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// FRANÇAIS
// ─────────────────────────────────────────────────────────────────────────────
const fr: TermsData = {
  lastUpdated: 'Juin 2026',
  sections: [
    {
      title: '1. Informations sur le Vendeur et Acceptation',
      content: [
        'Les présentes Conditions de Service (« Conditions ») constituent un accord contraignant entre vous (« utilisateur », « client ») et [SELLER_LEGAL_NAME] (« nous », « AURUM »), exploitant de ce site web.',
        'Vendeur : [SELLER_LEGAL_NAME] ([SELLER_ENTITY_TYPE]) — Adresse : [BUSINESS_ADDRESS] — Courriel : [CONTACT_EMAIL] — Téléphone : [SUPPORT_PHONE].',
        'En accédant au site, en créant un compte ou en passant commande, vous confirmez avoir lu, compris et accepté les présentes Conditions, ainsi que la Politique de Confidentialité et la Politique de Cookies, incorporées par référence.',
        'Si vous n\'acceptez pas les présentes Conditions, n\'utilisez pas le site et ne passez pas commande.',
      ],
    },
    {
      title: '2. Admissibilité et Compte',
      content: [
        'Pour acheter, vous devez avoir au moins 18 ans (ou l\'âge de la majorité dans votre juridiction) et être capable de conclure un contrat juridiquement contraignant.',
        'Si vous créez un compte, vous êtes responsable de la confidentialité de vos identifiants et de toute activité effectuée via votre compte. Signalez-nous immédiatement toute utilisation non autorisée.',
        'Vous vous engagez à fournir des informations exactes, à jour et complètes. Nous pouvons suspendre ou fermer les comptes contenant de fausses informations ou utilisés en violation des présentes Conditions.',
      ],
    },
    {
      title: '3. Produits, Descriptions et Disponibilité',
      content: [
        'Nous nous efforçons de décrire et d\'afficher les produits le plus précisément possible, y compris matériaux, dimensions et caractéristiques.',
        'Les images sont purement illustratives ; les couleurs et proportions réelles peuvent légèrement varier selon votre écran. Une telle variation ne constitue pas un défaut.',
        'Tous les produits sont soumis à disponibilité. Nous pouvons limiter les quantités, retirer des produits ou corriger des erreurs de description, de prix ou de disponibilité à tout moment, même après l\'envoi d\'une commande.',
        'Si un produit devient indisponible après votre commande, nous vous en informerons et proposerons un remplacement, une mise en réassort ou le remboursement intégral de l\'article concerné.',
      ],
    },
    {
      title: '4. Prix, Taxes et Paiement',
      content: [
        'Tous les prix sont indiqués en Dollars américains (USD) sauf indication contraire. Sauf mention, les prix n\'incluent pas les taxes applicables ; la taxe de vente, le cas échéant, est calculée et affichée au paiement.',
        'Nous nous réservons le droit de modifier les prix à tout moment. Le prix applicable est celui affiché au moment de la confirmation de la commande.',
        'Les paiements sont traités de manière sécurisée par Stripe, Inc. / Stripe Payments Europe, Ltd. (« Stripe »). Nous ne recevons ni ne conservons jamais le numéro complet de la carte sur nos serveurs. Stripe est certifiée PCI-DSS Niveau 1.',
        'En soumettant vos informations de paiement, vous déclarez être autorisé à utiliser le moyen de paiement. Si un débit est refusé ou annulé, nous pouvons annuler ou suspendre la commande concernée.',
        'Les montants de la commande (prix, livraison et taxes) sont calculés sur nos serveurs à partir des données officielles du catalogue ; tout montant envoyé par le navigateur est ignoré.',
      ],
    },
    {
      title: '5. Commandes et Acceptation',
      content: [
        'L\'envoi d\'une commande constitue une offre d\'achat. Aucun contrat n\'est formé tant que nous n\'avons pas confirmé l\'acceptation, généralement par l\'e-mail de confirmation ou l\'expédition du produit.',
        'Nous pouvons refuser ou annuler une commande — même après confirmation — pour des motifs tels que soupçon de fraude, erreurs de prix ou de stock, problèmes de paiement ou violation des présentes Conditions. Si nous annulons une commande payée, vous êtes intégralement remboursé.',
        'Vous recevrez des communications électroniques relatives à la commande (confirmation, expédition, livraison). Elles font partie de la transaction et sont envoyées indépendamment des préférences marketing.',
      ],
    },
    {
      title: '6. Livraison et Expédition',
      content: [
        'Nous livrons vers les destinations disponibles au paiement. Les délais de livraison estimés affichés sur la fiche produit et/ou au paiement sont des estimations, pas des garanties.',
        'La propriété et le risque de perte sont transférés à l\'utilisateur lors de la remise au transporteur, sauf disposition contraire de la loi impérative de consommation (voir la section UE/EEE : pour les consommateurs, le risque est transféré à la livraison physique).',
        'Un numéro de suivi est fourni par e-mail dès la remise du colis au transporteur. Nous ne sommes pas responsables des retards du transporteur hors de notre contrôle, mais nous vous assisterons en cas de perte ou de dommage.',
        'Vous êtes responsable de l\'exactitude de l\'adresse de livraison. Nous ne répondons pas des commandes livrées à une adresse erronée que vous avez fournie.',
      ],
    },
    {
      title: '7. Retours, Remboursements et Annulations',
      content: [
        'Clients des États-Unis et d\'autres pays hors UE/EEE : vous pouvez retourner les produits éligibles dans un délai de [RETURN_WINDOW] jours après la livraison, non utilisés et dans leur emballage d\'origine, sauf articles marqués vente finale ou non retournables pour raisons d\'hygiène ou de personnalisation.',
        'Pour initier un retour, contactez [CONTACT_EMAIL] en indiquant votre numéro de commande. Sauf si le retour résulte d\'une erreur de notre part ou d\'un produit défectueux, les frais de retour sont à la charge du client.',
        'Les remboursements approuvés sont effectués sur le moyen de paiement d\'origine dans un délai raisonnable après réception et contrôle du retour. Les frais d\'expédition initiaux ne sont pas remboursables, sauf si la loi l\'exige ou en cas d\'erreur de notre part.',
        'Cette politique volontaire est distincte et s\'ajoute aux droits légaux impératifs, y compris les droits des consommateurs de l\'UE/EEE décrits ci-dessous.',
      ],
    },
    {
      title: '8. Exclusion de Garanties',
      content: [
        'Sauf disposition expresse des présentes Conditions ou exigence de la loi applicable, le site et tous les produits et services sont fournis « EN L\'ÉTAT » et « SELON DISPONIBILITÉ », sans garantie d\'aucune sorte, expresse ou implicite.',
        'Dans la mesure maximale permise par la loi, nous excluons toute garantie implicite, y compris la qualité marchande, l\'adéquation à un usage particulier, la propriété et l\'absence de contrefaçon.',
        'Certaines juridictions n\'autorisent pas l\'exclusion de certaines garanties ; dans ces juridictions, les exclusions ne s\'appliquent que dans la mesure permise et vos droits légaux impératifs ne sont pas affectés.',
      ],
    },
    {
      title: '9. Limitation de Responsabilité',
      content: [
        'Dans la mesure maximale permise par la loi, nous et nos fournisseurs ne serons pas responsables des dommages indirects, accessoires, spéciaux, consécutifs ou punitifs, ni de la perte de profits, de données ou de réputation, résultant de votre utilisation du site ou d\'un produit.',
        'Notre responsabilité globale pour toute réclamation relative à une commande n\'excédera pas le montant que vous avez payé pour le(s) produit(s) à l\'origine de la réclamation.',
        'Rien dans les présentes Conditions ne limite la responsabilité qui ne peut être limitée par la loi, y compris la responsabilité en cas de décès ou de blessures corporelles dus à la négligence, à la fraude ou — pour les consommateurs de l\'UE/EEE — aux droits impératifs décrits ci-dessous.',
      ],
    },
    {
      title: '10. Indemnisation',
      content: [
        'Vous acceptez d\'indemniser et de dégager de toute responsabilité [SELLER_LEGAL_NAME] ainsi que ses dirigeants, employés et agents de toute réclamation, perte, responsabilité et dépense (y compris les frais juridiques raisonnables) résultant d\'un usage abusif du site, d\'une violation des présentes Conditions ou de toute loi ou droit de tiers.',
        'Cette clause ne s\'applique pas dans la mesure où la réclamation résulte de notre propre négligence ou faute intentionnelle, et n\'affecte pas les droits impératifs des consommateurs.',
      ],
    },
    {
      title: '11. Propriété Intellectuelle',
      content: [
        'Tout le contenu du site — textes, graphismes, logos, images et logiciels — appartient à [SELLER_LEGAL_NAME] ou à ses concédants et est protégé par les lois sur la propriété intellectuelle.',
        'Vous ne pouvez utiliser le site qu\'à des fins licites, personnelles et non commerciales. Vous ne pouvez pas copier, reproduire, distribuer ni créer d\'œuvres dérivées de notre contenu sans autorisation écrite préalable.',
        'AURUM et les marques associées sont des marques de [SELLER_LEGAL_NAME]. Les autres noms et logos appartiennent à leurs propriétaires respectifs.',
      ],
    },
    {
      title: '12. Utilisation Acceptable',
      content: [
        'Vous vous engagez à ne pas : utiliser le site à des fins illicites ; tenter d\'accéder sans autorisation à des systèmes ou comptes ; perturber le fonctionnement ou la sécurité du site ; effectuer du scraping ou de la rétro-ingénierie ; soumettre des commandes ou contenus faux, frauduleux ou abusifs.',
        'Nous pouvons enquêter et prendre des mesures — y compris la suspension de l\'accès et la coopération avec les autorités — contre les comportements violant la présente section.',
      ],
    },
    {
      title: '13. Règlement des Litiges — Arbitrage et Renonciation aux Actions Collectives',
      content: [
        'VEUILLEZ LIRE ATTENTIVEMENT CETTE SECTION — ELLE AFFECTE VOS DROITS. Elle s\'applique aux clients des États-Unis dans la mesure maximale permise par le Federal Arbitration Act et NE s\'applique PAS aux consommateurs de l\'UE/EEE (voir leur section) ni lorsque la loi l\'interdit.',
        'La plupart des problèmes peuvent être résolus à l\'amiable : contactez d\'abord [CONTACT_EMAIL] et accordez-nous 30 jours pour résoudre la question.',
        'Tout litige non résolu à l\'amiable sera tranché par un arbitrage individuel, définitif et contraignant, administré par [ARBITRATION_BODY] selon ses règles applicables aux consommateurs, plutôt que devant un tribunal, sous réserve du recours à une juridiction de proximité pour les demandes admissibles.',
        'RENONCIATION À L\'ACTION COLLECTIVE : les litiges seront menés uniquement sur une base individuelle et non en tant que demandeur ou membre d\'une action de groupe, collective ou représentative.',
        'OPT-OUT : vous pouvez renoncer à cette convention d\'arbitrage en envoyant un avis écrit à [CONTACT_EMAIL] dans les 30 jours suivant votre première acceptation des présentes Conditions ; l\'opt-out n\'affecte pas les autres parties des Conditions.',
      ],
    },
    {
      title: '14. Droit Applicable et Juridiction',
      content: [
        'Les présentes Conditions sont régies par les lois de l\'État de [GOVERNING_STATE], États-Unis, sans égard aux règles de conflit de lois.',
        'Sous réserve de la section sur l\'arbitrage, la juridiction exclusive pour toute procédure judiciaire autorisée est celle des tribunaux étatiques ou fédéraux situés dans [GOVERNING_STATE].',
        'Pour les consommateurs de l\'UE/EEE, ce choix de droit et de juridiction ne vous prive pas de la protection des lois impératives de votre pays de résidence (voir section UE/EEE).',
      ],
    },
    {
      title: '15. Modifications et Dispositions Générales',
      content: [
        'Nous pouvons mettre à jour les présentes Conditions de temps à autre. La version en vigueur est celle publiée sur cette page avec sa date de mise à jour. Les changements substantiels seront communiqués par des moyens raisonnables ; l\'utilisation continue après leur entrée en vigueur vaut acceptation.',
        'Si une disposition est jugée inapplicable, les autres demeurent pleinement en vigueur. Le non-exercice d\'un droit ne vaut pas renonciation.',
        'Vous ne pouvez pas céder les présentes Conditions sans notre accord ; nous pouvons les céder dans le cadre d\'une fusion, acquisition ou cession d\'actifs. Les présentes Conditions constituent l\'intégralité de l\'accord entre les parties concernant le site.',
        'Questions sur les présentes Conditions : [CONTACT_EMAIL].',
      ],
    },
    {
      title: '16. Droits Supplémentaires pour les Consommateurs de l\'UE/EEE',
      content: [
        'Cette section s\'applique en complément des précédentes aux consommateurs résidant dans l\'Union européenne ou l\'EEE. En cas de conflit, cette section et la loi impérative de consommation de votre pays de résidence prévalent ; les clauses d\'arbitrage et d\'action collective de la Section 13 NE s\'appliquent PAS à vous.',
        'Droit de rétractation : vous pouvez vous rétracter de l\'achat dans les 14 jours suivant la livraison physique, sans motif, par une déclaration non équivoque à [CONTACT_EMAIL]. Vous retournez ensuite les biens sous 14 jours ; nous remboursons le prix et les frais de livraison standard aller sous 14 jours par le même moyen de paiement. Des exceptions s\'appliquent (ex. biens personnalisés, scellés pour hygiène, périssables). Si nous omettons de vous informer de ce droit, le délai est prolongé jusqu\'à 12 mois.',
        'Garantie légale de conformité : les biens bénéficient de la garantie légale de conformité de 2 ans (Directive (UE) 2019/771). En cas de défaut de conformité, vous avez droit à la réparation, au remplacement, à la réduction du prix ou à la résolution, comme prévu par la loi. Cette garantie ne peut être exclue ni limitée.',
        'Sécurité des produits (RGSP) : les produits sont conformes au Règlement (UE) 2023/988 (en vigueur depuis le 13 décembre 2024). Le responsable dans l\'UE est : [EU_RESPONSIBLE_PERSON] — [EU_RESPONSIBLE_CONTACT].',
        'Accessibilité (EAA) : nous œuvrons pour respecter la Loi européenne sur l\'accessibilité (Directive (UE) 2019/882, applicable depuis le 28 juin 2025) ; la déclaration d\'accessibilité est disponible sur demande à [CONTACT_EMAIL].',
        'Réclamations et REL : contactez [CONTACT_EMAIL] ; vous pouvez aussi recourir aux mécanismes de règlement extrajudiciaire disponibles dans votre pays. Remarque : la plateforme RLL de la Commission européenne a été supprimée le 20 juillet 2025 et n\'est plus disponible.',
        'Vous pouvez toujours saisir les tribunaux de votre lieu de résidence.',
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────────────────────
export const termsContent: Record<AppLanguageCode, TermsData> = { it, en, es, fr };
