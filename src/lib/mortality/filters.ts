import type { Filters, PyramidMeasure, Sex } from "./types";

type Listener = (filters: Filters) => void;

export class FiltersStore {
  #filters: Filters;
  #listeners = new Set<Listener>();

  constructor(initial: Filters) {
    this.#filters = initial;
  }

  get(): Filters {
    return this.#filters;
  }

  subscribe(listener: Listener): () => void {
    this.#listeners.add(listener);
    listener(this.#filters);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  #set(next: Filters): void {
    this.#filters = next;
    for (const listener of this.#listeners) listener(next);
  }

  setLocation(location: string): void {
    this.#set({ ...this.#filters, location });
  }

  setSex(sex: Sex): void {
    this.#set({ ...this.#filters, sex });
  }

  setYear(year: number): void {
    this.#set({ ...this.#filters, year });
  }

  setCauseGroup(causeGroup: string | null): void {
    this.#set({
      ...this.#filters,
      causeGroup,
      detailedSubgroup: null,
      externalCauseType: null,
      assaultMeans: null,
    });
  }

  setCauseSelection(selection: {
    causeGroup: string;
    detailedSubgroup?: string | null;
    externalCauseType?: string | null;
    assaultMeans?: string | null;
  }): void {
    this.#set({
      ...this.#filters,
      causeGroup: selection.causeGroup,
      detailedSubgroup: selection.detailedSubgroup ?? null,
      externalCauseType: selection.externalCauseType ?? null,
      assaultMeans: selection.assaultMeans ?? null,
    });
  }

  setDetailedSubgroup(detailedSubgroup: string | null): void {
    this.#set({ ...this.#filters, detailedSubgroup });
  }

  setExternalCauseType(externalCauseType: string | null): void {
    this.#set({ ...this.#filters, externalCauseType, assaultMeans: null });
  }

  setAssaultMeans(assaultMeans: string | null): void {
    this.#set({ ...this.#filters, assaultMeans });
  }

  setPyramidMeasure(pyramidMeasure: PyramidMeasure): void {
    this.#set({ ...this.#filters, pyramidMeasure });
  }
}
