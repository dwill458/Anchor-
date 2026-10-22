import React from 'react';
import type { ShareTemplateProps } from '../shareTypes';
import { EnvironmentPoster } from './EnvironmentPoster';

/** Anchor-first: the style's environment, a large Anchor, the intention beneath it. */
export function StyleExportTemplate(props: ShareTemplateProps) {
  return <EnvironmentPoster kind="style" {...props} />;
}
