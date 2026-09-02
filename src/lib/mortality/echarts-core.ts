import * as echarts from "echarts/core";
import {
  BarChart,
  LineChart,
  MapChart,
  PieChart,
  ScatterChart,
  TreemapChart,
} from "echarts/charts";
import type {
  BarSeriesOption,
  LineSeriesOption,
  MapSeriesOption,
  PieSeriesOption,
  ScatterSeriesOption,
  TreemapSeriesOption,
} from "echarts/charts";
import {
  GraphicComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  TooltipComponent,
  VisualMapComponent,
} from "echarts/components";
import type {
  GraphicComponentOption,
  GridComponentOption,
  LegendComponentOption,
  MarkAreaComponentOption,
  TooltipComponentOption,
  VisualMapComponentOption,
} from "echarts/components";
import { LabelLayout } from "echarts/features";
import { CanvasRenderer } from "echarts/renderers";
import type { ComposeOption } from "echarts/core";
import type {
  CallbackDataParams,
  TopLevelFormatterParams,
} from "echarts/types/dist/shared";

echarts.use([
  BarChart,
  LineChart,
  MapChart,
  PieChart,
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
export type { ECElementEvent, EChartsType } from "echarts/core";
export type { CallbackDataParams, TopLevelFormatterParams };

export type EChartsOption = ComposeOption<
  | BarSeriesOption
  | LineSeriesOption
  | MapSeriesOption
  | PieSeriesOption
  | ScatterSeriesOption
  | TreemapSeriesOption
  | GraphicComponentOption
  | GridComponentOption
  | LegendComponentOption
  | MarkAreaComponentOption
  | TooltipComponentOption
  | VisualMapComponentOption
>;
