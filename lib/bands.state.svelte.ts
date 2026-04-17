import { oklchaToRgba } from "./utils3";

export type Line = (null | string)[];
export type Band = Line[];
export type LCHA = [
  lightness: number,
  chroma: number,
  hue: number,
  alpha: number,
];

function craftEmptyBand(n: number): Band {
  return new Array(2 ** n).fill(null).map(() => Array(100).fill(null));
}

function createBandsState(config: {
  maxBands: number;
  initialBand: number;
  minLength: number;
}) {
  // When dimension changes, the band changes
  // Current dimension
  // Each higher dimension duplicates the pixels in the bands
  let dimension = $state(config.initialBand);

  // There is one band per dimension
  // 1st band: |
  // 2nd band: ||
  // 3rd band: ||||
  // 4th band: |||| ||||
  let bands: Band[] = $state(
    new Array(config.maxBands).fill(null).map((_, i) => craftEmptyBand(i + 1)),
  );

  // One cursor per band
  let cursors = $state(Array(config.maxBands).fill(0));

  // There is
  let band = $derived(bands[dimension]!);
  let bandSize = $derived(band.length);
  let bandLength = $derived(Math.max(...band.map((line) => line.length)));

  const BAND_END_GAP = 0;

  function loopPos(x: number) {
    const x2 = x % (bandLength + BAND_END_GAP);
    const x3 = x2 < 0 ? x2 + bandLength + BAND_END_GAP : x2;
    return x3;
  }

  function paint(
    axis: number,
    cross: number,
    size: number,
    color: string | null,
  ) {
    // Math.floor(axis)
    const a = axisToLoopedPos(axis);
    band[Math.floor(cross)]![a] = color;
  }

  function sampleColor(axis: number, cross: number): string | null {
    const realAxis = axisToLoopedPos(axis);
    return band[Math.floor(cross)]![realAxis] || null;
  }

  function axisToLoopedPos(axis: number) {
    return loopPos(Math.floor(axis) + cursors[dimension]);
  }

  function addSpace(axis: number) {
    const pos = axisToLoopedPos(axis);

    band.forEach((line) => {
      const shiftLeft = line.length % 2 === 1;

      line = line.splice(pos, 0, null);
      if (shiftLeft) {
        // shift(1);
      }
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
    cursors[dimension] += amount;
  }

  function fillWithSpectrum(axis: number) {
    const pos = axisToLoopedPos(axis);

    // Colors must be white, black, and then spectrum
    // with the size of bandSize
    // Generate list using lcha, then use lchaToRgba from utils3 to compress it
    const colorsList = Array(bandSize)
      .fill(null)
      .map((_, i) => {
        const lcha: LCHA = [0.8, 0.3, (i / bandSize) * 360, 1];
        return oklchaToRgba(...lcha);
      });

    colorsList.unshift("#000000");
    colorsList.unshift("#ffffff");

    band.forEach((line, i) => {
      line[pos] = colorsList[i]!;
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
    const bandSection = readBand(cursors[dimension], stageLength);
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

      const loopedAxis = loopPos(current.axis + cursors[dimension]);
      band[current.cross]![loopedAxis] = color;

      pending.push({ cross: current.cross + 1, axis: current.axis });
      pending.push({ cross: current.cross - 1, axis: current.axis });
      pending.push({ cross: current.cross, axis: current.axis + 1 });
      pending.push({ cross: current.cross, axis: current.axis - 1 });
    }
  }

  function readBand(x: number, len: number) {
    const slice: Band = Array(bandSize)
      .fill(null)
      .map(() => []);
    let realBandEnd = bandLength + BAND_END_GAP;
    for (let pos = x; pos < x + len; pos++) {
      const posLooped = loopPos(pos);
      for (let lineN = 0; lineN < bandSize; lineN++) {
        if (posLooped < bandLength) {
          slice[lineN]!.push(band[lineN]![posLooped] || null);
        } else {
          slice[lineN]!.push(null);
        }
      }
    }
    return slice;
  }

  return {
    fillWithGiberish(axis: number) {
      const randColor = () =>
        `#${Math.floor(Math.random() * 0x1000000).toString(16)}`;

      const pos = axisToLoopedPos(axis);

      band.forEach((line) => {
        // Color from #000000 to #ffffff
        line[pos] = randColor();
        // let start = line.length - 1;
        // let len = Math.floor(Math.random() * 7);
        // for (let i = start; i <= start + len; i++) {
        //   // line[i] = randColor();
        // }
      });
    },
    fillWithSpectrum,
    get bands() {
      return bands;
    },
    get band() {
      return band;
    },
    readBand,
    get bandSize() {
      return bandSize;
    },
    get bandLength() {
      return bandLength;
    },
    get dimension() {
      return dimension;
    },
    get cursors() {
      return cursors;
    },
    get cursor() {
      return cursors[dimension];
    },
    nextDimension() {
      dimension = Math.min(dimension + 1, config.maxBands - 1);
    },
    previousDimension() {
      dimension = Math.max(dimension - 1, 0);
    },
    shift,
    loopPos,
    paint,
    sampleColor,
    addSpace,
    removeSpace,
    emptySpace,
    fillSpace,
  };
}

export { createBandsState };
