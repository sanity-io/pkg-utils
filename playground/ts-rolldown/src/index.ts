/** @public */
export const VERSION: string = process.env['PKG_VERSION'] || '1.0.0'

/** @public */
export enum Direction {
  Up,
  Down,
  Left,
  Right,
}

/** @public */
export class Point {
  constructor(
    public x: number,
    public y: number,
    protected z: number,
    private perspective: number,
  ) {}
}
