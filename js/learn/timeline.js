/**
 * La ligne de temps d'un épisode (1.19.0) : ses battements, chacun avec sa durée en secondes. Le film
 * et la page interactive la lisent de la même façon : un instant t donne un battement et son avancée.
 */
export class Timeline {
  /** @param {readonly { id: string, seconds: number }[]} beats les battements, dans l'ordre */
  constructor(beats) {
    if (!Array.isArray(beats) || beats.length === 0) throw new TypeError('Une ligne de temps a au moins un battement');
    let start = 0;
    this.beats = Object.freeze(beats.map((beat) => {
      if (typeof beat.id !== 'string' || !/^[a-z][a-z0-9-]{0,31}$/.test(beat.id)) throw new TypeError(`Battement mal nommé : ${beat.id}`);
      if (!Number.isFinite(beat.seconds) || beat.seconds <= 0 || beat.seconds > 120) throw new RangeError(`Durée impossible pour ${beat.id} : ${beat.seconds}`);
      const entry = Object.freeze({ id: beat.id, start, end: start + beat.seconds });
      start = entry.end;
      return entry;
    }));
    this.duration = start;
  }

  /** L'indice du battement qui contient `t` (le dernier pour t ≥ la durée). */
  indexAt(t) {
    const index = this.beats.findIndex((beat) => t < beat.end);
    return index === -1 ? this.beats.length - 1 : Math.max(0, index);
  }

  /** Le battement nommé `id`. */
  beat(id) {
    const found = this.beats.find((beat) => beat.id === id);
    if (!found) throw new RangeError(`Aucun battement ${id}`);
    return found;
  }

  /** Le temps absolu d'un instant donné en secondes depuis le début du battement `id`. */
  at(id, seconds) {
    return this.beat(id).start + seconds;
  }
}
