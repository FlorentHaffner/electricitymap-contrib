// Requires `brew install imagemagick`

import child_process from 'child_process';
import { scaleLinear } from 'd3-scale';
import { range } from 'lodash';

import { themes } from './src/helpers/themes';

function generateArrows(prefix, theme) {
  const co2color = scaleLinear()
    .domain(theme.steps)
    .range(theme.colors);

  const templates = [
    { value: 'highlight', color: 'white' },
    { value: 'nan', color: 'gray'},
    ...range(0, 880, 80).map(value => ({ value, color: co2color(value) })),
  ];

  templates.forEach(({ value, color }) => {
    const args = [
      'public/images/arrow-template.png',
      '+level-colors', `transparent,${color}`,
      `public/images/${prefix}arrow-${value}.png`
    ];
    child_process.spawn('convert', args).on('close', (code) => {
      if(code !== 0) {
        console.error(`failed (code: ${code})`, args);
        return;
      }
      console.log('generated', args);
    });
  });
}

generateArrows('', themes.dark.co2Scale);
generateArrows('colorblind-', themes.colorblindDark.co2Scale);
