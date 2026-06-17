import { optimize, type Config } from 'svgo';

const svgoConfig: Config = {
  multipass: true,
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: {
          convertColors: {
            shortname: false,
          },
          convertShapeToPath: {
            convertArcs: true,
          },
          convertPathData: false,
          inlineStyles: {
            onlyMatchedOnce: false,
          },
          mergePaths: false,
          removeUselessStrokeAndFill: {
            removeNone: true,
          },
        },
      },
    },
    'convertStyleToAttrs',
    'removeDimensions',
    'removeRasterImages',
    'removeScripts',
    'removeStyleElement',
    {
      name: 'removeAttrs',
      params: {
        attrs: 'svg:fill:none|svg:xml:space',
      },
    },
  ],
} as const;

export function normalizeSvgForLayerize(svg: string, filePath: string): string {
  return optimize(svg, {
    path: filePath,
    ...svgoConfig,
  }).data;
}
