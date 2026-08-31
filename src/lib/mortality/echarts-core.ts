import * as echarts from "echarts/core";
import {
  BarChart,
  LineChart,
  MapChart,
  ScatterChart,
  TreemapChart,
} from "echarts/charts";
import {
  GraphicComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  TooltipComponent,
  VisualMapComponent,
} from "echarts/components";
import { LabelLayout } from "echarts/features";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
  BarChart,
  LineChart,
  MapChart,
  ScatterChart,
  TreemapChart,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  TooltipComponent,
  VisualMapComponent,
  LabelLayout,
  CanvasRenderer,
]);

export { echarts };
export type {
  ECElementEvent,
  EChartsCoreOption,
  EChartsType,
} from "echarts/core";
