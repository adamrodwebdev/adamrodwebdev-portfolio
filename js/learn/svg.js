/**
 * Fabrique d'éléments SVG (1.19.0) : des attributs posés un à un, jamais de balisage inséré par
 * innerHTML (la CSP du site refuse l'attribut style ; les attributs de présentation SVG restent permis).
 */
const NS = 'http://www.w3.org/2000/svg';

/** Un élément SVG `name` avec ses attributs, ajouté à `parent` s'il est donné. */
export function svg(name, attributes = {}, parent = null) {
  const element = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attributes)) {
    if (value !== null && value !== undefined) element.setAttribute(key, String(value));
  }
  if (parent) parent.append(element);
  return element;
}

/** Un texte SVG : son contenu passe par textContent, jamais par du balisage. */
export function svgText(content, attributes, parent) {
  const element = svg('text', attributes, parent);
  element.textContent = content;
  return element;
}

/** Un nombre arrondi au centième pour un attribut (des fichiers stables, des images identiques d'un rendu à l'autre). */
export const fixed = (value) => Math.round(value * 100) / 100;

/**
 * Le tracé d'une plaque chanfreinée, la coupe du site : coins coupés en haut à gauche et en bas à droite.
 * @param {{ x: number, y: number, width: number, height: number }} box
 * @param {number} cut la taille de la coupe
 */
export function chamfer({ x, y, width, height }, cut) {
  const c = Math.min(cut, width / 2, height / 2);
  return `M${fixed(x + c)} ${fixed(y)}H${fixed(x + width)}V${fixed(y + height - c)}L${fixed(x + width - c)} ${fixed(y + height)}H${fixed(x)}V${fixed(y + c)}Z`;
}

/** Les points d'une forme (sommets sur un rayon de 1) posée en (`x`, `y`), de rayon `r`, pour un <polygon>. */
export const shapePoints = (vertices, x, y, r) => vertices.map(([vx, vy]) => `${fixed(x + vx * r)},${fixed(y + vy * r)}`).join(' ');
