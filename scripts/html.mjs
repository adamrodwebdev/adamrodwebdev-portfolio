/** Échappe un texte pour le HTML (contenu et attributs entre guillemets doubles). */
export const escape = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
