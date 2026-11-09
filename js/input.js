/**
 * Données venues de l'extérieur vérifiées à la porte (règle du 2026-11-09) : un texte est une
 * chaîne nettoyée, de longueur bornée dans le code. Portage JavaScript du nettoyage de
 * `.helpers/input-validation/input.ts` (mêmes étapes, mêmes caractères retirés).
 */

/** Longueurs maximales des champs du formulaire, en caractères (code points) */
export const TEXT_LIMITS = Object.freeze({ name: 80, email: 180, company: 120, message: 1500, honeypot: 500 });

/** Caractères invisibles retirés de tout texte, en plages [premier, dernier] */
const INVISIBLE = [
  [0x00, 0x08], // contrôles C0 avant la tabulation
  [0x0b, 0x0c], // tabulation verticale, saut de page
  [0x0e, 0x1f], // contrôles C0 après le retour chariot
  [0x7f, 0x9f], // effacement et contrôles C1
  [0x200b, 0x200b], // espace de largeur nulle
  [0x202a, 0x202e], // enchâssements et inversions bidirectionnels (« Trojan Source »)
  [0x2060, 0x2064], // gluon de mots, opérateurs invisibles
  [0x2066, 0x2069], // isolats bidirectionnels
  [0xd800, 0xdfff], // demi-paires orphelines
  [0xfeff, 0xfeff], // marque d'ordre des octets
  [0xe0000, 0xe007f], // caractères d'étiquette
];

const isInvisible = (character) => {
  const code = character.codePointAt(0) ?? 0;
  return INVISIBLE.some(([first, last]) => code >= first && code <= last);
};

/**
 * Nettoie un texte sans changer ce qu'il dit : fins de ligne unifiées, invisibles retirés
 * (les liants U+200C et U+200D restent : emoji, plusieurs écritures), Unicode composé (NFC),
 * espaces resserrés sur une ligne, bords taillés. Idempotent. N'échappe pas le HTML.
 */
export function cleanText(text, multiline = false) {
  if (typeof text !== 'string') return '';
  const visible = [...text.replace(/\r\n?/g, '\n')].filter((character) => !isInvisible(character)).join('');
  const composed = visible.normalize('NFC');
  return (multiline ? composed : composed.replace(/\s+/g, ' ')).trim();
}

/** Longueur en caractères (un emoji compte pour un, comme dans une base de données) */
export const textLength = (text) => [...text].length;
