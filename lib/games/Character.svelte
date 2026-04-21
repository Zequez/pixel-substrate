<script lang="ts">
  import type { Band } from "../band.state.svelte";
  import { onMount } from "svelte";
  import { createStarsPen } from "../brushes";

  const FLOOR = "#5e020fff";
  const SPAWN = "#ffffffff";
  const DANGER = "#da2d3cff";
  const WIN = "#5ec01aff";

  // #region State

  let canvasBg: HTMLCanvasElement = null!;
  let canvasCharacter: HTMLCanvasElement = null!;
  let canvasStarry: HTMLCanvasElement = null!;
  let stage: HTMLDivElement = null!;
  let stageLoc = { x: 0, y: 0, w: 0, h: 0 };

  let bgCtx: CanvasRenderingContext2D = null!;
  let chCtx: CanvasRenderingContext2D = null!;

  let starryPen: ReturnType<typeof createStarsPen> = null!;

  const { band }: { band: Band } = $props();
  const bandAxisUnits = $derived(Math.max(...band.map((row) => row.length)));
  const bandCrossUnits = $derived(band.length);
  const blockSizePx = $derived(stageLoc.h / bandCrossUnits);
  const dangerZones = $state<{ axis: number; cross: number }[]>([]);
  const greenZones = $state<{ axis: number; cross: number }[]>([]);

  let cameraAxisInUnits = $state(0); // 0-1
  const ACTIVE_ZONE_PCT = 0.2;
  let cameraAxisSize = $state(0.6); // 0-1

  let running = $state(true);
  let pos = $state({ axis: 0, cross: 0 });
  let speed = $state({ axis: 0, cross: 0 }); // Units / Second
  const ACCELLERATION = 25;
  const FRICTION = 1.5;
  const FRICTION_CUT_OFF = 0.15;
  const MAX_SPEED = 45;

  let keyMap = $state({
    A: 0,
    D: 0,
    W: 0,
    S: 0,
  });

  // function bandNav(B: Band) {}

  // #region Utils

  function eachPx(
    cb: (axis: number, cross: number, color: string | null) => void,
  ): void {
    for (let l = 0; l < band.length; l++) {
      const line = band[l]!;
      for (let px = 0; px < line.length; px++) {
        const pxColor = line[px] || null;
        cb(px, l, pxColor);
      }
    }
  }

  function analyzeBand() {
    eachPx((axis, cross, color) => {
      if (color === SPAWN) {
        cameraAxisInUnits = axis - stageLoc.w / blockSizePx / 2;
        pos.axis = axis;
        pos.cross = cross;
      } else if (color === DANGER) {
        dangerZones.push({ axis, cross });
      } else if (color === WIN) {
        greenZones.push({ axis, cross });
      }
    });
  }

  // #region onMount

  onMount(() => {
    bgCtx = canvasBg.getContext("2d")!;
    chCtx = canvasCharacter.getContext("2d")!;
    const starryCtx = canvasStarry.getContext("2d")!;
    starryPen = createStarsPen(starryCtx, 50);
    // squarePen = createSquarePen(bgCtx);
    handleStageResize();

    analyzeBand();

    draw();
  });

  $effect(() => {
    if (running) {
      frameId = requestAnimationFrame(loop);
    }

    return () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
    };
  });

  // function generateBgDrawFun(): (axis: number) => void {
  //   for (let l = 0; l < band.length; l++) {
  //     const line = band[l]!;
  //     for (let px = 0; px < line.length; px++) {
  //       const pxColor = line[px];
  //       switch (pxColor) {
  //         case SPAWN: {
  //           spawnPos = { axis: px, line: l };
  //           break;
  //         }
  //         case FLOOR: {
  //           break;
  //         }
  //       }
  //       const isSpawn = pxColor === SPAWN;
  //       const isFloor = pxColor === FLOOR;

  //       bgCtx.fillStyle = band[line][pixel] ? FLOOR : SPAWN;
  //       bgCtx.fillRect(pixel, line, 1, 1);
  //     }
  //   }
  // }

  // #region DRAW

  let frameId: number | null = null;
  let lastTime: number = 0;
  function loop(time: number) {
    const dt = (time - lastTime) / 1000;
    lastTime = time;
    for (let key in keyMap) {
      const k = key as keyof typeof keyMap;
      if (keyMap[k] > 0) {
        keyMap[k] += dt;
      }
    }

    let isAccelAxis = false;
    let isAccelCross = false;
    if (keyMap.A > 0) {
      speed.axis = Math.max(speed.axis - ACCELLERATION * dt, -MAX_SPEED);
      isAccelAxis = true;
    }
    if (keyMap.D > 0) {
      speed.axis = Math.min(speed.axis + ACCELLERATION * dt, MAX_SPEED);
      isAccelAxis = true;
    }
    if (keyMap.W > 0) {
      speed.cross = Math.max(speed.cross - ACCELLERATION * dt, -MAX_SPEED);
      isAccelCross = true;
    }
    if (keyMap.S > 0) {
      speed.cross = Math.min(speed.cross + ACCELLERATION * dt, MAX_SPEED);
      isAccelCross = true;
    }

    if (Math.abs(speed.cross) > FRICTION_CUT_OFF) {
      speed.cross *= 1 - FRICTION * dt;
    } else if (speed.cross !== 0 && !isAccelCross) {
      speed.cross = 0;
    }

    if (Math.abs(speed.axis) > FRICTION_CUT_OFF) {
      speed.axis *= 1 - FRICTION * dt;
    } else if (speed.axis !== 0 && !isAccelAxis) {
      speed.axis = 0;
    }

    const newAxis = pos.axis + speed.axis * dt;
    const newCross = pos.cross + speed.cross * dt;

    // const newAxis2 = newAxis < 0 ? newAxis + bandAxisUnits : newAxis;
    // const newCross2 = newCross < 0 ? newCross + bandCrossUnits : newCross;

    let rightWardLimit =
      cameraAxisInUnits + (stageLoc.w / blockSizePx) * (1 - ACTIVE_ZONE_PCT);
    let leftWardLimit =
      cameraAxisInUnits + (stageLoc.w / blockSizePx) * ACTIVE_ZONE_PCT;

    // console.log(rightWardLimit, leftWardLimit);

    // let stageSizeInBlocks = stageLoc.w / blockSizePx;
    // let newAxis2Pct = newAxis2 / stageSizeInBlocks;
    // let newCross2Pct = newCross2 / stageSizeInBlocks;
    // if (newAxis2Pct > ACTIVE_ZONE_PCT && newAxis2Pct < 1 - ACTIVE_ZONE_PCT) {
    //   pos.axis = newAxis2;
    // }
    // pos.cross = newCross2;

    if (Math.abs(speed.cross) > 0) {
      if (newCross < 0 || newCross > bandCrossUnits - 1) {
        speed.cross = -speed.cross;
        pos.cross = pos.cross + speed.cross * dt;
      } else {
        pos.cross = newCross;
      }
    }

    if (Math.abs(speed.axis) > 0) {
      const oldAxis = pos.axis;
      pos.axis = newAxis;

      if (newAxis > rightWardLimit || newAxis < leftWardLimit) {
        const dAxis = newAxis - oldAxis;
        const newCameraAxis = cameraAxisInUnits + dAxis;
        cameraAxisInUnits = newCameraAxis;
      }

      // if (newCameraAxis)

      // console.log("Camera Axis", cameraAxisInUnits);
    }

    function normalize(unit: number, max: number) {
      const unit2 = unit % max;
      const unit3 = unit2 < 0 ? unit2 + max : unit2;
      return unit3;
    }

    const fAxis = normalize(pos.axis, bandAxisUnits);
    const fCross = normalize(pos.cross, bandCrossUnits);
    for (let { axis, cross } of dangerZones) {
      const overlap =
        fAxis < axis + 1 &&
        fAxis + 1 > axis &&
        fCross < cross + 1 &&
        fCross + 1 > cross;
      if (overlap) {
        // running = false;
        speed.cross = 0;
        speed.axis = 0;
        break;
      }
    }

    greenZones.some(({ axis, cross }, i) => {
      const overlap =
        fAxis < axis + 1 &&
        fAxis + 1 > axis &&
        fCross < cross + 1 &&
        fCross + 1 > cross;
      if (overlap) {
        greenZones.splice(i, 1);
        return true;
      }
    });
    // for (let { axis, cross } of greenZones) {

    // console.log("MMMM", newAxis2, newCross2);

    draw();

    if (running) {
      frameId = requestAnimationFrame(loop);
    }
  }

  function draw() {
    drawBg();
    drawCharacter();
  }

  function drawBg() {
    bgCtx.clearRect(0, 0, stageLoc.w, stageLoc.h);

    // console.log(blockSize);
    // const bandAxisLengthPx = bandAxisUnits * blockSizePx;
    const cameraAxisPosPx = (cameraAxisInUnits % bandAxisUnits) * blockSizePx;

    // console.log(cameraAxisPosPx);

    // const startAxis = Math.floor(cameraAxisPosPx / blockSizePx);
    // console.log(startAxis);

    const sceneAxisStartUnits = Math.floor(cameraAxisPosPx / blockSizePx);
    const sceneAxisEndUnits =
      sceneAxisStartUnits + stageLoc.w / blockSizePx + 1;
    const sceneAxisStartPx = sceneAxisStartUnits * blockSizePx;
    // console.log(sceneAxisStartUnits);

    bgCtx.save();
    bgCtx.translate(-cameraAxisPosPx, 0);
    for (let cross = 0; cross < band.length; cross++) {
      const line = band[cross]!;
      for (let axis = sceneAxisStartUnits; axis < sceneAxisEndUnits; axis++) {
        let axisLineRef = axis % bandAxisUnits;

        // let axis2 = axis % bandAxisUnits;
        // console.log(axis2);
        const color =
          line[axisLineRef < 0 ? axisLineRef + bandAxisUnits : axisLineRef];
        if (color === FLOOR || color === DANGER) {
          bgCtx.fillStyle = color;
          const axisPx = axis * blockSizePx;
          const crossPx = cross * blockSizePx;
          bgCtx.fillRect(axisPx, crossPx, blockSizePx, blockSizePx);
          // bgCtx.fillRect
          // bgCtx.fillRect(px, l, 1, 1);
          // bgCtx1
        }
      }
    }

    greenZones.forEach(({ axis, cross }) => {
      bgCtx.fillStyle = WIN;
      const axisPx = axis * blockSizePx;
      const crossPx = cross * blockSizePx;
      bgCtx.fillRect(axisPx, crossPx, blockSizePx, blockSizePx);
    });
    bgCtx.restore();
  }

  // eachPx((axis, cross, color) => {
  //   if (color === FLOOR) {
  //     console.log()
  //     bgCtx.fillRect(axis, cross, 1, 1);
  //   }
  // });

  function drawCharacter() {
    chCtx.clearRect(0, 0, stageLoc.w, stageLoc.h);
    chCtx.fillStyle = "#fff";

    // let normalizeUnits = Math.floor(pos.axis / bandAxisUnits);

    const cameraAxisPosPx = cameraAxisInUnits * blockSizePx;

    chCtx.save();
    chCtx.translate(-cameraAxisPosPx, 0);

    const axisPx = pos.axis * blockSizePx;
    console.log(cameraAxisPosPx, axisPx);
    const crossPx = pos.cross * blockSizePx;
    chCtx.fillRect(axisPx, crossPx, blockSizePx, blockSizePx);

    chCtx.restore();

    // const w = chCtx.canvas.width;
    // const h = chCtx.canvas.height;
    // const axisPct = pos.axis / bandAxisUnits;
    // const crossPct = pos.cross / bandCrossUnits;
    // chCtx.beginPath();
    // chCtx.clearRect(0, 0, w, h);
    // const blockAxisLen = w / bandAxisUnits;
    // const blockCrossLen = h / bandCrossUnits;
    // chCtx.fillStyle = "#fff";
    // chCtx.fillRect(axisPct * w, crossPct * h, blockAxisLen, blockCrossLen);
    // // chCtx.arc(axisPct * w, crossPct * h, 10, 0, 2 * Math.PI);
    // // chCtx.fill();
    // // chCtx.stroke();
    // chCtx.closePath();
  }

  // #region Events

  function handleStageResize() {
    const { height, width, left, top } = stage.getBoundingClientRect();
    stageLoc = { x: left, y: top, w: width, h: height };
    canvasBg.height = height;
    canvasBg.width = width;
    canvasCharacter.height = height;
    canvasCharacter.width = width;
    canvasStarry.height = height;
    canvasStarry.width = width;

    starryPen.draw(0, 0, width, height);
  }

  function handleKeyDown(ev: KeyboardEvent) {
    if (ev.repeat) return;
    console.log(ev.code);
    switch (ev.code) {
      case "KeyA": {
        keyMap.A = 1;
        break;
      }
      case "KeyD": {
        keyMap.D = 1;
        break;
      }
      case "KeyW": {
        keyMap.W = 1;
        break;
      }
      case "KeyS": {
        keyMap.S = 1;
        break;
      }
    }
  }

  function handleKeyUp(ev: KeyboardEvent) {
    switch (ev.code) {
      case "KeyA": {
        keyMap.A = 0;
        break;
      }
      case "KeyD": {
        keyMap.D = 0;
        break;
      }
      case "KeyW": {
        keyMap.W = 0;
        break;
      }
      case "KeyS": {
        keyMap.S = 0;
        break;
      }
    }
  }

  // #region Trellis
</script>

<svelte:window
  onresize={handleStageResize}
  onkeydown={handleKeyDown}
  onkeyup={handleKeyUp}
/>

<div class="fixed size-full top-0 left-0 bg-red-300 z-20" bind:this={stage}>
  <div class="absolute left-0 top-0 font-mono text-white z-20">
    [{Math.round(cameraAxisInUnits * 100) / 100}] | [{pos.axis},{pos.cross}] [{Math.round(
      speed.axis * 10,
    ) / 10}, {Math.round(speed.cross * 10) / 10}]
    {JSON.stringify(keyMap)}
  </div>
  <canvas
    bind:this={canvasBg}
    style="image-rendering: pixelated;"
    class="w-full h-full absolute top-0 left-0 z-2"
  ></canvas>
  <canvas
    bind:this={canvasCharacter}
    class="w-full h-full absolute top-0 left-0 z-3"
  ></canvas>
  <canvas
    bind:this={canvasStarry}
    class="w-full h-full absolute top-0 left-0 z-1"
  ></canvas>
</div>
