import { DataTexture, NearestFilter, RGBAFormat } from 'three';

let ramp: DataTexture | null = null;

/** Three-band light ramp shared by every toon material (characters and figure pieces). */
export const toonRamp = (): DataTexture => {
  if (!ramp) {
    ramp = new DataTexture(
      new Uint8Array([175, 175, 175, 255, 225, 225, 225, 255, 255, 255, 255, 255]),
      3,
      1,
      RGBAFormat,
    );
    ramp.minFilter = NearestFilter;
    ramp.magFilter = NearestFilter;
    ramp.needsUpdate = true;
  }
  return ramp;
};
