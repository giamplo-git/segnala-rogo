/* ═══════════════════════════════════════════════════════════════════
   Segnala Rogo — FILE DI CONFIGURAZIONE
   Qui si impostano tutti i valori da personalizzare.
   Il resto del codice (js/rogo.js) legge da APP_CONFIG.
   ═══════════════════════════════════════════════════════════════════ */

const APP_CONFIG = {

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 1. GOOGLE SERVICES  (da compilare — vedi doc/guida-setup.md)
  //
  //    Finché sono vuoti la mappa mostra dati di esempio e l'invio
  //    delle segnalazioni è disattivato: nessun dato lascia il browser.
  //
  //    appsScriptUrl    URL "/exec" dell'app web di Google Apps Script
  //    sheetsCsvAperte  CSV pubblicato del foglio delle segnalazioni aperte
  //    sheetsCsvRisolte CSV pubblicato del foglio delle segnalazioni risolte
  //                     (facoltativo: se vuoto la mappa mostra solo le aperte)
  //
  //    ATTENZIONE: i fogli pubblicati NON devono contenere le colonne
  //    Email_Segnalante, Nome_Segnalante e Token_Risoluzione.
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  appsScriptUrl:    '',
  sheetsCsvAperte:  '',
  sheetsCsvRisolte: '',

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 2. IDENTITA' APP
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  app: {
    nome:     'Segnala Rogo',
    siteUrl:  '',            // URL pubblico del sito; vuoto = rilevato automaticamente
    hashtag:  '#SegnalaRogo',
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 3. MAPPA
  //    lat/lng/zoom: vista iniziale (imposta il centro della TUA zona).
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  mappa: {
    lat:          36.7167,   // Pachino (SR)
    lng:          15.0914,
    zoom:         13,        // zoom iniziale (9 ≈ area provinciale, 14 ≈ quartiere)
    maxZoom:      19,
    fitBoundsPad: 0.15,      // margine attorno ai marker (0 = nessuno, 0.5 = ampio)
    loadTimeout:  12000,     // timeout caricamento CSV in ms
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 4. DESTINATARI
  //    Ogni voce riceve per email OGNI segnalazione (la prima come
  //    destinatario principale, le altre in copia). Non ci sono
  //    pulsanti da scegliere: il tipo di segnalazione è sempre "rogo".
  //
  //    email: lascia '' se vuoi solo salvare la segnalazione nel foglio
  //           senza inviare email (nessun indirizzo = nessuna email).
  //    Esempio con due destinatari:
  //      { id:'vvf',  nome:'Vigili del Fuoco', categoria:'Incendio / rogo doloso',
  //        email:'indirizzo@esempio.it', icon:'fa-solid fa-fire-extinguisher' },
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  destinatari: [
    {
      id:        'rogo',
      nome:      'Segnalazione rogo',
      categoria: 'Incendio / rogo doloso',
      email:     '',
      icon:      'fa-solid fa-fire',
    },
  ],

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 5. IMPOSTAZIONI FORM
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  form: {
    maxFoto:           4,     // numero massimo di foto allegabili
    maxRisoluzioneImg: 1280,  // lato lungo massimo delle foto in px
    qualitaJpeg:       0.85,  // qualità JPEG (0.0–1.0)
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 6. CONDIVISIONE SOCIAL
  //    Togli da 'piattaforme' quelle che non vuoi mostrare.
  //    Valori ammessi: twitter, whatsapp, facebook, telegram, bluesky
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  social: {
    piattaforme:   ['twitter', 'whatsapp', 'facebook', 'telegram', 'bluesky'],
    maxTestoChars: 120,  // lunghezza massima della descrizione nel post
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 7. COLORI DEI MARKER SULLA MAPPA (per urgenza e stato)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  marker: {
    Alta:    '#e53535',  // rosso — incendio in corso / pericolo
    Normale: '#ff9900',  // arancione
    Bassa:   '#3cb4d8',  // azzurro — rogo già spento
    Risolta: '#3d5a47',  // verde scuro — segnalazione risolta
    default: '#d4820a',  // ambra — fallback
  },
};
