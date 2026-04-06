"use client";

import dynamic from "next/dynamic";

const BackgroundMusic = dynamic(
  () => import("./BackgroundMusic").then(m => ({ default: m.BackgroundMusic })),
  { ssr: false }
);
const SoundEffects = dynamic(
  () => import("./SoundEffects").then(m => ({ default: m.SoundEffects })),
  { ssr: false }
);

export const LazyAudio = () => (
  <>
    <BackgroundMusic />
    <SoundEffects />
  </>
);
