<!--
  Revathi Arts — Wordmark (Svelte)

  A type-led logo lockup. Drop into your SvelteKit app's components.
  Loads Newsreader + Geist from Google Fonts in your root layout's <svelte:head>:

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,400;1,400&family=Geist:wght@400;500&display=swap" rel="stylesheet">

  Usage:
    <Wordmark />                  default (md)
    <Wordmark size="sm" />        for nav/header
    <Wordmark size="xl" />        for hero/landing
    <Wordmark inverted />         on dark backgrounds
    <Wordmark monochrome />       no accent
-->

<script lang="ts">
  type Size = 'sm' | 'md' | 'lg' | 'xl';

  export let size: Size = 'md';
  export let monochrome: boolean = false;
  export let inverted: boolean = false;
  export let accent: string = '#2f3da8'; // indigo ink — matches the app

  const SIZES: Record<Size, {
    name: number; top: number; flourish: number; sub: number;
    gapTop: number; gapFl: number; gapSub: number;
  }> = {
    sm: { name: 28,  top: 9,  flourish: 56,  sub: 13, gapTop: 8,  gapFl: 12, gapSub: 10 },
    md: { name: 64,  top: 10, flourish: 110, sub: 14, gapTop: 14, gapFl: 18, gapSub: 14 },
    lg: { name: 96,  top: 12, flourish: 160, sub: 18, gapTop: 18, gapFl: 22, gapSub: 18 },
    xl: { name: 240, top: 28, flourish: 240, sub: 44, gapTop: 34, gapFl: 36, gapSub: 30 },
  };

  $: s = SIZES[size];
  $: ink = inverted ? '#f6f4ef' : '#221c2e';
  $: muted = inverted ? '#a8a6b8' : '#6e6c80';
  $: subColor = inverted ? '#c2c0d0' : '#5a5970';
  $: accentColor = monochrome ? ink : accent;
</script>

<div class="wm" style:--ink={ink} style:--muted={muted} style:--sub={subColor} style:--accent={accentColor}>
  <div
    class="top"
    style:font-size="{s.top}px"
    style:margin-bottom="{s.gapTop}px"
  >
    A school of music &amp; dance
  </div>

  <div class="name" style:font-size="{s.name}px">
    Revathi <em>Arts</em>
  </div>

  <div
    class="flourish"
    aria-hidden="true"
    style:margin-top="{s.gapFl}px"
    style:gap="{s.flourish * 0.07}px"
  >
    <span class="line" style:width="{s.flourish * 0.45}px"></span>
    <span class="dot"  style:width="{s.flourish * 0.04}px" style:height="{s.flourish * 0.04}px"></span>
    <span class="line" style:width="{s.flourish * 0.45}px"></span>
  </div>

  <div class="sub" style:font-size="{s.sub}px" style:margin-top="{s.gapSub}px">
    Music &amp; Dance
  </div>
</div>

<style>
  .wm {
    text-align: center;
    font-family: "Newsreader", Georgia, serif;
    color: var(--ink);
    line-height: 1;
  }
  .top {
    font-family: "Geist", system-ui, sans-serif;
    font-weight: 500;
    letter-spacing: 0.36em;
    text-transform: uppercase;
    color: var(--muted);
    padding-left: 0.36em; /* offset visual centering against tracked caps */
  }
  .name {
    font-weight: 400;
    letter-spacing: -0.01em;
  }
  .name em {
    font-style: italic;
    font-weight: 400;
    color: var(--accent);
  }
  .flourish {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent);
  }
  .flourish .line { height: 1px; background: currentColor; opacity: 0.5; }
  .flourish .dot  { background: currentColor; border-radius: 50%; }
  .sub {
    font-style: italic;
    font-weight: 400;
    color: var(--sub);
  }
</style>
