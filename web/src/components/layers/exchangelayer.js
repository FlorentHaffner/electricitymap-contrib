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
  0% { mask-image: linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 0%); }
 10% { mask-image: linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.2) 5%, rgba(0,0,0,0) 10%); }
 15% { mask-image: linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.3) 15%, rgba(0,0,0,0) 30%); }
 20% { mask-image: linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.4) 20%, rgba(0,0,0,0) 40%); }
 20% { mask-image: linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.4) 25%, rgba(0,0,0,0) 50%); }
 30% { mask-image: linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.5) 30%, rgba(0,0,0,0) 60%); }
 35% { mask-image: linear-gradient(to bottom, rgba(0,0,0,0) 5%, rgba(0,0,0,0.5) 35%, rgba(0,0,0,0) 65%); }
 40% { mask-image: linear-gradient(to bottom, rgba(0,0,0,0) 10%, rgba(0,0,0,0.6) 40%, rgba(0,0,0,0) 70%); }
 45% { mask-image: linear-gradient(to bottom, rgba(0,0,0,0) 15%, rgba(0,0,0,0.6) 45%, rgba(0,0,0,0) 75%); }
 50% { mask-image: linear-gradient(to bottom, rgba(0,0,0,0) 20%, rgba(0,0,0,0.7) 50%, rgba(0,0,0,0) 80%); }
 55% { mask-image: linear-gradient(to bottom, rgba(0,0,0,0) 25%, rgba(0,0,0,0.6) 55%, rgba(0,0,0,0) 85%); }
 60% { mask-image: linear-gradient(to bottom, rgba(0,0,0,0) 30%, rgba(0,0,0,0.6) 60%, rgba(0,0,0,0) 90%); }
 65% { mask-image: linear-gradient(to bottom, rgba(0,0,0,0) 35%, rgba(0,0,0,0.5) 65%, rgba(0,0,0,0) 95%); }
 70% { mask-image: linear-gradient(to bottom, rgba(0,0,0,0) 40%, rgba(0,0,0,0.5) 70%, rgba(0,0,0,0) 100%); }
 75% { mask-image: linear-gradient(to bottom, rgba(0,0,0,0) 50%, rgba(0,0,0,0.4) 75%, rgba(0,0,0,0) 100%); }
 80% { mask-image: linear-gradient(to bottom, rgba(0,0,0,0) 60%, rgba(0,0,0,0.4) 80%, rgba(0,0,0,0) 100%); }
 85% { mask-image: linear-gradient(to bottom, rgba(0,0,0,0) 70%, rgba(0,0,0,0.3) 85%, rgba(0,0,0,0) 100%); }
 90% { mask-image: linear-gradient(to bottom, rgba(0,0,0,0) 90%, rgba(0,0,0,0.2) 95%, rgba(0,0,0,0) 100%); }
100% { mask-image: linear-gradient(to bottom, rgba(0,0,0,0) 100%, rgba(0,0,0,0) 100%, rgba(0,0,0,0) 100%); }
`;

const ArrowImage = styled.img`
  position: absolute;
  image-rendering: crisp-edges;
  overflow: hidden;
  left: -25px;
  top: -41px;
  width: 50px;
  height: 82px;
`;

const HoverableArrowImage = styled(ArrowImage)`
  cursor: pointer;
  pointer-events: all;
`;

const AnimatedHighlight = styled(ArrowImage)`
  animation: ${slidingHighlight} ${props => props.speed} infinite;
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

  if (!isVisible || transform.k < 0.1) return null;

  return (
    <div
      className="arrow"
      style={{
        transform: `translateX(${transform.x}px) translateY(${transform.y}px) rotate(${transform.r}deg) scale(${transform.k})`,
        position: 'absolute',
      }}
    >
      <HoverableArrowImage
        src={imageSource}
        /* Support only click events in mobile mode, otherwise react to mouse hovers */
        onClick={isMobile ? (e => mouseMoveHandler(arrow, e.clientX, e.clientY)) : noop}
        onMouseMove={!isMobile ? (e => mouseMoveHandler(arrow, e.clientX, e.clientY)) : noop}
        onMouseOut={mouseOutHandler}
        onBlur={mouseOutHandler}
      />
      <AnimatedHighlight
        src={resolvePath(`images/arrow-highlight.png`)}
        speed="2s"
      />
    </div>
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
