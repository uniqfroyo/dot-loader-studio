import type { CSSProperties, ReactElement } from 'react';
import type { LoaderDefinition } from './index';

export interface DotLoaderProps {
  loader: LoaderDefinition;
  /** Dot size in px. Defaults to the size the loader was designed at. */
  size?: number;
  /** Gap in px. Defaults to scaling with `size`. */
  gap?: number;
  /** Accessible label. Default "Loading". */
  label?: string;
  className?: string;
  style?: CSSProperties;
}

export declare function DotLoader(props: DotLoaderProps): ReactElement;
export default DotLoader;
