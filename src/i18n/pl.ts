/**
 * Single source of truth for every user-facing string in the app.
 * All UI text is Polish (requirement N-1). Nothing outside this file
 * should contain literal Polish copy.
 */
export const pl = {
  app: {
    name: 'Social Voting',
    loading: 'Ładowanie…',
    error: 'Coś poszło nie tak.',
    back: 'Wróć',
  },

  common: {
    retry: 'Ponów',
    regenerate: 'Generuj ponownie',
    visualize: 'Wizualizuj',
    reExpand: 'Rozwiń ponownie',
    next: 'Dalej',
    showGallery: 'Pokaż galerię',
    confirm: 'Czy na pewno?',
    yes: 'Tak',
    no: 'Nie',
    cancel: 'Anuluj',
    save: 'Zapisz',
    close: 'Zamknij',
    other: 'Inne',
  },

  settings: {
    title: 'Ustawienia',
    apiKeyLabel: 'Klucz API Google',
    apiKeyHint: 'Klucz jest zapisywany tylko w tej przeglądarce.',
    testKey: 'Testuj klucz',
    keyOk: 'Klucz działa poprawnie.',
    keyFailed: 'Klucz nie działa.',
    keyMissing: 'Brak klucza API.',
    clearKey: 'Usuń klucz',
  },

  admin: {
    listTitle: 'Sesje',
    newSession: 'Nowa sesja',
    sessionTitleLabel: 'Tytuł sesji',
    introLabel: 'Wprowadzenie (opcjonalne)',
    open: 'Otwórz',
    reset: 'Resetuj sesję',
    noSessions: 'Nie ma jeszcze żadnej sesji.',
    placeholder: 'Panel prowadzącego',
    create: 'Utwórz sesję',
    titleRequired: 'Podaj tytuł sesji.',
    titlePlaceholder: 'np. Plac przed dworcem',
    introPlaceholder: 'np. Jak urządzić to miejsce?',
    createdAt: 'Utworzono',
  },

  stages: {
    setup: 'Przygotowanie',
    voting: 'Głosowanie',
    grouping: 'Grupuję pomysły…',
    groupingHint: 'To potrwa kilkanaście sekund.',
    results: 'Wyniki',
    expanding: 'Rozwijanie promptów',
    expanded: 'Prompty gotowe',
    visualizing: 'Wizualizacja',
    gallery: 'Galeria',
  },

  results: {
    groupAgain: 'Grupuj ponownie',
    noGroups: 'Model nie zwrócił żadnej grupy.',
  },

  voting: {
    startVoting: 'Rozpocznij głosowanie',
    closeVoting: 'Zakończ głosowanie',
    scanQr: 'Zeskanuj kod QR telefonem',
    ideasCount: 'Zebrane pomysły',
  },

  attendee: {
    ideaLabel: 'Opisz swój pomysł na to miejsce',
    submit: 'Wyślij',
    thankYou: 'Dziękujemy!',
    thankYouHint: 'Twój pomysł został zapisany.',
    tooShort: 'Pomysł musi mieć co najmniej 10 znaków.',
    tooLong: 'Pomysł może mieć najwyżej 1000 znaków.',
    votingClosed: 'Głosowanie jest zakończone.',
    notOpenYet: 'Głosowanie jeszcze się nie zaczęło.',
    placeholder: 'Formularz uczestnika',
    inputPlaceholder: 'Napisz, co powinno się tu znaleźć…',
    sending: 'Wysyłam…',
    charsLeft: 'Pozostało znaków',
    charsNeeded: 'Brakuje znaków',
    thankYouAgain: 'Twój pomysł już do nas dotarł.',
  },

  resources: {
    title: 'Materiały kontekstowe',
    addImage: 'Dodaj obraz',
    addText: 'Dodaj tekst',
    description: 'Opis',
    useAsReference: 'Użyj jako referencji obrazu',
    remove: 'Usuń',
  },

  groups: {
    otherSynthesis: 'Pomysły, które nie trafiły do żadnej z pozostałych grup.',
    ideaCount: 'pomysłów',
  },

  /** Failures of the Google Gen AI calls. M6-2 extends this copy. */
  model: {
    invalidResponse: 'Model zwrócił nieprawidłową odpowiedź. Spróbuj ponownie.',
    emptyResponse: 'Model nie zwrócił odpowiedzi. Spróbuj ponownie.',
    badKey: 'Klucz API jest nieprawidłowy lub nie ma uprawnień.',
    quota: 'Przekroczono limit zapytań do modelu. Spróbuj ponownie za chwilę.',
    blocked: 'Model odrzucił zapytanie.',
    network: 'Nie udało się połączyć z modelem.',
    noIdeas: 'Brak pomysłów do pogrupowania.',
  },

  errors: {
    notFound: 'Nie znaleziono sesji.',
    invalidBody: 'Nieprawidłowe dane wejściowe.',
    notVoting: 'Głosowanie nie jest otwarte.',
    serverError: 'Błąd serwera.',
    notImplemented: 'Funkcja nie jest jeszcze zaimplementowana.',
    methodNotAllowed: 'Nieobsługiwana metoda.',
    network: 'Błąd połączenia.',
  },
} as const;

export type Strings = typeof pl;
