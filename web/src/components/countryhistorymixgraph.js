import moment from 'moment';
import React, { useState, useMemo } from 'react';
import { max as d3Max } from 'd3-array';
import { connect } from 'react-redux';
import { forEach } from 'lodash';

import formatting from '../helpers/formatting';
import { getCo2Scale } from '../helpers/scales';
import { modeOrder, modeColor } from '../helpers/constants';
import {
  getSelectedZoneHistory,
  getSelectedZoneExchangeKeys,
  getZoneHistoryStartTime,
  getZoneHistoryEndTime,
} from '../selectors';
import {
  createGraphBackgroundMouseMoveHandler,
  createGraphBackgroundMouseOutHandler,
  createGraphLayerMouseMoveHandler,
  createGraphLayerMouseOutHandler,
} from '../helpers/history';

import AreaGraph from './graph/areagraph';

const getValuesInfo = (historyData, displayByEmissions) => {
  const maxTotalValue = d3Max(historyData, ([t, d]) => (
    displayByEmissions
      ? (d.totalCo2Production + d.totalCo2Import + d.totalCo2Discharge) / 1e6 / 60.0 // in tCO2eq/min
      : (d.totalProduction + d.totalImport + d.totalDischarge) // in MW
  ));
  const format = formatting.scalePower(maxTotalValue);

  const valueAxisLabel = displayByEmissions ? 'tCO2eq / min' : format.unit;
  const valueFactor = format.formattingFactor;
  return { valueAxisLabel, valueFactor };
};

const prepareGraphData = (historyData, colorBlindModeEnabled, displayByEmissions, electricityMixMode, exchangeKeys, carbonIntensityDomain) => {
  if (!historyData || !historyData[0]) return {};

  const { valueAxisLabel, valueFactor } = getValuesInfo(historyData, displayByEmissions);
  const co2ColorScale = getCo2Scale(colorBlindModeEnabled, carbonIntensityDomain);

  const key = electricityMixMode === 'consumption'
    ? 'primaryEnergyConsumptionTWh'
    : 'primaryEnergyProductionTWh';

  // Format history data received by the API
  // TODO: Simplify this function and make it more readable
  const data = historyData.map((entry) => {
    const [t, d] = entry;
    const obj = {
      datetime: moment(t).toDate(),
    };
    // Add production
    modeOrder.forEach((k) => {
      const isStorage = k.indexOf('storage') !== -1;
      const value = isStorage
        ? -1 * Math.min(0, (d.storage || {})[k.replace(' storage', '')])
        : (d[key] || {})[k];
      // in GW or MW
      obj[k] = value / valueFactor;
      if (Number.isFinite(value) && displayByEmissions && obj[k] != null) {
        // in tCO2eq/min
        // HACK: do nothing for now
        // if (isStorage && obj[k] >= 0) {
        //   obj[k] *= d.dischargeCo2Intensities[k.replace(' storage', '')] / 1e3 / 60.0;
        // } else {
        //   obj[k] *= d.productionCo2Intensities[k] / 1e3 / 60.0;
        // }
      }
    });
    if (electricityMixMode === 'consumption') {
      // // Add exchange
      // forEach(d.exchange, (value, key) => {
      //   // in GW or MW
      //   obj[key] = Math.max(0, value / valueFactor);
      //   if (Number.isFinite(value) && displayByEmissions && obj[key] != null) {
      //     // in tCO2eq/min
      //     obj[key] *= d.exchangeCo2Intensities[key] / 1e3 / 60.0;
      //   }
      // });
    }
    // Keep a pointer to original data
    obj._countryData = entry;
    return obj;
  });

  // Show the exchange layers (if they exist) on top of the standard sources.
  const layerKeys = modeOrder.concat(exchangeKeys);

  const layerFill = (key) => {
    // If exchange layer, set the horizontal gradient by using a different fill for each datapoint.
    if (exchangeKeys.includes(key)) {
      return d => co2ColorScale((d.data._countryData.exchangeCo2Intensities || {})[key]);
    }
    // Otherwise use regular production fill.
    return modeColor[key];
  };

  return {
    data,
    layerKeys,
    layerFill,
    valueAxisLabel,
  };
};

const mapStateToProps = state => ({
  colorBlindModeEnabled: state.application.colorBlindModeEnabled,
  displayByEmissions: state.application.tableDisplayEmissions,
  electricityMixMode: state.application.electricityMixMode,
  exchangeKeys: getSelectedZoneExchangeKeys(state),
  startTime: getZoneHistoryStartTime(state),
  endTime: getZoneHistoryEndTime(state),
  historyData: getSelectedZoneHistory(state),
  isMobile: state.application.isMobile,
  selectedTimeIndex: state.application.selectedZoneTimeIndex,
  carbonIntensityDomain: state.application.carbonIntensityDomain,
});

const CountryHistoryMixGraph = ({
  colorBlindModeEnabled,
  displayByEmissions,
  electricityMixMode,
  exchangeKeys,
  startTime,
  endTime,
  historyData,
  isMobile,
  selectedTimeIndex,

  carbonIntensityDomain,
}) => {
  const [selectedLayerIndex, setSelectedLayerIndex] = useState(null);

  // Recalculate graph data only when the history data is changed
  const {
    data,
    layerKeys,
    layerFill,
    valueAxisLabel,
  } = useMemo(
    () => prepareGraphData(historyData, colorBlindModeEnabled, displayByEmissions, electricityMixMode, exchangeKeys, carbonIntensityDomain),
    [historyData, colorBlindModeEnabled, displayByEmissions, electricityMixMode, exchangeKeys, carbonIntensityDomain]
  );

  // Mouse action handlers
  const backgroundMouseMoveHandler = useMemo(createGraphBackgroundMouseMoveHandler, []);
  const backgroundMouseOutHandler = useMemo(createGraphBackgroundMouseOutHandler, []);
  const layerMouseMoveHandler = useMemo(
    () => createGraphLayerMouseMoveHandler(isMobile, setSelectedLayerIndex),
    [isMobile, setSelectedLayerIndex]
  );
  const layerMouseOutHandler = useMemo(
    () => createGraphLayerMouseOutHandler(setSelectedLayerIndex),
    [setSelectedLayerIndex]
  );

  return (
    <AreaGraph
      data={data}
      layerKeys={layerKeys}
      layerFill={layerFill}
      startTime={startTime}
      endTime={endTime}
      valueAxisLabel={valueAxisLabel}
      backgroundMouseMoveHandler={backgroundMouseMoveHandler}
      backgroundMouseOutHandler={backgroundMouseOutHandler}
      layerMouseMoveHandler={layerMouseMoveHandler}
      layerMouseOutHandler={layerMouseOutHandler}
      selectedTimeIndex={selectedTimeIndex}
      selectedLayerIndex={selectedLayerIndex}
      isMobile={isMobile}
      height="10em"
    />
  );
};

export default connect(mapStateToProps)(CountryHistoryMixGraph);
