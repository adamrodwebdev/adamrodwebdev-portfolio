/**
 * Plateformes où jouer aux jeux du carrousel (1.9.0) : Playgama pour commencer, d'autres ensuite.
 * Une plateforme ajoutée ici peut servir dans le champ `play` de js/data/projects.js ;
 * le libellé du lien (« Jouer sur … ») est traduit dans js/i18n/messages.js (swiper.playOn).
 */
export const platforms = {
  playgama: { name: 'Playgama' },
};

/** Les liens d'un projet vers ses plateformes, dans l'ordre déclaré. */
export function playLinks(project) {
  return Object.entries(project.play ?? {}).map(([id, url]) => {
    if (!platforms[id]) throw new Error(`Plateforme inconnue : ${id} (${project.id})`);
    return { platform: platforms[id].name, url };
  });
}
