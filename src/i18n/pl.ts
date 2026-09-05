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
    open: 'Ustawienia',
    placeholder: 'Wklej klucz z Google AI Studio',
    reveal: 'Pokaż',
    hide: 'Ukryj',
    testing: 'Sprawdzam klucz…',
    saved: 'Klucz zapisany w tej przeglądarce.',
    cleared: 'Klucz usunięty.',
    unsaved: 'Klucz nie został jeszcze zapisany.',
    imageSizeLabel: 'Rozdzielczość generowanych obrazów',
    imageSizeHint:
      'Ustawienie zapisuje się od razu, w tej przeglądarce. Dotyczy obrazów generowanych od tej chwili.',
    imageSize1K: '1K — szybciej (ok. 11 s na obraz)',
    imageSize2K: '2K — ostrzej na projektorze (ok. 20 s na obraz)',
    imageSizeSaved: 'Rozdzielczość zapisana w tej przeglądarce.',
    showIdeasLabel: 'Pokazuj pomysły w grupach',
    showIdeasHint:
      'Okno grupy pokaże pomysły, które do niej trafiły. Domyślnie wyłączone: pomysły są anonimowe, ale to nadal surowe wypowiedzi uczestników, a ekran jest rzutowany.',
    showIdeasSaved: 'Ustawienie zapisane w tej przeglądarce.',
    privacy:
      'Klucz nie opuszcza tej przeglądarki. Nie trafia na serwer ani do zapisanych danych sesji.',
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
    selectionHint: 'Wybierz grupy do wizualizacji',
    select: 'Wybierz',
    selected: 'Wybrano',
    showSynthesis: 'Pokaż syntezę grupy',
    synthesisTitle: 'Synteza',
    otherHint: 'Ta grupa nie przechodzi do wizualizacji.',
    noGroups: 'Model nie zwrócił żadnej grupy.',
    ideasHeading: 'Pomysły w tej grupie',
    ideasLoading: 'Wczytuję pomysły…',
    ideasFailed: 'Nie udało się wczytać pomysłów.',
    ideasEmpty: 'Ta grupa nie ma przypisanych pomysłów.',
  },

  expansion: {
    working: 'Piszę prompt…',
    hint: 'Trzy prompty powstają równolegle. To potrwa do dwóch minut.',
    promptLabel: 'Prompt do obrazu',
    failed: 'Nie udało się napisać promptu.',
    noSelection: 'Nie wybrano żadnej grupy.',
    ready: 'Gotowe',
  },

  gallery: {
    open: 'Otwórz na pełnym ekranie',
    previous: 'Poprzedni obraz',
    next: 'Następny obraz',
    noImages: 'Nie ma jeszcze żadnego obrazu.',
    hint: 'Kliknij obraz, aby otworzyć go na pełnym ekranie.',
  },

  visualize: {
    working: 'Generuję obraz…',
    hint: 'Trzy obrazy powstają równolegle.',
    failed: 'Nie udało się wygenerować obrazu.',
    noPrompt: 'Brak promptu dla tej grupy.',
    badImageType: 'Model zwrócił nieobsługiwany format obrazu.',
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

  setup: {
    detailsTitle: 'Sesja',
    detailsHint: 'Tytuł i wprowadzenie widzą uczestnicy na swoich telefonach.',
    unsaved: 'Niezapisane zmiany',
    discard: 'Odrzuć zmiany',
    saveFirst: 'Zapisz zmiany, zanim rozpoczniesz głosowanie.',
    attendeeLink: 'Adres dla uczestników',
  },

  resources: {
    title: 'Materiały kontekstowe',
    hint: 'Zdjęcia i notatki o miejscu. Model czyta je, kiedy pisze prompty do obrazów.',
    empty: 'Nie dodano jeszcze żadnego materiału.',
    addImage: 'Dodaj zdjęcie',
    addText: 'Dodaj notatkę',
    description: 'Opis',
    descriptionPlaceholder: 'np. Widok od strony dworca',
    text: 'Treść notatki',
    textPlaceholder: 'np. Plac ma 40 na 25 metrów, od południa zamyka go ściana kamienicy.',
    useAsReference: 'Referencja dla obrazu',
    referenceCount: 'Zdjęcia dla modelu obrazu',
    typeImage: 'Zdjęcie',
    typeText: 'Notatka',
    remove: 'Usuń',
    moveUp: 'Wyżej',
    moveDown: 'Niżej',
    uploading: 'Przygotowuję zdjęcie…',
    uploadFailed: 'Nie udało się wgrać zdjęcia.',
    imageMissing: 'Brak podglądu zdjęcia.',
    noCanvas: 'Ta przeglądarka nie potrafi przeskalować zdjęcia.',
    badResourceId: 'Nieprawidłowy identyfikator materiału.',
    decodeFailed: 'Nie udało się odczytać tego pliku jako zdjęcia.',
    encodeFailed: 'Nie udało się przygotować zdjęcia do wysłania.',
  },

  groups: {
    otherSynthesis: 'Pomysły, które nie trafiły do żadnej z pozostałych grup.',
    ideaCountOne: 'pomysł',
    ideaCountFew: 'pomysły',
    ideaCountMany: 'pomysłów',
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
    assetNotFound: 'Nie znaleziono pliku.',
    assetKey: 'Nieprawidłowy adres pliku.',
    assetType: 'Nieobsługiwany format pliku. Dozwolone są JPEG, PNG i WebP.',
    assetTooLarge: 'Plik jest za duży.',
    methodNotAllowed: 'Nieobsługiwana metoda.',
    network: 'Błąd połączenia.',
    // M6-2 — shown when a response carries no Polish message of its own, so
    // that `statusText` ("Gateway Timeout") never reaches a projected screen.
    timeout: 'Serwer nie odpowiedział na czas. Spróbuj ponownie.',
    unavailable: 'Serwer jest chwilowo niedostępny. Spróbuj ponownie.',
    badResponse: 'Serwer zwrócił nieoczekiwaną odpowiedź.',
  },
} as const;

export type Strings = typeof pl;

/**
 * Polish counts three ways — 1 pomysł, 2-4 pomysły, 5+ pomysłów — and the teens
 * take the last form. This number sits on a projected screen, so getting it
 * wrong is visible to a whole room.
 */
export function ideaCountLabel(count: number): string {
  const n = Math.abs(Math.trunc(count));
  if (n === 1) return pl.groups.ideaCountOne;

  const last = n % 10;
  const lastTwo = n % 100;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return pl.groups.ideaCountFew;

  return pl.groups.ideaCountMany;
}
