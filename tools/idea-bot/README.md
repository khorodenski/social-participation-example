# idea-bot — generator pomysłów testowych

Lokalne narzędzie do prób. Wkleja wymyślone pomysły do otwartej sesji, żeby dało
się przećwiczyć grupowanie, rozwijanie i obrazy bez sali pełnej ludzi.

**Nic z tego nie jest publikowane.** `tools/` leży poza `publish`, poza
`functions` i poza buildem Vite, więc na Netlify nie trafia.

## Jak uruchomić

```
npm run tester
```

Otwiera `http://localhost:5180`. Potem:

1. Wklej link do sesji — `/s/<id>`, `/admin/<id>` albo `/api/sessions/<id>`.
   Działa i tunel `netlify-cli dev --live`, i produkcja.
2. Kliknij **Sprawdź sesję**. Zobaczysz tytuł, etap i materiały, które zobaczy model.
3. Wklej klucz Google API, ustaw liczbę pomysłów, kliknij **Generuj**.
4. Popraw albo usuń, co chcesz, i kliknij **Wyślij do sesji**.

Sesja musi być w etapie **zbierania pomysłów** — inaczej funkcja odrzuci każdy
pomysł (409). Etap otwiera się w panelu lektora.

## Klucz API

Klucz zostaje w `localStorage` tej strony (tylko jeśli zaznaczysz „Zapamiętaj")
i w procesie node na czas jednego zapytania. Nie jest nigdzie zapisywany na dysk
ani drukowany w logach. Alternatywnie: nie wpisuj go w polu, tylko podaj przez
`GOOGLE_API_KEY` — tak jak robi `npm run verify:models`.

## Co robi pod spodem

Trzy publiczne, bezkluczowe endpointy aplikacji:

| Wywołanie                       | Po co                                                 |
| ------------------------------- | ----------------------------------------------------- |
| `GET /api/sessions/<id>`        | tytuł, wprowadzenie, notatki, klucze zdjęć            |
| `GET /api/assets/<klucz>`       | zdjęcie miejsca (bierze `previewKey`, nie `imageKey`) |
| `POST /api/sessions/<id>/ideas` | jedno zgłoszenie                                      |

Model tekstowy czyta z `src/api/google.ts`, więc zawsze jest ten sam, co
w aplikacji.

Serwer node jest potrzebny z jednego powodu: funkcje Netlify nie wysyłają
nagłówków CORS, więc strona z innego adresu nie odczytałaby ich odpowiedzi.
