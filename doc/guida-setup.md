# Guida di installazione — Segnala Rogo

Tempo stimato: 30–45 minuti. Serve un account Google e un account GitHub.

Finché non completi questa guida il sito funziona in **modalità demo**: la mappa mostra tre segnalazioni di esempio e l'invio del modulo è disattivato, quindi nessun dato lascia il browser.

## Come funziona

```
Pagina web (GitHub Pages)  ── invia il modulo ──▶  Google Apps Script  ──▶  Google Sheet (foglio "Main")
        ▲                                                   ├──▶ email ai destinatari e al segnalante
        │                                                   └──▶ foto salvate nel repository GitHub (img/)
        └── legge i fogli "Aperte" e "Risolte" pubblicati come CSV
```

---

## 1. Repository GitHub

1. Crea un repository **nuovo e tuo** (pubblico, perché GitHub Pages gratuito lo richiede).
2. Carica tutti i file di questa cartella nella radice del repository.
3. Annota il tuo nome utente GitHub e il nome del repository: ti servono al punto 4.

## 2. Google Sheet

1. Crea un nuovo foglio Google e chiamalo, ad esempio, `Segnala Rogo`.
2. Rinomina la prima scheda in **`Main`** e lasciala vuota: le intestazioni le crea lo script al primo invio.
3. Aggiungi due schede, **`Aperte`** e **`Risolte`**, e incolla in ciascuna, nella cella **A1**, la formula qui sotto.
4. Copia l'**ID del foglio** dall'indirizzo: è la stringa tra `/d/` e `/edit`. Serve al punto 4.

> **Importante — privacy.** Le schede `Aperte` e `Risolte` vengono pubblicate su Internet. Le formule sotto pubblicano **solo** le colonne necessarie alla mappa e lasciano fuori nome, email del segnalante, token di risoluzione e testo del messaggio. Non sostituirle con `=Main!A:AN`, che renderebbe pubblici email e token.

La colonna `Stato` del foglio `Main` è la **AI** (non la AE: AE è `Testo_Messaggio`). Le formule usano già le lettere giuste per il foglio generato dallo script.

### Scheda `Aperte` — foglio con località Stati Uniti / Regno Unito (virgole)

```
=IFERROR(
  VSTACK(
    {"ID_Segnalazione","Data","Ora","Categoria","Categoria_Emoji","Urgenza","Descrizione","Lat","Long","Indirizzo_Completo","Via","Numero_Civico","Comune","Provincia","URL_Immagine","URL_Immagini","Stato","Data_Risoluzione"},
    CHOOSECOLS(
      FILTER(Main!A2:AN, Main!A2:A<>"", Main!AI2:AI<>"Risolta", Main!AI2:AI<>"Chiusa"),
      1,3,4,5,6,7,8,11,12,13,14,15,17,18,33,34,35,39
    )
  ),
  {"ID_Segnalazione","Data","Ora","Categoria","Categoria_Emoji","Urgenza","Descrizione","Lat","Long","Indirizzo_Completo","Via","Numero_Civico","Comune","Provincia","URL_Immagine","URL_Immagini","Stato","Data_Risoluzione"}
)
```

### Scheda `Aperte` — foglio con località Italia (punto e virgola)

Il modo più semplice per capire quale versione ti serve: incolla questa; se Google segnala un errore di sintassi, usa quella con le virgole dopo aver cambiato la località del foglio in *File → Impostazioni → Località*.

```
=IFERROR(
  VSTACK(
    {"ID_Segnalazione"\"Data"\"Ora"\"Categoria"\"Categoria_Emoji"\"Urgenza"\"Descrizione"\"Lat"\"Long"\"Indirizzo_Completo"\"Via"\"Numero_Civico"\"Comune"\"Provincia"\"URL_Immagine"\"URL_Immagini"\"Stato"\"Data_Risoluzione"};
    CHOOSECOLS(
      FILTER(Main!A2:AN; Main!A2:A<>""; Main!AI2:AI<>"Risolta"; Main!AI2:AI<>"Chiusa");
      1;3;4;5;6;7;8;11;12;13;14;15;17;18;33;34;35;39
    )
  );
  {"ID_Segnalazione"\"Data"\"Ora"\"Categoria"\"Categoria_Emoji"\"Urgenza"\"Descrizione"\"Lat"\"Long"\"Indirizzo_Completo"\"Via"\"Numero_Civico"\"Comune"\"Provincia"\"URL_Immagine"\"URL_Immagini"\"Stato"\"Data_Risoluzione"}
)
```

### Scheda `Risolte`

Usa la stessa formula della scheda `Aperte` (nella versione che funziona per il tuo foglio), ma nel `FILTER` sostituisci le due condizioni `Main!AI2:AI<>"Risolta"` e `Main!AI2:AI<>"Chiusa"` con questa sola condizione, uguale in entrambe le versioni:

```
(Main!AI2:AI="Risolta")+(Main!AI2:AI="Chiusa")
```

Nella versione con le virgole il `FILTER` diventa quindi:

```
FILTER(Main!A2:AN, Main!A2:A<>"", (Main!AI2:AI="Risolta")+(Main!AI2:AI="Chiusa"))
```

## 3. Pubblica le schede come CSV

Per **ciascuna** delle schede `Aperte` e `Risolte`:

1. *File → Condividi → Pubblica sul web*.
2. Nel primo menu scegli la scheda (non "Intero documento"), nel secondo **Valori separati da virgola (.csv)**.
3. *Pubblica* e copia l'indirizzo: sarà simile a `https://docs.google.com/spreadsheets/d/e/2PACX-…/pub?gid=…&single=true&output=csv`.

**Controllo obbligatorio:** apri i due indirizzi nel browser. La prima riga deve elencare solo le 18 colonne della formula e **non** deve contenere `Email_Segnalante`, `Nome_Segnalante` né `Token_Risoluzione`.

La scheda `Main` **non va mai pubblicata**.

## 4. Google Apps Script (il "backend")

1. Dal foglio: *Estensioni → Apps Script*.
2. Cancella il contenuto di `Codice.gs` e incolla il file `dati/apps-script-template.gs` di questo progetto.
3. In cima al file imposta:
   - `SHEET_ID` — l'ID del foglio del punto 2;
   - `NOME_COMUNE` — il nome mostrato come mittente delle email (ente, comune o associazione);
   - `SITE_URL` — l'indirizzo pubblico del sito, ad esempio `https://TUO-UTENTE.github.io/NOME-REPO/` (punto 8);
   - `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH` — il tuo account, il repository e il ramo (`main` o `master`).
4. **Foto (facoltativo):** se vuoi che le foto vengano salvate nel repository, serve un token GitHub (punto 5). Senza token le segnalazioni funzionano ma le foto non vengono conservate.

## 5. Token GitHub per le foto (facoltativo)

1. GitHub → *Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token*.
2. *Repository access*: **Only select repositories** → solo il tuo repository.
3. *Permissions → Contents*: **Read and write**. Nient'altro.
4. Copia il token (si vede una volta sola).
5. In Apps Script: *Impostazioni progetto → Proprietà script → Aggiungi* → nome `GITHUB_TOKEN`, valore il token. **Non scriverlo mai nel codice.**

> Le foto finiscono in `img/` del repository, che è pubblico: chiunque può vederle. Avvisa chi segnala di non fotografare persone riconoscibili.

## 6. Pubblica lo script come app web

1. *Distribuisci → Nuova distribuzione → App web*.
2. *Esegui come*: **Me** — *Chi ha accesso*: **Chiunque**.
3. Autorizza gli accessi richiesti e copia l'indirizzo che termina con `/exec`.
4. Aprendolo nel browser devi vedere `{"ok":true,"service":"SegnalaRogo","status":"attivo"}`.

Ogni volta che modifichi il codice dello script devi creare una **nuova versione** della distribuzione (*Distribuisci → Gestisci distribuzioni → modifica → Nuova versione*); l'indirizzo resta lo stesso.

## 7. Compila `js/config.js`

Apri `js/config.js` e imposta:

| Campo | Valore |
|---|---|
| `appsScriptUrl` | l'indirizzo `/exec` del punto 6 |
| `sheetsCsvAperte` | CSV della scheda `Aperte` (punto 3) |
| `sheetsCsvRisolte` | CSV della scheda `Risolte` (punto 3) |
| `mappa.lat`, `mappa.lng`, `mappa.zoom` | centro e zoom iniziali della tua zona |
| `destinatari[0].email` | l'indirizzo che riceve ogni segnalazione (vuoto = nessuna email) |

Puoi aggiungere altri destinatari: la prima email è quella principale, le altre ricevono la segnalazione in copia. Non c'è nessuna scelta per l'utente: ogni segnalazione è un rogo e va a tutti.

## 8. Attiva GitHub Pages

Nel repository: *Settings → Pages → Deploy from a branch* → ramo `main` (o `master`), cartella `/ (root)` → *Save*. Dopo uno-due minuti il sito è su `https://TUO-UTENTE.github.io/NOME-REPO/`. Questo è il valore da mettere in `SITE_URL` (punto 4).

## 9. Prova finale

1. Apri il sito e invia una segnalazione di prova con foto, posizione e una tua email.
2. Controlla che compaia una riga nel foglio `Main`.
3. Controlla che arrivino le due email (destinatario e conferma al segnalante).
4. Se hai attivato le foto, controlla che compaiano in `img/` nel repository.
5. Dopo 1–3 minuti il rogo deve comparire sulla mappa.
6. Clicca "Segna come risolta" nell'email del destinatario, conferma, e verifica che il rogo diventi verde.

## Problemi comuni

- **Il foglio non riceve dati**: controlla che `appsScriptUrl` finisca con `/exec` e che la distribuzione abbia accesso *Chiunque*. Apri la console del browser (F12) durante l'invio.
- **La mappa non mostra nulla**: i CSV pubblicati hanno una cache di 1–3 minuti. Controlla che le formule non mostrino errori.
- **Il link "Segna come risolta" non funziona**: controlla `SITE_URL` nello script.
- **Le email non arrivano**: Google limita gli invii (circa 100 al giorno per account gratuito). Controlla lo spam.
- **Le foto non compaiono**: verifica il token, i suoi permessi (`Contents: Read and write` sul repository giusto) e `GITHUB_OWNER`/`GITHUB_REPO`/`GITHUB_BRANCH`.

## Cose da sapere prima di pubblicare

- Questo modulo **documenta** i roghi, ma non è un canale di emergenza: la pagina invita a chiamare 115 / 112 per un incendio in corso. Non togliere quell'avviso.
- Chi segnala un rogo doloso può esporsi: tratta con cura nome ed email (restano nel foglio `Main`, che non va condiviso né pubblicato) e valuta chi deve poterli leggere.
- Sostituisci i segnaposto in `privacy.html` (titolare e contatti) e fai verificare l'informativa da chi può farlo (consulente privacy, ente di riferimento) prima di usare il sito in pubblico.
