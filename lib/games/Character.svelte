<script lang="ts">
  import type { Band } from "../band.state.svelte";
  import { onMount } from "svelte";
  import { createStarsPen } from "../brushes";

  const FLOOR = "#5e020fff";
  const SPAWN = "#ffffffff";

  // #region State

  let canvasBg: HTMLCanvasElement = null!;
  let canvasCharacter: HTMLCanvasElement = null!;
  let canvasStarry: HTMLCanvasElement = null!;
  let stage: HTMLDivElement = null!;

  let bgCtx: CanvasRenderingContext2D = null!;
  let chCtx: CanvasRenderingContext2D = null!;

  let starryPen: ReturnType<typeof createStarsPen> = null!;

  const { band }: { band: Band } = $props();
  const bandAxisLength = $derived(Math.max(...band.map((row) => row.length)));
  const bandCrossLength = $derived(band.length);

  let cameraAxisPos = $state(0); // 0-1
  const ACTIVE_ZONE = 0.2;
  let cameraAxisSize = $state(0.6); // 0-1

  let running = $state(true);
  let pos = $state({ axis: 0, cross: 0 });
  let speed = $state({ axis: 0, cross: 0 });
  const ACCELLERATION = 5;
  const FRICTION = 0.5;

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
        pos.axis = axis;
        pos.cross = cross;
      }
    });
  }

  // #region onMount

  onMount(() => {
    analyzeBand();
    canvasBg.height = bandCrossLength;
    canvasBg.width = bandAxisLength;
    bgCtx = canvasBg.getContext("2d")!;
    chCtx = canvasCharacter.getContext("2d")!;
    const starryCtx = canvasStarry.getContext("2d")!;
    starryPen = createStarsPen(starryCtx, 50);
    // squarePen = createSquarePen(bgCtx);
    handleStageResize();

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

    if (keyMap.A > 0) {
      speed.axis = Math.max(speed.axis - ACCELLERATION * dt, -15);
    }
    if (keyMap.D > 0) {
      speed.axis = Math.min(speed.axis + ACCELLERATION * dt, 15);
    }
    if (keyMap.W > 0) {
      speed.cross = Math.max(speed.cross - ACCELLERATION * dt, -15);
    }
    if (keyMap.S > 0) {
      speed.cross = Math.min(speed.cross + ACCELLERATION * dt, 15);
    }

    speed.cross *= 1 - FRICTION * dt;
    speed.axis *= 1 - FRICTION * dt;

    const newAxis = (pos.axis + speed.axis * dt) % bandAxisLength;
    const newCross = (pos.cross + speed.cross * dt) % bandCrossLength;
    const newAxis2 = newAxis < 0 ? newAxis + bandAxisLength : newAxis;
    const newCross2 = newCross < 0 ? newCross + bandCrossLength : newCross;

    pos.axis = newAxis2;
    pos.cross = newCross2;

    // console.log("MMMM", newAxis2, newCross2);

    drawCharacter();

    if (running) {
      frameId = requestAnimationFrame(loop);
    }
  }

  function draw() {
    drawBg();
    drawCharacter();
  }

  function drawBg() {
    bgCtx.fillStyle = FLOOR;

    eachPx((axis, cross, color) => {
      if (color === FLOOR) {
        bgCtx.fillRect(axis, cross, 1, 1);
      }
    });
  }

  function drawCharacter() {
    const w = chCtx.canvas.width;
    const h = chCtx.canvas.height;
    const axisPct = pos.axis / bandAxisLength;
    const crossPct = pos.cross / bandCrossLength;
    chCtx.beginPath();
    chCtx.clearRect(0, 0, w, h);
    const blockAxisLen = w / bandAxisLength;
    const blockCrossLen = h / bandCrossLength;
    chCtx.fillStyle = "#fff";
    chCtx.fillRect(axisPct * w, crossPct * h, blockAxisLen, blockCrossLen);
    // chCtx.arc(axisPct * w, crossPct * h, 10, 0, 2 * Math.PI);
    // chCtx.fill();
    // chCtx.stroke();
    chCtx.closePath();
  }

  // #region Events

  function handleStageResize() {
    const { height, width } = stage.getBoundingClientRect();
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
        // speed.axis = Math.max(speed.axis - 0.1, -10);
        break;
      }
      case "KeyD": {
        keyMap.D = 1;
        // speed.axis = Math.min(speed.axis + 0.1, 10);
        break;
      }
      case "KeyW": {
        keyMap.W = 1;
        // speed.cross = Math.max(speed.cross - 0.1, -10);
        break;
      }
      case "KeyS": {
        keyMap.S = 1;
        // speed.cross = Math.min(speed.cross + 0.1, 10);
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
    [{pos.axis},{pos.cross}] [{Math.round(speed.axis * 10) / 10}, {Math.round(
      speed.cross * 10,
    ) / 10}]
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
