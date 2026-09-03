import type { Idea } from '../../state/session';

/**
 * ~30 sample Polish ideas for the M3-1 prompt spike, written the way attendees
 * actually type on a phone: uneven length, some typos, some off-topic, one
 * carrying a name that the synthesis must strip (F-5.2 anonymity).
 *
 * The imagined site is a paved square in front of a railway station.
 */
const RAW: string[] = [
  'Więcej drzew, teraz nie ma gdzie się schować przed słońcem',
  'Ławki, ale takie z oparciem, nie te betonowe klocki',
  'zieleni, duzo zieleni, trawa krzewy cokolwiek',
  'Fontanna albo jakaś woda, latem tu się nie da wytrzymać',
  'Zdjąć część asfaltu i posadzić drzewa w gruncie, nie w donicach',
  'Stojaki na rowery przy wyjściu z dworca, teraz przypina się do znaków',
  'Zadaszona wiata rowerowa, żeby rower nie stał w deszczu',
  'Wypożyczalnia rowerów miejskich dokładnie tutaj',
  'Ścieżka rowerowa przez plac, bo teraz jeździ się po chodniku między ludźmi',
  'Kawiarnia z ogródkiem, żeby był powód tu zostać',
  'Mały targ w weekendy, warzywa, kwiaty',
  'Food trucki wieczorami',
  'Miejsce na koncerty, mała scena',
  'Wieczorem jest ciemno i strasznie, potrzebne normalne latarnie',
  'Lepsze oświetlenie, szczególnie przy przejściu do peronów',
  'Za mało światła przy postoju taksówek',
  'Toaleta publiczna, czynna, nie zamknięta na klucz',
  'Zadaszenie na przystanku, teraz stoi się w deszczu',
  'Tablica z rozkładem, taka duża i czytelna',
  'Plac zabaw dla dzieci, choćby mały',
  'Coś dla młodzieży, stoły do ping ponga albo betonowe siedzenia',
  'Psi wybieg albo chociaż miska z wodą',
  'Zlikwidować parking, oddać plac ludziom',
  'Zostawić kilka miejsc dla osób z niepełnosprawnością, resztę zabrać',
  'Samochody wjeżdżają wszędzie, trzeba to fizycznie zablokować słupkami',
  'Krawężniki są za wysokie, z wózkiem się nie da',
  'Kostka jest nierówna, na obcasach i z walizką to katorga',
  'Ścieżki dla osób niewidomych do wejścia na dworzec',
  'Śmietniki, bo teraz wszystko leży na ziemi',
  'Więcej koszy i częstsze opróżnianie, szczególnie w weekend',
  'Pytałem Pani Krystyny z kiosku i ona też mówi, że brakuje ławek',
  'Bilety są za drogie',
];

export const SAMPLE_IDEAS: Idea[] = RAW.map((text, index) => ({
  id: `i${index + 1}`,
  text,
  createdAt: 1_700_000_000_000 + index * 1_000,
}));

/** A name that must not survive into any synthesis. */
export const NAME_IN_IDEAS = 'Krystyn';
