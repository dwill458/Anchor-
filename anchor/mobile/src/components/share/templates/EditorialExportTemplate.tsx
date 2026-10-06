import React from 'react';
import type { ShareTemplateProps } from '../shareTypes';
import { EnvironmentPoster } from './EnvironmentPoster';

/** Intention-first: the same environment as Style, a small emblem Anchor, dominant type. */
export function EditorialExportTemplate(props: ShareTemplateProps) {
  return <EnvironmentPoster kind="editorial" {...props} />;
}
