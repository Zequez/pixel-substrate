<script lang="ts">
  type Props = {
    values: number[];
    value: number;
    onChange?: (v: number) => void;
  };

  let { values, value, onChange }: Props = $props();

  function indexFromValue(v: number) {
    const i = values.indexOf(v);
    return i === -1 ? 0 : i;
  }

  function handleInput(e: Event) {
    const index = Number((e.target as HTMLInputElement).value);
    const v = values[index]!;
    onChange?.(v);
  }
</script>

<div class="flex-cs grow mr2">
  <input
    type="range"
    min="0"
    max={values.length - 1}
    step="1"
    value={indexFromValue(value)}
    oninput={handleInput}
    class="grow max-w-48 w-14"
  />
  <div
    class="text-white bg-black/50 text-sm rounded-r-1 overflow-hidden py0.5 w-12 text-center"
  >
    {value}
  </div>
</div>

<style>
  input[type="range"] {
    -webkit-appearance: none;
    margin: 10px 0;
  }
  input[type="range"]::-webkit-slider-runnable-track {
    height: 1.5rem;
    background: #444a;
    box-shadow: inset 0 0 3px 1px #0007;
    border-radius: 3px 0 0 3px;
  }

  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    border: 0px solid #aaa;
    height: 32px;
    width: 16px;
    border-radius: 3px;
    background: #ffffff;
    color: red;
    cursor: pointer;
    margin-top: -4px;
    box-shadow: inset 0 0 0px 1px #4444;
  }
</style>
