type Line = (null | string)[];
type Band = Line[];

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
    new Array(config.maxBands).fill(null).map((_, i) => craftEmptyBand(i)),
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

  function paint(axis: number, cross: number, size: number, color: string) {
    // Math.floor(axis)
    const a = loopPos(Math.floor(axis) + cursors[dimension]);
    band[Math.floor(cross)]![a] = color;
  }

  return {
    fillCurrentWithGiberish() {
      const randColor = () =>
        `#${Math.floor(Math.random() * 0x1000000).toString(16)}`;
      band.forEach((line) => {
        // Color from #000000 to #ffffff

        let start = line.length - 1;
        let len = Math.floor(Math.random() * 7);
        for (let i = start; i <= start + len; i++) {
          line[i] = randColor();
        }
      });
    },
    get bands() {
      return bands;
    },
    get band() {
      return band;
    },
    readBand(x: number, len: number) {
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
    },
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
    shift(amount: number) {
      cursors[dimension] += amount;
    },
    loopPos,
    paint,
  };
}

export { createBandsState };
