/** Generic option shape for any dropdown/radio/checkbox group. */
export interface SelectOption<T = string> {
  value: T;
  label: string;
  disabled?: boolean;
  icon?: string;
}

/** Column descriptor for a generic data table. */
export interface TableColumn<T = unknown> {
  key: keyof T & string;
  label: string;
  sortable?: boolean;
  width?: string;
  align?: 'start' | 'center' | 'end';
}

/** Breadcrumb entry for the layout shell. */
export interface Breadcrumb {
  label: string;
  route?: string;
}
