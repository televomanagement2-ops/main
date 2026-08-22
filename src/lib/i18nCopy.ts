import type { AppLanguageCode } from '../store/preferencesStore';

/**
 * EDITORIAL COPY DECK
 *
 * The redesign introduced new surfaces (editorial homepage sections, command
 * search, cart drawer, admin workspace) and re-voiced a handful of existing
 * lines. Those strings live here rather than being scattered through the base
 * dictionary so the brand voice can be read — and translated — as one piece.
 *
 * This deck is deep-merged over the base translations in i18n.ts, so a key
 * present in both wins from here.
 *
 * Note: accents are avoided in it/es/fr to match the existing dictionary.
 */
export type CopyDict = { [key: string]: string | CopyDict };

export const editorialCopy: Record<AppLanguageCode, CopyDict> = {
  /* ══════════════════════════════════════════════════════════ ENGLISH ══ */
  en: {
    common: { close: 'Close' },

    nav: {
      shop: 'Shop',
      collections: 'Collections',
      about: 'About',
      search: 'Search',
      collectionsNote: 'Every category in the store, with what belongs in each.',
      viewEverything: 'View everything',
    },

    search: {
      products: 'Products',
      navigate: 'Go to',
      categoryMeta: 'Category',
      pageMeta: 'Page',
      noResults: 'Nothing matches “{{query}}”.',
      hintNavigate: '↑↓ to browse',
      hintSelect: '↵ to open',
      hintClose: 'esc to close',
    },

    home: {
      sectionIndex: 'Page sections',
      editorEyebrow: 'The edit',
      editorTitle: 'Considered picks, chosen by us.',
      editorSubtitle: 'The pieces we keep coming back to, refreshed as the catalogue grows.',
      viewAll: 'View all products',
      hero: {
        eyebrow: 'Curated. Purposeful. Enduring.',
        title: 'Objects that\nbelong in your life.',
        subtitle: 'A thoughtful selection of products made to inspire, to simplify, and to last.',
        ctaPrimary: 'Explore the collection',
        ctaSecondary: 'Shop by category',
        badgeLabel: 'New arrival',
      },
      categories: {
        label: 'Shop by category',
        title: 'Find what fits your life.',
        browseAll: 'Browse everything',
        more: 'Also in store',
      },
      statement: {
        label: 'Our approach',
        lead: 'Good things should earn',
        emphasis: 'their place.',
        support:
          'We would rather carry fewer products and know each of them properly — where it comes from, how it is made, and how long it lasts.',
        link: 'How we choose',
      },
      story: {
        label: 'In use',
        title: 'Made to be lived with, not looked after.',
        link: 'See the collection',
      },
      showcase: {
        label: 'Also worth knowing',
        title: 'Quiet essentials',
        body: 'Small objects that make an ordinary day feel considered.',
        link: 'View all products',
      },
      service: { label: 'Service' },
      trust: {
        supportTitle: 'Customer support',
        supportDesc: 'Real people, weekdays',
      },
      closing: {
        title: 'Take your time. The good things wait.',
        body: 'Browse the full catalogue, or start with what we are recommending this week.',
        cta: 'Enter the shop',
      },
    },

    products: {
      catalogSubtitle: 'Everything currently in stock, in one place.',
      collectionEyebrow: 'Collection',
      category: 'Category',
      refine: 'Refine',
      clearFilters: 'Clear filters',
      applyFilters: 'Apply',
      priceRange: 'Price range',
      emptyTitle: 'Nothing here yet',
    },

    product: {
      notFoundLabel: 'Not found',
      meta: {
        shipping: 'Shipping',
        shippingValue: 'Calculated at checkout',
        returns: 'Returns',
        returnsValue: 'Free, unused, within the published window',
        sku: 'SKU',
        weight: 'Weight',
        availability: 'Availability',
      },
      sections: {
        storyLabel: 'About this piece',
        storyTitle: 'Why we chose it',
        storyFallback: 'A considered addition to the catalogue, selected for how it is made and how it lasts.',
        specsLabel: 'Specifications',
        serviceLabel: 'Service',
      },
      related: { label: 'Continue', title: 'You may also like' },
      reviews: { label: 'Reviews' },
    },

    cart: {
      label: 'Bag',
      removeShort: 'Remove',
      taxesNote: 'Shipping and taxes calculated at checkout.',
      viewCart: 'View full bag',
    },

    checkout: {
      assurance1: 'Payment is encrypted and handled by Stripe.',
      assurance2: 'Returns accepted within the published window.',
    },

    checkoutSuccess: { label: 'Confirmation' },
    checkoutCancel: { label: 'Checkout' },

    orderDetail: {
      timeline: { ordered: 'Ordered', paid: 'Paid', shipped: 'Shipped', delivered: 'Delivered' },
      tracking: 'Tracking',
      needHelp: 'Need help with this order?',
    },

    profile: {
      appearance: 'Appearance',
      recentOrders: 'Recent activity',
      allOrders: 'All orders',
      roleCustomer: 'Customer',
      adminTitle: 'You run this store',
      adminBody: 'Orders, catalogue, stock and finance — the whole workspace.',
      stats: {
        open: 'Open orders',
        openMeta: 'In progress right now',
        total: 'Orders placed',
        totalMeta: 'All time',
        spend: 'Lifetime spend',
        spendMeta: 'Paid orders only',
        since: 'Member since',
        sinceMeta: 'First sign-in',
      },
    },

    settings: {
      appearance: 'Appearance',
      language: 'Language',
      themeLight: 'Light',
      themeDark: 'Dark',
      themeSystem: 'System',
    },

    help: { contactLabel: 'Contact', contactHoursLabel: 'Hours' },
    legal: { contents: 'Contents' },

    auth: {
      label: 'Account',
      labelSignup: 'Join',
      quote: 'Considered things, beautifully made.',
    },

    admin: {
      viewStore: 'Open storefront',
      sections: { operate: 'Operate' },
      dashboard: {
        title: 'Overview',
        subtitle: 'Revenue, orders and anything that needs attention today.',
        vsPrevious: 'vs previous {{days}}d',
        periodRevenue: '{{amount}} in the last {{days}} days',
        range: 'Range',
        lastDays: '{{days}}d',
        needsReviewHint: 'Flagged for manual follow-up',
        openPaymentsMeta: 'Payment not settled',
        awaitingFulfilmentMeta: 'Paid, ready to ship',
        inTransit: 'In transit',
        inTransitMeta: 'Shipped, not yet delivered',
        completed: 'Completed',
        completedMeta: 'Delivered orders',
        recentOrders: 'Recent orders',
        allOrders: 'All orders',
        distribution: 'Order distribution',
      },
      orders: {
        subtitle: 'Every order, with the actions that move it forward.',
        emptyTitle: 'No orders to show',
        drawerEyebrow: 'Order',
        statusUpdated: 'Status updated',
        noTransitions: 'No further transitions from this state.',
        trackingHint: 'Tracking can be saved once the order is paid.',
        deliveredConfirmed: 'Marked as delivered',
        activity: 'Activity',
        activityPlaced: 'Order placed',
        activityTracking: 'Tracking added — {{id}}',
        activityDelivered: 'Marked delivered',
        activityRefunded: 'Refunded {{amount}}',
        activityUpdated: 'Last updated',
        count: { one: '{{count}} order', other: '{{count}} orders' },
        table: {
          order: 'Order',
          customer: 'Customer',
          status: 'Status',
          date: 'Date',
          total: 'Total',
          open: 'Open',
        },
      },
      catalog: {
        subtitle: 'Products, media, pricing and stock.',
        tabActive: 'Active',
        tabArchive: 'Archive',
        emptyTitle: 'Nothing in this view',
        lowStock: 'Low stock',
        stockUpdated: 'Stock updated for {{name}}',
        hidden: '{{name}} is now hidden',
        activated: '{{name}} is live',
        count: { one: '{{count}} product', other: '{{count}} products' },
        table: {
          product: 'Product',
          category: 'Category',
          price: 'Price',
          inventory: 'Inventory',
          status: 'Status',
          actions: 'Actions',
        },
        form: {
          mediaSection: 'Media',
          mediaHint: 'The first image becomes the one shown across the store.',
          infoSection: 'Core information',
          pricingSection: 'Pricing',
          inventorySection: 'Inventory',
          visibilitySection: 'Visibility',
          activeHint: 'Visible in the storefront',
          featuredHint: 'Eligible for the homepage edit',
          lowStockHint: 'Below this quantity the product is flagged as low stock.',
          created: 'Product created',
          saved: 'Changes saved',
          categoryCreated: 'Category created',
        },
      },
      finance: {
        subtitle: 'Revenue, distribution and refunds.',
        lifetime: 'Lifetime {{amount}}',
        refundedOrders: 'Refunded',
        refundedOrdersMeta: 'All time',
        emptyTitle: 'Nothing to refund',
        refundWarning: 'This returns the full amount to the original payment method and cannot be undone.',
      },
    },
  },

  /* ══════════════════════════════════════════════════════════ ITALIANO ══ */
  it: {
    common: { close: 'Chiudi' },

    nav: {
      shop: 'Negozio',
      collections: 'Collezioni',
      about: 'Chi siamo',
      search: 'Cerca',
      collectionsNote: 'Tutte le categorie del negozio, con cio che appartiene a ciascuna.',
      viewEverything: 'Vedi tutto',
    },

    search: {
      products: 'Prodotti',
      navigate: 'Vai a',
      categoryMeta: 'Categoria',
      pageMeta: 'Pagina',
      noResults: 'Nessun risultato per "{{query}}".',
      hintNavigate: '↑↓ per scorrere',
      hintSelect: '↵ per aprire',
      hintClose: 'esc per chiudere',
    },

    home: {
      sectionIndex: 'Sezioni della pagina',
      editorEyebrow: 'La selezione',
      editorTitle: 'Scelte con cura, una per una.',
      editorSubtitle: 'I pezzi a cui torniamo sempre, aggiornati con la crescita del catalogo.',
      viewAll: 'Vedi tutti i prodotti',
      hero: {
        eyebrow: 'Selezionati. Essenziali. Duraturi.',
        title: 'Oggetti che\nrestano nella tua vita.',
        subtitle: 'Una selezione ragionata di prodotti pensati per ispirare, semplificare e durare.',
        ctaPrimary: 'Scopri la collezione',
        ctaSecondary: 'Sfoglia per categoria',
        badgeLabel: 'Nuovo arrivo',
      },
      categories: {
        label: 'Sfoglia per categoria',
        title: 'Trova cio che ti somiglia.',
        browseAll: 'Sfoglia tutto',
        more: 'Anche in negozio',
      },
      statement: {
        label: 'Il nostro approccio',
        lead: 'Le cose buone devono meritarsi',
        emphasis: 'il loro posto.',
        support:
          'Preferiamo avere meno prodotti e conoscerli davvero: da dove vengono, come sono fatti e quanto durano.',
        link: 'Come scegliamo',
      },
      story: {
        label: 'In uso',
        title: 'Fatti per essere vissuti, non custoditi.',
        link: 'Guarda la collezione',
      },
      showcase: {
        label: 'Da conoscere',
        title: 'Essenziali discreti',
        body: 'Piccoli oggetti che rendono ogni giornata piu curata.',
        link: 'Vedi tutti i prodotti',
      },
      service: { label: 'Servizio' },
      trust: {
        supportTitle: 'Assistenza clienti',
        supportDesc: 'Persone vere, nei giorni feriali',
      },
      closing: {
        title: 'Prenditi il tuo tempo. Le cose buone aspettano.',
        body: 'Sfoglia il catalogo completo, o parti da cio che consigliamo questa settimana.',
        cta: 'Entra nel negozio',
      },
    },

    products: {
      catalogSubtitle: 'Tutto cio che e disponibile, in un solo posto.',
      collectionEyebrow: 'Collezione',
      category: 'Categoria',
      refine: 'Affina',
      clearFilters: 'Azzera filtri',
      applyFilters: 'Applica',
      priceRange: 'Fascia di prezzo',
      emptyTitle: 'Ancora nulla qui',
    },

    product: {
      notFoundLabel: 'Non trovato',
      meta: {
        shipping: 'Spedizione',
        shippingValue: 'Calcolata al checkout',
        returns: 'Resi',
        returnsValue: 'Gratuiti, non utilizzati, entro i termini indicati',
        sku: 'SKU',
        weight: 'Peso',
        availability: 'Disponibilita',
      },
      sections: {
        storyLabel: 'Su questo prodotto',
        storyTitle: 'Perche lo abbiamo scelto',
        storyFallback: 'Un ingresso ragionato in catalogo, scelto per come e fatto e per quanto dura.',
        specsLabel: 'Specifiche',
        serviceLabel: 'Servizio',
      },
      related: { label: 'Continua', title: 'Potrebbe interessarti' },
      reviews: { label: 'Recensioni' },
    },

    cart: {
      label: 'Borsa',
      removeShort: 'Rimuovi',
      taxesNote: 'Spedizione e imposte calcolate al checkout.',
      viewCart: 'Vedi la borsa',
    },

    checkout: {
      assurance1: 'Pagamento cifrato e gestito da Stripe.',
      assurance2: 'Resi accettati entro i termini indicati.',
    },

    checkoutSuccess: { label: 'Conferma' },
    checkoutCancel: { label: 'Checkout' },

    orderDetail: {
      timeline: { ordered: 'Ordinato', paid: 'Pagato', shipped: 'Spedito', delivered: 'Consegnato' },
      tracking: 'Tracciamento',
      needHelp: 'Serve aiuto con questo ordine?',
    },

    profile: {
      appearance: 'Aspetto',
      recentOrders: 'Attivita recente',
      allOrders: 'Tutti gli ordini',
      roleCustomer: 'Cliente',
      adminTitle: 'Gestisci questo negozio',
      adminBody: 'Ordini, catalogo, giacenze e finanze — tutto lo spazio di lavoro.',
      stats: {
        open: 'Ordini aperti',
        openMeta: 'In corso adesso',
        total: 'Ordini effettuati',
        totalMeta: 'Da sempre',
        spend: 'Totale speso',
        spendMeta: 'Solo ordini pagati',
        since: 'Cliente dal',
        sinceMeta: 'Primo accesso',
      },
    },

    settings: {
      appearance: 'Aspetto',
      language: 'Lingua',
      themeLight: 'Chiaro',
      themeDark: 'Scuro',
      themeSystem: 'Sistema',
    },

    help: { contactLabel: 'Contatti', contactHoursLabel: 'Orari' },
    legal: { contents: 'Indice' },

    auth: {
      label: 'Account',
      labelSignup: 'Registrati',
      quote: 'Oggetti pensati, fatti bene.',
    },

    admin: {
      viewStore: 'Apri il negozio',
      sections: { operate: 'Operazioni' },
      dashboard: {
        title: 'Panoramica',
        subtitle: 'Ricavi, ordini e tutto cio che richiede attenzione oggi.',
        vsPrevious: 'vs {{days}}g precedenti',
        periodRevenue: '{{amount}} negli ultimi {{days}} giorni',
        range: 'Intervallo',
        lastDays: '{{days}}g',
        needsReviewHint: 'Segnalati per verifica manuale',
        openPaymentsMeta: 'Pagamento non completato',
        awaitingFulfilmentMeta: 'Pagati, pronti da spedire',
        inTransit: 'In transito',
        inTransitMeta: 'Spediti, non ancora consegnati',
        completed: 'Completati',
        completedMeta: 'Ordini consegnati',
        recentOrders: 'Ordini recenti',
        allOrders: 'Tutti gli ordini',
        distribution: 'Distribuzione ordini',
      },
      orders: {
        subtitle: 'Ogni ordine, con le azioni che lo fanno avanzare.',
        emptyTitle: 'Nessun ordine da mostrare',
        drawerEyebrow: 'Ordine',
        statusUpdated: 'Stato aggiornato',
        noTransitions: 'Nessuna transizione disponibile da questo stato.',
        trackingHint: 'Il tracciamento si salva quando l ordine e pagato.',
        deliveredConfirmed: 'Segnato come consegnato',
        activity: 'Attivita',
        activityPlaced: 'Ordine effettuato',
        activityTracking: 'Tracciamento aggiunto — {{id}}',
        activityDelivered: 'Segnato consegnato',
        activityRefunded: 'Rimborsato {{amount}}',
        activityUpdated: 'Ultimo aggiornamento',
        count: { one: '{{count}} ordine', other: '{{count}} ordini' },
        table: {
          order: 'Ordine',
          customer: 'Cliente',
          status: 'Stato',
          date: 'Data',
          total: 'Totale',
          open: 'Apri',
        },
      },
      catalog: {
        subtitle: 'Prodotti, immagini, prezzi e giacenze.',
        tabActive: 'Attivi',
        tabArchive: 'Archivio',
        emptyTitle: 'Nulla in questa vista',
        lowStock: 'Scorte basse',
        stockUpdated: 'Giacenza aggiornata per {{name}}',
        hidden: '{{name}} ora e nascosto',
        activated: '{{name}} e online',
        count: { one: '{{count}} prodotto', other: '{{count}} prodotti' },
        table: {
          product: 'Prodotto',
          category: 'Categoria',
          price: 'Prezzo',
          inventory: 'Giacenza',
          status: 'Stato',
          actions: 'Azioni',
        },
        form: {
          mediaSection: 'Immagini',
          mediaHint: 'La prima immagine diventa quella mostrata nel negozio.',
          infoSection: 'Informazioni principali',
          pricingSection: 'Prezzo',
          inventorySection: 'Giacenza',
          visibilitySection: 'Visibilita',
          activeHint: 'Visibile nel negozio',
          featuredHint: 'Candidato alla selezione in home',
          lowStockHint: 'Sotto questa quantita il prodotto risulta in esaurimento.',
          created: 'Prodotto creato',
          saved: 'Modifiche salvate',
          categoryCreated: 'Categoria creata',
        },
      },
      finance: {
        subtitle: 'Ricavi, distribuzione e rimborsi.',
        lifetime: 'Totale storico {{amount}}',
        refundedOrders: 'Rimborsati',
        refundedOrdersMeta: 'Da sempre',
        emptyTitle: 'Nulla da rimborsare',
        refundWarning: 'Restituisce l intero importo al metodo di pagamento originale e non e reversibile.',
      },
    },
  },

  /* ══════════════════════════════════════════════════════════ ESPANOL ══ */
  es: {
    common: { close: 'Cerrar' },

    nav: {
      shop: 'Tienda',
      collections: 'Colecciones',
      about: 'Nosotros',
      search: 'Buscar',
      collectionsNote: 'Todas las categorias de la tienda, con lo que pertenece a cada una.',
      viewEverything: 'Ver todo',
    },

    search: {
      products: 'Productos',
      navigate: 'Ir a',
      categoryMeta: 'Categoria',
      pageMeta: 'Pagina',
      noResults: 'Nada coincide con "{{query}}".',
      hintNavigate: '↑↓ para navegar',
      hintSelect: '↵ para abrir',
      hintClose: 'esc para cerrar',
    },

    home: {
      sectionIndex: 'Secciones de la pagina',
      editorEyebrow: 'La seleccion',
      editorTitle: 'Elegidos con criterio, uno a uno.',
      editorSubtitle: 'Las piezas a las que siempre volvemos, actualizadas segun crece el catalogo.',
      viewAll: 'Ver todos los productos',
      hero: {
        eyebrow: 'Seleccionados. Esenciales. Duraderos.',
        title: 'Objetos que\npermanecen en tu vida.',
        subtitle: 'Una seleccion pensada de productos hechos para inspirar, simplificar y durar.',
        ctaPrimary: 'Descubre la coleccion',
        ctaSecondary: 'Explorar por categoria',
        badgeLabel: 'Recien llegado',
      },
      categories: {
        label: 'Explorar por categoria',
        title: 'Encuentra lo que encaja contigo.',
        browseAll: 'Ver todo',
        more: 'Tambien en tienda',
      },
      statement: {
        label: 'Nuestro enfoque',
        lead: 'Lo bueno debe ganarse',
        emphasis: 'su lugar.',
        support:
          'Preferimos tener menos productos y conocerlos de verdad: de donde vienen, como se hacen y cuanto duran.',
        link: 'Como elegimos',
      },
      story: {
        label: 'En uso',
        title: 'Hechos para vivirse, no para guardarse.',
        link: 'Ver la coleccion',
      },
      showcase: {
        label: 'Tambien interesante',
        title: 'Esenciales discretos',
        body: 'Pequenos objetos que hacen que el dia a dia se sienta cuidado.',
        link: 'Ver todos los productos',
      },
      service: { label: 'Servicio' },
      trust: {
        supportTitle: 'Atencion al cliente',
        supportDesc: 'Personas reales, dias laborables',
      },
      closing: {
        title: 'Tomate tu tiempo. Lo bueno espera.',
        body: 'Explora el catalogo completo o empieza por lo que recomendamos esta semana.',
        cta: 'Entrar en la tienda',
      },
    },

    products: {
      catalogSubtitle: 'Todo lo disponible ahora mismo, en un solo lugar.',
      collectionEyebrow: 'Coleccion',
      category: 'Categoria',
      refine: 'Afinar',
      clearFilters: 'Borrar filtros',
      applyFilters: 'Aplicar',
      priceRange: 'Rango de precio',
      emptyTitle: 'Aun no hay nada aqui',
    },

    product: {
      notFoundLabel: 'No encontrado',
      meta: {
        shipping: 'Envio',
        shippingValue: 'Calculado en el pago',
        returns: 'Devoluciones',
        returnsValue: 'Gratuitas, sin usar, dentro del plazo publicado',
        sku: 'SKU',
        weight: 'Peso',
        availability: 'Disponibilidad',
      },
      sections: {
        storyLabel: 'Sobre esta pieza',
        storyTitle: 'Por que la elegimos',
        storyFallback: 'Una incorporacion meditada al catalogo, elegida por como esta hecha y cuanto dura.',
        specsLabel: 'Especificaciones',
        serviceLabel: 'Servicio',
      },
      related: { label: 'Continuar', title: 'Tambien te puede gustar' },
      reviews: { label: 'Opiniones' },
    },

    cart: {
      label: 'Bolsa',
      removeShort: 'Quitar',
      taxesNote: 'Envio e impuestos calculados en el pago.',
      viewCart: 'Ver la bolsa',
    },

    checkout: {
      assurance1: 'El pago esta cifrado y gestionado por Stripe.',
      assurance2: 'Devoluciones aceptadas dentro del plazo publicado.',
    },

    checkoutSuccess: { label: 'Confirmacion' },
    checkoutCancel: { label: 'Pago' },

    orderDetail: {
      timeline: { ordered: 'Realizado', paid: 'Pagado', shipped: 'Enviado', delivered: 'Entregado' },
      tracking: 'Seguimiento',
      needHelp: 'Necesitas ayuda con este pedido?',
    },

    profile: {
      appearance: 'Apariencia',
      recentOrders: 'Actividad reciente',
      allOrders: 'Todos los pedidos',
      roleCustomer: 'Cliente',
      adminTitle: 'Tu gestionas esta tienda',
      adminBody: 'Pedidos, catalogo, stock y finanzas — todo el espacio de trabajo.',
      stats: {
        open: 'Pedidos abiertos',
        openMeta: 'En curso ahora',
        total: 'Pedidos realizados',
        totalMeta: 'Historico',
        spend: 'Gasto total',
        spendMeta: 'Solo pedidos pagados',
        since: 'Cliente desde',
        sinceMeta: 'Primer acceso',
      },
    },

    settings: {
      appearance: 'Apariencia',
      language: 'Idioma',
      themeLight: 'Claro',
      themeDark: 'Oscuro',
      themeSystem: 'Sistema',
    },

    help: { contactLabel: 'Contacto', contactHoursLabel: 'Horario' },
    legal: { contents: 'Contenido' },

    auth: {
      label: 'Cuenta',
      labelSignup: 'Unete',
      quote: 'Objetos pensados, bien hechos.',
    },

    admin: {
      viewStore: 'Abrir la tienda',
      sections: { operate: 'Operaciones' },
      dashboard: {
        title: 'Resumen',
        subtitle: 'Ingresos, pedidos y todo lo que necesita atencion hoy.',
        vsPrevious: 'vs {{days}}d anteriores',
        periodRevenue: '{{amount}} en los ultimos {{days}} dias',
        range: 'Rango',
        lastDays: '{{days}}d',
        needsReviewHint: 'Marcados para revision manual',
        openPaymentsMeta: 'Pago sin completar',
        awaitingFulfilmentMeta: 'Pagados, listos para enviar',
        inTransit: 'En transito',
        inTransitMeta: 'Enviados, aun no entregados',
        completed: 'Completados',
        completedMeta: 'Pedidos entregados',
        recentOrders: 'Pedidos recientes',
        allOrders: 'Todos los pedidos',
        distribution: 'Distribucion de pedidos',
      },
      orders: {
        subtitle: 'Cada pedido, con las acciones que lo hacen avanzar.',
        emptyTitle: 'No hay pedidos que mostrar',
        drawerEyebrow: 'Pedido',
        statusUpdated: 'Estado actualizado',
        noTransitions: 'No hay mas transiciones desde este estado.',
        trackingHint: 'El seguimiento se guarda cuando el pedido esta pagado.',
        deliveredConfirmed: 'Marcado como entregado',
        activity: 'Actividad',
        activityPlaced: 'Pedido realizado',
        activityTracking: 'Seguimiento anadido — {{id}}',
        activityDelivered: 'Marcado como entregado',
        activityRefunded: 'Reembolsado {{amount}}',
        activityUpdated: 'Ultima actualizacion',
        count: { one: '{{count}} pedido', other: '{{count}} pedidos' },
        table: {
          order: 'Pedido',
          customer: 'Cliente',
          status: 'Estado',
          date: 'Fecha',
          total: 'Total',
          open: 'Abrir',
        },
      },
      catalog: {
        subtitle: 'Productos, imagenes, precios y existencias.',
        tabActive: 'Activos',
        tabArchive: 'Archivo',
        emptyTitle: 'Nada en esta vista',
        lowStock: 'Pocas existencias',
        stockUpdated: 'Existencias actualizadas para {{name}}',
        hidden: '{{name}} ahora esta oculto',
        activated: '{{name}} esta publicado',
        count: { one: '{{count}} producto', other: '{{count}} productos' },
        table: {
          product: 'Producto',
          category: 'Categoria',
          price: 'Precio',
          inventory: 'Existencias',
          status: 'Estado',
          actions: 'Acciones',
        },
        form: {
          mediaSection: 'Imagenes',
          mediaHint: 'La primera imagen sera la que se muestre en la tienda.',
          infoSection: 'Informacion principal',
          pricingSection: 'Precio',
          inventorySection: 'Existencias',
          visibilitySection: 'Visibilidad',
          activeHint: 'Visible en la tienda',
          featuredHint: 'Candidato a la seleccion de portada',
          lowStockHint: 'Por debajo de esta cantidad el producto se marca como bajo de stock.',
          created: 'Producto creado',
          saved: 'Cambios guardados',
          categoryCreated: 'Categoria creada',
        },
      },
      finance: {
        subtitle: 'Ingresos, distribucion y reembolsos.',
        lifetime: 'Historico {{amount}}',
        refundedOrders: 'Reembolsados',
        refundedOrdersMeta: 'Historico',
        emptyTitle: 'Nada que reembolsar',
        refundWarning: 'Devuelve el importe completo al metodo de pago original y no se puede deshacer.',
      },
    },
  },

  /* ══════════════════════════════════════════════════════════ FRANCAIS ══ */
  fr: {
    common: { close: 'Fermer' },

    nav: {
      shop: 'Boutique',
      collections: 'Collections',
      about: 'A propos',
      search: 'Recherche',
      collectionsNote: 'Toutes les categories de la boutique, et ce qui les compose.',
      viewEverything: 'Tout voir',
    },

    search: {
      products: 'Produits',
      navigate: 'Aller a',
      categoryMeta: 'Categorie',
      pageMeta: 'Page',
      noResults: 'Aucun resultat pour "{{query}}".',
      hintNavigate: '↑↓ pour naviguer',
      hintSelect: '↵ pour ouvrir',
      hintClose: 'esc pour fermer',
    },

    home: {
      sectionIndex: 'Sections de la page',
      editorEyebrow: 'La selection',
      editorTitle: 'Choisis avec soin, un par un.',
      editorSubtitle: 'Les pieces sur lesquelles nous revenons toujours, mises a jour avec le catalogue.',
      viewAll: 'Voir tous les produits',
      hero: {
        eyebrow: 'Choisis. Essentiels. Durables.',
        title: 'Des objets qui\nrestent dans votre vie.',
        subtitle: 'Une selection reflechie de produits concus pour inspirer, simplifier et durer.',
        ctaPrimary: 'Decouvrir la collection',
        ctaSecondary: 'Parcourir par categorie',
        badgeLabel: 'Nouveaute',
      },
      categories: {
        label: 'Parcourir par categorie',
        title: 'Trouvez ce qui vous ressemble.',
        browseAll: 'Tout parcourir',
        more: 'Aussi en boutique',
      },
      statement: {
        label: 'Notre approche',
        lead: 'Les bonnes choses doivent meriter',
        emphasis: 'leur place.',
        support:
          'Nous preferons proposer moins de produits et vraiment les connaitre : leur origine, leur fabrication et leur duree de vie.',
        link: 'Comment nous choisissons',
      },
      story: {
        label: 'A l usage',
        title: 'Faits pour etre vecus, pas conserves.',
        link: 'Voir la collection',
      },
      showcase: {
        label: 'A decouvrir aussi',
        title: 'Essentiels discrets',
        body: 'De petits objets qui rendent le quotidien plus soigne.',
        link: 'Voir tous les produits',
      },
      service: { label: 'Service' },
      trust: {
        supportTitle: 'Service client',
        supportDesc: 'De vraies personnes, en semaine',
      },
      closing: {
        title: 'Prenez votre temps. Les bonnes choses attendent.',
        body: 'Parcourez tout le catalogue, ou commencez par nos recommandations de la semaine.',
        cta: 'Entrer dans la boutique',
      },
    },

    products: {
      catalogSubtitle: 'Tout ce qui est disponible, au meme endroit.',
      collectionEyebrow: 'Collection',
      category: 'Categorie',
      refine: 'Affiner',
      clearFilters: 'Effacer les filtres',
      applyFilters: 'Appliquer',
      priceRange: 'Fourchette de prix',
      emptyTitle: 'Rien ici pour l instant',
    },

    product: {
      notFoundLabel: 'Introuvable',
      meta: {
        shipping: 'Livraison',
        shippingValue: 'Calculee au paiement',
        returns: 'Retours',
        returnsValue: 'Gratuits, non utilises, dans le delai indique',
        sku: 'SKU',
        weight: 'Poids',
        availability: 'Disponibilite',
      },
      sections: {
        storyLabel: 'A propos de cette piece',
        storyTitle: 'Pourquoi nous l avons choisie',
        storyFallback: 'Un ajout reflechi au catalogue, choisi pour sa fabrication et sa longevite.',
        specsLabel: 'Caracteristiques',
        serviceLabel: 'Service',
      },
      related: { label: 'Continuer', title: 'Vous aimerez aussi' },
      reviews: { label: 'Avis' },
    },

    cart: {
      label: 'Panier',
      removeShort: 'Retirer',
      taxesNote: 'Livraison et taxes calculees au paiement.',
      viewCart: 'Voir le panier',
    },

    checkout: {
      assurance1: 'Paiement chiffre et gere par Stripe.',
      assurance2: 'Retours acceptes dans le delai indique.',
    },

    checkoutSuccess: { label: 'Confirmation' },
    checkoutCancel: { label: 'Paiement' },

    orderDetail: {
      timeline: { ordered: 'Commande', paid: 'Payee', shipped: 'Expediee', delivered: 'Livree' },
      tracking: 'Suivi',
      needHelp: 'Besoin d aide pour cette commande ?',
    },

    profile: {
      appearance: 'Apparence',
      recentOrders: 'Activite recente',
      allOrders: 'Toutes les commandes',
      roleCustomer: 'Client',
      adminTitle: 'Vous gerez cette boutique',
      adminBody: 'Commandes, catalogue, stock et finances — tout l espace de travail.',
      stats: {
        open: 'Commandes en cours',
        openMeta: 'En cours maintenant',
        total: 'Commandes passees',
        totalMeta: 'Depuis toujours',
        spend: 'Total depense',
        spendMeta: 'Commandes payees uniquement',
        since: 'Client depuis',
        sinceMeta: 'Premiere connexion',
      },
    },

    settings: {
      appearance: 'Apparence',
      language: 'Langue',
      themeLight: 'Clair',
      themeDark: 'Sombre',
      themeSystem: 'Systeme',
    },

    help: { contactLabel: 'Contact', contactHoursLabel: 'Horaires' },
    legal: { contents: 'Sommaire' },

    auth: {
      label: 'Compte',
      labelSignup: 'Rejoindre',
      quote: 'Des objets penses, bien faits.',
    },

    admin: {
      viewStore: 'Ouvrir la boutique',
      sections: { operate: 'Operations' },
      dashboard: {
        title: 'Vue d ensemble',
        subtitle: 'Chiffre d affaires, commandes et tout ce qui demande attention aujourd hui.',
        vsPrevious: 'vs {{days}}j precedents',
        periodRevenue: '{{amount}} sur les {{days}} derniers jours',
        range: 'Periode',
        lastDays: '{{days}}j',
        needsReviewHint: 'Signalees pour verification manuelle',
        openPaymentsMeta: 'Paiement non finalise',
        awaitingFulfilmentMeta: 'Payees, pretes a expedier',
        inTransit: 'En transit',
        inTransitMeta: 'Expediees, pas encore livrees',
        completed: 'Terminees',
        completedMeta: 'Commandes livrees',
        recentOrders: 'Commandes recentes',
        allOrders: 'Toutes les commandes',
        distribution: 'Repartition des commandes',
      },
      orders: {
        subtitle: 'Chaque commande, avec les actions qui la font avancer.',
        emptyTitle: 'Aucune commande a afficher',
        drawerEyebrow: 'Commande',
        statusUpdated: 'Statut mis a jour',
        noTransitions: 'Aucune transition possible depuis cet etat.',
        trackingHint: 'Le suivi peut etre enregistre une fois la commande payee.',
        deliveredConfirmed: 'Marquee comme livree',
        activity: 'Activite',
        activityPlaced: 'Commande passee',
        activityTracking: 'Suivi ajoute — {{id}}',
        activityDelivered: 'Marquee livree',
        activityRefunded: 'Remboursee {{amount}}',
        activityUpdated: 'Derniere mise a jour',
        count: { one: '{{count}} commande', other: '{{count}} commandes' },
        table: {
          order: 'Commande',
          customer: 'Client',
          status: 'Statut',
          date: 'Date',
          total: 'Total',
          open: 'Ouvrir',
        },
      },
      catalog: {
        subtitle: 'Produits, images, prix et stock.',
        tabActive: 'Actifs',
        tabArchive: 'Archive',
        emptyTitle: 'Rien dans cette vue',
        lowStock: 'Stock faible',
        stockUpdated: 'Stock mis a jour pour {{name}}',
        hidden: '{{name}} est maintenant masque',
        activated: '{{name}} est en ligne',
        count: { one: '{{count}} produit', other: '{{count}} produits' },
        table: {
          product: 'Produit',
          category: 'Categorie',
          price: 'Prix',
          inventory: 'Stock',
          status: 'Statut',
          actions: 'Actions',
        },
        form: {
          mediaSection: 'Images',
          mediaHint: 'La premiere image sera celle affichee dans la boutique.',
          infoSection: 'Informations principales',
          pricingSection: 'Prix',
          inventorySection: 'Stock',
          visibilitySection: 'Visibilite',
          activeHint: 'Visible dans la boutique',
          featuredHint: 'Eligible a la selection d accueil',
          lowStockHint: 'En dessous de cette quantite le produit est signale en stock faible.',
          created: 'Produit cree',
          saved: 'Modifications enregistrees',
          categoryCreated: 'Categorie creee',
        },
      },
      finance: {
        subtitle: 'Chiffre d affaires, repartition et remboursements.',
        lifetime: 'Total {{amount}}',
        refundedOrders: 'Remboursees',
        refundedOrdersMeta: 'Depuis toujours',
        emptyTitle: 'Rien a rembourser',
        refundWarning: 'Rembourse la totalite sur le moyen de paiement d origine, sans retour possible.',
      },
    },
  },
};
