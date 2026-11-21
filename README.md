# Segnala Rogo

Applicazione web per segnalare **incendi e roghi dolosi**. È una sola pagina: in alto la mappa con i roghi già segnalati, sotto il modulo per inviarne uno nuovo (posizione sulla mappa o GPS, foto, descrizione, contatto).

> **Un incendio è in corso?** Chiama subito il **115** (Vigili del Fuoco) o il **112**. Questo sito documenta i roghi, ma non sostituisce la chiamata di emergenza.

## Cosa fa

- Mappa unica: mostra i roghi già segnalati (colore per urgenza, verde se risolti) e serve anche per indicare dove si trova il nuovo rogo.
- Posizione da GPS, dai metadati EXIF della foto, oppure toccando la mappa e trascinando il segnaposto.
- Fino a 4 foto, ridimensionate nel browser prima dell'invio.
- Invio a Google Apps Script: riga nel foglio Google, email ai destinatari e conferma al segnalante.
- Link "Segna come risolta" nell'email del destinatario: apre questa stessa pagina e cambia lo stato del rogo.
- Condivisione facoltativa sui social, tema chiaro/scuro.

Nessun server da gestire: il sito è statico (GitHub Pages) e i dati stanno in un foglio Google.

## Stato iniziale: modalità demo

Finché non compili `js/config.js` la mappa mostra tre segnalazioni di esempio e **l'invio è disattivato**: nessun dato esce dal browser.

Per attivarlo segui [`doc/guida-setup.md`](doc/guida-setup.md) (circa 30–45 minuti).

## File

| Percorso | Contenuto |
|---|---|
| `index.html` | L'unica pagina dell'app |
| `js/config.js` | **Tutte le impostazioni**: URL Google, centro mappa, destinatari |
| `js/rogo.js` | Logica di mappa e modulo |
| `css/app.css`, `css/rogo.css` | Stili |
| `privacy.html` | Informativa privacy (bozza da completare) |
| `dati/apps-script-template.gs` | Codice del backend da incollare in Google Apps Script |
| `doc/guida-setup.md` | Guida di installazione |

## Prima di pubblicarlo

- Completa `privacy.html` (titolare, contatti, conservazione) e fallo verificare.
- Controlla che i CSV pubblicati **non** contengano email, nome del segnalante e token (la guida spiega come).
- Imposta `SITE_URL` nello script Apps Script, altrimenti il link "Segna come risolta" non funziona.

## Crediti e licenza

Segnala Rogo è un'opera derivata da **[SegnalaOra](https://github.com/gbvitrano/Segnalazioni)** di OpenDataSicilia e Giovan Battista Vitrano, rilasciata con licenza **[Creative Commons Attribuzione 4.0 (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/deed.it)**. Il testo della licenza è nel file `LICENSE`.

**Modifiche rispetto all'originale:** nome e testi; segnalazioni limitate ai roghi (tolti i pulsanti delle altre categorie e la scelta del destinatario); mappa e modulo riuniti in un'unica pagina; rimossi profilo utente, statistiche, pagina informativa, cookie banner e Google Analytics, automazioni GitHub Actions e dati di esempio; backend Apps Script rafforzato (nessuna ricerca per email, risoluzione solo con token, escape HTML nelle email, link di risoluzione fisso); vista satellitare Esri al posto di Google; consenso privacy reso obbligatorio.

Questo progetto è distribuito con la stessa licenza CC BY 4.0: se lo riusi, mantieni questi crediti e indica le tue modifiche.
