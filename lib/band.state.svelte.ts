import { oklchaToRgba } from "./utils3";

export type Line = (null | string)[];
export type Band = Line[];
export type LCHA = [
  lightness: number,
  chroma: number,
  hue: number,
  alpha: number,
];

function createBandState(config: {
  minLength: number;
  initialLines: number;
  key: string;
}) {
  // ███████╗████████╗ █████╗ ████████╗███████╗    ██╗   ██╗████████╗██╗██╗     ███████╗
  // ██╔════╝╚══██╔══╝██╔══██╗╚══██╔══╝██╔════╝    ██║   ██║╚══██╔══╝██║██║     ██╔════╝
  // ███████╗   ██║   ███████║   ██║   █████╗      ██║   ██║   ██║   ██║██║     ███████╗
  // ╚════██║   ██║   ██╔══██║   ██║   ██╔══╝      ██║   ██║   ██║   ██║██║     ╚════██║
  // ███████║   ██║   ██║  ██║   ██║   ███████╗    ╚██████╔╝   ██║   ██║███████╗███████║
  // ╚══════╝   ╚═╝   ╚═╝  ╚═╝   ╚═╝   ╚══════╝     ╚═════╝    ╚═╝   ╚═╝╚══════╝╚══════╝
  // #region State Utils

  let key = $state(config.key);

  function loadFromLS<K>(k: string, el: () => K) {
    const rawValue = localStorage.getItem(`${key}_${k}`);
    if (rawValue) {
      return JSON.parse(rawValue) as K;
    } else {
      return el();
    }
  }

  function setLS(k: string, v: any) {
    localStorage.setItem(`${key}_${k}`, JSON.stringify(v));
  }

  function craftEmptyBand(lines: number): Band {
    return new Array(lines)
      .fill(null)
      .map(() => Array(config.minLength).fill(null));
  }

  // ███████╗████████╗ ██████╗ ██████╗  █████╗  ██████╗ ███████╗
  // ██╔════╝╚══██╔══╝██╔═══██╗██╔══██╗██╔══██╗██╔════╝ ██╔════╝
  // ███████╗   ██║   ██║   ██║██████╔╝███████║██║  ███╗█████╗
  // ╚════██║   ██║   ██║   ██║██╔══██╗██╔══██║██║   ██║██╔══╝
  // ███████║   ██║   ╚██████╔╝██║  ██║██║  ██║╚██████╔╝███████╗
  // ╚══════╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝
  // #region Storage

  const BAND_KEY = "band";
  let band: Band = $state(
    loadFromLS(BAND_KEY, () => craftEmptyBand(config.initialLines)),
  );
  let bandSaveTimer: number | null = null;
  $effect(() => {
    JSON.stringify(band);
    clearTimeout(bandSaveTimer!);
    bandSaveTimer = setTimeout(() => {
      setLS(BAND_KEY, band);
    }, 500);
  });

  function switchKey(newKey: string) {
    key = newKey;
    band = loadFromLS(BAND_KEY, () => craftEmptyBand(config.initialLines));
    cursor = loadFromLS("cursor", () => 0);
  }

  // One cursor per band
  const CURSOR_KEY = "cursor";
  let cursor = $state(loadFromLS(CURSOR_KEY, () => 0));
  $effect(() => {
    setLS(CURSOR_KEY, cursor);
  });

  // There is
  let bandLines = $derived(band.length);
  let bandLength = $derived(Math.max(...band.map((line) => line.length)));

  // ██╗   ██╗████████╗██╗██╗     ███████╗
  // ██║   ██║╚══██╔══╝██║██║     ██╔════╝
  // ██║   ██║   ██║   ██║██║     ███████╗
  // ██║   ██║   ██║   ██║██║     ╚════██║
  // ╚██████╔╝   ██║   ██║███████╗███████║
  //  ╚═════╝    ╚═╝   ╚═╝╚══════╝╚══════╝
  // #region Utils

  // Loop position assuming it starts on the cursor position
  // Max size
  function loopPos(x: number) {
    const maxSize = bandVirtualLength();
    const x2 = x % maxSize;
    const x3 = x2 < 0 ? x2 + maxSize : x2;
    return x3;
  }

  // Convert scene-gotten floating point position
  // first to axis + cursor then loop it
  function axisToLoopedPos(axis: number) {
    return loopPos(Math.floor(axis) + cursor);
  }

  // Lines are stored as 2D arrays
  // When reading the band, the lines are virtually extended to the
  // minimum length as if they were empty up to that point
  function bandVirtualLength() {
    return Math.max(bandLength, config.minLength);
  }

  function readBand(x: number, len: number) {
    const slice: Band = Array(bandLines)
      .fill(null)
      .map(() => []);
    for (let pos = x; pos < x + len; pos++) {
      const posLooped = loopPos(pos);
      for (let lineN = 0; lineN < bandLines; lineN++) {
        if (posLooped < bandLength) {
          slice[lineN]!.push(band[lineN]![posLooped] || null);
        } else {
          slice[lineN]!.push(null);
        }
      }
    }
    return slice;
  }

  //  ██████╗███╗   ███╗██████╗ ███████╗
  // ██╔════╝████╗ ████║██╔══██╗██╔════╝
  // ██║     ██╔████╔██║██║  ██║███████╗
  // ██║     ██║╚██╔╝██║██║  ██║╚════██║
  // ╚██████╗██║ ╚═╝ ██║██████╔╝███████║
  //  ╚═════╝╚═╝     ╚═╝╚═════╝ ╚══════╝
  // #region CMDS

  function paint(
    axis: number,
    cross: number,
    size: number,
    color: string | null,
  ) {
    const a = axisToLoopedPos(axis);
    band[Math.floor(cross)]![a] = color;
  }

  function sampleColor(axis: number, cross: number): string | null {
    const realAxis = axisToLoopedPos(axis);
    return band[Math.floor(cross)]![realAxis] || null;
  }

  function addSpace(axis: number) {
    const pos = axisToLoopedPos(axis);

    band.forEach((line) => {
      // const shiftLeft = line.length % 2 === 1;

      line = line.splice(pos, 0, null);
      // if (shiftLeft) {
      // shift(1);
      // }
    });
  }

  function removeSpace(axis: number) {
    const pos = axisToLoopedPos(axis);
    band.forEach((line) => {
      if (line.length === 1) {
        line[0] = null;
      } else {
        line.splice(pos, 1);
      }
    });
  }

  function emptySpace(axis: number) {
    const pos = axisToLoopedPos(axis);
    band.forEach((line) => {
      line[pos] = null;
    });
  }

  function shift(amount: number) {
    let cursor2 = cursor + amount;
    const len = bandVirtualLength();
    let cursor3 = cursor2 % len;
    if (cursor3 < 0) {
      cursor3 += len;
    }
    cursor = cursor3;
  }

  function fillWithSpectrum(axis: number) {
    const pos = axisToLoopedPos(axis);

    // Colors must be white, black, and then spectrum
    // with the size of bandSize
    // Generate list using lcha, then use lchaToRgba from utils3 to compress it
    const colorsList = Array(bandLines)
      .fill(null)
      .map((_, i) => {
        const lcha: LCHA = [0.8, 0.3, (i / bandLines) * 360, 1];
        return oklchaToRgba(...lcha);
      });

    colorsList.unshift("#000000");
    colorsList.unshift("#ffffff");

    band.forEach((line, i) => {
      line[pos] = colorsList[i]!;
    });
  }

  function fillWithGiberish(axis: number) {
    const randColor = () =>
      `#${Math.floor(Math.random() * 0x1000000).toString(16)}`;

    const pos = axisToLoopedPos(axis);

    band.forEach((line) => {
      line[pos] = randColor();
    });
  }

  function fillSpace(
    axis: number,
    cross: number,
    stageLength: number,
    color: string | null,
  ) {
    const a = Math.floor(axis);
    const c = Math.floor(cross);
    const bandSection = readBand(cursor, stageLength);
    const visited = new Set<string>();
    const startColor = bandSection[c]![a];
    type SquareCoord = { cross: number; axis: number };
    const pending: SquareCoord[] = [{ cross: c, axis: a }];

    while (pending.length > 0) {
      const current = pending.pop()!;
      const key = `${current.axis},${current.cross}`;

      if (visited.has(key)) {
        continue;
      }
      visited.add(key);

      if (
        current.cross < 0 ||
        current.cross >= bandSection.length ||
        current.axis < 0 ||
        current.axis >= bandSection[current.cross]!.length
      ) {
        continue;
      }

      const currentColor = bandSection[current.cross]![current.axis];
      if (currentColor !== startColor) {
        continue;
      }

      const loopedAxis = loopPos(current.axis + cursor);
      band[current.cross]![loopedAxis] = color;

      pending.push({ cross: current.cross + 1, axis: current.axis });
      pending.push({ cross: current.cross - 1, axis: current.axis });
      pending.push({ cross: current.cross, axis: current.axis + 1 });
      pending.push({ cross: current.cross, axis: current.axis - 1 });
    }
  }

  function reset() {
    band = craftEmptyBand(bandLines);
    cursor = 0;
  }

  function addLine() {
    band.push(Array(config.minLength).fill(null));
  }

  function removeLine() {
    if (band.length < 2) {
      return;
    }
    band.pop();
  }

  function loadFullBand(newBand: Band) {
    band = newBand;
    cursor = 0;
  }

  function normalizedBand() {
    const maxLength = Math.max(...band.map((l) => l.length), config.minLength);
    const nBand: Band = [];
    for (let line = 0; line < band.length; line++) {
      nBand[line] = [];
      for (let axis = 0; axis < maxLength; axis++) {
        nBand[line]![axis] = band[line]![axis] || null;
      }
    }
    return nBand;
  }

  // ███████╗██╗  ██╗██████╗  ██████╗ ██████╗ ████████╗███████╗
  // ██╔════╝╚██╗██╔╝██╔══██╗██╔═══██╗██╔══██╗╚══██╔══╝██╔════╝
  // █████╗   ╚███╔╝ ██████╔╝██║   ██║██████╔╝   ██║   ███████╗
  // ██╔══╝   ██╔██╗ ██╔═══╝ ██║   ██║██╔══██╗   ██║   ╚════██║
  // ███████╗██╔╝ ██╗██║     ╚██████╔╝██║  ██║   ██║   ███████║
  // ╚══════╝╚═╝  ╚═╝╚═╝      ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚══════╝
  // #region Exports

  return {
    // Data
    get band() {
      return band;
    },

    get bandLines() {
      return bandLines;
    },
    get bandLength() {
      return bandLength;
    },
    get cursor() {
      return cursor;
    },

    // Utils
    bandVirtualLength,
    readBand,

    // Commands

    fillWithSpectrum,
    fillWithGiberish,
    shift,
    loopPos,
    paint,
    sampleColor,
    addSpace,
    removeSpace,
    emptySpace,
    fillSpace,
    reset,
    addLine,
    removeLine,
    switchKey,
    loadFullBand,
    normalizedBand,
  };
}

export { createBandState };
