const DEFAULT_WORKER_URL = 'vendor/stockfish/stockfish-18-lite-single.js';
const MIN_NATIVE_ELO = 1320;

const ELO_LEVELS = Object.freeze([
  { elo: 400, label: 'Новичок I', multiPv: 8, randomRate: 0.18, weights: [0.10, 0.14, 0.18, 0.19, 0.16, 0.11, 0.07, 0.05], moveTime: 70 },
  { elo: 600, label: 'Новичок II', multiPv: 8, randomRate: 0.12, weights: [0.15, 0.19, 0.21, 0.18, 0.12, 0.08, 0.05, 0.02], moveTime: 80 },
  { elo: 800, label: 'Любитель', multiPv: 6, randomRate: 0.08, weights: [0.25, 0.25, 0.20, 0.15, 0.10, 0.05], moveTime: 90 },
  { elo: 1000, label: 'Любитель+', multiPv: 5, randomRate: 0.04, weights: [0.45, 0.30, 0.15, 0.07, 0.03], moveTime: 100 },
  { elo: 1200, label: 'Клубный новичок', multiPv: 4, randomRate: 0.02, weights: [0.70, 0.20, 0.08, 0.02], moveTime: 110 },
  { elo: 1400, label: 'Клубный', multiPv: 1, randomRate: 0, moveTime: 120 },
  { elo: 1600, label: 'Сильный клубный', multiPv: 1, randomRate: 0, moveTime: 140 },
  { elo: 1800, label: 'Эксперт', multiPv: 1, randomRate: 0, moveTime: 170 },
  { elo: 2000, label: 'Мастерский', multiPv: 1, randomRate: 0, moveTime: 210 },
  { elo: 2200, label: 'Мастер+', multiPv: 1, randomRate: 0, moveTime: 260 },
  { elo: 2400, label: 'Очень сильный', multiPv: 1, randomRate: 0, moveTime: 320 },
  { elo: 2600, label: 'Гроссмейстер', multiPv: 1, randomRate: 0, moveTime: 400 }
]);

function clampElo(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 800;
  return ELO_LEVELS.reduce((best, profile) => Math.abs(profile.elo - numeric) < Math.abs(best.elo - numeric) ? profile : best, ELO_LEVELS[0]).elo;
}

function profileForElo(value) {
  const elo = clampElo(value);
  return { ...ELO_LEVELS.find((profile) => profile.elo === elo) };
}

function moveToUci(move) {
  return `${move.from}${move.to}${move.promotion || ''}`.toLowerCase();
}

function normalizeLine(event) {
  return String(typeof event === 'string' ? event : event?.data ?? '').trim();
}

function chooseWeighted(candidates, weights, rng) {
  if (!candidates.length) return null;
  const normalized = candidates.slice(0, weights?.length || candidates.length);
  if (!weights?.length) return normalized[0];
  const total = weights.slice(0, normalized.length).reduce((sum, value) => sum + value, 0) || 1;
  let pick = rng() * total;
  for (let index = 0; index < normalized.length; index += 1) {
    pick -= weights[index] || 0;
    if (pick <= 0) return normalized[index];
  }
  return normalized[normalized.length - 1];
}

class ChessAIAdapter {
  constructor({
    workerUrl = DEFAULT_WORKER_URL,
    WorkerClass = globalThis.Worker,
    rng = Math.random,
    timeoutMs = 12000
  } = {}) {
    this.workerUrl = workerUrl;
    this.WorkerClass = WorkerClass;
    this.rng = rng;
    this.timeoutMs = timeoutMs;
    this.worker = null;
    this.initialized = false;
    this.initPromise = null;
    this.waiters = [];
    this.activeSearch = null;
    this.provider = 'Stockfish 18 lite';
    this.degraded = false;
  }

  _spawn() {
    if (this.worker) return;
    if (typeof this.WorkerClass !== 'function') throw new Error('Web Worker is not available');
    this.worker = new this.WorkerClass(this.workerUrl);
    this.worker.onmessage = (event) => this._handleLine(normalizeLine(event));
    this.worker.onerror = (event) => {
      const error = new Error(event?.message || 'Stockfish worker error');
      this.degraded = true;
      this._rejectAll(error);
    };
  }

  _handleLine(line) {
    if (!line) return;
    for (let index = this.waiters.length - 1; index >= 0; index -= 1) {
      const waiter = this.waiters[index];
      if (!waiter.predicate(line)) continue;
      this.waiters.splice(index, 1);
      clearTimeout(waiter.timer);
      waiter.resolve(line);
    }

    const search = this.activeSearch;
    if (!search) return;
    if (line.startsWith('info ')) {
      const multipv = Number(line.match(/\bmultipv\s+(\d+)/)?.[1] || 1);
      const pv = line.match(/\bpv\s+([a-h][1-8][a-h][1-8][qrbn]?)/i)?.[1]?.toLowerCase();
      if (pv && search.legal.has(pv)) search.candidates.set(multipv, pv);
      return;
    }
    if (line.startsWith('bestmove ')) {
      const best = line.match(/^bestmove\s+([a-h][1-8][a-h][1-8][qrbn]?)/i)?.[1]?.toLowerCase() || null;
      this.activeSearch = null;
      clearTimeout(search.timer);
      search.resolve(this._selectSearchMove(search, best));
    }
  }

  _selectSearchMove(search, best) {
    const legalList = [...search.legal];
    if (!legalList.length) return null;
    const profile = search.profile;
    if (profile.elo < MIN_NATIVE_ELO && this.rng() < profile.randomRate) {
      return legalList[Math.min(legalList.length - 1, Math.floor(this.rng() * legalList.length))];
    }
    if (profile.elo < MIN_NATIVE_ELO) {
      const ranked = [...search.candidates.entries()].sort((a, b) => a[0] - b[0]).map((entry) => entry[1]);
      const candidate = chooseWeighted(ranked, profile.weights, this.rng);
      if (candidate && search.legal.has(candidate)) return candidate;
    }
    if (best && search.legal.has(best)) return best;
    return legalList[0];
  }

  _rejectAll(error) {
    for (const waiter of this.waiters.splice(0)) {
      clearTimeout(waiter.timer);
      waiter.reject(error);
    }
    if (this.activeSearch) {
      const search = this.activeSearch;
      this.activeSearch = null;
      clearTimeout(search.timer);
      search.reject(error);
    }
  }

  _send(command) {
    if (!this.worker) throw new Error('Stockfish worker is not initialized');
    this.worker.postMessage(command);
  }

  _waitFor(predicate, label) {
    return new Promise((resolve, reject) => {
      const waiter = { predicate, resolve, reject, timer: null };
      waiter.timer = setTimeout(() => {
        const index = this.waiters.indexOf(waiter);
        if (index >= 0) this.waiters.splice(index, 1);
        reject(new Error(`Stockfish timeout waiting for ${label}`));
      }, this.timeoutMs);
      this.waiters.push(waiter);
    });
  }

  async _ready() {
    const ready = this._waitFor((line) => line === 'readyok', 'readyok');
    this._send('isready');
    await ready;
  }

  async init() {
    if (this.initialized) return this;
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      this._spawn();
      const uci = this._waitFor((line) => line === 'uciok', 'uciok');
      this._send('uci');
      await uci;
      this._send('setoption name Hash value 16');
      await this._ready();
      this.initialized = true;
      return this;
    })().catch((error) => {
      this.degraded = true;
      this.initPromise = null;
      throw error;
    });
    return this.initPromise;
  }

  async chooseMove({ fen, elo = 800, legalMoves = [] } = {}) {
    const legal = new Set(legalMoves.map((move) => typeof move === 'string' ? move.toLowerCase() : moveToUci(move)));
    if (!legal.size) return null;
    const profile = profileForElo(elo);

    try {
      await this.init();
      this.stop();
      this._send(`setoption name MultiPV value ${profile.multiPv}`);
      this._send('setoption name UCI_LimitStrength value true');
      this._send(`setoption name UCI_Elo value ${Math.max(MIN_NATIVE_ELO, profile.elo)}`);
      await this._ready();
      this._send(`position fen ${fen}`);

      return await new Promise((resolve, reject) => {
        const search = {
          resolve,
          reject,
          legal,
          profile,
          candidates: new Map(),
          timer: null
        };
        search.timer = setTimeout(() => {
          if (this.activeSearch !== search) return;
          this.activeSearch = null;
          this.degraded = true;
          this._send('stop');
          resolve([...legal][0]);
        }, this.timeoutMs);
        this.activeSearch = search;
        this._send(`go movetime ${profile.moveTime}`);
      });
    } catch (error) {
      this.degraded = true;
      return [...legal][0];
    }
  }

  stop() {
    if (!this.worker) return;
    if (this.activeSearch) this._send('stop');
  }

  destroy() {
    this.stop();
    this._rejectAll(new Error('Stockfish adapter destroyed'));
    this.worker?.terminate?.();
    this.worker = null;
    this.initialized = false;
    this.initPromise = null;
  }

  snapshot() {
    return {
      provider: this.provider,
      workerUrl: this.workerUrl,
      initialized: this.initialized,
      degraded: this.degraded
    };
  }
}

export { ChessAIAdapter, DEFAULT_WORKER_URL, ELO_LEVELS, MIN_NATIVE_ELO, clampElo, moveToUci, profileForElo };
