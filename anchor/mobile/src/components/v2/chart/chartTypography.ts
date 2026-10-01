import { typography as base } from '@/theme/v2';
/** Chart follows Home/Details type families without changing the shared theme or Home rendering. */
const title = 'BricolageGrotesque-SemiBold';
const body = 'Figtree-Regular';
const label = 'Figtree-SemiBold';
export const chartTypography = {
  ...base,
  displayMedium:{ ...base.displayMedium,fontFamily:title },
  headingXL:{ ...base.headingXL,fontFamily:title },
  headingLG:{ ...base.headingLG,fontFamily:title },
  headingMD:{ ...base.headingMD,fontFamily:title },
  headingSM:{ ...base.headingSM,fontFamily:title },
  bodyLG:{ ...base.bodyLG,fontFamily:body },
  bodyMD:{ ...base.bodyMD,fontFamily:body },
  bodySM:{ ...base.bodySM,fontFamily:body },
  labelLG:{ ...base.labelLG,fontFamily:label },
  labelMD:{ ...base.labelMD,fontFamily:label },
  labelSM:{ ...base.labelSM,fontFamily:label },
};
