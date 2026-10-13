import React from 'react';
import type { ShareLayoutId, ShareTemplateProps } from './shareTypes';
import { MinimalExportTemplate } from './templates/MinimalExportTemplate';
import { StyleExportTemplate } from './templates/StyleExportTemplate';
import { EditorialExportTemplate } from './templates/EditorialExportTemplate';
import { VisionExportTemplate } from './templates/VisionExportTemplate';

const TEMPLATES: Record<ShareLayoutId, React.ComponentType<ShareTemplateProps>> = {
  minimal: MinimalExportTemplate,
  style: StyleExportTemplate,
  editorial: EditorialExportTemplate,
  vision: VisionExportTemplate,
};

/** One entry point for previews, thumbnails and the export render. */
export const ShareTemplate = React.memo(function ShareTemplate({ layout, ...props }: ShareTemplateProps & { layout: ShareLayoutId }) {
  const Template = TEMPLATES[layout];
  return <Template {...props} />;
});
