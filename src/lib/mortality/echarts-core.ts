import * as echarts from "echarts/core";
import {
  BarChart,
  LineChart,
  MapChart,
  ScatterChart,
  TreemapChart,
} from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  TooltipComponent,
  VisualMapComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
  BarChart,
  LineChart,
  MapChart,
  ScatterChart,
  TreemapChart,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  TooltipComponent,
  VisualMapComponent,
  CanvasRenderer,
]);

export { echarts };
export type { EChartsCoreOption, EChartsType } from "echarts/core";
