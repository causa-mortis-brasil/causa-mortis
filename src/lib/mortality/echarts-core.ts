import * as echarts from "echarts/core";
import type {
  BarSeriesOption,
  LineSeriesOption,
  MapSeriesOption,
  PieSeriesOption,
  ScatterSeriesOption,
  TreemapSeriesOption,
} from "echarts/charts";
import type {
  GridComponentOption,
  LegendComponentOption,
  MarkAreaComponentOption,
  TooltipComponentOption,
  VisualMapComponentOption,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { ComposeOption } from "echarts/core";
import type {
  CallbackDataParams,
  TopLevelFormatterParams,
} from "echarts/types/dist/shared";

echarts.use([CanvasRenderer]);

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
  | GridComponentOption
  | LegendComponentOption
  | MarkAreaComponentOption
  | TooltipComponentOption
  | VisualMapComponentOption
>;
