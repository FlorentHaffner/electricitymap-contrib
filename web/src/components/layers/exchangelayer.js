import React, {
  useState,
  useMemo,
  useRef,
} from 'react';
import { useSelector } from 'react-redux';
import styled, { keyframes } from 'styled-components';
import { noop } from 'lodash';

import { dispatchApplication } from '../../store';
import { useExchangeArrowsData } from '../../hooks/layers';
import { useWidthObserver, useHeightObserver } from '../../hooks/viewport';
import {
  exchangeQuantizedIntensityScale,
  exchangeSpeedCategoryScale,
} from '../../helpers/scales';

import MapExchangeTooltip from '../tooltips/mapexchangetooltip';

const slidingHighlight = keyframes`
 10% { mask-image: linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.8) 5%, rgba(0,0,0,1) 10%); }
 15% { mask-image: linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.7) 15%, rgba(0,0,0,1) 30%); }
 20% { mask-image: linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.6) 20%, rgba(0,0,0,1) 40%); }
 20% { mask-image: linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.6) 25%, rgba(0,0,0,1) 50%); }
 30% { mask-image: linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.5) 30%, rgba(0,0,0,1) 60%); }
 35% { mask-image: linear-gradient(to bottom, rgba(0,0,0,1) 5%, rgba(0,0,0,0.5) 35%, rgba(0,0,0,1) 65%); }
 40% { mask-image: linear-gradient(to bottom, rgba(0,0,0,1) 10%, rgba(0,0,0,0.4) 40%, rgba(0,0,0,1) 70%); }
 45% { mask-image: linear-gradient(to bottom, rgba(0,0,0,1) 15%, rgba(0,0,0,0.4) 45%, rgba(0,0,0,1) 75%); }
 50% { mask-image: linear-gradient(to bottom, rgba(0,0,0,1) 20%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,1) 80%); }
 55% { mask-image: linear-gradient(to bottom, rgba(0,0,0,1) 25%, rgba(0,0,0,0.4) 55%, rgba(0,0,0,1) 85%); }
 60% { mask-image: linear-gradient(to bottom, rgba(0,0,0,1) 30%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,1) 90%); }
 65% { mask-image: linear-gradient(to bottom, rgba(0,0,0,1) 35%, rgba(0,0,0,0.5) 65%, rgba(0,0,0,1) 95%); }
 70% { mask-image: linear-gradient(to bottom, rgba(0,0,0,1) 40%, rgba(0,0,0,0.5) 70%, rgba(0,0,0,1) 100%); }
 75% { mask-image: linear-gradient(to bottom, rgba(0,0,0,1) 50%, rgba(0,0,0,0.6) 75%, rgba(0,0,0,1) 100%); }
 80% { mask-image: linear-gradient(to bottom, rgba(0,0,0,1) 60%, rgba(0,0,0,0.6) 80%, rgba(0,0,0,1) 100%); }
 85% { mask-image: linear-gradient(to bottom, rgba(0,0,0,1) 70%, rgba(0,0,0,0.7) 85%, rgba(0,0,0,1) 100%); }
 90% { mask-image: linear-gradient(to bottom, rgba(0,0,0,1) 90%, rgba(0,0,0,0.8) 95%, rgba(0,0,0,1) 100%); }
`;

// TODO: Fix map scrolling when hovering over arrows when moving map to React.
// See https://github.com/tmrowco/electricitymap-contrib/issues/2309.
const ArrowImage = styled.img`
  animation: ${slidingHighlight} 2s infinite;
  cursor: pointer;
  overflow: hidden;
  position: absolute;
  pointer-events: all;
  image-rendering: crisp-edges;
  left: -25px;
  top: -41px;
`;

const Arrow = React.memo(({
  arrow,
  mouseMoveHandler,
  mouseOutHandler,
  project,
  viewportWidth,
  viewportHeight,
}) => {
  const isMobile = useSelector(state => state.application.isMobile);
  const mapZoom = useSelector(state => state.application.mapViewport.zoom);
  const colorBlindModeEnabled = useSelector(state => state.application.colorBlindModeEnabled);
  const {
    co2intensity,
    lonlat,
    netFlow,
    rotation,
  } = arrow;

  const imageSource = useMemo(
    () => {
      const prefix = colorBlindModeEnabled ? 'colorblind-' : '';
      const intensity = exchangeQuantizedIntensityScale(co2intensity);
      const speed = exchangeSpeedCategoryScale(Math.abs(netFlow));
      return resolvePath(`images/${prefix}arrow-${intensity}.png`);
      // return resolvePath(`images/${prefix}arrow-${intensity}-animated-${speed}.gif`);
    },
    [colorBlindModeEnabled, co2intensity, netFlow],
  );

  const transform = useMemo(
    () => ({
      x: project(lonlat)[0],
      y: project(lonlat)[1],
      k: 0.04 + (mapZoom - 1.5) * 0.1,
      r: rotation + (netFlow > 0 ? 180 : 0),
    }),
    [lonlat, rotation, netFlow, mapZoom],
  );

  const isVisible = useMemo(
    () => {
      // Hide arrows with a very low flow...
      if (Math.abs(netFlow || 0) < 1) return false;

      // ... or the ones that would be rendered outside of viewport ...
      if (transform.x + 100 * transform.k < 0) return false;
      if (transform.y + 100 * transform.k < 0) return false;
      if (transform.x - 100 * transform.k > viewportWidth) return false;
      if (transform.y - 100 * transform.k > viewportHeight) return false;

      // ... and show all the other ones.
      return true;
    },
    [netFlow, transform],
  );

  return (
    <ArrowImage
      style={{
        display: isVisible ? '' : 'none',
        transform: `translateX(${transform.x}px) translateY(${transform.y}px) rotate(${transform.r}deg) scale(${transform.k})`,
      }}
      src={imageSource}
      width="49"
      height="81"
      /* Support only click events in mobile mode, otherwise react to mouse hovers */
      onClick={isMobile ? (e => mouseMoveHandler(arrow, e.clientX, e.clientY)) : noop}
      onMouseMove={!isMobile ? (e => mouseMoveHandler(arrow, e.clientX, e.clientY)) : noop}
      onMouseOut={mouseOutHandler}
      onBlur={mouseOutHandler}
    />
  );
});

const ArrowsContainer = styled.div`
  pointer-events: none;
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
`;

export default React.memo(({ project }) => {
  const ref = useRef();
  const arrows = useExchangeArrowsData();
  const width = useWidthObserver(ref);
  const height = useHeightObserver(ref);

  const isMoving = useSelector(state => state.application.isMovingMap);
  const [tooltip, setTooltip] = useState(null);

  // Mouse interaction handlers
  const handleArrowMouseMove = useMemo(() => (exchangeData, x, y) => {
    dispatchApplication('isHoveringExchange', true);
    dispatchApplication('co2ColorbarValue', exchangeData.co2intensity);
    setTooltip({ exchangeData, position: { x, y } });
  }, []);
  const handleArrowMouseOut = useMemo(() => () => {
    dispatchApplication('isHoveringExchange', false);
    dispatchApplication('co2ColorbarValue', null);
    setTooltip(null);
  }, []);

  return (
    <ArrowsContainer id="exchange" ref={ref}>
      {tooltip && (
        <MapExchangeTooltip
          exchangeData={tooltip.exchangeData}
          position={tooltip.position}
        />
      )}
      {/* Don't render arrows when moving map - see https://github.com/tmrowco/electricitymap-contrib/issues/1590. */}
      {!isMoving && arrows.map(arrow => (
        <Arrow
          arrow={arrow}
          key={arrow.sortedCountryCodes}
          mouseMoveHandler={handleArrowMouseMove}
          mouseOutHandler={handleArrowMouseOut}
          project={project}
          viewportWidth={width}
          viewportHeight={height}
        />
      ))}
    </ArrowsContainer>
  );
});
