/** One exportable table: a title, its column headers, and its rows. */
export interface ExportTable {
  title: string;
  headers: string[];
  rows: (string | number)[][];
}

/** One exportable section of the dashboard — may contain several tables
 * (e.g. "Portfolio" has KPIs, key findings, stage distribution, ... all as
 * separate tables/sheets, but they're offered to the user as one scope). */
export interface ExportSection {
  id: 'calendly' | 'portfolio' | 'operations';
  label: string;
  tables: ExportTable[];
}
