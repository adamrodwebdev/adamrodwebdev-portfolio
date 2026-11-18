/**
 * Les règles des sous-titres de la série (1.19.0), communes à tous les épisodes : des phrases clés de
 * 35 caractères au plus, chacune entièrement à l'écran au moins (caractères ÷ 15) + 1,5 s, jamais deux
 * à la fois. La voix fixe leurs vrais temps, langue par langue ; un test vérifie chaque épisode.
 */

/** Longueur maximale d'un sous-titre (caractères). */
export const CAPTION_MAX = 35;

/** Le temps qu'un texte doit rester entièrement à l'écran pour être lu (secondes). */
export const readSeconds = (text) => [...text].length / 15 + 1.5;
